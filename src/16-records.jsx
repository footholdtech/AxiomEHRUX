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
/* Authors may delete their own notes only. The row stays as a tombstone so the
   conversation around it still makes sense. */
function deleteNote(noteId) { SESSION.noteDeleted[noteId] = true; touchRecords(); }
function addNote(client, body, important) {
  addRecord('notes', { note_id: newId('CN'), client_id: client.client_id, author_staff_id: ME.id,
    timestamp: isoOf(TODAY) + 'T' + new Date().toTimeString().slice(0, 5) + ':00', subject: '', body, important: !!important, read_by: [ME.id] });
}
