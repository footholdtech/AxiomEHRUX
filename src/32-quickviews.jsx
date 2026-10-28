/* ===== Clinical quick views ========================================
   The header quick views that replace production's per-module side panels
   (Allergy, Vitals, Prescription, Immunization, Injection and the scored
   instruments) so nothing a clinician reaches today is lost when the header
   ships. Every one follows the same three rules:

     1. Summary, not the whole module. Assessments show the latest score, its
        band and when it was taken — never the full instrument.
     2. Every data point links to its full page (the chart's module route).
     3. Adding a record never leaves the page: "+ Add …" opens a dialog sized to
        the form, and the new record appears in the header immediately.

   Records come from 16-records.jsx. In the admin preview (`preview`), links
   and add actions are shown but inert — the preview client is fictional.
   ================================================================ */

/* ---- Shared pieces ------------------------------------------------- */
function TextIn({ value, onChange, placeholder = 'Please input…', type = 'text', invalid, suffix, ...rest }) {
  return (
    <div className={'form-input' + (invalid ? ' invalid' : '')}>
      <input type={type} value={value == null ? '' : value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} {...rest} />
      {suffix && <span className="form-suffix">{suffix}</span>}
    </div>
  );
}

/* The strip across the top of every clinical quick view: what it is, how many,
   and the two actions every one of them has — open the full page, add one. */
function QvBar({ title, meta, onViewAll, onAdd, addLabel, preview, children }) {
  const inert = preview ? 'Not available in the preview' : null;
  return (
    <div className="qvx-bar">
      <div className="qvx-title">
        <span className="qvx-name">{title}</span>
        {meta && <span className="qvx-meta">{meta}</span>}
      </div>
      <div className="qvx-acts">
        {children}
        {onViewAll && (
          <Tooltip label={inert} placement="bottom">
            <button className="lnk qvx-viewall" disabled={preview} onClick={onViewAll}>
              View all <Icon name="external" size={13} />
            </button>
          </Tooltip>
        )}
        {onAdd && (
          <Tooltip label={inert} placement="bottom">
            <Button size="sm" variant="secondary" disabled={preview} onClick={onAdd}>
              <Icon name="plus" size={14} /> {addLabel}
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* A record's name as a link to its module page (plain text in the preview). */
function RecLink({ children, onOpen, preview }) {
  if (preview) return <span className="qvx-recname">{children}</span>;
  return <button className="lnk qvx-recname" onClick={onOpen}>{children}</button>;
}

const QvxEmpty = ({ children }) => <div className="cph-qv-empty qvx-empty">{children}</div>;

function useModuleNav(client) {
  const guard = useGuard();
  return name => guard.go('/chart/' + client.client_id + '/' + slugify(name), { client: client.client_id });
}

const daysUntil = iso => Math.round((_parse(iso) - TODAY) / 86400000);
const dueLabel = iso => {
  if (!iso) return null;
  const d = daysUntil(iso);
  return d < 0 ? Math.abs(d) + ' day' + (d === -1 ? '' : 's') + ' overdue' : d === 0 ? 'Due today' : 'Due in ' + d + ' day' + (d === 1 ? '' : 's');
};

/* ================= Allergies ================= */
function AllergiesQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const [adding, setAdding] = useState(false);
  const all = getAllergies(client);
  const rows = view.options.activeOnly ? all.filter(a => (a.status || 'Active') === 'Active') : all;
  return (
    <div className="cph-qvx">
      <QvBar title="Allergies" meta={rows.length + (view.options.activeOnly ? ' active' : ' recorded')} preview={preview}
        onViewAll={() => go('Allergy')} onAdd={() => setAdding(true)} addLabel="Add Allergy" />
      {rows.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Allergen</th><th>Category</th><th>Reaction</th><th>Severity</th><th>Status</th></tr></thead>
          <tbody>{rows.map(a => (
            <tr key={a.allergy_id}>
              <td><RecLink preview={preview} onOpen={() => go('Allergy')}>{a.allergen}</RecLink></td>
              <td>{a.allergen_category}</td><td>{a.reaction || '—'}</td>
              <td><span className={'cph-qv-tag' + (a.severity_flag === 'High' ? ' is-warn' : '')}>{a.severity_flag}</span></td>
              <td>{a.status || 'Active'}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>No known allergies recorded.</QvxEmpty>}
      {adding && <AddAllergyOverlay client={client} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddAllergyOverlay({ client, onClose }) {
  const guard = useGuard();
  const [f, setF] = useState({ allergen: '', category: '', reaction: '', severity: '', status: 'Active' });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const missing = !f.allergen.trim() || !f.category || !f.severity;
  const save = () => {
    setTried(true);
    if (missing) return;
    addRecord('allergies', { allergy_id: newId('ALG'), client_id: client.client_id, allergen: f.allergen.trim(),
      allergen_category: f.category, reaction: f.reaction.trim() || null, severity_flag: f.severity, status: f.status });
    guard.setToast({ status: 'success', title: 'Allergy added', detail: f.allergen.trim() + ' · ' + f.severity + ' severity' });
    onClose();
  };
  return (
    <Overlay size="sm" title="Add Allergy" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add Allergy</Button></React.Fragment>}>
      <Field label="Allergen" required error={tried && !f.allergen.trim() ? 'Allergen is required.' : null}>
        <TextIn value={f.allergen} onChange={v => set('allergen', v)} placeholder="e.g. Penicillins" invalid={tried && !f.allergen.trim()} />
      </Field>
      <Field label="Category" required error={tried && !f.category ? 'Category is required.' : null}>
        <Dropdown value={f.category} options={['Drug Class', 'Medication', 'Food', 'Environmental', 'Other']} onChange={v => set('category', v)} invalid={tried && !f.category} />
      </Field>
      <Field label="Reaction"><TextIn value={f.reaction} onChange={v => set('reaction', v)} placeholder="e.g. Hives" /></Field>
      <Field label="Severity" required error={tried && !f.severity ? 'Severity is required.' : null}>
        <RadioGroup name="alg-sev" options={['Low', 'Moderate', 'High']} value={f.severity} onChange={v => set('severity', v)} invalid={tried && !f.severity} />
      </Field>
      <Field label="Status"><RadioGroup name="alg-status" options={['Active', 'Inactive']} value={f.status} onChange={v => set('status', v)} /></Field>
    </Overlay>
  );
}

/* ================= Vitals ================= */
const VITAL_ROWS = [
  ['Blood pressure', v => v.bp_systolic + '/' + v.bp_diastolic, 'mmHg'],
  ['Pulse', v => v.pulse_bpm, 'bpm'], ['Temp', v => v.temp_f, '°F'], ['Resp', v => v.resp_rate, '/min'],
  ['O₂ sat', v => v.o2_sat_pct, '%'], ['Weight', v => v.weight_lbs, 'lbs'], ['BMI', v => v.bmi, ''], ['Pain', v => v.pain_scale, '/10'],
];
function VitalsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const [adding, setAdding] = useState(false);
  const all = getVitals(client);
  const latest = all[0];
  const recent = all.slice(1, 1 + (parseInt(view.options.count, 10) || 3));
  return (
    <div className="cph-qvx">
      <QvBar title="Vitals" meta={latest ? 'Latest ' + fmtDate(latest.date_time) + (latest.recorded_by_staff_id ? ' · ' + sName(latest.recorded_by_staff_id) : '') : null}
        preview={preview} onViewAll={() => go('Vitals')} onAdd={() => setAdding(true)} addLabel="Record Vitals" />
      {latest ? (
        <div className="qvx-split">
          <div className="qvx-vitals">
            {VITAL_ROWS.map(([k, fn, unit]) => (
              <div key={k} className="qvx-vital">
                <span className="qvx-vital-k">{k}</span>
                <span className="qvx-vital-v">{fn(latest)}<span className="qvx-vital-u">{unit}</span></span>
              </div>
            ))}
          </div>
          {!!recent.length && (
            <table className="data-table compact qvx-table qvx-side">
              <thead><tr><th>Earlier</th><th>BP</th><th>Pulse</th><th>Weight</th></tr></thead>
              <tbody>{recent.map(v => (
                <tr key={v.vitals_id}>
                  <td><RecLink preview={preview} onOpen={() => go('Vitals')}>{fmtDate(v.date_time)}</RecLink></td>
                  <td>{v.bp_systolic}/{v.bp_diastolic}</td><td>{v.pulse_bpm}</td><td>{v.weight_lbs}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : <QvxEmpty>No vitals recorded.</QvxEmpty>}
      {adding && <RecordVitalsOverlay client={client} last={latest} onClose={() => setAdding(false)} />}
    </div>
  );
}

function RecordVitalsOverlay({ client, last, onClose }) {
  const guard = useGuard();
  const [f, setF] = useState({
    ft: last ? String(Math.floor(last.height_in / 12)) : '', inch: last ? String(last.height_in % 12) : '',
    weight: '', temp: '', pulse: '', resp: '', sys: '', dia: '', o2: '', pain: '0',
  });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v.replace(/[^0-9.]/g, '') }));
  const h = (parseFloat(f.ft) || 0) * 12 + (parseFloat(f.inch) || 0);
  const bmi = h && f.weight ? Math.round(parseFloat(f.weight) * 703 / (h * h) * 10) / 10 : null;
  const missing = !f.sys || !f.dia || !f.pulse;
  const save = () => {
    setTried(true);
    if (missing) return;
    addRecord('vitals', { vitals_id: newId('VH'), client_id: client.client_id, recorded_by_staff_id: ME.id,
      date_time: isoOf(TODAY) + 'T' + new Date().toTimeString().slice(0, 8), height_in: h || null,
      weight_lbs: parseFloat(f.weight) || null, bmi, temp_f: parseFloat(f.temp) || null, pulse_bpm: parseFloat(f.pulse),
      resp_rate: parseFloat(f.resp) || null, bp_systolic: parseFloat(f.sys), bp_diastolic: parseFloat(f.dia),
      o2_sat_pct: parseFloat(f.o2) || null, pain_scale: parseFloat(f.pain) || 0 });
    guard.setToast({ status: 'success', title: 'Vitals recorded', detail: 'BP ' + f.sys + '/' + f.dia + ' · pulse ' + f.pulse });
    onClose();
  };
  const num = (k, label, suffix, req) => (
    <Field label={label} required={req} error={tried && req && !f[k] ? label + ' is required.' : null}>
      <TextIn value={f[k]} onChange={v => set(k, v)} placeholder="—" inputMode="decimal" suffix={suffix} invalid={tried && req && !f[k]} />
    </Field>
  );
  return (
    <Overlay size="md" title="Record Vitals" subtitle={client.displayName + ' · ' + fmtDate(TODAY)} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save Vitals</Button></React.Fragment>}>
      <div className="ovl-grid ovl-grid--4">
        {num('sys', 'Systolic', 'mmHg', true)}{num('dia', 'Diastolic', 'mmHg', true)}
        {num('pulse', 'Pulse', 'bpm', true)}{num('resp', 'Respiration', '/min')}
        {num('temp', 'Temperature', '°F')}{num('o2', 'O₂ saturation', '%')}
        {num('ft', 'Height', 'ft')}{num('inch', ' ', 'in')}
        {num('weight', 'Weight', 'lbs')}
        <Field label="BMI"><div className="ff-inline ovl-calc">{bmi == null ? '—' : bmi}</div></Field>
        <Field label="Pain (0–10)">
          <Dropdown value={f.pain} options={['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']} onChange={v => set('pain', v)} />
        </Field>
      </div>
    </Overlay>
  );
}

/* ================= Immunizations ================= */
function ImmunizationsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const [adding, setAdding] = useState(false);
  const all = getImmunizations(client);
  const rows = view.options.showDeclined ? all : all.filter(r => r.status !== 'Declined');
  return (
    <div className="cph-qvx">
      <QvBar title="Immunizations" meta={rows.length + ' on file'} preview={preview}
        onViewAll={() => go('Immunization')} onAdd={() => setAdding(true)} addLabel="Add Immunization" />
      {rows.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Status</th><th>Lot</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.immunization_id}>
              <td><RecLink preview={preview} onOpen={() => go('Immunization')}>{r.vaccine}</RecLink></td>
              <td>{r.dose}</td><td>{fmtDate(r.date)}</td>
              <td>{r.status}{r.source ? <span className="cell-note"> {r.source}</span> : null}</td>
              <td>{r.lot || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>No immunizations on file.</QvxEmpty>}
      {adding && <AddImmunizationOverlay client={client} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddImmunizationOverlay({ client, onClose }) {
  const guard = useGuard();
  const [f, setF] = useState({ vaccine: '', status: 'Administered', date: isoOf(TODAY), dose: '1 of 1', site: 'Deltoid IM', lot: '' });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const given = f.status === 'Administered';
  const save = () => {
    setTried(true);
    if (!f.vaccine || !f.date) return;
    addRecord('immunizations', { immunization_id: newId('IMM'), client_id: client.client_id, vaccine: f.vaccine, dose: f.dose,
      date: f.date, site_route: given ? f.site : null, lot: given ? (f.lot || null) : null,
      administered_by_staff_id: given ? ME.id : null, status: f.status, source: f.status === 'Historical' ? 'Reported by client' : null });
    guard.setToast({ status: 'success', title: 'Immunization added', detail: f.vaccine + ' · ' + f.status.toLowerCase() });
    onClose();
  };
  return (
    <Overlay size="md" title="Add Immunization" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add Immunization</Button></React.Fragment>}>
      <div className="ovl-grid ovl-grid--2">
        <Field label="Vaccine" required error={tried && !f.vaccine ? 'Vaccine is required.' : null}>
          <Dropdown value={f.vaccine} options={VACCINE_OPTIONS} onChange={v => set('vaccine', v)} invalid={tried && !f.vaccine} />
        </Field>
        <Field label="Status"><RadioGroup name="imm-status" options={['Administered', 'Historical', 'Declined']} value={f.status} onChange={v => set('status', v)} /></Field>
        <DateField label="Date" required value={f.date} onChange={v => set('date', v)} error={tried && !f.date ? 'Date is required.' : null} />
        <Field label="Dose"><Dropdown value={f.dose} options={['1 of 1', '1 of 2', '2 of 2', '1 of 3', '2 of 3', '3 of 3', 'Booster']} onChange={v => set('dose', v)} /></Field>
        {given && <Field label="Site / route"><Dropdown value={f.site} options={['Deltoid IM', 'Thigh IM', 'Subcutaneous', 'Intranasal', 'Oral']} onChange={v => set('site', v)} /></Field>}
        {given && <Field label="Lot number"><TextIn value={f.lot} onChange={v => set('lot', v)} /></Field>}
      </div>
    </Overlay>
  );
}

/* ================= Injections ================= */
function InjectionsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const [adding, setAdding] = useState(false);
  const all = getInjections(client);
  const n = parseInt(view.options.count, 10) || 3;
  const byMed = [];
  all.forEach(r => { let g = byMed.find(x => x.name === r.medication); if (!g) byMed.push(g = { name: r.medication, rows: [] }); g.rows.push(r); });
  return (
    <div className="cph-qvx">
      <QvBar title="Injections" meta={byMed.length ? byMed.length + ' active schedule' + (byMed.length === 1 ? '' : 's') : null} preview={preview}
        onViewAll={() => go('Injection')} onAdd={() => setAdding(true)} addLabel="Record Injection" />
      {byMed.length ? (
        <div className="qvx-cards">
          {byMed.map(g => {
            const last = g.rows[0];
            const next = last.next_due || isoOf(addDays(_parse(last.date_given), last.interval_days || 28));
            const d = daysUntil(next);
            return (
              <div key={g.name} className="qvx-card">
                <div className="qvx-card-head">
                  <RecLink preview={preview} onOpen={() => go('Injection')}>{g.name}</RecLink>
                  {last.schedule && <span className="badge status-neutral"><Icon name="shield" size={11} /> {last.schedule}</span>}
                </div>
                <div className="qvx-card-meta">{last.dose} · every {last.interval_days || 28} days · {last.site}</div>
                <div className="qvx-card-row">
                  <span>Last given <b>{fmtDate(last.date_given)}</b></span>
                  <span className={'cph-qv-tag' + (d < 0 ? ' is-warn' : '')}>Next {fmtDate(next)} · {dueLabel(next)}</span>
                </div>
                {g.rows.length > 1 && (
                  <div className="qvx-card-hist">Earlier: {g.rows.slice(1, n).map(r => fmtDate(r.date_given)).join(' · ')}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : <QvxEmpty>No injections on file.</QvxEmpty>}
      {adding && <RecordInjectionOverlay client={client} onClose={() => setAdding(false)} suggested={byMed[0] && byMed[0].name} />}
    </div>
  );
}

function RecordInjectionOverlay({ client, onClose, suggested }) {
  const guard = useGuard();
  const first = INJECTABLE_OPTIONS.find(o => o.name === suggested);
  const [f, setF] = useState({ med: first ? first.name : '', dose: first ? first.dose : '', date: isoOf(TODAY), site: '', lot: '' });
  const [tried, setTried] = useState(false);
  const opt = INJECTABLE_OPTIONS.find(o => o.name === f.med);
  const next = f.date && opt ? isoOf(addDays(_parse(f.date), opt.every)) : null;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = () => {
    setTried(true);
    if (!f.med || !f.date || !f.site) return;
    addRecord('injections', { injection_id: newId('INJ'), client_id: client.client_id, medication: f.med, dose: f.dose,
      schedule: opt.schedule || null, date_given: f.date, next_due: next, interval_days: opt.every, site: f.site,
      given_by_staff_id: ME.id, lot: f.lot || null });
    guard.setToast({ status: 'success', title: 'Injection recorded', detail: f.med + ' · next due ' + fmtDate(next) });
    onClose();
  };
  return (
    <Overlay size="md" title="Record Injection" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Record Injection</Button></React.Fragment>}>
      {opt && opt.schedule && (
        <div className="chc-note chc-note--warn"><Icon name="warn" size={15} /> {opt.schedule} controlled substance — document the lot number and witness per agency policy.</div>
      )}
      <div className="ovl-grid ovl-grid--2">
        <Field label="Medication" required error={tried && !f.med ? 'Medication is required.' : null}>
          <Dropdown value={f.med} options={INJECTABLE_OPTIONS.map(o => o.name)} invalid={tried && !f.med}
            onChange={v => { const o = INJECTABLE_OPTIONS.find(x => x.name === v); setF(x => ({ ...x, med: v, dose: o.dose })); }} />
        </Field>
        <Field label="Dose"><TextIn value={f.dose} onChange={v => set('dose', v)} /></Field>
        <DateField label="Date given" required value={f.date} onChange={v => set('date', v)} error={tried && !f.date ? 'Date is required.' : null} />
        <Field label="Site" required error={tried && !f.site ? 'Site is required.' : null}>
          <Dropdown value={f.site} options={['Left deltoid', 'Right deltoid', 'Left gluteal', 'Right gluteal', 'Abdomen (subcutaneous)']} onChange={v => set('site', v)} invalid={tried && !f.site} />
        </Field>
        <Field label="Lot number"><TextIn value={f.lot} onChange={v => set('lot', v)} /></Field>
        <Field label="Next due" hint={opt ? 'Every ' + opt.every + ' days' : null}><div className="ff-inline ovl-calc">{next ? fmtDate(next) : '—'}</div></Field>
      </div>
    </Overlay>
  );
}

/* ================= Scored instruments ================= */
function InstrumentQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const def = QV_BY_KEY[view.key];
  const form = FORM_BY_ID[def.form];
  const [open, setOpen] = useState(null);       // administration being read
  const [adding, setAdding] = useState(false);
  if (!form) return <QvxEmpty>This instrument isn't configured.</QvxEmpty>;
  const admins = getAdmins(client, form.form_id);
  const latest = admins[0];
  const earlier = admins.slice(1, 1 + (parseInt(view.options.count, 10) || 2));
  const max = formMax(form);
  const b = latest && formBand(form, latest.score);
  return (
    <div className="cph-qvx">
      <QvBar title={form.name} meta={form.full_name} preview={preview}
        onViewAll={() => go(def.module)} onAdd={() => setAdding(true)} addLabel={'New ' + form.name} />
      {latest ? (
        <div className="qvx-split">
          <button className="qvx-score" onClick={() => setOpen(latest)} aria-label={'Open ' + form.name + ' answers from ' + fmtDate(latest.date)}>
            <span className="qvx-score-n">{latest.score}<span className="qvx-score-max">/{max}</span></span>
            <span className="qvx-score-text">
              <span className={'cph-qv-tag' + (b.top || latest.flagged ? ' is-warn' : '')}>{b.label}</span>
              {latest.flagged && <span className="cph-qv-tag is-warn">Item {form.flag_item} endorsed</span>}
              <span className="qvx-score-date">{fmtDate(latest.date)} · {sName(latest.administered_by_staff_id)}</span>
              <span className="lnk qvx-score-open">View answers</span>
            </span>
          </button>
          {!!earlier.length && (
            <table className="data-table compact qvx-table qvx-side">
              <thead><tr><th>Earlier</th><th>Score</th><th>Result</th></tr></thead>
              <tbody>{earlier.map(a => (
                <tr key={a.administration_id} className="qvx-click" onClick={() => setOpen(a)}>
                  <td><button className="lnk" onClick={e => { e.stopPropagation(); setOpen(a); }}>{fmtDate(a.date)}</button></td>
                  <td>{a.score}</td><td>{formBand(form, a.score).label}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : <QvxEmpty>No {form.name} on file.</QvxEmpty>}
      {open && <AssessmentAnswersOverlay form={form} admin={open} client={client} onClose={() => setOpen(null)} />}
      {adding && <NewAssessmentOverlay form={form} client={client} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AssessmentAnswersOverlay({ form, admin, client, onClose }) {
  const label = v => (form.scale.find(s => s[1] === v) || [String(v)])[0];
  const b = formBand(form, admin.score);
  return (
    <Overlay size={form.items.length > 12 ? 'lg' : 'md'} title={form.name + ' · ' + fmtDate(admin.date)} subtitle={client.displayName + ' · ' + form.full_name}
      onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="ovl-facts">
        <div><span>Form date</span><b>{fmtDate(admin.date)}</b></div>
        <div><span>Administered by</span><b>{sName(admin.administered_by_staff_id)}</b></div>
        <div><span>Score</span><b>{admin.score} / {formMax(form)}</b></div>
        <div><span>Result</span><b><span className={'cph-qv-tag' + (b.top || admin.flagged ? ' is-warn' : '')}>{b.label}</span></b></div>
      </div>
      <div className="ovl-prompt">{form.prompt}</div>
      <ol className="ovl-answers">
        {form.items.map((it, i) => (
          <li key={i} className={form.flag_item === i + 1 && admin.responses[i] > 0 ? 'is-flagged' : ''}>
            <span className="ovl-q">{it}</span><span className="ovl-a">{label(admin.responses[i])}</span>
          </li>
        ))}
      </ol>
      <div className="ovl-total"><span>Total score</span><b>{admin.score}</b></div>
    </Overlay>
  );
}

function NewAssessmentOverlay({ form, client, onClose }) {
  const guard = useGuard();
  const [date, setDate] = useState(isoOf(TODAY));
  const [resp, setResp] = useState(() => form.items.map(() => null));
  const [tried, setTried] = useState(false);
  const answered = resp.filter(v => v != null).length;
  const score = resp.reduce((n, v) => n + (v || 0), 0);
  const b = formBand(form, score);
  const save = () => {
    setTried(true);
    if (answered < form.items.length || !date) return;
    const flagged = !!(form.flag_item && resp[form.flag_item - 1] > 0);
    addRecord('admins', { administration_id: newId('ADM'), client_id: client.client_id, form_id: form.form_id, date,
      administered_by_staff_id: ME.id, responses: resp, score, band: b.label, flagged });
    guard.setToast({ status: 'success', title: form.name + ' saved', detail: 'Score ' + score + ' · ' + b.label });
    onClose();
  };
  return (
    <Overlay size={form.items.length > 12 ? 'lg' : 'md'} title={'New ' + form.name} subtitle={client.displayName + ' · ' + form.full_name} onClose={onClose}
      footer={<React.Fragment>
        <span className="ovl-running">{answered} of {form.items.length} answered · Score {score} · {b.label}</span>
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save {form.name}</Button>
      </React.Fragment>}>
      <div className="ovl-grid ovl-grid--2"><DateField label="Entry date" required value={date} onChange={setDate} error={tried && !date ? 'Date is required.' : null} /></div>
      {tried && answered < form.items.length && (
        <div className="chc-note chc-note--warn"><Icon name="warn" size={15} /> {form.items.length - answered} question{form.items.length - answered === 1 ? '' : 's'} still need an answer.</div>
      )}
      <div className="ovl-prompt">{form.prompt}</div>
      <ol className="ovl-form">
        {form.items.map((it, i) => (
          <li key={i} className={tried && resp[i] == null ? 'is-missing' : ''}>
            <span className="ovl-q">{it}<span className="ff-req"> *</span></span>
            <span className="ovl-opts">
              {form.scale.map(([lab, val]) => (
                <Radio key={lab} name={form.form_id + '-' + i} label={lab} checked={resp[i] === val}
                  onChange={() => setResp(r => r.map((x, j) => (j === i ? val : x)))} />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </Overlay>
  );
}

/* ================= Medications =================
   The one quick view a prescriber may live in while writing a note: see what's
   current, look back at expired and discontinued, refill or discontinue in
   bulk, and add a new prescription — all without leaving the note. Controlled
   substances carry their schedule everywhere and get extra safeguards. */
const MED_FILTERS = ['Current', 'Expired', 'Discontinued', 'All'];
const medInFilter = (m, f) => f === 'All' || (f === 'Current' ? m.status === 'Active' : m.status === f);
const refillBlock = m => (m.status === 'Discontinued' ? 'Discontinued — write a new prescription instead.'
  : m.schedule === 'C-II' ? 'Schedule II — refills aren’t permitted. A new prescription is required.' : null);

function MedicationsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const all = getMeds(client);
  const [filter, setFilter] = useState(view.options.defaultFilter || 'Current');
  const [sel, setSel] = useState([]);
  const [mode, setMode] = useState(null);       // 'refill' | 'discontinue' | 'add'
  useEffect(() => { setSel([]); }, [filter, client.client_id]);
  const rows = all.filter(m => medInFilter(m, filter));
  const count = f => all.filter(m => medInFilter(m, f)).length;
  const chosen = all.filter(m => sel.indexOf(m.med_rx_id) !== -1);
  const toggle = id => setSel(s => (s.indexOf(id) !== -1 ? s.filter(x => x !== id) : s.concat([id])));
  const allOn = rows.length > 0 && rows.every(m => sel.indexOf(m.med_rx_id) !== -1);
  const canRefill = chosen.some(m => !refillBlock(m));
  const canDc = chosen.some(m => m.status === 'Active');
  return (
    <div className="cph-qvx">
      <QvBar title="Medications" meta={count('Current') + ' current'} preview={preview}
        onViewAll={() => go('Prescription')} onAdd={() => setMode('add')} addLabel="Add Medication" />
      <div className="qvx-filterrow">
        <div className="qvx-filters" role="tablist" aria-label="Filter medications">
          {MED_FILTERS.map(f => (
            <button key={f} role="tab" aria-selected={filter === f} className={'cph-pill' + (filter === f ? ' selected' : '')}
              onClick={() => setFilter(f)}>{f} ({f === 'All' ? all.length : count(f)})</button>
          ))}
        </div>
        {!preview && (
          <div className={'qvx-bulk' + (sel.length ? ' on' : '')} aria-live="polite">
            <span className="qvx-bulk-n">{sel.length ? sel.length + ' selected' : 'Select medications to refill or discontinue'}</span>
            <Button size="sm" variant="secondary" disabled={!canRefill} onClick={() => setMode('refill')}><Icon name="refill" size={14} /> Refill</Button>
            <Button size="sm" variant="secondary" disabled={!canDc} onClick={() => setMode('discontinue')}><Icon name="ban" size={14} /> Discontinue</Button>
          </div>
        )}
      </div>
      {rows.length ? (
        <table className="data-table compact qvx-table qvx-meds">
          <thead><tr>
            {!preview && <th className="col-check"><Checkbox checked={allOn} indeterminate={!allOn && rows.some(m => sel.indexOf(m.med_rx_id) !== -1)} ariaLabel="Select all shown"
              onChange={v => setSel(v ? rows.map(m => m.med_rx_id) : [])} /></th>}
            <th>Medication</th><th>Directions</th><th>Refills left</th><th>{filter === 'Current' ? 'Ends' : 'Dates'}</th>
            {view.options.showPharmacy && <th>Pharmacy</th>}<th>Status</th>
          </tr></thead>
          <tbody>{rows.map(m => (
            <tr key={m.med_rx_id} className={sel.indexOf(m.med_rx_id) !== -1 ? 'is-selected' : ''}>
              {!preview && <td className="col-check"><Checkbox checked={sel.indexOf(m.med_rx_id) !== -1} onChange={() => toggle(m.med_rx_id)} ariaLabel={'Select ' + m.medication_display} /></td>}
              <td className="wrap">
                <RecLink preview={preview} onOpen={() => go('Prescription')}>{m.medication_display}</RecLink>
                {m.schedule && <Tooltip label={'Controlled substance, Schedule ' + m.schedule.slice(2)}><span className="badge status-neutral qvx-sched"><Icon name="shield" size={11} /> {m.schedule}</span></Tooltip>}
                <div className="cell-sub">{m.drug_class} · {sName(m.prescriber_staff_id)}</div>
              </td>
              <td className="wrap qvx-sig">{m.sig}</td>
              <td>{m.status === 'Active' ? m.refills_remaining + ' of ' + m.refills_authorized : '—'}</td>
              <td>{m.status === 'Discontinued' ? 'Stopped ' + fmtDate(m.discontinued_date) : (m.status === 'Active' ? '' : 'Ended ') + fmtDate(m.end_date)}
                <div className="cell-sub">Last filled {fmtDate(m.last_filled)}</div></td>
              {view.options.showPharmacy && <td className="wrap">{m.pharmacy}</td>}
              <td>
                <span className={'cph-qv-tag' + (m.status === 'Active' && m.rx_status && /PENDING/.test(m.rx_status) ? ' is-warn' : '')}>
                  {m.status === 'Active' && /PENDING/.test(m.rx_status || '') ? 'Pending signature' : m.status}
                </span>
                {m.discontinued_reason && <div className="cell-sub">{m.discontinued_reason}</div>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>No {filter === 'All' ? '' : filter.toLowerCase() + ' '}medications.</QvxEmpty>}
      {mode === 'refill' && <RefillOverlay client={client} meds={chosen} onClose={() => setMode(null)} onDone={() => { setMode(null); setSel([]); }} />}
      {mode === 'discontinue' && <DiscontinueOverlay client={client} meds={chosen.filter(m => m.status === 'Active')} onClose={() => setMode(null)} onDone={() => { setMode(null); setSel([]); }} />}
      {mode === 'add' && <AddMedicationOverlay client={client} onClose={() => setMode(null)} />}
    </div>
  );
}

/* Where each refill goes. Prescriptions often split across pharmacies — a
   controlled substance needs an EPCS-enabled one, coverage and copay differ by
   pharmacy, mail order suits a 90-day maintenance med, and the client has a
   usual pharmacy. Directory, coverage and EPCS flags would come from
   Surescripts; here they are mocked (16-records.jsx) to hint at the decision. */
function PharmacyPick({ client, med, value, onChange, compact }) {
  const ph = PHARMACY_BY_NAME[value];
  const ben = pharmacyBenefit(ph, med);
  return (
    <div className="rx-pharm">
      <Dropdown value={value} options={pharmacyOptions(client, med)} onChange={onChange} menuMinWidth={400} footer={SURESCRIPTS_NOTE} />
      {!compact && ph && (
        <div className="rx-pharm-meta">
          {ben && <span className={'dd-tag' + (ben.tone ? ' dd-tag--' + ben.tone : '')}>{ben.label}</span>}
          {ph.limit && med && med.schedule && <span className="dd-tag dd-tag--warn">Limited supply</span>}
        </div>
      )}
    </div>
  );
}
/* Start each refill at its current pharmacy unless that pharmacy can't take
   it (a controlled med at a non-EPCS store) — then move it to the client's
   preferred pharmacy that can, and say so. */
const firstOpenPharmacy = (client, med, want) => {
  const opts = pharmacyOptions(client, med);
  const w = opts.find(o => o.value === want);
  return w && !w.disabled ? want : (opts.find(o => !o.disabled) || {}).value;
};

function RefillOverlay({ client, meds, onClose, onDone }) {
  const guard = useGuard();
  const ok = meds.filter(m => !refillBlock(m));
  const blocked = meds.filter(m => refillBlock(m));
  const controlled = ok.some(m => m.schedule);
  const [pharmacy, setPharmacy] = useState(() => Object.fromEntries(ok.map(m => [m.med_rx_id, firstOpenPharmacy(client, m, m.pharmacy)])));
  const moved = ok.filter(m => m.pharmacy && pharmacy[m.med_rx_id] !== m.pharmacy && pharmacyBlock(PHARMACY_BY_NAME[m.pharmacy], m));
  const [attest, setAttest] = useState(false);
  const [tried, setTried] = useState(false);
  const sendAllTo = name => setPharmacy(p => Object.fromEntries(ok.map(m => [m.med_rx_id, pharmacyBlock(PHARMACY_BY_NAME[name], m) ? p[m.med_rx_id] : name])));
  const allSame = ok.every(m => pharmacy[m.med_rx_id] === pharmacy[(ok[0] || {}).med_rx_id]);
  const destinations = new Set(ok.map(m => pharmacy[m.med_rx_id])).size;
  const send = () => {
    setTried(true);
    if (controlled && !attest) return;
    patchMeds(ok.map(m => m.med_rx_id), id => {
      const m = ok.find(x => x.med_rx_id === id);
      const renew = m.status === 'Expired';
      return {
        status: 'Active', pharmacy: pharmacy[id], last_filled: isoOf(TODAY),
        refills_remaining: renew ? m.refills_authorized : Math.max(0, m.refills_remaining - 1),
        end_date: isoOf(addDays(TODAY, m.days_supply || 30)),
        rx_status: m.schedule ? 'PENDING EPCS SIGNATURE' : 'E-PRESCRIBED',
      };
    });
    guard.setToast({ status: 'success', title: ok.length + ' refill' + (ok.length === 1 ? '' : 's') + ' sent',
      detail: (destinations > 1 ? 'Routed to ' + destinations + ' pharmacies. ' : '') + (controlled ? 'Controlled substances are pending your two-factor signature.' : 'Sent via Surescripts.') });
    onDone();
  };
  return (
    <Overlay size="lg" title={'Refill ' + ok.length + ' Medication' + (ok.length === 1 ? '' : 's')} subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment>
        {ok.length > 1 && <span className="ovl-running">{destinations === 1 ? 'All to ' + pharmacy[ok[0].med_rx_id] : 'Routed to ' + destinations + ' pharmacies'}</span>}
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!ok.length} onClick={send}>Send {ok.length} Refill{ok.length === 1 ? '' : 's'}</Button></React.Fragment>}>
      {controlled && (
        <div className="chc-note chc-note--warn"><Icon name="warn" size={15} />
          <div>This refill includes a controlled substance. It's sent as an electronic prescription for controlled substances (EPCS) and needs your two-factor signature before the pharmacy receives it. Only EPCS-enabled pharmacies can receive it.</div>
        </div>
      )}
      {!!moved.length && (
        <div className="chc-note chc-note--info"><Icon name="info" size={15} />
          <div>{moved.map(m => m.medication_display).join(', ')} {moved.length === 1 ? 'was' : 'were'} last filled at {moved[0].pharmacy}, which can’t receive controlled-substance prescriptions — moved to {pharmacy[moved[0].med_rx_id]}.</div>
        </div>
      )}
      <div className="rx-route">
        <div className="rx-route-copy">
          <div className="ovl-prompt">Pharmacy per medication</div>
          <div className="ovl-hint">Each refill can go to a different pharmacy — for coverage, controlled-substance rules, supply, or what the client prefers.</div>
        </div>
        {ok.length > 1 && (
          <div className="rx-route-all">
            <span className="ovl-hint">Send all to</span>
            <Dropdown value={allSame ? pharmacy[ok[0].med_rx_id] : ''} placeholder="Choose a pharmacy…" options={pharmacyOptions(client, null)}
              onChange={sendAllTo} menuMinWidth={400} footer="Medications a pharmacy can’t receive keep their current choice." />
          </div>
        )}
      </div>
      <table className="data-table compact rx-table">
        <colgroup><col /><col style={{ width: 130 }} /><col style={{ width: 120 }} /><col style={{ width: 340 }} /></colgroup>
        <thead><tr><th>Medication</th><th>Refills left</th><th>Last filled</th><th>Pharmacy · coverage</th></tr></thead>
        <tbody>{ok.map(m => (
          <tr key={m.med_rx_id}>
            <td className="wrap">{m.medication_display}{m.schedule && <span className="badge status-neutral qvx-sched"><Icon name="shield" size={11} /> {m.schedule}</span>}
              {m.status === 'Expired' && <div className="cell-sub">Expired {fmtDate(m.end_date)} — refilling renews it</div>}</td>
            <td>{m.status === 'Expired' ? m.refills_authorized + ' (renewed)' : m.refills_remaining + ' → ' + Math.max(0, m.refills_remaining - 1)}</td>
            <td>{fmtDate(m.last_filled)}<div className="cell-sub">{m.pharmacy || '—'}</div></td>
            <td><PharmacyPick client={client} med={m} value={pharmacy[m.med_rx_id]} onChange={v => setPharmacy(p => ({ ...p, [m.med_rx_id]: v }))} /></td>
          </tr>
        ))}</tbody>
      </table>
      {!!blocked.length && (
        <div className="ovl-blocked">
          <div className="ovl-blocked-head">Not included ({blocked.length})</div>
          {blocked.map(m => <div key={m.med_rx_id} className="ovl-blocked-row"><b>{m.medication_display}</b> — {refillBlock(m)}</div>)}
        </div>
      )}
      {controlled && (
        <div className={'ovl-attest' + (tried && !attest ? ' is-missing' : '')}>
          <Checkbox checked={attest} onChange={setAttest} label="I've reviewed the state prescription monitoring program (PDMP) for this client today." />
        </div>
      )}
    </Overlay>
  );
}

function DiscontinueOverlay({ client, meds, onClose, onDone }) {
  const guard = useGuard();
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(isoOf(TODAY));
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const go = () => {
    setTried(true);
    if (!reason || !date) return;
    patchMeds(meds.map(m => m.med_rx_id), () => ({ status: 'Discontinued', discontinued_date: date, discontinued_reason: reason, refills_remaining: 0, rx_status: 'DISCONTINUED' }));
    guard.setToast({ status: 'success', title: meds.length + ' medication' + (meds.length === 1 ? '' : 's') + ' discontinued', detail: reason + ' · effective ' + fmtDate(date) });
    onDone();
  };
  return (
    <Overlay size="md" title={'Discontinue ' + meds.length + ' Medication' + (meds.length === 1 ? '' : 's')} subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Discontinue {meds.length}</Button></React.Fragment>}>
      <ul className="ovl-list">{meds.map(m => <li key={m.med_rx_id}><b>{m.medication_display}</b> <span className="cell-sub">{m.sig}</span></li>)}</ul>
      <div className="ovl-grid ovl-grid--2">
        <Field label="Reason" required error={tried && !reason ? 'A reason is required.' : null}>
          <Dropdown value={reason} options={['Adverse effect', 'Ineffective', 'Client request', 'Changed to alternative', 'Course completed', 'Duplicate therapy', 'Other']} onChange={setReason} invalid={tried && !reason} />
        </Field>
        <DateField label="Effective date" required value={date} onChange={setDate} error={tried && !date ? 'Date is required.' : null} />
      </div>
      <Field label="Comment" wide><TextArea value={comment} onChange={setComment} rows={2} /></Field>
      <div className="ovl-hint">The pharmacy is notified of the discontinuation. The medication stays on the chart under Discontinued.</div>
    </Overlay>
  );
}

/* Field set and order follow production's Add Medications form (structure
   only — styling is the DS). Safeguards are demonstrated, not complete:
   schedule-aware refills, required DEA number, an allergy cross-check, and a
   42 CFR Part 2 default for SUD medications. */
const INTERVALS = ['Daily', 'Twice daily', 'Three times daily', 'Every morning', 'At bedtime', 'Every 8 hours', 'Every 6 hours', 'Weekly'];
const TARGET_SYMPTOMS = ['Depression', 'Anxiety', 'Psychosis', 'Mood stabilization', 'Sleep', 'Focus and concentration', 'Opioid use disorder', 'Alcohol use disorder', 'Withdrawal', 'Nightmares', 'Other'];
const SUD_CLASSES = ['Partial Opioid Agonist', 'Opioid Antagonist'];
const SENSITIVITY = ['Standard', 'Sensitive — substance use (42 CFR Part 2)', 'Sensitive — mental health'];
/* Fictional DEA registrations for the synthetic prescribers. */
const DEA_ON_FILE = { 'ST-2002': 'On file · ending 4821', 'ST-2001': 'On file · ending 3307', 'ST-2008': null };

function AddMedicationOverlay({ client, onClose }) {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const [med, setMed] = useState(null);
  const [f, setF] = useState({
    provider: sName('ST-2002'), site: client.siteName && client.siteName !== '—' ? client.siteName : '', dea: '',
    strength: '', number: '1', interval: 'Daily', asNeeded: false, withFood: false, pharmacy: preferredPharmacy(client),
    target: '', duration: '30', qty: '30', refills: '0', directions: '', notes: '', subs: 'Allowed', cpoe: false,
    sensitivity: 'Standard', dx: true, spanish: false, manual: false, allergyAck: false,
  });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const prescriberId = PRESCRIBER_IDS.find(id => sName(id) === f.provider);
  const deaOnFile = prescriberId ? DEA_ON_FILE[prescriberId] : null;

  const s = q.trim().toLowerCase();
  const results = s.length < 2 ? [] : FORMULARY.filter(m => (m.name + ' ' + m.class).toLowerCase().indexOf(s) !== -1)
    .flatMap(m => m.strengths.map(st => ({ ...m, strength: st }))).slice(0, 8);

  const choose = m => {
    setMed(m); setQ('');
    const sud = SUD_CLASSES.indexOf(m.class) !== -1;
    setF(x => ({ ...x, strength: m.strength, refills: m.schedule === 'C-II' ? '0' : x.refills,
      duration: m.schedule === 'C-II' && parseInt(x.duration, 10) > 30 ? '30' : x.duration,
      sensitivity: sud ? SENSITIVITY[1] : x.sensitivity, dea: m.schedule ? (deaOnFile || '') : '', allergyAck: false,
      pharmacy: firstOpenPharmacy(client, m, x.pharmacy) }));
  };
  /* Auto-compose directions until the prescriber edits them by hand. */
  const autoSig = med ? ['Take', f.number, med.name.toLowerCase().indexOf('film') !== -1 ? 'film' : 'tablet' + (f.number !== '1' ? 's' : ''),
    'by mouth', f.interval.toLowerCase(), f.asNeeded ? 'as needed' : '', f.withFood ? 'with food' : '', f.target ? 'for ' + f.target.toLowerCase() : '']
    .filter(Boolean).join(' ') : '';
  const directions = f.directions || autoSig;

  const sched = med && med.schedule;
  const conflict = med && getAllergies(client).find(a => (a.status || 'Active') === 'Active' && (() => {
    const al = a.allergen.toLowerCase(), cl = med.class.toLowerCase(), nm = med.name.toLowerCase();
    return nm.indexOf(al.split(' ')[0]) !== -1 || al.indexOf(nm.split(' ')[0]) !== -1
      || (cl === 'stimulant' && al.indexOf('amphetamine') !== -1) || (cl === 'benzodiazepine' && al.indexOf('benzo') !== -1);
  })());
  const errs = {
    med: !med && 'Choose a medication.', provider: !f.provider && 'Provider is required.', site: !f.site && 'Sending site is required.',
    dea: sched && !f.dea && 'A DEA number is required for controlled substances.', qty: !f.qty && 'Quantity is required.',
    directions: !directions && 'Directions are required.', ack: conflict && !f.allergyAck && 'Acknowledge the allergy alert to continue.',
  };
  const bad = Object.values(errs).some(Boolean);
  const e = k => (tried ? errs[k] || null : null);

  const submit = () => {
    setTried(true);
    if (bad) return;
    addRecord('meds', { med_rx_id: newId('MRX'), client_id: client.client_id, medication_id: med.medication_id,
      medication_display: med.name + ' ' + f.strength, strength: f.strength, form: 'Tablet', drug_class: med.class,
      schedule: sched || null, sig: directions, qty: parseInt(f.qty, 10), days_supply: parseInt(f.duration, 10) || 30,
      refills_authorized: parseInt(f.refills, 10) || 0, refills_remaining: parseInt(f.refills, 10) || 0,
      prescriber_staff_id: prescriberId || ME.id, pharmacy: f.pharmacy, start_date: isoOf(TODAY),
      end_date: isoOf(addDays(TODAY, (parseInt(f.duration, 10) || 30) * (1 + (parseInt(f.refills, 10) || 0)))), last_filled: isoOf(TODAY),
      status: 'Active', rx_status: sched ? 'PENDING EPCS SIGNATURE' : (f.manual ? 'PAPER/FAX' : 'E-PRESCRIBED'),
      discontinued_date: null, discontinued_reason: null, sensitivity: f.sensitivity });
    guard.setToast({ status: 'success', title: 'Medication added', detail: med.name + ' ' + f.strength + (sched ? ' · pending your two-factor signature' : ' · sent to ' + f.pharmacy) });
    onClose();
  };

  return (
    <Overlay size="lg" title="Add Medication" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit}>{sched ? 'Add and Sign (EPCS)' : 'Add Medication'}</Button></React.Fragment>}>
      <Field label="Search for medication" required error={e('med')}>
        {med ? (
          <div className="ovl-chosen">
            <b>{med.name}</b>
            {sched && <span className="badge status-neutral qvx-sched"><Icon name="shield" size={11} /> {sched}</span>}
            <span className="cell-sub">{med.class} · {med.common_use}</span>
            <span className="spacer" />
            <button className="lnk" onClick={() => setMed(null)}>Change</button>
          </div>
        ) : (
          <div className="ovl-search">
            <div className={'form-input' + (e('med') ? ' invalid' : '')}><Icon name="search" size={15} />
              <input autoFocus value={q} onChange={ev => setQ(ev.target.value)} placeholder="Type at least 2 letters — name or class" aria-label="Search for medication" /></div>
            {!!results.length && (
              <table className="data-table compact ovl-results">
                <thead><tr><th>Medication name</th><th>Strength</th><th>Class</th><th>Controlled level</th></tr></thead>
                <tbody>{results.map(r => (
                  <tr key={r.medication_id + r.strength} className="qvx-click" onClick={() => choose(r)}>
                    <td><button className="lnk" onClick={ev => { ev.stopPropagation(); choose(r); }}>{r.name}</button></td>
                    <td>{r.strength}</td><td>{r.class}</td><td>{r.schedule ? r.schedule : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {s.length >= 2 && !results.length && <div className="ovl-hint">No formulary match for “{q}”.</div>}
          </div>
        )}
      </Field>

      {conflict && (
        <div className="ovl-alert ovl-alert--danger">
          <Icon name="warn" size={16} />
          <div><b>Possible allergy conflict.</b> This client has an active <b>{conflict.allergen}</b> allergy ({conflict.reaction || 'reaction not recorded'}, {conflict.severity_flag} severity).
            <div className="ovl-attest-inline"><Checkbox checked={f.allergyAck} onChange={v => set('allergyAck', v)} label="I've reviewed the allergy and want to prescribe anyway." /></div>
            {e('ack') && <div className="ff-error"><Icon name="warn" size={13} /> {e('ack')}</div>}
          </div>
        </div>
      )}
      {sched && (
        <div className="chc-note chc-note--warn"><Icon name="warn" size={15} />
          <div><b>Schedule {sched.slice(2)} controlled substance.</b> {sched === 'C-II'
            ? 'No refills; maximum 30-day supply per prescription.'
            : 'Up to 5 refills within 6 months of the written date.'} Requires the prescriber’s DEA number and a two-factor EPCS signature.</div>
        </div>
      )}

      <div className="ovl-grid ovl-grid--3">
        <Field label="Provider" required error={e('provider')}>
          <Dropdown value={f.provider} options={PRESCRIBER_IDS.map(sName)} invalid={!!e('provider')}
            onChange={v => { const id = PRESCRIBER_IDS.find(x => sName(x) === v); setF(x => ({ ...x, provider: v, dea: sched ? (DEA_ON_FILE[id] || '') : '' })); }} />
        </Field>
        <Field label="Sending site" required error={e('site')}>
          <Dropdown value={f.site} options={(RD.sites || []).map(x => x.name)} onChange={v => set('site', v)} invalid={!!e('site')} />
        </Field>
        <Field label="Provider’s DEA number" required={!!sched} error={e('dea')} hint={sched ? null : 'Only needed for controlled substances'}>
          <Dropdown value={f.dea} options={deaOnFile ? [deaOnFile] : []} placeholder={deaOnFile ? 'Please select…' : 'No DEA registration on file'}
            onChange={v => set('dea', v)} invalid={!!e('dea')} />
        </Field>

        <Field label="Form – strength"><Dropdown value={f.strength} options={med ? med.strengths : []} placeholder={med ? 'Please select…' : 'Choose a medication first'} onChange={v => set('strength', v)} /></Field>
        <Field label="Number"><Dropdown value={f.number} options={['1', '2', '3', '½']} onChange={v => set('number', v)} /></Field>
        <Field label="Interval"><Dropdown value={f.interval} options={INTERVALS} onChange={v => set('interval', v)} /></Field>

        <Field label="Instructions"><div className="ff-inline ovl-checks">
          <Checkbox checked={f.asNeeded} onChange={v => set('asNeeded', v)} label="As needed" />
          <Checkbox checked={f.withFood} onChange={v => set('withFood', v)} label="With food" />
        </div></Field>
        <Field label="Pharmacy" hint={med ? null : 'Coverage shows once a medication is chosen'}>
          <PharmacyPick client={client} med={med} value={f.pharmacy} onChange={v => set('pharmacy', v)} />
        </Field>
        <Field label="Target symptom"><Dropdown value={f.target} options={TARGET_SYMPTOMS} onChange={v => set('target', v)} /></Field>

        <Field label="Duration" hint={sched === 'C-II' ? 'Maximum 30 days' : null}>
          <TextIn value={f.duration} suffix="days" inputMode="numeric"
            onChange={v => { const n = v.replace(/\D/g, ''); set('duration', sched === 'C-II' && parseInt(n, 10) > 30 ? '30' : n); }} /></Field>
        <Field label="Quantity" required error={e('qty')}><TextIn value={f.qty} onChange={v => set('qty', v.replace(/\D/g, ''))} inputMode="numeric" invalid={!!e('qty')} /></Field>
        <Field label="Refills" hint={sched === 'C-II' ? 'Not permitted for Schedule II' : sched ? 'Maximum 5' : null}>
          <Dropdown value={f.refills} options={sched === 'C-II' ? ['0'] : sched ? ['0', '1', '2', '3', '4', '5'] : ['0', '1', '2', '3', '4', '5', '6', '11']} onChange={v => set('refills', v)} />
        </Field>
      </div>

      <Field label="Directions" required error={e('directions')} hint={(1000 - directions.length) + ' characters remaining' + (!f.directions && autoSig ? ' · composed from the fields above' : '')} wide>
        <TextArea value={directions} onChange={v => set('directions', v.slice(0, 1000))} rows={2} invalid={!!e('directions')} />
      </Field>
      <Field label="Notes to pharmacist" hint="No SIG, effective date or drug name here." wide>
        <TextArea value={f.notes} onChange={v => set('notes', v)} rows={2} />
      </Field>

      <div className="ovl-grid ovl-grid--3">
        <Field label="Substitutions"><RadioGroup name="subs" options={['Allowed', 'Not allowed']} value={f.subs} onChange={v => set('subs', v)} /></Field>
        <Field label="Sensitivity classification" hint={med && SUD_CLASSES.indexOf(med.class) !== -1 ? 'Defaulted for a substance-use medication' : null}>
          <Dropdown value={f.sensitivity} options={SENSITIVITY} onChange={v => set('sensitivity', v)} />
        </Field>
        <Field label="Options"><div className="ovl-checks ovl-checks--col">
          <Checkbox checked={f.dx} onChange={v => set('dx', v)} label="Include Dx codes" />
          <Checkbox checked={f.cpoe} onChange={v => set('cpoe', v)} label="CPOE" />
          <Checkbox checked={f.spanish} onChange={v => set('spanish', v)} label="Pharmacist directions in Spanish" />
          <Checkbox checked={f.manual} disabled={!!sched} onChange={v => set('manual', v)} label="Manual print (not e-prescribed)" />
        </div></Field>
      </div>
    </Overlay>
  );
}

/* ---- Dispatcher used by QuickViewBody ------------------------------ */
const CLINICAL_QV = {
  allergies: AllergiesQV, medications: MedicationsQV, vitals: VitalsQV,
  immunizations: ImmunizationsQV, injections: InjectionsQV, serviceplans: ServicePlansQV,
};
function ClinicalQuickView(props) {
  const def = QV_BY_KEY[props.view.key];
  const C = CLINICAL_QV[props.view.key] || (def && def.form ? InstrumentQV : null);
  return C ? <C {...props} /> : null;
}
const isClinicalQV = key => !!(CLINICAL_QV[key] || (QV_BY_KEY[key] && QV_BY_KEY[key].form));

/* ================= Client notes =================
   Notes care-team staff leave each other about this client. Always in the
   header — not configurable — because missing one is a care risk, not a
   preference. The badge counts notes sent with Notify Care Team that the
   signed-in user hasn't marked read — the same notes the bell counts. */
function ClientNotesButton({ client, preview }) {
  useRecordsVersion();
  const [open, setOpen] = useState(false);
  const unread = getNotes(client).filter(noteNeedsRead).length;
  const label = 'Client Notes' + (unread ? ' · ' + unread + ' unread' : '');
  return (
    <React.Fragment>
      <Tooltip label={label}>
        <button className="cph-icon-btn cph-notes-btn" aria-label={label} onClick={() => setOpen(true)}>
          <Icon name="clientNote" size={20} />
          {unread > 0 && <span className="cph-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </Tooltip>
      {open && <ClientNotesOverlay client={client} preview={preview} onClose={() => setOpen(false)} />}
    </React.Fragment>
  );
}

/* A conversation, not an inbox: oldest at the top, newest at the bottom, day
   dividers, and a composer underneath so replying is where the eye already
   is. Every note carries its author's avatar; the signed-in user's own notes
   sit on the right. Used twice — the header's Client Notes overlay and the
   Client Summary widget — over the same session store, so marking a note read
   (or deleting one) in either place shows in both and in the header badge. */
const noteAgo = iso => { const d = Math.round((TODAY - _parse(iso)) / 86400000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : fmtDate(iso); };
const noteTime = iso => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
const staffRole = id => (STAFF[id] ? roleName(STAFF[id].role_id) : '');
/* Topics come from an agency-configured table in production (source still
   to be confirmed; it has duplicates). This is a generic, de-duplicated
   stand-in — no customer facility or pharmacy names — kept in the same long,
   alphabetical, pick-one interaction. */
const NOTE_TOPICS = ['Alcohol use', 'Allergies', 'Annual exam', 'Arrest / incarceration', 'Benzodiazepines', 'Care coordination',
  'Contact information', 'Court / legal', 'Dental exam', 'Guardian', 'History', 'Hospital discharge', 'Housing', 'Illicit drug use',
  'Incomplete labs', 'Judicial review', 'Lab results', 'Medical follow-up', 'Medication box monitoring', 'Medications', 'No-shows',
  'Opioids', 'Other', 'Overdose', 'Pending referral — prior authorization needed', 'Pharmacy', 'Referrals', 'Scheduling',
  'Stimulants', 'Substance use', 'Suboxone treatment', 'Therapy', 'Transportation'];
const NOTIFY_TEAM_TIP = 'Sends this note to the notification center of everyone on this client’s care team. It adds to their notification count until each person marks it read, and that read receipt is recorded. Leave it unchecked to keep the note on the client’s chart only. Use it for something the team needs to know today — a missed dose, a safety concern, a change in plan. For an emergency, call as well.';
const NotesTitle = ({ children }) => <React.Fragment>{children} <span className="cn-internal">(Internal)</span></React.Fragment>;

/* A new note's fields — production's: Importance (default Low) and Topic,
   both required, the note text, Display in Client Header (always on) and
   Notify Care Team (default off, so reaching colleagues is a choice). Shared
   by the thread's inline composer and the Add Internal Note dialog. */
const NOTE_BLANK = { importance: 'Low', topic: '', body: '', notify: false };
function useNoteDraft(client) {
  const [d, setD] = useState(NOTE_BLANK);
  const [tried, setTried] = useState(false);
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const post = () => {
    setTried(true);
    if (!d.body.trim() || !d.topic) return false;
    addNote(client, { body: d.body.trim(), topic: d.topic, importance: d.importance, notify: d.notify });
    setD(NOTE_BLANK); setTried(false);
    return true;
  };
  return { d, set, tried, post };
}
function NoteFields({ draft, client, preview, onSubmit, rows = 2, trailing }) {
  const { d, set, tried } = draft;
  const first = (client.displayName || '').split(/\s+/)[0].replace(/[“”"]/g, '');
  return (
    <React.Fragment>
      <div className="cn-compose-fields">
        <Field label="Importance" required>
          <Dropdown value={d.importance} options={NOTE_IMPORTANCE} onChange={v => set('importance', v)} />
        </Field>
        <Field label="Topic" required error={tried && !d.topic ? 'Choose a topic.' : null}>
          <Dropdown value={d.topic} options={NOTE_TOPICS} placeholder="Please select an option" onChange={v => set('topic', v)} invalid={tried && !d.topic} menuMinWidth={280} />
        </Field>
      </div>
      <Field label="Note" required error={tried && !d.body.trim() ? 'Write the note.' : null} wide>
        <textarea className={'ta cn-input' + (tried && !d.body.trim() ? ' invalid' : '')} rows={rows} value={d.body} disabled={preview} aria-label="Note"
          placeholder={preview ? 'Not available in the preview' : 'Write a note for ' + first + '’s care team…'}
          onChange={e => set('body', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit && onSubmit(); } }} />
      </Field>
      <div className="cn-compose-foot">
        {/* Always on: every note shows in the client header. Kept visible
            for now so the field production collects is accounted for. */}
        <Checkbox checked disabled onChange={() => {}} label="Display in Client Header" />
        <span className="cn-imp-opt">
          <Checkbox checked={d.notify} disabled={preview} onChange={v => set('notify', v)} label="Notify Care Team" />
          {/* Notifying has a cost — it adds to every care-team member's
              notification count — so say so where the choice is made. */}
          <Tooltip wide label={NOTIFY_TEAM_TIP}>
            <button type="button" className="icon-btn cn-imp-info" aria-label={'About notifying the care team: ' + NOTIFY_TEAM_TIP}><Icon name="info" size={15} /></button>
          </Tooltip>
        </span>
        {trailing && <span className="spacer" />}
        {trailing}
      </div>
    </React.Fragment>
  );
}

function AddInternalNoteOverlay({ client, onClose }) {
  const guard = useGuard();
  const draft = useNoteDraft(client);
  const submit = () => { if (draft.post()) { guard.setToast({ status: 'success', title: 'Internal note added', detail: draft.d.notify ? 'The care team was notified.' : 'Saved to ' + client.name.split(' ')[0] + '’s chart.' }); onClose(); } };
  return (
    <Overlay size="md" title="Add Internal Note" subtitle={client.displayName} onClose={onClose} bodyClassName="cn-add-body"
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Post Note</Button></React.Fragment>}>
      <NoteFields draft={draft} client={client} onSubmit={submit} rows={5} />
    </Overlay>
  );
}

/* `composer={false}`: thread only (the Client Summary widget, which adds
   notes through a dialog instead). */
function ClientNotesThread({ client, preview, className, composer = true }) {
  useRecordsVersion();
  const notes = getNotes(client).slice().reverse();          // oldest → newest
  const [firstUnread] = useState(() => (notes.find(noteNeedsRead) || {}).note_id);
  const draft = useNoteDraft(client);
  const [confirmId, setConfirmId] = useState(null);
  const threadRef = useRef(null), unreadRef = useRef(null);
  const seen = useRef(notes.length);
  /* On open, land on the first note waiting on a read receipt; when a note
     is added (here or from the dialog), show it. */
  useEffect(() => {
    const t = threadRef.current; if (!t) return;
    const added = notes.length > seen.current; seen.current = notes.length;
    if (!added && unreadRef.current) t.scrollTop = unreadRef.current.offsetTop - t.offsetTop - 8;
    else t.scrollTop = t.scrollHeight;
  }, [notes.length]);
  const post = () => draft.post();
  let lastDay = null;
  return (
    <div className={'cn-wrap' + (className ? ' ' + className : '')}>
      <div className="cn-thread" ref={threadRef} aria-label="Care-team notes">
        {notes.length ? notes.map(n => {
          const mine = n.author_staff_id === ME.id;
          const day = noteAgo(n.timestamp);
          const showDay = day !== lastDay; lastDay = day;
          const name = mine ? ME.name : n.author_name || sName(n.author_staff_id);
          const role = mine ? '' : n.author_role || staffRole(n.author_staff_id);
          const confirming = confirmId === n.note_id;
          return (
            <React.Fragment key={n.note_id}>
              {showDay && <div className="cn-day"><span>{day}</span></div>}
              <article ref={n.note_id === firstUnread ? unreadRef : null}
                className={'cn-msg' + (mine ? ' is-mine' : '') + (noteNeedsRead(n) ? ' is-unread' : '') + (n.deleted ? ' is-deleted' : '')}>
                {/* Unread marker in its own left gutter, the way a phone's
                    message list does it: present on every row (empty when read)
                    so avatars stay aligned and the dot is the only difference. */}
                <span className="cn-gutter">{noteNeedsRead(n) && <span className="cn-dot" aria-hidden="true" />}</span>
                <Avatar name={name} size="M" />
                <div className="cn-msg-main">
                  <div className="cn-msg-head">
                    <span className="cn-msg-name">{mine ? 'You' : name}</span>
                    {role && role !== '—' && <span className="cn-msg-role">{role}</span>}
                    <span className="cn-msg-time">{noteTime(n.timestamp)}</span>
                    {noteNeedsRead(n) && <span className="sr-only">Unread</span>}
                  </div>
                  {n.deleted ? (
                    <div className="cn-deleted">Message deleted</div>
                  ) : confirming ? (
                    <div className="cn-bubble cn-confirm" role="alertdialog" aria-label="Delete this note?">
                      <p>Delete this note? It’s removed for everyone on the care team.</p>
                      <div className="cn-confirm-acts">
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                        <Button size="sm" variant="secondary" onClick={() => { deleteNote(n.note_id); setConfirmId(null); }}>Delete Note</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="cn-bubble-row">
                      <div className="cn-bubble">
                        {/* Topic and priority, the same way Needs Attention and
                            Notifications show them: text-only tags. */}
                        <div className="cn-bubble-top">
                          {n.topic && <b className="cn-subj">{n.topic}</b>}
                          <NTag tone={importanceTone(n.importance)}>{(n.importance || 'Low') + ' priority'}</NTag>
                          {n.notify_team && <NTag>Care team notified</NTag>}
                          {/* Written from Manage Attributes: say which attribute it's about. */}
                          {n.attribute_id && attrById(n.attribute_id) && <NTag><AttrGlyph attr={attrById(n.attribute_id)} size={14} />{attrById(n.attribute_id).name}</NTag>}
                        </div>
                        <p>{n.body}</p>
                      </div>
                      {/* Own notes: delete sits beside the bubble on hover/focus. */}
                      {mine && !preview && (
                        <Tooltip label="Delete note">
                          <button className="icon-btn cn-del" aria-label="Delete note" onClick={() => setConfirmId(n.note_id)}><Icon name="trash" size={18} /></button>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
                {/* Read state always in the same right-hand column, so the eye
                    finds it in one place on every note — but only on notes sent
                    to the team; plain notes ask nobody for a read receipt. */}
                {!mine && (
                  <div className="cn-msg-acts">
                    {!preview && !n.deleted && n.notify_team && (n.read
                      ? <Button size="sm" variant="ghost" className="cn-unread-btn" onClick={() => setNoteRead(n.note_id, false)}>Mark as Unread</Button>
                      : <Button size="sm" variant="ghost" onClick={() => setNoteRead(n.note_id, true)}><Icon name="check" size={14} /> Mark as Read</Button>)}
                  </div>
                )}
              </article>
            </React.Fragment>
          );
        }) : <div className="cph-qv-empty">No notes about this client yet. Start the conversation below.</div>}
      </div>
      {composer && (
        <div className={'cn-compose' + (preview ? ' is-inert' : '')}>
          <Avatar name={ME.name} size="M" />
          <div className="cn-compose-main">
            <NoteFields draft={draft} client={client} preview={preview} onSubmit={post}
              trailing={<Button size="sm" variant="primary" disabled={preview} onClick={post}>Post Note</Button>} />
          </div>
        </div>
      )}
    </div>
  );
}

const markAllNotesRead = client => getNotes(client).filter(noteNeedsRead).forEach(n => setNoteRead(n.note_id, true));

function ClientNotesOverlay({ client, preview, onClose }) {
  useRecordsVersion();
  const unread = getNotes(client).filter(noteNeedsRead).length;
  return (
    <Overlay size="md" title={<NotesTitle>Client Notes</NotesTitle>} onClose={onClose} bodyClassName="cn-ovl-body"
      footer={<React.Fragment>
        {!preview && <Button variant="ghost" disabled={!unread} onClick={() => markAllNotesRead(client)}>Mark All as Read{unread ? ' (' + unread + ')' : ''}</Button>}
        <span className="spacer" /><Button variant="secondary" onClick={onClose}>Close</Button>
      </React.Fragment>}>
      <ClientNotesThread client={client} preview={preview} />
    </Overlay>
  );
}

/* Client Summary widget — the same thread, inline. */
function ClientNotesPanel({ client }) {
  /* A summary, like the other widgets on this page: the thread only, no open
     composer. Writing a note is a deliberate step, in a dialog. No count and
     no Mark All as Read either — the thread scrolls, so "all" would include
     notes nobody has looked at. */
  const [adding, setAdding] = useState(false);
  return (
    <Panel title={<NotesTitle>Client Notes</NotesTitle>}
      action={<Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Add Internal Note</Button>}>
      <ClientNotesThread client={client} className="cn-wrap--panel" composer={false} />
      {adding && <AddInternalNoteOverlay client={client} onClose={() => setAdding(false)} />}
    </Panel>
  );
}
