# Client Header — Configuration & Interaction Design Spec

**Product:** AxiomEHR · **Prototype:** `axiom-discharge-prototype` (live: https://footholdtech.github.io/AxiomEHRUX/)
**Date:** 2026-09-28
**Purpose:** source material for writing Jira user stories. It describes behaviour as built in the prototype. §12 lists what still needs a product decision — treat nothing there as agreed.

> **How to use this in another session.** Attach this file and ask for user stories. §11 maps the content to the eight planned stories. All data in the prototype is fictional; no real PHI appears here.

---

## 1. Why this exists

A children's-services intake coordinator and a prescriber open the same chart for different reasons. BMI and blood pressure are noise to one and the whole point for the other. Today's header is identical for everyone, so every role reads around fields it doesn't need.

The answer is **two levels of control**:

| Level | Who | Controls |
| --- | --- | --- |
| **Agency** | System administrator | Named client headers ("Default Adult", "Prescriber"…), what each shows, which staff roles get which, and whether each is live |
| **User** | Any staff member | Which of the admin's active headers they personally use, and whether it opens collapsed |

Two extremes are deliberately avoided: one header for everyone (serves nobody well), and every field a per-user choice (nobody's header matches a colleague's, so "it's in the header" stops meaning anything).

---

## 2. The client header component

Rendered on every client-specific page, full width, directly under the breadcrumb, pinned under the top bar while the page scrolls. It frames the page rather than sitting inside it.

### Anatomy

| Region | Always shown? | Notes |
| --- | --- | --- |
| **Identity** — avatar, name with preferred name (e.g. `DeShawn "Dee" Carter`), status pill, pronouns, DOB with age | **Always** | Not configurable. The name takes the width it needs; the status pill sits directly after it. |
| **Client Notes** button | **Always** | First in the action row; not configurable. Red badge top-right with the signed-in user's unread count. Opens an overlay of care-team notes about this client; each can be marked read/unread (§2a). |
| **Actions toolbar** — round icon buttons | Configurable (on/off + which buttons) | Followed by two fixed controls whenever the toolbar is on: **More Actions** and **Chat With Chart**. Every round button shows a **tooltip** above it on hover/focus with its name. |
| **Quick-view pills** | Expanded state only | Any number, in the admin's order. They take up to **two rows**; past that, **previous/next arrows** page through them ("1 of 2"). Paging browses — it doesn't change the open quick view. |
| **Expand Details / Collapse Details** toggle | Always | The only thing that changes expanded/collapsed. |
| **Detail row** | Expanded state only | Content of the selected quick view. |
| **Clinical Info strip** — weight, height, BMI, BP, and counts for allergies, vitals, problems, current meds; biological sex | Configurable (on/off) | Shown in both collapsed and expanded states when on. |

### Interaction rules

- **Collapsed by default** unless the user's preference says otherwise (§8). The expanded header is ~410px, a lot of chart to spend before anything is read.
- **Nothing collapses the header automatically.** An earlier version folded it on scroll; that was removed because a header moving by itself while you read is worse than the height it saves.
- **Opening a different client** resets the header to the user's default collapsed/expanded state and to the first quick view, and discards local attribute edits.
- **If an admin removes the quick view a user is looking at**, the header falls back to the first remaining one rather than rendering an empty detail row.
- **Attributes box** (in the General quick view): attribute chips plus a pencil icon *inside* the box, opening **Manage Client Attributes** (pick from the agency vocabulary or name a new one with an icon).
- **Action buttons** are icon-only and each has an accessible name ("Add Note", "Call Client"…). The toolbar is the one exception to the app-wide icon-button style: bordered circles, because so many sit side by side.

---

## 3. Quick-view catalogue

Twelve sections an admin can place in the header. Each has its own options. Option kinds: **bool** (checkbox), **choice** (one of a list), **fields** (any number of a list).

| Quick view | Shows | Options (default) |
| --- | --- | --- |
| **General** | Identifiers, funding, housing, attributes, care team | *Always shown (locked):* first & last name, preferred name, DOB, age · *Identifiers to display* (fields): Axiom ID, CIN, Shared Service ID, MRN, Funding, Residence, Housing Type, Primary Language (first 6 on except MRN, Primary Language) · Show client attributes (on) · Show care team (on) |
| **Enrollment** | Program, modality, site, enrolled date + days, status | Include closed enrollments (off) · Show payor and authorisation (on) |
| **Allergies** | Allergen, category, reaction, severity, status · **+ Add Allergy** | Active allergies only (on) |
| **Medications** | Current / Expired / Discontinued / All filters; schedule badge on controlled substances; refills left; pharmacy · bulk **Refill** and **Discontinue** · **+ Add Medication** (§3a) | Opens on (Current) · Show pharmacy (on) |
| **Vitals** | Latest BP, pulse, temp, resp, O₂, weight, BMI, pain + earlier readings · **+ Record Vitals** | Readings to list: 3/5 (3) |
| **Immunizations** | Vaccine, dose, date, status (administered / historical / declined), lot · **+ Add Immunization** | Include declined (on) |
| **Injections** | Per injectable: dose, interval, site, last given, next due (overdue flagged) · **+ Record Injection** | Doses to list: 3/5 (3) |
| **PHQ-9 · PCL-5 · PC-PTSD-5 · ACE · AUDIT · AIMS · SDOH** | Latest **score / max**, result band, date and who administered; earlier administrations below. Selecting any opens the captured answers in an overlay. **+ New** opens the instrument form. The full instrument is never laid out in the header. | Earlier administrations to list: 2/4 (2) |
| **Contact Info** | Email, phone (text-enabled), address | Show mailing address (on) · Show preferred contact method and language (on) |
| **Appointments** | Upcoming and recent | Appointments to list: 3/5/10 (5) · Include no-shows and cancellations (on) |
| **Clinical Notes** | Recent documentation | Notes to list: 3/5/10 (5) · Surface drafts and unsigned first (on) |
| **Diagnoses** | ICD-10 diagnoses | Active statuses only — Active, In Remission, Provisional (on) · Show ICD-10 codes (on) |
| **Problems** | Problem list | Active problems only (on) · Show category (on) |
| **Support Contacts** | Natural supports + care team | Show relationship (on) · Only contacts with a release on file (off) |
| **Assessments** | Instruments, due/overdue, scores | Instruments to list: 3/5 (3) · Show scores and interpretation (on) |
| **Incidents** | Reportable events | Look-back window: 30 days / 90 days / 12 months (90 days) |
| **Demographics** | Gender, pronouns, DOB, race, ethnicity, language, interpreter need, MRN | Show race and ethnicity (on) · Show language and interpreter need (on) · Custom fields (fields, none by default) |

The old combined **Medical** view is replaced by Allergies, Medications and Vitals; saved headers that used it are migrated to those three.

**Every clinical quick view** links each record to its full module page, has a **View all** link, and adds records in an overlay sized to the form (sm 480 / md 720 / lg 1040) without leaving the page. The new record appears in the header immediately.

### 3a. Medications quick view

- **Bulk actions:** select rows, then **Refill** or **Discontinue**. Ineligible items are listed separately with the reason (Schedule II can't be refilled; discontinued items need a new prescription).
- **Refill overlay:** pharmacy per medication; refilling an expired medication renews it. Controlled substances are sent as EPCS and need a PDMP attestation; they show "Pending signature" until signed.
- **Pharmacy routing (hinted, to refine):** prescriptions often split across pharmacies, so each medication picks its own, with a "Send all to" shortcut. Each pharmacy option shows type, location and hours, the client's preferred pharmacy (the one they fill at most), a coverage/copay result, and whether it is EPCS-enabled. Pharmacies that can't take a prescription are disabled with the reason (not EPCS-enabled for a controlled substance; mail order can't fill Schedule II). If a controlled medication's last pharmacy can't receive it, the refill moves to one that can and says so. A pharmacy can flag limited supply. In production the directory, coverage and EPCS capability come from **Surescripts** (pharmacy directory + real-time prescription benefit); the prototype mocks them.
- **Discontinue overlay:** reason (required), effective date, comment. Items move to Discontinued with the reason shown.
- **Add Medication overlay** (field set from production's form): medication search (name, strength, class, controlled level), provider, sending site, provider's DEA number, form–strength, number, interval, as needed / with food, pharmacy, target symptom, duration, quantity, refills, directions (auto-composed, 1,000 characters), notes to pharmacist, substitutions, sensitivity classification, Dx codes, CPOE, Spanish directions, manual print.
- **Safeguards demonstrated:** controlled schedule shown everywhere; C-II — no refills, 30-day maximum; C-III–V — up to 5 refills; DEA number required for controlled; allergy cross-check that must be acknowledged; 42 CFR Part 2 sensitivity defaulted for substance-use medications. Not a complete prescribing model.

### 2a. Client Notes

Notes care-team staff leave each other about a client. Always shown in the header regardless of configuration; the admin page lists it as a locked, pre-checked item. The overlay title carries a small **(Internal)** label; there is no subtitle. The thread reads as a conversation: oldest at the top, day dividers, each note with its author's avatar, name and role; the signed-in user's own notes sit on the right. Unread notes are marked the way a phone's message list does it: a red dot (the header badge's colour) in a left-hand gutter beside the avatar. The gutter is on every row, empty once read, so avatars stay aligned and the dot is the only difference. **Mark as Read** (tertiary button) sits in a fixed right-hand column, aligned with the note, so it is in the same place on every row; read notes offer **Mark as Unread** there on hover/focus. **Mark All as Read** is in the footer. A composer under the thread (the user's avatar, a text box, **Mark as important**, **Post Note**, ⌘/Ctrl+Enter) adds a note visible to the whole care team.

- **Deleting:** authors can delete their own notes only (trash icon beside the bubble on hover/focus, then an inline confirm). The note is replaced by a small **Message deleted** placeholder in the disabled colours, so the conversation around it still makes sense.
- **Client Summary widget:** the same thread and composer appear as a **Client Notes (Internal)** panel on the Client Summary page, with the unread count and **Mark All as Read**. Read state, new notes and deletions are shared with the header overlay and its badge.

**Colour restraint in the detail row:** tags are neutral grey. Only things that need chasing take a warning tone — an overdue instrument, a no-show, a high-severity allergy, a support contact with no release.

**Custom fields** (e.g. a school program's "Grade Level", an agency-specific ID) are **provisioned elsewhere in Admin**, not typed in on this page. Where they exist, the options editor lists them under a separate "Custom fields" heading (with "Standard fields" above) and the admin chooses whether each shows on this header.

---

## 4. Header data model

```
header {
  id, name, description,
  status:            'active' | 'inactive',
  roles:             [staff role names],       // exclusive, see §5
  showClinicalStrip: boolean,
  showActions:       boolean,
  actions:           [action keys],            // subset of §4a, catalogue order
  quickViews:        [{ key, options }],       // 1 or more, admin's order
}
agency { headers: [header], defaultHeaderId }
user   { headerPreference: 'auto' | headerId, collapsedByDefault: boolean }
```

### 4a. Quick contact actions catalogue

Add Note · Call Client · Send Text Message · Send Email · Start Chat · Schedule Appointment. Rendered in this fixed order; the admin picks which appear (no reordering). More Actions and Chat With Chart are not in the catalogue — fixed chrome whenever the toolbar is on.

---

## 5. Resolution rules (which header a user actually sees)

1. If the user picked a specific header in Preferences **and it still exists and is active** → that header.
2. Otherwise → the **active** header their role is assigned to.
3. Otherwise → the agency **default** header.

Supporting rules:
- **A role belongs to exactly one header.** Assigning a role to a header removes it from whichever header held it, visibly (the role picker shows where each unselected role currently lives).
- **An inactive header's role assignments don't count** — those staff fall back to the default, as if unassigned. This lets an admin build, assign and preview a header before releasing it.
- **The default header can't be deactivated or deleted.** Pick another default first.
- **Unassigned roles use the default**, and the list page says so (§7).
- A header deleted, or switched to inactive, after a user chose it silently falls back per rule 2–3.

---

## 6. Admin › User Interface Options (index page)

- New link **User Interface Options** in the Admin section of the left navigation.
- Breadcrumb: Admin › User Interface Options.
- Four cards, each with a small stylised preview (drawn with DS tokens, not screenshots), title, description, a meta line, and **Configure**:
  - **Client Header** — in scope. Meta: "3 headers · 14 of 15 roles assigned".
  - **Agency Logo**, **Default Site Colour**, **Tab Sets** — shown with "Not in this prototype"; Configure disabled.

---

## 7. Client header list page

Route: Admin › User Interface Options › Client Header.

- Title, one-line description, **New Header** primary button.
- **Info banner** when any role is unassigned: "N role(s) not assigned to a header and will use *Default*: …".
- **Saved Headers** table:

| Column | Content |
| --- | --- |
| Header | Name (text link to edit) + **Default** badge where applicable; description beneath |
| Roles | First three role names, then "+N more"; "No roles assigned" if empty |
| Status | Active / Inactive badge |
| Users, last 30 days | Count of staff who used the header. **Prototype placeholder** — derived, not real usage data. Inactive = 0. |
| (action) | **Edit** |

---

## 8. Client header edit / create page

Route: …/Client Header/`{header}` or …/Client Header/New. Breadcrumb ends with the header's name, or "New Header".

**Page actions (top right):** Unsaved changes badge (when dirty) · **Preview** · **Discard** (existing — reverts in place) or **Cancel** (new — returns to list) · **Save Changes** or **Create Header** (disabled until something changes on an existing header).

**One continuous section, not collapsible panels** — everything describes the same header and saves together. Subsections separated by dividers:

1. **Name and Assignment**
   - Header name, "What it is for" (description).
   - **Active** toggle (toggle left of label). Disabled on the default header, with the reason stated.
   - **Applies to roles** — searchable **multi-select checkbox dropdown** (built to stay usable with hundreds of roles). Trigger reads "9 of 15 selected". Unselected roles show which header currently owns them.
   - **Set as Default** and **Delete Header** (existing headers only; both take effect immediately with a toast; both disabled on the default header; delete disabled if it's the only header).
2. **What the Header Shows** — toggles for **Medical information strip** and **Actions toolbar**, each with a one-line explanation.
3. **Quick Contact Actions** — multi-select checkbox dropdown over §4a. When the toolbar is off, replaced by a warning: "The actions toolbar is off above, so nothing here shows on the header."
4. **Quick Views (N of 6)**
   - Ordered list. Each row: six-dot drag grip · position number · icon · name · one-line summary of its current options · move up / move down buttons · **Options** · remove.
   - Drag-and-drop *and* up/down buttons — the buttons are the keyboard-accessible path, not a fallback.
   - **Options** expands the row in place with that quick view's controls (§3). General shows the locked "Always shown" fields as disabled, pre-checked checkboxes.
   - Can't remove the last quick view.
   - **Add a quick view** — cards for every catalogue entry not already used. No limit; the header pages past two rows of pills.

**Dropdowns overlay page content**; they are never clipped by the section they sit in.

**Save** strips any newly claimed roles from other headers, writes the header, shows a toast (name · role count · active/inactive), and returns to the list. **Unsaved changes** on this page trigger the same "Unsaved Changes — Leave Without Saving" intercept as clinical notes when the admin navigates away by any other means.

A header URL that no longer exists shows **Header not found** with a way back to the list.

---

## 9. Preview

- **Preview** button on the edit page opens an overlay (not a panel permanently on the page).
- Renders the **real header component** with the draft applied, **including unsaved changes**, forced expanded so the quick views are visible.
- Uses a **fixed, obviously fictional client** so no admin wonders if they're looking at a real chart: Michael "Mickey" Mouse, DOB 11/18/1928 (97), Axiom ID 12345, care team Donald Duck and Minnie Mouse, height 2′3″, attributes Infectious Laugh / Can-Do Attitude / Fear of Lonesome Ghosts. No client switcher.
- Closes with ✕, scrim click or Escape. Works on inactive headers — previewing before release is the point.

---

## 10. User preferences

In the **Preferences** flyout (account menu), alongside Dark mode and Theme:

- **Client Header** dropdown: "Use my role's header (*Name*)" plus every **active** header by name. Inactive headers are not offered.
- **Collapsed by Default** checkbox — checked by default. Help text: opens every chart with the header collapsed; can still be expanded on any chart.
- The whole flyout is a **draft**: nothing changes until **Save Preferences** (disabled until something differs). **Cancel**, ✕, scrim and Escape all discard. Reopening always shows current settings.
- Close icon pinned top right; body scrolls independently of the header and footer.
- Users can't create or edit headers here — no link into Admin.

---

## 11. Mapping to the planned stories

| # | Story | Sections |
| --- | --- | --- |
| 1 | **Build the client header configuration page** (list + edit/create) | §4, §5, §7, §8 |
| 2 | **User Interface Options admin page** | §6 |
| 3 | **Build the client header component** | §2, §3, §4a |
| 4 | **Allow users to set their client header** | §5 (rule 1), §10 |
| 5 | **Preview the client header while building** | §9 |
| 6 | **Axiom default client headers** (so customers don't start from scratch) | Seeds below |
| 7 | **Remove the client from global navigation** | §11a |
| 8 | **Display the new header on all client-specific pages** | §2, §11b |

### Seed headers (story 6)

| Header | Roles | Strip | Actions | Quick views (in order) |
| --- | --- | --- | --- | --- |
| **Default Adult** *(agency default)* — general clinical header for adult behavioural health | Social Worker, Clinical Provider / Therapist, Case Manager, Peer Support Specialist, Housing Supervisor, Program Director, Clinical Director, Executive Director, QA / Compliance Specialist | On | Note, Call, Text, Email, Chat | General · Enrollment · Allergies · Medications · Vitals · Contact Info · Appointments · Clinical Notes · PHQ-9 |
| **Default Child** — children's services; vitals rarely why the chart is open | Intake Coordinator, Front Desk / Administrative Assistant | **Off** | Note, Call, Text, Email, Chat | General (Axiom ID, CIN, MRN, Primary Language) · Demographics · Contact Info · Support Contacts · Appointments (3) · Enrollment |
| **Prescriber** — clinical picture first | Primary Care Provider, Psychiatric Provider, Nurse | On | Note, Call, Text, Email, Chat, **Schedule Appointment** | Medications · Allergies · Vitals · Diagnoses · Problems · Injections · PHQ-9 · PCL-5 · AIMS · AUDIT · Assessments · General (no care team) · Appointments (3) — deliberately long, to show paging |

All seeds start **Active**. Role names come from the shared role fixture; a real customer's role list will differ, so seeding needs a mapping step (§12).

### 11a. Removing the client from global navigation (story 7)

Today the application is permanently tethered to a client: you land in someone's chart, and global navigation carries the client with you. The prototype's model:

- **Client context starts empty.** Home, Reports, Billing, Admin carry no client.
- A client enters context only when the user deliberately opens a chart (caseload list, search result, client link).
- **No client chip or banner in the top bar.** The client header on the chart is the single place identity is shown.
- **Leaving a chart for a non-client page clears the client** — silently if nothing is unsaved, via the unsaved-changes intercept if something is. There is no "keep this client" option.
- **Client-specific modules opened with no client in context** (e.g. Vitals from the left nav) show a caseload picker — "Select a Client to Open Vitals", scoped to the user's direct and indirect caseload — instead of adopting a client.
- Global search finds clients and pages; the client currently in context is marked "In context".
- Switching between clients always goes through the switch intercept naming both clients (see `INTERCEPT-INTERACTION-SPEC.md`).

### 11b. Where the header appears (story 8)

- **Every client-specific route** (the chart and each of its modules/tabs): breadcrumb `Clients › {client name} › {current tab}`, then the header, full width, pinned under the top bar.
- **Never on non-client pages.** If the URL leaves the chart, the header goes with it.
- The chart's own tabs sit below the header; switching chart tab doesn't reset the header, switching client does.

---

## 12. Open questions

1. **Permissions.** The prototype assumes the admin can see and configure everything. Which security role may manage headers, and should some quick views (e.g. Diagnoses, Medical) respect the viewer's clinical access?
2. **Usage metric.** "Users, last 30 days" is a placeholder. Define the event (chart opened with this header? distinct users?) and its source.
3. **Seeding onto a real role list.** Seeds reference fixture role names. How do default headers map to each customer's own roles — by role category, a setup step, or unassigned until an admin assigns them?
4. **Custom fields.** Where exactly are they provisioned, which quick views accept them, and is that a support-ticket process?
5. **Schedule Appointment icon.** No DS glyph exists for it in the round-button family; the prototype borrows a generic calendar icon.
6. **Audit.** Should header changes, activation and role reassignment be audit-logged?
7. **Role conflicts.** Staff with multiple roles — which header wins?
8. **Tooltip spec.** Built from DS tokens; the DS tooltip frame wasn't reachable. Confirm colours, radius and arrow against the DS.
9. **Assessment wording.** The prototype abbreviates item text. Production needs each instrument's validated wording and licensing.
10. **Prescribing.** EPCS, PDMP and DEA handling are demonstrated, not specified — needs its own design and compliance review.
12. **Surescripts.** Which Surescripts services feed the pharmacy picker (directory, real-time benefit, medication history), what happens when a check is slow or fails, and how 'preferred pharmacy' is actually sourced.
11. **Client Notes in notifications.** How notes surface in the notifications center, and who can write them.
