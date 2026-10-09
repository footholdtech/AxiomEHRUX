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
        choices: ['Axiom ID', 'CIN', 'Shared Service ID', 'MRN', 'Funding', 'Residence', 'Housing Type', 'Primary Language'],
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
    key: 'contact', label: 'Contact Info', icon: 'dsPhone',
    blurb: 'Email, phone and address.',
    options: [
      { key: 'showAddress', kind: 'bool', label: 'Show mailing address', def: true },
      { key: 'showPreferred', kind: 'bool', label: 'Show preferred contact method and language', def: true },
    ],
  },
  {
    key: 'appointments', label: 'Appointments', icon: 'calendar',
    blurb: 'What is next, and what was missed.',
    options: [
      { key: 'count', kind: 'choice', label: 'Appointments to list', choices: ['3', '5', '10'], def: '5' },
      { key: 'includeMissed', kind: 'bool', label: 'Include no-shows and cancellations', def: true },
    ],
  },
  {
    key: 'notes', label: 'Clinical Notes', icon: 'documents',
    blurb: 'The most recent documentation on the chart.',
    options: [
      { key: 'count', kind: 'choice', label: 'Notes to list', choices: ['3', '5', '10'], def: '5' },
      { key: 'unsignedFirst', kind: 'bool', label: 'Surface drafts and unsigned notes first', def: true },
    ],
  },
  {
    key: 'diagnoses', label: 'Diagnoses', icon: 'dsWarning',
    blurb: 'ICD-10 diagnoses recorded on the chart.',
    options: [
      { key: 'activeOnly', kind: 'bool', label: 'Active statuses only',
        help: 'Active, In Remission and Provisional. Resolved and Inactive are hidden.', def: true },
      { key: 'showCodes', kind: 'bool', label: 'Show ICD-10 codes', def: true },
    ],
  },
  {
    key: 'problems', label: 'Problems', icon: 'dsWarning',
    blurb: 'The problem list.',
    options: [
      { key: 'activeOnly', kind: 'bool', label: 'Active problems only', def: true },
      { key: 'showCategory', kind: 'bool', label: 'Show category', def: true },
    ],
  },
  {
    key: 'support', label: 'Support Contacts', icon: 'dsPeople',
    blurb: 'Natural supports and who may be contacted.',
    options: [
      { key: 'showRelationship', kind: 'bool', label: 'Show relationship', def: true },
      { key: 'consentOnly', kind: 'bool', label: 'Only contacts with a release on file', def: false },
    ],
  },
  {
    key: 'assessments', label: 'Assessments', icon: 'reports',
    blurb: 'Instruments administered and when they are next due.',
    options: [
      { key: 'count', kind: 'choice', label: 'Instruments to list', choices: ['3', '5'], def: '3' },
      { key: 'showScores', kind: 'bool', label: 'Show scores and interpretation', def: true },
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
    key: 'demographics', label: 'Demographics', icon: 'clients',
    blurb: 'Race, ethnicity, language and gender.',
    options: [
      { key: 'showRaceEthnicity', kind: 'bool', label: 'Show race and ethnicity', def: true },
      { key: 'showLanguage', kind: 'bool', label: 'Show language and interpreter need', def: true },
      { key: 'customFields', kind: 'fields', label: 'Custom fields', choices: [], def: [] },
    ],
  },
  /* Scored instruments. One pattern for all of them: the latest score, its
     band and date up front; earlier administrations below; any row opens the
     captured answers in an overlay, and New opens the form itself. The full
     instrument is never laid out in the header. */
  { key: 'phq9', label: 'PHQ-9', icon: 'clipboard', module: 'PHQ', form: 'PHQ9', blurb: 'Depression severity.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'pcl5', label: 'PCL-5', icon: 'clipboard', module: 'PCL5', form: 'PCL5', blurb: 'PTSD symptom severity.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'pcptsd5', label: 'PC-PTSD-5', icon: 'clipboard', module: 'PC-PTSD', form: 'PCPTSD5', blurb: 'Primary-care PTSD screen.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'ace', label: 'ACE', icon: 'clipboard', module: 'ACE', form: 'ACE', blurb: 'Adverse childhood experiences.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'audit', label: 'AUDIT', icon: 'clipboard', module: 'AUDIT', form: 'AUDIT', blurb: 'Alcohol use risk.',
    options: [{ key: 'count', kind: 'choice', label: 'Earlier administrations to list', choices: ['2', '4'], def: '2' }] },
  { key: 'aims', label: 'AIMS', icon: 'clipboard', module: 'AIMS', form: 'AIMS', blurb: 'Involuntary movement scale.',
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
  { key: 'note', icon: 'dsUtil1', label: 'Add Note' },
  { key: 'call', icon: 'dsUtil2', label: 'Call Client' },
  { key: 'text', icon: 'dsUtil3', label: 'Send Text Message' },
  { key: 'email', icon: 'dsUtil4', label: 'Send Email' },
  { key: 'chat', icon: 'dsUtil5', label: 'Start Chat' },
  /* No DS-authored glyph exists for this one yet — it borrows the generic
     Fluent calendar icon rather than inventing a vector, which is why it reads
     at a slightly different weight than the other five in the row. */
  { key: 'appointment', icon: 'calendar', label: 'Schedule Appointment' },
];
const QUICK_ACTIONS_BY_KEY = Object.fromEntries(QUICK_ACTIONS_CATALOG.map(a => [a.key, a]));
/* The five the header shipped with, before "Schedule Appointment" existed —
   the default for any header that predates this option. */
const DEFAULT_ACTIONS = ['note', 'call', 'text', 'email', 'chat'];

/* ---- Seed presets ------------------------------------------------
   Three, because three is enough to show the argument: a general clinical
   header, one tuned for a children's-services population, and one for
   prescribers. Every role is assigned to exactly one of them. */
const SEED_CONFIG = {
  defaultPresetId: 'hp-adult',
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
        makeView('notes'), makeView('phq9')],
    },
    {
      id: 'hp-child', name: 'Default Child', status: 'active',
      description: 'Children’s services. Vitals are rarely the reason the chart is open, so the medical strip is off and supports come forward.',
      roles: ['Intake Coordinator', 'Front Desk / Administrative Assistant'],
      showClinicalStrip: false,
      showActions: true, actions: DEFAULT_ACTIONS.slice(),
      quickViews: [makeView('general', { fields: ['Axiom ID', 'CIN', 'MRN', 'Primary Language'] }),
        makeView('demographics'), makeView('contact'), makeView('support'),
        makeView('appointments', { count: '3' }), makeView('enrollment')],
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
        makeView('general', { showCareTeam: false }), makeView('appointments', { count: '3' })],
    },
  ],
};

/* v2: the quick-view catalogue changed shape (Medical split, clinical views
   and instruments added). A new key gives every reviewer the new seed headers
   instead of an older saved copy that predates them. */
const UI_CONFIG_KEY = 'axiom-ui-config-v2';
const UI_PREFS_KEY = 'axiom-ui-prefs';
const DEFAULT_PREFS = { headerPreset: 'auto', collapsedByDefault: true };
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
  return { presets, defaultPresetId };
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

const UIConfigCtx = createContext(null);
const useUIConfig = () => useContext(UIConfigCtx);

function UIConfigProvider({ children }) {
  const [config, setConfigRaw] = useState(() => normaliseConfig(readStored(UI_CONFIG_KEY, null)));
  const [prefs, setPrefsRaw] = useState(() => ({ ...DEFAULT_PREFS, ...readStored(UI_PREFS_KEY, {}) }));

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

  const value = {
    config, setConfig, prefs, setPrefs,
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
