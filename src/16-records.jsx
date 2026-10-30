/* ===== Clinical records behind the header's quick views =============
   Read access for medications, allergies, vitals, immunizations, injections,
   scored assessments and care-team client notes — the fixture rows from
   tools/build-header-fixtures.py, plus whatever the clinician adds, refills,
   discontinues or marks read during the session.

   PROTOTYPE SCOPE. Session edits live in memory only (a reload starts clean)
   and there is no server. Every write here is something a real build would
   POST; the shapes match the fixture rows so the swap is mechanical.

   A client object can carry its own `records` (the admin preview's fictional
   demo client does) — those win over the fixtures, so a preview never shows a
   real-looking chart under a fake name.
   ================================================================ */

const RECORDS_EVT = 'axiom-records-changed';
const SESSION = {
  added: { allergies: [], vitals: [], immunizations: [], injections: [], admins: [], meds: [], notes: [] },
  medPatch: {},          // med_rx_id -> fields overriding the fixture row
  noteRead: {},          // note_id -> true | false (overrides the fixture's read_by for ME)
  noteDeleted: {},       // note_id -> true (author removed their own note)
};
let _recId = 1;
const newId = prefix => prefix + '-NEW-' + (_recId++);
const touchRecords = () => window.dispatchEvent(new Event(RECORDS_EVT));

/* Re-render on any session write. Returns a counter so callers can key memos. */
function useRecordsVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV(x => x + 1);
    window.addEventListener(RECORDS_EVT, f);
    return () => window.removeEventListener(RECORDS_EVT, f);
  }, []);
  return v;
}

/* ---- Lookups ------------------------------------------------------ */
const FORMULARY = (() => {
  const extra = RD.formularyAdditions || [];
  const sched = Object.fromEntries(extra.map(r => [r.medication_id, r.schedule || null]));
  const full = (RD.medications || []).concat(extra.filter(r => r.name));
  return full.map(m => ({ ...m, schedule: sched[m.medication_id] || null }));
})();
const FORMULARY_BY_ID = _ix(FORMULARY, 'medication_id');
const FORM_BY_ID = _ix(RD.assessmentForms || [], 'form_id');
const PRESCRIBER_IDS = ['ST-2002', 'ST-2001', 'ST-2008'];
/* Pharmacy directory. In production this — plus coverage, copay and EPCS
   capability — comes from Surescripts (directory + real-time prescription
   benefit). Here it is fictional and the "benefit check" is deterministic, so
   the same medication at the same pharmacy always shows the same answer. */
const PHARMACIES = [
  { name: 'Northside Community Pharmacy', kind: 'Retail', where: '1420 N Elm St · 1.2 mi', hours: 'Open until 9 PM', epcs: true },
  { name: 'Riverton Rx', kind: 'Retail', where: '88 River Rd · 3.4 mi', hours: 'Open 24 hours', epcs: true,
    limit: 'Reports limited controlled-substance supply this month' },
  { name: 'Maple Grove Pharmacy', kind: 'Retail', where: '5 Maple Grove Plaza · 6.0 mi', hours: 'Closes 6 PM', epcs: false },
  { name: 'Clinic Dispensary', kind: 'Clinic', where: 'On site', hours: 'Clinic hours', epcs: true },
  { name: 'Lakeshore Mail Order', kind: 'Mail order', where: 'Ships in 3–5 days', hours: '90-day supply', epcs: true, mail: true },
];
const PHARMACY_OPTIONS = PHARMACIES.map(p => p.name);
const PHARMACY_BY_NAME = _ix(PHARMACIES, 'name');
const SURESCRIPTS_NOTE = 'Pharmacy directory, coverage and copays via Surescripts · checked just now';

/* The pharmacy the client fills at most often — their de facto preference. */
function preferredPharmacy(client) {
  const n = {};
  getMeds(client).forEach(m => { if (m.pharmacy) n[m.pharmacy] = (n[m.pharmacy] || 0) + 1; });
  const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
  return top || PHARMACY_OPTIONS[hashStr(client.client_id || '') % 3];
}
/* Can this pharmacy take this prescription at all? */
function pharmacyBlock(ph, med) {
  if (!ph || !med || !med.schedule) return null;
  if (!ph.epcs) return 'Not enabled for EPCS — can’t receive controlled-substance prescriptions';
  if (ph.mail && med.schedule === 'C-II') return 'Mail order doesn’t fill Schedule II';
  return null;
}
/* Mock real-time benefit check: { label, tone }. */
function pharmacyBenefit(ph, med) {
  if (!ph || !med || !med.medication_id) return null;
  if (ph.kind === 'Clinic') return { label: '$0 · dispensed on site', tone: 'good' };
  if (ph.mail) return { label: '$0 copay · 90-day', tone: 'good' };
  const r = hashStr(med.medication_id + ph.name) % 10;
  if (r === 9) return { label: 'Prior auth required', tone: 'warn' };
  return { label: 'Covered · $' + [4, 4, 4, 10, 10, 10, 15, 15, 25][r] + ' copay', tone: null };
}
/* Rich Dropdown options for choosing where one prescription goes. */
function pharmacyOptions(client, med) {
  const pref = preferredPharmacy(client);
  return PHARMACIES.slice().sort((a, b) => (b.name === pref) - (a.name === pref)).map(ph => {
    const block = pharmacyBlock(ph, med), ben = pharmacyBenefit(ph, med);
    const tags = [];
    if (ph.name === pref) tags.push({ label: 'Client’s preferred', tone: 'info' });
    if (ben && !block) tags.push(ben);
    if (ph.epcs) tags.push({ label: 'EPCS' });
    if (ph.limit && med && med.schedule && !block) tags.push({ label: 'Limited supply', tone: 'warn' });
    return { value: ph.name, label: ph.name, sub: ph.kind + ' · ' + ph.where + ' · ' + ph.hours, tags, disabled: !!block, reason: block };
  });
}
const INJECTABLE_OPTIONS = [
  { name: 'Aripiprazole ER (Abilify Maintena)', dose: '400 mg', every: 28 },
  { name: 'Paliperidone palmitate (Invega Sustenna)', dose: '156 mg', every: 28 },
  { name: 'Naltrexone ER (Vivitrol)', dose: '380 mg', every: 28 },
  { name: 'Haloperidol decanoate', dose: '100 mg', every: 28 },
  { name: 'Buprenorphine ER (Sublocade)', dose: '300 mg', every: 28, schedule: 'C-III' },
  { name: 'Cyanocobalamin (Vitamin B12)', dose: '1000 mcg', every: 30 },
];
const VACCINE_OPTIONS = ['Influenza (2025–26)', 'COVID-19 (2025–26)', 'Tdap', 'Hepatitis A', 'Hepatitis B',
  'Pneumococcal (PCV20)', 'HPV', 'Zoster (recombinant)', 'Other'];

const formBand = (form, score) => {
  let label = form.bands[0][1], ix = 0;
  form.bands.forEach(([lo, l], i) => { if (score >= lo) { label = l; ix = i; } });
  return { label, ix, top: ix === form.bands.length - 1 && form.bands.length > 1 };
};
const formMax = form => form.items.length * form.scale[form.scale.length - 1][1];

const byDateDesc = key => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''));
const own = (rows, cid) => (rows || []).filter(r => r.client_id === cid);

/* ---- Getters ------------------------------------------------------ */
function getMeds(client) {
  if (client.records) return client.records.meds || [];
  return own(RD.medHistory, client.client_id).concat(own(SESSION.added.meds, client.client_id))
    .map(r => (SESSION.medPatch[r.med_rx_id] ? { ...r, ...SESSION.medPatch[r.med_rx_id] } : r));
}
function getAllergies(client) {
  return (client.allergies || []).concat(client.records ? [] : own(SESSION.added.allergies, client.client_id));
}
function getVitals(client) {
  if (client.records) return client.records.vitals || [];
  return own(SESSION.added.vitals, client.client_id).concat(own(RD.vitalsHistory, client.client_id))
    .sort(byDateDesc('date_time'));
}
function getImmunizations(client) {
  if (client.records) return client.records.immunizations || [];
  return own(SESSION.added.immunizations, client.client_id).concat(own(RD.immunizations, client.client_id))
    .sort(byDateDesc('date'));
}
function getInjections(client) {
  if (client.records) return client.records.injections || [];
  return own(SESSION.added.injections, client.client_id).concat(own(RD.injections, client.client_id))
    .sort(byDateDesc('date_given'));
}
function getAdmins(client, formId) {
  const rows = client.records ? (client.records.admins || [])
    : own(SESSION.added.admins, client.client_id).concat(own(RD.assessmentAdmins, client.client_id));
  return rows.filter(r => r.form_id === formId).sort(byDateDesc('date'));
}
function getServicePlans(client) {
  const rows = client.records ? (client.records.plans || []) : own(RD.servicePlans, client.client_id);
  return rows.slice().sort((a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1) || byDateDesc('plan_date')(a, b));
}
function getNotes(client) {
  const rows = client.records ? (client.records.notes || [])
    : own(RD.clientNotes, client.client_id).concat(own(SESSION.added.notes, client.client_id));
  return rows.map(n => {
    const o = SESSION.noteRead[n.note_id];
    const deleted = !!SESSION.noteDeleted[n.note_id];
    /* A deleted note can't be unread — there's nothing left to read. */
    return { ...n, deleted, read: deleted || (o === undefined ? (n.read_by || []).indexOf(ME.id) !== -1 : o) };
  }).sort(byDateDesc('timestamp'));
}

/* ---- Writes ------------------------------------------------------- */
function addRecord(kind, row) { SESSION.added[kind] = [row].concat(SESSION.added[kind]); touchRecords(); }
function patchMeds(ids, fn) {
  ids.forEach(id => { const cur = SESSION.medPatch[id] || {}; SESSION.medPatch[id] = { ...cur, ...fn(id) }; });
  /* Session-added meds live in `added`, not the fixture, so patch them in place too. */
  SESSION.added.meds = SESSION.added.meds.map(m => (ids.indexOf(m.med_rx_id) !== -1 ? { ...m, ...SESSION.medPatch[m.med_rx_id] } : m));
  touchRecords();
}
function setNoteRead(noteId, read) { SESSION.noteRead[noteId] = read; touchRecords(); }
/* Read receipts apply only to notes sent with Notify Care Team. A plain note
   lives on the chart without asking anyone to mark it read — so staff can
   protect each other's time, and agencies can make that an internal policy. */
const noteNeedsRead = n => !!n.notify_team && !n.read && !n.deleted;
/* Authors may delete their own notes only. The row stays as a tombstone so the
   conversation around it still makes sense. */
function deleteNote(noteId) { SESSION.noteDeleted[noteId] = true; touchRecords(); }
/* Production's patient-note fields: topic and importance (required), shown in
   the client header (always, for now), plus Notify Care Team — the flag that
   sends it to colleagues' notification centers with a read receipt. */
/* `attr` links the note to an attribute on the chart ({ assignment_id,
   attribute_id }) when it's written from Manage Attributes. Otherwise it's an
   ordinary note: same thread, same header count, same notification. */
function addNote(client, { body, topic, importance, notify, attr }) {
  const note = { note_id: newId('CN'), client_id: client.client_id, author_staff_id: ME.id,
    timestamp: isoOf(TODAY) + 'T' + new Date().toTimeString().slice(0, 5) + ':00', topic, importance: importance || 'Low', show_in_header: true, notify_team: !!notify, body, read_by: [ME.id],
    attribute_assignment_id: attr ? attr.assignment_id : null, attribute_id: attr ? attr.attribute_id : null };
  addRecord('notes', note);
  return note;
}

/* ===== Client attributes ===========================================
   The agency's attribute library and the attributes on each chart.

   - The library is a finite list that administrators manage. Clinicians apply
     attributes from it; they can't invent new ones, because free-text
     attributes can't be reported on. Each entry has a glyph (a Fluent or DS
     icon key) or an uploaded `image`.
   - An assignment is effective from start_date through end_date, inclusive;
     no end_date means open-ended. A future start is "scheduled".
   - Nothing is deleted. Removing an entry made in error sets `removed` and the
     row stays, with its history, for the audit trail.
   Fixtures: tools/build-attribute-fixtures.py. Session rules as above: edits
   live in memory and a reload starts clean.
   ================================================================ */
/* The standard library Radicle ships, and the agency's own list. The agency
   list is admin configuration, so like UI options it persists in this browser
   (localStorage) while chart edits don't. Inactive attributes stay in the list:
   they can't be added to a chart any more, but every chart that has one keeps
   it, with its history. */
const ATTR_CATALOG = RD.attributeCatalog || [];
const ATTR_CFG_KEY = 'axiom-attr-config-v3';   // bump when the fixture list changes
let AGENCY_ATTRS = (() => {
  try { const s = JSON.parse(localStorage.getItem(ATTR_CFG_KEY) || 'null'); if (s && Array.isArray(s.rows)) return s.rows; } catch (e) {}
  return (RD.attributeLibrary || []).slice();
})();
const persistAttrs = () => { try { localStorage.setItem(ATTR_CFG_KEY, JSON.stringify({ rows: AGENCY_ATTRS })); } catch (e) {} touchRecords(); };
const agencyAttrs = () => AGENCY_ATTRS;
const selectableAttrs = () => AGENCY_ATTRS.filter(a => a.status === 'Active');
const attrById = id => AGENCY_ATTRS.find(a => a.attribute_id === id) || null;
function saveAgencyAttr(row) {
  const i = AGENCY_ATTRS.findIndex(a => a.attribute_id === row.attribute_id);
  AGENCY_ATTRS = i === -1 ? AGENCY_ATTRS.concat([row]) : AGENCY_ATTRS.map((a, j) => (j === i ? row : a));
  persistAttrs();
}
/* Turn standard entries on for the agency, with their library defaults. */
function addFromCatalog(entries) {
  AGENCY_ATTRS = AGENCY_ATTRS.concat(entries.map(c => ({ ...c, attribute_id: c.catalog_id.replace('STD-', 'ATTR-'),
    source: 'standard', status: 'Active' })));
  persistAttrs();
}
function resetAgencyAttrs() { AGENCY_ATTRS = (RD.attributeLibrary || []).slice(); try { localStorage.removeItem(ATTR_CFG_KEY); } catch (e) {} touchRecords(); }
/* How many charts have it right now, and how many ever have (for the
   inactive message: "stays on N charts"). */
function attrUsage(id) {
  let now = 0, ever = 0;
  CLIENTS.forEach(c => getAttrAssignments(c).forEach(r => {
    if (r.attribute_id !== id) return;
    ever++; if (attrState(r) === 'active' || attrState(r) === 'scheduled') now++;
  }));
  return { now, ever };
}
const ATTR_FALLBACK = name => ({ attribute_id: null, name, icon: 'dsPeople', category: '' });
SESSION.attrs = {};     // client_id -> the chart's whole assignment list after a save

/* Assignment rows with their library entry attached as `attribute`. The admin
   preview's demo client carries plain names; they read as open-ended. */
function getAttrAssignments(client) {
  if (client.records) return (client.attrs || []).map((a, i) => ({ assignment_id: 'PREVIEW-A' + i, client_id: client.client_id,
    attribute_id: null, attribute: ATTR_FALLBACK(a.name), start_date: null, end_date: null, removed: false, history: [] }));
  const rows = SESSION.attrs[client.client_id] || own(RD.attributeAssignments, client.client_id);
  return rows.map(r => ({ ...r, attribute: attrById(r.attribute_id) || ATTR_FALLBACK(r.attribute_id) }));
}
function saveAttrAssignments(client, rows) {
  SESSION.attrs[client.client_id] = rows.map(({ attribute, ...r }) => r);
  touchRecords();
}
/* active · scheduled · ended · removed */
function attrState(r) {
  if (r.removed) return 'removed';
  const t = isoOf(TODAY);
  if (r.start_date && r.start_date > t) return 'scheduled';
  if (r.end_date && r.end_date < t) return 'ended';
  /* Ended on purpose (End Today): off the chart now, not at midnight. */
  if (r.ended_at && r.end_date && r.end_date <= t) return 'ended';
  return 'active';
}
/* High-priority attributes lead, so they're never the ones that wrap away. */
const activeAttrs = client => getAttrAssignments(client).filter(r => attrState(r) === 'active')
  .sort((a, b) => (b.attribute.priority === 'high') - (a.attribute.priority === 'high'));

/* Library entries the chart itself suggests: an ACTIVE diagnosis whose ICD-10
   code starts with one of the entry's prefixes, or an ACTIVE problem it names.
   Offered, never applied. `rows` is the dialog's draft, so a suggestion
   disappears the moment it's added. */
function attrSuggestions(client, rows) {
  const onChart = new Set(rows.filter(r => ['active', 'scheduled'].indexOf(attrState(r)) !== -1).map(r => r.attribute_id));
  const dx = (client.diagnoses || []).filter(d => d.status === 'Active');
  const pr = (client.problems || []).filter(p => p.status === 'Active');
  const out = [];
  selectableAttrs().forEach(a => {
    if (onChart.has(a.attribute_id)) return;
    const s = a.suggest || {};
    const d = dx.find(x => (s.icd10 || []).some(p => String(x.icd10 || '').indexOf(p) === 0));
    const p = !d && pr.find(x => (s.problems || []).indexOf(x.name) !== -1);
    if (d) out.push({ attr: a, why: 'Active diagnosis: ' + d.icd10 + ' ' + d.description });
    else if (p) out.push({ attr: a, why: 'Active problem: ' + p.name });
  });
  return out;
}

/* Notes written about one attribute on the chart, newest first. */
const getAttrNotes = (client, assignmentId) => getNotes(client).filter(n => n.attribute_assignment_id === assignmentId && !n.deleted);
