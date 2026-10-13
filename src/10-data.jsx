/* ===== Data layer ===============================================
   Every record below is a projection of window.REFDATA — the shared, 100%
   FICTIONAL synthetic EHR reference dataset (fixtures/reference-data). There is
   no real client, staff member, MRN, address or encounter anywhere in this
   prototype. ICD-10-CM / SNOMED codes are public code sets, not client data.
   ================================================================ */
const RD = window.REFDATA || {};

/* Safety net. The bootstrap already refuses to run without reference data, so
   reaching this means the build itself changed shape. Bail with something
   readable rather than a bare "Cannot read properties of undefined" thrown
   from whichever lookup happens to come first. */
if (!RD.staff || !RD.staff.length || !RD.clients || !RD.clients.length) {
  document.getElementById('root').innerHTML =
    '<div style="max-width:620px;margin:12vh auto;font:14px/1.6 system-ui,sans-serif;color:#36435c">' +
    '<h1 style="font-size:20px;margin:0 0 8px">Reference data did not load</h1>' +
    '<p>There are no clients or staff to render. Re-run <code>python3 tools/build.py</code>.</p></div>';
  window.__AXIOM_FATAL = true;   // tells the bootstrap not to overwrite this
  throw new Error('REFDATA missing or empty');
}

const _ix = (a, k) => Object.fromEntries((a || []).map(o => [o[k], o]));
const SITE = _ix(RD.sites, 'site_id'), PRG = _ix(RD.programs, 'program_id'), ROLE = _ix(RD.roles, 'role_id'),
      STAFF = _ix(RD.staff, 'staff_id'), RAWCLIENT = _ix(RD.clients, 'client_id');
/* funding.json is an object — {_meta, funding_types, providers} — not a record
   list, so build-refdata ships it whole. This read used to be `RD.funding || []`
   and then tested `FUND.length`, which is `undefined` on an object: every
   client's Funding silently resolved to "—". */
const FUND = (RD.funding && RD.funding.funding_types) || [];
const PAYOR_PROVIDER = _ix((RD.funding && RD.funding.providers) || [], 'provider_id');

/* "Today" is pinned so the prototype tells the same story every time it opens. */
const TODAY = new Date('2026-09-22T00:00:00');

const seed = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (arr, key, n) => {
  const out = [], used = new Set();
  if (!arr || !arr.length) return out;
  let x = seed(key) || 1; const m = Math.min(n, arr.length);
  while (out.length < m) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; const i = x % arr.length; if (!used.has(i)) { used.add(i); out.push(arr[i]); } }
  return out;
};
const _parse = iso => { if (!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const _fmtD = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const fmtDate = v => { if (!v) return '—'; if (v instanceof Date) return isNaN(v) ? '—' : _fmtD(v); const d = _parse(v); return (d && !isNaN(d)) ? _fmtD(d) : (v || '—'); };
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ageOf = dob => { const d = _parse(dob); if (!d) return ''; let a = TODAY.getFullYear() - d.getFullYear(); const m = TODAY.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && TODAY.getDate() < d.getDate())) a--; return a; };
const cName = c => c ? `${c.first_name} ${c.last_name}` : '—';
const sName = id => { const s = STAFF[id]; return s ? `${s.first_name} ${s.last_name}` : '—'; };
const sCred = id => STAFF[id]?.credentials || '';
const prgName = id => PRG[id]?.friendly_name || '—';
const siteName = id => SITE[id]?.name || '—';
const roleName = id => ROLE[id]?.name || '—';
const PRONOUN = { Female: 'She/Her', Male: 'He/Him' };

const _byClient = arr => { const o = {}; (arr || []).forEach(r => { (o[r.client_id] = o[r.client_id] || []).push(r); }); return o; };
const APPT_BY_CLIENT = _byClient(RD.appointments), ALLERGY_BY_CLIENT = _byClient(RD.allergies),
      RX_BY_CLIENT = _byClient(RD.prescriptions), VITAL_BY_CLIENT = _byClient(RD.vitals),
      DX_BY_CLIENT = _byClient(RD.clientDiagnoses), PROB_BY_CLIENT = _byClient(RD.clientProblems);
const _dt = a => { const d = _parse(a.date); const [h, m] = (a.start_time || '00:00').split(':').map(Number); if (d) d.setHours(h || 0, m || 0, 0, 0); return d || new Date(0); };
const lastVisit = cid => { const l = (APPT_BY_CLIENT[cid] || []).filter(a => _dt(a) <= TODAY).sort((x, y) => _dt(y) - _dt(x))[0]; return l ? fmtDate(l.date) : '—'; };
const nextAppt = cid => { const n = (APPT_BY_CLIENT[cid] || []).filter(a => _dt(a) > TODAY).sort((x, y) => _dt(x) - _dt(y))[0]; return n ? fmtDate(n.date) : '—'; };

/* Diagnosis + problem statuses. "Active" here means active ON THE CHART, which
   is a clinical judgement — it is NOT derived from enrollment, and discharging
   a client must never change it. That separation is the point of this build. */
const DX_ACTIVE_STATUSES = ['Active', 'In Remission', 'Provisional'];
const isActiveStatus = s => DX_ACTIVE_STATUSES.indexOf(s) !== -1;
/* Resolved reads blue, not grey: a resolved diagnosis is a valid, current fact
   about the chart, not a disabled row. Active and In Remission share the green
   tone because they share the thing that matters here — both are active on the
   chart, and both are therefore pre-selected. */
const STATUS_TONE = {
  'Active': 'status-active', 'In Remission': 'status-active', 'Provisional': 'status-amber',
  'Resolved': 'status-info', 'Inactive': 'status-neutral',
};
const PRECEDENCE_ORDER = { Primary: 0, Secondary: 1, Tertiary: 2, Quaternary: 3 };

/* Fictional vocabularies for the identifiers and housing fields the DS client
   page header expects. No real program, plan or facility names. */
const CIN_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const RESIDENCES = ['Holt House', 'Cedar Court', 'Maple Grove Hall', 'Riverton Commons', 'Larkspur Place', 'Bayview Residence'];
const HOUSING_TYPES = ['Intermediate', 'Independent', 'Supportive', 'Transitional', 'Board and Care'];

const CLIENTS = (RD.clients || []).map(c => {
  const dx = (DX_BY_CLIENT[c.client_id] || []).slice().sort((a, b) =>
    (PRECEDENCE_ORDER[a.precedence] ?? 9) - (PRECEDENCE_ORDER[b.precedence] ?? 9));
  const probs = (PROB_BY_CLIENT[c.client_id] || []).slice().sort((a, b) =>
    (isActiveStatus(b.status) ? 1 : 0) - (isActiveStatus(a.status) ? 1 : 0));
  const vit = (VITAL_BY_CLIENT[c.client_id] || [])[0] || null;
  return {
    ...c,
    id: c.client_id,
    name: cName(c),
    displayName: c.preferred_name ? `${c.first_name} “${c.preferred_name}” ${c.last_name}` : cName(c),
    shortName: c.preferred_name || c.first_name,
    program: prgName(c.program_ids?.[0]),
    programId: c.program_ids?.[0],
    siteName: siteName(c.site_id),
    age: ageOf(c.dob),
    pronouns: PRONOUN[c.gender] || 'They/Them',
    lastVisit: lastVisit(c.client_id),
    nextAppt: nextAppt(c.client_id),
    funding: FUND.length ? FUND[seed(c.client_id) % FUND.length].name : '—',
    attrs: pick(RD.attributes, c.client_id + 'a', 1 + seed(c.client_id) % 3),
    diagnoses: dx,
    problems: probs,
    allergies: ALLERGY_BY_CLIENT[c.client_id] || [],
    rx: RX_BY_CLIENT[c.client_id] || [],
    vitals: vit,
    vitalsAll: VITAL_BY_CLIENT[c.client_id] || [],
    /* The DS client page header (8139:96518) surfaces identifiers and housing
       that the shared synthetic fixture set does not carry. Derived from
       client_id so they are stable across reloads and consistent between
       screens — and, like everything else here, entirely fictional. */
    axiomId: String(5000000 + (seed(c.client_id + 'ax') % 999999)),
    cin: 'B' + String(10 + seed(c.client_id + 'cin') % 89) + CIN_ALPHA[seed(c.client_id + 'c1') % CIN_ALPHA.length] + CIN_ALPHA[seed(c.client_id + 'c2') % CIN_ALPHA.length] + (seed(c.client_id + 'c3') % 90 + 10),
    sharedServiceId: '*' + String(1000 + seed(c.client_id + 'ss') % 8999) + CIN_ALPHA[seed(c.client_id + 's1') % CIN_ALPHA.length] + CIN_ALPHA[seed(c.client_id + 's2') % CIN_ALPHA.length] + CIN_ALPHA[seed(c.client_id + 's3') % CIN_ALPHA.length],
    residence: RESIDENCES[seed(c.client_id + 'res') % RESIDENCES.length],
    housingType: HOUSING_TYPES[seed(c.client_id + 'ht') % HOUSING_TYPES.length],
  };
});
const CLIENT_BY_ID = _ix(CLIENTS, 'client_id');
const careTeam = cid => {
  const c = CLIENT_BY_ID[cid];
  const same = (RD.staff || []).filter(s => s.site_id === c?.site_id);
  const pool = same.length >= 3 ? same : (RD.staff || []);
  return pick(pool, cid + 'ct', 3).map(s => ({ id: s.staff_id, name: sName(s.staff_id), role: roleName(s.role_id), credentials: s.credentials }));
};

/* The signed-in clinician. Fictional, drawn from the same synthetic staff seed. */
const ME = (() => { const s = STAFF['ST-2003']; return { id: s.staff_id, name: sName(s.staff_id), credentials: s.credentials, role: roleName(s.role_id), site: siteName(s.site_id) }; })();
const AGENCY = { name: 'Horizon Wellness', product: 'AxiomEHR' };

/* The client this walkthrough is built around: residential, discharging today,
   with a deliberately mixed diagnosis picture (active SUD + PTSD, one episode
   in remission, one genuinely resolved, one provisional). */
const DEMO_CLIENT_ID = 'CL-100235';

/* My caseload — the Home screen list. No client is in context on Home; this is
   how a clinician deliberately picks one. */
const MY_CASELOAD = CLIENTS.filter(c => c.status === 'Active').slice(0, 8);

/* Caseload scoping. A client-specific module opened with no client in context
   shows a picker, and that picker is pre-filtered to these two groups — a
   clinician should not be searching the whole agency to open a vitals form.
   Direct = this clinician is the assigned lead. Indirect = covered but not
   led (shared program, same site, or a chart they have been granted). */
const CASELOAD = {
  direct: MY_CASELOAD,
  indirect: CLIENTS.filter(c => MY_CASELOAD.indexOf(c) === -1),
};
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Modules that only make sense inside a chart. Anything here, opened with no
   client in context, must land on the picker — never on somebody's chart. */
const CLIENT_MODULE_NAMES = [
  'ACE', 'AIMS', 'Allergy', 'Appointments', 'ASAM', 'AUDIT', 'CALOCUS', 'CINA', 'CIWA',
  'Closure', 'COT - Court Ordered Treatment', 'Cover Sheet', 'COWS',
  'Crisis Intervention Relapse Plan', 'Crisis Prevention Plan', 'CYBHI', 'Demographic',
  'Detailed Columbia - Suicide Severity Rating Scale', 'Diagnosis', 'Discharge Plan',
  'Dynamic Progress Notes', 'Dynamic Service Plan', 'eMar', 'Encounter Entry', 'Engagement',
  'Enrollment History', 'Flow Sheet', 'GAD-7', 'Group Note', 'Health Information',
  'Immunization', 'Informed Consent', 'Injection', 'Inpatient Note', 'Laboratory', 'LOCUS',
  'MAT', 'Nurse Progress Note', 'Patient Assignment', 'Payor Assignment', 'PC-PTSD', 'PCL5',
  'PHQ', 'PRAPARE', 'Prescription', 'Problem List', 'Programs', 'Progress Note', 'Psych Note',
  'Psychiatric Evaluation', 'Psychosocial Assessment Note', 'Psychotherapy Progress Note',
  'Scanned Documents', 'SDOH', 'Service Plan', 'Suicide Risk Screening',
  'Support & Safety Plan', 'Vitals', 'WHO - Assist', 'WRAP Meeting',
  /* Agency note templates. In production these are configured per agency,
     program and role, so the app can't guess which one a clinician needs —
     see START_NOTE_TYPES and the "Start Note" chooser. */
  'CANS', 'Case Management Note', 'Care Coordination Note', 'Crisis Follow-Up Note', 'Engagement Session Note',
  'Hospital Discharge Follow-Up', 'Peer Support Note', 'Residential Check-In', 'Therapy Note',
];
const CLIENT_MODULES = Object.fromEntries(CLIENT_MODULE_NAMES.map(n => [slugify(n), n]));
const isClientModule = name => CLIENT_MODULE_NAMES.indexOf(name) !== -1;

const SITE_OPTIONS = (RD.sites || []).map(s => s.name);
const DISCHARGE_TYPES = [
  'Successful Completion of Treatment',
  'Completed Treatment — Step-Down to Outpatient',
  'Transferred to Higher Level of Care',
  'Left Against Clinical Advice',
  'Administrative Discharge',
  'Moved Out of Service Area',
  'Lost to Contact / Unable to Locate',
  'Incarcerated',
  'Deceased',
];
const SERVICES_PROVIDED = [
  'Residential Treatment',
  'Individual Therapy',
  'Group Therapy',
  'Family Therapy / CFT',
  'Case Management',
  'Medication Management',
  'Peer Support',
  'Crisis Stabilization',
];
const COMPLETION_STATUSES = ['In Progress', 'Pend to Manager', 'Complete'];
const RESOURCE_OPTIONS = [
  'Community Resources', 'Crisis Number', 'Insurance Provider phone number',
  'Provider phone number to re-enroll', 'Service Plan', 'Warm Line',
];

/* ---- Derived chart documentation --------------------------------
   The fixture set has note *types* but no note records, so the recent-
   documentation list is derived deterministically from the client id. Shared
   rather than duplicated: the Client Summary tab and the client header's
   "Clinical Notes" quick view must not disagree about what is on the chart. */
function clientDocs(cid, count = 6) {
  const cat = ((RD.assessments || {}).instruments) || [];
  const staff = RD.staff || [];
  const noteNames = (RD.noteTypes || []).map(n => n.name || n.note_type || String(n));
  const docPool = noteNames.length ? noteNames : ['Progress Note', 'Service Plan', 'Assessment'];
  return Array.from({ length: count }).map((_, i) => {
    const s = seed(cid + 'doc' + i);
    const isScan = s % 7 === 0;
    const isAssess = !isScan && s % 5 === 0;
    return {
      id: cid + '-d' + i,
      name: isScan ? 'Scanned Document — ' + ['Insurance Card', 'Court Order', 'Prior Records'][s % 3]
        : isAssess ? (cat.length ? cat[s % cat.length].name : 'Assessment')
        : docPool[s % docPool.length],
      kind: isScan ? 'Upload' : isAssess ? 'Assessment' : 'Note',
      by: sName(staff[s % Math.max(1, staff.length)]?.staff_id),
      at: addDays(TODAY, -(i * 3 + (s % 3))),
      status: s % 6 === 0 ? 'Draft' : s % 6 === 1 ? 'Pending co-sign' : 'Signed',
    };
  });
}

/* Support contacts are not in the shared fixture set. Rather than invent new
   people, these are derived from what is already on the chart — family
   carrying the client's own surname. Deterministic, and no new person data.
   The professional side of the chart is the care team, which has its own box;
   listing a care-team member here as well would say the same thing twice. */
const SUPPORT_RELATIONSHIPS = ['Sibling', 'Parent', 'Adult Child', 'Cousin', 'Partner'];
function supportContacts(client) {
  const cid = client.client_id;
  const at = n => CIN_ALPHA[seed(cid + n) % CIN_ALPHA.length];
  const relAt = n => SUPPORT_RELATIONSHIPS[seed(cid + n) % SUPPORT_RELATIONSHIPS.length];
  const out = [{
    name: at('sup') + '. ' + client.last_name, role: relAt('rel'), emergency: true,
    release: seed(cid + 'roi') % 3 !== 0,
  }];
  /* Roughly half of charts carry a second. A list that is always exactly one
     long reads as a placeholder. */
  if (seed(cid + 'sup2') % 2 === 0) {
    const rel2 = relAt('rel2');
    out.push({
      name: at('sup2i') + '. ' + client.last_name,
      role: rel2 === out[0].role ? 'Parent' : rel2,
      emergency: false, release: seed(cid + 'roi2') % 3 !== 0,
    });
  }
  return out;
}
