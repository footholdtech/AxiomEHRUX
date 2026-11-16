/* ===== Admin › Due Date Rules =====================================
   WHEN documentation is due, relative to a service date: how long after
   which start date, how often after that, how early staff are warned, and
   for which programs. A rule says nothing about WHAT is due, and does
   nothing on its own.

   SERVICES SUBSCRIBE TO RULES. A service (Admin › Service Builder) is the
   container for what staff do with a client: its codes, diagnoses,
   programs, staff, sites, payors, the documents to complete and the
   appointments to create. Each step inside a service can subscribe to due
   date rules, and a workflow service can use one as its own deadline. So one rule ("Standard Annual Consent")
   serves dozens of services at once, and changing it moves all of them.
   A rule doesn't store its services; "Applied To" is derived from the
   services that point at it (RD.services).

   The builder reads as a sentence ("First due 6 months after the IBHIS
   enrollment start date, then every 6 months …"), with a plain-language
   summary and a worked schedule beside it.

   Named "Due Date Rules", not "Compliance Rules": compliance is far broader
   (note structure, how and in what order things are done). This is only the
   cadence.

   PROTOTYPE SCOPE. Agency configuration, never client data. Seeded from
   fixtures/reference-data/due_date_rules.json and services.json; edits
   persist to localStorage so a walkthrough survives a reload. The key moved
   to v2 when the service deadline rules (DDR-010 to 012) were added.
   ================================================================ */

const CR_DATA = RD.dueDateRules || { rules: [], populations: [], program_populations: [] };

/* The start dates a cadence can count from — the brief's list, in its order. */
const CR_ANCHORS = [
  { key: 'assignment', label: 'Client assignment to provider', short: 'provider assignment' },
  { key: 'referral', label: 'Client referral date', short: 'referral' },
  { key: 'ibhis-enroll', label: 'IBHIS enrollment start date', short: 'IBHIS enrollment start' },
  { key: 'reassignment', label: 'Client reassignment', short: 'reassignment' },
  { key: 'client-enroll', label: 'Client enrollment start date', short: 'client enrollment start' },
  { key: 'program-enroll', label: 'Program enrollment start date', short: 'program enrollment start' },
  { key: 'discharge', label: 'Client discharge date', short: 'discharge' },
];
const CR_ANCHOR = Object.fromEntries(CR_ANCHORS.map(a => [a.key, a]));
const CR_UNITS = ['days', 'weeks', 'months', 'years'];
const CR_WARN_UNITS = ['days', 'weeks', 'months'];
/* The two ways "then every N" can be counted. A fixed schedule keeps every
   due date where the start date put it; a rolling one restarts the clock
   from whenever it was actually done, so a late completion pushes the next
   one back. Agencies — and payers — mean different things here, so it is a
   choice on the rule, not an engineering assumption. */
const CR_BASIS = [
  { value: 'schedule', label: 'the previous due date' },
  { value: 'completed', label: 'the date it was last completed' },
];

const CR_PROGRAMS = (RD.programs || []).map(p => {
  const tag = (CR_DATA.program_populations || []).find(x => x.program_id === p.program_id);
  return { id: p.program_id, name: p.friendly_name, type: p.internal_type, populations: tag ? tag.populations : [] };
});
const CR_PROGRAMS_BY_ID = Object.fromEntries(CR_PROGRAMS.map(p => [p.id, p]));
const CR_POPULATIONS = CR_DATA.populations || [];

/* ---- Rule shape -------------------------------------------------- */
const crInt = (v, min) => { const n = parseInt(v, 10); return isNaN(n) ? min : Math.max(min, n); };
function crNormalise(r) {
  const span = (o, min, units, def) => ({ n: o && o.n != null ? crInt(o.n, min) : def.n, unit: o && units.indexOf(o.unit) !== -1 ? o.unit : def.unit });
  const sc = r.scope || {};
  return {
    id: r.rule_id || r.id || 'DDR-' + Date.now().toString(36).toUpperCase(),
    name: r.name || '',
    status: r.status === 'inactive' ? 'inactive' : 'active',
    first: span(r.first_due || r.first, 0, CR_UNITS, { n: 30, unit: 'days' }),
    anchor: CR_ANCHOR[r.anchor] ? r.anchor : 'program-enroll',
    repeat: r.repeat ? span(r.repeat, 1, CR_UNITS, { n: 12, unit: 'months' }) : null,
    basis: r.basis === 'completed' ? 'completed' : 'schedule',
    warn: span(r.warn, 0, CR_WARN_UNITS, { n: 30, unit: 'days' }),
    scope: {
      type: ['all', 'population', 'programs'].indexOf(sc.type) !== -1 ? sc.type : 'all',
      population: CR_POPULATIONS.indexOf(sc.population) !== -1 ? sc.population : CR_POPULATIONS[0],
      programs: (sc.programs || []).filter(id => CR_PROGRAMS.some(p => p.id === id)),
    },
    allowCancel: !!(r.allow_cancel || r.allowCancel),
    allowStartOverride: !!(r.allow_start_override || r.allowStartOverride),
    updated: r.updated || isoOf(TODAY),
    updatedBy: r.updated_by_staff_id || r.updatedBy || ME.id,
  };
}

const CR_KEY = 'axiom-due-date-rules-v2';
const crLoad = () => {
  try { const s = JSON.parse(localStorage.getItem(CR_KEY)); if (Array.isArray(s) && s.length) return s.map(crNormalise); } catch (e) {}
  return (CR_DATA.rules || []).map(crNormalise);
};
function useDueDateRules() {
  const [rules, setRulesRaw] = useState(crLoad);
  const setRules = next => setRulesRaw(prev => {
    const v = typeof next === 'function' ? next(prev) : next;
    try { localStorage.setItem(CR_KEY, JSON.stringify(v)); } catch (e) {}
    return v;
  });
  return [rules, setRules];
}
/* The services that subscribe to a rule, each with what in it the rule
   governs: steps ("Informed Consent, Release of Information"), or the whole
   service as its deadline. Read from the Service Builder store (55), at
   render time, so a change there shows here. */
const crApplied = id => sbRuleUsers(SB_STORE.get(), id, false);
const crTemplatesUsing = id => sbRuleUsers(SB_STORE.get(), id, true);

/* ---- Words --------------------------------------------------------- */
const crSpan = o => o.n + ' ' + (o.n === 1 ? o.unit.replace(/s$/, '') : o.unit);
const crSameSpan = (a, b) => a && b && a.n === b.n && a.unit === b.unit;
/* Rough length in days — only for sanity checks (is the warning longer than
   the cycle?), never for computing a due date. */
const CR_DAYS = { days: 1, weeks: 7, months: 30.44, years: 365.25 };
const crDays = o => o.n * CR_DAYS[o.unit];

function crProgramsInScope(r) {
  if (r.scope.type === 'all') return CR_PROGRAMS;
  if (r.scope.type === 'population') return CR_PROGRAMS.filter(p => p.populations.indexOf(r.scope.population) !== -1);
  return CR_PROGRAMS.filter(p => r.scope.programs.indexOf(p.id) !== -1);
}
/* "Adults programs" reads wrong; each population has its own adjective. */
const CR_POP_ADJ = { 'Children & youth': 'Child & youth', 'Transition-age youth': 'Transition-age youth', 'Adults': 'Adult', 'Older adults': 'Older adult' };
const crPopPrograms = pop => (CR_POP_ADJ[pop] || pop) + ' programs';
function crScopeLabel(r) {
  if (r.scope.type === 'all') return 'All programs';
  if (r.scope.type === 'population') return crPopPrograms(r.scope.population);
  const ps = crProgramsInScope(r);
  return ps.length === 1 ? ps[0].name : ps.length + ' programs';
}
/* When it's due, compactly: "6 months after, then every 6 months". */
function crCadence(r) {
  const first = r.first.n === 0 ? 'On the start date' : crSpan(r.first) + ' after';
  return r.repeat ? first + ', then every ' + crSpan(r.repeat) : first + ', once';
}
/* The generated name is short and approachable — cadence and start date
   only, as an admin would say it ("Annual from program enrollment",
   "Bi-weekly from program enrollment", "One-time, 7 days after
   discharge"). Warning and scope live in their own columns; putting them in
   the name made every name a paragraph. */
const CR_CADENCE_WORD = { '1 days': 'Daily', '1 weeks': 'Weekly', '2 weeks': 'Bi-weekly', '1 months': 'Monthly',
  '3 months': 'Quarterly', '6 months': 'Twice-yearly', '12 months': 'Annual', '1 years': 'Annual' };
function crGeneratedName(r) {
  const a = CR_ANCHOR[r.anchor].short.replace(/ start$/, '');
  if (!r.repeat) return 'One-time, ' + (r.first.n === 0 ? 'at ' + a : crSpan(r.first) + ' after ' + a);
  const word = CR_CADENCE_WORD[r.repeat.n + ' ' + r.repeat.unit] || 'Every ' + crSpan(r.repeat);
  return word + ' from ' + a;
}
const crName = r => (r.name || '').trim() || crGeneratedName(r);

/* The plain-language reading shown beside the builder. */
function CrSentence({ rule }) {
  const a = CR_ANCHOR[rule.anchor].label.toLowerCase().replace('ibhis', 'IBHIS');
  const ps = crProgramsInScope(rule);
  return (
    <div className="cr-sentence">
      <p>
        Due <b>{rule.first.n === 0 ? 'on the ' + a : crSpan(rule.first) + ' after the ' + a}</b>
        {rule.repeat
          ? <React.Fragment>, then <b>every {crSpan(rule.repeat)}</b>, counted from {rule.basis === 'completed' ? 'the date it was last completed' : 'the previous due date'}.</React.Fragment>
          : <React.Fragment>, <b>once</b>.</React.Fragment>}
      </p>
      <p>{rule.warn.n
        ? <React.Fragment>Staff are warned <b>{crSpan(rule.warn)}</b> before {rule.repeat ? 'each' : 'the'} due date.</React.Fragment>
        : 'Staff aren’t warned ahead; it shows as due on the day.'}</p>
      <p>Applies to clients in <b>{rule.scope.type === 'all' ? 'every program' : crScopeLabel(rule)}</b>
        {rule.scope.type !== 'all' && <React.Fragment> ({ps.length ? ps.map(p => p.name).join(', ') : 'none yet'})</React.Fragment>}.</p>
      {(rule.allowCancel || rule.allowStartOverride) && (
        <p>Staff {rule.allowCancel && 'can stop tracking it for a client'}{rule.allowCancel && rule.allowStartOverride && ' and '}{rule.allowStartOverride && 'can change a client’s start date'}.</p>
      )}
    </div>
  );
}

/* ---- Dates ----------------------------------------------------------
   Months are added to the calendar month and clamped to its last day: 6
   months after Aug 31 is Feb 28. Every due date is computed from the first
   one, not from the previous one, so a clamp never accumulates (Jan 31 →
   Feb 28 → Mar 31, not → Mar 28). */
function crAdd(date, o, times = 1) {
  const n = o.n * times;
  if (o.unit === 'days') return addDays(date, n);
  if (o.unit === 'weeks') return addDays(date, n * 7);
  const months = o.unit === 'years' ? n * 12 : n;
  const d = new Date(date);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target;
}
const crSub = (date, o) => (o.unit === 'days' || o.unit === 'weeks'
  ? addDays(date, -(o.n * (o.unit === 'weeks' ? 7 : 1)))
  : crAdd(date, { n: -o.n, unit: o.unit }));
function crSchedule(rule, startIso, count = 4) {
  const start = new Date(startIso + 'T00:00:00');
  if (isNaN(start)) return [];
  const first = crAdd(start, rule.first);
  const out = [];
  for (let i = 0; i < (rule.repeat ? count : 1); i++) {
    const due = i === 0 ? first : crAdd(first, rule.repeat, i);
    const warnFrom = rule.warn.n ? crSub(due, rule.warn) : due;
    const state = due < TODAY ? 'past' : warnFrom <= TODAY ? 'warning' : 'upcoming';
    out.push({ due, warnFrom, state });
  }
  return out;
}

/* ---- List ------------------------------------------------------------- */
const CR_BASE = '/due-date-rules';
const CR_STATUS_FILTERS = ['Active', 'Inactive', 'All statuses'];

function DueDateRulesPage() {
  const guard = useGuard();
  const [rules] = useDueDateRules();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Active');
  const [anchor, setAnchor] = useState('any');

  const s = q.trim().toLowerCase();
  const rows = rules.filter(r => {
    if (status === 'Active' && r.status !== 'active') return false;
    if (status === 'Inactive' && r.status !== 'inactive') return false;
    if (anchor !== 'any' && r.anchor !== anchor) return false;
    if (!s) return true;
    return crName(r).toLowerCase().indexOf(s) !== -1 || crGeneratedName(r).toLowerCase().indexOf(s) !== -1
      || crApplied(r.id).some(a => a.name.toLowerCase().indexOf(s) !== -1);

  });
  const anchorOpts = [{ value: 'any', label: 'Any start date' }].concat(CR_ANCHORS.map(a => ({ value: a.key, label: a.label })));
  const [servicesFor, setServicesFor] = useState(null);

  return (
    <div className="page chc cr">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Due Date Rules' }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Due Date Rules</h1>
          <div className="page-sub">
            These rules define the cadence of due dates and warnings, in regards to relative service dates, but need
            to be applied to services in <button type="button" className="lnk cr-inline-link" onClick={() => guard.go('/service-builder')}>Service Builder</button> to take effect.
          </div>
        </div>
        <span className="spacer" />
        <Button variant="primary" onClick={() => guard.go(CR_BASE + '/new')}><Icon name="plus" size={15} /> New Rule</Button>
      </div>

      <Panel title={'Rules (' + rows.length + (rows.length !== rules.length ? ' of ' + rules.length : '') + ')'}>
        <div className="cr-filters">
          <div className="form-input cr-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search rules or services" aria-label="Search rules or services" />
            {q && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={13} /></button>}
          </div>
          <div className="cr-filter"><Dropdown id="cr-status" value={status} options={CR_STATUS_FILTERS} onChange={setStatus} /></div>
          <div className="cr-filter cr-filter--wide"><Dropdown id="cr-anchor" value={anchor} options={anchorOpts} onChange={setAnchor} /></div>
        </div>
        <div className="table-wrap">
          <table className="data-table cr-table">
            <thead><tr><th>Rule</th><th>Due</th><th>Starts From</th><th>Warning</th><th>Programs</th><th>Applied To</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(r => {
                const ap = crApplied(r.id);
                const open = () => guard.go(CR_BASE + '/' + r.id);
                return (
                  <tr key={r.id}>
                    <td className="wrap cr-col-name">
                      <button className="lnk chc-list-name" onClick={open}>{crName(r)}</button>
                      {!r.name.trim() && <div className="chc-list-desc">Generated name</div>}
                    </td>
                    <td className="wrap">{crCadence(r)}{r.repeat && r.basis === 'completed' && <div className="chc-list-desc">From last completion</div>}</td>
                    <td className="wrap">{CR_ANCHOR[r.anchor].label}</td>
                    <td>{r.warn.n ? crSpan(r.warn) + ' before' : 'None'}</td>
                    <td className="wrap">{crScopeLabel(r)}</td>
                    <td>
                      {ap.length
                        ? <button type="button" className="lnk cr-count" onClick={() => setServicesFor(r)}
                            aria-label={'View the ' + ap.length + ' services using ' + crName(r)}>{ap.length} service{ap.length === 1 ? '' : 's'}</button>
                        : <span className="chc-list-empty">None yet</span>}
                    </td>
                    <td><span className={'badge ' + (r.status === 'inactive' ? 'status-neutral' : 'status-active')}>{r.status === 'inactive' ? 'Inactive' : 'Active'}</span></td>
                    <td><Button size="sm" variant="secondary" onClick={open}>Edit</Button></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="cr-empty">No rules match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {servicesFor && <RuleServicesOverlay rule={servicesFor} onClose={() => setServicesFor(null)} />}
      </Panel>
    </div>
  );
}

/* ---- Builder ------------------------------------------------------------ */
/* A number and a unit, inline in the sentence. */
function CrSpanInput({ label, value, onChange, units, min = 0, invalid }) {
  return (
    <span className="cr-span">
      <span className={'form-input cr-num' + (invalid ? ' invalid' : '')}>
        <input type="number" min={min} step={1} inputMode="numeric" aria-label={label + ', number'}
          value={value.n === '' ? '' : value.n}
          onChange={e => onChange({ ...value, n: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} />
      </span>
      <span className="cr-unit"><Dropdown id={null} value={value.unit} options={units} onChange={u => onChange({ ...value, unit: u })} /></span>
    </span>
  );
}

function DueDateRuleEditPage({ id }) {
  const guard = useGuard();
  const rawNavigate = useRawNavigate();
  const [rules, setRules] = useDueDateRules();
  const isNew = id === 'new';
  const original = isNew ? null : rules.find(r => r.id === id);
  const blank = () => crNormalise({
    rule_id: 'DDR-' + Date.now().toString(36).toUpperCase(), status: 'active',
    first_due: { n: 30, unit: 'days' }, anchor: 'program-enroll', repeat: { n: 12, unit: 'months' },
    warn: { n: 30, unit: 'days' }, scope: { type: 'all' },
  });
  const [draft, setDraft] = useState(() => (isNew || !original ? blank() : clone(original)));
  useEffect(() => {
    const found = isNew ? null : rules.find(r => r.id === id);
    setDraft(isNew || !found ? blank() : clone(found));
  }, [id]);
  const [tried, setTried] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [exampleStart, setExampleStart] = useState(isoOf(addDays(TODAY, -200)));
  /* The last interval, so turning repeat off and on again doesn't lose it. */
  const lastRepeat = useRef((original && original.repeat) || { n: 12, unit: 'months' });
  const dirty = isNew || (original ? JSON.stringify(draft) !== JSON.stringify(original) : false);
  useEffect(() => { if (dirty) guard.markDirty('Due Date Rule'); else guard.clearDirty(); }, [dirty]);
  useEffect(() => () => guard.clearDirty(), []);

  if (!isNew && !original) {
    return (
      <div className="page">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Due Date Rules', to: CR_BASE }, { label: 'Not found' }]} />
        <h1 className="page-title">Rule not found</h1>
        <p className="page-sub">No due date rule matches <code>{id}</code>. It may already have been deleted.</p>
        <Button variant="secondary" onClick={() => guard.go(CR_BASE)}>Back to Due Date Rules</Button>
      </div>
    );
  }

  const patch = obj => setDraft(d => ({ ...d, ...obj }));
  const setScope = obj => setDraft(d => ({ ...d, scope: { ...d.scope, ...obj } }));
  const applied = isNew ? [] : crApplied(draft.id);
  const templates = isNew ? [] : crTemplatesUsing(draft.id);
  /* Which documents and appointments the rule actually governs, across its
     services: "Informed Consent (36), Release of Information (21)". */
  const governedItems = (() => {
    const m = {};
    applied.forEach(s => s.governed.forEach(i => { m[i.name] = (m[i.name] || 0) + 1; }));
    return Object.keys(m).map(name => ({ name, n: m[name] })).sort((a, b) => b.n - a.n);
  })();
  /* Numbers can be mid-edit (blank) in the draft; everything derived reads a
     clean copy so the summary and schedule never show "NaN months". */
  const clean = crNormalise(draft);

  /* ---- Checks. Errors block Save; notes don't. */
  const errors = {};
  if (draft.first.n === '' || draft.first.n < 0) errors.first = 'Enter 0 or more. 0 means due on the start date.';
  if (draft.repeat && (draft.repeat.n === '' || draft.repeat.n < 1)) errors.repeat = 'Enter 1 or more.';
  if (draft.warn.n === '' || draft.warn.n < 0) errors.warn = 'Enter 0 or more. 0 means no warning.';
  if (draft.scope.type === 'programs' && !draft.scope.programs.length) errors.programs = 'Choose at least one program.';
  const name = crName(clean);
  const clash = rules.find(r => r.id !== draft.id && crName(r).toLowerCase() === name.toLowerCase());
  if (clash) errors.name = draft.name.trim() ? 'Another rule is already called this.' : 'Another rule has this exact logic, so the generated name is taken. Name this one, or change it.';
  const notes = [];
  if (!errors.warn && !errors.repeat && clean.repeat && clean.warn.n && crDays(clean.warn) >= crDays(clean.repeat))
    notes.push('The warning is as long as the cycle, so staff would be warned about the next one as soon as the last is due.');
  if (!errors.warn && !errors.first && clean.warn.n && clean.first.n && crDays(clean.warn) > crDays(clean.first))
    notes.push('The first warning starts before the start date itself, so staff see it as soon as the start date is recorded.');
  if (clean.scope.type === 'population' && !crProgramsInScope(clean).length)
    notes.push('No program serves ' + clean.scope.population.toLowerCase() + ' yet, so this rule applies to nobody until one does.');
  const twin = !clash && rules.find(r => r.id !== draft.id && crGeneratedName(r) === crGeneratedName(clean));
  const hasErrors = Object.keys(errors).length > 0;
  const showErr = k => tried && errors[k];

  const leave = () => { guard.clearDirty(); rawNavigate(CR_BASE); };
  const save = () => {
    setTried(true);
    if (hasErrors) return;
    const out = { ...clean, name: draft.name.trim(), updated: isoOf(TODAY), updatedBy: ME.id };
    setRules(rs => (rs.some(r => r.id === out.id) ? rs.map(r => (r.id === out.id ? out : r)) : rs.concat([out])));
    guard.setToast({ status: 'success', title: isNew ? 'Due date rule created' : 'Due date rule saved',
      detail: crName(out) + (applied.length ? ' · used by ' + applied.length + ' service' + (applied.length === 1 ? '' : 's') : '')
        + (out.status === 'inactive' ? ' · inactive, nothing is tracked' : '') });
    leave();
  };
  const discard = () => { if (isNew) leave(); else { setDraft(clone(original)); setTried(false); } };
  const remove = () => {
    setRules(rs => rs.filter(r => r.id !== draft.id));
    guard.setToast({ status: 'success', title: crName(original) + ' deleted' });
    leave();
  };
  const sched = crSchedule(clean, exampleStart);
  const anchorOpts = CR_ANCHORS.map(a => ({ value: a.key, label: a.label }));
  const programOpts = CR_PROGRAMS.map(p => ({ value: p.id, label: p.name, meta: p.type }));
  const toggleProgram = pid => setScope({ programs: draft.scope.programs.indexOf(pid) !== -1 ? draft.scope.programs.filter(x => x !== pid) : draft.scope.programs.concat([pid]) });
  const title = isNew ? 'New Due Date Rule' : crName(original);

  return (
    <div className="page chc cr">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Due Date Rules', to: CR_BASE }, { label: isNew ? 'New Rule' : title }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{title}</h1>
          <div className="page-sub">
            {isNew ? 'Say when it’s due, how often, how early staff are warned, and for which programs. It takes effect once it’s applied to services in Service Builder.'
              : 'Last changed ' + fmtDate(original.updated) + ' by ' + sName(original.updatedBy) + '.'}
          </div>
        </div>
        <span className="spacer" />
        {dirty && !isNew && <span className="badge status-amber"><Icon name="edit" size={12} /> Unsaved changes</span>}
        <Button variant="ghost" onClick={discard} disabled={!isNew && !dirty}>{isNew ? 'Cancel' : 'Discard'}</Button>
        <Button variant="primary" onClick={save} disabled={!dirty}>{isNew ? 'Create Rule' : 'Save Changes'}</Button>
      </div>

      {!isNew && applied.length > 0 && dirty && (
        <div className="info-banner" role="note">
          <Icon name="info" size={20} />
          <div>Saving changes the due dates in the <b>{applied.length} service{applied.length === 1 ? '' : 's'}</b> that use this rule.</div>
        </div>
      )}

      <div className="cr-layout">
        <section className="panel chc-config">
          <div className="chc-sec">
            <h2 className="chc-sectitle">When Is It Due?</h2>
            <div className="cr-madlib">
              <div className="cr-line">
                <span className="cr-word">First due</span>
                <CrSpanInput label="First due" value={draft.first} units={CR_UNITS} min={0} invalid={showErr('first')} onChange={v => patch({ first: v })} />
                <span className="cr-word">after the</span>
                <span className="cr-anchor"><Dropdown id="cr-anchor-select" value={draft.anchor} options={anchorOpts} onChange={v => patch({ anchor: v })} /></span>
              </div>
              {showErr('first') && <div className="ff-error"><Icon name="warn" size={13} /> {errors.first}</div>}

              <div className="cr-line">
                <span className="cr-word">Then</span>
                <span className="cr-repeat">
                  <Dropdown id="cr-repeat-select" value={draft.repeat ? 'repeat' : 'once'}
                    options={[{ value: 'repeat', label: 'due every' }, { value: 'once', label: 'not due again' }]}
                    onChange={v => {
                      if (v === 'once') { if (draft.repeat) lastRepeat.current = draft.repeat; patch({ repeat: null }); }
                      else patch({ repeat: draft.repeat || lastRepeat.current });
                    }} />
                </span>
                {draft.repeat && (
                  <React.Fragment>
                    <CrSpanInput label="Due every" value={draft.repeat} units={CR_UNITS} min={1} invalid={showErr('repeat')} onChange={v => patch({ repeat: v })} />
                    <span className="cr-word">counted from</span>
                    <span className="cr-basis"><Dropdown id="cr-basis-select" value={draft.basis} options={CR_BASIS} onChange={v => patch({ basis: v })} /></span>
                  </React.Fragment>
                )}
              </div>
              {showErr('repeat') && <div className="ff-error"><Icon name="warn" size={13} /> {errors.repeat}</div>}

              <div className="cr-line">
                <span className="cr-word">Warn staff</span>
                <CrSpanInput label="Warn staff" value={draft.warn} units={CR_WARN_UNITS} min={0} invalid={showErr('warn')} onChange={v => patch({ warn: v })} />
                <span className="cr-word">before {draft.repeat ? 'each' : 'the'} due date</span>
              </div>
              {showErr('warn') && <div className="ff-error"><Icon name="warn" size={13} /> {errors.warn}</div>}
            </div>
            {notes.map(n => <div key={n} className="chc-note chc-note--warn"><Icon name="warn" size={15} /> {n}</div>)}
          </div>

          <div className="chc-sec">
            <h2 className="chc-sectitle">Which Programs?</h2>
            <div className="chc-note">A rule only runs for clients enrolled in a program it covers.</div>
            <div className="cr-scope" role="radiogroup" aria-label="Programs">
              <Radio name="cr-scope" checked={draft.scope.type === 'all'} onChange={() => setScope({ type: 'all' })} label="All programs" />
              <div className="cr-scope-opt">
                <Radio name="cr-scope" checked={draft.scope.type === 'population'} onChange={() => setScope({ type: 'population' })} label="Programs serving a population" />
                {draft.scope.type === 'population' && (
                  <div className="cr-scope-detail">
                    <Dropdown id="cr-pop-select" value={draft.scope.population} options={CR_POPULATIONS} onChange={v => setScope({ population: v })} />
                    <div className="chc-note">
                      Today: {crProgramsInScope(clean).map(p => p.name).join(', ') || 'none'}. A program tagged with this population later joins automatically.
                    </div>
                  </div>
                )}
              </div>
              <div className="cr-scope-opt">
                <Radio name="cr-scope" checked={draft.scope.type === 'programs'} onChange={() => setScope({ type: 'programs' })} label="Specific programs" />
                {draft.scope.type === 'programs' && (
                  <div className="cr-scope-detail">
                    <MultiSelectDropdown id="cr-programs-select" placeholder="Select programs…" selected={draft.scope.programs} onToggle={toggleProgram} options={programOpts} />
                    {showErr('programs') && <div className="ff-error"><Icon name="warn" size={13} /> {errors.programs}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="chc-sec">
            <h2 className="chc-sectitle">Staff Overrides</h2>
            <div className="chc-note">Both are off by default. Most standards shouldn’t bend client by client.</div>
            <div className="chc-switch">
              <Toggle checked={draft.allowCancel} onChange={v => patch({ allowCancel: v })} />
              <div className="chc-switch-text">
                <div className="chc-switch-name">Staff can cancel this rule for a client</div>
                <div className="chc-switch-help">Stops tracking it for that one client, with a reason that’s kept on the record. For example, a follow-up that can’t happen because the client moved away.</div>
              </div>
            </div>
            <div className="chc-switch">
              <Toggle checked={draft.allowStartOverride} onChange={v => patch({ allowStartOverride: v })} />
              <div className="chc-switch-text">
                <div className="chc-switch-name">Staff can change a client’s start date</div>
                <div className="chc-switch-help">Lets staff enter a different start date when the recorded one is wrong or doesn’t apply, with a reason. Every due date recalculates from it.</div>
              </div>
            </div>
          </div>

          <div className="chc-sec">
            <h2 className="chc-sectitle">Name and Status</h2>
            <label className="form-field">
              <span>Rule name <span className="ff-req-txt">(optional)</span></span>
              <div className={'form-input' + (showErr('name') ? ' invalid' : '')}>
                <input value={draft.name} placeholder={crGeneratedName(clean)} onChange={e => patch({ name: e.target.value })} />
                {draft.name && <button type="button" className="icon-btn" aria-label="Use the generated name" onClick={() => patch({ name: '' })}><Icon name="close" size={13} /></button>}
              </div>
            </label>
            {showErr('name')
              ? <div className="ff-error"><Icon name="warn" size={13} /> {errors.name}</div>
              : <div className="chc-note">{draft.name.trim() ? 'Clear it to go back to the generated name.' : 'Leave blank to use the generated name, which follows the rule as you change it.'}</div>}
            {twin && !draft.name.trim() && (
              <div className="chc-note chc-note--warn"><Icon name="warn" size={15} /> {crName(twin)} already has this logic.</div>
            )}
            <div className="chc-switch">
              <Toggle checked={draft.status !== 'inactive'} onChange={v => patch({ status: v ? 'active' : 'inactive' })} />
              <div className="chc-switch-text">
                <div className="chc-switch-name">Active</div>
                <div className="chc-switch-help">Inactive rules stay applied to their services but track nothing and remind no one until they’re turned back on.</div>
              </div>
            </div>
            {!isNew && (
              <div className="chc-presetfoot">
                <span className="spacer" />
                <Tooltip label={applied.length ? 'Used by ' + applied.length + ' service' + (applied.length === 1 ? '' : 's') + '. Remove it from them in Service Builder, or make it inactive.' : null} wide>
                  <Button size="sm" variant="ghost" disabled={applied.length > 0} onClick={remove}>Delete Rule</Button>
                </Tooltip>
              </div>
            )}
          </div>

          <div className="chc-sec">
            <h2 className="chc-sectitle">Applied To</h2>
            <div className="chc-note">
              Services subscribe to rules in <button type="button" className="lnk cr-inline-link" onClick={() => guard.go('/service-builder')}>Service Builder</button>,
              on the steps inside them or as a whole service’s deadline. Shown here so you can see what a change affects.
            </div>
            {applied.length ? (
              <div className="cr-applied-sum">
                <div className="cr-applied-count">
                  <b>{applied.length}</b> service{applied.length === 1 ? '' : 's'}
                  {templates.length > 0 && <span> · {templates.length} template{templates.length === 1 ? '' : 's'}</span>}
                </div>
                <div className="cr-applied-items">
                  Governs {governedItems.map((g, i) => <React.Fragment key={g.name}>{i > 0 && ', '}<b>{g.name}</b> ({g.n})</React.Fragment>)}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setShowServices(true)}>View Services</Button>
              </div>
            ) : (
              <div className="cr-applied-empty">No service uses this rule yet. {isNew ? 'Once it’s saved, it can be applied to services in Service Builder.' : 'Apply it to services in Service Builder.'}</div>
            )}
          </div>
        </section>

        <aside className="panel cr-aside" aria-label="How this rule reads">
          <div className="chc-sec">
            <h2 className="chc-sectitle">How It Reads</h2>
            <CrSentence rule={clean} />
            <div className={'badge ' + (draft.status === 'inactive' ? 'status-neutral' : 'status-active')}>{draft.status === 'inactive' ? 'Inactive' : 'Active'}</div>
          </div>
          <div className="chc-sec">
            <h2 className="chc-sectitle">Example Schedule</h2>
            <DateField label={'If the ' + CR_ANCHOR[draft.anchor].label.toLowerCase().replace('ibhis', 'IBHIS') + ' is'} value={exampleStart} onChange={v => v && setExampleStart(v)} quick={false} />
            {hasErrors && !sched.length ? null : (
              <table className="data-table cr-sched">
                <thead><tr><th>Due</th><th>Warning from</th><th /></tr></thead>
                <tbody>
                  {sched.map((x, i) => (
                    <tr key={i}>
                      <td>{fmtDate(x.due)}</td>
                      <td>{clean.warn.n ? fmtDate(x.warnFrom) : '—'}</td>
                      <td><span className={'badge ' + (x.state === 'past' ? 'status-neutral' : x.state === 'warning' ? 'status-amber' : 'status-info')}>
                        {x.state === 'past' ? 'Past' : x.state === 'warning' ? 'Warning now' : 'Upcoming'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="chc-note">
              As of today, {fmtDate(TODAY)}.{clean.repeat ? ' First ' + sched.length + ' shown.' : ''}
              {clean.repeat && clean.basis === 'completed' ? ' Assumes each is completed on its due date; completing early or late moves the next one.' : ''}
              {' '}Months that are too short end on their last day.
            </div>
          </div>
        </aside>
      </div>
      {showServices && <RuleServicesOverlay rule={original} onClose={() => setShowServices(false)} />}
    </div>
  );
}

/* ---- Services using a rule ---------------------------------------------
   A rule like Standard Annual Consent is used by dozens of services, soon
   hundreds, so the list lives behind a count rather than in a table cell.
   Searchable, scrollable, and it says what in each service the rule
   governs: steps, or the whole service as its deadline. Read-only: services
   subscribe to rules in Service Builder. */
function RuleServicesOverlay({ rule, onClose }) {
  useServices();
  return <ServicesUsingOverlay title={'Services Using ' + crName(rule)} rows={crApplied(rule.id)} templates={crTemplatesUsing(rule.id)}
    detailLabel="Rule governs" onClose={onClose} />;
}
