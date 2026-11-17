# Multi-Client Worklist — interaction spec

Residential, inpatient, foster-home and eMAR work often means doing the same
thing for many clients in a row: contraband checks, room checks, rounding, a
med pass. This spec covers how the prototype handles that without the
production pattern of one client tab per person.

Built in `src/52-residential.jsx`. Route: `#/residential`, then
`#/residential/worklist/:worklist/:client`.

## Why not client tabs

Production opens each client as a tab along the bottom of the screen, and
each client tab can hold its own open forms. That pattern has some real
strengths: it survives interruptions, closing a tab feels like finishing,
and it stops people opening Axiom in several browser tabs. But it also
causes the client-safety problems this prototype is about:

- **Many dirty states at once.** Nothing on a tab says it holds unsaved work.
- **Weak identity.** The tabs show part of the last name, a long way from the
  form being saved.
- **No sense of the list.** You can't see who's done, who's next, or who was
  skipped.

The worklist keeps the strengths and drops the multiple live states: **one
client is in context at a time**, under the normal client header, and the
list itself is the record of progress.

The four wireframe options this was chosen from are in
`../multi-client-wireframes/guided-worklist-options.html`. Option A, the side
rail checklist, is the one built here, with the changes below.

## Starting a worklist

1. **Residential** (left nav → Residential) is the census: 14 fictional
   residents at Maple Grove, filtered by building, unit and search.
2. **Select residents.** The header checkbox selects everyone shown.
3. **The bulk bar appears:** choose a check (Contraband Check or Room Check),
   then **Start [check] for N clients**.
4. The worklist opens on the first selected client, in census order.

## The rail

- **Header.** The check's name, the scope (building and unit) and the start
  time. Below that, a progress bar, "N of M recorded", and a count of drafts.
- **Search.** Matches name, preferred name, room and bed, and DOB. People line
  up for a med pass in whatever order they arrive; search is how you jump to
  the person in front of you.
- **Sort.** Worklist order, room and bed, last name, or still to do (drafts
  first, then not started, then finished). Sorting changes only the view, not
  the worklist.
- **Rows.** Avatar, "Last, First “Preferred”", then room and bed with DOB,
  then a status badge.
- **Row states** use the DS tertiary interactive tokens, the same ones as the
  header's quick-view pills. At rest the stroke is transparent. Hover and
  pressed use the tertiary hover and pressed fill and stroke. The client in
  view takes the selected state, a theme tint
  (`--background-interactive-tertiary-selected`) with a theme stroke
  (`--border-interactive-tertiary-selected`). There's no side bar. That row
  isn't a link to anywhere, so it gets no hover and a default cursor. The
  slim column's avatars follow the same rules.
- **Statuses:** Not started · Unsaved changes (the open form) · Draft · Draft
  on chart · Completed + time · Refused · Not available · Skipped.
- **The list scrolls on its own.** The rail is full height under the top bar,
  and the client in view scrolls into sight after an auto-advance.
- **Resizable.** Drag the right edge to anywhere from 240 to 440px. Dragging
  past the minimum collapses the rail. The handle also works with the
  keyboard (arrow keys, Shift for bigger steps, Enter to collapse or expand)
  and on double-click. Width and collapsed state are remembered per person.
- **Collapsed.** A 72px column showing a progress count, a vertical progress
  bar, and each client's avatar with a status badge: green check for
  completed, amber pencil for a draft, grey ban for couldn't complete, and an
  empty ring for not started. The tooltip gives name, room and bed, and
  status. Below 850px the rail is always collapsed.
- **Finish Worklist** sits at the foot of the rail.

## The client in view

- **Breadcrumb:** Residential › [Check] Worklist › Client name.
- **The client header**, whichever preset the person uses, pinned under the
  top bar. All header rules apply: Client Notes, quick actions and Chat With
  Chart all belong to this client.
- **The form**, in a panel titled "[Check] for [full name]", with the status
  badge on the right.
- **Footer:** a line saying where the save goes and who's next ("Saves to
  Dee's chart, then opens Marcus Ellison"), **Couldn't Complete…**, and
  **Save for [full name]**.

## Rules

1. **Saving moves straight to the next unfinished client**, in the order the
   rail shows, wrapping round. There's no interim confirmation page. The
   success toast names the saved client (name, DOB, room and bed) and the
   next one. Saving also clears any rail search, so the next client is
   visible.
2. **Moving to another client with unsaved changes keeps them as a draft.**
   There's no dialog. An info toast says "Draft kept for [name]. Not on the
   chart yet", and the row says Draft. Nothing is lost and nothing is saved
   to the chart.
3. **No client-switch intercept inside a worklist.** The rail names who you're
   moving to, and a draft protects the work. The guard request carries
   `worklist: true` to skip the "Switch Clients?" question. A Client Access
   Request still applies, and so does unsaved work from outside the worklist.
4. **Couldn't Complete…** opens a small dialog. Choose Refused, Not available
   or Skipped; a reason is required except for Refused. The outcome is
   recorded on the chart and the worklist advances like a save.
5. **A finished client is read-only** when you click back to it: what was
   recorded, when, and by whom, with **Edit** and **Next**. Editing a saved
   check is the one case where moving on discards changes. The saved record
   stays as it was, and the form says so.
6. **No default answer on safety questions.** "Contraband found?" and "Room
   condition" start empty. Follow-up fields ("Items found", "What happened to
   the items", "What needs attention") appear only when needed, and are then
   required.
7. **When everyone is recorded,** a success banner offers Finish Worklist.

## Finishing, and being interrupted

- **Finish with everyone recorded:** the worklist closes and you return to
  Residential with a success toast. Nothing is asked.
- **Finish with clients unfinished:** this is the worklist's only
  confirmation. It lists the unfinished clients with their statuses, then asks
  one required question, "What should happen to the unfinished clients?".
  The answer is a pair of radio cards, each saying what it does. **Nothing is
  pre-selected**, because keeping or discarding clinical drafts has to be
  deliberate.
  - **Save drafts and keep the rest in my tasks.** Each draft is saved to
    that client's chart as a Draft entry. Every unfinished client, draft or
    not started, stays in Approvals & Tasks as one task: "Finish your
    [check] worklist · N of M clients left". With no drafts the card reads
    "Keep the rest in my tasks".
  - **Discard drafts.** Drafts are deleted, including any already saved to a
    chart, and the worklist closes. Checks already saved stay on the charts.

  There's one action, **Finish Worklist**, next to **Keep Working**. Pressing
  Finish with nothing chosen shows a required-field error rather than
  guessing. The cards use the same tertiary states as the rail: tint and
  stroke when selected.
- **Leaving any other way** (the left nav, a breadcrumb, search, a
  notification, a header action that opens the chart) **pauses** the
  worklist. Drafts are kept, nothing is asked, and an info toast says where
  to resume. A paused worklist shows:
  - as a task in Approvals & Tasks, counted in the bell, with **Resume
    Worklist**, plus **Discard Worklist…** under More;
  - as a banner on Residential, with **Resume Worklist** and **Discard…**.
- **Resume** opens the first unfinished client in worklist order, with the
  drafts as they were left.

## On the chart

Contraband Check and Room Check are ordinary chart modules too (the census
row's **Actions** menu, or the left nav). They use the same field spec, so a
check recorded from a worklist and one recorded on the chart are the same
record. The module's table lists each check's time, summary, status (Final,
Draft, or the couldn't-complete outcome) and who entered it. The census
columns "Last Contraband Check" and "Last Room Check" update live, and show a
**Draft** badge when one is waiting on the chart.

## The Residential client header

There's a new seed preset, **Residential**, assigned to no role, so nobody
gets it by default. Staff choose it in Preferences, or an admin assigns it.

- **General quick view** leads with where the client is and who with:
  Site / Building, Unit, Room / Bed, Roommates and Daily Attendance. Then the
  episode: Length of Stay, Attending, Legal Status, Expected Discharge (or
  "Today") and Precautions.
  - **Site / Building** is the client's site at whatever depth the agency's
    sites have. A campus and building reads "Maple Grove Residential Campus ·
    Building A"; an outpatient site reads as itself.
  - **Roommates** is everyone else in the room. That includes children who
    live with a parent in family housing, shown as "Luka Petrovic (child, 6)",
    as in the nested rows of production's Room Attendance Checklist. A child
    in a roommate's family reads "child of roommate". Single rooms read "None".
    The full list is the tooltip.
  - **Daily Attendance** is the latest status and when it was taken: Present,
    On leave or Absent, then "Today 7:05 AM". With no record today it reads
    **Not recorded today**, followed by the last one, e.g. "Last: Present,
    09/21/2026 8:33 PM".
- **Then what a shift needs:** Medications, Allergies, Vitals, Support
  Contacts, Clinical Notes, Incidents and Service Plans.
- **The new fields are open to every header,** for inpatient programs as
  much as residential. They're added to General's "Identifiers to display",
  along with Admit Date and Admission Reason. On a chart with no bed they
  read "—". Site / Building works on any chart.

The UI config key is now `axiom-ui-config-v6`, so reviewers get the new seed;
earlier in-browser header edits reset.

## Data

`tools/build-residential-fixtures.py` writes
`fixtures/reference-data/residential_census.json`. It contains:

- ten new fictional residents, in the same shape as `clients.json`;
- a bed for all fourteen residential clients. Family housing is one room
  per family, with the parent in bed A;
- three children (dependents, not clients) living with two parents in
  family housing, each holding a bed;
- Daily Attendance records for last night and this morning. Two residents
  aren't recorded today and one is on leave; children are checked with
  their parent;
- vitals and allergies for the new residents;
- legal-status attributes, so the attribute box and the Legal Status field
  agree. For existing clients, legal status is read from their active
  attribute assignments.

Run it before `tools/build-refdata.py`. Everything is invented: 555 phone
numbers, example.com emails. The discharge demo client (DeShawn "Dee"
Carter) is in A-101 Bed A and leaves today.

## Prototype scope

- Worklists live in memory, so a reload clears them. In the product they'd be
  server-side, and a paused worklist would survive a sign-out.
- Two checks are built. Others in production's Actions list (BHT Rounding
  Sheet, eMAR, CIWA…) open their chart modules but can't run as a worklist
  yet. An eMAR med pass would add timed administration and Scan Patient Code,
  which are out of scope here.

## Open questions

- **Discard on leave.** Should a paused worklist expire at the end of a shift,
  or stay until someone discards it?
- **Several people on one worklist.** Can a second staff member pick up a
  paused worklist, for example at shift change?
- **Which other checks run as worklists** (BHT Rounding, Patient Valuables)?
  Daily Attendance stays its own roster workflow.
