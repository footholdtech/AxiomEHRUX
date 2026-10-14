# Notifications — Interaction Design Spec

Prototype: `src/17-notifications.jsx` (store and rules), `src/34-notifications.jsx` (bell, flyout, page).
Data: `tools/build-notification-fixtures.py` → `fixtures/reference-data/notification_center.json` (fictional).
Research basis: *EHR Notifications: Research Findings & Design Direction* (Product Design, Radicle Health).

## 1. The problem

Production groups notifications by **data type**: three top tabs (Pending Notifications, Critical Info, System Notifications), each with up to nine sub-tabs. Every sub-tab shows a red count, whether or not the items are assigned to the user or actionable by them. Urgent clinical events sit next to report-ready messages. The bell stops meaning anything.

## 2. The model: grouped by urgency, not data type

Three groups. The UI never calls them "tiers"; users see the group names.

| Group | What's in it | Counts in the bell? | How it leaves |
|---|---|---|---|
| **Approvals & Tasks** | Assigned to me and waiting on me: signatures, co-signs, approvals, orders, lab results to review, admission appointment requests, shift swaps, direct messages, referral responses, my own incomplete notes | **Always**, read or not | Only when actioned: signed, approved, returned, delegated, declined, replied or marked done. Org-locked items can't be dismissed. |
| **Client Alerts — urgent** | Hospitalization, ED visit, incarceration, crisis-line call, urgent appointment request | **Until marked read** | Stays open with a follow-up window until a follow-up **note is signed** (Start Note). Can't be dismissed. |
| **Client Alerts — due & updates** | Assessments due or expired (CANS, PHQ-9), consents needed or expiring, plan reviews, note gaps, unrecorded outcomes, new assignments | No: theme **dot** when unread | Mark as read (page only), open, or dismiss. |
| **Client Alerts — care-team notes** | **One row per note** sent with **Notify Care Team**, about my clients (last 14 days), highest priority first. Notes without it stay on the chart only. | **Yes, until marked read**, the read receipt (red dot) | Read state is the note's own, shared with the Client Notes thread and the client header badge, which also count only notes sent to the team. |
| **General & System** | Reports ready or failed, announcements, maintenance, own credential reminders | **Never**: theme **dot** when unread | Mark as read or unread, dismiss, or bulk dismiss. |

### Signal rules

| Signal | Meaning |
|---|---|
| **Red number** | Something needs you: an open task, an unread urgent alert, or an unread care-team note a colleague sent with *Notify Care Team*. |
| **Theme-colour dot** | Something new you haven't seen, but nothing is waiting on you. |
| **Nothing** | Seen, or not yours to act on. |

Red is never a dot on anything uncounted. The bell shows the red number, or a dot when nothing is counted but something is unseen.

### Read state

- Alerts and General items carry a phone-style unread dot in a left gutter, the same pattern as Client Notes.
- Tasks have no read state. They're a to-do list and leave when done.
- **Client Alerts are marked read only on purpose**, for the clinician's safety and for the audit trail:
  - Opening an alert, opening a note, or starting a follow-up never marks it read.
  - In the flyout, client alerts have no Mark as Read. The user opens them in place, and marks them read on the All Notifications page or inside the note itself.
  - On the page, **Mark as Read** sits in the same right-hand spot on every row, and **Mark All as Read** is on the group. Bulk mark-read stays for now; user testing will show whether clinicians expect it.
- On an urgent alert, *Mark as Read* means "I've seen it". It drops the alert from the count, but the alert stays open until a follow-up note is signed. A tooltip says so.
- **General & System is lenient:** Mark as Read is available everywhere, including the flyout, and View Report marks the item read.

### Sort

1. Urgent alerts, least time left first.
2. Anything past due.
3. Tasks oldest-first (longest waiting), and everything else newest-first.

## 3. Production coverage

Nothing a user can reach today is lost. Each production location maps to a group, and the page's **Type** filter uses the production sub-tab names.

| Production location | New home |
|---|---|
| Pending Notifications › Pending Notifications (pended forms) | Approvals & Tasks (co-sign, sign, approve) |
| › Internal Orders · Radiology Order · Specialist Referral · Pending Labs | Approvals & Tasks |
| › Messaging | Approvals & Tasks (direct messages to me) |
| › Pending Patient Requests | Approvals & Tasks (routine), or urgent Client Alert (urgent request) |
| › Client Alerts | Client Alerts (urgent or due, by kind) |
| › Patient Notes | Client Alerts › Care-team notes — one row per note, opening the Client Notes thread in place |
| Critical Info › Overdue · Upcoming · Additional · Follow Up Items | Client Alerts — due & updates |
| Critical Info › Incomplete | Approvals & Tasks ("Finish your progress note") |
| System Notifications › Reports · Announcements | General & System |
| "Delegate Pending Notification" filter | Page **Assigned** filter: All · Only mine · Covering for others; plus "Covering for …" tag on rows |
| Sections · Days Back · Search | Page filters: Type · Client · Received · Search |
| Row "Select" action menu | Primary action button + More menu on every row |
| Dismiss All | Mark All as Read on each group; bulk Dismiss on General |

## 4. Surfaces

### 4.1 Bell and flyout

- The bell in the top bar shows the red count, or the dot.
- Clicking it opens a flyout from the right:
  - **Size:** half the viewport on desktop (560–880px), the full viewport at 1024px and below.
  - **Entry animation:** a fade and a 24px move, never a full slide.
- It opens on **Approvals & Tasks**, or on Client Alerts if there are no tasks but there are urgent alerts. Never on General. This is the research's "wrong default surface" fix.
- Group tabs show the red count or the dot.
- Every row has one action button and a More menu, so quick work never leaves the flyout. Row action buttons are **secondary**: a column of primary buttons is a wall, and if everything is primary nothing is. Opening a client closes the flyout and goes through the client-switch guard.
- **All Notifications** (footer, tertiary button) opens the page on the same group. The gear opens Delivery Preferences.
- Finished items waiting on someone else appear as one uncounted line that links to the page.

### 4.2 All Notifications page — `/notifications/:group`

Client-agnostic, so there's no client header. Tabs are the three groups. A **Delivery Preferences** link in the page header opens its own page (§4.5).

- **Filters:** Search · Assigned / Urgency / Show · Type (production sub-tab) · Client · Received (Any time, Today, 7, 30 days) · Clear filters.
- **Bulk:**
  - Tasks: Delegate Selected.
  - Alerts: Mark as Read or Unread.
  - General: Mark as Read or Unread, and Dismiss.
- **Waiting on others:** items where I've done my step (for example, step 2 of 3) leave my queue and my count. They're listed separately with **Send Reminder**. This is the research's "approval box full of things I already approved" fix.
- **Client Alerts** split into *Urgent — follow-up required*, *Due, expiring and updates*, and *Care-team notes*.

### 4.3 Row anatomy

`[select] · unread dot gutter · client avatar · client name · title · relative time ("2d ago") / detail / tags · actions (one secondary button + More, with Mark as Read underneath)`

**Keep rows quiet.** Urgency is carried by position (urgent first, least time left at the top), the red dot and the action button. So:

- No "Urgent", "Action needed" or "In progress" labels.
- No coloured backgrounds. Red fills are reserved for errors and destructive actions.
- No all-caps headings.
- Sender and source feed appear only on the All Notifications page.

Tags, shown only when they change the next step:

| Tag | Tone |
|---|---|
| Follow-up window ("Follow up within 24 h · 15 h left") | neutral; warn at ≤ 6 h; danger when overdue |
| Due / Overdue | warn when overdue |
| Note priority ("Low priority" … "Critical priority") | neutral for Low and Medium; warn for High and Critical |
| Covering for … | info |
| Report status | good / danger (error) |

### 4.4 Actions by kind

| Kind | Primary | More |
|---|---|---|
| Co-sign / sign | Review & (Co-)sign: **opens the document on the chart** in review mode, attestation required | Return for Edits (reason required) · Delegate · Open chart · Dismiss *(locked)* |
| Approval / order | Review & Approve / Review Order | Return for Edits · Delegate · Open chart · Dismiss *(locked)* |
| Lab result | Review Result: opens the Laboratory result on the chart; Acknowledge Result | Delegate · Open chart · Dismiss *(locked)* |
| Admission appointment request | Accept | Propose Another Time · Decline (reason) · Delegate · Open chart |
| Shift swap | Approve | Decline (reason) |
| Direct message | Reply | Mark Done · Open chart |
| Referral response | Confirm Intake Date | Mark Done · Open chart |
| My incomplete note | Continue Note: opens the draft on the chart; signing clears the task | — |
| Urgent alert | **Start Note ▾**: combo dropdown; the user must pick a note type before anything starts. Then **Continue Note**. Signing the note closes the alert. | Open chart · Delegate · Dismiss *(locked)* |
| Documentation gap | **Start Note ▾**, same as urgent | Open chart · Dismiss |
| Due & updates | Open / Open Chart | Open chart · Dismiss |
| Care-team note | Open Note (the Client Notes thread, in place; doesn't mark read). The row title is the note's **topic**, with a priority tag. | Open chart · Dismiss |
| Report | View Report / Try Again | Dismiss |

Locked items show **Dismiss** disabled with the reason: "Required by your organization — complete, return or delegate it."

### 4.5 Delivery Preferences — `/notifications/preferences`

This is its own page. The breadcrumb is Home › Notifications › Delivery Preferences. It's linked from the Notifications page header, the flyout's gear, and the account Preferences flyout, so other pages can link to it as well. It's no longer a tab: preferences aren't a view of the list.

- **Layout:** one matrix per section, with notification **type** as the rows and **channel** as the columns:
  - **Channels:** In AxiomEHR · Mobile app (push) · Email · Text message.
  - **Locked cells:** a lock means the organization requires that channel. The cell is always on and shows the reason on hover.
  - **"—" cells:** the type is never sent that way. Text is reserved for time-sensitive items.
  - **Column shortcut:** each column has *Turn all on* / *Turn all off*, which skips locked cells.
  - **Email timing:** each section can set its own email timing: Right away, If unread after 2 hours, or Daily digest.

| Section | Types |
|---|---|
| Approvals & Tasks | Signatures and co-signs · Approvals and orders · Lab and screening results · Admission and appointment requests · Direct messages · Referral responses · Your unfinished notes |
| Urgent Client Alerts | Hospital admission or ED visit · Crisis line call · Incarceration or release · Urgent appointment requests (in-app and mobile locked on) |
| Other Client Alerts | Assessments due or expired · Consents · Treatment plan reviews · Documentation gaps · New client assignments · Care-team notes (in-app locked) |
| **Calendar & Scheduling** | Appointment scheduled for you · Rescheduled or canceled · Client checked in · Client no-show · Upcoming appointment reminder (15 min / 30 min / 1 h / day before) · Daily schedule summary (send time) · Room or telehealth link changes · Shift and on-call changes |
| General & System | Report ready or failed · Agency announcements · Scheduled maintenance (in-app locked) · Your credential and training reminders |

The page also has:

- **Quiet hours:** hold mobile, email and text overnight. Items still wait in AxiomEHR, and urgent client alerts still come through. This section also sets the daily digest time.
- **Coverage while away:** "I'm out of office", plus who to delegate Approvals & Tasks to and until when. Urgent alerts still reach the user and their supervisor.
- **Privacy note:** mobile push, email and text never include client names or clinical details.
- **Save bar:** sticky, showing Discard Changes and Save Preferences.

### 4.6 In the chart — Client Summary › Needs Attention

The client's slice of the notification center, shown where the work happens. Acting on an item here updates the bell and the Notifications page, and the reverse.

- **One flat list, no categories.** Each row's button already says what to do. The order carries the urgency:
  1. Urgent alerts, least time left first.
  2. Unread care-team notes sent to the team, highest priority first.
  3. Tasks waiting on you.
  4. Due and expiring work: notification-center items plus the summary's own assessment and consent dates. Duplicates are removed by instrument code or consent name, and overdue items sort first.
- **Rows:** no client name, avatar or icon, since the client is known. Each row has the title with its relative time, the detail, only the tags that matter, and the action.
- **Header:** a plain title, with no count and no link. The work stays in this client's context, and the bell in the top bar is the way out to everything.
- **Mark as Read is available here,** as on the page. This is a full review surface, not the flyout's quick look.

### 4.7 Notes and documents opened from notifications

AxiomEHR agencies configure their own note templates per program, client and clinician, so a notification can't know which note a follow-up needs.

- **Start Note ▾** is a combo dropdown button. It lists the agency's note types, and nothing starts until one is chosen. Prototype list:
  - Case Management Note
  - Care Coordination Note
  - Crisis Follow-Up Note
  - Engagement Session Note
  - Hospital Discharge Follow-Up
  - Peer Support Note
  - Progress Note
  - Residential Check-In
  - Therapy Note
- **Where the note opens:** on the client's chart, as its own tab, under the client-switch and unsaved-work guards.
  - A banner links the note to the notification ("Started from a notification: Called the 988 crisis line · 15 h left. Signing this note documents the follow-up and closes the alert.").
  - Each note type has its own template checklist, for example the Crisis Follow-Up safety-plan items.
- **Saving vs. signing:** Save Draft keeps the alert open, and the row then offers **Continue Note**. **Sign Note** closes the alert, or clears the task, and returns to the Client Summary.
- **Review items open the document itself** in review mode: co-sign, sign, approve and lab results. The page shows the author, date, program and status, then the document, the attestation, and Return for Edits or the decision.
- **The left nav** lists the new note types under Documents › Notes. Opened from there, a note has no notification link.

## 5. Why each rule (research → design)

| Finding | Design response |
|---|---|
| No tiering, so everything lands in one pile | Three urgency groups; the bell counts only what needs you |
| Approval queues flood with already-approved items | *Waiting on others* section, uncounted |
| Wrong default surface | Flyout and page open on Approvals & Tasks |
| No proof of follow-up on clinical events | Urgent alerts close only when a follow-up note started from the alert is signed, so the chart holds the proof |
| Staff can mute critical items | Org-locked dismissal on tasks and urgent alerts |
| Priority invisible at the surface | Urgent first by time left; overdue tags; age on every row |
| No delegation pattern | Delegate on every task; out-of-office coverage in preferences; "Covering for" tag |
| Duplicate notifications across channels | One in-app source of truth; email/text are optional fallbacks per group, with "if unread after 2 hours" |
| PHI in external channels | Hard rule in the preferences copy and model |

## 6. Open questions

1. **Urgent "read" vs. resolved.** The prototype drops an urgent alert from the count when it's marked read, but keeps it open until a follow-up note is signed. Should the count instead hold until follow-up *starts*?
2. ~~Care-team notes — should they count?~~ **Decided: notes sent with *Notify Care Team* count.** One counts in the bell for everyone on the care team until each person marks it read (the read receipt), so teams can flag something to each other without buying the full internal messaging package. The composer's info tooltip explains this so staff don't overuse it. Note priority (Low → Critical) is shown, but it doesn't decide whether a note notifies.
3. **Supervisor view.** The research asks for team-level completion (CEN response rate, overdue by team member). This page is the individual queue; the team view is a separate story.
4. **In-chart surfacing.** Built on the Client Summary (§4.6). Open: should urgent alerts also show in the client header itself, so they're visible on every tab of the chart?
5. **Who sets locks.** Which admin role sets which kinds are locked, and per program or agency-wide?
6. **Feeds.** Which sources (health information exchange, health plans, crisis line partner, jail liaison) are live per customer, and how are duplicates from two feeds merged?
7. **Email "if unread after 2 hours".** Is a fixed interval right for tasks, or should each customer configure it?
8. **Bulk mark-read on client alerts.** Kept on the page for now. Validate in user testing whether clinicians expect it, or whether it undermines deliberate review.
9. **Which note types per alert.** The prototype lists every template. Production should list the templates the agency enables for this program, client and the clinician's role, and could pin a suggested one if the agency configures it.
