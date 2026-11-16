# Due Date Rules

**Admin › Due Date Rules** (under Builders, beside Service Builder) sets the
cadence of due dates and warnings, relative to service dates. Each rule
records:

- how long after a start date the first one is due;
- how often it's due after that;
- how early staff are warned;
- which programs it applies to.

A rule says nothing about **what** is due, and does nothing on its own.
**Services subscribe to rules**, at two levels:

- **On a step.** Each document or appointment in a service can subscribe to
  rules (a consent renews every 12 months).
- **On the whole service, as its deadline.** A workflow service, such as an
  intake, can use a rule for all of its required steps (Teen Crisis Intake
  within 5 days of referral). The deadline sets each required step's first
  due date, and the step's own rules take over for the renewals after it.

So one rule, such as Standard Annual Consent, serves dozens of services, and
changing it moves all of them. See `SERVICE-BUILDER-SPEC.md`.

The page was first called "Compliance Rules". It was renamed because
compliance is much broader: note structure, how actions are performed, and
the order processes are completed in. This page covers only the cadence.

- Code: `src/54-due-date-rules.jsx`. Service Builder is
  `src/55-service-builder.jsx` (admin) and `src/56-services-staff.jsx` (staff).
- Seed data:
  - `tools/build-due-date-fixtures.py` writes `due_date_rules.json`.
  - `tools/build-service-fixtures.py` writes `services.json`, with 11
    templates, 32 versioned services and the building block libraries.
  - Twelve seed rules; DDR-010 to 012 are service deadlines (an intake within
    5 or 14 days of referral, discharge paperwork within 3 days).
- The old `/compliance-rules` routes still resolve.

## The rule

| Field | Values | Notes |
| --- | --- | --- |
| First due | *n* days / weeks / months / years **after** a start date | 0 means due on the start date itself |
| Start date (anchor) | Client assignment to provider · Client referral date · IBHIS enrollment start date · Client reassignment · Client enrollment start date · Program enrollment start date · Client discharge date | The brief's list, in the brief's order |
| Then | due every *n* days / weeks / months / years, **or** not due again | |
| Counted from | the previous due date (fixed schedule) **or** the date it was last completed (rolling) | See "Scheduling" below |
| Warn staff | *n* days / weeks / months before each due date | 0 means no warning |
| Programs | All programs · Programs serving a population · Specific programs | A population scope is live: see below |
| Staff can cancel this rule for a client | off by default | Stops tracking it for that one client, with a reason kept on the record |
| Staff can change a client's start date | off by default | Lets staff enter a different start date, with a reason; every due date recalculates from it |
| Name | optional | Left blank, a name is generated from the logic |
| Status | Active / Inactive | An inactive rule stays attached but tracks nothing and reminds no one |

The builder reads as a sentence. Beside it, **How It Reads** restates the rule
in plain language, and **Example Schedule** shows the first four due dates
and their warning dates for a start date you pick. Each is marked Past,
Warning now or Upcoming, as of the prototype's today.

## Seed rules

Every seed rule has a name an admin would give it:

| Rule | Cadence | Services |
| --- | --- | --- |
| IBHIS CANS Reassessment | 6 months after the IBHIS enrollment start, then every 6 months · Child & youth programs | 4 |
| Standard Annual Consent | Annual from program enrollment · warning 2 months before · All programs | 43 |
| Service Plan Review | 30 days after program enrollment, then every 6 months | 23 |
| Post-Discharge Follow-Up | One-time, 7 days after discharge · staff can cancel | 3 |
| First Contact After Assignment | One-time, 10 days after provider assignment | 26 |
| Post Reassignment Satisfaction | One-time, 30 days after reassignment | 26 |
| Quarterly Adult Screening | Quarterly from client enrollment · Adult programs | 12 |
| Bi-Weekly High Acuity Assessments | Every 2 weeks from program enrollment · Safe Harbor and Bridge Forward | 4 |
| Intake Assessment (Retired) | Inactive; no service uses it, so it is the one rule that can be deleted | 0 |


## Generated names

An admin's name always wins. A rule left unnamed gets a short generated name:
the cadence and the start date only, as an admin would say it.

> Annual from program enrollment · Quarterly from client enrollment ·
> Bi-weekly from program enrollment · Twice-yearly from IBHIS enrollment ·
> One-time, 7 days after discharge

The warning, the scope and a first due date that differs from the repeat are
left out of the name because they have their own columns. Including them
made every name a paragraph.

Cadences without a common word read "Every 5 weeks from referral". The name
field shows the generated name as its placeholder; clearing a typed name
brings the generated one back.

Names must be unique. A short generated name collides more easily, for
example two annual rules from program enrollment with different warnings. In
that case the builder asks for a name rather than guessing one.


## Scheduling

- **Due dates are computed from the first due date, not chained.** Adding
  months clamps to the last day of the month (6 months after Aug 31 is
  Feb 28). Because each date is computed from the first, clamping never
  accumulates: Jan 31 → Feb 28 → Mar 31, not → Mar 28.
- **Fixed or rolling.** A fixed schedule keeps every due date where the start
  date put it. A rolling one restarts the clock from the date it was actually
  completed, so a late completion pushes the next one back. Agencies and
  payers mean different things by "every 6 months", so this is a setting on
  the rule rather than an engineering assumption.
- **Soft checks.** These are notes, not errors:
  - a warning as long as the cycle;
  - a first warning that starts before the start date;
  - a population scope that no program serves yet.

## Population scope

`programs.json` has no population field, so the fixture tags each program
with the populations it serves. A rule scoped to "Child & youth programs"
resolves to whichever programs carry that tag today; the builder lists them.
A child program added later joins the rule automatically, without anyone
editing it.

## Applied To

The list page shows a **count of services** for each rule. Clicking the count
opens a searchable, scrollable list with these columns:

- the service, linked to its editor;
- its programs;
- what in it the rule governs: steps, or "The whole service" for a deadline;
- its status (Active, Draft or Inactive).

Templates that use the rule are listed separately, after the services. A
rule used by hundreds of services stays one number in the table.

The rule's own page summarises what it governs across services, for example
"Release of Information (33), Informed Consent (23) …", with a button that
opens the same list.

Applied To is read-only here and derived from the services' newest version
(scheduled versions included, since that's what a rule change affects). A
rule doesn't store its services; services point at rules. Counts read the
same store as Service Builder, so an edit there shows here at once.

## Deleting and deactivating

- A rule that any service uses **can't be deleted**. Remove it from those
  services in Service Builder first, or make the rule inactive. Due-date
  history must still say which rule produced each date.
- A rule no service uses can be deleted.
- Editing a rule that services use warns how many services the change will
  move.


## Open questions for engineering and architecture

1. **When a rule changes, what happens to dates already issued?** Recompute
   every open due date, or only future cycles? And what about clients already
   in a warning period?
2. **Which start date wins?** A client can have several program enrollments,
   or a reassignment, in one episode. "Program enrollment start" needs to say
   which enrollment, probably the one in a program the rule covers.
3. **Rolling schedules and early completion.** If a 12-month item is done
   3 months early, does the clock restart from then? A rolling rule says yes;
   some payers say no.
4. **Effective and expiry dates.** Production's builder has Effective On and
   Expires On. The prototype has Active / Inactive only, per the brief. Do
   rules need a date window, for example a county standard that changes on
   July 1?
5. **IBHIS is LA County's system.** "IBHIS enrollment start date" is a
   county-specific anchor. A generalised "external system enrollment start
   (IBHIS, …)" would serve other counties and states without a one-off.
6. **Overrides.** Who can cancel or change a start date (any staff, or a
   role)? Does that need a supervisor's approval? Where is the reason
   reported?
7. **One document, several services.** If a client is in two services that
   both contain Informed Consent under Standard Annual Consent, there should
   be one due date, not two. Track due dates per client, document and rule,
   not per service. Decided; see `SERVICE-BUILDER-SPEC.md`.
