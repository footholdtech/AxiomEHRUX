# AI Assistant and Chat With Chart — Interaction Spec

The AI add-on. One drawer, two scopes. Code: `src/38-ai-assistant.jsx`; styles under "Header AI assistant" in `styles/discharge.css`.

**Prototype scope:** no model is called. The suggested prompts are answered from the prototype's own (fictional) data, so the answers match the rest of the app. Anything else typed gets a plain "can't answer that in this prototype" reply.

## 1. One drawer, two scopes

The scope depends on **whether a client is in context**, not on which button opened the drawer.

| | **Chat With Chart** | **AI Assistant** |
| --- | --- | --- |
| In scope when | A chart is open (a client is in context) | No client is in context (Home, Reports, Admin…) |
| Opened from | Chat With Chart in the client header, **or** the top-bar AI button | The top-bar AI button |
| Asks about | That one client, and nothing else | My work: my caseload, my calendar, my tasks and notifications |
| Drawer title | Chat With Chart, with the client's name and DOB beneath | AI Assistant |

- **With a chart open, both buttons open the chart's conversation.** The AI adopts the client automatically, and nobody has to pick a scope.
- **Both are the same add-on.** When an agency hasn't bought it, **both buttons are absent**, not disabled, so there's nothing to explain away (`AI_ADDON.enabled`).

## 2. Placement in the top bar

Right side, in order: Notifications · Calendar · Messages (folded into **More** on tablet and phone) · **AI Assistant** · avatar · Radicle logo (desktop only).

- **Next to the avatar:** it's about *me*, the signed-in user, so it sits with the user's own controls.
- **Not folded into More:** it's a differentiator, and one tap from every page, so it stays visible at every width, phone included.

## 3. The button

- **Shape:** a 36px circular icon button with a chat bubble and sparkle (Fluent *Chat Sparkle*, 20px).
- **A deliberate departure from the DS:** a frosted glass disc on the coloured top bar, filled with soft pools of the current theme's colour. It follows any theme and light or dark mode with no extra work.
- **Icon colour:** `--theme-fg-interactive`, the foreground the DS pairs with the top bar's background. It's the same token as the Notifications, Calendar and Messages labels beside it: white on most themes, dark on Yellow, Cyan and Gold. Nothing in the button assumes white.
- **Contrast:** the pools behind the icon use only ramp steps 500 and 600 (and a mix of the two). Those are the steps every theme keeps at 3:1 or better against `--theme-fg-interactive`, the WCAG 1.4.11 minimum for icons. Measured across all 10 themes in light and dark mode, the lowest is 3.33:1 (Default, light), the same as the top bar's own labels. Lighter steps (200–400) fail on most themes, so they aren't used. The frost is a small glint at the top edge and a rim, kept off the icon. The hover motion uses hue-rotate and saturate, which keep luminance, so contrast holds while it moves.
- **At rest:** completely still. No pulse, no shimmer, no attention-seeking. Motion the user didn't ask for is an accessibility problem (WCAG 2.2.2, vestibular sensitivity).
- **On hover, and only on hover:**
  - the three pools drift, grow and blend on different cycles (5.5s, 7s, 9s), and their hue shifts a little either side of the theme;
  - the disc lifts slightly (6%) and gains a soft halo.
- **Hover out:** the motion pauses where it is rather than snapping back.
- **Reduced motion** (`prefers-reduced-motion`): no movement at all, even on hover.
- **Keyboard focus:** a white focus ring and the brighter resting state, without the motion.
- **Open:** while the drawer is open, the button keeps a ring (`aria-expanded="true"`).
- **Accessible name:** "AI Assistant". The tooltip says the same, plus the chart when one is in context ("AI Assistant: Linh's chart"), so it's clear before opening which scope the drawer will have.

## 4. The drawer

- **Frame:** the Notifications flyout's: right side, half the viewport (560–880px) on desktop, full width on tablet and phone, with the same scrim. It enters with a fade and a 24px move (never a full slide).
- **Closing:** Escape, the scrim or ×.
- **Header:** the sparkle mark, the scope's title, **New Conversation** (once there's a conversation) and Close.
- **Chart context strip** (Chat With Chart only): the client's avatar, full name and DOB, with *Answers use this chart only* and **Close Chart**. It stays above the conversation, so whose chart is being discussed is always in view. See section 5.
- **Opening state:**
  - a greeting ("Good morning, Priya.");
  - one sentence of scope: *answers come only from what you can already open, and nothing on a chart changes unless you change it*;
  - three suggested prompts as cards, each with a line saying what it covers:
    - **Prepare me for today:** today's appointments in time order. Under each client, "Before you meet:" lists their high-priority attributes (e.g. Suicidal Ideation), overdue assessments and unread care-team notes. Then tasks due today or overdue, then urgent alerts.
    - **What's scheduled for the week?:** the next seven days, grouped by day: time, client, reason, length, and how many are telehealth.
    - **What tasks do I have outstanding?:** open tasks grouped Overdue / Due this week / Later, each with its client and due date, and a link to Tasks in Notifications.
  - **In Chat With Chart**, the scope line reads *Ask about Linh. Answers come only from this chart, never from anyone else's, and nothing on it changes unless you change it.* Its three prompts use the client's preferred name (or first name if none):
    - **Prepare me for my next session with Linh:**
      - when the session is (or, if none is booked with you, the client's next appointment with anyone);
      - **Since you last met:** documents added since your last attended session, and new assessment scores;
      - **Keep in mind:** high-priority attributes, active diagnoses, the latest scores and unread care-team notes;
      - **Worth raising:** assessments overdue or due within 14 days, which could be done in session.
    - **What are some of the strongest sentiments in my documentation with Linh?:**
      - three themes, each tagged Positive, Concern or Mixed;
      - each theme says how many of your notes it appears in and links to the most recent one;
      - only your own **signed** notes are read: drafts and colleagues' notes are left out, and the answer says so;
      - it ends with *Sentiment is a reading of your wording, not a clinical finding.*
      - It cites notes instead of quoting them.
    - **What documentation is due or due soon for Linh?:**
      - **Overdue** and **Due in the next 30 days**: assessments, the active service plan's review, and open tasks for this client;
      - **Your notes to finish or sign:** your drafts, notes waiting on co-signature, and unfinished notes from alerts.
      - The session prep reads the same due list, so the two answers never disagree.
- **Conversation:**
  - **Questions:** right-aligned bubbles.
  - **Answers:** full width, each labelled **AI-generated · {time}**, ending with what it was **based on** (Calendar, Notifications, client attributes, assessments) and **Copy**.
  - **While it works:** "Looking through your caseload…" (or "Reading Linh's chart…") with three dots. The dots are still with reduced motion.
- **Client names in answers (AI Assistant only) are links:**
  - Opening one closes the drawer and goes through the normal client switch, so unsaved work is intercepted as anywhere else.
  - Clients outside the user's access never appear in answers (break-the-glass charts are excluded until access is granted).
- **Composer:**
  - It is always at the foot of the drawer, with the three prompts as chips above it once a conversation has started.
  - Enter sends and Shift+Enter adds a new line. Send is disabled until there's text.
  - A standing line underneath: *AI can be wrong. Check anything you act on against the chart.*
- **Links in Chat With Chart answers** open that same chart's pages: a document, an assessment, the service plan. They close the drawer and go through the guard, so unsaved work is intercepted. None of them leads to another chart.
- **Memory:**
  - **AI Assistant:** the conversation lasts for the session. Closing and reopening the drawer keeps it. New Conversation clears it, and so does signing out.
  - **Chat With Chart:** the conversation lasts only while that chart is in context. Closing and reopening the drawer on the same chart keeps it. Switching clients, going Home or signing out ends it, so it can never reopen against someone else, or against the same client later out of context.
  - The two are separate: the AI Assistant conversation (which names other clients) is hidden while a chart is open, and comes back on Home.

## 5. Chat With Chart: the chart boundary and navigation

**Rule: while chatting with a chart, the user never sees information from another chart.**

- **Answers:** every answer reads only the client in context. No answer looks anything up across clients, and no link in an answer leads to another chart.
- **Asking about someone else:** a question that names another client is declined before anything else is checked: *While Linh's chart is open, I can only answer about Linh. To ask about someone else, open their chart.* It never says whether that person is a client.
- **Asking about my own work** (schedule, caseload, tasks): declined, pointing to Close Chart.
- **The general conversation:** hidden while a chart is open, because it names other clients.
- **Removing the chart from context** is the only way out of the scope, and it means leaving the chart:
  - **Close Chart** in the context strip goes to Home with no client in context, through the same guard as every other navigation. There's no "unpin" or "ask without this chart" toggle that would let the drawer drop the client while the chart stays on screen.
  - **Nothing unsaved:** the move goes through. The drawer stays open and switches to the AI Assistant scope on Home, with the general conversation as it was.
  - **Unsaved work on the page:** the standard **Unsaved Changes** dialog opens above the drawer (*Stay on Page · Leave Without Saving*). Stay, or Escape, cancels and leaves the drawer and chart as they were. Leave goes Home as above.
  - Leaving the chart any other way (the breadcrumb, the side nav, opening another client) also ends the chart conversation.
- **Switching clients** from anywhere is the guard's normal **Switch Clients?** intercept. The next chart opens with a fresh Chat With Chart conversation.
- **Access rules:** the AI sees only what the user's role and caseload allow. A break-the-glass chart is only in context after its access request has been granted, and that's when Chat With Chart becomes available for it.
- **Admin header preview:** Chat With Chart appears in the preview, but it's inert (the preview client is fictional).
- **Phone:** the header's pinned **Chat** button opens the same drawer at full width. The context strip wraps but stays on screen.

## 6. What it never does

- **Write to the chart:** no notes, no status changes, no orders.
- **Send anything:** no texts, emails or portal messages.
- **Reach beyond the user's own access:** it sees only what the user's role and caseload already allow, including 42 CFR Part 2 and restricted-record rules.
- **Answer without saying so:** every answer is marked AI-generated and says what it's based on.

## 7. Questions for refinement

1. **Name:** "AI Assistant" is a placeholder. Does the product have a name for it?
2. **Retention:** should conversations persist beyond the session (history), and for how long? PHI in AI conversations needs a retention and audit decision.
3. **Feedback:** should answers carry thumbs up / down for AI governance and model review?
4. **Scope switching:** the prototype answers the old hand-off question by making the scope follow the client in context. Open questions:
   - Is Close Chart (leave the chart to leave the scope) acceptable to clinicians, or will they want to ask about their day without leaving a chart?
   - If they do, the safe option is a second, separate drawer, not one drawer that mixes scopes.
5. **Sentiment:** which notes count as "my documentation" (signed only, or co-signed too)? And does sentiment analysis of clinical notes need its own governance and disclosure review?
6. **Chat With Chart retention:** the conversation ends when the chart closes. Should it be saved to the chart, or deliberately never saved?
7. **Write actions:** should answers ever offer actions (e.g. "Start the progress note"), or stay read-only?
8. **Configuration:** per-role availability. Should agencies be able to turn it on for some roles only, as headers are configured per role?
