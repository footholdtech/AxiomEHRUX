# Handoff — AxiomEHR interaction prototype

Everything a fresh session needs to finish the design-fidelity pass. Written
2026-09-22, at the point where the behaviour work was done and the visual work
was blocked on Figma access.

---

## 0. Prerequisite — Figma MCP must be authorized

The previous session had **no Figma MCP tools at all** (`plugin:figma:figma`
required authentication and the session could not run OAuth). Every remaining
item below needs the file. Before starting, confirm you can call
`get_design_context` / `get_variable_defs` / `get_code_connect_map`. If you
cannot, say so immediately rather than approximating from screenshots — that
is exactly the rework the playbook exists to prevent.

`~/Claude/Radicle Health/FIGMA-MCP-PLAYBOOK.md` is the governing guidance.
Golden rule: **the Figma file is the source of truth, not the screenshot.**

---

## 1. Figma references

File: **Figma → Claude MCP Testing**, key `CYkk4GWvOq7B4FzSRrBUsF`
(MCP wants colons in node ids: `4090-39441` → `4090:39441`)

| What | Node | Link |
|---|---|---|
| Main screen — top bar, search, left nav, client header, My Caseload switcher | `4090:39441` | https://www.figma.com/design/CYkk4GWvOq7B4FzSRrBUsF/Figma--%3E-Claude-MCP-Testing?node-id=4090-39441&m=dev |
| Client-specific page with no client set (pre-filtered caseload search) **and** the Leave Without Saving modal | `4423:86972` | https://www.figma.com/design/CYkk4GWvOq7B4FzSRrBUsF/Figma--%3E-Claude-MCP-Testing?node-id=4423-86972&m=dev |
| Client header component — expanded and collapsed variants | `4090:39582` | https://www.figma.com/design/CYkk4GWvOq7B4FzSRrBUsF/Figma--%3E-Claude-MCP-Testing?node-id=4090-39582&m=dev |
| Left navigation — two expanding sections | `4425:92142` | https://www.figma.com/design/CYkk4GWvOq7B4FzSRrBUsF/Figma--%3E-Claude-MCP-Testing?node-id=4425-92142&m=dev |

Supporting libraries (from `community-care-network/AGENTS.md`):

| File | Key | Use |
|---|---|---|
| Radicle Design System | `FqlNrpkqnskgLlCvGLxRcL` | Components. Avatar `2:20`, Table `2:32`, Buttons `2:18` |
| Foundations | `ZUmNncm1WSXY7IktldEXAt` | Tokens, icons, elevation |

**Code Connect:** the Radicle DS file has mappings pointing at
`axiom-ehr-prototype`. Do **not** overwrite them — Code Connect stores one
mapping per node per label and remapping breaks Dev Mode for whoever uses that
prototype. This was Lisa's explicit call.

---

## 2. What this prototype argues

Two problems from an on-site customer visit in LA County:

1. **The app is tethered to a client record.** Clinicians land already inside a
   chart and lose track of whose record they are documenting in. The prototype
   argues for empty client context on load and after every sign-in, deliberate
   entry only, a persistent identity header, and intercepts on client switch /
   chart exit / unsaved-work loss.
2. **Discharge assumes every diagnosis is resolved.** A previous customer asked
   for this and it is wrong — enrollment status and clinical status are separate
   facts. Saving a discharge note intercepts with a diagnosis/problem picker
   (active pre-checked, resolved not) that decides *only* what prints on the
   summary, and never writes diagnosis status.

---

## 3. Already done — do not redo

Behaviour and bug fixes completed and verified in-browser:

- Homepage "no client in context" callout **removed** (overkill for an EHR).
- Left nav **no longer adopts a client**. A client-specific module opened with
  no client in context routes to `/module/:slug` and renders a picker scoped to
  the clinician's caseload (8 direct, 4 indirect) — never a chart.
- **Open Diagnosis is no longer a button** — it is two links, *Edit Diagnoses*
  and *Edit Problems*, routed through the guard so unsaved work is intercepted.
- **Indeterminate checkboxes fixed.** The DS fills the box for `:indeterminate`
  but only reveals the checkmark for `:checked`, so partial selections rendered
  as a solid glyphless box. Dash added in `discharge.css`.
- **Resolved rows are no longer dimmed.** Full-strength rows; `Resolved` is a
  blue label. Inclusion is carried by the checkbox and a left accent bar.
- **AP title case** applied to 32 button labels and page titles.
- **Date labels fixed** — `DateField` owns its own label so Today / 7 / 30 sits
  right-aligned on the label baseline, 6px above the input. *(Lisa has since
  re-flagged these as still sitting too high — see §4.)*
- **Left nav rebuilt to the DS component set** (`4425:92142`). Rail + flyout,
  measured at 234px / 230px+300px = 530px to match the component. Rail sections
  Home · Clients · Documents · Reports · Billing · Admin, a divider, then the
  `Landing Pages` group (Foster Home · Inpatient Module · Residential). The
  flyout carries `.flyout category` headers at 44px on `surface/secondary` and
  nested expanding categories. Selected state uses
  `background/interactive/tertiary/selected` + a 2px
  `border/input-control/secondary/active` accent — both theme-bound, so the rail
  re-themes. Only the Clients flyout is transcribed from `get_design_context`
  (`4425:92185`); the other four came from the DS page and want verifying
  against `4425:92214` / `:92243` / `:92272` / `:92301`.
- **A client no longer survives leaving a chart.** The `Keep … in Context`
  button is gone from the leave intercept, and `ClientBanner` renders only while
  the URL is actually inside that client's chart.
- **Global search replaces the client-context chip** in the top bar
  (`GlobalSearch` in `30-chrome.jsx`). From the DS `top navigation` →
  `Search w/prefix` (RDS `1876:36155`, ↪ Top Navigation page). Its annotations
  were implemented literally, not paraphrased: always present, never hidden
  behind an icon, specific placeholder, and the full anatomy — category prefix
  (All / Clients / Pages), search icon, placeholder, container, input, clear
  button, trailing accessory. It searches clients *and* a flattened page/module
  index built from `NAV_SECTIONS`; picking a client goes through the guard, so
  switching still intercepts. Verified present on all 11 routes.
  - Code Connect maps that node to `src/primitives/Search/Search.tsx`
    (axiom-ehr-prototype, absent here). Per §1 that mapping stays untouched, so
    this is the playbook's "clearly-labeled best-effort mirror", tagged
    `data-node-id="1876:36155"`.
  - The old `ClientSwitcher` and every `.ctx-*` style are gone. The DS bar has
    no client chip; identity is carried by the client header on chart pages.
- **Home is the AxiomEHR dashboard, not a bespoke screen** (artboard
  `4090:39455`). Nine accordion modules on a two-column grid with three
  full-width bands: My Clients · Pending Notifications · Critical Info · My
  Team · Messenger · Upcoming Appointments · Pending Labs · Announcements ·
  Productivity. The point is recognisability — the prototype argues about
  client context and discharge, so Home should not also be an unfamiliar
  screen for the people reviewing it.
  - **The discharge walkthrough entry point lives in Critical Info → Overdue.**
    The old standalone "Documentation Due" panel is gone, but its first row
    ("Discharge Plan · Due today") survives there, and its Open button routes
    straight to `/chart/:id/discharge-plan` rather than the overview, so the
    walkthrough is still one click from Home. Do not let that row disappear.
  - `build-refdata.py` now ships `staffMessages` / `clientMessages`. Those
    fixtures existed but were never inlined, so Messenger had no data.
  - Pending Labs and Announcements have no fixture behind them; both are
    derived deterministically from `client_id` or are fixed agency notices.
    Fictional, stable across reloads, and nothing clinical.
- **Tab sets never wrap — `TabStrip` in `00-core.jsx`.** The DS `tabs group`
  ships `# of entries` 2–14 but no overflow variant; the behaviour comes from
  the component's own docs, which are explicit: *"Avoid wrapping tabs to
  multiple lines, as it reduces scannability"* and *"For highly dynamic tab
  sets, consider a dropdown 'More' menu for overflow items."* Whatever does not
  fit moves into a `More (n)` menu, and picking from it **promotes that tab to
  the front** of the order so it is visible and active — you should not have to
  reopen the menu to find where you just went. An active tab that starts in the
  overflow (a deep link to a module) is promoted on mount for the same reason.
  - Widths are measured against a **hidden mirror** of the full set
    (`.tabstrip-mirror`, `position:absolute; width:max-content; visibility:hidden`)
    rather than the live row, so nothing is painted mid-reflow and the
    measurements are never of an already-squeezed row. A `ResizeObserver` on
    the strip re-measures — verified 5 visible → 3 when the rail docks, and
    the More button disappearing entirely at 1800px.
- **The active tab carries the DS accent.** `state=active, type=contained` is
  `background/interactive/quaternary/active` with a **2px top rule in
  `border/interactive/tertiary/selected`** and a `2px -2px 4px` shadow. That
  top rule was missing, and without it the set read as a row of buttons rather
  than a tab strip. It is theme-bound, so it re-themes. Hover and pressed now
  use the `quaternary/hover` and `/pressed` steps too.
  - The active tab sits 1px proud of the others because its top border is 2px
    where theirs is 1px. That is the component, not a bug — do not "fix" it by
    equalising, and do not assert exact `top` equality when testing the row.
- **The rail survives navigation, and docking is a preference.** Clicking a
  nav item no longer closes it — in AxiomEHR a pinned nav is the clinician's
  setting, not something each click revokes. "Keep Navigation Open" in
  Preferences docks it, which means click-away no longer closes it; undocked,
  click-away and Escape still do. **An open rail always displaces the page**
  (`.app.nav-open` shifts `.app-body` and `.chart-chrome`) — content moves over
  rather than being covered, in both states. Docking changes how long the rail
  stays open, not how it sits beside the page. The flyout still collapses when
  you pick a destination.
- **The menu button has a real active state.** `.topnav .hamburger.active` was
  being set in markup but had no style, so the toggle looked identical open and
  closed. It now holds a 26% pressed fill.
- **`Breadcrumbs` is one component** (`30-chrome.jsx`), used by the chart
  chrome, the stubs, All Clients and the module picker. Every crumb but the
  last routes **through the guard**, so a trail can never sidestep an
  intercept; the last is the current page and is not a link.
  - The chart trail is **`Clients › <client> › <active tab>`**. It was
    `Clients › Client Medical Area › <client>`, which was wrong twice over:
    Client Medical Area is a sibling destination rather than an ancestor of the
    chart, and the trail stopped short of the tab you are actually standing on.
    The active tab reaches the app shell via `guard.chartTab`, which `ChartPage`
    publishes and clears on unmount.
- **Unmatched routes no longer fall through to Home.** The left nav and the
  global search can reach far more leaves than this prototype builds out, and
  `/foster-home`, `/payment-management` and friends were silently rendering
  Home — which reads as a broken link. Any in-app path without a match now
  renders a named skeleton with its own crumb.
- **Leaving a chart no longer interrupts unless there is something to lose.**
  The `leave` reason now requires `dirty`. Reading a chart and going back to
  Home just clears the client. A *switch* still intercepts either way, because
  that changes whose record the next thing you type lands in.
- **`Client Summary` is the chart's landing tab** (`CHART_HOME_TAB`), and
  every client switch resets to it — carrying the previous tab across would
  drop you into a different person's Discharge Plan because that is where you
  happened to be standing. Read-only; it hands off to the tab that owns each
  thing rather than being a second place to edit clinical data.
  - No design existed, so the layout was improvised against three rules worth
    keeping: **nothing the client header already shows is repeated** (no
    demographics, care team, allergy or vitals lists); **exactly two things
    carry colour** — overdue work and a missed appointment, because if
    everything is tinted nothing reads as urgent; and modules **pair
    side-by-side** where they are narrow enough so the page is read, not
    scrolled. Timeline sits in a sticky right rail that drops underneath below
    1240px.
  - Six regions, in the order a provider asks them: Needs Attention · Recent
    Documentation · Messages · Appointments (month calendar) · Engagement and
    Progress · Activity. Needs Attention renders nothing at all when empty —
    an "all clear" card is one more thing to read past.
  - **`RD.assessments` is an object, not an array**: `{_meta, instruments,
    sample_results}`. Reading it as a list fails silently — no error, just no
    assessment due-dates ever appearing. `instruments` is the catalogue;
    `sample_results` holds real per-client scores with interpretations for five
    clients, and the acuity metric prefers those over its derived fallback.
  - Attendance is derived from the appointment id, because `completion_status`
    is blank on 168 of 171 fixture rows. Deterministic, so an appointment always
    reads the same way.
  - `.panel + .panel { margin-top }` is right for a stacked column and wrong
    inside a grid — it silently pushed the second item of every pair 16px down.
    Reset for `.cs-pair` and `.home-grid`.
- **The header no longer reacts to scroll.** Expanded/collapsed is the
  clinician's choice and only the toggle changes it — the auto-collapse and
  its height transition are gone (the header moving on its own while you read
  cost more than the height it saved). It still pins under the top bar.
- **The identity column sizes to content.** The DS frame fixes it at 280px,
  which stacks longer names after two words and strands the status pill
  mid-row; the name now takes the width it needs and the pill sits directly
  after it.
- Entry points: the agency mark in the top bar goes Home, caseload client
  names open the chart through the same guarded route as the button beside
  them, and both breadcrumb ancestors navigate. `/client-medical-area`,
  `/analytics` and `/client-list` exist as skeletons so no crumb or nav item
  dead-ends.
- **The client header is chrome, not page content.** Artboard `4433:94068`
  puts `breadcrumbs` then `client page header` in the content container at its
  full 1440, with only the body beneath inset (x=32, 1376) — so `ChartChrome`
  in `30-chrome.jsx` renders both from the app shell, above `.app-body`, and
  `.content`'s 24px padding does not apply to them. Measured: header 1440 =
  chrome width, page body inset 24px from the header's left edge, breadcrumbs
  above. It shifts with the rail like the old banner did, and renders only
  inside the matching client's chart — verified not to leak onto other routes.
- **The header pins and self-folds on scroll.** `position: sticky` at
  `top: var(--topnav-h)`; scrolling down collapses it. The transition lives on
  `.cph-detail`, which is now always mounted with the **collapsed state as its
  base style** — a throttled tab or reduced-motion renders it closed rather
  than parked half-open.
  - **The settle window in that scroll handler is load-bearing.** Expanding
    grows this sticky header, which grows the document, which moves `scrollY`
    by ~75px unprompted. The first version read its own layout shift as a user
    scroll and slammed shut, so the header could not be expanded at all once
    the page was scrolled. It now baselines the position, ignores anything
    inside a 420ms window, and folds only on a real downward scroll past it.
- **Tab pills are expanded-state only** — the DS dropped them from the
  collapsed variant. Collapsed renders zero pills.
- **The attribute pencil sits inside the attribute box** and opens
  `AttributesOverlay` (see CLIENT-HEADER-SPEC §2a): add from the agency's
  library (search, chart suggestions, categories), edit start/end dates, remove
  as entered in error, and read each attribute's history. Saves to the session
  store in `16-records.jsx`, so the box, the collapsed-header indicator and the
  dialog agree; a reload starts clean.
  - Its rows are `div role="checkbox"`, **not** `<label>`. `Checkbox` renders
    its own `<label>`, and nesting labels is invalid HTML that double-toggles
    in some browsers. The row owns the click and `.rds-checkbox` is
    `pointer-events: none`, so exactly one toggle fires wherever you hit it —
    verified by hit-testing that the checkbox's centre resolves to the row div.
    Note a programmatic `.click()` bypasses hit-testing and so will *not*
    reproduce real behaviour here; dispatch at coordinates instead.
- **Client page header rebuilt from the DS component** (`8139:96518`,
  variants `8139:96530` expanded / `8139:96664` collapsed). `ClientPageHeader`
  in `30-chrome.jsx`, `.cph-*` in `discharge.css`. It replaces the hand-rolled
  `.client-banner` *and* the old `.clinical-strip` on the chart page, and is a
  page-level component rendered by the chart rather than app chrome.
  - Collapsing removes exactly one thing — the four-column detail row. Identity,
    actions, pills and the Clinical Info strip are in both variants, which is
    what makes collapsed usable as the always-on state. **Defaults to
    collapsed**: expanded is 410px in the design, which is a lot of chart to
    spend before the clinician reads anything.
  - Layout is a 214px fixed flags card plus three equal flex columns, not a
    grid. Verified on one row at 1320px.
  - The flags card is `background/system/warning/light` — a *warning* ramp
    token, not an accent. Care Team is `background/surface/brand-primary`.
  - Where the design has no token the raw value is kept and commented: the 7px
    stack gaps, 280px identity column, 214px flags card, 120px care-team tile,
    44px avatar, 0.75px pill border, 20px name size / 32px line-height.
  - Two inversions reproduced deliberately, because they are what the component
    does: the **DOB row** puts SemiBold on the *label* (every other label/value
    row in the component is Regular label + Medium value), and **"Biological
    Sex"** is the one Clinical Info item whose value is Regular not Medium.
  - Clinical Info separators are real 1px `border/secondary` borders on the
    items with `gap: 0` — the spacing comes from each item's 8px side padding.
  - **Icons: `assets/ds-icons.js`.** The component's own 17 vectors, downloaded
    from the Figma Dev Mode asset endpoint — not hand-drawn and not substituted.
    Fills are stripped so they inherit currentColor, matching
    `fluent-icons.js`. They are authored 20x20, so `Icon()` renders this
    registry at `viewBox="0 0 20 20"`; every key is `ds`-prefixed because
    `mail` / `phone` / `warning` / `people` / `edit` exist in both registries.
    The six action-row icons export as unnamed `<g id="icon">`, so their
    vectors are authoritative but their *meaning* is not recorded — the
    aria-labels are read off the rendered design and are worth confirming.
  - Axiom ID, CIN, Shared Service ID, Residence and Housing Type are not in the
    shared fixture set. They are derived from `client_id` in `10-data.jsx` —
    stable across reloads, consistent between screens, and fictional.
  - `--border-system-sucess-default` is spelled that way in the Figma variable
    and therefore in `tokens.css`. Used as-is so regeneration cannot break it.
- **Both modals rebuilt on the DS `.modal header`** (`2086:547`, RDS ↪ Modal
  page). Shared rules in `discharge.css`: px `spacing/lg`, py `spacing/md`, a
  `border/secondary` underline, title in **Roboto SemiBold 16/24**
  (`font/size/2xl` + `line-height/md`) — the display face is gone from modal
  titles — and the dismiss control in a trailing group pinned right instead of
  tacked onto the title text. The component's `warningIcon`/`infoIcon` both
  default to false, which is why neither dialog has a leading glyph.
- **The diagnosis modal's purple banner is now the DS embedded info banner.**
  `system/info`: `background/system/info/light` surface,
  `foreground/system/info/default` icon, `border/system/info/default` rules.
  Informational UI must not borrow the theme's interactive colour.
- **Diagnoses / Problems are tabbed** inside that modal, using the existing
  `.tab-default` boxed tabs. One table is mounted at a time and its
  `.table-wrap` caps at 46vh with `overflow-y: auto`. Tab counts are everything
  listed in the tab, resolved rows included.
- **Intercept copy and layout follow Lisa's handling spec** (three variants,
  artboard `4090:39441`). 480px dialog, DS `.modal header`, no icon medallion,
  footer actions grouped right — secondary then primary:

  | situation | title | body | actions |
  | --- | --- | --- | --- |
  | switch + unsaved | Unsaved Changes | warning banner + identity pair | Stay on Page · Switch Without Saving |
  | switch, clean | Switch Clients? | plain question + identity pair | Cancel · Yes, Switch Clients |
  | leaving, unsaved | Unsaved Changes | warning banner, no pair | Stay on Page · Leave Without Saving |

  Two rules from the spec that are easy to get wrong: **the question lives
  inside the warning banner** when there is unsaved work rather than being
  repeated above it, and **the identity pair appears only when a client is
  actually changing** — leaving a page is not a switch. Sign-out follows the
  same shape ("Sign Out?" / "Sign Out Without Saving").
  - The pair is a plain `Leaving → Switching to` row, not the bordered
    `ClientIdentityCard`s that were here before — those and `.intercept-ico`
    stay deleted.
  - The warning banner is `system/warning`: `#FFFAD5` on a
    `border/system/warning/default` rule with a `foreground/system/warning/dark`
    glyph. Distinct from the `system/info` banner in the diagnosis modal, which
    is informational rather than a caution.
- **Fixed: the PDF preview's white sheet stopped halfway down.** `.pdf-scroll`
  is a flex container, so its default `align-items: stretch` pinned `.pdf-page`
  to the scroller's height while the content overflowed past it — everything
  below the fold sat on the grey backdrop. `align-items: flex-start` lets the
  page take its content height (measured 1887px in a 793px viewport);
  `min-height: 1056px` still gives a full sheet for short documents.
- **The rail closes on click-away and on Escape.** The hamburger is excluded
  from the click-away handler — `mousedown` fires before its `click`, so
  without that exclusion the two cancel and the button never appears to work.
  Closing the rail also collapses the flyout so reopening starts clean.
- **Fixed: leaving a chart silently re-adopted the client.** The router follows
  `hashchange`, which lands a tick after the state update, so the chart got one
  extra render while mounted with `clientId` already null — and its deep-link
  effect re-adopted. It now checks the live `window.location.hash` before
  adopting. Deep-link entry still works; regression-tested both ways.

---

### Client header — clinical quick views, pager, notes, tooltips (2026-10-09)

- **Quick views no longer capped at 6.** `PillPager` (30-chrome.jsx) gives the
  pills up to two rows and pages with previous/next arrows past that. Pages are
  computed from a hidden mirror; the mirror's pills must be `flex: none` or they
  get squeezed and paging never triggers (hit once). Paging browses — it does
  not change the open quick view.
- **"Medical" split** into Allergies, Medications, Vitals, plus Immunizations,
  Injections and seven scored instruments (PHQ-9, PCL-5, PC-PTSD-5, ACE, AUDIT,
  AIMS, SDOH). Saved headers containing `medical` are migrated in
  `normaliseConfig`. Storage key bumped to `axiom-ui-config-v2` so reviewers get
  the new seeds.
- **32-quickviews.jsx** holds the clinical views and their overlays. Every view:
  summary only, records link to their module route, "+ Add …" opens an
  `Overlay` (00-core, sm/md/lg) and the new record appears at once.
- **Medications**: Current/Expired/Discontinued filters, bulk Refill and
  Discontinue, Add Medication (field set from production's form, structure
  only). Safeguards demonstrated: C-II can't be refilled, controlled refills go
  to "Pending signature" (EPCS) and need a PDMP attestation, DEA number required
  for controlled, allergy cross-check that must be acknowledged, 42 CFR Part 2
  sensitivity defaulted for SUD meds. Not a complete prescribing model.
- **Client Notes** button: always first in the action row, not configurable,
  red unread badge, overlay with Mark as Read / Unread. Notifications-center
  behaviour is still to be defined.
- **Tooltips** above every round action button. Built from DS tokens because
  the DS tooltip frame (2:34) wasn't reachable — **confirm against Figma.**
- **Records** (16-records.jsx): fixture rows + in-memory session edits. A
  reload starts clean.
- **Data**: `tools/build-header-fixtures.py` extends the shared synthetic set
  (formulary additions with schedules, medication history, immunizations,
  injections, vitals history, assessment forms + administrations, client
  notes). Assessment item wording is **abbreviated** — production must use the
  validated instrument text.
- Fixed in passing: `Toggle` ignored `disabled`, so the default header's Active
  toggle could be switched off.
- **Dropdown menus are portalled** (`FloatMenu` in 00-core): rendered into
  `<body>` at fixed coordinates, z-index 95, so no dialog, table cell or scroll
  container clips them. They flip above the trigger only when their measured
  height doesn't fit below, follow the trigger on scroll, and Escape closes the
  menu without closing the dialog. Outside-click must check the trigger *and*
  the portalled menu (`useOutside`). All three dropdowns (Dropdown,
  MultiSelectDropdown, discharge MultiSelect) use it.
- **Pharmacy routing** in Refill / Add Medication: per-medication pharmacy with
  coverage, EPCS capability, preferred pharmacy and disabled-with-reason
  options. Mocked in 16-records.jsx (`PHARMACIES`, `pharmacyBenefit`) — stands in
  for Surescripts.
- **Client Notes is a conversation** with avatars and a composer (`addNote`).
  `ClientNotesThread` (32-quickviews) is shared by the header overlay and the
  Client Summary panel (`ClientNotesPanel`), so read state is shared. Own notes
  can be deleted (`deleteNote`); a tombstone "Message deleted" stays. No "New"
  divider — it read as an error state in the system danger colour.
- **Note icon** is `clientNote` in `ICONS20` (00-core): filled outlines on the
  DS 20px grid. The earlier 24px stroke icon rendered soft at 20px.

### Notifications, dialogs, breadcrumbs, loading (2026-10-10)

- **Notification center** — see `NOTIFICATIONS-SPEC.md`. Three urgency groups
  (Approvals & Tasks · Client Alerts · General & System), bell in the top bar
  (`NotifBell`), right flyout (half viewport, full on tablet), and the
  client-agnostic page `/notifications/:group` with filters, bulk actions,
  "Waiting on others" and Delivery Preferences. Store and counting rules in
  `17-notifications.jsx`; UI in `34-notifications.jsx`. The dashboard's
  Pending Notifications panel is now `ApprovalsTasksModule`.
- **Clinical read is deliberate.** Client Alerts (incl. care-team notes) are
  never marked read by opening them or starting a follow-up, and the flyout has
  no Mark as Read for them — only the page row (and the note's own thread).
  General & System stays lenient. Care-team notes are one alert per note,
  derived at runtime from the records store (`noteNotifs`), so read state is
  shared with Client Notes.
- **Client notes use production's fields** (2026-10-14): `topic` and `importance`
  (Low→Critical, default Low) required, `show_in_header` (always true; shown
  as a disabled checkbox), and `notify_team` (default off). Only `notify_team`
  notes reach the notification center and count until read (`noteNotifs`,
  `notifCounted`); the composer explains this in `NOTIFY_TEAM_TIP`. The old
  free-text `subject` and `important` flag are gone. `NOTE_TOPICS` is a generic
  stand-in — production's topic table has duplicates and customer facility
  names, so it wasn't copied. Testing tooltips by `.focus()` fails silently
  when the preview window isn't focused — use hover.
- **Read receipts only for notified notes** (`noteNeedsRead` in 16-records):
  thread dots, Mark as Read and the header badge ignore plain notes. The
  Client Summary notes widget is thread-only (`composer={false}`) and adds
  notes through `AddInternalNoteOverlay`; both share `useNoteDraft` /
  `NoteFields`.
- **Delivery Preferences is its own page** (`/notifications/preferences`,
  `NotifPreferencesPage`), linked from the page header, the flyout gear and
  the account Preferences flyout. Prefs key `axiom-notif-prefs-v2`.
- **`.switch` must be `inline-block`.** Its root is a `<label>`; outside a flex
  row (e.g. a table cell) it collapsed and the track rendered as a sliver.
- **Service Plans quick view** (`33-serviceplans.jsx`, data in
  `service_plans.json` from build-header-fixtures.py). Progress = mean
  objective progress vs. elapsed plan period (`planProgress`); "Behind" past a
  10-point gap. The dialog shows the plan as text, a per-goal copy (`copyText`,
  Clipboard API with textarea fallback) and Edit Service Plan → module. No
  plan-origin (Axiom / custom) labels and no "read-only" wording in the UI —
  Lisa, 2026-10-14. The `governance` field stays in the data only. Seeds gained the view, so the UI config key is now
  `axiom-ui-config-v3` (earlier in-browser header edits reset).
- **Phone emulation in the preview needs a reload after resizing** — a
  resize alone leaves a 980px layout viewport and the breakpoints don't fire.
- **Responsive** (2026-10-14): `useMedia(BP.*)` in 00-core — `tablet` ≤1184,
  `mobile` ≤850 (top bar, per the DS sizing spec), `compact` ≤540 (client
  header → `.cph--compact`). Layout that changes a size or label is done in
  JSX from the hook; the rest is CSS keyed off the class.
- **Hidden measuring mirrors must sit off-screen LEFT** (`position: fixed;
  left: -10000px`). The tab strip's mirror at `left: 0` stuck out past the
  right edge and widened a phone layout to 1249px (sideways scroll, zoomed
  out). Negative overflow never scrolls. Same for `.cph-pager-mirror`.
- **Don't size fixed panels with `100vw`** — it can exceed the visible width;
  use `width: 100%; left: 0`.
- **Loader flattens fixtures to arrays.** `RD.<table>` is the `records` array —
  there is no `_meta` at runtime (hit once: `RD.notifCenter.records` crashed).
- **Every dialog is portalled to `<body>`.** `.chart-chrome` is sticky with its
  own stacking context (z 26), so a dialog rendered inside the client header
  sat under the top bar (z 47) whatever its z-index.
- **Avatar is an image** (`.avatar`, `role="img"`, hidden from assistive tech
  because the name sits beside it). Link styles that target text spans must
  exclude it (`span:not(.avatar)`).
- **Breadcrumbs are buttons.** The client crumb goes to that client's summary;
  pressed while already there it soft-reloads (`requestPageReload` /
  `usePageReload`): local spinner, content dimmed not blocked, remount.
- **Staggered entry** on the dashboard and Client Summary: 240ms fade + 6px
  rise, 55ms apart. Opacity and a small offset only, per the trap below.

### Wayfinding: no dead ends (2026-10-28)

`src/47-pages.jsx`. Every breadcrumb and nav item now leads to a real page.

- **One map of where things live.** `NAV_PLACE` / `navTrail()` / `openNavItem()` in `30-chrome.jsx` are built from `NAV_SECTIONS`, so every page draws the trail the left nav implies (Reports › Dynamic Report Builder, Documents › PHQ, Clients › Allergy). Categories (Assessments, Builders) are drawers, never crumbs.
- **Section pages.** `/reports`, `/billing`, `/admin`: the section's children in nav order (categories, then links). `/documents` is the document search instead; `/clients` stays the client list.
- **Documents** (`DocumentsPage`): every document across the user's clients (`clientDocs`), filtered by client, author (incl. Me), document type, status and a date range with production's quick sets (Today −30 −7 / Today 7 30), plus keyword search. Filters apply live; Reset Filters appears once something changes. New Document chooses a note type, then a client if none is in context. Opening a row goes through the guard (a different client in context is a named switch) and lands on `/chart/:id/doc-…`, a chart tab named for the document. Production's Clinical Forms Search route opens this page.
- **Record pages.** Every module and page has a table and an **Add** that opens a form **on the page**, not a dialog, so the loop is visible: typing marks the page dirty, the breadcrumb and nav intercept, Save or Cancel makes it clean. Client modules render inside the chart; everything else is client-agnostic. Real specs for Allergy, Vitals, Immunization, Injection, Diagnosis, Problem List, Payor Assignment and Appointments; Prescription and the scored instruments keep their existing dialogs (prescribing and item-level scoring have real logic). Everything else uses sample entries with a date / status / entry form, labelled as sample data. Records save to the session store, so an allergy added on the Allergy page shows in the header count at once.
- A deep-linked client switch now keeps the module or document that was asked for instead of dropping to the summary.

## 4. Outstanding — needs the artboards

Lisa's list, in her words, with what is blocking each:

1. **Search bar** must be present regardless of client context, must search
   clients **and pages/modules**, and must follow the DS search input. Currently
   there is no top-bar search at all — the previous session replaced it with a
   context chip. Rebuild from `4090:39441`. Note the screenshot shows the
   scope selector ("All ▾"), magnifier, input and mic.
2. **Client header** — paint from the component at `4090:39582`, including both
   **expanded and collapsed** variants. Current implementation is a hand-rolled
   `.client-banner` in `30-chrome.jsx`; replace it.
3. **Left nav** is wrong — it has **two sections that expand** (`4425:92142`).
   Current implementation is a flat rail plus one alphabetical form list.
4. **Modal component styling** — follow the DS modal reference on the artboard.
   Applies to the diagnosis intercept (`.dxmodal`) and the nav intercepts.
5. **Split the diagnosis/problem tables into tabs** inside the modal, with a
   count in the tab. ⚠ **Open question:** Lisa wrote "(5 Active)" — confirm
   whether the tab counts only active-status items or everything listed.
6. **Replace the large purple banner** on the diagnosis modal with the DS
   **embedded blue info banner**. It must not use a semantic interaction colour.
   Best guess from tokens, unconfirmed: `--background-system-info-light`
   (`#ECF4FF`) with `--background-system-info-default` (`#505676`) for icon and
   rule. Confirm against the DS before using.
7. **Leave Without Saving modal is far too embellished** — reference is on
   `4423:86972`. Current version has an icon medallion, identity cards and a
   warning panel; it should be a plain small dialog.
8. **Client-module empty state** (`4423:86972`) — the behaviour is built and
   correct, but the layout is DS-token scaffolding only. Restyle to the artboard.

Also outstanding from the "next set" Lisa mentioned but has not sent yet.

---

## 5. The codebase

`~/Claude/Radicle Health/axiom-discharge-prototype/`

```bash
python3 tools/build-clinical-fixtures.py   # per-client diagnosis + problem tables
python3 tools/build-header-fixtures.py     # header quick-view tables (run before build-refdata)
python3 tools/build-attribute-fixtures.py  # attribute catalog, agency list, per-chart assignments (run before build-refdata)
python3 tools/build-agency-clients.py      # clients outside the caseload, for Client Access Requests (run before build-refdata)
python3 tools/fetch-attribute-icons.py     # only when adding Fluent glyphs; needs network
python3 tools/build-notification-fixtures.py  # notification center (run before build-refdata)
python3 tools/build-refdata.py             # fixtures -> assets/refdata.js
python3 tools/build.py                     # -> index.html + AxiomEHR-Prototype.html
python3 tools/serve.py                     # dev server, sends no-store
```

`tools/build.py` must run after **any** change under `src/`, `styles/`,
`assets/` or `vendor/`.

| File | What lives there |
|---|---|
| `src/00-core.jsx` | Theme, router, icons, avatar, buttons, checkbox, radio, dropdown, panel, toast |
| `src/10-data.jsx` | Projections over `window.REFDATA`; status vocabulary; caseload scoping; module list |
| `src/20-context.jsx` | Client context, the navigation guard, the intercept overlay |
| `src/30-chrome.jsx` | Top bar, client switcher, client banner, left nav, sign-in |
| `src/40-home.jsx` | Home, All Clients, stubs, client-module picker |
| `src/50-discharge.jsx` | Chart page and the Discharge Plan form |
| `src/60-summary.jsx` | The generated discharge summary (active diagnoses/problems only — the selection intercept was removed 2026-09-28 at the customer's direction) |
| `src/90-app.jsx` | Routes and mount |
| `styles/discharge.css` | Everything new; loads after the shared `app.css` |

### Traps already hit here — don't rediscover them

- **Both HTML outputs are self-contained on purpose.** An earlier version kept
  a light `index.html` loading siblings; it failed twice in the field
  (*Cannot read properties of undefined*, then *Babel is not defined*). Safari
  refuses `file://` subresources by default. Do not reintroduce a partial build.
- **Nothing heavy may be render-blocking.** Fonts (~1.2 MB base64), React and
  Babel ride in `type="text/plain"` blocks evaluated after a yield. With them in
  the head, first paint was ~890 ms of blank window.
- **Never let `requestAnimationFrame` be the only path to a correct state** — it
  does not fire in a background or throttled tab. The bootstrap starts on
  whichever of rAF or a 150 ms timer fires first.
- **A blank page is usually a dead dev server**, not a broken build. Check
  `preview_list` before debugging the app.
- **A blank preview is often a port collision, not a dead server.** Hit twice
  now. A `tools/serve.py` left running by an older session keeps port 8791 but
  is rooted somewhere without an `index.html`, so it 404s everything — and it
  still sends the same `no-store` headers a healthy server does, so the headers
  do not give it away. `preview_start` then finds 8791 taken and **silently
  auto-bumps to a random port**, so the agent screenshots a working app while
  the user's pane, still on 8791, shows blank. Both parties are looking at real
  but different things.

  Diagnose before touching the app:

  ```bash
  lsof -nP -iTCP:8791 -sTCP:LISTEN            # who holds the port
  curl -s -o /dev/null -w '%{http_code} %{size_download}\n' http://localhost:8791/index.html
  ```

  `404` plus `0` bytes means a stale squatter. Kill that PID and restart the
  preview so it binds 8791. Note the sandbox cannot kill a process owned by
  another session — run the `kill` in the user's terminal instead.

### House rules

- Semantic tokens only. `--foreground-tertiary` is 3.12:1 — decorative and
  icons only, never on copy.
- **Radius comes from the `primitives` variable export, not from
  `get_design_context`.** The current DS scale is `no-radius 0 · xs 4 · sm 6 ·
  md 10 · lg 16 · xl 28 · 2xl 40 · full 9999`, and `app.css` now matches it.
  The prototype previously ran 2/4/8/12, an older DS revision — every step has
  since moved, so "align the names without changing anything visually" is not
  a thing that can be done here.
  Two traps worth knowing:
  - `get_design_context`'s Tailwind fallbacks are **unreliable** for numeric
    tokens. They gave `radius-md 8` / `radius-xl 24` where the export says 10
    and 28, and the same variable came back with different fallbacks depending
    on which property it landed on. Read numbers from the token export.
  - `../community-care-network/styles/tokens.css` is still on the old scale
    (as `--radius-radius-*`: 2/4/8/16/24/40) and wants regenerating.
- **Elevation lives in `app.css` only.** `--shadow-{xs,sm,md,lg,flyout}` are
  composed box-shadow values and must have exactly one definition site. Figma's
  `color/shadow/*` are *colours* and are emitted as `--color-shadow-*`. These
  two collided once: `tokens.css` defined `--shadow-lg: #000000` under
  `[data-mode]`, same specificity as `app.css`'s `:root`, and only lost because
  it loads first in `build.py`'s `CSS_BLOCKING`. Reordering that list would have
  silently dropped every shadow in the app. Keep the namespaces apart.
- Cards carry elevation, never a border.
- AP title case on UI chrome.
- **All data is fictional**, from the shared synthetic EHR reference dataset
  (`ehr-synthetic-data` skill, `fixtures/reference-data/`). No real PHI or PII
  anywhere, ever. If a task seems to need real client data, stop and confirm a
  validated business need first.
- The field labels in the discharge form were taken structurally from a demo-
  tenant export of the live AxiomEHR page — labels, order, control types and
  required markers only. **No value, name or ID from that export is in this
  repo**, and it must stay that way.
