# AxiomEHR — Discharge Plan interaction prototype

An interaction-design prototype for two problems raised on the LA County site
visit. Built on the Radicle Health Design System, using the same tokens,
components and chrome as the existing `axiom-ehr-prototype`.

**Double-click `AxiomEHR-Discharge-Plan.html`.** One file, ~4.9 MB, nothing else
needed — no server, no Node, no internet, any browser. Styles, fonts, icons,
reference data, React and Babel are all inlined.

`index.html` is byte-identical; it just keeps the conventional name for the dev
server. Either one works on its own, anywhere. Both are generated — edit the
sources and re-run `python3 tools/build.py`.

### If the page is blank

Check in this order — in practice it has always been the first one.

1. **Are you looking at a dev-server URL?** A `http://localhost:…` tab only
   works while `tools/serve.py` is running, and the Claude Browser pane's
   server is stopped between sessions. A dead port renders as a blank page with
   no error. Open the file from Finder instead; it needs no server.
2. **Give it a second.** The splash (product name and a moving bar) appears in
   well under a tenth of a second. If you see the splash, it is working —
   Babel is compiling the app behind it.
3. **Check the file size.** It should be about 4.9 MB. Email and chat clients
   sometimes clip large attachments; a truncated copy says so on screen.

---

## The two problems it answers

### 1 · The application is tethered to a client record

Today AxiomEHR is always inside somebody's chart. You land in one, the chart can
change under you, and it is easy to document against the wrong client.

What this prototype does instead:

| | Behaviour |
| --- | --- |
| **Empty by default** | Home, Clients, Reports, Billing and Admin carry no client. The client banner is simply absent, and a callout says so. |
| **Deliberate entry** | A client enters context only when you open a chart or pick one in the top-bar switcher. |
| **Always visible** | While a client is in context a persistent banner sits under the top bar with name, MRN, DOB, pronouns, flags and care team. Off-chart it switches to a dashed "carried in context — you are not in this chart" state. |
| **Switching is intercepted** | Changing client shows both charts side by side — who you are leaving, who you are moving to — before anything changes. |
| **Leaving is intercepted** | Navigating to a non-client page asks whether to carry the client along or clear the context. |
| **Unsaved work is intercepted** | Changing note, changing client, leaving the chart or signing out with unsaved edits names the note and the client it belongs to. |
| **Sessions do not leak** | Signing out clears context. Signing back in starts empty, every time — the prior client is never restored. |

Every one of these goes through a single guard (`src/20-context.jsx`). No screen
navigates directly; that is what makes the rule impossible to forget.

### 2 · Discharge assumes every diagnosis is resolved

Enrollment status and clinical status are different facts. A client can complete
a residential episode with an alcohol use disorder that is still active. Today
the product collapses the two.

Saving the Discharge Plan goes straight to the discharge summary. The summary
prints every diagnosis and problem-list item with an **active** status (Active,
In Remission, Provisional); Resolved and Inactive items are left off. There is
no selection step — an earlier version let the clinician pick items, but the
customer confirmed that flexibility isn't needed.

- Saving renders the summary as a paginated PDF-style document in the overlay,
  with a footnote recording that statuses are as of the chart on that date and
  were not changed by the discharge.
- After filing, the chart still shows the same statuses. Nothing was resolved.

The note's primary action is **Save as Complete** or **Pend to Manager**
depending on agency configuration; the prototype bar at the top of the note
flips between the two so both paths can be demonstrated.

---

## Walkthrough (about three minutes)

1. **Home.** No client banner. The callout explains why.
2. **Documentation Due → Discharge Plan (due today) → Open.** Dee Carter's chart
   loads; the banner appears and names him.
3. **Prefill demo answers** in the prototype bar fills the note.
4. **Save as Complete.** The summary opens directly. Four of five diagnoses
   and four of six problems print; the resolved cannabis use disorder and the
   two resolved problems do not.
5. **File to chart**.
6. Scroll to the note's **Diagnosis** section: every status is unchanged.
7. Now try the navigation rules — switch client from the top-bar chip, navigate
   to Reports, edit a field and change note tabs, or sign out and back in.

To demo the manager-approval variant, flip **Agency configuration** in the
prototype bar before step 4.

---

## The form

The fields, labels, required markers, control types and section order are taken
from the live AxiomEHR *Input Clinical Discharge* page: Discharge Summary Type ·
Presenting Condition · Discharge Summary (intake/discharge dates, medication-only,
sites) · Last Counseling or CFT · Last Bed Date · Summary of Treatment (services,
outcome, cultural needs, strengths, recommendations, reason for discharge,
medications at discharge, disposition, goals achieved and not achieved, transition
plan, resources offered) · Diagnosis · Persons assisting with transition ·
Signatures (Patient, Completing Staff, BHT, BHP) · Complete.

Two things are deliberately different from the product:

- The **Diagnosis** table shows the chart's live diagnoses with their status
  instead of "No data", and states inline that discharge will not change them.
- The date fields keep the product's *Today / 7 / 30* quick-set affordance.

---

## Data — all of it fictional

Every client, staff member, MRN, address, medication and note in this prototype
comes from the shared synthetic EHR reference dataset
(`fixtures/reference-data/`, the `ehr-synthetic-data` skill). **There is no real
PHI or PII anywhere in this repository.** ICD-10-CM and SNOMED CT codes are
public code sets, not client data.

Two tables were added here because the shared seed does not carry them:

| File | Contents |
| --- | --- |
| `client_diagnoses.json` | Per-client diagnosis assignments with type, precedence, onset, resolved date and **status** |
| `client_problems.json` | Per-client problem-list entries with category, onset and **status** |

Both are generated deterministically by `tools/build-clinical-fixtures.py` from
a fixed seed, so every teammate sees the same chart. The demo client
(`CL-100235`) has a hand-pinned diagnosis picture — active SUD and PTSD, one
episode in remission, one genuinely resolved, one provisional — because the
whole point needs a chart where "resolve everything" would be visibly wrong.

If a real business need ever arises to work with actual client data, that is a
separate conversation with a validated business case. Do not extend these
fixtures with anything that is not clearly fictional.

---

## Working on it

```bash
python3 tools/build-clinical-fixtures.py   # regenerate the two per-client tables
python3 tools/build-header-fixtures.py     # meds, immunizations, injections, vitals, assessments, client notes
python3 tools/build-refdata.py             # bundle fixtures -> assets/refdata.js
python3 tools/build.py                     # -> index.html + AxiomEHR-Discharge-Plan.html
python3 tools/serve.py                     # dev server on :8791, sends no-store
```

`tools/build.py` must be run after **any** change under `src/`, `styles/`,
`assets/` or `vendor/`. It inlines everything — CSS, fonts as `data:` URIs,
icons, reference data, React, ReactDOM, Babel and the app source — and writes
the same document to both output names. The app source is concatenated in
filename order into a `<script type="text/plain">` block and transpiled in the
page, which is how the prototype runs with no build toolchain.

**Both outputs are self-contained on purpose.** An earlier version kept a light
`index.html` that loaded siblings, and it failed twice in the field: once as
*Cannot read properties of undefined* when `assets/refdata.js` didn't load, and
once as *Babel is not defined* when `vendor/` was out of reach. Safari refuses
`file://` subresources by default, so even an intact folder is not enough.
There is no such thing as a file that only ever gets opened the intended way —
don't reintroduce a partial build.

**Nothing heavy is render-blocking, and this is load-bearing.** Only
`tokens.css`, `app.css` and `discharge.css` sit in the head. The font faces
(~1.2 MB of base64), React, Babel, the icons and the reference data all ride in
`type="text/plain"` blocks that the parser merely scans, and the bootstrap
evaluates them after yielding. With them in the head or in live `<script>`
tags, first paint was ~890 ms of blank window; now the splash is up at ~70 ms
and the app follows in well under a second (Babel's own parse, plus a 256 ms
transform of the JSX).

The bootstrap starts on **whichever of `requestAnimationFrame` or a 150 ms
timer fires first**. rAF alone is not safe: it does not fire in a background or
throttled tab, and the page then sits on the splash forever in an unfocused
window. Same trap as entry animations owning a resting position — never let a
frame callback be the only path to a correct state.

Use `tools/serve.py` rather than `python3 -m http.server`: the stdlib server
sends no cache headers, so the browser pins `index.html` and edits appear to do
nothing.

**Known limitation.** Editing the URL hash by hand, or using the browser back
button, bypasses the guard — the app's own controls all route through it. The
client banner stays truthful either way (it shows the dashed "carried in
context — you are not in this chart" state), so nothing is misrepresented, but
you won't get an intercept on those two paths.

| File | What lives there |
| --- | --- |
| `src/00-core.jsx` | Theme, router, icons, avatar, buttons, checkbox, radio, dropdown, panel, toast |
| `src/10-data.jsx` | Projections over `window.REFDATA`; status vocabulary |
| `src/20-context.jsx` | Client context, the navigation guard, the intercept overlay |
| `src/30-chrome.jsx` | Top bar, client switcher, persistent banner, left nav, sign-in |
| `src/40-home.jsx` | Home, All Clients, non-client stubs |
| `src/50-discharge.jsx` | Chart page and the Discharge Plan form |
| `src/60-summary.jsx` | The generated discharge summary |
| `src/90-app.jsx` | Routes and mount |
| `vendor/` | React, ReactDOM and Babel, vendored so nothing loads from a CDN |
| `index.html` · `AxiomEHR-Discharge-Plan.html` | Generated output — identical, self-contained, never hand-edited |
| `styles/discharge.css` | Everything new; loads after the shared `app.css` |

House rules carried over from the design system: semantic tokens only,
`--foreground-tertiary` never on copy (it is 3.12:1 — decorative and icons
only), cards carry elevation rather than borders.
