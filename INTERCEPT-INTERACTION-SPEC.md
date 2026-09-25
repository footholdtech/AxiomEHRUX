# Intercept Modals — Interaction Design Spec

**Product:** AxiomEHR · **Prototype:** `axiom-discharge-prototype` (Discharge Plan)
**Author of the prototype behaviour:** Lisa Ward, Radicle Health
**Date:** 2026-09-24
**Purpose of this file:** source material for drafting a development user story. It is a
*description of designed behaviour*, not a requirements document — the Open Questions
section at the end marks everything still needing a product decision.

> **How to use this in another session.** Paste or attach this whole file and ask for a
> user story. Everything a story needs is here: the problem, the state model, a complete
> decision table, named walkthrough paths, verbatim copy, and the gaps. Nothing in this
> file should be treated as already agreed — §9 lists what is not.

> **Data note.** Every client name, MRN and ID in this document is fictional prototype
> data. No real PHI or PII appears here or in the prototype.

---

## 1. The two problems these modals exist to solve

Both came out of a customer visit with LA County.

**Problem 1 — the application is tethered to a client record.**
In AxiomEHR today a clinician lands already inside somebody's chart, and the chart they
are in can change underneath them. There is no state that means "no client." The
consequences are a class of error, not a one-off: documentation typed into the wrong
record, a note started for one client and finished for another, a module opened from the
left nav that silently adopts whichever client happened to be in context.

**Problem 2 — discharge is treated as an event that resolves clinical facts.**
Saving a discharge note marks every diagnosis on the chart resolved. Enrollment status
and clinical status are different facts. A client can complete a residential episode with
an alcohol use disorder that is very much still active. One system fact must not silently
write another.

Two different intercepts follow from these, and it is worth keeping them apart in the
story-writing:

| | Intercept A — Navigation | Intercept B — Diagnosis Selection |
| --- | --- | --- |
| Fires on | any navigation, client switch, note switch, sign-out | saving/pending a Discharge Plan |
| Prevents | losing unsaved work; documenting into the wrong chart | discharge silently changing clinical status |
| Failure it blocks | data loss, cross-client contamination | cross-*domain* contamination (enrollment → clinical) |
| Frequency | many times a session | once per discharge note |
| Prototype file | `src/20-context.jsx` → `GuardProvider`, `NavIntercept` | `src/60-summary.jsx` → `DiagnosisSelectionIntercept` |

---

## 2. The state model behind Intercept A

Three pieces of state, held once at the application root. Screens never navigate
directly — every move goes through one function.

| State | Type | Meaning |
| --- | --- | --- |
| `clientId` | client ID or **null** | whose chart is in context. **Starts null** and is null on Home, Reports, Billing, Admin |
| `dirty` | `{ label, clientId }` or **null** | a note holding unsaved edits, and whose chart it belongs to |
| `signedIn` | boolean | sign-out clears context; signing back in starts empty again — context is never restored from a previous session |

Rules that make the model work:

1. **Context starts empty.** A client enters context only when the clinician deliberately
   puts them there — opening a chart, picking from a caseload list, choosing a search
   result.
2. **Non-client pages have no client.** Navigating to Reports clears the client outright.
   There is deliberately **no "keep this client in context" escape hatch** in the modal —
   carrying a client onto an unrelated page is the tethering problem itself.
3. **One entry point.** A single `request()` decides whether a move needs an intercept.
   Adding a new link anywhere in the app inherits the behaviour for free; a link that
   bypasses it is a bug.
4. **A client-specific module opened with no client in context opens a picker,** scoped to
   the clinician's own caseload — it does not adopt a client to have something to render.
5. **Deep-link entry is not a surprise.** Landing on `/chart/:id` with an empty context
   adopts that client without an intercept: the URL already names the chart. Landing there
   with a *different* client in context is a real switch and does intercept.

### Actions that set and clear `dirty`

| Sets dirty | Clears dirty |
| --- | --- |
| Editing any field in the Discharge Plan | **Save Draft** (toast: "Draft Saved · Nothing has been filed to the chart yet.") |
| Bulk prefill of the note | **Reset** on the note |
| | Filing / pending the summary |
| | Committing any intercepted move (the work is discarded) |
| | Opening a different client's chart |

---

## 3. Intercept A — the decision table

This is the whole of the logic. `target` = the client the move would land on (null for a
non-client page). Order matters: the first matching row wins, and **switch outranks
leave and sign-out**.

| # | In a chart? | Unsaved? | Move | Intercept | Variant |
| --- | --- | --- | --- | --- | --- |
| 1 | no | no | anything | **no** | — |
| 2 | no | no | sign out | **no** | — |
| 3 | yes | no | to a non-client page | **no** — client is cleared silently | — |
| 4 | yes | no | to a different client | **yes** | **Switch, clean** |
| 5 | yes | no | sign out | **yes** | **Sign out, clean** |
| 6 | yes | yes | to a different client | **yes** | **Switch, unsaved** |
| 7 | yes | yes | to a non-client page | **yes** | **Leave, unsaved** |
| 8 | yes | yes | to another tab in the *same* chart | **yes** | **Leave, unsaved** |
| 9 | yes | yes | sign out | **yes** | **Sign out, unsaved** |
| 10 | yes | yes | deep link / back button into a different chart | **yes** | **Switch, unsaved** (cancel returns to the chart in context) |

**Row 3 is the deliberate one.** Someone who opened a chart, read it, and headed back to
Home has taken no action worth confirming. Interrupting a read-only exit teaches people
to dismiss the modal without reading it, which is precisely how the *useful* interrupt
gets clicked through. A switch (row 4) still intercepts even when clean, because that one
changes whose record the next thing you type lands in.

**Row 8 is easy to miss.** Moving from the Discharge Plan to another tab of the same chart
unmounts the note and loses the edits, so it must intercept — even though the client has
not changed.

---

## 4. Intercept A — the three UI variants

Per the handling spec agreed with the dev team (Figma artboard `4090:39441`). Structure
is a Design System modal: header with title and a trailing dismiss control (`2086:547`,
dismiss `2048:586`), body, footer with secondary + primary.

### Variant 1 — Switch clients, unsaved work (rows 6, 10)

```
┌──────────────────────────────────────────────────────────── ✕ ┐
│ Unsaved Changes                                                │
├────────────────────────────────────────────────────────────────┤
│ ⚠  You have unsaved changes on this page.                      │
│    Are you sure you want to switch clients?                    │
│                                                                │
│   Leaving                        Switching to                  │
│   (av) DeShawn Carter      →     (av) Maria Gonzalez           │
├────────────────────────────────────────────────────────────────┤
│                        [ Stay on Page ]  [ Switch Without Saving ] │
└────────────────────────────────────────────────────────────────┘
```

### Variant 2 — Switch clients, nothing unsaved (row 4)

```
┌──────────────────────────────────────────────────────────── ✕ ┐
│ Switch Clients?                                                │
├────────────────────────────────────────────────────────────────┤
│ Are you sure you want to switch clients?                       │
│                                                                │
│   Leaving                        Switching to                  │
│   (av) DeShawn Carter      →     (av) Maria Gonzalez           │
├────────────────────────────────────────────────────────────────┤
│                              [ Cancel ]  [ Yes, Switch Clients ] │
└────────────────────────────────────────────────────────────────┘
```

### Variant 3 — Leaving a page, unsaved work (rows 7, 8)

```
┌──────────────────────────────────────────────────────────── ✕ ┐
│ Unsaved Changes                                                │
├────────────────────────────────────────────────────────────────┤
│ ⚠  You have unsaved changes on this page.                      │
│    Are you sure you want to leave this page?                   │
├────────────────────────────────────────────────────────────────┤
│                         [ Stay on Page ]  [ Leave Without Saving ] │
└────────────────────────────────────────────────────────────────┘
```

### Two composition rules that are easy to get wrong

- **The question lives *inside* the warning banner** when there is unsaved work. It is not
  repeated as a separate line above or below it. One question per situation, asked once.
- **The identity pair appears only when a client is actually changing.** Leaving a page is
  not a switch, and showing "Leaving DeShawn Carter → No client" invites the reader to
  think something is being taken from them.

### Copy matrix (verbatim)

| Variant | Title | Body | Secondary | Primary |
| --- | --- | --- | --- | --- |
| Switch, unsaved | Unsaved Changes | ⚠ You have unsaved changes on this page. Are you sure you want to switch clients? | Stay on Page | Switch Without Saving |
| Switch, clean | Switch Clients? | Are you sure you want to switch clients? | Cancel | Yes, Switch Clients |
| Leave, unsaved | Unsaved Changes | ⚠ You have unsaved changes on this page. Are you sure you want to leave this page? | Stay on Page | Leave Without Saving |
| Sign out, unsaved | Unsaved Changes | ⚠ You have unsaved changes on this page. Are you sure you want to sign out? | Stay on Page | Sign Out Without Saving |
| Sign out, clean | Sign Out? | Are you sure you want to sign out? | Cancel | Yes, Sign Out |

The sign-out rows extend the pattern by inference — see §9.

### Interaction and accessibility

- `role="alertdialog"`, `aria-modal="true"`, labelled by the title.
- **Four ways to cancel, all identical and all non-destructive:** the secondary button,
  the ✕, clicking the scrim, and **Escape**. The destructive path is the primary button
  and nothing else.
- Primary is styled as the DS primary button, not a danger button — the action is
  expected and reversible-in-intent, not an error state. (Flagged in §9.)
- On cancel, the clinician stays exactly where they were, with the note untouched. The
  only cancel that moves anything is row 10, where cancelling a back-button switch
  returns the URL to the chart actually in context.
- On confirm, the pending move runs, unsaved edits are discarded, and the client context
  is set to the target (or cleared).

---

## 5. Named walkthrough paths

Ready to be turned into scenarios. Fictional clients: **DeShawn Carter** (CL-100235) and
**Maria Gonzalez** (CL-100234).

### Path A — Client → client, unsaved work, backs out
1. Clinician opens DeShawn Carter's chart and starts the Discharge Plan.
2. Types into "Reason for discharge." Chart header badge changes to **Unsaved changes**.
3. Types "Maria" in global search, picks Maria Gonzalez.
4. **Variant 1** appears, naming both clients.
5. Clicks **Stay on Page**.
6. Still in DeShawn Carter's Discharge Plan. Every keystroke intact. Context unchanged.

### Path B — Client → client, unsaved work, proceeds
Steps 1–4 as above, then **Switch Without Saving**.
Result: Maria Gonzalez's chart opens on **Client Summary** (not the Discharge Plan —
see Path F), context is Maria, DeShawn's unsaved edits are gone, no warning repeats.

### Path C — Client → client, work already saved
1. Clinician fills DeShawn Carter's Discharge Plan and clicks **Save Draft**.
   Toast: "Draft Saved · Nothing has been filed to the chart yet." Dirty flag clears.
2. Opens Maria Gonzalez from the caseload table on Home.
3. **Variant 2** — "Switch Clients?" with the identity pair. No warning banner: there is
   nothing to lose, but the identity change still deserves a beat.
4. Confirms. Maria's chart opens; DeShawn's draft is intact when he is reopened.

### Path D — Client → non-client page, unsaved work
1. Unsaved edits in DeShawn Carter's Discharge Plan.
2. Clicks **Reports** in the left nav.
3. **Variant 3** — no identity pair.
4. Confirms. Reports opens with **no client in context**: no client header, no banner. The
   modal offers no way to carry DeShawn along.

### Path E — Client → non-client page, nothing unsaved
1. Clinician reads DeShawn Carter's chart, changes nothing.
2. Clicks **Reports**.
3. **No modal.** Reports opens, client context is cleared silently.

### Path F — Note → note inside the same chart, unsaved work
1. Unsaved edits in DeShawn Carter's Discharge Plan.
2. Clicks the **Treatment Plan** tab in the same chart.
3. **Variant 3.** Same client, but the note unmounts and the edits are lost.
4. Confirms → Treatment Plan opens, edits discarded.

Related rule, not itself an intercept: **switching clients always resets to Client
Summary.** Carrying the previous tab across would land the clinician in a second client's
Discharge Plan purely because that is where they happened to be standing.

### Path G — Back button / edited URL into a different chart
1. Context is DeShawn Carter, with or without unsaved work.
2. Browser back, or a pasted link, lands on Maria Gonzalez's chart URL.
3. Intercepted as a **switch** (Variant 1 or 2).
4. **Cancel returns the URL to DeShawn's chart** — the address bar must not disagree with
   the header. This is the only cancel with a side effect.

### Path H — Deep link with no client in context
1. Fresh sign-in, or Home. Context is empty.
2. Clinician opens a link to Maria Gonzalez's chart.
3. **No modal.** The URL already names the chart; adopting it surprises no one.

### Path I — Client-specific module with no client in context
1. Context empty. Clinician picks **Discharge Plan** from the left nav.
2. **No modal, and no client is adopted.** A picker opens — "Select a Client to Open
   Discharge Plan" — scoped to the clinician's own caseload, direct and indirect, with a
   search box and a count.
3. Choosing a client opens that chart directly on the Discharge Plan.

This is the same principle as the intercept expressed as an empty state rather than a
dialog: the system never guesses whose record you meant.

### Path J — Sign out with unsaved work
1. Unsaved edits in DeShawn Carter's Discharge Plan.
2. Account menu → **Sign out**.
3. Title "Unsaved Changes", question "Are you sure you want to sign out?", primary
   **Sign Out Without Saving**.
4. Confirms → signed out, context cleared, unsaved work gone. The sign-in screen states
   plainly: "You have been signed out. Client context was cleared." Signing back in lands
   on Home with **no client**.

### Path K — Sign out with no client and nothing unsaved
No modal. Signing out of Home is not an event.

---

## 6. Intercept B — Diagnosis Selection at discharge

Fires once, when the clinician presses **Save as Complete** (or **Pend to Manager**, per
agency configuration) on a valid Discharge Plan. Required-field validation runs first; a
note with gaps gets a toast and a scroll to the first error instead.

It stops and asks exactly one question — *which diagnoses and problems belong on the
printed summary* — and states in the same breath that the answer changes the document and
nothing else.

**Anatomy**

- **Title:** "Which diagnoses and problems appear on the discharge summary?"
- **Sub-line:** avatar · client name · MRN · DOB (age) — you are always told whose record
  this is.
- **Info banner** (system/info blue, not the theme's interactive colour — it is
  informational, not actionable):
  > **Discharging DeShawn does not resolve anything on this chart.** Every status below
  > stays exactly as it is. Diagnosis and problem status is clinical and is changed only
  > in the Diagnosis and Problem List modules. Your choices here decide what prints on the
  > summary document — nothing else.
- **Tabs** — "Diagnoses (n)" / "Problems (n)". The count is *everything on the chart*,
  resolved items included: it is a size cue, not a clinical statement. Tabbed rather than
  stacked because both lists run long.
- **Selectable table** per tab — select-all with indeterminate state, "n of m selected",
  whole-row click target, and a **"Status on chart"** column carrying the real status
  (with the resolved date where there is one) so exclusion and resolution are visibly
  different things.
- **Pre-selection rule:** everything with an *active* status is checked; Resolved and
  Inactive are not. Fully overridable in both directions — this is a document-contents
  decision, not a clinical one.
- **Contextual alerts**, at most one at a time:
  - Primary diagnosis excluded → warning: "**The primary diagnosis is excluded.** {code} —
    {description} is the primary diagnosis on this chart. Most payors require it on a
    discharge summary." *Warns, does not block.*
  - Otherwise, active items excluded → info: "n items with an active status are excluded
    from the summary. They stay active on the chart."
- **Footer:** "Reset to Chart Defaults" · "n items will print — next: review the summary,
  then save as complete" · **Back to Note** · **Generate Summary** (disabled at zero
  selected).

**What follows:** a full-page summary preview — the actual document, not a confirmation
screen — with Back to Selection, Print, and File to Chart / Pend to Manager. The Diagnoses
section of the document is headed "status as recorded on the chart {date} — unchanged by
this discharge". Filing raises a toast that repeats the guarantee: "n items included on
the summary. **No diagnosis or problem status was changed.**"

The same sentence therefore appears at four moments: before the choice, during it, on the
printed document, and after filing. That repetition is the design, not redundancy — it is
the single belief the feature has to overturn.

---

## 7. What is deliberately *not* here

Worth stating in the story so it does not get re-added as a "missing" feature.

- **No "keep this client in context" option** when leaving a chart. That is the tethering
  problem.
- **No auto-save** on navigation. The modal offers Stay or Discard; it does not silently
  save a partial clinical note. A partially-complete note filed to a chart is a worse
  outcome than lost keystrokes.
- **No intercept on a clean exit** from a chart (row 3). Interrupting harmless moves is
  what trains people to click through the harmful ones.
- **No danger styling** on the confirm button. The action is expected, not an error.
- **No blocking** in Intercept B. Excluding the primary diagnosis is warned about and
  permitted; the clinician may have a reason.

---

## 8. Reference points

| Thing | Where |
| --- | --- |
| Navigation guard, decision logic, `NavIntercept` | `src/20-context.jsx` |
| Diagnosis selection modal, summary document | `src/60-summary.jsx` |
| Discharge Plan, dirty marking, save/draft/reset | `src/50-discharge.jsx` |
| Chart tabs, deep-link adoption, tab reset on switch | `src/50-discharge.jsx` → `ChartPage` |
| Global search, left nav, sign-out, client header | `src/30-chrome.jsx` |
| Caseload picker for client modules with no context | `src/40-home.jsx` → `ModulePage` |

Figma nodes cited in the prototype source (verify before quoting in a ticket): handling
spec `4090:39441`; Leave Without Saving `4423:86972`; DS modal header `2086:547`; DS modal
dismiss `2048:586`; client page header `4433:94068`.

---

## 9. Open questions for the story

Things the prototype answers by inference or by simplification, and that a real
implementation has to settle.

1. **Sign-out copy was never in the three-variant spec.** The two sign-out rows in §4
   extend the pattern by analogy. Confirm the wording, and whether sign-out with unsaved
   work deserves a stronger treatment than a client switch.
2. **The modal never names *which* note is unsaved.** Copy says "on this page," which is
   true today because only one note can be dirty at a time. The prototype already tracks a
   label and an owning client on the dirty flag but shows neither. The moment two notes can
   hold edits at once, "this page" is wrong.
3. **Multiple dirty notes, and cross-client dirty state.** What happens when a clinician
   has unsaved work in one client's note and lands in another chart by deep link? The
   prototype cannot reach that state; production probably can.
4. **Timeouts and session expiry.** Unsaved work at an idle logout is out of scope here and
   needs its own answer. It is the most likely real-world cause of loss.
5. **Browser-level navigation** — closing the tab, refreshing, the OS back gesture. These
   need `beforeunload`, which cannot carry custom copy. Decide whether the browser's
   generic prompt is acceptable or whether the app should autosave a recoverable draft.
6. **Does confirming a switch discard, or park, the unsaved note?** The prototype discards.
   A recoverable draft is friendlier and materially more complex, and changes the copy.
7. **Row 3 needs validation with clinicians.** "Read-only exit clears context silently" is
   a considered call, not a tested one. Worth a usability check: do people notice the
   client header disappearing?
8. **Confirm-button styling** — DS primary vs. a destructive variant, for the three
   "Without Saving" actions.
9. **Audit.** Does discarding unsaved clinical documentation need an audit entry? Does
   excluding an active diagnosis from a discharge summary? Both are plausible
   audit-relevant events and neither is logged in the prototype.
10. **Empty-state treatment of the caseload picker (Path I)** is DS-token scaffolding,
    pending a real artboard.
