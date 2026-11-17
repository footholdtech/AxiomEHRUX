/* ===== User-interface configuration ==============================
   Two levels of control, deliberately kept apart:

     ADMIN — named client-header presets ("Default Adult", "Default Child",
             "Prescriber"), each assigned to staff roles. Agency-wide, set once.
     USER  — which of those presets I want to use, and whether the header opens
             collapsed. Per person.

   WHY PRESETS RATHER THAN ONE HEADER. A children's-services intake coordinator
   and a prescriber read the same chart for different reasons. BMI and blood
   pressure are noise to the first and the substance of the chart to the second.
   One header cannot serve both. The opposite extreme — every field a per-user
   choice — is worse: nobody's header matches their colleagues', so nobody can
   say "it's in the header" and be understood. A role-assigned preset, which the
   individual may override for themselves, is the middle the product needs.

   ROLE ASSIGNMENT IS EXCLUSIVE. A role belongs to exactly one preset, so
   "which header does a Nurse get?" always has one answer. Assigning a role to a
   preset removes it from whichever preset held it before, visibly.

   PROTOTYPE SCOPE. Everything here is agency configuration, not client data. It
   persists to localStorage so a walkthrough survives a reload. In the product
   this is server-side and gated by security role; this prototype assumes the
   signed-in user can see everything, which real permissions would not allow.
   ================================================================ */

/* ---- The quick-view catalogue -----------------------------------
   Every section that can be promoted into the header's quick-view pills. The
   six the prototype shipped with are the first six; the rest are the ones
   customers working with other populations keep asking for.

   `options` are the per-section configurations. Three kinds:
     bool    a switch
     choice  one of a short list
     fields  any number of a short list (the "which specific IDs" case) */
/* Options most record views share. Whether a view's add button opens a
   dialog in the header is not among them: that's a product decision made for
   client safety, not agency configuration. Every record view adds in the
   header except the instruments marked `addOnPage`, which are too long or
   too clinical for a dialog and open their full page instead. */
const ROWS_OPT = { key: 'rows', kind: 'choice', label: 'Rows to list', choices: ['5', '10', 'All'], def: '5' };

const QUICKVIEW_CATALOG = [
  {
    key: 'general', label: 'General', icon: 'dsPeople',
    blurb: 'Identifiers, funding and housing.',
    /* Name, preferred name, DOB and age render at the top of every header
       unconditionally — see `ClientPageHeader` in 30-chrome.jsx — there is no
       toggle for them anywhere. Listed here, disabled and pre-checked, purely
       so the admin editor doesn't leave that unstated: without this an admin
       could reasonably assume nothing is shown unless it's configured. */
    lockedFields: ['First name & last name', 'Preferred name', 'Date of birth', 'Age'],
    options: [
      { key: 'fields', kind: 'fields', label: 'Identifiers to display',
        /* The second half is the residential episode — what a residential
           header leads with. They read "—" on a chart with no bed. */
        choices: ['Axiom ID', 'CIN', 'Shared Service ID', 'MRN', 'Funding', 'Residence', 'Housing Type', 'Primary Language',
          'Site / Building', 'Unit', 'Room / Bed', 'Roommates', 'Daily Attendance', 'Admit Date', 'Length of Stay', 'Attending', 'Admission Reason', 'Legal Status', 'Expected Discharge', 'Precautions'],
        def: ['Axiom ID', 'CIN', 'Shared Service ID', 'Funding', 'Residence', 'Housing Type'] },
      { key: 'showAttributes', kind: 'bool', label: 'Show client attributes', def: true },
      { key: 'showCareTeam', kind: 'bool', label: 'Show care team', def: true },
    ],
  },
  {
    key: 'enrollment', label: 'Enrollment', icon: 'dsDocCopy',
    blurb: 'Program, site and episode dates.',
    options: [
      { key: 'showClosed', kind: 'bool', label: 'Include closed enrollments', def: false },
      { key: 'showPayor', kind: 'bool', label: 'Show payor and authorisation', def: true },
    ],
  },
  /* "Medical" was one quick view covering allergies, medications and vitals.
     It is split into the views production already has as separate modules —
     so nothing a clinician reaches today is lost when the header ships — and
     each gets its own add-record action and link to its full page. */
  {
    key: 'allergies', label: 'Allergies', icon: 'warn', module: 'Allergy',
    blurb: 'Allergens, reactions and severity.',
    options: [
      { key: 'activeOnly', kind: 'bool', label: 'Active allergies only', def: true },
      ROWS_OPT,
    ],
  },
  {
    key: 'medications', label: 'Medications', icon: 'pill', module: 'Prescription',
    blurb: 'Current, expired and discontinued — refill, discontinue or add.',
    options: [
      { key: 'defaultFilter', kind: 'choice', label: 'Opens on', choices: ['Current', 'Expired', 'Discontinued', 'All'], def: 'Current' },
      { key: 'showPharmacy', kind: 'bool', label: 'Show pharmacy', def: true },
    ],
  },
  {
    key: 'vitals', label: 'Vitals', icon: 'heart', module: 'Vitals',
    blurb: 'Latest reading and recent trend.',
    options: [
      { key: 'count', kind: 'choice', label: 'Readings to list', choices: ['3', '5'], def: '3' },
    ],
  },
  {
    key: 'immunizations', label: 'Immunizations', icon: 'shield', module: 'Immunization',
    blurb: 'Vaccines given, reported and declined.',
    options: [
      { key: 'showDeclined', kind: 'bool', label: 'Include declined', def: true },
      ROWS_OPT,
    ],
  },
  {
    key: 'injections', label: 'Injections', icon: 'dsSyringe', module: 'Injection',
    blurb: 'Long-acting injectables, last given and next due.',
    options: [
      { key: 'count', kind: 'choice', label: 'Doses to list', choices: ['3', '5'], def: '3' },
    ],
  },
  {
    key: 'contact', label: 'Contact Info', icon: 'dsPhone', module: 'Cover Sheet',
    blurb: 'Phones, email, address and the preferred way to reach the client. Kept on the Cover Sheet.',
    options: [
      { key: 'showAddress', kind: 'bool', label: 'Show mailing address', def: true },
      { key: 'showPreferred', kind: 'bool', label: 'Show preferred contact method and language', def: true },
    ],
  },
  {
    key: 'appointments', label: 'Appointments', icon: 'calendar', module: 'Appointments',
    blurb: 'What is next, and what was missed.',
    options: [
      { key: 'defaultFilter', kind: 'choice', label: 'Opens on', choices: ['Upcoming', 'Past'], def: 'Upcoming' },
      { key: 'count', kind: 'choice', label: 'Appointments to list', choices: ['3', '5', '10'], def: '5' },
      { key: 'includeMissed', kind: 'bool', label: 'Include no-shows and cancellations', def: true },
    ],
  },
  {
    /* The golden thread: a note should trace back to the plan's goals, so the
       active plans sit one click from any documentation. */
    key: 'serviceplans', label: 'Service Plans', icon: 'clipboard', module: 'Service Plan',
    blurb: 'Active plans, goal progress against the plan dates, and the full plan to copy from.',
    options: [
      { key: 'defaultFilter', kind: 'choice', label: 'Opens on', choices: ['Active', 'All'], def: 'Active' },
    ],
  },
  {
    key: 'notes', label: 'Clinical Notes', icon: 'documents',
    blurb: 'The most recent documentation on the chart. Adding a note opens the note itself.',
    options: [
      { key: 'count', kind: 'choice', label: 'Notes to list', choices: ['3', '5', '10'], def: '5' },
      { key: 'unsignedFirst', kind: 'bool', label: 'Surface drafts and unsigned notes first', def: true },
    ],
  },
  {
    key: 'diagnoses', label: 'Diagnoses', icon: 'dsWarning', module: 'Diagnosis',
    blurb: 'ICD-10 diagnoses recorded on the chart.',
    options: [
      { key: 'defaultFilter', kind: 'choice', label: 'Opens on', choices: ['Active', 'All'], def: 'Active',
        help: 'Active includes In Remission and Provisional.' },
      { key: 'showCodes', kind: 'bool', label: 'Show ICD-10 codes', def: true },
      { key: 'showSnomed', kind: 'bool', label: 'Show SNOMED codes', def: false },
      ROWS_OPT,
    ],
  },
  {
    key: 'problems', label: 'Problems', icon: 'dsWarning', module: 'Problem List',
    blurb: 'The problem list.',
    options: [
      { key: 'defaultFilter', kind: 'choice', label: 'Opens on', choices: ['Active', 'All'], def: 'Active' },
      { key: 'showCategory', kind: 'bool', label: 'Show category', def: true },
      ROWS_OPT,
    ],
  },
  {
    key: 'support', label: 'Support Contacts', icon: 'dsPeople', module: 'Cover Sheet',
    blurb: 'Natural supports and who may be contacted. Kept on the Cover Sheet.',
    options: [
      { key: 'showRelationship', kind: 'bool', label: 'Show relationship', def: true },
      { key: 'consentOnly', kind: 'bool', label: 'Only contacts with a release on file', def: false },
      { key: 'showCareTeam', kind: 'bool', label: 'Show care team', def: true },
    ],
  },
  {
    key: 'assessments', label: 'Assessments', icon: 'reports',
    blurb: 'Every instrument on the chart: latest score, who gave it, and when it is next due.',
    options: [
      { key: 'showScores', kind: 'bool', label: 'Show scores and interpretation', def: true },
      { key: 'includeDue', kind: 'bool', label: 'Include instruments tracked by due date only',
        help: 'Instruments the agency schedules but whose results aren’t in this chart’s records.', def: true },
      ROWS_OPT,
    ],
  },
  {
    key: 'incidents', label: 'Incidents', icon: 'dsGavel',
    blurb: 'Reportable events in a recent window.',
    options: [
      { key: 'windowDays', kind: 'choice', label: 'Look-back window', choices: ['30 days', '90 days', '12 months'], def: '90 days' },
    ],
  },
  {
    key: 'demographics', label: 'Demographics', icon: 'clients', module: 'Cover Sheet',
    blurb: 'Name, gender, race, ethnicity and language. Kept on the Cover Sheet.',
    options: [
      { key: 'showRaceEthnicity', kind: 'bool', label: 'Show race and ethnicity', def: true },
      { key: 'showLanguage', kind: 'bool', label: 'Show language and interpreter need', def: true },
      /* Off by default: the header is on screen whenever the chart is, often
         where others can see it. */
      { key: 'showSogi', kind: 'bool', label: 'Show gender identity and sexual orientation', def: false,
        help: 'The header is visible to anyone who can open the chart, often on a shared screen.' },
      { key: 'showSocial', kind: 'bool', label: 'Show marital, veteran and employment status', def: false },
      { key: 'customFields', kind: 'fields', label: 'Custom fields', choices: [], def: [] },
    ],
  },
  /* Scored instruments. One pattern for all of them: the latest score, its
     band and date up front; earlier administrations below; any row opens the
     captured answers in an overlay, and New opens the form itself. The full
     instrument is never laid out in the header. PCL-5 (20 items) and AIMS (a
     clinician's examination) always start on the full page (`addOnPage`). */
  { key: 'phq9', label: 'PHQ-9', icon: 'clipboard', module: 'PHQ', form: 'PHQ9', blurb: 'Depression severity.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'pcl5', label: 'PCL-5', icon: 'clipboard', module: 'PCL5', form: 'PCL5', addOnPage: true, blurb: 'PTSD symptom severity.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'pcptsd5', label: 'PC-PTSD-5', icon: 'clipboard', module: 'PC-PTSD', form: 'PCPTSD5', blurb: 'Primary-care PTSD screen.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'ace', label: 'ACE', icon: 'clipboard', module: 'ACE', form: 'ACE', blurb: 'Adverse childhood experiences.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'audit', label: 'AUDIT', icon: 'clipboard', module: 'AUDIT', form: 'AUDIT', blurb: 'Alcohol use risk.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'aims', label: 'AIMS', icon: 'clipboard', module: 'AIMS', form: 'AIMS', addOnPage: true, blurb: 'Involuntary movement scale.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'sdoh', label: 'SDOH', icon: 'clipboard', module: 'SDOH', form: 'SDOH', blurb: 'Social needs screen.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
];
const QV_BY_KEY = Object.fromEntries(QUICKVIEW_CATALOG.map(q => [q.key, q]));
/* No ceiling on how many quick views a header carries. The pill area wraps to
   two rows and pages left/right past that (see `PillPager` in 30-chrome.jsx),
   so an agency can match everything production offers today. */

const qvOptionDefaults = key => {
  const out = {};
  ((QV_BY_KEY[key] || {}).options || []).forEach(o => { out[o.key] = Array.isArray(o.def) ? o.def.slice() : o.def; });
  return out;
};
const makeView = (key, overrides) => ({ key, options: { ...qvOptionDefaults(key), ...(overrides || {}) } });

/* Staff roles come from the shared synthetic fixture set, not from anything
   invented here. */
const STAFF_ROLE_NAMES = (RD.roles || []).map(r => r.name);

/* ---- Quick contact actions ---------------------------------------
   The round icon buttons in the header's action row — which ones show is now
   agency configuration, the same as everything else here. "More Actions" and
   "Chat With Chart" are deliberately not in this catalogue: one is a generic
   overflow control, the other an AI entry point — neither is a contact action,
   and both stay fixed chrome whenever the row itself is on. */
const QUICK_ACTIONS_CATALOG = [
  /* Add Note was on dsUtil1, which is a calendar with a plus — the DS's
     schedule glyph. It moves to Schedule Appointment; Add Note takes
     Fluent's Document Add. */
  { key: 'note', icon: 'uiDocumentAdd', label: 'Add Note' },
  { key: 'call', icon: 'dsUtil2', label: 'Call Client' },
  { key: 'text', icon: 'dsUtil3', label: 'Send Text Message' },
  { key: 'email', icon: 'dsUtil4', label: 'Send Email' },
  { key: 'chat', icon: 'dsUtil5', label: 'Start Chat' },
  { key: 'appointment', icon: 'dsUtil1', label: 'Schedule Appointment' },
];
const QUICK_ACTIONS_BY_KEY = Object.fromEntries(QUICK_ACTIONS_CATALOG.map(a => [a.key, a]));
/* Every quick action is on by default; an admin can remove any per header. */
const DEFAULT_ACTIONS = ['note', 'call', 'text', 'email', 'chat', 'appointment'];

/* ---- Tab sets ------------------------------------------------------
   A tab set is a named, ordered list of chart pages: the tabs a chart shows
   and the one it opens on (the first). Same two levels as headers: an admin
   builds sets and assigns each to roles, and staff can pick a different one,
   or make their own, for themselves.

   CLIENT PAGES ONLY. Production lets a set mix chart pages with agency pages
   (CRM, Dashboard, Revenue Cycle Management). Pressing one of those tabs then
   repaints the whole screen out of the chart, which isn't what a tab does: a
   tab changes the view inside one context and leaves the context alone. So the
   catalogue is the client-specific pages and nothing else. Agency pages stay
   in the left nav and global search, where leaving the chart is expected. */
const TAB_PAGES = [CHART_HOME_TAB].concat(CLIENT_MODULE_NAMES.slice().sort((a, b) => a.localeCompare(b)));
const isTabPage = name => TAB_PAGES.indexOf(name) !== -1;

/* Four sets, one per kind of work, assigned like the headers. Residential /
   Detox goes to no role: unit staff choose it, or an admin assigns it.
   Billing / Revenue Cycle Specialist is deliberately left unassigned, so the
   list page shows the falls-back-to-default case. */
const SEED_TAB_SETS = [
  {
    id: 'ts-clinical', name: 'Clinical', status: 'active',
    description: 'Therapists and social workers: documentation, the plan and the clinical record.',
    roles: ['Social Worker', 'Clinical Provider / Therapist', 'Clinical Director', 'Program Director',
      'QA / Compliance Specialist', 'Executive Director'],
    tabs: [CHART_HOME_TAB, 'Services', 'Progress Note', 'Psychotherapy Progress Note', 'Dynamic Progress Notes', 'Service Plan',
      'Diagnosis', 'Problem List', 'Psychosocial Assessment Note', 'PHQ', 'GAD-7', 'Support & Safety Plan',
      'Appointments', 'Discharge Plan', 'Scanned Documents'],
  },
  {
    id: 'ts-case-mgmt', name: 'Case Management', status: 'active',
    description: 'Case managers, peers, intake and front desk: enrollment, coverage, contacts and coordination.',
    roles: ['Case Manager', 'Peer Support Specialist', 'Housing Supervisor', 'Intake Coordinator',
      'Front Desk / Administrative Assistant'],
    tabs: [CHART_HOME_TAB, 'Services', 'Case Management Note', 'Care Coordination Note', 'Service Plan', 'Appointments',
      'Programs', 'Enrollment History', 'Payor Assignment', 'Patient Assignment', 'Cover Sheet', 'Demographic',
      'Encounter Entry', 'SDOH', 'PRAPARE', 'Informed Consent'],
  },
  {
    id: 'ts-prescriber', name: 'Prescriber', status: 'active',
    description: 'Medical roles: medications, allergies, vitals, labs and the instruments that go with them.',
    roles: ['Primary Care Provider', 'Psychiatric Provider', 'Nurse'],
    tabs: [CHART_HOME_TAB, 'Prescription', 'Allergy', 'Vitals', 'Laboratory', 'Diagnosis', 'Problem List',
      'Psychiatric Evaluation', 'Psych Note', 'Nurse Progress Note', 'AIMS', 'Injection', 'Immunization', 'MAT', 'PHQ'],
  },
  {
    id: 'ts-residential', name: 'Residential / Detox', status: 'active',
    description: 'Unit staff: med pass, withdrawal scales, rounding and the room checks a shift runs.',
    roles: [],
    tabs: [CHART_HOME_TAB, 'eMar', 'Vitals', 'COWS', 'CIWA', 'Flow Sheet', 'Nurse Progress Note', 'BHT Rounding Sheet',
      'Room Check', 'Contraband Check', 'Patient Valuables', 'Residential Check-In', 'Inpatient Note',
      'Restraint And Seclusion'],
  },
];

/* A set saved by an older build, or a page that has since left the
   catalogue, must not put a dead tab in front of anyone. */
function normaliseTabSet(s, keepRoles) {
  const tabs = (Array.isArray(s.tabs) ? s.tabs : []).filter((t, i, all) => isTabPage(t) && all.indexOf(t) === i);
  return {
    id: s.id || 'ts-' + Math.random().toString(36).slice(2, 8),
    name: s.name || 'Untitled Tab Set',
    description: s.description || '',
    status: s.status === 'inactive' ? 'inactive' : 'active',
    roles: keepRoles && Array.isArray(s.roles) ? s.roles.filter(r => STAFF_ROLE_NAMES.indexOf(r) !== -1) : [],
    tabs: tabs.length ? tabs : [CHART_HOME_TAB],
  };
}

/* ---- Seed presets ------------------------------------------------
   Three, because three is enough to show the argument: a general clinical
   header, one tuned for a children's-services population, and one for
   prescribers. Every role is assigned to exactly one of them. */
const SEED_CONFIG = {
  defaultPresetId: 'hp-adult',
  tabSets: SEED_TAB_SETS,
  defaultTabSetId: 'ts-clinical',
  presets: [
    {
      id: 'hp-adult', name: 'Default Adult', status: 'active',
      description: 'General clinical header for adult behavioural health programs.',
      roles: ['Social Worker', 'Clinical Provider / Therapist', 'Case Manager', 'Peer Support Specialist',
        'Housing Supervisor', 'Program Director', 'Clinical Director', 'Executive Director', 'QA / Compliance Specialist'],
      showClinicalStrip: true,
      showActions: true, actions: DEFAULT_ACTIONS.slice(),
      quickViews: [makeView('general'), makeView('enrollment'), makeView('allergies'),
        makeView('medications'), makeView('vitals'), makeView('contact'), makeView('appointments'),
        makeView('serviceplans'), makeView('notes'), makeView('phq9')],
    },
    {
      id: 'hp-child', name: 'Default Child', status: 'active',
      description: 'Children’s services. Vitals are rarely the reason the chart is open, so the medical strip is off and supports come forward.',
      roles: ['Intake Coordinator', 'Front Desk / Administrative Assistant'],
      showClinicalStrip: false,
      showActions: true, actions: DEFAULT_ACTIONS.slice(),
      quickViews: [makeView('general', { fields: ['Axiom ID', 'CIN', 'MRN', 'Primary Language'] }),
        makeView('demographics'), makeView('contact'), makeView('support'),
        makeView('appointments', { count: '3' }), makeView('serviceplans'), makeView('enrollment')],
    },
    {
      id: 'hp-prescriber', name: 'Prescriber', status: 'active',
      description: 'Medical roles. Clinical picture first — meds, diagnoses, problems and scored instruments.',
      roles: ['Primary Care Provider', 'Psychiatric Provider', 'Nurse'],
      showClinicalStrip: true,
      showActions: true, actions: DEFAULT_ACTIONS.concat(['appointment']),
      /* Deliberately long — a prescriber's header is where the pill area has
         to wrap and page, so the seed demonstrates it. */
      quickViews: [makeView('medications'), makeView('allergies'), makeView('vitals'),
        makeView('diagnoses'), makeView('problems'), makeView('injections'), makeView('phq9'),
        makeView('pcl5'), makeView('aims'), makeView('audit'), makeView('assessments'),
        makeView('general', { showCareTeam: false }), makeView('appointments', { count: '3' }), makeView('serviceplans')],
    },
    {
      /* What a residential agency would build for unit staff: the bed and the
         episode first, then what a shift needs — meds, allergies, vitals,
         supports. Assigned to no role, so nobody gets it by default; staff
         choose it in Preferences, or an admin assigns it. */
      id: 'hp-residential', name: 'Residential', status: 'active',
      description: 'Residential and inpatient units. Room, bed, admission and legal status up front, then what a shift needs.',
      roles: [],
      showClinicalStrip: true,
      showActions: true, actions: DEFAULT_ACTIONS.slice(),
      quickViews: [
        makeView('general', { fields: ['Site / Building', 'Unit', 'Room / Bed', 'Roommates', 'Daily Attendance',
          'Length of Stay', 'Attending', 'Legal Status', 'Expected Discharge', 'Precautions'] }),
        makeView('medications'), makeView('allergies'), makeView('vitals'), makeView('support'),
        makeView('notes'), makeView('incidents'), makeView('serviceplans')],
    },
  ],
};

/* v2: the quick-view catalogue changed shape (Medical split, clinical views
   and instruments added). A new key gives every reviewer the new seed headers
   instead of an older saved copy that predates them. */
/* v3: the seeds gained Service Plans — bumped so reviewers see them (earlier
   in-browser header edits reset). */
/* v5: the Residential header joined the seed. v6: its General view gained
   Site / Building, Roommates and Daily Attendance. */
const UI_CONFIG_KEY = 'axiom-ui-config-v6';
const UI_PREFS_KEY = 'axiom-ui-prefs';
/* `tabSet` is 'auto' (whatever my role gets) or a set id, agency or mine.
   `myTabSets` are sets a staff member made for themselves: per person, never
   assigned to a role, invisible to everyone else. */
const DEFAULT_PREFS = { headerPreset: 'auto', collapsedByDefault: true, tabSet: 'auto', myTabSets: [] };
const clone = o => JSON.parse(JSON.stringify(o));

/* A stored config from an older build can be missing keys this one reads.
   Normalising on the way in beats a null check at every use site. */
function normaliseConfig(raw) {
  if (!raw || !Array.isArray(raw.presets) || !raw.presets.length) return clone(SEED_CONFIG);
  const presets = raw.presets.map(p => ({
    id: p.id || 'hp-' + Math.random().toString(36).slice(2, 8),
    name: p.name || 'Untitled Header',
    description: p.description || '',
    /* Inactive is opt-in and explicit ('inactive' exactly) — anything else,
       including a config saved before this field existed, reads as active. */
    status: p.status === 'inactive' ? 'inactive' : 'active',
    roles: Array.isArray(p.roles) ? p.roles.filter(r => STAFF_ROLE_NAMES.indexOf(r) !== -1) : [],
    showClinicalStrip: p.showClinicalStrip !== false,
    showActions: p.showActions !== false,
    actions: Array.isArray(p.actions) ? p.actions.filter(a => QUICK_ACTIONS_BY_KEY[a]) : DEFAULT_ACTIONS.slice(),
    /* "medical" was split into Allergies, Medications and Vitals. A header
       saved with it gets the three in its place, rather than silently losing
       the clinical content it used to show. */
    quickViews: (Array.isArray(p.quickViews) ? p.quickViews : [])
      .flatMap(v => (v && v.key === 'medical' ? ['allergies', 'medications', 'vitals'].map(k => ({ key: k })) : [v]))
      .filter((v, i, all) => v && QV_BY_KEY[v.key] && all.findIndex(x => x && x.key === v.key) === i)
      .map(v => ({ key: v.key, options: { ...qvOptionDefaults(v.key), ...(v.options || {}) } })),
  }));
  presets.forEach(p => { if (!p.quickViews.length) p.quickViews = [makeView('general')]; });
  const defaultPresetId = presets.some(p => p.id === raw.defaultPresetId) ? raw.defaultPresetId : presets[0].id;
  /* Tab sets arrived after headers. A config saved before them keeps its
     headers and gets the seed sets, so nobody's header edits are reset. */
  const tabSets = (Array.isArray(raw.tabSets) && raw.tabSets.length ? raw.tabSets : clone(SEED_TAB_SETS))
    .map(s => normaliseTabSet(s, true));
  const defaultTabSetId = tabSets.some(s => s.id === raw.defaultTabSetId) ? raw.defaultTabSetId : tabSets[0].id;
  return { presets, defaultPresetId, tabSets, defaultTabSetId };
}

const readStored = (key, fallback) => {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r); } catch (e) {}
  return fallback;
};

/* Exactly one preset per role — see the header comment. Only an active
   preset's role assignment counts: a role sitting on a header an admin has
   deliberately switched to inactive (to test it before rolling it out) falls
   back to the default, exactly as if it had never been assigned. */
const presetForRole = (config, roleName) =>
  config.presets.find(p => p.status !== 'inactive' && p.roles.indexOf(roleName) !== -1) ||
  config.presets.find(p => p.id === config.defaultPresetId) ||
  config.presets[0];

/* Same rule as headers: one set per role, only an active set's roles count,
   and anything unassigned falls back to the default. */
const tabSetForRole = (config, roleName) =>
  config.tabSets.find(s => s.status !== 'inactive' && s.roles.indexOf(roleName) !== -1) ||
  config.tabSets.find(s => s.id === config.defaultTabSetId) ||
  config.tabSets[0];

const UIConfigCtx = createContext(null);
const useUIConfig = () => useContext(UIConfigCtx);

function UIConfigProvider({ children }) {
  const [config, setConfigRaw] = useState(() => normaliseConfig(readStored(UI_CONFIG_KEY, null)));
  const [prefs, setPrefsRaw] = useState(() => {
    const p = { ...DEFAULT_PREFS, ...readStored(UI_PREFS_KEY, {}) };
    return { ...p, myTabSets: (Array.isArray(p.myTabSets) ? p.myTabSets : []).map(s => ({ ...normaliseTabSet(s, false), mine: true })) };
  });

  useEffect(() => { try { localStorage.setItem(UI_CONFIG_KEY, JSON.stringify(config)); } catch (e) {} }, [config]);
  useEffect(() => { try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }, [prefs]);

  const setConfig = useCallback(next => setConfigRaw(c => normaliseConfig(typeof next === 'function' ? next(c) : next)), []);
  const setPrefs = useCallback(patch => setPrefsRaw(p => ({ ...p, ...patch })), []);

  const roleAssigned = presetForRole(config, ME.role);
  /* A preset the user picked, but only while it still exists AND is still
     active — deleting a preset in Admin, or an admin switching one back to
     inactive after someone had already chosen it, must not leave anyone
     pointing at something that is no longer meant to be in circulation. */
  const chosen = prefs.headerPreset === 'auto'
    ? roleAssigned
    : (config.presets.find(p => p.id === prefs.headerPreset && p.status !== 'inactive') || roleAssigned);

  /* The tab set in front of me. A set I picked counts only while it still
     exists and is active, the same as a header. My own sets are always
     active: only I can see them. */
  const roleTabSet = tabSetForRole(config, ME.role);
  const agencyTabSets = config.tabSets.filter(s => s.status !== 'inactive');
  const myTabSets = prefs.myTabSets;
  const tabSet = prefs.tabSet === 'auto'
    ? roleTabSet
    : (agencyTabSets.find(s => s.id === prefs.tabSet) || myTabSets.find(s => s.id === prefs.tabSet) || roleTabSet);
  /* Picking my role's own set stores 'auto', so I keep following my role if
     an admin reassigns it later. */
  const chooseTabSet = id => setPrefs({ tabSet: id === roleTabSet.id ? 'auto' : id });
  const saveMyTabSet = set => setPrefsRaw(p => {
    const clean = { ...normaliseTabSet(set, false), mine: true };
    const exists = p.myTabSets.some(s => s.id === clean.id);
    return { ...p, myTabSets: exists ? p.myTabSets.map(s => (s.id === clean.id ? clean : s)) : p.myTabSets.concat([clean]) };
  });
  const deleteMyTabSet = id => setPrefsRaw(p => ({
    ...p, myTabSets: p.myTabSets.filter(s => s.id !== id), tabSet: p.tabSet === id ? 'auto' : p.tabSet,
  }));

  const value = {
    config, setConfig, prefs, setPrefs,
    tabSet, roleTabSet, agencyTabSets, myTabSets, chooseTabSet, saveMyTabSet, deleteMyTabSet,
    tabSetOverridden: tabSet.id !== roleTabSet.id,
    presets: config.presets,
    roleAssigned,
    header: chosen,
    /* True when the user is looking at something other than what their role
       was given. Worth saying out loud in Preferences. */
    overridden: chosen.id !== roleAssigned.id,
    resetConfig: () => setConfigRaw(clone(SEED_CONFIG)),
  };
  return <UIConfigCtx.Provider value={value}>{children}</UIConfigCtx.Provider>;
}
