/* ===== Record quick views ==========================================
   Diagnoses, Problems, Appointments, Clinical Notes, Assessments and
   Enrollment, in the same pattern as the clinical quick views
   (32-quickviews.jsx): what's on file, its status, when it started, who
   entered it, a link to the full page, and a quick way to add one.

   What the header deliberately does NOT do:
     - change a diagnosis's or problem's status. Resolving one is a clinical
       decision made on the full page, with its history in view.
     - enroll, discharge or assign a payor. Those are intake and billing
       workflows with their own checks; the header links to them.
     - start a long or multi-step form in a dialog. Notes open the note itself.
   ================================================================ */

/* Filter pills over a record list: "Active (4)", "All (9)". */
function QvFilters({ label, options, value, onChange, count, children }) {
  return (
    <div className="qvx-filterrow">
      <div className="qvx-filters" role="tablist" aria-label={label}>
        {options.map(f => (
          <button key={f} role="tab" aria-selected={value === f} className={'cph-pill' + (value === f ? ' selected' : '')}
            onClick={() => onChange(f)}>{f} ({count(f)})</button>
        ))}
      </div>
      {children}
    </div>
  );
}
const StatusBadge = ({ status }) => <span className={'badge ' + (STATUS_TONE[status] || 'status-neutral')}>{status}</span>;
/* Started, and ended when it has. */
const StartCell = ({ start, end }) => <td>{start ? fmtDate(start) : '—'}{end && <div className="cell-sub">Ended {fmtDate(end)}</div>}</td>;
const clientPrograms = client => (client.program_ids || []).map(prgName).filter(n => n && n !== '—');

/* A duplicate is the commonest error a quick-add form invites. Say what's
   already there, and where to change it, instead of adding a second row. */
function DuplicateNote({ what, since, onOpen }) {
  return (
    <div className="chc-note chc-note--warn"><Icon name="warn" size={15} />
      <div>{what} is already active on this chart{since ? ' (since ' + fmtDate(since) + ')' : ''}. To change it, <button className="lnk" onClick={onOpen}>open it on the full page</button>.</div>
    </div>
  );
}

/* ================= Diagnoses ================= */
const RECORD_FILTERS = ['Active', 'All'];
const dxType = code => (/^F1[0-9]/.test(code) ? 'Substance Use' : /^F/.test(code) ? 'Behavioral Health' : 'Medical');

function DiagnosesQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const o = view.options;
  const [filter, setFilter] = useState(o.defaultFilter || 'Active');
  const [adding, setAdding] = useState(false);
  const all = getDiagnoses(client);
  const active = all.filter(d => isActiveStatus(d.status));
  const rows = filter === 'All' ? all : active;
  const shown = rows.slice(0, rowLimit(o.rows));
  const open = () => go('Diagnosis');
  return (
    <div className="cph-qvx">
      <QvBar title="Diagnoses" meta={active.length + ' active'} preview={preview} onViewAll={open}
        onAdd={() => setAdding(true)} addLabel="Add Diagnosis" />
      <QvFilters label="Filter diagnoses" options={RECORD_FILTERS} value={filter} onChange={setFilter} count={f => (f === 'All' ? all.length : active.length)} />
      {rows.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Diagnosis</th><th>Behavioral</th><th>Precedence</th><th>Condition</th><th>Status</th><th>Start</th><th>Entered</th></tr></thead>
          <tbody>{shown.map(d => (
            <tr key={d.client_dx_id}>
              <td className="wrap">
                <RecLink preview={preview} onOpen={open}>{(o.showCodes ? d.icd10 + ' — ' : '') + d.description}</RecLink>
                {o.showSnomed && d.snomed_ct && <div className="cell-sub">SNOMED {d.snomed_ct}</div>}
              </td>
              <td>{d.behavioral === false ? 'No' : 'Yes'}</td>
              <td>{d.precedence || '—'}</td>
              <td>{d.condition || '—'}</td>
              <td><StatusBadge status={d.status} /></td>
              <StartCell start={d.onset_date} end={d.end_date} />
              <EnteredCell on={d.entered_on || d.onset_date} by={d.entered_by_staff_id} />
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>{filter === 'Active' ? 'No active diagnoses on this chart.' : 'No diagnoses on this chart.'}</QvxEmpty>}
      <QvMore shown={shown.length} total={rows.length} preview={preview} onViewAll={open} />
      {adding && <AddDiagnosisOverlay client={client} onClose={() => setAdding(false)} onOpenPage={() => { setAdding(false); open(); }} />}
    </div>
  );
}

/* Production's Diagnosis Input, minus what belongs on the full page
   (Additional Fields, the behavioral history). Searching is by code, name or
   SNOMED. A substance-use code defaults to 42 CFR Part 2, as medications do. */
function AddDiagnosisOverlay({ client, onClose, onOpenPage }) {
  const guard = useGuard();
  const existing = getDiagnoses(client);
  const hasPrimary = existing.some(d => isActiveStatus(d.status) && d.precedence === 'Primary');
  const programs = clientPrograms(client);
  const [q, setQ] = useState('');
  const [dx, setDx] = useState(null);
  const [f, setF] = useState({ type: '', status: 'Active', condition: '', precedence: hasPrimary ? 'Secondary' : 'Primary',
    start: isoOf(TODAY), end: '', program: programs[0] || '', sensitivity: SENSITIVITY[0], comments: '' });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const s = q.trim().toLowerCase();
  const results = s.length < 2 ? [] : DX_CODES.filter(d => (d.icd10 + ' ' + d.description + ' ' + d.snomed_ct).toLowerCase().indexOf(s) !== -1).slice(0, 8);
  const dup = dx && existing.find(d => d.icd10 === dx.icd10 && isActiveStatus(d.status));
  const choose = d => {
    setDx(d); setQ('');
    setF(x => ({ ...x, type: dxType(d.icd10), sensitivity: /^F1[0-9]/.test(d.icd10) ? SENSITIVITY[1] : SENSITIVITY[0] }));
  };
  const errs = { dx: !dx && 'Choose a diagnosis.', status: !f.status && 'Status is required.', condition: !f.condition && 'Condition is required.',
    program: !f.program && 'Program is required.', end: f.end && f.end < f.start && 'End date can’t be before the start date.' };
  const e = k => (tried ? errs[k] || null : null);
  const save = () => {
    setTried(true);
    if (dup || Object.values(errs).some(Boolean)) return;
    addRecord('diagnoses', { client_dx_id: newId('CDX'), client_id: client.client_id, icd10: dx.icd10, snomed_ct: dx.snomed_ct, description: dx.description,
      diagnosis_type: f.type, behavioral: f.type !== 'Medical', precedence: f.precedence, status: f.status, condition: f.condition,
      onset_date: f.start, end_date: f.end || null, program: f.program, sensitivity: f.sensitivity, comments: f.comments.trim() || null,
      diagnosed_by_staff_id: ME.id, ...enteredNow() });
    guard.setToast({ status: 'success', title: 'Diagnosis added', detail: dx.icd10 + ' ' + dx.description + ' · ' + f.status });
    onClose();
  };
  return (
    <Overlay size="lg" title="Add Diagnosis" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!dup} onClick={save}>Add Diagnosis</Button></React.Fragment>}>
      <Field label="Diagnosis Code Search" required error={e('dx')}>
        {dx ? (
          <div className="ovl-chosen">
            <b>{dx.icd10}</b> {dx.description}
            <span className="cell-sub">SNOMED {dx.snomed_ct}</span>
            <span className="spacer" />
            <button className="lnk" onClick={() => setDx(null)}>Change</button>
          </div>
        ) : (
          <div className="ovl-search">
            <div className={'form-input' + (e('dx') ? ' invalid' : '')}><Icon name="search" size={15} />
              <input autoFocus value={q} onChange={ev => setQ(ev.target.value)} placeholder="Type at least 2 characters — code, name or SNOMED" aria-label="Search for a diagnosis" /></div>
            {!!results.length && (
              <table className="data-table compact ovl-results">
                <thead><tr><th>ICD-10</th><th>Description</th><th>SNOMED</th></tr></thead>
                <tbody>{results.map(r => (
                  <tr key={r.icd10} className="qvx-click" onClick={() => choose(r)}>
                    <td><button className="lnk" onClick={ev => { ev.stopPropagation(); choose(r); }}>{r.icd10}</button></td>
                    <td className="wrap">{r.description}</td><td>{r.snomed_ct}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {s.length >= 2 && !results.length && <div className="ovl-hint">No diagnosis matches “{q}”.</div>}
          </div>
        )}
      </Field>
      {dup && <DuplicateNote what={dup.icd10 + ' ' + dup.description} since={dup.onset_date} onOpen={onOpenPage} />}
      <div className="ovl-grid ovl-grid--3">
        <Field label="Type"><Dropdown value={f.type} options={['Behavioral Health', 'Substance Use', 'Medical']} placeholder={dx ? 'Please select…' : 'Choose a diagnosis first'} onChange={v => set('type', v)} /></Field>
        <Field label="Status" required error={e('status')}><Dropdown value={f.status} options={['Active', 'Provisional', 'In Remission', 'Resolved']} onChange={v => set('status', v)} /></Field>
        <Field label="Condition" required error={e('condition')}><Dropdown value={f.condition} options={['Acute', 'Chronic']} placeholder="Please select…" onChange={v => set('condition', v)} invalid={!!e('condition')} /></Field>
        <Field label="Precedence" hint={hasPrimary && f.precedence === 'Primary' ? 'This chart already has an active primary diagnosis.' : null}>
          <Dropdown value={f.precedence} options={['Primary', 'Secondary', 'Tertiary']} onChange={v => set('precedence', v)} /></Field>
        <DateField label="Start Date" value={f.start} onChange={v => set('start', v)} quick={false} />
        <DateField label="End Date" value={f.end} min={f.start} onChange={v => set('end', v)} quick={false} error={e('end')} />
        <Field label="Program" required error={e('program')}><Dropdown value={f.program} options={programs} placeholder="Please select…" onChange={v => set('program', v)} invalid={!!e('program')} /></Field>
        <Field label="Sensitivity Classification" hint={dx && /^F1[0-9]/.test(dx.icd10) ? 'Defaulted for a substance-use diagnosis' : null}>
          <Dropdown value={f.sensitivity} options={SENSITIVITY} onChange={v => set('sensitivity', v)} /></Field>
      </div>
      <Field label="Comments" wide><TextArea value={f.comments} onChange={v => set('comments', v)} rows={2} /></Field>
    </Overlay>
  );
}

/* ================= Problems ================= */
function ProblemsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const o = view.options;
  const [filter, setFilter] = useState(o.defaultFilter || 'Active');
  const [adding, setAdding] = useState(false);
  const all = getProblems(client);
  const active = all.filter(p => isActiveStatus(p.status));
  const rows = filter === 'All' ? all : active;
  const shown = rows.slice(0, rowLimit(o.rows));
  const open = () => go('Problem List');
  return (
    <div className="cph-qvx">
      <QvBar title="Problems" meta={active.length + ' active'} preview={preview} onViewAll={open}
        onAdd={() => setAdding(true)} addLabel="Add Problem" />
      <QvFilters label="Filter problems" options={RECORD_FILTERS} value={filter} onChange={setFilter} count={f => (f === 'All' ? all.length : active.length)} />
      {rows.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Problem</th>{o.showCategory && <th>Category</th>}<th>Status</th><th>Start</th><th>Program</th><th>Entered</th></tr></thead>
          <tbody>{shown.map(p => (
            <tr key={p.client_problem_id}>
              <td className="wrap"><RecLink preview={preview} onOpen={open}>{p.name}</RecLink></td>
              {o.showCategory && <td>{p.category || '—'}</td>}
              <td><StatusBadge status={p.status} /></td>
              <StartCell start={p.onset_date} end={p.end_date} />
              <td className="wrap">{p.program || '—'}</td>
              <EnteredCell on={p.entered_on || p.onset_date} by={p.entered_by_staff_id} />
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>{filter === 'Active' ? 'No active problems on this chart.' : 'No problems on this chart.'}</QvxEmpty>}
      <QvMore shown={shown.length} total={rows.length} preview={preview} onViewAll={open} />
      {adding && <AddProblemOverlay client={client} onClose={() => setAdding(false)} onOpenPage={() => { setAdding(false); open(); }} />}
    </div>
  );
}

/* Production's Problems List Input. */
function AddProblemOverlay({ client, onClose, onOpenPage }) {
  const guard = useGuard();
  const existing = getProblems(client);
  const programs = clientPrograms(client);
  const [q, setQ] = useState('');
  const [pr, setPr] = useState(null);
  const [f, setF] = useState({ status: 'Active', condition: '', start: isoOf(TODAY), end: '', program: programs[0] || '', sensitivity: SENSITIVITY[0], comments: '' });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const s = q.trim().toLowerCase();
  const results = s.length < 2 ? [] : (RD.problems || []).filter(p => (p.name + ' ' + p.category).toLowerCase().indexOf(s) !== -1).slice(0, 8);
  const dup = pr && existing.find(p => p.name === pr.name && isActiveStatus(p.status));
  const errs = { pr: !pr && 'Choose a problem.', status: !f.status && 'Status is required.', end: f.end && f.end < f.start && 'End date can’t be before the start date.' };
  const e = k => (tried ? errs[k] || null : null);
  const save = () => {
    setTried(true);
    if (dup || Object.values(errs).some(Boolean)) return;
    addRecord('problems', { client_problem_id: newId('CPL'), client_id: client.client_id, problem_id: pr.problem_id, name: pr.name, category: pr.category,
      status: f.status, condition: f.condition || null, onset_date: f.start, end_date: f.end || null, program: f.program || null,
      sensitivity: f.sensitivity, comments: f.comments.trim() || null, ...enteredNow() });
    guard.setToast({ status: 'success', title: 'Problem added', detail: pr.name + ' · ' + f.status });
    onClose();
  };
  return (
    <Overlay size="md" title="Add Problem" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!dup} onClick={save}>Add Problem</Button></React.Fragment>}>
      <Field label="Problem Code Search" required error={e('pr')}>
        {pr ? (
          <div className="ovl-chosen"><b>{pr.name}</b><span className="cell-sub">{pr.category}</span><span className="spacer" />
            <button className="lnk" onClick={() => setPr(null)}>Change</button></div>
        ) : (
          <div className="ovl-search">
            <div className={'form-input' + (e('pr') ? ' invalid' : '')}><Icon name="search" size={15} />
              <input autoFocus value={q} onChange={ev => setQ(ev.target.value)} placeholder="Type at least 2 letters — problem or category" aria-label="Search for a problem" /></div>
            {!!results.length && (
              <div className="ovl-picklist">{results.map(r => (
                <button key={r.problem_id} type="button" className="picker-row" onClick={() => { setPr(r); setQ(''); }}>
                  <span className="picker-text"><span className="picker-name">{r.name}</span><span className="picker-meta">{r.category}</span></span>
                </button>
              ))}</div>
            )}
            {s.length >= 2 && !results.length && <div className="ovl-hint">No problem matches “{q}”.</div>}
          </div>
        )}
      </Field>
      {dup && <DuplicateNote what={dup.name} since={dup.onset_date} onOpen={onOpenPage} />}
      <div className="ovl-grid ovl-grid--2">
        <Field label="Status" required error={e('status')}><Dropdown value={f.status} options={['Active', 'Inactive', 'Resolved']} onChange={v => set('status', v)} /></Field>
        <Field label="Condition"><Dropdown value={f.condition} options={['Acute', 'Chronic']} placeholder="Please select…" onChange={v => set('condition', v)} /></Field>
        <DateField label="Start Date" value={f.start} onChange={v => set('start', v)} quick={false} />
        <DateField label="End Date" value={f.end} min={f.start} onChange={v => set('end', v)} quick={false} error={e('end')} />
        <Field label="Program"><Dropdown value={f.program} options={programs} placeholder="Please select…" onChange={v => set('program', v)} /></Field>
        <Field label="Sensitivity Classification"><Dropdown value={f.sensitivity} options={SENSITIVITY} onChange={v => set('sensitivity', v)} /></Field>
      </div>
      <Field label="Comments" wide><TextArea value={f.comments} onChange={v => set('comments', v)} rows={2} /></Field>
    </Overlay>
  );
}

/* ================= Appointments ================= */
const APPT_FILTERS = ['Upcoming', 'Past'];
const apptWhen = a => { const d = _parse(a.date); const [h, m] = (a.start_time || '00:00').split(':').map(Number); if (d) d.setHours(h || 0, m || 0, 0, 0); return d; };

function AppointmentsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const o = view.options;
  const [filter, setFilter] = useState(o.defaultFilter || 'Upcoming');
  const [adding, setAdding] = useState(false);
  let appts = getAppointments(client).map(a => ({ ...a, when: apptWhen(a), outcome: apptOutcome(a, TODAY) })).filter(a => a.when);
  if (!o.includeMissed) appts = appts.filter(a => a.outcome !== 'No Show' && a.outcome !== 'Cancelled');
  const upcoming = appts.filter(a => a.when > TODAY).sort((a, b) => a.when - b.when);
  const past = appts.filter(a => a.when <= TODAY).sort((a, b) => b.when - a.when);
  const rows = filter === 'Upcoming' ? upcoming : past;
  const shown = rows.slice(0, parseInt(o.count, 10) || 5);
  const open = () => go('Appointments');
  const next = upcoming[0];
  return (
    <div className="cph-qvx">
      <QvBar title="Appointments" meta={next ? 'Next ' + fmtDate(next.date) + ' with ' + (next.staff_id === ME.id ? 'you' : sName(next.staff_id)) : 'Nothing scheduled'}
        preview={preview} onViewAll={open}
        onAdd={() => setAdding(true)} addLabel="Schedule Appointment" />
      <QvFilters label="Filter appointments" options={APPT_FILTERS} value={filter} onChange={setFilter} count={f => (f === 'Upcoming' ? upcoming.length : past.length)} />
      {rows.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Date</th><th>Time</th><th>Reason</th><th>Staff Member</th><th>Site</th><th>Meeting</th><th>Status</th></tr></thead>
          <tbody>{shown.map(a => (
            <tr key={a.appointment_id}>
              <td><RecLink preview={preview} onOpen={open}>{fmtDate(a.date)}</RecLink></td>
              <td>{a.start_time ? noteTime('0000-00-00T' + a.start_time) : '—'}{a.duration_minutes ? <div className="cell-sub">{a.duration_minutes} min</div> : null}</td>
              <td className="wrap">{a.appointment_reason || a.type || '—'}</td>
              <td>{a.staff_id === ME.id ? 'You' : sName(a.staff_id)}</td>
              <td className="wrap">{a.site_id ? siteName(a.site_id) : '—'}{a.place_of_service && <div className="cell-sub">{a.place_of_service}</div>}</td>
              <td>{a.meeting_type || '—'}</td>
              <td><span className={'cph-qv-tag' + (a.outcome === 'No Show' ? ' is-warn' : '')}>{a.outcome}</span></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>{filter === 'Upcoming' ? 'Nothing scheduled.' : 'No past appointments.'}</QvxEmpty>}
      <QvMore shown={shown.length} total={rows.length} preview={preview} onViewAll={open} />
      {adding && <ScheduleAppointmentOverlay client={client} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ================= Clinical notes ================= */
/* Notes are long, multi-section documents, so Add Note doesn't open a dialog:
   it's the header's Add Note menu, which opens the note on the chart. The
   user's own unfinished notes lead, like they do in that menu. */
function NotesQV({ view, client, preview }) {
  useRecordsVersion();
  const guard = useGuard();
  const o = view.options;
  const addRef = useRef(null);
  const [menu, setMenu] = useState(false);
  const n = parseInt(o.count, 10) || 5;
  /* The admin preview's demo client never shows a staff name off the roster. */
  let docs = clientDocs(client.client_id, 10).map(d => (client.records ? { ...d, byId: null, by: 'Sample Clinician' } : d));
  if (o.unsignedFirst) docs = docs.filter(d => d.status !== 'Signed').concat(docs.filter(d => d.status === 'Signed'));
  const mine = preview ? [] : incompleteNotes(client);
  const unsigned = docs.filter(d => d.status !== 'Signed').length;
  const openDoc = d => guard.go('/chart/' + client.client_id + '/doc-' + slugify(d.id), { client: client.client_id });
  const openDraft = i => guard.go('/chart/' + client.client_id + '/' + slugify(i.doc), { client: client.client_id,
    onCommit: i.ctx ? () => setNoteCtx(client.client_id, i.doc, i.ctx) : undefined });
  const shown = docs.slice(0, Math.max(0, n - mine.length));
  return (
    <div className="cph-qvx">
      <QvBar title="Clinical Notes" meta={unsigned ? unsigned + ' not yet signed' : 'All signed'} preview={preview}
        onViewAll={() => openDocumentsFor(guard, client)} viewAllLabel="View all in Documents" addLabel="Add Note"
        addNode={(
          <span ref={addRef}>
            <Button size="sm" variant="secondary" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>
              <Icon name="plus" size={14} /> Add Note <Icon name="chevronDown" size={14} />
            </Button>
            {menu && <AddNoteMenu anchorRef={addRef} client={client} onClose={() => setMenu(false)} />}
          </span>
        )} />
      {mine.length || shown.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Note</th><th>Type</th><th>Date</th><th>Author</th><th>Status</th></tr></thead>
          <tbody>
            {mine.map(i => (
              <tr key={'mine' + i.doc}>
                <td className="wrap"><button className="lnk qvx-recname" onClick={() => openDraft(i)}>{i.doc}</button><div className="cell-sub">{i.meta}</div></td>
                <td>Note</td><td>Today</td><td>You</td>
                <td><span className="cph-qv-tag is-warn">Your draft</span></td>
              </tr>
            ))}
            {shown.map(d => (
              <tr key={d.id}>
                <td className="wrap"><RecLink preview={preview} onOpen={() => openDoc(d)}>{d.name}</RecLink></td>
                <td>{d.kind}</td><td>{fmtDate(d.at)}</td>
                <td>{d.byId === ME.id ? 'You' : d.by}</td>
                <td>{d.status === 'Signed' ? 'Signed' : <span className={'cph-qv-tag' + (d.status === 'Draft' ? ' is-warn' : '')}>{d.status}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <QvxEmpty>No documentation on this chart.</QvxEmpty>}
    </div>
  );
}

/* ================= Assessments ================= */
/* Every instrument on the chart in one list. Scored instruments with a form
   in the prototype come from their records; the rest of the agency's
   instruments are tracked by cadence only (the Client Summary's due list),
   so the two never disagree about what's due. */
const CATALOG_MODULE = { GAD7: 'GAD-7', CANS: 'CANS', ASAM: 'ASAM', CSSRS: 'Detailed Columbia - Suicide Severity Rating Scale' };
const CATALOG_SHORT = { GAD7: 'GAD-7', DAST10: 'DAST-10', CSSRS: 'C-SSRS', VBSAT: 'Vanderbilt', PHQ9: 'PHQ-9', PCL5: 'PCL-5' };

/* The Client Summary's due list (age-appropriate instruments, picked per
   client). Where the instrument has records here, its real latest date wins. */
function dueAssessmentsFor(client) {
  const cid = client.client_id;
  const youth = client.age !== '' && client.age <= 21;
  const cat = (((RD.assessments || {}).instruments) || [])
    .filter(a => (/youth/i.test(a.domain) ? youth : /adult/i.test(a.domain) ? !youth : true));
  return pick(cat, cid + 'due', Math.min(3, cat.length)).map(a => {
    const every = cadenceDays(a.typical_cadence) || 180;
    const real = FORM_BY_ID[a.assessment_id] && getAdmins(client, a.assessment_id)[0];
    const last = real ? _parse(real.date) : addDays(TODAY, -(every - (seed(cid + a.assessment_id) % 40) + 20));
    const next = addDays(last, every);
    return { kind: 'Assessment', name: a.name, code: a.assessment_id, last, next, days: Math.round((next - TODAY) / 86400000) };
  });
}

function assessmentRows(client, includeDue) {
  const forms = (RD.assessmentForms || []).map(form => {
    const latest = getAdmins(client, form.form_id)[0];
    if (!latest) return null;
    const next = formNextDue(form, latest);
    return { key: form.form_id, name: form.name, full: form.full_name, module: form.module, latest, form,
      score: latest.score + '/' + formMax(form), band: formBand(form, latest.score), date: latest.date, by: latest.administered_by_staff_id, next };
  }).filter(Boolean);
  if (!includeDue) return forms;
  const results = ((RD.assessments || {}).sample_results) || [];
  const extra = dueAssessmentsFor(client).filter(a => !forms.some(f => f.key === a.code)).map(a => {
    const r = results.find(x => x.client_id === client.client_id && x.assessment_id === a.code);
    return { key: a.code, name: CATALOG_SHORT[a.code] || a.code, full: a.name, module: CATALOG_MODULE[a.code] || null, date: isoOf(a.last), next: isoOf(a.next),
      score: r ? String(r.score) : null, band: r ? { label: r.interpretation, top: false } : null, by: null };
  });
  /* Overdue first, then soonest due; "as clinically indicated" last. */
  const due = r => (r.next ? r.next : '9999');
  return forms.concat(extra).sort((a, b) => due(a).localeCompare(due(b)));
}

function AssessmentsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const o = view.options;
  const rows = assessmentRows(client, o.includeDue && !client.records);
  const shown = rows.slice(0, rowLimit(o.rows));
  const overdue = rows.filter(r => r.next && daysUntil(r.next) < 0).length;
  return (
    <div className="cph-qvx">
      <QvBar title="Assessments" meta={rows.length + ' on the chart' + (overdue ? ' · ' + overdue + ' overdue' : '')} preview={preview} />
      {rows.length ? (
        <table className="data-table compact qvx-table">
          <thead><tr><th>Instrument</th>{o.showScores && <th>Latest Score</th>}<th>Given</th><th>Next Due</th></tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.key}>
              <td className="wrap">
                {r.module ? <RecLink preview={preview} onOpen={() => go(r.module)}>{r.name}</RecLink> : <span className="qvx-recname">{r.name}</span>}
                <div className="cell-sub">{r.full}</div>
              </td>
              {o.showScores && <td>{r.score ? <React.Fragment>{r.score} {r.band && <span className={'cph-qv-tag' + (r.band.top || (r.latest && r.latest.flagged) ? ' is-warn' : '')}>{r.band.label}</span>}</React.Fragment> : '—'}</td>}
              <EnteredCell on={r.date} by={r.by} />
              <td>{r.next ? <span className={'cph-qv-tag' + (daysUntil(r.next) < 0 ? ' is-warn' : '')}>{fmtDate(r.next)} · {dueLabel(r.next)}</span> : <span className="cell-sub">As clinically indicated</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : <QvxEmpty>No assessments on this chart.</QvxEmpty>}
      {shown.length < rows.length && <div className="qvx-more">Showing the {shown.length} due soonest of {rows.length}. Each instrument’s quick view or page has its full history.</div>}
    </div>
  );
}

/* ================= Enrollment ================= */
/* The current episode and any closed ones, then payor coverage. Enrolling,
   discharging and assigning a payor stay on their own pages. */
function EnrollmentQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useModuleNav(client);
  const o = view.options;
  const cid = client.client_id;
  const start = _parse(client.enrollment_date);
  const days = start ? Math.round((TODAY - start) / 86400000) : null;
  /* One prior episode for roughly two clients in three — derived, like the
     rest of the episode data the fixture set doesn't carry. */
  const hadPrior = seed(cid + 'pe') % 3 !== 0;
  const priorEnd = addDays(start || TODAY, -(30 + seed(cid + 'pe1') % 400));
  const priorStart = addDays(priorEnd, -(120 + seed(cid + 'ps') % 300));
  const team = client.team || careTeam(cid);
  const episodes = [{ id: 'cur', program: client.program, site: client.siteName, start: client.enrollment_date, end: null, status: client.status,
    by: (team[0] || {}).id, on: client.enrollment_date }]
    .concat(o.showClosed && hadPrior ? [{ id: 'prior', program: client.program, site: client.siteName, start: isoOf(priorStart), end: isoOf(priorEnd),
      status: 'Closed', by: derivedBy(cid + 'enr'), on: isoOf(priorStart) }] : []);
  const payors = client.records ? [] : pageRows(cid, 'Payor Assignment').concat((RD.payors || []).filter(p => p.client_id === cid));
  return (
    <div className="cph-qvx">
      <QvBar title="Enrollment" meta={days != null ? 'Enrolled ' + days + ' days' : null} preview={preview} onViewAll={() => go('Enrollment History')} />
      <table className="data-table compact qvx-table">
        <thead><tr><th>Program</th><th>Site</th><th>Admitted</th><th>Discharged</th><th>Status</th><th>Entered</th></tr></thead>
        <tbody>{episodes.map(e => (
          <tr key={e.id}>
            <td className="wrap"><RecLink preview={preview} onOpen={() => go('Enrollment History')}>{e.program}</RecLink></td>
            <td className="wrap">{e.site}</td><td>{fmtDate(e.start)}</td><td>{e.end ? fmtDate(e.end) : '—'}</td>
            <td><span className={'badge ' + (e.status === 'Active' ? 'status-active' : 'status-neutral')}>{e.status}</span></td>
            <EnteredCell on={e.on} by={e.by} />
          </tr>
        ))}</tbody>
      </table>
      {o.showPayor && (
        <React.Fragment>
          <div className="qvx-sub">
            <span className="qvx-sub-name">Payor</span>
            {!preview && <button className="lnk qvx-viewall" onClick={() => go('Payor Assignment')}>Payor Assignment <Icon name="external" size={13} /></button>}
          </div>
          {payors.length ? (
            <table className="data-table compact qvx-table">
              <thead><tr><th>Payor</th><th>Policy Type</th><th>Policy Number</th><th>Coverage</th><th>Authorization</th><th>Entered</th></tr></thead>
              <tbody>{payors.map(p => (
                <tr key={p.assignment_id}>
                  <td className="wrap">{payorName(p.payor_provider_id)}</td><td>{p.policy_type}</td><td>{p.policy_number || '—'}</td>
                  <td>{fmtDate(p.begin_date)} – {p.end_date ? fmtDate(p.end_date) : 'open'}</td>
                  <td>{p.num_visits_authorized ? p.num_visits_authorized + ' visits' : '—'}{p.auth_number && <div className="cell-sub">Auth {p.auth_number}</div>}</td>
                  <EnteredCell on={p.created_date || p.begin_date} by={p.created_by_staff_id || derivedBy(p.assignment_id)} />
                </tr>
              ))}</tbody>
            </table>
          ) : <QvxEmpty>No payor assignment on file.</QvxEmpty>}
        </React.Fragment>
      )}
    </div>
  );
}
