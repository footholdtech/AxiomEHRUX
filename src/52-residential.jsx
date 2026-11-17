/* ===== Residential: the census, and bulk worklists ===================
   Residential, inpatient and foster-home staff do the same check for many
   clients in a row — contraband, room checks, rounding, a med pass. Today's
   production answer is one browser-style tab per client, each with its own
   dirty state, which is where cross-chart mistakes come from.

   The worklist is the alternative (see MULTI-CLIENT-WORKLIST-SPEC.md):

     · Select residents on the census, pick a check, start a worklist.
     · A pinned list on the left — searchable, sortable, resizable, and
       collapsible to a slim column of avatars and statuses — with ONE client
       in context at a time on the right, under the normal client header.
     · Saving writes to that client's chart and moves straight to the next
       unfinished client. No interim page: the list already says who is next.
     · Moving to another client with unsaved changes keeps them as a draft in
       the worklist, without a dialog. The only confirmation is at Finish.
     · Finish with unfinished clients: save the drafts to their charts and
       keep the rest as a task in Approvals & Tasks, or discard them.
     · Leaving the worklist any other way pauses it, keeping drafts, and it
       shows in Approvals & Tasks until it's finished or discarded.

   PROTOTYPE SCOPE. Worklists live in memory (a reload starts clean). In the
   product they'd be server-side, so a paused worklist survives a sign-out.
   ================================================================ */

/* ---- The census --------------------------------------------------- */
const RESIDENTS = CLIENTS.filter(c => c.bed && c.status === 'Active')
  .sort((a, b) => (a.bed.site_id + a.bed.room + a.bed.bed).localeCompare(b.bed.site_id + b.bed.room + b.bed.bed));
const RES_SITES = [...new Set(RESIDENTS.map(c => c.bed.site_id))];
const buildingName = sid => siteName(sid).split(' - ').pop();
const roomBed = c => (c && c.bed ? c.bed.room + ' · Bed ' + c.bed.bed : '—');
const fmtTime = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
const nowHM = () => new Date().toTimeString().slice(0, 5);

/* ---- Checks a worklist can run ---------------------------------------
   The same spec renders on the chart's module page (MODULE_SPECS) and in a
   worklist, so a check entered either way is the same record. Nothing that
   screens for safety has a default answer. */
const CHECK_SPECS = {
  'Contraband Check': {
    noun: 'Contraband Check',
    fields: [
      { key: 'type', label: 'Check type', type: 'radio', options: ['Routine', 'Return from pass', 'Admission', 'Random'], required: true, def: 'Routine', wide: true },
      { key: 'areas', label: 'Areas searched', type: 'checks', options: ['Person', 'Belongings', 'Room', 'Mail or packages'], required: true, def: () => [], wide: true },
      { key: 'found', label: 'Contraband found?', type: 'radio', options: ['Yes', 'No'], required: true, hint: 'No default answer. Choose one.' },
      { key: 'items', label: 'Items found', type: 'textarea', required: true, wide: true, when: f => f.found === 'Yes' },
      { key: 'disposition', label: 'What happened to the items', type: 'select', required: true, when: f => f.found === 'Yes',
        options: ['Secured with patient valuables', 'Destroyed per policy', 'Returned to family', 'Given to law enforcement'] },
      { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ],
    summary: f => [f.type, (f.areas || []).join(', ') || 'No areas recorded',
      f.found === 'Yes' ? 'Found: ' + ((f.items || '').trim() || 'not described') : f.found === 'No' ? 'None found' : 'Not answered'].join(' · '),
  },
  'Room Check': {
    noun: 'Room Check',
    fields: [
      { key: 'condition', label: 'Room condition', type: 'radio', options: ['Acceptable', 'Needs attention'], required: true },
      { key: 'checked', label: 'Checked for', type: 'checks', options: ['Sharps', 'Ligature risks', 'Cleanliness', 'Unauthorized items'], required: true, def: () => [], wide: true },
      { key: 'followup', label: 'What needs attention', type: 'textarea', required: true, wide: true, when: f => f.condition === 'Needs attention' },
      { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ],
    summary: f => [f.condition || 'Not answered', (f.checked || []).join(', ') || 'Nothing recorded'].join(' · '),
  },
};
const WORKLIST_ACTIONS = Object.keys(CHECK_SPECS);
/* The census's per-row Actions — production's list, trimmed to the checks
   and modules this prototype routes. Each opens on that client's chart. */
const ROW_ACTIONS = ['Contraband Check', 'Room Check', 'BHT Rounding Sheet', 'eMar', 'CIWA', 'CINA', 'Patient Valuables', 'Restraint And Seclusion', 'Scanned Documents'];

/* ---- Check records on the chart --------------------------------------- */
function upsertPageRow(scope, page, row) {
  const k = pageKey(scope, page);
  PAGE_ROWS[k] = [row].concat((PAGE_ROWS[k] || []).filter(r => r.id !== row.id));
  touchRecords();
}
function removePageRow(scope, page, id) {
  const k = pageKey(scope, page);
  PAGE_ROWS[k] = (PAGE_ROWS[k] || []).filter(r => r.id !== id);
  touchRecords();
}
const makeCheckRow = (action, f, status, id, summary) => ({
  id: id || newId('CHK'), date: isoOf(TODAY), time: nowHM(), by_staff_id: ME.id, status,
  summary: summary || CHECK_SPECS[action].summary(f), values: clone(f),
});
/* Two earlier checks per resident, so the census and the chart have history. */
function sampleChecks(c, action) {
  const s = seed(c.client_id + action), staff = ['ST-2004', 'ST-2005', 'ST-2008'];
  const sum = action === 'Contraband Check' ? 'Routine · Person, Belongings · None found' : 'Acceptable · Sharps, Ligature risks, Cleanliness';
  return [1, 3].map((d, i) => ({ id: c.client_id + slugify(action) + '-s' + i, date: isoOf(addDays(TODAY, -d - (s % 2) * i)),
    time: ['20:10', '21:05', '19:40', '08:15'][(s + i) % 4], by_staff_id: staff[(s + i) % 3], status: 'Final', summary: sum }));
}
const checkRows = (c, action) => pageRows(c.client_id, action).concat(sampleChecks(c, action));
const lastCheck = (c, action) => checkRows(c, action).find(r => r.status !== 'Draft') || null;
const whenLabel = r => (r.date === isoOf(TODAY) ? 'Today' : r.date === isoOf(addDays(TODAY, -1)) ? 'Yesterday' : fmtDate(r.date)) + ' ' + fmtTime(r.time);
const CHECK_TONE = { Draft: 'status-warn', Final: 'status-active' };
const draftCheck = (c, action) => pageRows(c.client_id, action).find(r => r.status === 'Draft') || null;
/* The census cell: the last check that counts, plus any draft waiting on
   the chart — so the next shift can see a check was started. */
function CheckCell({ c, action }) {
  const last = lastCheck(c, action), d = draftCheck(c, action);
  return (
    <React.Fragment>
      {last ? whenLabel(last) : '—'}
      {last && last.status !== 'Final' && <div className="res-sub">{last.status}</div>}
      {d && <div><span className="badge status-warn">Draft {fmtTime(d.time)}</span></div>}
    </React.Fragment>
  );
}

WORKLIST_ACTIONS.forEach(action => {
  const spec = CHECK_SPECS[action];
  MODULE_SPECS[action] = {
    noun: spec.noun, fields: spec.fields, rows: c => checkRows(c, action),
    cols: [['When', r => whenLabel(r)], ['Result', r => r.summary], ['Status', r => <span className={'badge ' + (CHECK_TONE[r.status] || 'status-info')}>{r.status}</span>],
      ['Entered By', r => sName(r.by_staff_id)]],
    save: (c, f) => {
      upsertPageRow(c.client_id, action, makeCheckRow(action, f, 'Final'));
      return { title: action + ' saved for ' + c.name, detail: 'DOB ' + fmtDate(c.dob) + ' · ' + roomBed(c) };
    },
  };
});

/* ---- Worklist store ----------------------------------------------------
   entry.status: todo · draft · done · refused · unavailable · skipped.
   `dirty` is the open form's unsaved edits; it becomes a draft the moment
   you leave that client. */
const WL_EVT = 'axiom-worklists-changed';
const WL = { seq: 0, lists: {} };
const touchWL = () => { window.dispatchEvent(new Event(WL_EVT)); window.dispatchEvent(new Event(NOTIF_EVT)); };
function useWLVersion() {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV(x => x + 1);
    window.addEventListener(WL_EVT, f);
    return () => window.removeEventListener(WL_EVT, f);
  }, []);
}
const WL_OUTCOMES = { refused: 'Refused', unavailable: 'Not available', skipped: 'Skipped' };
const isFinished = e => e.status === 'done' || !!WL_OUTCOMES[e.status];
const unfinished = wl => wl.entries.filter(e => !isFinished(e));
const draftsOf = wl => wl.entries.filter(e => !isFinished(e) && (e.status === 'draft' || e.dirty));
const wlPath = (id, cid) => '/residential/worklist/' + id + '/' + cid;
/* `kind` drives the slim rail's badge: done · draft · out · todo. */
function entryStatus(e) {
  if (e.dirty) return { label: 'Unsaved changes', tone: 'status-warn', kind: 'draft', icon: 'edit' };
  if (e.status === 'draft') return { label: e.onChart ? 'Draft on chart' : 'Draft', tone: 'status-warn', kind: 'draft', icon: 'edit' };
  if (e.status === 'done') return { label: 'Completed ' + fmtTime(e.at), tone: 'status-active', kind: 'done', icon: 'check' };
  if (WL_OUTCOMES[e.status]) return { label: WL_OUTCOMES[e.status], tone: 'status-info', kind: 'out', icon: 'ban' };
  return { label: 'Not started', tone: '', kind: 'todo', icon: null };
}
function createWorklist(action, cids, scope) {
  const id = 'WL-' + (++WL.seq);
  const spec = CHECK_SPECS[action];
  WL.lists[id] = { id, action, scope, started: nowHM(), startedMs: Date.now(), state: 'active', open: false,
    entries: cids.map((cid, i) => ({ cid, order: i, v: blankFor(spec), status: 'todo', dirty: false, at: null, reason: '',
      rowId: null, onChart: false, saved: null, amending: false })) };
  touchWL();
  return WL.lists[id];
}
const liveWorklists = () => Object.values(WL.lists).filter(w => w.state !== 'discarded' && w.state !== 'complete' && unfinished(w).length);
function resumeWorklist(guard, id) {
  const wl = WL.lists[id]; if (!wl) return;
  const e = wl.entries.find(x => !isFinished(x)) || wl.entries[0];
  guard.go(wlPath(id, e.cid));
}
/* Leaving a client: unsaved edits become a draft (kept in sync with the
   chart if the draft is already there). An edit to a saved check is dropped
   instead — the saved record stays as it was. */
function keepDraft(wl, e) {
  if (!e || !e.dirty) return false;
  e.dirty = false;
  if (e.amending) { e.v = clone(e.saved); e.amending = false; return 'reverted'; }
  e.status = 'draft';
  if (e.onChart) upsertPageRow(e.cid, wl.action, makeCheckRow(wl.action, e.v, 'Draft', e.rowId));
  return true;
}
function saveDraftsToCharts(wl) {
  wl.entries.forEach(e => {
    keepDraft(wl, e);
    if (e.status !== 'draft') return;
    e.rowId = e.rowId || newId('CHK');
    upsertPageRow(e.cid, wl.action, makeCheckRow(wl.action, e.v, 'Draft', e.rowId));
    e.onChart = true;
  });
  wl.state = 'paused';
  touchWL();
}
function discardWorklist(id) {
  const wl = WL.lists[id]; if (!wl) return 0;
  let n = 0;
  wl.entries.forEach(e => {
    if (isFinished(e)) return;
    if (e.status === 'draft' || e.dirty) n++;
    if (e.onChart && e.rowId) removePageRow(e.cid, wl.action, e.rowId);
    e.dirty = false;
  });
  wl.state = 'discarded'; wl.open = false;
  touchWL();
  return n;
}
/* Approvals & Tasks: one row per unfinished worklist that isn't on screen. */
function worklistNotifs() {
  return liveWorklists().filter(w => !w.open).map(w => {
    const left = unfinished(w), drafts = draftsOf(w), onChart = drafts.filter(e => e.onChart).length;
    const draftNote = !drafts.length ? '' : ' · ' + drafts.length + ' draft' + (drafts.length === 1 ? '' : 's')
      + (onChart === drafts.length ? ' on charts' : onChart ? '' : ' not yet on charts');
    return { notification_id: 'WLN-' + w.id, worklist_id: w.id, category: 'task', kind: 'worklist', source: 'Residential › Worklists',
      title: 'Finish your ' + w.action + ' worklist', detail: left.length + ' of ' + w.entries.length + ' clients left · ' + w.scope + draftNote,
      /* Age against the notification center's pinned clock, so "5m ago" means
         five real minutes since the worklist started. */
      client_id: null, created: new Date(NOTIF_NOW.getTime() - (Date.now() - w.startedMs)).toISOString(), status: 'open', read: false, urgent: false, done: null,
      from_staff_id: null, feed: 'Residential' };
  });
}

/* ---- Sorting the rail ----------------------------------------------------
   People line up for a med pass in whatever order they arrive, so the rail
   can be searched and re-sorted without changing the worklist itself. */
const WL_SORTS = ['Worklist order', 'Room and bed', 'Last name', 'Still to do'];
function sortEntries(entries, sort) {
  const C = e => CLIENT_BY_ID[e.cid];
  const key = {
    'Worklist order': e => String(e.order).padStart(4, '0'),
    'Room and bed': e => roomBed(C(e)),
    'Last name': e => C(e).last_name + ' ' + C(e).first_name,
    'Still to do': e => (isFinished(e) ? '2' : e.status === 'draft' || e.dirty ? '0' : '1') + String(e.order).padStart(4, '0'),
  }[sort];
  return entries.slice().sort((a, b) => key(a).localeCompare(key(b)));
}
const entryMatches = (e, q) => {
  const c = CLIENT_BY_ID[e.cid];
  return !q || (c.name + ' ' + (c.preferred_name || '') + ' ' + roomBed(c) + ' ' + fmtDate(c.dob)).toLowerCase().indexOf(q) !== -1;
};

/* ---- Rail width ---------------------------------------------------------
   Drag the edge to squeeze or widen it; drag it past its minimum (or use the
   collapse button) for the slim column. Remembered per person. */
const WL_RAIL_KEY = 'axiom-wl-rail';
const WL_RAIL = { min: 240, max: 440, def: 300, slim: 72 };
function useRailPref() {
  const [p, setP] = useState(() => ({ w: WL_RAIL.def, collapsed: false, ...readStored(WL_RAIL_KEY, {}) }));
  useEffect(() => { try { localStorage.setItem(WL_RAIL_KEY, JSON.stringify(p)); } catch (e) {} }, [p]);
  return [p, useCallback(patch => setP(x => ({ ...x, ...patch })), [])];
}

function WlBadge({ e }) {
  const s = entryStatus(e);
  return <span className={'badge ' + s.tone}>{s.icon && <Icon name={s.icon} size={12} />}{s.label}</span>;
}

function WorklistRail({ wl, ordered, activeCid, q, setQ, sort, setSort, pref, setPref, slim, onPick, onFinish }) {
  const n = wl.entries.length, done = n - unfinished(wl).length, drafts = draftsOf(wl).length;
  const shown = ordered.filter(e => entryMatches(e, q.trim().toLowerCase()));
  const listRef = useRef(null);
  /* Keep the client in view on screen in the list — after an auto-advance
     the next client can be below the fold. */
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[aria-current="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeCid, slim]);

  const drag = ev => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const x0 = ev.clientX, w0 = slim ? WL_RAIL.slim : pref.w;
    const move = m => {
      const w = w0 + m.clientX - x0;
      if (w < WL_RAIL.min - 70) setPref({ collapsed: true });
      else setPref({ collapsed: false, w: Math.max(WL_RAIL.min, Math.min(WL_RAIL.max, w)) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('is-col-resizing'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    document.body.classList.add('is-col-resizing');
  };
  const keyResize = ev => {
    const step = ev.shiftKey ? 40 : 16;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); if (slim) return; pref.w - step < WL_RAIL.min ? setPref({ collapsed: true }) : setPref({ w: pref.w - step }); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); slim ? setPref({ collapsed: false }) : setPref({ w: Math.min(WL_RAIL.max, pref.w + step) }); }
    if (ev.key === 'Enter') { ev.preventDefault(); setPref({ collapsed: !slim }); }
  };
  const resizer = (
    <div className="wl-resizer" role="separator" aria-orientation="vertical" aria-label="Resize worklist" tabIndex={0}
      aria-valuemin={WL_RAIL.slim} aria-valuemax={WL_RAIL.max} aria-valuenow={slim ? WL_RAIL.slim : pref.w}
      onPointerDown={drag} onKeyDown={keyResize} onDoubleClick={() => setPref({ collapsed: !slim })} />
  );

  if (slim) return (
    <aside className="wl-rail wl-rail--slim" aria-label={wl.action + ' worklist'}>
      <Tooltip label="Expand list"><button className="icon-btn" aria-label="Expand list" onClick={() => setPref({ collapsed: false })}><Icon name="panelExpand" size={20} /></button></Tooltip>
      <div className="wl-slim-count" aria-label={done + ' of ' + n + ' recorded'}>{done}/{n}</div>
      <div className="wl-slim-progress" aria-hidden="true"><span style={{ height: (n ? done / n * 100 : 0) + '%' }} /></div>
      <ol className="wl-slim-list" ref={listRef}>
        {ordered.map(e => {
          const c = CLIENT_BY_ID[e.cid], s = entryStatus(e), on = e.cid === activeCid;
          return (
            <li key={e.cid}>
              <Tooltip label={c.name + ' · ' + roomBed(c) + ' · ' + s.label}>
                <button className={'wl-slim-item' + (on ? ' is-active' : '')} aria-current={on ? 'true' : undefined}
                  aria-label={c.name + ', ' + s.label} onClick={() => onPick(e.cid)}>
                  <Avatar name={c.name} size="M" />
                  <span className={'wl-slim-badge wl-slim-badge--' + s.kind} aria-hidden="true">{s.icon && <Icon name={s.icon} size={10} />}</span>
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <Tooltip label="Finish worklist"><button className="icon-btn" aria-label="Finish worklist" onClick={onFinish}><Icon name="uiTaskListLTR" size={20} /></button></Tooltip>
      {resizer}
    </aside>
  );

  return (
    <aside className="wl-rail" aria-label={wl.action + ' worklist'}>
      <div className="wl-rail-head">
        <div className="wl-rail-titlerow">
          <span className="wl-rail-ico"><Icon name="uiTaskListLTR" size={20} /></span>
          <div className="wl-rail-title">
            <h2>{wl.action}</h2>
            <div className="wl-rail-sub">{wl.scope} · Started {fmtTime(wl.started)}</div>
          </div>
          <Tooltip label="Collapse list"><button className="icon-btn" aria-label="Collapse list" onClick={() => setPref({ collapsed: true })}><Icon name="panelCollapse" size={20} /></button></Tooltip>
        </div>
        <div className="wl-progress" role="progressbar" aria-label="Clients recorded" aria-valuemin={0} aria-valuemax={n} aria-valuenow={done}>
          <span style={{ width: (n ? done / n * 100 : 0) + '%' }} />
        </div>
        <div className="wl-progress-row"><span><b>{done} of {n}</b> recorded</span>{drafts > 0 && <span>{drafts} draft{drafts === 1 ? '' : 's'}</span>}</div>
        <div className="wl-tools">
          <span className="mini-search wl-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Search name, room or DOB" aria-label="Search this worklist" />
            {q && <button className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={14} /></button>}
          </span>
          <Dropdown value={sort} options={WL_SORTS} onChange={setSort} display={'Sort: ' + sort} />
        </div>
      </div>
      <ol className="wl-list" ref={listRef}>
        {shown.map(e => {
          const c = CLIENT_BY_ID[e.cid], on = e.cid === activeCid;
          return (
            <li key={e.cid}>
              <button className={'wl-item' + (on ? ' is-active' : '')} aria-current={on ? 'true' : undefined} onClick={() => onPick(e.cid)}>
                <Avatar name={c.name} size="M" />
                <span className="wl-item-text">
                  <span className="wl-item-name" title={c.name}>{c.last_name}, {c.first_name}{c.preferred_name && <span className="wl-item-pref"> “{c.preferred_name}”</span>}</span>
                  <span className="wl-item-meta">{roomBed(c)} · DOB {fmtDate(c.dob)}</span>
                  <WlBadge e={e} />
                </span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="wl-empty">No one on this worklist matches “{q.trim()}”.</li>}
      </ol>
      <div className="wl-rail-foot"><Button variant="secondary" onClick={onFinish}>Finish Worklist</Button></div>
      {resizer}
    </aside>
  );
}

/* ---- Dialogs ------------------------------------------------------------ */
function CantCompleteOverlay({ client, action, onClose, onRecord }) {
  const [kind, setKind] = useState('');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const KINDS = Object.entries(WL_OUTCOMES);
  const label = (KINDS.find(([, l]) => l === kind) || [])[0];
  const needReason = label && label !== 'refused';
  const err = { kind: !kind ? 'Choose what happened.' : null, reason: needReason && !reason.trim() ? 'Say why, so the next shift knows.' : null };
  const submit = () => { setTried(true); if (err.kind || err.reason) return; onRecord(label, reason.trim()); };
  return (
    <Overlay size="sm" title="Couldn’t Complete" subtitle={client.name + ' · DOB ' + fmtDate(client.dob) + ' · ' + roomBed(client)} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Record for {client.name}</Button></React.Fragment>}>
      <div className="pf-grid pf-grid--one">
        <Field label={'Why wasn’t the ' + action.toLowerCase() + ' done?'} required error={tried ? err.kind : null} wide>
          <RadioGroup name="wl-cant" options={KINDS.map(([, l]) => l)} value={kind} onChange={setKind} invalid={tried && !!err.kind} />
        </Field>
        <Field label="Reason" required={needReason} error={tried ? err.reason : null} wide hint="For example: on a day pass until 6 PM.">
          <TextArea value={reason} onChange={setReason} rows={2} invalid={tried && !!err.reason} />
        </Field>
      </div>
    </Overlay>
  );
}

/* The one confirmation in a worklist: ending it with clients unfinished.
   The decision is ONE control — two radio cards that each say what they do —
   and one Finish button. Nothing is pre-selected: keeping or discarding
   clinical drafts has to be a deliberate choice. */
function FinishWorklistOverlay({ wl, onClose, onSave, onDiscard }) {
  const left = unfinished(wl), drafts = draftsOf(wl), n = wl.entries.length;
  const pl = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const [choice, setChoice] = useState(null);
  const [tried, setTried] = useState(false);
  const finish = () => { setTried(true); if (choice === 'keep') onSave(); else if (choice === 'discard') onDiscard(); };
  const CHOICES = [
    { key: 'keep', title: drafts.length ? 'Save drafts and keep the rest in my tasks' : 'Keep the rest in my tasks',
      body: (drafts.length ? pl(drafts.length, 'draft') + ' will be saved to ' + (drafts.length === 1 ? 'that client’s chart' : 'each client’s chart') + ' as a draft. ' : '')
        + 'The ' + pl(left.length, 'unfinished client') + ' stay' + (left.length === 1 ? 's' : '') + ' in Approvals & Tasks, so you can come back to them.' },
    { key: 'discard', title: drafts.length ? 'Discard drafts' : 'Discard the rest',
      body: (drafts.length ? 'Drafts are deleted and nothing more is added to any chart. ' : 'Nothing more is added to any chart. ')
        + 'Checks already saved stay on the charts.' },
  ];
  const err = tried && !choice;
  return (
    <Overlay size="md" title="Finish Worklist?" subtitle={wl.action + ' · ' + wl.scope} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Keep Working</Button>
        <Button variant="primary" onClick={finish}>Finish Worklist</Button>
      </React.Fragment>}>
      <p className="wl-fin-lede"><b>{n - left.length} of {n}</b> clients are recorded. {pl(left.length, 'client')} {left.length === 1 ? 'isn’t' : 'aren’t'} finished:</p>
      <ul className="wl-fin-list">
        {left.map(e => {
          const c = CLIENT_BY_ID[e.cid];
          return (
            <li key={e.cid}>
              <Avatar name={c.name} size="S" />
              <span className="wl-fin-name">{c.name}</span>
              <span className="wl-fin-meta">{roomBed(c)}</span>
              <WlBadge e={e} />
            </li>
          );
        })}
      </ul>
      <div className="ff-label" id="wl-fin-q">What should happen to the unfinished clients?<span className="ff-req"> * <span className="ff-req-txt">(Required)</span></span></div>
      <div className={'wl-fin-choices' + (err ? ' invalid' : '')} role="radiogroup" aria-labelledby="wl-fin-q" aria-invalid={err || undefined}>
        {CHOICES.map(ch => (
          <label key={ch.key} className={'rds-radio wl-fin-choice' + (choice === ch.key ? ' is-checked' : '')}>
            <input type="radio" name="wl-fin" checked={choice === ch.key} onChange={() => setChoice(ch.key)} />
            <span className="rds-radio__dot" aria-hidden="true" />
            <span className="wl-fin-choice-text"><b>{ch.title}</b><span>{ch.body}</span></span>
          </label>
        ))}
      </div>
      {err && <div className="ff-error"><Icon name="warn" size={13} /> Choose what happens to the unfinished clients.</div>}
    </Overlay>
  );
}

/* From the notification's More menu. */
function DiscardWorklistOverlay({ wlId, onClose }) {
  const guard = useGuard();
  const wl = WL.lists[wlId];
  if (!wl) return null;
  const drafts = draftsOf(wl).length;
  return (
    <Overlay size="sm" title="Discard Worklist?" subtitle={wl.action + ' · ' + wl.scope} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { discardWorklist(wlId); onClose(); guard.setToast({ status: 'success', title: wl.action + ' worklist discarded', detail: drafts ? drafts + ' draft' + (drafts === 1 ? '' : 's') + ' deleted.' : 'Removed from your tasks.' }); }}>Discard Worklist</Button></React.Fragment>}>
      <p className="wl-fin-lede">{unfinished(wl).length} clients aren’t finished.{drafts ? ' Their drafts are deleted, including any saved on a chart.' : ''} Checks already saved stay on the charts.</p>
    </Overlay>
  );
}

/* ---- The worklist page --------------------------------------------------- */
function WorklistPage({ wlId, cid }) {
  useWLVersion();
  useRecordsVersion();
  const guard = useGuard();
  const wl = WL.lists[wlId];
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(WL_SORTS[0]);
  const [pref, setPref] = useRailPref();
  const [tried, setTried] = useState(false);
  const [cant, setCant] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const phone = useMedia(BP.mobile);
  const slim = pref.collapsed || phone;

  /* On screen, the worklist isn't a task; off screen, it is. Leaving by any
     route but Finish pauses it — drafts kept, nothing asked. */
  useEffect(() => {
    if (!wl) return;
    wl.open = true;
    if (wl.state === 'paused') wl.state = 'active';
    touchWL();
    return () => {
      wl.open = false;
      if (wl.state === 'active' && unfinished(wl).length) {
        wl.entries.forEach(e => keepDraft(wl, e));
        wl.state = 'paused';
        guard.setToast({ status: 'info', title: wl.action + ' worklist paused',
          detail: unfinished(wl).length + ' clients left. Resume it from Approvals & Tasks or the Residential page.' });
      }
      touchWL();
    };
  }, [wlId]);
  useEffect(() => { setTried(false); setCant(false); }, [cid]);
  /* Direct entry (a reload, a pasted link): adopt the client in view. */
  useEffect(() => { if (wl && CLIENT_BY_ID[cid] && guard.clientId !== cid && !needsAccessRequest(cid)) guard.adopt(cid); }, [cid]);

  const entry = wl && wl.entries.find(e => e.cid === cid);
  const client = CLIENT_BY_ID[cid];
  if (!wl || !entry || !client) return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Residential', to: '/residential' }, { label: 'Worklist' }]} />
      <Panel title="Worklist Not Found">
        <div className="stub"><Icon name="info" size={20} /><div>This worklist has ended or isn’t open in this session. Worklists are kept in memory in the prototype, so a reload clears them.
          {' '}<button className="lnk" onClick={() => guard.go('/residential')}>Back to Residential</button></div></div>
      </Panel>
    </div>
  );

  const spec = CHECK_SPECS[wl.action];
  const ordered = sortEntries(wl.entries, sort);
  const left = unfinished(wl);
  const editing = !isFinished(entry) || entry.amending;
  /* Next = the next unfinished client after this one, in the order the rail
     shows, wrapping. */
  const nextEntry = (() => {
    const i = ordered.indexOf(entry);
    for (let k = 1; k < ordered.length; k++) { const e = ordered[(i + k) % ordered.length]; if (!isFinished(e)) return e; }
    return null;
  })();
  const nextClient = nextEntry && CLIENT_BY_ID[nextEntry.cid];

  const go = (toCid, toast) => {
    if (toCid === cid) return;
    const kept = keepDraft(wl, entry);
    touchWL();
    guard.request({ to: wlPath(wl.id, toCid), client: toCid, worklist: true,
      toast: toast || (kept === true ? { status: 'info', title: 'Draft kept for ' + client.name, detail: 'Not on the chart yet. It’s marked Draft in the list.' }
        : kept === 'reverted' ? { status: 'info', title: 'Edit not saved', detail: client.name + '’s saved ' + wl.action.toLowerCase() + ' is unchanged.' } : undefined) });
  };
  /* After a save: straight to the next unfinished client. The toast names who
     was saved and who's next; the rail shows both. */
  const advance = toast => {
    setQ('');
    if (nextEntry && nextEntry !== entry) go(nextEntry.cid, { ...toast, detail: toast.detail + ' · Next: ' + nextClient.name });
    else guard.setToast({ ...toast, detail: toast.detail + ' · Every client on this worklist is recorded.' });
  };
  const set = (k, v) => { entry.v = { ...entry.v, [k]: v }; entry.dirty = true; touchWL(); };
  const save = () => {
    setTried(true);
    if (specMissing(spec, entry.v)) return;
    entry.rowId = entry.rowId || newId('CHK');
    upsertPageRow(cid, wl.action, makeCheckRow(wl.action, entry.v, 'Final', entry.rowId));
    Object.assign(entry, { status: 'done', dirty: false, amending: false, onChart: true, at: nowHM(), saved: clone(entry.v), reason: '' });
    touchWL();
    advance({ status: 'success', title: wl.action + ' saved for ' + client.name, detail: 'DOB ' + fmtDate(client.dob) + ' · ' + roomBed(client) });
  };
  const record = (kind, reason) => {
    entry.rowId = entry.rowId || newId('CHK');
    upsertPageRow(cid, wl.action, makeCheckRow(wl.action, entry.v, WL_OUTCOMES[kind], entry.rowId, WL_OUTCOMES[kind] + (reason ? ' · ' + reason : '')));
    Object.assign(entry, { status: kind, reason, dirty: false, amending: false, onChart: true, at: nowHM(), saved: clone(entry.v) });
    setCant(false);
    touchWL();
    advance({ status: 'success', title: WL_OUTCOMES[kind] + ' recorded for ' + client.name, detail: 'DOB ' + fmtDate(client.dob) + ' · ' + roomBed(client) });
  };
  const finish = () => {
    keepDraft(wl, entry);
    touchWL();
    if (unfinished(wl).length) return setFinishing(true);
    wl.state = 'complete';
    guard.go('/residential', { toast: { status: 'success', title: wl.action + ' worklist complete', detail: wl.entries.length + ' of ' + wl.entries.length + ' clients recorded · ' + wl.scope } });
  };
  const saveAndClose = () => {
    const d = draftsOf(wl).length, l = unfinished(wl).length;
    saveDraftsToCharts(wl);
    setFinishing(false);
    guard.go('/residential', { toast: { status: 'success', title: d ? d + ' draft' + (d === 1 ? '' : 's') + ' saved to charts' : 'Worklist kept in your tasks',
      detail: l + ' client' + (l === 1 ? '' : 's') + ' left in Approvals & Tasks.' } });
  };
  const discardAndClose = () => {
    const d = discardWorklist(wl.id);
    setFinishing(false);
    guard.go('/residential', { toast: { status: 'success', title: wl.action + ' worklist closed', detail: d ? d + ' draft' + (d === 1 ? '' : 's') + ' discarded.' : 'Unfinished clients were dropped.' } });
  };

  const shownFields = spec.fields.filter(fd => fieldShown(fd, entry.v));
  const fmtVal = (fd, v) => (Array.isArray(v) ? (v.length ? v.join(', ') : '—') : (v || '—'));
  const title = <span>{wl.action} <span className="wl-for">for {client.name}</span></span>;

  return (
    <div className={'wl' + (slim ? ' wl--slim' : '')} style={{ '--wl-rail-w': (slim ? WL_RAIL.slim : pref.w) + 'px' }}>
      <WorklistRail wl={wl} ordered={ordered} activeCid={cid} q={q} setQ={setQ} sort={sort} setSort={setSort}
        pref={pref} setPref={setPref} slim={slim} onPick={c => go(c)} onFinish={finish} />
      <div className="wl-main">
        <div className="wl-crumbs">
          <Breadcrumbs items={[{ label: 'Residential', to: '/residential' }, { label: wl.action + ' Worklist' }, { label: client.name }]} />
        </div>
        <div className="wl-head"><ClientPageHeader client={client} /></div>
        <div className="wl-body">
          {!left.length && (
            <div className="wl-alldone" role="status">
              <Icon name="alertSuccess" size={20} />
              <div><b>All {wl.entries.length} clients are recorded.</b> Finish the worklist to close it.</div>
              <span className="spacer" />
              <Button variant="primary" onClick={finish}>Finish Worklist</Button>
            </div>
          )}
          {editing ? (
            <Panel title={title} action={<WlBadge e={entry} />}>
              {entry.amending && <div className="wl-note"><Icon name="info" size={16} /> Editing a saved check. If you move on without saving, the saved check stays as it was.</div>}
              {entry.status === 'draft' && !entry.dirty && <div className="wl-note"><Icon name="info" size={16} /> {entry.onChart ? 'This draft is on ' + client.shortName + '’s chart.' : 'Draft kept in this worklist. It isn’t on the chart until you save it.'}</div>}
              <SpecFields spec={spec} f={entry.v} set={set} tried={tried} idPrefix={'wl-' + cid} />
              <div className="pf-foot wl-foot">
                <span className="wl-next">{nextClient && nextEntry !== entry ? <React.Fragment>Saves to {client.shortName}’s chart, then opens <b>{nextClient.name}</b></React.Fragment> : 'Saves to ' + client.shortName + '’s chart'}</span>
                {!entry.amending && <Button variant="secondary" onClick={() => setCant(true)}>Couldn’t Complete…</Button>}
                {entry.amending && <Button variant="secondary" onClick={() => { entry.v = clone(entry.saved); entry.amending = false; entry.dirty = false; touchWL(); }}>Cancel Edit</Button>}
                <Button variant="primary" onClick={save}>Save for {client.name}</Button>
              </div>
            </Panel>
          ) : (
            <Panel title={title} action={<WlBadge e={entry} />}>
              <dl className="wl-done">
                {entry.status === 'done'
                  ? shownFields.map(fd => <React.Fragment key={fd.key}><dt>{fd.label}</dt><dd>{fmtVal(fd, entry.v[fd.key])}</dd></React.Fragment>)
                  : <React.Fragment><dt>Outcome</dt><dd>{WL_OUTCOMES[entry.status]}</dd><dt>Reason</dt><dd>{entry.reason || '—'}</dd></React.Fragment>}
                <dt>Recorded</dt><dd>{fmtTime(entry.at)} by {ME.name}</dd>
              </dl>
              <div className="pf-foot wl-foot">
                <span className="wl-next">Saved to {client.shortName}’s chart.</span>
                <Button variant="secondary" onClick={() => { entry.amending = true; touchWL(); }}>Edit</Button>
                {nextClient && <Button variant="primary" onClick={() => go(nextEntry.cid)}>Next: {nextClient.name}</Button>}
              </div>
            </Panel>
          )}
        </div>
      </div>
      {cant && <CantCompleteOverlay client={client} action={wl.action} onClose={() => setCant(false)} onRecord={record} />}
      {finishing && <FinishWorklistOverlay wl={wl} onClose={() => setFinishing(false)} onSave={saveAndClose} onDiscard={discardAndClose} />}
    </div>
  );
}

/* ---- The census page ------------------------------------------------------ */
function RowActions({ client }) {
  const guard = useGuard();
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menuRef = useRef(null);
  useOutside([ref, menuRef], () => setOpen(false));
  const openTo = name => { setOpen(false); guard.setClient(client.client_id, name ? { to: '/chart/' + client.client_id + '/' + slugify(name) } : undefined); };
  return (
    <span ref={ref} className="nstart">
      <Button size="sm" variant="secondary" onClick={() => setOpen(o => !o)}>Actions <Icon name="chevronDown" size={14} /></Button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu" role="menu" minWidth={240} maxHeight={360} onClose={() => setOpen(false)}>
          <div className="dd-list">
            <button type="button" role="menuitem" className="dd-opt" onClick={() => openTo(null)}>Open Chart</button>
          </div>
          <div className="dd-head">Open on {client.shortName}’s chart</div>
          <div className="dd-list">
            {ROW_ACTIONS.map(a => <button key={a} type="button" role="menuitem" className="dd-opt" onClick={() => openTo(a)}>{a}</button>)}
          </div>
        </FloatMenu>
      )}
    </span>
  );
}

function ResidentialPage() {
  useRecordsVersion();
  useWLVersion();
  const guard = useGuard();
  const ALL_B = 'All Buildings', ALL_U = 'All Units';
  const [building, setBuilding] = useState(ALL_B);
  const [unit, setUnit] = useState(ALL_U);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [action, setAction] = useState(WORKLIST_ACTIONS[0]);
  const [discarding, setDiscarding] = useState(null);

  const inBuilding = RESIDENTS.filter(c => building === ALL_B || buildingName(c.bed.site_id) === building);
  const unitOpts = [ALL_U].concat([...new Set(inBuilding.map(c => c.bed.unit_name))]);
  const s = q.trim().toLowerCase();
  const rows = inBuilding.filter(c => (unit === ALL_U || c.bed.unit_name === unit)
    && (!s || (c.name + ' ' + (c.preferred_name || '') + ' ' + roomBed(c) + ' ' + c.mrn).toLowerCase().indexOf(s) !== -1));
  const ids = rows.map(c => c.client_id);
  const allOn = ids.length > 0 && ids.every(id => sel.indexOf(id) !== -1);
  const someOn = ids.some(id => sel.indexOf(id) !== -1);
  const toggle = id => setSel(x => (x.indexOf(id) !== -1 ? x.filter(y => y !== id) : x.concat([id])));
  const toggleAll = () => setSel(x => (allOn ? x.filter(id => ids.indexOf(id) === -1) : [...new Set(x.concat(ids))]));
  const scope = (building === ALL_B ? 'Maple Grove' : building) + (unit === ALL_U ? '' : ' · ' + unit.split(' - ').pop());
  const start = () => {
    const cids = RESIDENTS.map(c => c.client_id).filter(id => sel.indexOf(id) !== -1);
    if (!cids.length) return;
    const wl = createWorklist(action, cids, scope);
    /* Opening the first client can still be intercepted (another chart in
       context with unsaved work, an access request). Cancelling that means
       the worklist never started, so it mustn't linger as "in progress". */
    guard.go(wlPath(wl.id, cids[0]), {
      onCommit: () => setSel([]),
      onCancel: () => { wl.state = 'discarded'; touchWL(); },
    });
  };
  const live = liveWorklists();
  const today = RESIDENTS.filter(c => c.bed.expected_discharge === isoOf(TODAY)).length;

  return (
    <div className="page res">
      <Breadcrumbs items={[{ label: 'Residential' }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Residential</h1>
          <div className="page-sub">Maple Grove Residential Campus · {RESIDENTS.length} residents · {today} discharging today · {fmtDate(TODAY)}</div>
        </div>
      </div>

      {live.map(w => {
        const l = unfinished(w).length;
        return (
          <div key={w.id} className="res-wl-alert" role="status">
            <Icon name="uiTaskListLTR" size={20} />
            <div className="res-wl-text"><b>{w.action} worklist in progress</b><span>{w.entries.length - l} of {w.entries.length} recorded · {l} left · {w.scope} · started {fmtTime(w.started)}</span></div>
            <span className="spacer" />
            <Button size="sm" variant="ghost" onClick={() => setDiscarding(w.id)}>Discard…</Button>
            <Button size="sm" variant="primary" onClick={() => resumeWorklist(guard, w.id)}>Resume Worklist</Button>
          </div>
        );
      })}

      <Panel title={'Census (' + rows.length + ')'}>
        <div className="res-filters">
          <div className="res-dd"><Dropdown value={building} options={[ALL_B].concat(RES_SITES.map(buildingName))} onChange={v => { setBuilding(v); setUnit(ALL_U); }} /></div>
          <div className="res-dd res-dd--wide"><Dropdown value={unit} options={unitOpts} onChange={setUnit} /></div>
          <MiniSearch value={q} onChange={setQ} placeholder="Search name, room or MRN" />
        </div>
        {sel.length > 0 ? (
          <div className="res-bulk" role="region" aria-label="Bulk actions">
            <b>{sel.length} selected</b>
            <span className="res-bulk-label">Start a worklist</span>
            <div className="res-dd"><Dropdown value={action} options={WORKLIST_ACTIONS} onChange={setAction} /></div>
            <Button variant="primary" onClick={start}>Start {action} for {sel.length} Client{sel.length === 1 ? '' : 's'}</Button>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setSel([])}>Clear Selection</Button>
          </div>
        ) : (
          <div className="res-hint">Select residents to start a worklist, then work down the list one client at a time. Each check saves to that client’s chart.</div>
        )}
        <div className="table-wrap">
          <table className="data-table res-table">
            <thead><tr>
              <th className="res-check"><Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={toggleAll} ariaLabel="Select all residents shown" /></th>
              <th>Room / Bed</th><th>Client</th><th>DOB</th><th>Admitted</th><th>Legal Status</th>
              <th>Last Contraband Check</th><th>Last Room Check</th><th />
            </tr></thead>
            <tbody>
              {rows.map(c => {
                const on = sel.indexOf(c.client_id) !== -1;
                return (
                  <tr key={c.client_id} className={on ? 'is-selected' : ''}>
                    <td className="res-check"><Checkbox checked={on} onChange={() => toggle(c.client_id)} ariaLabel={'Select ' + c.name} /></td>
                    <td><b className="res-bed">{roomBed(c)}</b><div className="res-sub">{c.bed.unit_name.split(' - ').pop()}</div></td>
                    <td>
                      <span className="cell-user">
                        <Avatar name={c.name} size="S" />
                        <span className="res-client">
                          <button className="lnk" onClick={() => guard.setClient(c.client_id)}>{c.name}</button>
                          {c.preferred_name && <span className="res-sub">Goes by {c.preferred_name}</span>}
                        </span>
                        {c.bed.expected_discharge === isoOf(TODAY) && <span className="badge status-info">Discharging today</span>}
                        {c.bed.precautions && <span className="badge status-warn">{c.bed.precautions}</span>}
                      </span>
                    </td>
                    <td>{fmtDate(c.dob)} ({c.age})</td>
                    <td>{fmtDate(c.bed.admit_date)}<div className="res-sub">{daysSince(c.bed.admit_date)} days</div></td>
                    <td>{c.bed.legal_status}</td>
                    <td><CheckCell c={c} action="Contraband Check" /></td>
                    <td><CheckCell c={c} action="Room Check" /></td>
                    <td style={{ textAlign: 'right' }}><RowActions client={c} /></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={9} className="cam-empty">No residents match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      {discarding && <DiscardWorklistOverlay wlId={discarding} onClose={() => setDiscarding(null)} />}
    </div>
  );
}
