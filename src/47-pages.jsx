/* ===== Wayfinding: section pages, Documents, and record pages ======
   So no breadcrumb or nav item dead-ends:

   - A section crumb (Reports, Billing, Admin) opens that section's page: its
     children in the same order as the left nav. Documents opens the document
     search instead, because a list of every documents link isn't useful.
   - Every module and page has a body: a table of its records and a way to add
     one. Adding happens in a form ON the page, not in a dialog, so the
     prototype shows the whole loop: the page goes dirty, the breadcrumb and
     nav intercept, saving or cancelling makes it clean again.
   - Client modules render inside the chart (client-specific); everything else
     is client-agnostic and never adopts a client.

   Records added here live in the same session store as the rest of the
   prototype (16-records.jsx), so an allergy added on the Allergy page shows in
   the client header straight away. A reload starts clean.
   ================================================================ */

/* ---- Session rows for pages that have no store of their own ------ */
const PAGE_ROWS = {};
const pageKey = (scope, page) => scope + '|' + page;
function addPageRow(scope, page, row) {
  const k = pageKey(scope, page);
  PAGE_ROWS[k] = [row].concat(PAGE_ROWS[k] || []);
  touchRecords();
}
const pageRows = (scope, page) => PAGE_ROWS[pageKey(scope, page)] || [];
const nowIso = () => isoOf(TODAY) + 'T' + new Date().toTimeString().slice(0, 5);
const staffOptions = () => (RD.staff || []).map(s => sName(s.staff_id));
const staffIdByName = n => ((RD.staff || []).find(s => sName(s.staff_id) === n) || {}).staff_id || null;

/* Placeholder rows for pages the fixtures don't cover. Deterministic and
   deliberately plain: they show the shape of the page, not real content. */
const GENERIC_NOTES = ['Initial entry recorded.', 'Reviewed with the client; no changes.', 'Updated after the care team meeting.'];
function genericRows(scope, page, n) {
  return Array.from({ length: n }).map((_, i) => {
    const s = seed(scope + page + i), st = (RD.staff || [])[s % Math.max(1, (RD.staff || []).length)] || {};
    return { id: scope + page + i, date: isoOf(addDays(TODAY, -(i * 21 + (s % 9) + 2))), by_staff_id: st.staff_id,
      summary: GENERIC_NOTES[i % GENERIC_NOTES.length], status: i === 0 && s % 2 ? 'Draft' : 'Final' };
  });
}

/* ---- Module specs -----------------------------------------------------
   Each: what one record is called, how to list them, and the form to add one.
   field: { key, label, type: text | number | select | radio | date | textarea,
            options, required, wide, def }
   `overlay` instead of `fields`: modules whose entry form already exists as a
   dialog with real logic (prescribing, scored instruments) keep it. */
const DX_CODES = (RD.diagnoses || []);
const MODULE_SPECS = {
  'Allergy': {
    noun: 'Allergy', rows: c => getAllergies(c),
    cols: [['Allergen', r => r.allergen], ['Category', r => r.allergen_category], ['Reaction', r => r.reaction || '—'],
      ['Severity', r => r.severity_flag], ['Status', r => r.status || 'Active']],
    fields: [
      { key: 'allergen', label: 'Allergen', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Drug Class', 'Medication', 'Food', 'Environmental', 'Other'], required: true },
      { key: 'reaction', label: 'Reaction', type: 'text' },
      { key: 'severity', label: 'Severity', type: 'radio', options: ['Low', 'Moderate', 'High'], required: true },
      { key: 'status', label: 'Status', type: 'radio', options: ['Active', 'Inactive'], def: 'Active' },
    ],
    save: (c, f) => {
      addRecord('allergies', { allergy_id: newId('ALG'), client_id: c.client_id, allergen: f.allergen.trim(), allergen_category: f.category,
        reaction: (f.reaction || '').trim() || null, severity_flag: f.severity, status: f.status });
      return { title: 'Allergy added', detail: f.allergen.trim() + ' · ' + f.severity + ' severity' };
    },
  },
  'Vitals': {
    noun: 'Vitals', rows: c => getVitals(c),
    cols: [['Date', r => fmtDate(r.date_time)], ['Blood Pressure', r => r.bp_systolic ? r.bp_systolic + '/' + r.bp_diastolic : '—'],
      ['Pulse', r => r.pulse_bpm || '—'], ['Weight', r => r.weight_lbs ? r.weight_lbs + ' lbs' : '—'], ['Temp', r => r.temp_f || '—'],
      ['O2 Sat', r => r.o2_sat_pct ? r.o2_sat_pct + '%' : '—'], ['Recorded By', r => sName(r.recorded_by_staff_id)]],
    fields: [
      { key: 'sys', label: 'Systolic', type: 'number', required: true }, { key: 'dia', label: 'Diastolic', type: 'number', required: true },
      { key: 'pulse', label: 'Pulse', type: 'number', required: true }, { key: 'weight', label: 'Weight (lbs)', type: 'number' },
      { key: 'temp', label: 'Temp (°F)', type: 'number' }, { key: 'o2', label: 'O2 Sat (%)', type: 'number' },
    ],
    save: (c, f) => {
      addRecord('vitals', { vitals_id: newId('VH'), client_id: c.client_id, recorded_by_staff_id: ME.id, date_time: nowIso() + ':00',
        height_in: (c.vitals && c.vitals.height_in) || null, weight_lbs: parseFloat(f.weight) || null, bmi: null, temp_f: parseFloat(f.temp) || null,
        pulse_bpm: parseFloat(f.pulse), resp_rate: null, bp_systolic: parseFloat(f.sys), bp_diastolic: parseFloat(f.dia), o2_sat_pct: parseFloat(f.o2) || null, pain_scale: 0 });
      return { title: 'Vitals recorded', detail: 'BP ' + f.sys + '/' + f.dia + ' · pulse ' + f.pulse };
    },
  },
  'Immunization': {
    noun: 'Immunization', rows: c => getImmunizations(c),
    cols: [['Date', r => fmtDate(r.date)], ['Vaccine', r => r.vaccine], ['Dose', r => r.dose || '—'], ['Status', r => r.status],
      ['Given By', r => r.administered_by_staff_id ? sName(r.administered_by_staff_id) : r.source || '—']],
    fields: [
      { key: 'vaccine', label: 'Vaccine', type: 'select', options: VACCINE_OPTIONS, required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, def: () => isoOf(TODAY) },
      { key: 'dose', label: 'Dose', type: 'select', options: ['1 of 1', '1 of 2', '2 of 2', '1 of 3', '2 of 3', '3 of 3', 'Booster'] },
      { key: 'status', label: 'Status', type: 'radio', options: ['Administered', 'Historical', 'Declined'], def: 'Administered' },
    ],
    save: (c, f) => {
      addRecord('immunizations', { immunization_id: newId('IMM'), client_id: c.client_id, vaccine: f.vaccine, dose: f.dose || null, date: f.date,
        site_route: null, lot: null, administered_by_staff_id: f.status === 'Administered' ? ME.id : null, status: f.status, source: f.status === 'Historical' ? 'Reported by client' : null });
      return { title: 'Immunization added', detail: f.vaccine + ' · ' + f.status.toLowerCase() };
    },
  },
  'Injection': {
    noun: 'Injection', rows: c => getInjections(c),
    cols: [['Date Given', r => fmtDate(r.date_given)], ['Medication', r => r.medication], ['Dose', r => r.dose], ['Site', r => r.site || '—'],
      ['Next Due', r => r.next_due ? fmtDate(r.next_due) : '—'], ['Given By', r => sName(r.given_by_staff_id)]],
    fields: [
      { key: 'med', label: 'Medication', type: 'select', options: INJECTABLE_OPTIONS.map(o => o.name), required: true, wide: true },
      { key: 'date', label: 'Date given', type: 'date', required: true, def: () => isoOf(TODAY) },
      { key: 'site', label: 'Site', type: 'select', options: ['Left deltoid', 'Right deltoid', 'Left gluteal', 'Right gluteal', 'Abdomen (subcutaneous)'], required: true },
    ],
    save: (c, f) => {
      const o = INJECTABLE_OPTIONS.find(x => x.name === f.med) || {};
      addRecord('injections', { injection_id: newId('INJ'), client_id: c.client_id, medication: f.med, dose: o.dose || null, schedule: o.schedule || null,
        date_given: f.date, next_due: isoOf(addDays(_parse(f.date), o.every || 28)), interval_days: o.every || 28, site: f.site, given_by_staff_id: ME.id, lot: null });
      return { title: 'Injection recorded', detail: f.med };
    },
  },
  'Diagnosis': {
    noun: 'Diagnosis', rows: c => pageRows(c.client_id, 'Diagnosis').concat(c.diagnoses || []),
    cols: [['ICD-10', r => r.icd10], ['Description', r => r.description], ['Precedence', r => r.precedence || '—'], ['Status', r => r.status],
      ['Onset', r => r.onset_date ? fmtDate(r.onset_date) : '—']],
    fields: [
      { key: 'dx', label: 'Diagnosis', type: 'select', options: DX_CODES.map(d => d.icd10 + ' ' + d.description), required: true, wide: true },
      { key: 'precedence', label: 'Precedence', type: 'select', options: ['Primary', 'Secondary', 'Tertiary'], required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Provisional', 'In Remission', 'Resolved'], required: true, def: 'Active' },
      { key: 'onset', label: 'Onset date', type: 'date', def: () => isoOf(TODAY) },
    ],
    save: (c, f) => {
      const d = DX_CODES.find(x => x.icd10 + ' ' + x.description === f.dx) || {};
      addPageRow(c.client_id, 'Diagnosis', { client_dx_id: newId('CDX'), icd10: d.icd10, description: d.description, precedence: f.precedence, status: f.status, onset_date: f.onset || null });
      return { title: 'Diagnosis added', detail: d.icd10 + ' · ' + f.status };
    },
  },
  'Problem List': {
    noun: 'Problem', rows: c => pageRows(c.client_id, 'Problem List').concat(c.problems || []),
    cols: [['Problem', r => r.name], ['Category', r => r.category || '—'], ['Status', r => r.status], ['Onset', r => r.onset_date ? fmtDate(r.onset_date) : '—']],
    fields: [
      { key: 'problem', label: 'Problem', type: 'select', options: (RD.problems || []).map(p => p.name), required: true, wide: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Resolved'], required: true, def: 'Active' },
      { key: 'onset', label: 'Onset date', type: 'date', def: () => isoOf(TODAY) },
    ],
    save: (c, f) => {
      const p = (RD.problems || []).find(x => x.name === f.problem) || {};
      addPageRow(c.client_id, 'Problem List', { client_problem_id: newId('CPL'), name: f.problem, category: p.category, status: f.status, onset_date: f.onset || null });
      return { title: 'Problem added', detail: f.problem + ' · ' + f.status };
    },
  },
  'Payor Assignment': {
    noun: 'Payor Assignment',
    rows: c => pageRows(c.client_id, 'Payor Assignment').concat((RD.payors || []).filter(p => p.client_id === c.client_id)),
    cols: [['Policy Type', r => r.policy_type], ['Payor', r => payorName(r.payor_provider_id)], ['Policy Number', r => r.policy_number],
      ['Group', r => r.group_number || '—'], ['Begin', r => fmtDate(r.begin_date)], ['End', r => r.end_date ? fmtDate(r.end_date) : '—']],
    fields: [
      { key: 'type', label: 'Policy type', type: 'select', options: ['Primary', 'Secondary', 'Tertiary'], required: true },
      { key: 'payor', label: 'Payor', type: 'select', options: () => PAYORS.map(p => p.name), required: true },
      { key: 'policy', label: 'Policy number', type: 'text', required: true },
      { key: 'group', label: 'Group number', type: 'text' },
      { key: 'begin', label: 'Begin date', type: 'date', required: true, def: () => isoOf(TODAY) },
      { key: 'end', label: 'End date', type: 'date' },
    ],
    save: (c, f) => {
      const p = PAYORS.find(x => x.name === f.payor) || {};
      addPageRow(c.client_id, 'Payor Assignment', { assignment_id: newId('PAY'), client_id: c.client_id, policy_type: f.type, payor_provider_id: p.provider_id,
        policy_number: f.policy.trim(), group_number: (f.group || '').trim() || null, begin_date: f.begin, end_date: f.end || null, created_by_staff_id: ME.id });
      return { title: 'Payor assigned', detail: f.payor + ' · ' + f.type };
    },
  },
  'Appointments': {
    noun: 'Appointment',
    rows: c => pageRows(c.client_id, 'Appointments').concat((RD.appointments || []).filter(a => a.client_id === c.client_id))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    cols: [['Date', r => fmtDate(r.date)], ['Time', r => r.start_time ? noteTime('0000-00-00T' + r.start_time) : '—'], ['Reason', r => r.appointment_reason],
      ['With', r => sName(r.staff_id)], ['Meeting', r => r.meeting_type], ['Status', r => r.completion_status]],
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, def: () => isoOf(addDays(TODAY, 7)) },
      { key: 'time', label: 'Time', type: 'select', options: NOTE_TIMES, required: true },
      { key: 'reason', label: 'Reason', type: 'select', options: () => [...new Set((RD.appointments || []).map(a => a.appointment_reason).filter(Boolean))].sort(), required: true },
      { key: 'with', label: 'With', type: 'select', options: staffOptions, required: true },
      { key: 'meeting', label: 'Meeting type', type: 'radio', options: ['In Person', 'Telehealth', 'Phone'], def: 'In Person' },
    ],
    save: (c, f) => {
      const [h, rest] = f.time.split(':'); const pm = /PM/.test(rest); const hh = (parseInt(h, 10) % 12) + (pm ? 12 : 0);
      addPageRow(c.client_id, 'Appointments', { appointment_id: newId('APT'), client_id: c.client_id, staff_id: staffIdByName(f.with), date: f.date,
        start_time: String(hh).padStart(2, '0') + ':' + rest.slice(0, 2), appointment_reason: f.reason, meeting_type: f.meeting, completion_status: 'Scheduled' });
      return { title: 'Appointment scheduled', detail: fmtDate(f.date) + ' · ' + f.time };
    },
  },
  'Prescription': {
    noun: 'Medication', rows: c => getMeds(c), overlay: AddMedicationOverlay,
    cols: [['Medication', r => r.medication_display], ['Sig', r => r.sig], ['Status', r => r.status], ['Start', r => fmtDate(r.start_date)],
      ['Prescriber', r => sName(r.prescriber_staff_id)]],
  },
};
const PAYORS = ((RD.funding && RD.funding.providers) || []);
const payorName = id => (PAYORS.find(p => p.provider_id === id) || {}).name || id || '—';

/* Scored instruments: the module's form, from the fixtures, with its own
   item-by-item entry dialog. */
function instrumentSpec(module) {
  const form = (RD.assessmentForms || []).find(f => f.module === module);
  if (!form) return null;
  return {
    noun: form.name, rows: c => getAdmins(c, form.form_id), overlay: p => <NewAssessmentOverlay form={form} {...p} />,
    cols: [['Date', r => fmtDate(r.date)], ['Score', r => r.score + ' / ' + formMax(form)], ['Result', r => r.band], ['Administered By', r => sName(r.administered_by_staff_id)]],
  };
}
/* Everything else: dated entries with a short summary. */
function genericClientSpec(module) {
  return {
    noun: 'Entry', generic: true,
    rows: c => pageRows(c.client_id, module).concat(genericRows(c.client_id, module, 3)),
    cols: [['Date', r => fmtDate(r.date)], ['Entry', r => r.summary], ['Entered By', r => sName(r.by_staff_id)], ['Status', r => r.status]],
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, def: () => isoOf(TODAY) },
      { key: 'status', label: 'Status', type: 'radio', options: ['Draft', 'Final'], def: 'Final' },
      { key: 'summary', label: 'Entry', type: 'textarea', required: true, wide: true },
    ],
    save: (c, f) => {
      addPageRow(c.client_id, module, { id: newId('ROW'), date: f.date, by_staff_id: ME.id, summary: f.summary.trim(), status: f.status });
      return { title: module + ' entry saved', detail: fmtDate(f.date) + ' · ' + f.status };
    },
  };
}
const specForModule = module => MODULE_SPECS[module] || instrumentSpec(module) || genericClientSpec(module);

/* Client-agnostic pages (Admin, Reports, Billing children…): named records. */
function agencySpec(page) {
  return {
    noun: 'Record', generic: true,
    rows: () => pageRows('agency', page).concat(genericRows('agency', page, 4).map((r, i) => ({ ...r, name: page + ' record ' + (1001 + i) }))),
    cols: [['Name', r => r.name], ['Notes', r => r.summary], ['Updated', r => fmtDate(r.date)], ['Updated By', r => sName(r.by_staff_id)], ['Status', r => r.status === 'Draft' ? 'Draft' : 'Active']],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'status', label: 'Status', type: 'radio', options: ['Draft', 'Active'], def: 'Active' },
      { key: 'summary', label: 'Notes', type: 'textarea', wide: true },
    ],
    save: (_, f) => {
      addPageRow('agency', page, { id: newId('ROW'), name: f.name.trim(), date: isoOf(TODAY), by_staff_id: ME.id, summary: (f.summary || '').trim() || '—', status: f.status });
      return { title: f.name.trim() + ' saved', detail: page };
    },
  };
}

/* ---- The form on the page --------------------------------------- */
const optionsOf = fd => (typeof fd.options === 'function' ? fd.options() : fd.options) || [];
function blankFor(spec) {
  const f = {};
  (spec.fields || []).forEach(fd => { f[fd.key] = typeof fd.def === 'function' ? fd.def() : (fd.def || ''); });
  return f;
}
function PageForm({ spec, title, dirtyLabel, scope, onDone }) {
  const guard = useGuard();
  const [f, setF] = useState(() => blankFor(spec));
  const [tried, setTried] = useState(false);
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); guard.markDirty(dirtyLabel); };
  const missing = fd => fd.required && !String(f[fd.key] || '').trim();
  const cancel = () => { guard.clearDirty(); onDone(); };
  const save = () => {
    setTried(true);
    if ((spec.fields || []).some(missing)) return;
    const t = spec.save(scope, f);
    guard.clearDirty();
    guard.setToast({ status: 'success', ...t });
    onDone();
  };
  const err = fd => (tried && missing(fd) ? fd.label + ' is required.' : null);
  return (
    <Panel title={title}>
      <div className="pf-grid">
        {spec.fields.map(fd => {
          const e = err(fd);
          if (fd.type === 'date') return <div key={fd.key} className={fd.wide ? 'pf-wide' : ''}><DateField label={fd.label} required={fd.required} quick={false} value={f[fd.key]} onChange={v => set(fd.key, v)} error={e} /></div>;
          return (
            <Field key={fd.key} label={fd.label} required={fd.required} error={e} wide={fd.wide}>
              {fd.type === 'select' ? <Dropdown value={f[fd.key]} options={optionsOf(fd)} placeholder="Please select an option" onChange={v => set(fd.key, v)} invalid={!!e} menuMinWidth={260} />
                : fd.type === 'radio' ? <RadioGroup name={'pf-' + fd.key} options={optionsOf(fd)} value={f[fd.key]} onChange={v => set(fd.key, v)} invalid={!!e} />
                : fd.type === 'textarea' ? <TextArea value={f[fd.key]} onChange={v => set(fd.key, v)} rows={3} invalid={!!e} />
                : <TextIn value={f[fd.key]} onChange={v => set(fd.key, fd.type === 'number' ? v.replace(/[^0-9.]/g, '') : v)} invalid={!!e} />}
            </Field>
          );
        })}
      </div>
      <div className="pf-foot">
        <Button variant="secondary" onClick={cancel}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save {spec.noun}</Button>
      </div>
    </Panel>
  );
}

/* ---- Records: a table, and a way to add one ---------------------- */
function RecordsBody({ spec, scope, label, rows, sampleNote }) {
  const [adding, setAdding] = useState(false);
  const [dialog, setDialog] = useState(false);
  const Dlg = spec.overlay;
  const add = () => (Dlg ? setDialog(true) : setAdding(true));
  const addLabel = 'Add ' + (spec.generic ? (spec.noun === 'Record' ? 'Record' : 'Entry') : spec.noun);
  return (
    <React.Fragment>
      {adding && <PageForm spec={spec} scope={scope} dirtyLabel={label} title={'New ' + (spec.generic ? (spec.noun === 'Record' ? label + ' Record' : label + ' Entry') : spec.noun)} onDone={() => setAdding(false)} />}
      <Panel title={label + ' (' + rows.length + ')'}
        action={!adding && <Button size="sm" variant={adding ? 'secondary' : 'primary'} onClick={add}><Icon name="plus" size={14} /> {addLabel}</Button>}>
        {sampleNote && <div className="pf-sample">{sampleNote}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>{spec.cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>{spec.cols.map(([h, get]) => <td key={h} className="wrap">{get(r)}</td>)}</tr>)}
              {!rows.length && <tr><td colSpan={spec.cols.length} className="cam-empty">Nothing recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      {dialog && Dlg && <Dlg client={scope} onClose={() => setDialog(false)} />}
    </React.Fragment>
  );
}

/* Inside the chart: the module tab's body. */
function ClientModulePage({ client, module }) {
  useRecordsVersion();
  const spec = specForModule(module);
  return <div className="pf-page"><RecordsBody spec={spec} scope={client} label={module} rows={spec.rows(client)}
    sampleNote={spec.generic ? 'Sample entries. This module’s own fields aren’t built in the prototype; the form shows the save and unsaved-changes flow.' : null} /></div>;
}

/* Client-agnostic leaf pages. */
function AgencyPage({ label }) {
  useRecordsVersion();
  const spec = agencySpec(label);
  return (
    <div className="page">
      <Breadcrumbs items={navTrail(label)} />
      <div className="page-head-row"><div><h1 className="page-title">{label}</h1></div></div>
      <RecordsBody spec={spec} scope={null} label={label} rows={spec.rows()}
        sampleNote="Sample records. This page isn’t built out; the form shows the save and unsaved-changes flow." />
    </div>
  );
}

/* ---- Section pages: children in nav order ------------------------ */
function SectionIndexPage({ sectionKey }) {
  const guard = useGuard();
  const s = NAV_SECTIONS.find(x => x.key === sectionKey);
  const item = l => (
    <button key={l} type="button" className="secx-item" onClick={() => openNavItem(guard, l)}>
      <span>{l}</span><Icon name="chevronRight" size={18} />
    </button>
  );
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: s.label }]} />
      <div className="page-head-row"><div><h1 className="page-title">{s.label}</h1></div></div>
      {(s.categories || []).map(c => (
        <Panel key={c.label} title={c.label}><div className="secx-grid">{c.items.map(item)}</div></Panel>
      ))}
      {s.links.length > 0 && (
        <Panel title={(s.categories || []).length ? 'More in ' + s.label : 'Pages'}><div className="secx-grid">{s.links.map(item)}</div></Panel>
      )}
    </div>
  );
}

/* ---- Documents ----------------------------------------------------
   Every document the signed-in user wrote or can see, across their clients.
   Filters borrow from production's Clinical Forms Search (client, author,
   document type, status, a date range with quick sets) without its weight:
   they apply as you change them, and there's one keyword search.
   Opening a document is the client-agnostic → client-specific step: it goes
   through the guard, so another client in context is a named switch. */
const ANY = 'Any';
const DOC_STATUS = ['Draft', 'Pending co-sign', 'Signed'];
const docTab = d => d.name + ' · ' + fmtDate(d.at);
const docsFor = cid => clientDocs(cid, 10);
const findDoc = (cid, module) => (module && module.indexOf('doc-') === 0 ? docsFor(cid).find(d => 'doc-' + slugify(d.id) === module) : null);
const DOC_FILTERS = () => ({ client: ANY, author: ANY, type: ANY, status: ANY, from: isoOf(addDays(TODAY, -30)), to: isoOf(TODAY), q: '' });

function NewDocumentButton() {
  const guard = useGuard();
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menuRef = useRef(null);
  useOutside([ref, menuRef], () => setOpen(false));
  return (
    <span ref={ref} className="nstart">
      <button type="button" className="btn btn-primary" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="plus" size={15} /> New Document <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu" role="listbox" minWidth={280} maxHeight={380} onClose={() => setOpen(false)}>
          <div className="dd-head">Choose a document type</div>
          <div className="dd-list">
            {START_NOTE_TYPES.map(t => <button key={t} type="button" role="option" className="dd-opt" onClick={() => { setOpen(false); openNavItem(guard, t); }}>{t}</button>)}
          </div>
          <div className="dd-foot">{guard.client ? 'Opens on ' + guard.client.name + '’s chart.' : 'You’ll choose the client next.'}</div>
        </FloatMenu>
      )}
    </span>
  );
}

function DocumentsPage() {
  const guard = useGuard();
  const [f, setF] = useState(DOC_FILTERS);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const all = useMemo(() => CLIENTS.flatMap(c => docsFor(c.client_id).map(d => ({ ...d, client: c })))
    .sort((a, b) => b.at - a.at), []);
  const types = [...new Set(all.map(d => d.name))].sort();
  const authors = [...new Set(all.map(d => d.by))].sort();
  const ql = f.q.trim().toLowerCase();
  const rows = all.filter(d => (f.client === ANY || d.client.name === f.client)
    && (f.author === ANY || (f.author === 'Me' ? d.byId === ME.id : d.by === f.author))
    && (f.type === ANY || d.name === f.type) && (f.status === ANY || d.status === f.status)
    && (!f.from || isoOf(d.at) >= f.from) && (!f.to || isoOf(d.at) <= f.to)
    && (!ql || (d.name + ' ' + d.client.name + ' ' + d.by + ' ' + d.kind).toLowerCase().indexOf(ql) !== -1));
  const changed = JSON.stringify(f) !== JSON.stringify(DOC_FILTERS());
  const open = d => guard.setClient(d.client.client_id, { to: '/chart/' + d.client.client_id + '/doc-' + slugify(d.id) });

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Documents' }]} />
      <div className="page-head-row">
        <div><h1 className="page-title">Documents</h1>
          <div className="page-sub">Documents you’ve written or can access, across your clients.</div></div>
        <span className="spacer" />
        <NewDocumentButton />
      </div>
      <Panel title="Filters" action={changed && <button className="lnk" onClick={() => setF(DOC_FILTERS())}>Reset Filters</button>}>
        <div className="docs-filters">
          <Field label="Client"><Dropdown value={f.client} options={[ANY].concat(CLIENTS.map(c => c.name).sort())} onChange={v => set('client', v)} /></Field>
          <Field label="Author"><Dropdown value={f.author} options={[ANY, 'Me'].concat(authors)} onChange={v => set('author', v)} /></Field>
          <Field label="Document Type"><Dropdown value={f.type} options={[ANY].concat(types)} onChange={v => set('type', v)} menuMinWidth={280} /></Field>
          <Field label="Status"><Dropdown value={f.status} options={[ANY].concat(DOC_STATUS)} onChange={v => set('status', v)} /></Field>
          <DateField label="From" value={f.from} onChange={v => set('from', v)} quick={[['Today', 0], ['−30', -30], ['−7', -7]]} />
          <DateField label="To" value={f.to} min={f.from} onChange={v => set('to', v)} quick={[['Today', 0], ['7', 7], ['30', 30]]} />
        </div>
      </Panel>
      <Panel title={'Documents (' + rows.length + ')'}>
        <div className="docs-search"><MiniSearch value={f.q} onChange={v => set('q', v)} placeholder="Search by document, client or author" /></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Document</th><th>Client</th><th>Author</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id}>
                  <td>{fmtDate(d.at)}</td>
                  <td className="wrap"><button className="lnk" onClick={() => open(d)}>{d.name}</button><div className="docs-kind">{d.kind}</div></td>
                  <td className="wrap">{d.client.name}</td>
                  <td className="wrap">{d.byId === ME.id ? 'You' : d.by}</td>
                  <td>{d.status === 'Signed' ? 'Signed' : <span className={'ntag' + (d.status === 'Draft' ? '' : ' ntag--warn')}>{d.status}</span>}</td>
                  <td><Button size="sm" variant="secondary" onClick={() => open(d)}>Open</Button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="cam-empty">No documents match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* A document opened from the Documents list, as a chart tab. Its content
   isn't part of the prototype; the point is where it opens. */
function DocumentView({ client, doc }) {
  return (
    <Panel title={doc.name}>
      <div className="ovl-facts docv-facts">
        <div><span>Client</span>{client.name}</div>
        <div><span>Date</span>{fmtDate(doc.at)}</div>
        <div><span>Author</span>{doc.byId === ME.id ? 'You' : doc.by}</div>
        <div><span>Status</span>{doc.status}</div>
      </div>
      <div className="stub"><Icon name="info" size={20} /><div>The document’s content isn’t part of this prototype. It opens here, on {client.shortName}’s chart, so the trail reads Clients › {client.name} › {doc.name}.</div></div>
    </Panel>
  );
}
