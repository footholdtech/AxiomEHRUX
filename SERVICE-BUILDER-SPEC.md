# Service Builder

**Admin › Builders › Service Builder** is where admins build the services
staff pick when they document their work. The staff side is a "which
service?" step at the start of a note, and a Services page in the chart.

This replaces `SERVICE-BUILDER-PROPOSAL.md`. The decisions Lisa made on
2026-11-13 are recorded below.

- Admin code: `src/55-service-builder.jsx`.
- Staff code: `src/56-services-staff.jsx`.
- Seed data: `tools/build-service-fixtures.py` writes `services.json`. Run
  it, with `tools/build-due-date-fixtures.py`, before
  `tools/build-refdata.py`.
- Storage: services, templates and client instances persist to
  `axiom-services-v1` in localStorage, in one store. Due Date Rules reads
  its Applied To counts from the same store.

## The model

A **service** is the container for what a staff member does with a client.
It decides the codes, diagnoses, programs, roles, sites, payors, sensitivity
and due dates that apply, so staff only complete what it asks for.

**One object, two shapes.**

- **A single document.** This is the common case. For example, "Standard 15m
  Post Class Check-In" is one Progress Note. Staff think in documents ("I
  need a progress note"), and the service applies everything else.
- **A workflow.** For example, "Teen Crisis Intake" is consents, a screening,
  an assessment, a safety plan and a service plan, with a deadline for the
  whole thing.

| Layer | What it is |
| --- | --- |
| Building blocks | Defined once each: service codes (with modifiers and units), diagnosis sets, diagnosis precedence, sensitivity classes, documents, appointment types, due date rules. Programs, roles, sites, payors and funding already live elsewhere in Admin; Service Builder only references them. |
| Templates | Starting points only. Most are shipped by an implementation team (by program, region or migration), and some are the agency's own. |
| Services | What staff pick. Versioned, with effective dates. |
| Service instances | One service, performed or under way for one client, on a date of service. They tie a workflow's steps together. |

## Decided

1. **Templates pre-fill, nothing more.**
   - Picking a template is the first step of New Service. After that, the
     service and the template are independent.
   - Editing a service never touches its template. Editing a template
     changes only services made from it afterwards.
   - The service shows "Started from Standard Therapy" for reporting. If the
     template is deleted, it says "a template that's since been deleted".
2. **Due date rules apply at two levels**, both from the Due Date Rules
   library:
   - **On each step.** Adding a document brings in its form's default rule,
     which can be changed for this service only.
   - **On the service, as its deadline**, once it has two or more steps.
     The deadline sets each required step's first due date; the step's own
     rules take over for the renewals after it.
3. **Due dates are granular: per client, per document, per rule.** The
   service instance is the rationale layer that strings deliverables into a
   workflow.
4. **Versions with effective dates.**
   - Saving a live service creates the next version, with a "takes effect
     on" date and an optional note saying what changed and why.
   - A version dated in the future is **Scheduled**. Saving again while one
     is scheduled updates it in place.
   - A draft has no effective date until **Activate**.
   - The service **name** isn't versioned.
5. **Who can pick a service: role, then specific security.**
   - Admins choose roles on the service.
   - Each staff member is then checked against every security the service
     carries: programs, sites and sensitivity class.
   - On a chart, the client must also be enrolled in one of the service's
     programs that the staff member can access.
   - Staff specific security is seeded in `services.json`, under
     `staff_security`.
6. **Staff start from the note.** Under Notes, Progress Note first asks which
   service was performed and the date of service.
7. **Services is a client page.** It appears in the chart, as a top-level
   left-nav item and in Tab Sets, not as an agency-wide section.

These are my recommendations, built as proposed, and they can still change:

- A form carries a default rule, and a service can change it.
- Steps can wait for an earlier step ("Can start after step 2"). There's no
  branching.
- The admin editor is a single page of compartment cards with side drawers,
  not a stepper.

## Admin screens

### Landing page

The page has three pills: **Services · Templates · Building Blocks**. The
routes are `/service-builder`, `/templates` and `/blocks`.

- **Services** is a table with these columns:
  - service and its "started from";
  - what staff complete (single document, or workflow · *n* steps with its
    deadline);
  - programs;
  - roles;
  - codes;
  - version (in effect since, and the next scheduled one);
  - status.

  It has filters for program, shape and status (including "Changing soon"),
  and a search over names, documents and codes.
- **Templates** has a "built by" column (Implementation team or Your
  agency), and a count of the services made from each template. Each row
  has Use and Edit buttons, and the page has a New Template button.
- **Building Blocks** is a set of library cards, each showing its entries and
  a "used by *n* services" count. There are two groups: "Defined Here", and
  "Defined Elsewhere in Admin" (which says where each one is managed).

### Library pages (`/service-builder/blocks/:key`)

Each library page lists its entries, each with a "used by" count. The count
opens the same searchable services list as Due Date Rules. Due Date Rules is
the one library with a full editor. Editing the other libraries isn't built
in the prototype.

### New Service

New Service is a three-step dialog:

1. **Pick a starting point.** Templates are grouped by collection, or you
   can start blank.
2. **Name it and say who it's for.** You choose programs and roles here;
   roles come pre-filled from the template.
3. **Review what it brings.**

It lands as a **Draft** in the editor.

### Editor (`/service-builder/services/:id`; templates use the same page)

- **The version bar.** It shows the version in effect and since when, any
  scheduled version, "your changes will be Version *n*" while editing, and a
  History button.
  - History lists every version: In effect, Scheduled or Past, with who
    changed it and their note.
  - **Compare** shows the before and after of each compartment that
    changed.
- **Basics**: the name as staff see it, the default duration, and a
  description for admins.
- **Compartments**, in four groups. Each card opens a side drawer:

  | Group | Cards |
  | --- | --- |
  | Who and Where | Roles · Programs · Sites |
  | Billing | Service codes (with units and modifiers) · Payors · Funding |
  | Clinical | Diagnoses · Diagnosis precedence · Sensitivity |
  | What Staff Complete | Steps, an ordered list of documents and appointments · Service deadline |

  Each step can be dragged or moved up and down, and marked required or
  optional. It can wait for an earlier step, and carries its rules as chips
  with an Add Rule control.
- **The rail is Checks only.** Errors block Activate and Save:
  - no name;
  - no steps;
  - no roles or no programs;
  - a step that waits for a later step.

  Warnings don't block:
  - no service code ("won't create a claim");
  - a CPT-only payor with an HCPCS code;
  - Part 2 sensitivity without a Release of Information step;
  - an inactive or deleted rule;
  - a rule whose program scope misses every program the service covers.
- **Preview as Staff (locked).** A header button, on services but not
  templates. It's where an admin will pick a staff member and see the
  service the way they would: whether it's offered and, if not, why; what
  gets filled in; and the steps with their due dates.
  - The rail used to show this as two lists ("What Staff See" and "Check a
    Staff Member"). Admins found them redundant and hard to follow, so on
    2026-11-16 Lisa had them replaced with this one button.
  - It's locked in the prototype. It stays focusable (`aria-disabled`), so
    its "coming later" tooltip can be reached by keyboard.
  - The eligibility logic it would use, `sbEligibility`, is built. Staff
    already see it in "Why don't I see a service?".
- **Footer actions:**
  - Make Inactive, Make Active Again, or Delete Draft.
  - Save as Template, which copies the service into an agency template with
    its programs cleared.
  - Duplicate, which creates a new draft.

## Staff screens

### Starting a note

This applies to every note that any service includes, from the left nav,
the header's Add Note menu or a chart tab.

- **The first step asks two things: the date of service, and "Which service
  did you perform?"**
  - The dropdown lists the client's open workflows that still need this
    note (marked "Continue"), then every service the person is offered for
    this client on that date.
  - It uses the version in effect on the date of service. A backdated note
    picks up the old code and rate; for example, Individual Therapy 60m on
    06/25/2026 is Version 2, with no HO modifier.
- **"Why don't I see a service?"** lists the services held back and the
  reason for each: role, program, site, sensitivity, or not in effect yet.
- **Once the note opens**, a line at the top says what the service applied,
  with a Change link. The date of service is set by the service, so it's
  read-only in the note.
- **Signing records the service for the client.**
  - A single-document service is completed.
  - A workflow step is marked done, or a new workflow instance is opened
    with this step done.

### The chart's Services page

- **Open Services.** Each workflow shows:
  - its deadline badge (Due, Due soon or Overdue);
  - a progress bar;
  - every step, with its due date and an Open or Schedule button (or "Waits
    for step *n*").
- **Completing a step from anywhere on the chart counts.** Saving a module
  form, filing the Discharge Plan, or booking the appointment marks the
  matching open step done. A module page that would complete a step says so
  in a banner.
- **Completed Services** lists the date of service, service, version, what
  was completed, and by whom.
- **Start Service** uses the same picker. A single-document service opens
  its note; a workflow opens an instance.

## Seed data

All fictional, and Horizon Wellness only.

- **Libraries:**
  - 12 service codes (public CPT and HCPCS identifiers, used as
    configuration) and 5 modifiers;
  - 6 diagnosis sets;
  - 3 precedence rules;
  - 3 sensitivity classes, named as elsewhere in the app;
  - 22 documents with default rules;
  - 4 appointment types.
- **11 templates.** Nine come from the implementation team and two are the
  agency's own.
- **32 services:**
  - Individual Therapy 60m has three versions.
  - Case Management 15m and Standard 15m Post Class Check-In each have a
    version scheduled for 10/01/2026.
  - Two are drafts and one is inactive.
- **Staff security for the 10 staff.** Priya Raman (the signed-in social
  worker) isn't cleared for Part 2 records or for Peer Connect, so a few
  services are deliberately out of her reach.
- **8 instances:**
  - DeShawn Carter's open Residential Discharge, due 09/25/2026, with the
    follow-up already booked;
  - Samuel Weiss's open Annual Treatment Review, due on his enrollment
    anniversary;
  - completed services, one of them dated before Version 3 took effect.

## Open questions for engineering

1. **What does "complete" mean for a step** when a document is pended to a
   manager rather than signed?
2. **A step's own rule inside an open workflow.** If the workflow is
   abandoned, do the step's own rules still start from their anchors?
3. **Version rollover with drafts open.** A note drafted under Version 3 and
   signed after Version 4 takes effect: which version bills? The prototype
   keeps the version chosen at the date of service.
4. **Template libraries across agencies.** Can an implementation team ship
   template updates to agencies that already use them? Because templates
   only pre-fill, an update would be offered, never applied.
