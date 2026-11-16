/* ===== Services, the staff side =====================================
   Two ways in, because staff think both ways.

   DOCUMENT FIRST, the everyday case. Under Notes, a clinician picks
   Progress Note. Before the note opens they're asked which service they
   performed and the date of service. The list holds only services that
   include that note, that their role and specific security allow, and that
   fit this client's enrollments. The version in effect on the date of
   service is the one applied, so a backdated note keeps the old code.

   WORKFLOW FIRST, for collections like an intake or a discharge. The chart's
   Services page lists the client's open services with their steps and
   deadline, what's been completed, and Start Service.

   A service instance belongs to the client: one service, performed (or
   under way) on a date of service. It's what ties a workflow's steps
   together. Due dates themselves are per client, per document, per rule.

   Fictional clients and staff throughout; see 55-service-builder.jsx for the
   admin side and the shared store.
   ================================================================ */

/* ---- Finding what to offer ----------------------------------------- */
/* Any service, live or not, that includes this document. If none does, the
   note opens as it always has. */
const sbServicesWithDoc = doc => SB_STORE.get().services.filter(s => s.versions.some(v => v.config.steps.some(x => x.kind === 'Document' && x.name === doc)));

/* Notes open in the note editor, so the service question comes first. A
   note a service uses counts even if it isn't one of the alert-driven
   START_NOTE_TYPES (Psychotherapy Progress Note, Nurse Progress Note). */
const sbIsNoteDoc = name => START_NOTE_TYPES.indexOf(name) !== -1 || !!(SB_DOC[name] && SB_DOC[name].category === 'Note' && sbServicesWithDoc(name).length);
const sbNoteDocs = () => SB_DOCS.filter(d => d.category === 'Note' && sbServicesWithDoc(d.name).length).map(d => d.name);

function sbOffered({ client, date, doc, staffId = ME.id }) {
  const offered = [], hidden = [];
  SB_STORE.get().services.forEach(s => {
    if (s.status !== 'active') return;
    const ver = sbVersionAt(s, date);
    const any = ver || sbLatest(s);
    if (doc && !any.config.steps.some(x => x.kind === 'Document' && x.name === doc)) return;
    if (!ver) return hidden.push({ s, fails: [{ key: 'date', text: 'Not in effect until ' + fmtDate(s.versions.find(v => v.effective).effective) + '.' }] });
    if (doc && !ver.config.steps.some(x => x.kind === 'Document' && x.name === doc)) return;
    const el = sbEligibility(ver.config, staffId, client);
    if (el.ok) offered.push({ s, ver });
    else hidden.push({ s, fails: el.fails });
  });
  offered.sort((a, b) => a.s.name.localeCompare(b.s.name));
  return { offered, hidden };
}
const sbInstancesFor = cid => SB_STORE.get().instances.filter(i => i.client_id === cid);
const sbServiceById = id => SB_STORE.get().services.find(s => s.service_id === id);
const sbInstVersion = i => { const s = sbServiceById(i.service_id); return s ? s.versions.find(v => v.version === i.version) || sbLatest(s) : null; };

/* ---- Due dates ---------------------------------------------------------
   A deadline counts from the instance's start date (the referral, the
   discharge) unless it's anchored to an enrollment, which the client has.
   A repeating rule's due date is the first one on or after the date of
   service. */
function sbAnchorFor(anchor, client, inst) {
  if ((anchor === 'program-enroll' || anchor === 'client-enroll') && client.enrollment_date) return inst.anchor_date && inst.anchor_date !== inst.date_of_service ? inst.anchor_date : client.enrollment_date;
  return inst.anchor_date || inst.date_of_service;
}
function sbDueFor(rule, client, inst) {
  if (!rule) return null;
  const list = crSchedule(rule, sbAnchorFor(rule.anchor, client, inst), rule.repeat ? 60 : 1);
  const dos = new Date(inst.date_of_service + 'T00:00:00');
  return list.find(x => x.due >= dos) || list[list.length - 1] || null;
}
const SB_DUE_STATE = { past: ['Overdue', 'status-inactive'], warning: ['Due soon', 'status-amber'], upcoming: ['Due', 'status-info'] };
function SbDueBadge({ due }) {
  if (!due) return null;
  const st = SB_DUE_STATE[due.state];
  return <span className={'badge ' + st[1]}>{st[0]} {fmtDate(due.due)}</span>;
}

/* ---- Recording -------------------------------------------------------- */
function sbSetInstances(fn) { SB_STORE.set(st => ({ ...st, instances: fn(st.instances) })); }
function sbMarkStep(instId, stepId, date) {
  sbSetInstances(list => list.map(i => {
    if (i.instance_id !== instId) return i;
    const steps = i.steps.map(x => (x.step_id === stepId ? { ...x, status: 'done', done_on: date || TODAY_ISO } : x));
    const ver = sbInstVersion({ ...i });
    const req = ver ? ver.config.steps.filter(s => s.required).map(s => s.step_id) : [];
    const complete = req.every(id => (steps.find(x => x.step_id === id) || {}).status === 'done');
    return { ...i, steps, status: complete ? 'complete' : 'open' };
  }));
}
/* Start a service for a client. Returns the new instance. */
function sbStartInstance(client, s, ver, date, doneStepId) {
  const steps = ver.config.steps.map(x => ({ step_id: x.step_id, status: x.step_id === doneStepId ? 'done' : 'todo', done_on: x.step_id === doneStepId ? date : null }));
  const req = ver.config.steps.filter(x => x.required).map(x => x.step_id);
  const complete = req.every(id => (steps.find(x => x.step_id === id) || {}).status === 'done');
  const inst = { instance_id: sbId('SI'), client_id: client.client_id, service_id: s.service_id, version: ver.version,
    date_of_service: date, anchor_date: date, started_by: ME.id, status: complete ? 'complete' : 'open', steps };
  sbSetInstances(list => list.concat([inst]));
  return inst;
}
/* A document completed anywhere on the chart (a module form, the Discharge
   Plan) completes the matching step of any open service for that client. */
function sbDocFiled(cid, doc, date) {
  sbInstancesFor(cid).filter(i => i.status === 'open').forEach(i => {
    const ver = sbInstVersion(i); if (!ver) return;
    const st = ver.config.steps.find(x => x.name === doc && (i.steps.find(y => y.step_id === x.step_id) || {}).status !== 'done');
    if (st) sbMarkStep(i.instance_id, st.step_id, date);
  });
}
/* The open step a chart page would complete, for its banner. */
function sbOpenStepFor(cid, doc) {
  for (const i of sbInstancesFor(cid).filter(x => x.status === 'open')) {
    const ver = sbInstVersion(i); if (!ver) continue;
    const ix = ver.config.steps.findIndex(x => x.name === doc && (i.steps.find(y => y.step_id === x.step_id) || {}).status !== 'done');
    if (ix !== -1) return { inst: i, ver, ix, s: sbServiceById(i.service_id) };
  }
  return null;
}

/* The choice made on the Services page, carried into the note it opens. */
const SB_NOTE_SEL = {};
const sbSelKey = (cid, doc) => cid + '|' + doc;
const takeSbSel = (cid, doc) => { const k = sbSelKey(cid, doc), v = SB_NOTE_SEL[k]; delete SB_NOTE_SEL[k]; return v || null; };

/* ---- Choosing the service ---------------------------------------------- */
/* Shared by the note (doc given) and Start Service (no doc). Calls
   onStart({ service_id, version, instance_id, date }). */
function ServiceStartForm({ client, doc, initial, onStart, onCancel, startLabel }) {
  useServices();
  const [date, setDate] = useState(initial ? initial.date : TODAY_ISO);
  const [val, setVal] = useState(initial ? (initial.instance_id ? 'inst:' + initial.instance_id : 'svc:' + initial.service_id) : '');
  const [why, setWhy] = useState(false);
  const [tried, setTried] = useState(false);
  const { offered, hidden } = sbOffered({ client, date, doc });
  /* Open workflows that still need this document come first: "continue". */
  const open = doc ? sbInstancesFor(client.client_id).filter(i => i.status === 'open').map(i => {
    const ver = sbInstVersion(i), s = sbServiceById(i.service_id);
    if (!ver || !s) return null;
    const ix = ver.config.steps.findIndex(x => x.name === doc && (i.steps.find(y => y.step_id === x.step_id) || {}).status !== 'done');
    return ix === -1 ? null : { i, s, ver, ix };
  }).filter(Boolean) : [];
  const opts = open.map(o => ({ value: 'inst:' + o.i.instance_id, label: o.s.name,
    sub: 'Continue · step ' + (o.ix + 1) + ' of ' + o.ver.config.steps.length + ' · started ' + fmtDate(o.i.date_of_service), tags: [{ label: 'In progress', tone: 'info' }] }))
    .concat(offered.map(o => ({ value: 'svc:' + o.s.service_id, label: o.s.name,
      sub: [sbProgramsLabel(o.ver.config.programs.filter(p => (client.program_ids || []).indexOf(p) !== -1), 1), o.ver.config.duration_min ? o.ver.config.duration_min + ' min' : null,
        o.ver.config.steps.length > 1 ? o.ver.config.steps.length + ' steps' : null].filter(Boolean).join(' · ') })));
  const chosen = val.indexOf('inst:') === 0 ? open.find(o => 'inst:' + o.i.instance_id === val)
    : val ? offered.find(o => 'svc:' + o.s.service_id === val) : null;
  /* A date change can take the chosen service out of the list. */
  useEffect(() => { if (val && !chosen) setVal(''); }, [date]);
  const ver = chosen ? chosen.ver : null, cfg = ver ? ver.config : null;
  const latest = chosen ? sbLatest(chosen.s) : null;
  const start = () => {
    setTried(true);
    if (!chosen || !date) return;
    onStart({ service_id: chosen.s.service_id, version: ver.version, instance_id: chosen.i ? chosen.i.instance_id : null, date: chosen.i ? chosen.i.date_of_service : date });
  };
  const err = tried && !chosen ? (opts.length ? 'Choose the service you performed.' : null) : null;
  return (
    <div className="sb-start">
      <div className="ovl-grid ovl-grid--2">
        <DateField label="Date of service" required value={date} onChange={v => v && setDate(v)} hint={chosen && chosen.i ? 'Continuing a service started ' + fmtDate(chosen.i.date_of_service) + '.' : null} />
        <Field label={doc ? 'Which service did you perform?' : 'Service'} required error={err}>
          {opts.length
            ? <Dropdown id="sb-start-service" value={val} options={opts} placeholder="Choose a service" invalid={!!err} onChange={setVal}
                display={chosen ? chosen.s.name : null} menuMinWidth={380} />
            : <div className="sb-start-none">No service {doc ? 'with a ' + doc + ' ' : ''}is available to you for {client.shortName} on this date.</div>}
        </Field>
      </div>
      {cfg && (
        <div className="sb-applied">
          <div className="sb-applied-head">
            <b>{chosen.s.name}</b>
            <span className="sb-applied-ver">Version {ver.version}{latest.version !== ver.version ? ', the one in effect on ' + fmtDate(chosen.i ? chosen.i.date_of_service : date) : ''}</span>
          </div>
          <dl className="sb-dl sb-dl--inline">
            <dt>Program</dt><dd>{sbProgramsLabel(cfg.programs.filter(p => (client.program_ids || []).indexOf(p) !== -1), 1)}</dd>
            <dt>Billing</dt><dd>{cfg.codes.length ? cfg.codes.map(sbCodeLabel).join(', ') : 'Not billed'}</dd>
            {cfg.duration_min ? <React.Fragment><dt>Duration</dt><dd>{cfg.duration_min} min</dd></React.Fragment> : null}
            <dt>Diagnosis</dt><dd>{(SB_PREC[cfg.precedence] || {}).name}</dd>
            {cfg.sensitivity !== 'Standard' && <React.Fragment><dt>Sensitivity</dt><dd>{cfg.sensitivity}</dd></React.Fragment>}
          </dl>
          {cfg.steps.length > 1 && (
            <div className="chc-note">
              {doc ? 'This ' + doc + ' is one of ' + cfg.steps.length + ' steps' : 'It has ' + cfg.steps.length + ' steps'}: {cfg.steps.map(x => x.name).join(', ')}.
              {' '}The rest appear on {client.shortName}’s Services page.
            </div>
          )}
        </div>
      )}
      {hidden.length > 0 && (
        <div className="sb-why">
          <button type="button" className="lnk sb-why-btn" aria-expanded={why} onClick={() => setWhy(w => !w)}>
            <Icon name={why ? 'chevronUp' : 'chevronDown'} size={14} /> Why don’t I see a service? ({hidden.length})
          </button>
          {why && (
            <ul className="sb-why-list">
              {hidden.map(h => <li key={h.s.service_id}><b>{h.s.name}</b>: {h.fails.map(f => f.text).join(' ')}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="note-foot">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <span className="spacer" />
        <Button variant="primary" onClick={start} disabled={!opts.length}>{startLabel || 'Start ' + (doc || 'Service')}</Button>
      </div>
    </div>
  );
}

/* What the chosen service applied, at the top of the note. */
function SbAppliedLine({ client, service, onChange }) {
  const s = sbServiceById(service.service_id);
  if (!s) return null;
  const ver = s.versions.find(v => v.version === service.version) || sbLatest(s);
  const cfg = ver.config;
  const inst = service.instance_id && SB_STORE.get().instances.find(i => i.instance_id === service.instance_id);
  return (
    <div className="chc-note chc-note--info note-link sb-applied-line"><Icon name="uiTaskListLTR" size={15} />
      <div>
        <b>{s.name}</b> · Version {ver.version} · {fmtDate(service.date)}
        {' · '}{sbProgramsLabel(cfg.programs.filter(p => (client.program_ids || []).indexOf(p) !== -1), 1)}
        {cfg.codes.length ? ' · ' + cfg.codes.map(sbCodeLabel).join(', ') : ' · not billed'}
        {inst ? ' · step of an open service' : ''}
        {onChange && <React.Fragment>{' '}<button type="button" className="lnk cr-inline-link" onClick={onChange}>Change</button></React.Fragment>}
      </div>
    </div>
  );
}

/* Signing a note under a service. */
function sbRecordNote(client, doc, service) {
  const s = sbServiceById(service.service_id); if (!s) return null;
  const ver = s.versions.find(v => v.version === service.version) || sbLatest(s);
  const step = ver.config.steps.find(x => x.kind === 'Document' && x.name === doc);
  if (service.instance_id) { if (step) sbMarkStep(service.instance_id, step.step_id, service.date); return { s, workflow: true }; }
  const inst = sbStartInstance(client, s, ver, service.date, step ? step.step_id : null);
  return { s, workflow: inst.status === 'open' };
}

/* ---- The chart's Services page ------------------------------------------ */
function ClientServicesPage({ client, onOpenTab }) {
  const guard = useGuard();
  const [store] = useServices();
  const [rules] = useDueDateRules();
  const [starting, setStarting] = useState(false);
  const [scheduling, setScheduling] = useState(null);
  const mine = store.instances.filter(i => i.client_id === client.client_id);
  const open = mine.filter(i => i.status === 'open').sort((a, b) => a.date_of_service.localeCompare(b.date_of_service));
  const done = mine.filter(i => i.status === 'complete').sort((a, b) => b.date_of_service.localeCompare(a.date_of_service));
  const rule = id => rules.find(r => r.id === id);

  const openStep = (i, s, ver, st) => {
    if (st.kind === 'Appointment') return setScheduling({ i, st });
    if (sbIsNoteDoc(st.name)) SB_NOTE_SEL[sbSelKey(client.client_id, st.name)] = { service_id: s.service_id, version: ver.version, instance_id: i.instance_id, date: i.date_of_service };
    onOpenTab(st.name);
  };
  const onStart = sel => {
    setStarting(false);
    const s = sbServiceById(sel.service_id), ver = s.versions.find(v => v.version === sel.version);
    const steps = ver.config.steps;
    if (steps.length === 1 && steps[0].kind === 'Document') {
      if (sbIsNoteDoc(steps[0].name)) SB_NOTE_SEL[sbSelKey(client.client_id, steps[0].name)] = sel;
      else sbStartInstance(client, s, ver, sel.date, null);
      return onOpenTab(steps[0].name);
    }
    sbStartInstance(client, s, ver, sel.date, null);
    guard.setToast({ status: 'success', title: s.name + ' started', detail: sbPlural(steps.length, 'step') + ' for ' + client.shortName + '. Each step’s due date is below.' });
  };

  return (
    <div className="pf-page sb-client">
      <Panel title={'Open Services (' + open.length + ')'}
        action={<Button size="sm" variant="primary" onClick={() => setStarting(true)}><Icon name="plus" size={14} /> Start Service</Button>}>
        {!open.length && <div className="cr-applied-empty">Nothing in progress. Single-document services are completed the moment their note is signed.</div>}
        <div className="sb-insts">
          {open.map(i => {
            const s = sbServiceById(i.service_id), ver = sbInstVersion(i);
            if (!s || !ver) return null;
            const cfg = ver.config;
            const dl = cfg.steps.length > 1 ? sbDueFor(rule(cfg.deadline_rule_id), client, i) : null;
            const req = cfg.steps.filter(x => x.required);
            const doneN = req.filter(x => (i.steps.find(y => y.step_id === x.step_id) || {}).status === 'done').length;
            return (
              <section key={i.instance_id} className="sb-inst" aria-label={s.name}>
                <div className="sb-inst-head">
                  <div>
                    <h3 className="sb-inst-name">{s.name}</h3>
                    <div className="sb-inst-meta">Version {ver.version} · started {fmtDate(i.date_of_service)} by {sName(i.started_by)}
                      {dl && rule(cfg.deadline_rule_id) ? ' · all required steps due ' + sbDeadlinePhrase(rule(cfg.deadline_rule_id)) : ''}</div>
                  </div>
                  <span className="spacer" />
                  {dl && <SbDueBadge due={dl} />}
                </div>
                <div className="sb-progress" role="progressbar" aria-valuemin={0} aria-valuemax={req.length} aria-valuenow={doneN} aria-label={doneN + ' of ' + req.length + ' required steps done'}>
                  <span style={{ width: (req.length ? (doneN / req.length) * 100 : 0) + '%' }} />
                </div>
                <div className="sb-inst-count">{doneN} of {sbPlural(req.length, 'required step')} done</div>
                <ol className="sb-inst-steps">
                  {cfg.steps.map((st, ix) => {
                    const rec = i.steps.find(y => y.step_id === st.step_id) || {};
                    const isDone = rec.status === 'done';
                    const waits = st.after && (i.steps.find(y => y.step_id === st.after) || {}).status !== 'done';
                    const waitIx = waits ? cfg.steps.findIndex(x => x.step_id === st.after) : -1;
                    const own = st.rule_ids.map(rule).filter(Boolean);
                    const due = isDone ? null : st.required && dl ? dl : own.length ? sbDueFor(own[0], client, i) : null;
                    return (
                      <li key={st.step_id} className={'sb-inst-step' + (isDone ? ' is-done' : '')}>
                        <span className="sb-inst-ico">{isDone ? <Icon name="alertSuccess" size={18} /> : <span className="sb-dot" aria-hidden="true" />}</span>
                        <span className="sb-inst-text">
                          <span className="sb-inst-stepname">{st.name}{!st.required && <span className="sb-staff-opt"> · optional</span>}</span>
                          <span className="sb-inst-stepsub">
                            {st.kind}
                            {isDone ? ' · done ' + fmtDate(rec.done_on) : ''}
                            {!isDone && st.required && dl && own.length ? ' · then ' + own.map(crName).join(', ') : ''}
                            {!isDone && !dl && own.length ? ' · ' + own.map(crName).join(', ') : ''}
                          </span>
                        </span>
                        {!isDone && due && <SbDueBadge due={due} />}
                        {!isDone && (waits
                          ? <span className="sb-inst-wait">Waits for step {waitIx + 1}</span>
                          : <Button size="sm" variant="secondary" onClick={() => openStep(i, s, ver, st)}>{st.kind === 'Appointment' ? 'Schedule' : 'Open'}</Button>)}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </Panel>

      <Panel title={'Completed Services (' + done.length + ')'}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date of Service</th><th>Service</th><th>Version</th><th>Completed</th><th>By</th></tr></thead>
            <tbody>
              {done.map(i => {
                const s = sbServiceById(i.service_id), ver = sbInstVersion(i);
                if (!s || !ver) return null;
                const names = ver.config.steps.filter(x => (i.steps.find(y => y.step_id === x.step_id) || {}).status === 'done').map(x => x.name);
                return (
                  <tr key={i.instance_id}>
                    <td>{fmtDate(i.date_of_service)}</td>
                    <td className="wrap"><b>{s.name}</b></td>
                    <td>Version {ver.version}</td>
                    <td className="wrap">{names.join(', ') || '—'}</td>
                    <td>{sName(i.started_by)}</td>
                  </tr>
                );
              })}
              {!done.length && <tr><td colSpan={5} className="cam-empty">Nothing completed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {starting && (
        <Overlay title="Start Service" subtitle={client.displayName} size="md" onClose={() => setStarting(false)}>
          <ServiceStartForm client={client} onStart={onStart} onCancel={() => setStarting(false)} startLabel="Start Service" />
        </Overlay>
      )}
      {scheduling && (
        <ScheduleAppointmentOverlay client={client} onClose={() => setScheduling(null)}
          onScheduled={f => sbMarkStep(scheduling.i.instance_id, scheduling.st.step_id, f.date)} />
      )}
    </div>
  );
}

/* The banner a chart page shows when saving it completes a service step. */
function SbStepBanner({ client, doc }) {
  useServices();
  const o = sbOpenStepFor(client.client_id, doc);
  if (!o || !o.s) return null;
  return (
    <div className="chc-note chc-note--info note-link"><Icon name="uiTaskListLTR" size={15} />
      <div><b>Step {o.ix + 1} of {o.ver.config.steps.length} in {o.s.name}.</b> Saving {/^[AEIOU]/.test(doc) ? 'an' : 'a'} {doc} completes it.</div>
    </div>
  );
}
