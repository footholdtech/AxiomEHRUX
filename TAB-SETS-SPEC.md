# Tab sets

A tab set is a named, ordered list of chart pages. It decides which tabs a
chart shows and which tab the chart opens on, which is the first one in the
list. Tab sets work at two levels, the same as client headers: admins build
them and assign them to roles, and staff can choose a different set for
themselves.

Code: `src/53-tabsets.jsx`. The model and seed sets are in
`src/15-uiconfig.jsx`.

## Why the sets contain only client pages

In production a tab set can mix chart pages with agency pages such as CRM,
Dashboard and Revenue Cycle Management. When someone clicks one of those
agency tabs, the whole screen repaints out of the chart. A tab is supposed to
change the view inside one context, not replace the context.

So the only pages that can go in a set are **Client Summary plus every
client-specific module** (`CLIENT_MODULE_NAMES`). Agency pages stay in the
left nav and global search, where people expect to leave the chart.

## Admin: User Interface Options › Tab Sets

- **The list page** shows each set with its tabs, its roles, its status and
  how many people used it in the last 30 days. The usage number is
  illustrative, the same as on the header list. A banner names any roles that
  aren't assigned to a set; those roles fall back to the default set.
- **The edit page** has these controls:
  - Name and description.
  - **Active.** Turning a set inactive moves everyone assigned to it onto the
    default set, and nobody can pick it in Preferences.
  - **Applies to roles.** A role belongs to exactly one set. Claiming a role
    for this set takes it off whichever set held it before; the role picker
    shows the current owner.
  - **Set as Default** and **Delete.** The default set can't be deleted or
    turned inactive.
- **Choosing the tabs.** Two columns, like production's Add New Tabs Set:
  - **Client Pages** lists every client page with a checkbox and a search
    field. Checking a page adds it to the end of the set.
  - **In This Tab Set** is the ordered list. You can reorder it by dragging,
    or with the up and down arrows, which are the keyboard route. Each row has
    a remove button.
  - The first row is labelled "Charts open on this tab". A new set starts
    with Client Summary, which can be moved or removed.
  - A live preview of the chart's tab bar sits above the columns.

## Staff

- **Preferences** has a Tab Set dropdown. The default option is "Use my
  role's tab set (name)". The other options are every active agency set and
  any sets the person has made. Choosing your role's set stores "auto", so
  you keep following your role if an admin later reassigns it.
- **Tabs Set menu in the chart.** You can search sets by name or by the pages
  they contain. The list is split into "Agency tab sets" and "My tab sets",
  each set shows its pages, and your role's set is tagged. Choosing a set
  switches to it straight away and saves the choice, the same as
  Preferences. The menu ends with **Add New Tabs Set**.
- **Edit (pencil).**
  - On an agency set, the pencil reads **Customize**. It opens a copy called
    "My [set name]", because staff can't change what their agency assigned.
  - On one of your own sets, the pencil reads **Edit** and includes Delete.
  - Your own sets are private to you and are never assigned to a role.

## In the chart: the DS `tabs set` component (RDS 4666:71569)

The bar is one row of contained tabs, with More, Edit and Tabs Set at the
right, all sitting on one baseline.

- **The set keeps its order.** The old strip moved whatever you picked from
  More to the front, which changed the order you had learned. Now the tab row
  scrolls instead. You can scroll with:
  - the scroll buttons that appear at an edge when there's more in that
    direction;
  - the mouse wheel or a trackpad;
  - the arrow keys.

  The active tab is always brought into view. The DS overflow guidance names
  scrolling first.
- **More reaches every client page.** It's a searchable list:
  - first, "In this tab set", in the set's order;
  - then "Other client pages", alphabetically.
- **Temporary tabs.** A page outside the set opens as a temporary tab after a
  divider, with a close button. The same happens for pages opened from the
  left nav, a notification or a deep link. Temporary tabs last until you
  close them or open a different client.
  - Closing the tab you're on moves you to the tab next to it.
  - Switching to a set that doesn't contain the current page keeps that page
    as a temporary tab instead of moving you somewhere else.
- **Keyboard behaviour** follows the ARIA tabs pattern with manual
  activation: the arrow keys and Home/End move focus, and Enter or Space
  opens the tab. Opening a tab can trigger the unsaved-work intercept, so it
  should never happen just because focus moved.
- **States.** The active tab has no hover state and uses the default cursor.
  The buttons use the DS secondary button tokens. While a menu is open, its
  button stays in the pressed state.
- **Phones.** Below 540px the tools move onto their own row above the tabs, so
  the tabs keep the full width. The tabs themselves never wrap.
- **Breadcrumb.** The client name in the breadcrumb goes to the chart's first
  tab. If you're already on the first tab, it reloads the page.

## Seed sets

| Set | Roles | Opens on |
| --- | --- | --- |
| Clinical (default) | Social Worker, Therapist, Clinical Director, Program Director, QA, Executive Director | Client Summary |
| Case Management | Case Manager, Peer Support, Housing Supervisor, Intake, Front Desk | Client Summary |
| Prescriber | Primary Care Provider, Psychiatric Provider, Nurse | Client Summary |
| Residential / Detox | none: staff choose it | Client Summary |

Billing / Revenue Cycle Specialist is deliberately left unassigned, so the
list page shows the fallback to the default set.

## Open questions

- Should the Tabs Set button show the name of the current set? The DS label is
  "Tabs Set", and the prototype follows the DS.
- Should temporary tabs survive a reload or a sign-out? In the prototype they
  only last for the current chart visit.
- When an agency changes a set, should staff who made a copy of it be told?
- Production's editor has an "Assign Tabs Set to Role" checkbox for staff.
  The prototype keeps role assignment admin-only.
