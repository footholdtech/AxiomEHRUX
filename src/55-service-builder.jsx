/* ===== Admin › Service Builder =====================================
   A service is the container for what a staff member does with a client.
   An admin defines the building blocks once (service codes, diagnosis sets,
   precedence logic, sensitivity classes, documents, appointment types, due
   date rules) and a service subscribes to them, alongside the programs,
   roles, sites, payors and funding that already live elsewhere.

   TWO SHAPES, ONE OBJECT. Most services are a single document: "Standard
   15m Post Class Check-In" is one Progress Note with the code, programs and
   rules decided for it. Others are workflows that string deliverables
   together ("Teen Crisis Intake": consents, a screening, an assessment, a
   plan), each step with its own due date rules and the whole service with a
   deadline of its own.

   TEMPLATES ARE STARTING POINTS. Picking one pre-fills a new service; after
   that the two are independent. Editing a service never touches its
   template, and editing a template changes only services made from it
   afterwards. The service keeps a read-only "Started from" for reporting.

   VERSIONS. Every saved change to a live service is a new version with an
   effective date. A note uses the version in effect on its date of service,
   so a backdated note keeps the old code and rate.

   WHO SEES A SERVICE. Admins pick roles; then each staff member is checked
   against every security the service carries (programs, sites, sensitivity),
   and, on a chart, against the client's enrollments. Staff see the answer
   in "Why don't I see a service?"; the editor's Preview as Staff button,
   locked for now, is where admins will see it.

   Screens: the landing page (Services · Templates · Building Blocks), the
   editor (shared by services and templates), the New Service dialog, and the
   building block libraries. The staff side is in 56-services-staff.jsx.

   PROTOTYPE SCOPE. Agency configuration plus links to synthetic clients.
   Seeded from fixtures/reference-data/services.json; edits persist to
   localStorage so a walkthrough survives a reload.
   ================================================================ */

const SB_DATA = RD.services || {};
const SB_LIB = SB_DATA.blocks || {};
const SB_CODES = SB_LIB.service_codes || [];
const SB_CODE = Object.fromEntries(SB_CODES.map(c => [c.code_id, c]));
const SB_MODIFIERS = SB_LIB.modifiers || [];
const SB_DX_SETS = SB_LIB.diagnosis_sets || [];
const SB_DX = Object.fromEntries(SB_DX_SETS.map(d => [d.set_id, d]));
const SB_PRECEDENCE = SB_LIB.precedence || [];
const SB_PREC = Object.fromEntries(SB_PRECEDENCE.map(p => [p.precedence_id, p]));
const SB_SENSITIVITY = SB_LIB.sensitivity || [];
const SB_SENS = Object.fromEntries(SB_SENSITIVITY.map(s => [s.name, s]));
const SB_DOCS = SB_LIB.documents || [];
const SB_DOC = Object.fromEntries(SB_DOCS.map(d => [d.name, d]));
const SB_APPTS = SB_LIB.appointment_types || [];
const SB_APPT = Object.fromEntries(SB_APPTS.map(a => [a.name, a]));
const SB_CPT_ONLY = SB_LIB.cpt_only_payors || [];
const SB_PAYORS = (RD.funding && RD.funding.providers) || [];
const SB_PAYOR = Object.fromEntries(SB_PAYORS.map(p => [p.provider_id, p]));
const SB_FUNDING = (RD.funding && RD.funding.funding_types) || [];
const SB_FUND = Object.fromEntries(SB_FUNDING.map(f => [f.funding_type_id, f]));
const SB_SITES = RD.sites || [];
const SB_SEC = Object.fromEntries((SB_DATA.staff_security || []).map(s => [s.staff_id, s]));
const SB_BASE = '/service-builder';

/* ---- Store ---------------------------------------------------------
   One store for services, templates and the client instances the staff side
   creates, so the Due Date Rules counts, the editor and a chart all read the
   same thing. */
const SB_KEY = 'axiom-services-v1';
const sbSeed = () => clone({ services: SB_DATA.services || [], templates: SB_DATA.templates || [], instances: SB_DATA.instances || [] });
const SB_STORE = (() => {
  let state;
  try { const s = JSON.parse(localStorage.getItem(SB_KEY)); if (s && Array.isArray(s.services)) state = s; } catch (e) {}
  if (!state) state = sbSeed();
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next;
      try { localStorage.setItem(SB_KEY, JSON.stringify(state)); } catch (e) {}
      subs.forEach(f => f());
    },
    sub(f) { subs.add(f); return () => subs.delete(f); },
  };
})();
function useServices() {
  const [, force] = useState(0);
  useEffect(() => SB_STORE.sub(() => force(x => x + 1)), []);
  return [SB_STORE.get(), SB_STORE.set];
}
const sbId = prefix => prefix + '-' + Date.now().toString(36).toUpperCase();

/* ---- Versions ------------------------------------------------------ */
const TODAY_ISO = isoOf(TODAY);
/* The version in effect on a date: the last one whose effective date has
   arrived. A draft service has no effective date yet. */
function sbVersionAt(s, iso) {
  const vs = s.versions.filter(v => v.effective && v.effective <= iso);
  return vs.length ? vs[vs.length - 1] : null;
}
const sbLatest = s => s.versions[s.versions.length - 1];
const sbInEffect = s => sbVersionAt(s, TODAY_ISO);
const sbScheduled = s => s.versions.filter(v => v.effective && v.effective > TODAY_ISO);
/* What the service is right now for admin purposes: the newest version,
   scheduled or not, since that is what an edit or a rule change affects. */
const sbCfg = s => sbLatest(s).config;

/* ---- Words ---------------------------------------------------------- */
const sbPlural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
const sbProgramName = id => (CR_PROGRAMS_BY_ID[id] || {}).name || id;
const sbSiteName = id => ((SB_SITES.find(s => s.site_id === id) || {}).name || id).replace(' - ', ' · ');
const sbJoin = (names, max = 2, none = 'None') => {
  if (!names.length) return none;
  return names.length <= max ? names.join(', ') : names.slice(0, max).join(', ') + ' +' + (names.length - max) + ' more';
};
const sbProgramsLabel = (ids, max = 2) => (ids.length && ids.length === CR_PROGRAMS.length ? 'All programs' : sbJoin(ids.map(sbProgramName), max));
const sbCodeLabel = c => {
  const k = SB_CODE[c.code_id];
  return (k ? k.code : c.code_id) + (c.modifiers.length ? '-' + c.modifiers.join('-') : '') + ' × ' + c.units;
};
const sbStepsLabel = cfg => (cfg.steps.length > 1 ? 'Workflow · ' + cfg.steps.length + ' steps'
  : cfg.steps.length ? 'Single ' + cfg.steps[0].kind.toLowerCase() : 'No steps yet');
const SB_STATUS = { active: ['Active', 'status-active'], draft: ['Draft', 'status-amber'], inactive: ['Inactive', 'status-neutral'] };
const sbStatusBadge = st => { const x = SB_STATUS[st] || SB_STATUS.active; return <span className={'badge ' + x[1]}>{x[0]}</span>; };
const sbTemplateName = (store, id) => { const t = (store.templates || []).find(x => x.template_id === id); return t ? t.name : null; };

/* A due date rule, as a step's own due date: "12 months after the program
   enrollment start date, then every 12 months". */
function sbRulePhrase(r) {
  const a = CR_ANCHOR[r.anchor].label.toLowerCase().replace('ibhis', 'IBHIS');
  return (r.first.n === 0 ? 'On the ' + a : crSpan(r.first) + ' after the ' + a) + (r.repeat ? ', then every ' + crSpan(r.repeat) : '');
}
/* The same rule as a service deadline: "within 5 days of the client
   referral date". */
function sbDeadlinePhrase(r) {
  const a = CR_ANCHOR[r.anchor].label.toLowerCase().replace('ibhis', 'IBHIS');
  return (r.first.n === 0 ? 'on the ' + a : 'within ' + crSpan(r.first) + ' of the ' + a) + (r.repeat ? ', and again every ' + crSpan(r.repeat) : '');
}

/* Short, for a table cell: "within 14 days of referral". */
const sbDeadlineShort = r => (r.first.n === 0 ? 'at ' : 'within ' + crSpan(r.first) + ' of ') + CR_ANCHOR[r.anchor].short.replace(/ start$/, '') + (r.repeat ? ', every ' + crSpan(r.repeat) : '');

/* Every compartment, with how to say what it holds. Drives the cards, the
   version compare and the review step of New Service. */
const SB_FIELDS = [
  { key: 'roles', label: 'Roles', fmt: c => sbJoin(c.roles, 3) },
  { key: 'programs', label: 'Programs', fmt: c => sbProgramsLabel(c.programs, 3) },
  { key: 'sites', label: 'Sites', fmt: c => (c.sites.length ? sbJoin(c.sites.map(sbSiteName), 2) : 'Any site its programs run at') },
  { key: 'codes', label: 'Service codes', fmt: c => sbJoin(c.codes.map(sbCodeLabel), 3, 'Not billed') },
  { key: 'payors', label: 'Payors', fmt: c => sbJoin(c.payors.map(p => (SB_PAYOR[p] || {}).name || p), 2) },
  { key: 'funding', label: 'Funding', fmt: c => sbJoin(c.funding.map(f => (SB_FUND[f] || {}).name || f), 2) },
  { key: 'dx_set', label: 'Diagnoses', fmt: c => (SB_DX[c.dx_set] || {}).name || 'None' },
  { key: 'precedence', label: 'Diagnosis precedence', fmt: c => (SB_PREC[c.precedence] || {}).name || 'None' },
  { key: 'sensitivity', label: 'Sensitivity', fmt: c => c.sensitivity },
  { key: 'duration_min', label: 'Duration', fmt: c => (c.duration_min ? c.duration_min + ' min' : 'Not set') },
  { key: 'steps', label: 'Steps', fmt: c => sbJoin(c.steps.map(s => s.name + (s.required ? '' : ' (optional)')), 6, 'None') },
  { key: 'deadline_rule_id', label: 'Service deadline', fmt: (c, rules) => { const r = (rules || []).find(x => x.id === c.deadline_rule_id); return r ? crName(r) : 'None'; } },
  { key: 'description', label: 'Description', fmt: c => c.description || 'None' },
];
/* Step rules aren't a compartment of their own, so a rule change on a step
   shows up under Steps. */
const sbStepKey = s => [s.name, s.kind, s.required, s.after, s.rule_ids.join('+')].join('|');
function sbDiff(a, b, rules) {
  return SB_FIELDS.filter(f => (f.key === 'steps'
    ? a.steps.map(sbStepKey).join('/') !== b.steps.map(sbStepKey).join('/')
    : JSON.stringify(a[f.key]) !== JSON.stringify(b[f.key])))
    .map(f => ({ label: f.label, before: f.fmt(a, rules), after: f.fmt(b, rules) }));
}

/* ---- Who can pick it ------------------------------------------------
   Role first, then every security the service carries. With a client, the
   client must also be enrolled in one of its programs that the staff member
   can work in. */
function sbEligibility(cfg, staffId, client) {
  const st = STAFF[staffId];
  const sec = SB_SEC[staffId] || { programs: [], sites: [], sensitivity: ['Standard'] };
  const fails = [];
  const role = st ? roleName(st.role_id) : '';
  if (cfg.roles.indexOf(role) === -1) fails.push({ key: 'role', text: role + ' isn’t one of this service’s roles.' });
  const progs = cfg.programs.filter(p => sec.programs.indexOf(p) !== -1);
  if (!progs.length) fails.push({ key: 'programs', text: 'No access to ' + (cfg.programs.length === 1 ? sbProgramName(cfg.programs[0]) : 'any of its programs') + '.' });
  if (cfg.sites.length && !cfg.sites.some(s => sec.sites.indexOf(s) !== -1))
    fails.push({ key: 'sites', text: 'No access to ' + (cfg.sites.length === 1 ? sbSiteName(cfg.sites[0]) : 'any of its sites') + '.' });
  if (cfg.sensitivity !== 'Standard' && sec.sensitivity.indexOf(cfg.sensitivity) === -1)
    fails.push({ key: 'sensitivity', text: 'Not cleared for ' + cfg.sensitivity + '.' });
  if (client) {
    const cp = client.program_ids || [];
    if (!cfg.programs.some(p => cp.indexOf(p) !== -1)) fails.push({ key: 'client', text: client.shortName + ' isn’t enrolled in ' + (cfg.programs.length === 1 ? sbProgramName(cfg.programs[0]) : 'any of its programs') + '.' });
    else if (!cfg.programs.some(p => cp.indexOf(p) !== -1 && sec.programs.indexOf(p) !== -1)) fails.push({ key: 'client', text: 'No access to ' + client.shortName + '’s program for this service.' });
  }
  return { ok: !fails.length, fails };
}

/* ---- Checks before a service goes live ------------------------------
   Errors stop Activate and Save. Warnings don't: a service with no code is
   legitimately unbilled (discharge paperwork), so it's said, not blocked. */
function sbChecks(cfg, name, rules, isTemplate) {
  const errors = [], warnings = [];
  const rule = id => rules.find(r => r.id === id);
  if (!name.trim()) errors.push('Give it a name. It’s what staff see in their list.');
  if (!cfg.steps.length) errors.push('Add at least one document or appointment for staff to complete.');
  if (!isTemplate && !cfg.roles.length) errors.push('Choose at least one role, or nobody can pick it.');
  if (!isTemplate && !cfg.programs.length) errors.push('Choose at least one program, or it fits no client.');
  cfg.steps.forEach((s, i) => {
    if (!s.after) return;
    const j = cfg.steps.findIndex(x => x.step_id === s.after);
    if (j === -1 || j >= i) errors.push(s.name + ' waits for a step that comes after it. Move it, or change what it waits for.');
  });
  if (!cfg.codes.length) warnings.push('No service code, so it won’t create a claim. That’s right for unbilled work like discharge paperwork.');
  cfg.payors.filter(p => SB_CPT_ONLY.indexOf(p) !== -1).forEach(p => {
    const hcpcs = cfg.codes.map(c => SB_CODE[c.code_id]).filter(k => k && !/^\d/.test(k.code));
    if (hcpcs.length) warnings.push((SB_PAYOR[p] || {}).name + ' pays CPT codes only, so it won’t pay ' + hcpcs.map(k => k.code).join(', ') + '.');
  });
  const needs = (SB_SENS[cfg.sensitivity] || {}).requires_document;
  if (needs && !cfg.steps.some(s => s.name === needs)) warnings.push(cfg.sensitivity + ' needs a ' + needs + ' on file. Add it as a step.');
  const used = [];
  cfg.steps.forEach(s => s.rule_ids.forEach(id => used.push([id, s.name])));
  if (cfg.deadline_rule_id && cfg.steps.length > 1) used.push([cfg.deadline_rule_id, 'the service deadline']);
  used.forEach(([id, where]) => {
    const r = rule(id);
    if (!r) return warnings.push('A due date rule on ' + where + ' no longer exists.');
    if (r.status === 'inactive') warnings.push(crName(r) + ' (on ' + where + ') is inactive, so it tracks nothing.');
    else if (cfg.programs.length && r.scope.type !== 'all' && !crProgramsInScope(r).some(p => cfg.programs.indexOf(p.id) !== -1))
      warnings.push(crName(r) + ' (on ' + where + ') only runs for ' + crScopeLabel(r).toLowerCase() + ', and none of this service’s programs is one, so it would never run.');
  });
  return { errors, warnings: warnings.filter((w, i) => warnings.indexOf(w) === i) };
}

/* Services and templates that use a building block, for the "used by"
   counts. `test(cfg)` returns what in the service uses it (a string) or
   false. Newest version, as with rules. */
function sbUsers(store, test) {
  const svc = store.services.map(s => ({ ...s, cfg: sbCfg(s) })).map(s => ({ ...s, detail: test(s.cfg) })).filter(s => s.detail);
  const tpl = store.templates.map(t => ({ ...t, cfg: t.config })).map(t => ({ ...t, detail: test(t.cfg) })).filter(t => t.detail);
  return { services: svc, templates: tpl };
}
/* Due date rules, for the Due Date Rules page: a rule governs steps, or the
   whole service as its deadline. */
function sbRuleUsers(store, id, templates) {
  const list = templates ? store.templates.map(t => ({ ...t, cfg: t.config })) : store.services.map(s => ({ ...s, cfg: sbCfg(s) }));
  return list.map(x => {
    const governed = x.cfg.steps.filter(s => s.rule_ids.indexOf(id) !== -1).map(s => ({ name: s.name, kind: s.kind }));
    if (x.cfg.deadline_rule_id === id && x.cfg.steps.length > 1) governed.unshift({ name: 'The whole service', kind: 'Service' });
    return { ...x, governed };
  }).filter(x => x.governed.length);
}

/* ---- Landing page ------------------------------------------------------ */
const SB_VIEWS = [
  { key: 'services', label: 'Services', to: SB_BASE },
  { key: 'templates', label: 'Templates', to: SB_BASE + '/templates' },
  { key: 'blocks', label: 'Building Blocks', to: SB_BASE + '/blocks' },
];

function ServiceBuilderPage({ view = 'services' }) {
  const guard = useGuard();
  const [store, setStore] = useServices();
  const [creating, setCreating] = useState(null);
  const newTemplate = () => {
    const t = { template_id: sbId('TPL'), name: '', collection: AGENCY.name, source: 'agency', updated: TODAY_ISO,
      config: { description: '', roles: [], programs: [], sites: [], codes: [], payors: [], funding: [], dx_set: 'DXS-BH',
        precedence: 'DXP-EPISODE', sensitivity: 'Standard', duration_min: null, steps: [], deadline_rule_id: null } };
    setStore(s => ({ ...s, templates: s.templates.concat([t]) }));
    guard.go(SB_BASE + '/templates/' + t.template_id);
  };
  const counts = { services: store.services.length, templates: store.templates.length };
  return (
    <div className="page chc cr sb">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Service Builder' }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Service Builder</h1>
          <div className="page-sub">
            Services are what staff pick when they document their work. Each one decides the codes, diagnoses,
            programs, roles, sites, payors and due dates that apply, so staff only complete what it asks for.
          </div>
        </div>
        <span className="spacer" />
        {view === 'templates' && <Button variant="secondary" onClick={newTemplate}><Icon name="plus" size={15} /> New Template</Button>}
        <Button variant="primary" onClick={() => setCreating({})}><Icon name="plus" size={15} /> New Service</Button>
      </div>
      <div className="pill-row sb-views" role="tablist" aria-label="Service Builder">
        {SB_VIEWS.map(v => (
          <button key={v.key} type="button" role="tab" aria-selected={view === v.key}
            className={'pill-btn' + (view === v.key ? ' active' : '')} onClick={() => guard.go(v.to)}>
            {v.label}{counts[v.key] != null && <span className="sb-pill-count">{counts[v.key]}</span>}
          </button>
        ))}
      </div>
      {view === 'services' && <SbServicesTable store={store} />}
      {view === 'templates' && <SbTemplatesTable store={store} onUse={t => setCreating({ templateId: t.template_id })} />}
      {view === 'blocks' && <SbBlocksIndex store={store} />}
      {creating && <NewServiceOverlay templateId={creating.templateId} onClose={() => setCreating(null)} />}
    </div>
  );
}

const SB_SHAPES = ['Any shape', 'Single document', 'Workflow'];
const SB_STATUS_FILTERS = ['All statuses', 'Active', 'Draft', 'Inactive', 'Changing soon'];
/* The library tables lay out for the width they actually get, not the
   window's: beside a docked left nav a 1124px window leaves the table
   ~800px. Measured on the table's own box (useElementWidth), they step down:
     full     every column.
     compact  status (or "built by") moves up beside the name; related
              columns pair up (Programs and Roles); the Services Edit
              button goes, because the name already opens the editor.
     narrow   only the columns you scan by stay; the rest are secondary
              lines under the name.
     stack    phones: one column (plus the template actions), everything
              as lines under the name, so nothing scrolls sideways. */
function useSbTableTier(fullAt, compactAt, stackBelow = 520) {
  const [ref, w] = useElementWidth();
  const tier = w == null || w >= fullAt ? 'full' : w >= compactAt ? 'compact' : w >= stackBelow ? 'narrow' : 'stack';
  return [ref, tier];
}

function SbServicesTable({ store }) {
  const guard = useGuard();
  const [rules] = useDueDateRules();
  const [q, setQ] = useState('');
  const [program, setProgram] = useState('any');
  const [shape, setShape] = useState(SB_SHAPES[0]);
  const [status, setStatus] = useState(SB_STATUS_FILTERS[0]);
  const s = q.trim().toLowerCase();
  const rows = store.services.filter(x => {
    const c = sbCfg(x);
    if (program !== 'any' && c.programs.indexOf(program) === -1) return false;
    if (shape === 'Single document' && c.steps.length > 1) return false;
    if (shape === 'Workflow' && c.steps.length < 2) return false;
    if (status === 'Active' && x.status !== 'active') return false;
    if (status === 'Draft' && x.status !== 'draft') return false;
    if (status === 'Inactive' && x.status !== 'inactive') return false;
    if (status === 'Changing soon' && !sbScheduled(x).length) return false;
    if (!s) return true;
    return (x.name + ' ' + c.steps.map(st => st.name).join(' ') + ' ' + c.codes.map(sbCodeLabel).join(' ') + ' ' + (sbTemplateName(store, x.started_from) || '')).toLowerCase().indexOf(s) !== -1;
  });
  const programOpts = [{ value: 'any', label: 'Any program' }].concat(CR_PROGRAMS.map(p => ({ value: p.id, label: p.name })));
  const open = x => guard.go(SB_BASE + '/services/' + x.service_id);
  const [wrapRef, tier] = useSbTableTier(1040, 760);
  return (
    <Panel title={'Services (' + rows.length + (rows.length !== store.services.length ? ' of ' + store.services.length : '') + ')'}>
      <div className="cr-filters">
        <div className="form-input cr-search">
          <Icon name="search" size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services, documents or codes" aria-label="Search services" />
          {q && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={13} /></button>}
        </div>
        <div className="cr-filter"><Dropdown id="sb-program" value={program} options={programOpts} onChange={setProgram} /></div>
        <div className="cr-filter"><Dropdown id="sb-shape" value={shape} options={SB_SHAPES} onChange={setShape} /></div>
        <div className="cr-filter"><Dropdown id="sb-status" value={status} options={SB_STATUS_FILTERS} onChange={setStatus} /></div>
      </div>
      <div className="table-wrap" ref={wrapRef}>
        <table className={'data-table cr-table sb-table sb-table--' + tier}>
          <thead><tr>
            <th>Service</th>{tier !== 'stack' && <th>Staff Complete</th>}
            {tier === 'full' ? <React.Fragment><th>Programs</th><th>Roles</th></React.Fragment> : tier === 'compact' && <th>Programs and Roles</th>}
            {(tier === 'full' || tier === 'compact') && <th>Codes</th>}
            {tier !== 'stack' && <th>Version</th>}
            {tier === 'full' && <React.Fragment><th>Status</th><th><span className="sr-only">Actions</span></th></React.Fragment>}
          </tr></thead>
          <tbody>
            {rows.map(x => {
              const c = sbCfg(x), cur = sbInEffect(x), next = sbScheduled(x)[0];
              const tpl = sbTemplateName(store, x.started_from);
              const dl = c.steps.length > 1 && rules.find(r => r.id === c.deadline_rule_id);
              const codes = c.codes.length
                ? c.codes.map((k, i) => <React.Fragment key={k.code_id}>{i ? ', ' : ''}<span className="sb-nowrap">{sbCodeLabel(k)}</span></React.Fragment>)
                : <span className="chc-list-empty">Not billed</span>;
              return (
                <tr key={x.service_id}>
                  <td className="wrap cr-col-name">
                    <span className="sb-name-row">
                      <button className="lnk chc-list-name" onClick={() => open(x)}>{x.name}</button>
                      {tier !== 'full' && sbStatusBadge(x.status)}
                    </span>
                    <div className="chc-list-desc">{x.started_from ? (tpl ? 'Started from ' + tpl : 'Started from a deleted template') : 'Built from scratch'}</div>
                    {(tier === 'narrow' || tier === 'stack') && <div className="chc-list-desc">{sbProgramsLabel(c.programs)} · {sbJoin(c.roles, 1)}</div>}
                    {tier === 'stack' && <React.Fragment>
                      <div className="chc-list-desc">{sbStepsLabel(c)} · {codes}</div>
                      <div className="chc-list-desc">{cur ? 'Version ' + cur.version + ' since ' + fmtDate(cur.effective) : 'Not live yet'}</div>
                      {next && <div className="chc-list-desc sb-next">Version {next.version} on {fmtDate(next.effective)}</div>}
                    </React.Fragment>}
                  </td>
                  {tier !== 'stack' && <td className="wrap sb-col-steps">
                    {sbStepsLabel(c)}
                    <div className="chc-list-desc">{c.steps.length > 1 ? (dl ? 'Due ' + sbDeadlineShort(dl) : 'No deadline') : (c.steps[0] ? c.steps[0].name : '')}</div>
                    {tier === 'narrow' && <div className="chc-list-desc">{codes}</div>}
                  </td>}
                  {tier === 'full' && <React.Fragment>
                    <td className="wrap sb-col-who">{sbProgramsLabel(c.programs)}</td>
                    <td className="wrap sb-col-who">{sbJoin(c.roles, 1)}</td>
                  </React.Fragment>}
                  {tier === 'compact' && (
                    <td className="wrap sb-col-who">{sbProgramsLabel(c.programs)}<div className="chc-list-desc">{sbJoin(c.roles, 1)}</div></td>
                  )}
                  {(tier === 'full' || tier === 'compact') && <td className="wrap sb-col-codes">{codes}</td>}
                  {tier !== 'stack' && <td>
                    {cur ? 'Version ' + cur.version : 'Not live yet'}
                    {cur && <div className="chc-list-desc">Since {fmtDate(cur.effective)}</div>}
                    {next && <div className="chc-list-desc sb-next">Version {next.version} on {fmtDate(next.effective)}</div>}
                  </td>}
                  {tier === 'full' && <React.Fragment>
                    <td>{sbStatusBadge(x.status)}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => open(x)}>Edit</Button></td>
                  </React.Fragment>}
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8} className="cr-empty">No services match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SbTemplatesTable({ store, onUse }) {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const rows = store.templates.filter(t => !s || (t.name + ' ' + t.collection + ' ' + t.config.steps.map(x => x.name).join(' ')).toLowerCase().indexOf(s) !== -1);
  const open = t => guard.go(SB_BASE + '/templates/' + t.template_id);
  const [wrapRef, tier] = useSbTableTier(1000, 700);
  return (
    <Panel title={'Templates (' + rows.length + ')'}>
      <div className="chc-note">
        A template is a starting point for a new service, nothing more. Picking one fills the service in; after that
        the service is its own. Changing a template only affects services made from it afterwards.
      </div>
      <div className="cr-filters">
        <div className="form-input cr-search">
          <Icon name="search" size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates" />
          {q && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={13} /></button>}
        </div>
      </div>
      <div className="table-wrap" ref={wrapRef}>
        <table className={'data-table cr-table sb-table sb-table--' + tier}>
          <thead><tr>
            <th>Template</th>
            {tier === 'full' && <React.Fragment><th>Collection</th><th>Built By</th></React.Fragment>}
            {(tier === 'full' || tier === 'compact') && <React.Fragment><th>Staff Complete</th><th>Services Made From It</th></React.Fragment>}
            {tier === 'full' && <th>Last Changed</th>}
            <th><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {rows.map(t => {
              const made = store.services.filter(x => x.started_from === t.template_id).length;
              const madeTxt = made ? sbPlural(made, 'service') : <span className="chc-list-empty">None yet</span>;
              const built = <span className={'badge ' + (t.source === 'implementation' ? 'status-info' : 'status-neutral')}>{t.source === 'implementation' ? 'Implementation team' : 'Your agency'}</span>;
              return (
                <tr key={t.template_id}>
                  <td className="wrap cr-col-name">
                    <span className="sb-name-row">
                      <button className="lnk chc-list-name" onClick={() => open(t)}>{t.name || 'Untitled Template'}</button>
                      {tier !== 'full' && built}
                    </span>
                    {t.config.description && <div className="chc-list-desc">{t.config.description}</div>}
                    {tier !== 'full' && <div className="chc-list-desc">{(t.collection || 'No collection') + ' · changed ' + fmtDate(t.updated)}</div>}
                    {(tier === 'narrow' || tier === 'stack') && <div className="chc-list-desc">{sbStepsLabel(t.config)} · {made ? 'used by ' + sbPlural(made, 'service') : 'not used yet'}</div>}
                  </td>
                  {tier === 'full' && <React.Fragment>
                    <td className="wrap">{t.collection || '—'}</td>
                    <td>{built}</td>
                  </React.Fragment>}
                  {(tier === 'full' || tier === 'compact') && <React.Fragment>
                    <td className="wrap sb-col-steps">{sbStepsLabel(t.config)}</td>
                    <td>{madeTxt}</td>
                  </React.Fragment>}
                  {tier === 'full' && <td>{fmtDate(t.updated)}</td>}
                  <td className="sb-row-acts">
                    <Button size="sm" variant="secondary" onClick={() => onUse(t)}>Use</Button>
                    <Button size="sm" variant="ghost" onClick={() => open(t)}>Edit</Button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="cr-empty">No templates match.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---- Building blocks ---------------------------------------------------
   Each library lists its entries with a "used by" count, the Due Date Rules
   pattern. The first group is defined here; the second already has a home
   elsewhere in Admin and is only referenced. */
const SB_BLOCK_DEFS = [
  { key: 'service-codes', label: 'Service Codes', blurb: 'The CPT and HCPCS codes a service bills, with modifiers and units.',
    entries: () => SB_CODES.map(c => ({ id: c.code_id, name: c.code + ' · ' + c.description, meta: c.unit })),
    test: id => cfg => { const c = cfg.codes.find(x => x.code_id === id); return c ? sbCodeLabel(c) : false; } },
  { key: 'diagnosis-sets', label: 'Diagnosis Sets', blurb: 'Groups of ICD-10 codes a service applies to.',
    entries: () => SB_DX_SETS.map(d => ({ id: d.set_id, name: d.name, meta: d.codes })),
    test: id => cfg => cfg.dx_set === id && (SB_PREC[cfg.precedence] || {}).name },
  { key: 'diagnosis-precedence', label: 'Diagnosis Precedence', blurb: 'Which of a client’s diagnoses a note carries.',
    entries: () => SB_PRECEDENCE.map(p => ({ id: p.precedence_id, name: p.name, meta: p.description })),
    test: id => cfg => cfg.precedence === id && (SB_DX[cfg.dx_set] || {}).name },
  { key: 'sensitivity', label: 'Sensitivity Classifications', blurb: 'Who can see the records a service creates.',
    entries: () => SB_SENSITIVITY.map(s => ({ id: s.name, name: s.name, meta: s.requires_document ? 'Needs a ' + s.requires_document : 'No extra consent' })),
    test: id => cfg => cfg.sensitivity === id && sbStepsLabel(cfg) },
  { key: 'documents', label: 'Documents', blurb: 'Forms, notes and assessments staff complete. Each can carry a default due date rule.',
    entries: rules => SB_DOCS.map(d => { const r = rules.find(x => x.id === d.default_rule_id); return { id: d.name, name: d.name, meta: d.category + (r ? ' · default rule: ' + crName(r) : '') }; }),
    test: id => cfg => { const s = cfg.steps.find(x => x.kind === 'Document' && x.name === id); return s ? (cfg.steps.length > 1 ? 'Step ' + (cfg.steps.indexOf(s) + 1) + ' of ' + cfg.steps.length : 'The only step') : false; } },
  { key: 'appointment-types', label: 'Appointment Types', blurb: 'Appointments a service books.',
    entries: rules => SB_APPTS.map(a => { const r = rules.find(x => x.id === a.default_rule_id); return { id: a.name, name: a.name, meta: r ? 'Default rule: ' + crName(r) : 'No default rule' }; }),
    test: id => cfg => { const s = cfg.steps.find(x => x.kind === 'Appointment' && x.name === id); return s ? 'Step ' + (cfg.steps.indexOf(s) + 1) + ' of ' + cfg.steps.length : false; } },
  { key: 'due-date-rules', label: 'Due Date Rules', blurb: 'When steps are due, and how often. On a step, or on a whole service as its deadline.', to: '/due-date-rules' },
];
const SB_ELSEWHERE = [
  { key: 'programs', label: 'Programs', home: 'Program Management', blurb: 'Which clients a service fits.',
    entries: () => CR_PROGRAMS.map(p => ({ id: p.id, name: p.name, meta: p.type })),
    test: id => cfg => cfg.programs.indexOf(id) !== -1 && sbJoin(cfg.roles, 1) },
  { key: 'roles', label: 'Roles', home: 'Specific Security', blurb: 'Who a service is offered to, before specific security.',
    entries: () => STAFF_ROLE_NAMES.map(r => ({ id: r, name: r, meta: '' })),
    test: id => cfg => cfg.roles.indexOf(id) !== -1 && sbProgramsLabel(cfg.programs, 1) },
  { key: 'sites', label: 'Sites', home: 'Program Management', blurb: 'Where a service can be performed.',
    entries: () => SB_SITES.map(s => ({ id: s.site_id, name: s.name.replace(' - ', ' · '), meta: s.type })),
    test: id => cfg => cfg.sites.indexOf(id) !== -1 && 'Only its listed sites' },
  { key: 'payors', label: 'Payors', home: 'Payment Management', blurb: 'Who a service can be billed to.',
    entries: () => SB_PAYORS.map(p => ({ id: p.provider_id, name: p.name, meta: (SB_FUND[p.funding_type_id] || {}).name + (SB_CPT_ONLY.indexOf(p.provider_id) !== -1 ? ' · CPT codes only' : '') })),
    test: id => cfg => cfg.payors.indexOf(id) !== -1 && sbJoin(cfg.codes.map(sbCodeLabel), 2, 'Not billed') },
  { key: 'funding', label: 'Funding', home: 'Payment Management', blurb: 'The funding sources a service reports against.',
    entries: () => SB_FUNDING.map(f => ({ id: f.funding_type_id, name: f.name, meta: f.category })),
    test: id => cfg => cfg.funding.indexOf(id) !== -1 && sbProgramsLabel(cfg.programs, 1) },
];
const SB_ALL_BLOCKS = SB_BLOCK_DEFS.concat(SB_ELSEWHERE);
/* How many services use any entry in a library. */
function sbBlockUse(store, def, rules) {
  if (!def.entries) return null;
  const ids = def.entries(rules).map(e => e.id);
  return store.services.filter(s => ids.some(id => def.test(id)(sbCfg(s)))).length;
}

function SbBlocksIndex({ store }) {
  const guard = useGuard();
  const [rules] = useDueDateRules();
  const card = (b, elsewhere) => {
    const n = b.entries ? b.entries(rules).length : rules.length;
    const used = b.entries ? sbBlockUse(store, b, rules) : store.services.filter(s => { const c = sbCfg(s); return c.deadline_rule_id || c.steps.some(x => x.rule_ids.length); }).length;
    return (
      <button key={b.key} type="button" className="panel sb-blockcard" onClick={() => guard.go(b.to || SB_BASE + '/blocks/' + b.key)}>
        <span className="sb-blockcard-name">{b.label}</span>
        <span className="sb-blockcard-blurb">{b.blurb}</span>
        <span className="sb-blockcard-meta">{sbPlural(n, 'entry', 'entries')} · used by {sbPlural(used, 'service')}{elsewhere ? ' · managed in ' + b.home : ''}</span>
      </button>
    );
  };
  return (
    <React.Fragment>
      <h2 className="sb-group-title">Defined Here</h2>
      <div className="sb-blockgrid">{SB_BLOCK_DEFS.map(b => card(b, false))}</div>
      <h2 className="sb-group-title">Defined Elsewhere in Admin</h2>
      <div className="chc-note">Services pick from these, but they’re set up where they already live.</div>
      <div className="sb-blockgrid">{SB_ELSEWHERE.map(b => card(b, true))}</div>
    </React.Fragment>
  );
}

function SbBlockPage({ blockKey }) {
  const guard = useGuard();
  const [store] = useServices();
  const [rules] = useDueDateRules();
  const [usersOf, setUsersOf] = useState(null);
  const [q, setQ] = useState('');
  const def = SB_ALL_BLOCKS.find(b => b.key === blockKey && b.entries);
  if (!def) return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Service Builder', to: SB_BASE }, { label: 'Not found' }]} />
      <h1 className="page-title">Building block not found</h1>
      <Button variant="secondary" onClick={() => guard.go(SB_BASE + '/blocks')}>Back to Building Blocks</Button>
    </div>
  );
  const s = q.trim().toLowerCase();
  const entries = def.entries(rules).filter(e => !s || (e.name + ' ' + e.meta).toLowerCase().indexOf(s) !== -1);
  return (
    <div className="page chc cr sb">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Service Builder', to: SB_BASE }, { label: 'Building Blocks', to: SB_BASE + '/blocks' }, { label: def.label }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{def.label}</h1>
          <div className="page-sub">
            {def.blurb}{def.home ? ' Set up in ' + def.home + '; services refer to it from here.' : ' Defined once, and services subscribe to them.'}
          </div>
        </div>
      </div>
      <Panel title={def.label + ' (' + entries.length + ')'}>
        <div className="cr-filters">
          <div className="form-input cr-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={'Search ' + def.label.toLowerCase()} aria-label={'Search ' + def.label} />
            {q && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={13} /></button>}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table cr-table">
            <thead><tr><th>{def.label.replace(/s$/, '').replace(/ie$/, 'y')}</th><th>Details</th><th>Used By</th></tr></thead>
            <tbody>
              {entries.map(e => {
                const u = sbUsers(store, def.test(e.id));
                return (
                  <tr key={e.id}>
                    <td className="wrap cr-col-name"><span className="cr-svc-name">{e.name}</span></td>
                    <td className="wrap">{e.meta || '—'}</td>
                    <td>{u.services.length
                      ? <button type="button" className="lnk cr-count" onClick={() => setUsersOf({ e, u })}>{sbPlural(u.services.length, 'service')}</button>
                      : <span className="chc-list-empty">None yet</span>}</td>
                  </tr>
                );
              })}
              {!entries.length && <tr><td colSpan={3} className="cr-empty">No results found</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      {usersOf && <ServicesUsingOverlay title={'Services Using ' + usersOf.e.name} rows={usersOf.u.services} templates={usersOf.u.templates}
        detailLabel={def.key === 'documents' || def.key === 'appointment-types' ? 'Where' : 'With'} onClose={() => setUsersOf(null)} />}
    </div>
  );
}

/* The searchable, scrolling list behind every "used by" count. Rows carry a
   `detail` string (or, for rules, `governed`). */
function ServicesUsingOverlay({ title, rows, templates = [], detailLabel = 'Detail', onClose }) {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const detail = x => (x.governed ? x.governed.map(i => i.name + (i.kind === 'Appointment' ? ' (appointment)' : '')).join(', ') : x.detail);
  const hit = x => !s || (x.name + ' ' + sbProgramsLabel(x.cfg.programs, 9) + ' ' + detail(x)).toLowerCase().indexOf(s) !== -1;
  const r = rows.filter(hit), t = templates.filter(hit);
  const go = to => { onClose(); guard.go(to); };
  return (
    <Overlay title={title} subtitle={sbPlural(rows.length, 'service') + (templates.length ? ' · ' + sbPlural(templates.length, 'template') : '')}
      size="lg" onClose={onClose} bodyClassName="cr-svc-body"
      footer={<React.Fragment><span className="spacer" /><Button variant="primary" onClick={onClose}>Done</Button></React.Fragment>}>
      <div className="form-input cr-search cr-svc-search">
        <Icon name="search" size={16} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services, programs or documents" aria-label="Search services" autoFocus />
        {q && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={13} /></button>}
      </div>
      <div className="cr-svc-scroll">
        <table className="data-table cr-svc-table">
          <thead><tr><th>Service</th><th>Programs</th><th>{detailLabel}</th><th>Status</th></tr></thead>
          <tbody>
            {r.map(x => (
              <tr key={x.service_id}>
                <td className="wrap"><button type="button" className="lnk cr-svc-name sb-linkname" onClick={() => go(SB_BASE + '/services/' + x.service_id)}>{x.name}</button></td>
                <td className="wrap">{sbProgramsLabel(x.cfg.programs, 2)}</td>
                <td className="wrap">{detail(x)}</td>
                <td>{sbStatusBadge(x.status)}</td>
              </tr>
            ))}
            {t.length > 0 && <tr className="cr-svc-group"><td colSpan={4}>Templates</td></tr>}
            {t.map(x => (
              <tr key={x.template_id}>
                <td className="wrap"><button type="button" className="lnk cr-svc-name sb-linkname" onClick={() => go(SB_BASE + '/templates/' + x.template_id)}>{x.name}</button></td>
                <td>—</td>
                <td className="wrap">{detail(x)}</td>
                <td><span className="badge status-info">Template</span></td>
              </tr>
            ))}
            {!r.length && !t.length && <tr><td colSpan={4} className="cr-empty">No results found</td></tr>}
          </tbody>
        </table>
      </div>
    </Overlay>
  );
}

/* ---- New Service --------------------------------------------------------
   Three short steps: pick a starting point, name it and say who it's for,
   review what it brings. It lands as a Draft in the editor. */
function NewServiceOverlay({ templateId, onClose }) {
  const guard = useGuard();
  const [store, setStore] = useServices();
  const [rules] = useDueDateRules();
  const [step, setStep] = useState(templateId ? 1 : 0);
  const [tid, setTid] = useState(templateId || null);
  const [q, setQ] = useState('');
  const tpl = store.templates.find(t => t.template_id === tid) || null;
  const [f, setF] = useState(() => ({ name: '', programs: [], roles: tpl ? tpl.config.roles.slice() : [], description: tpl ? tpl.config.description : '' }));
  const [tried, setTried] = useState(false);
  const pick = id => {
    setTid(id);
    const t = store.templates.find(x => x.template_id === id);
    setF(x => ({ ...x, roles: t ? t.config.roles.slice() : [], description: t ? t.config.description : '' }));
  };
  const s = q.trim().toLowerCase();
  const groups = {};
  store.templates.filter(t => !s || (t.name + ' ' + t.collection + ' ' + t.config.steps.map(x => x.name).join(' ')).toLowerCase().indexOf(s) !== -1)
    .forEach(t => { (groups[t.collection || 'Other'] = groups[t.collection || 'Other'] || []).push(t); });
  const taken = f.name.trim() && store.services.some(x => x.name.toLowerCase() === f.name.trim().toLowerCase());
  const err2 = { name: !f.name.trim() ? 'Name the service the way staff will look for it.' : taken ? 'Another service already has this name.' : null,
    programs: !f.programs.length ? 'Choose at least one program.' : null };
  const blank = { description: '', roles: [], programs: [], sites: [], codes: [], payors: [], funding: [], dx_set: 'DXS-BH',
    precedence: 'DXP-EPISODE', sensitivity: 'Standard', duration_min: null, steps: [], deadline_rule_id: null };
  const build = () => {
    const base = clone(tpl ? tpl.config : blank);
    /* Fresh step ids, so this service's steps are its own. */
    const map = {};
    base.steps.forEach(x => { const id = sbId('STP') + Math.random().toString(36).slice(2, 5).toUpperCase(); map[x.step_id] = id; x.step_id = id; });
    base.steps.forEach(x => { if (x.after) x.after = map[x.after] || null; });
    return { ...base, programs: f.programs.slice(), roles: f.roles.slice(), description: f.description };
  };
  const next = () => {
    if (step === 0) return setStep(1);
    if (step === 1) { setTried(true); if (err2.name || err2.programs) return; return setStep(2); }
    const svc = { service_id: sbId('SVC'), name: f.name.trim(), started_from: tid, status: 'draft', created: TODAY_ISO,
      versions: [{ version: 1, effective: null, changed: TODAY_ISO, changed_by: ME.id, note: tpl ? 'Created from ' + tpl.name + '.' : 'Created from scratch.', config: build() }] };
    setStore(st => ({ ...st, services: st.services.concat([svc]) }));
    guard.setToast({ status: 'success', title: 'Draft service created', detail: svc.name + ' · not offered to staff until you activate it' });
    onClose();
    guard.go(SB_BASE + '/services/' + svc.service_id);
  };
  const preview = step === 2 ? build() : null;
  const roleOpts = STAFF_ROLE_NAMES.map(r => ({ value: r, label: r }));
  const programOpts = CR_PROGRAMS.map(p => ({ value: p.id, label: p.name, meta: p.type }));
  const toggle = (k, v) => setF(x => ({ ...x, [k]: x[k].indexOf(v) !== -1 ? x[k].filter(y => y !== v) : x[k].concat([v]) }));
  const TITLES = ['Pick a Starting Point', 'Name It and Say Who It’s For', 'Review What It Brings'];
  return (
    <Overlay title="New Service" subtitle={'Step ' + (step + 1) + ' of 3 · ' + TITLES[step]} size="lg" onClose={onClose} bodyClassName="sb-new-body"
      footer={<React.Fragment>
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}><Icon name="chevronLeft" size={15} /> Back</Button>}
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={next}>{step === 2 ? 'Create Draft' : 'Next'}</Button>
      </React.Fragment>}>
      {step === 0 && (
        <React.Fragment>
          <div className="chc-note">A template fills in everything below. You can change any of it, and the template stays as it is.</div>
          <div className="form-input cr-search cr-svc-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates" autoFocus />
          </div>
          <div className="sb-tplpick" role="radiogroup" aria-label="Starting point">
            <SbTplOption checked={!tid} onPick={() => pick(null)} name="Start Blank" meta="Choose every building block yourself." />
            {Object.keys(groups).map(g => (
              <React.Fragment key={g}>
                <div className="sb-tplgroup">{g}</div>
                {groups[g].map(t => (
                  <SbTplOption key={t.template_id} checked={tid === t.template_id} onPick={() => pick(t.template_id)} name={t.name || 'Untitled Template'}
                    tag={t.source === 'implementation' ? 'Implementation team' : 'Your agency'}
                    meta={sbStepsLabel(t.config) + ': ' + sbJoin(t.config.steps.map(x => x.name), 4) + (t.config.codes.length ? ' · ' + t.config.codes.map(sbCodeLabel).join(', ') : '')} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </React.Fragment>
      )}
      {step === 1 && (
        <div className="sb-new-form">
          <div className="chc-note">{tpl ? 'Starting from ' + tpl.name + '.' : 'Starting blank.'} Programs and roles decide who can pick it; you can narrow it further by site and sensitivity in the editor.</div>
          <label className="form-field">
            <span>Service name, as staff see it <span className="ff-req"> *</span></span>
            <div className={'form-input' + (tried && err2.name ? ' invalid' : '')}>
              <input value={f.name} autoFocus placeholder={tpl ? 'e.g. ' + (tpl.config.duration_min ? tpl.name.replace(/^Standard /, '') + ' ' + tpl.config.duration_min + 'm' : tpl.name) : 'e.g. Standard 15m Post Class Check-In'}
                onChange={e => setF(x => ({ ...x, name: e.target.value }))} />
            </div>
            {tried && err2.name && <span className="ff-error"><Icon name="warn" size={13} /> {err2.name}</span>}
          </label>
          <div className="form-field">
            <span>Programs <span className="ff-req"> *</span></span>
            <MultiSelectDropdown id="sb-new-programs" placeholder="Select programs…" selected={f.programs} onToggle={v => toggle('programs', v)} options={programOpts} />
            {tried && err2.programs && <span className="ff-error"><Icon name="warn" size={13} /> {err2.programs}</span>}
          </div>
          <div className="form-field">
            <span>Roles {tpl && <span className="ff-req-txt">(from the template)</span>}</span>
            <MultiSelectDropdown id="sb-new-roles" searchable placeholder="Select roles…" selected={f.roles} onToggle={v => toggle('roles', v)} options={roleOpts} />
          </div>
          <label className="form-field">
            <span>Description, for admins <span className="ff-req-txt">(optional)</span></span>
            <div className="form-input"><input value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))} /></div>
          </label>
        </div>
      )}
      {step === 2 && (
        <React.Fragment>
          <div className="chc-note">It’s created as a <b>Draft</b>. Staff won’t see it until you activate it and choose the date it takes effect.</div>
          <table className="data-table sb-review">
            <tbody>
              <tr><th>Name</th><td>{f.name.trim()}</td></tr>
              <tr><th>Started from</th><td>{tpl ? tpl.name : 'Nothing (blank)'}</td></tr>
              {SB_FIELDS.filter(x => x.key !== 'description').map(x => <tr key={x.key}><th>{x.label}</th><td className="wrap">{x.fmt(preview, rules)}</td></tr>)}
            </tbody>
          </table>
        </React.Fragment>
      )}
    </Overlay>
  );
}
function SbTplOption({ checked, onPick, name, meta, tag }) {
  return (
    <div className={'sb-tplopt' + (checked ? ' is-on' : '')} role="radio" aria-checked={checked} tabIndex={0} onClick={onPick}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPick(); } }}>
      <span className={'sb-radio' + (checked ? ' on' : '')} aria-hidden="true" />
      <span className="sb-tplopt-text">
        <span className="sb-tplopt-name">{name}{tag && <span className="badge status-neutral sb-tag">{tag}</span>}</span>
        <span className="sb-tplopt-meta">{meta}</span>
      </span>
    </div>
  );
}

/* ---- Editor: shared by services and templates -------------------------- */
function SbCard({ title, required, missing, children, onEdit, editLabel = 'Edit' }) {
  return (
    <div className={'sb-card' + (missing ? ' is-missing' : '')}>
      <div className="sb-card-head">
        <span className="sb-card-title">{title}</span>
        {required && <span className={'sb-req' + (missing ? ' is-missing' : '')}>Required</span>}
        <span className="spacer" />
        {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}><Icon name="edit" size={13} /> {editLabel}</Button>}
      </div>
      <div className="sb-card-body">{children}</div>
    </div>
  );
}

/* The side panel each card opens. Holds its own copy until Apply. */
function SbDrawer({ title, sub, onClose, onApply, children }) {
  const dlg = useRef(null);
  useDialogFocus(dlg, '.body');
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return ReactDOM.createPortal(
    <React.Fragment>
      <div className="flyout-scrim" onClick={onClose} />
      <aside ref={dlg} className="flyout sb-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div><h2>{title}</h2>{sub && <div className="sb-drawer-sub">{sub}</div>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </header>
        <div className="body">{children}</div>
        <footer className="foot">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onApply}>Apply</Button>
        </footer>
      </aside>
    </React.Fragment>, document.body);
}
function SbChecklist({ options, selected, onChange, searchable, label }) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const shown = options.filter(o => !s || (o.label + ' ' + (o.meta || '')).toLowerCase().indexOf(s) !== -1);
  const toggle = v => onChange(selected.indexOf(v) !== -1 ? selected.filter(x => x !== v) : selected.concat([v]));
  return (
    <div className="sb-checklist">
      {searchable && <MenuSearch value={q} onChange={setQ} placeholder={'Search ' + label} />}
      <div className="sb-checklist-list" role="group" aria-label={label}>
        {shown.map(o => {
          const on = selected.indexOf(o.value) !== -1;
          return (
            <div key={o.value} className="msd-opt sb-opt" role="checkbox" aria-checked={on} tabIndex={0} onClick={() => toggle(o.value)}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(o.value); } }}>
              <Checkbox checked={on} onChange={() => {}} ariaLabel={o.label} presentational />
              <span className="sb-opt-text"><span className="sb-opt-label">{o.label}</span>{o.meta && <span className="sb-opt-meta">{o.meta}</span>}</span>
            </div>
          );
        })}
        {!shown.length && <div className="msd-empty">No results found</div>}
      </div>
    </div>
  );
}
function SbRadioList({ options, value, onChange, name }) {
  return (
    <div className="sb-radiolist" role="radiogroup">
      {options.map(o => (
        <SbTplOption key={o.value} checked={value === o.value} onPick={() => onChange(o.value)} name={o.label} meta={o.meta} tag={o.tag} />
      ))}
    </div>
  );
}

/* What each card's drawer edits. */
function SbDrawerFor({ which, cfg, onApply, onClose }) {
  const [v, setV] = useState(() => clone(cfg));
  const set = (k, val) => setV(x => ({ ...x, [k]: val }));
  const apply = () => { onApply(v); onClose(); };
  const D = (title, sub, body) => <SbDrawer title={title} sub={sub} onClose={onClose} onApply={apply}>{body}</SbDrawer>;
  if (which === 'roles') return D('Roles', 'Who it’s offered to. Each person is then checked against its programs, sites and sensitivity.',
    <SbChecklist label="roles" searchable selected={v.roles} onChange={x => set('roles', x)} options={STAFF_ROLE_NAMES.map(r => ({ value: r, label: r }))} />);
  if (which === 'programs') return D('Programs', 'The client must be enrolled in one, and staff must have access to it.',
    <SbChecklist label="programs" selected={v.programs} onChange={x => set('programs', x)}
      options={CR_PROGRAMS.map(p => ({ value: p.id, label: p.name, meta: p.type + (p.populations.length ? ' · ' + p.populations.join(', ') : '') }))} />);
  if (which === 'sites') return D('Sites', 'Where it can be performed.',
    <React.Fragment>
      <div className="cr-scope">
        <Radio name="sb-sites" checked={!v.sites.length} onChange={() => set('sites', [])} label="Any site its programs run at" />
        <Radio name="sb-sites" checked={v.sites.length > 0} onChange={() => set('sites', v.sites.length ? v.sites : [SB_SITES[0].site_id])} label="Only these sites" />
      </div>
      {v.sites.length > 0 && <SbChecklist label="sites" selected={v.sites} onChange={x => set('sites', x)} options={SB_SITES.map(s => ({ value: s.site_id, label: s.name.replace(' - ', ' · '), meta: s.type }))} />}
    </React.Fragment>);
  if (which === 'codes') {
    const sel = v.codes.map(c => c.code_id);
    const toggleCode = ids => set('codes', ids.map(id => v.codes.find(c => c.code_id === id) || { code_id: id, units: 1, modifiers: [] }));
    const patchCode = (id, p) => set('codes', v.codes.map(c => (c.code_id === id ? { ...c, ...p } : c)));
    return D('Service Codes', 'What it bills. Leave it empty for work that isn’t billed.',
      <React.Fragment>
        {v.codes.length > 0 && (
          <div className="sb-codeset">
            {v.codes.map(c => (
              <div key={c.code_id} className="sb-coderow">
                <div className="sb-coderow-name"><b>{SB_CODE[c.code_id].code}</b> {SB_CODE[c.code_id].description}<span className="sb-opt-meta">{SB_CODE[c.code_id].unit}</span></div>
                <div className="sb-coderow-ctl">
                  <span className="cr-word">Units</span>
                  <span className="form-input cr-num"><input type="number" min={1} aria-label={'Units for ' + SB_CODE[c.code_id].code} value={c.units}
                    onChange={e => patchCode(c.code_id, { units: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></span>
                  <span className="sb-mods" role="group" aria-label="Modifiers">
                    {SB_MODIFIERS.map(m => {
                      const on = c.modifiers.indexOf(m.modifier) !== -1;
                      return (
                        <Tooltip key={m.modifier} label={m.description}>
                          <button type="button" className={'pill-btn sb-mod' + (on ? ' active' : '')} aria-pressed={on}
                            onClick={() => patchCode(c.code_id, { modifiers: on ? c.modifiers.filter(x => x !== m.modifier) : c.modifiers.concat([m.modifier]) })}>{m.modifier}</button>
                        </Tooltip>
                      );
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="pref-label">Code library</div>
        <SbChecklist label="codes" searchable selected={sel} onChange={toggleCode} options={SB_CODES.map(c => ({ value: c.code_id, label: c.code + ' · ' + c.description, meta: c.unit }))} />
      </React.Fragment>);
  }
  if (which === 'payors') {
    const hcpcs = v.codes.some(c => SB_CODE[c.code_id] && !/^\d/.test(SB_CODE[c.code_id].code));
    return D('Payors', 'Who it can be billed to.',
      <SbChecklist label="payors" selected={v.payors} onChange={x => set('payors', x)}
        options={SB_PAYORS.map(p => ({ value: p.provider_id, label: p.name, meta: (SB_FUND[p.funding_type_id] || {}).name + (SB_CPT_ONLY.indexOf(p.provider_id) !== -1 ? ' · CPT codes only' + (hcpcs ? ', so it won’t pay this service’s HCPCS codes' : '') : '') }))} />);
  }
  if (which === 'funding') return D('Funding', 'The funding sources it reports against.',
    <SbChecklist label="funding" selected={v.funding} onChange={x => set('funding', x)} options={SB_FUNDING.map(f => ({ value: f.funding_type_id, label: f.name, meta: f.category }))} />);
  if (which === 'dx') return D('Diagnoses', 'Which diagnoses it applies to.',
    <SbRadioList value={v.dx_set} onChange={x => set('dx_set', x)} options={SB_DX_SETS.map(d => ({ value: d.set_id, label: d.name, meta: d.codes }))} />);
  if (which === 'precedence') return D('Diagnosis Precedence', 'Which of the client’s diagnoses the note carries.',
    <SbRadioList value={v.precedence} onChange={x => set('precedence', x)} options={SB_PRECEDENCE.map(p => ({ value: p.precedence_id, label: p.name, meta: p.description }))} />);
  if (which === 'sensitivity') return D('Sensitivity Classification', 'Who can see what it creates. Staff must be cleared for it to be offered it.',
    <SbRadioList value={v.sensitivity} onChange={x => set('sensitivity', x)}
      options={SB_SENSITIVITY.map(s => ({ value: s.name, label: s.name, meta: s.requires_document ? 'Needs a ' + s.requires_document + ' on file.' : 'No extra consent needed.' }))} />);
  return null;
}

/* Add a document or appointment, or a rule to a step: a searchable menu. */
function SbPickMenu({ label, icon, options, onPick, variant = 'secondary', size = 'sm', disabledReason }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null), menuRef = useRef(null);
  useOutside([ref, menuRef], () => setOpen(false));
  const s = q.trim().toLowerCase();
  const shown = options.filter(o => !s || (o.label + ' ' + (o.sub || '')).toLowerCase().indexOf(s) !== -1);
  return (
    <span className="sb-pick" ref={ref}>
      <Button size={size} variant={variant} onClick={() => { setOpen(o => !o); setQ(''); }}>{icon && <Icon name={icon} size={14} />} {label}</Button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu" role="listbox" minWidth={320} maxHeight={340} onClose={() => setOpen(false)}>
          <MenuSearch value={q} onChange={setQ} placeholder="Search" />
          <div className="dd-list">
            {shown.map(o => (
              <button key={o.value} type="button" role="option" className={'dd-opt dd-opt--rich' + (o.disabled ? ' is-disabled' : '')} aria-disabled={o.disabled || undefined}
                onClick={() => { if (o.disabled) return; onPick(o.value); setOpen(false); }}>
                <span className="dd-opt-main"><span className="dd-opt-label">{o.label}</span>{o.sub && <span className="dd-opt-sub">{o.sub}</span>}</span>
              </button>
            ))}
            {!shown.length && <div className="msd-empty">No results found</div>}
          </div>
        </FloatMenu>
      )}
    </span>
  );
}

/* The steps: one ordered list of documents and appointments. Each carries
   its own due date rules, and can wait for an earlier step. */
function SbSteps({ cfg, rules, onChange }) {
  const steps = cfg.steps;
  const [dragIx, setDragIx] = useState(null);
  const [overIx, setOverIx] = useState(null);
  const set = next => onChange({ ...cfg, steps: next, deadline_rule_id: next.length > 1 ? cfg.deadline_rule_id : null });
  const patch = (i, p) => set(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (from, to) => {
    if (to < 0 || to >= steps.length || from === to) return;
    const next = steps.slice(); next.splice(to, 0, next.splice(from, 1)[0]); set(next);
  };
  const remove = i => set(steps.filter((_, j) => j !== i).map(s => (s.after === steps[i].step_id ? { ...s, after: null } : s)));
  const add = (kind, name) => {
    const lib = kind === 'Document' ? SB_DOC[name] : SB_APPT[name];
    const def = lib && lib.default_rule_id && rules.some(r => r.id === lib.default_rule_id) ? [lib.default_rule_id] : [];
    set(steps.concat([{ step_id: sbId('STP') + steps.length, kind, name, required: true, rule_ids: def, after: null }]));
  };
  const ruleById = id => rules.find(r => r.id === id);
  const activeRules = rules.filter(r => r.status !== 'inactive');
  const have = new Set(steps.map(s => s.kind + '|' + s.name));
  const docOpts = SB_DOCS.map(d => { const r = ruleById(d.default_rule_id); return { value: d.name, label: d.name, sub: d.category + (r ? ' · arrives with ' + crName(r) : ''), disabled: have.has('Document|' + d.name) }; });
  const apptOpts = SB_APPTS.map(a => { const r = ruleById(a.default_rule_id); return { value: a.name, label: a.name, sub: r ? 'Arrives with ' + crName(r) : 'No default rule', disabled: have.has('Appointment|' + a.name) }; });
  return (
    <div className="sb-steps">
      {steps.length ? (
        <ol className="qvlist sb-steplist">
          {steps.map((s, i) => (
            <li key={s.step_id}
              className={'qvitem sb-step' + (dragIx === i ? ' is-dragging' : '') + (overIx === i && dragIx !== i ? ' is-over' : '')}
              draggable
              onDragStart={e => { setDragIx(i); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.name); } }}
              onDragOver={e => { e.preventDefault(); setOverIx(i); }}
              onDrop={e => { e.preventDefault(); if (dragIx != null) move(dragIx, i); setDragIx(null); setOverIx(null); }}
              onDragEnd={() => { setDragIx(null); setOverIx(null); }}>
              <div className="qvitem-row">
                <span className="qvitem-grip" aria-hidden="true" title="Drag to reorder"><Icon name="grip" size={16} /></span>
                <span className="qvitem-ord">{i + 1}</span>
                <span className="qvitem-ico"><Icon name={s.kind === 'Appointment' ? 'calendar' : 'uiDocumentEdit'} size={18} /></span>
                <span className="qvitem-text">
                  <span className="qvitem-name">{s.name}</span>
                  <span className="qvitem-sub">{s.kind}{s.required ? '' : ' · optional'}</span>
                </span>
                <span className="qvitem-acts">
                  <button type="button" className="icon-btn" aria-label={'Move ' + s.name + ' up'} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="chevronUp" size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={'Move ' + s.name + ' down'} disabled={i === steps.length - 1} onClick={() => move(i, i + 1)}><Icon name="chevronDown" size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={'Remove ' + s.name} onClick={() => remove(i)}><Icon name="close" size={16} /></button>
                </span>
              </div>
              <div className="sb-step-meta">
                <Checkbox checked={s.required} onChange={v => patch(i, { required: v })} label="Required" />
                {i > 0 && (
                  <span className="sb-step-after">
                    <span className="cr-word">Can start</span>
                    <span className="sb-after-dd">
                      <Dropdown id={null} value={s.after || ''} onChange={v => patch(i, { after: v || null })}
                        options={[{ value: '', label: 'any time' }].concat(steps.slice(0, i).map((x, j) => ({ value: x.step_id, label: 'after step ' + (j + 1) + ', ' + x.name })))} />
                    </span>
                  </span>
                )}
                <span className="sb-step-rules">
                  {s.rule_ids.map(id => {
                    const r = ruleById(id);
                    return (
                      <span key={id} className={'sb-chip' + (r && r.status === 'inactive' ? ' is-off' : '')}>
                        <Tooltip label={r ? sbRulePhrase(r) : 'This rule no longer exists.'} wide><span className="sb-chip-label">{r ? crName(r) : 'Deleted rule'}</span></Tooltip>
                        <button type="button" className="sb-chip-x" aria-label={'Remove ' + (r ? crName(r) : 'rule') + ' from ' + s.name}
                          onClick={() => patch(i, { rule_ids: s.rule_ids.filter(x => x !== id) })}><Icon name="close" size={11} /></button>
                      </span>
                    );
                  })}
                  <SbPickMenu label="Add Rule" icon="plus" variant="ghost"
                    options={activeRules.map(r => ({ value: r.id, label: crName(r), sub: sbRulePhrase(r), disabled: s.rule_ids.indexOf(r.id) !== -1 }))}
                    onPick={id => patch(i, { rule_ids: s.rule_ids.concat([id]) })} />
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="tsp-empty sb-steps-empty">Add the document staff complete. One is enough; add more to make it a workflow.</div>
      )}
      <div className="sb-step-add">
        <SbPickMenu label="Add Document" icon="plus" options={docOpts} onPick={n => add('Document', n)} />
        <SbPickMenu label="Add Appointment" icon="plus" options={apptOpts} onPick={n => add('Appointment', n)} />
      </div>
      <div className="chc-note">A document arrives with its form’s default due date rule. Change or remove it here, for this service only.</div>
    </div>
  );
}

function SbDeadline({ cfg, rules, onChange }) {
  const guard = useGuard();
  if (cfg.steps.length < 2) return <div className="cr-applied-empty">A single document has no deadline beyond its own rules. Add a second step to give the whole service one.</div>;
  const r = rules.find(x => x.id === cfg.deadline_rule_id);
  const opts = [{ value: '', label: 'No deadline' }].concat(rules.filter(x => x.status !== 'inactive' || x.id === cfg.deadline_rule_id)
    .map(x => ({ value: x.id, label: crName(x), sub: sbDeadlinePhrase(x) })));
  return (
    <div className="sb-deadline">
      <div className="cr-line">
        <span className="cr-word">All required steps due</span>
        <span className="sb-deadline-dd"><Dropdown id="sb-deadline" value={cfg.deadline_rule_id || ''} options={opts} display={r ? crName(r) : 'No deadline'} onChange={v => onChange({ ...cfg, deadline_rule_id: v || null })} /></span>
      </div>
      <div className="chc-note">
        {r ? <React.Fragment>That is, <b>{sbDeadlinePhrase(r)}</b>. Each step’s first due date is the deadline; its own rules take over for the renewals after that.</React.Fragment>
          : 'Without a deadline, each step is due by its own rules only.'}
        {' '}Deadlines are due date rules too. <button type="button" className="lnk cr-inline-link" onClick={() => guard.go('/due-date-rules/new')}>New rule</button>
      </div>
    </div>
  );
}

/* The right-hand rail is Checks only. Seeing the service the way a given
   staff member would is the locked Preview as Staff button in the header
   (SbPreviewLocked); the rail used to spell it out as lists, which admins
   found redundant and hard to follow. sbEligibility is what that preview
   would run on, and the staff side already uses it. */
function SbPreviewLocked() {
  const why = 'Coming later: pick a staff member and see this service the way they would.';
  return (
    <Tooltip label={why} wide placement="bottom">
      <button type="button" className="btn btn-secondary sb-preview-locked" aria-disabled="true"
        aria-label={'Preview as Staff. Unavailable. ' + why} onClick={e => e.preventDefault()}>
        <Icon name="lock" size={16} /> Preview as Staff
      </button>
    </Tooltip>
  );
}

function SbChecksList({ checks }) {
  if (!checks.errors.length && !checks.warnings.length)
    return <div className="sb-check is-ok"><Icon name="alertSuccess" size={16} /><span>Ready. Nothing stops this going live.</span></div>;
  return (
    <div className="sb-checks">
      {checks.errors.map(e => <div key={e} className="sb-check is-error"><Icon name="alertDanger" size={16} /><span>{e}</span></div>)}
      {checks.warnings.map(w => <div key={w} className="sb-check is-warn"><Icon name="alertWarning" size={16} /><span>{w}</span></div>)}
    </div>
  );
}

/* Saving a live service makes a version; activating a draft gives it its
   first effective date. */
function SbSaveVersionOverlay({ mode, service, base, draft, rules, onSave, onClose }) {
  const latest = sbLatest(service), cur = sbInEffect(service);
  const minIso = mode === 'scheduled' ? isoOf(addDays(TODAY, 1)) : TODAY_ISO;
  const [eff, setEff] = useState(mode === 'scheduled' ? latest.effective : TODAY_ISO);
  const [note, setNote] = useState('');
  const changes = sbDiff(base, draft.cfg, rules);
  const renamed = draft.name.trim() !== service.name;
  const n = mode === 'new' ? latest.version + 1 : latest.version;
  const bad = !eff || eff < minIso;
  const title = mode === 'activate' ? 'Activate ' + (draft.name.trim() || 'Service') : mode === 'scheduled' ? 'Update Version ' + n : 'Save as Version ' + n;
  return (
    <Overlay title={title} subtitle={draft.name.trim()} size="md" onClose={onClose}
      footer={<React.Fragment><span className="spacer" /><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={bad} onClick={() => onSave({ effective: eff, note: note.trim() })}>{mode === 'activate' ? 'Activate' : mode === 'scheduled' ? 'Update Version' : 'Save Version ' + n}</Button></React.Fragment>}>
      <DateField label={mode === 'activate' ? 'Offered to staff from' : 'Takes effect on'} required value={eff} min={minIso} onChange={v => v && setEff(v)} quick={false}
        error={bad ? 'Choose ' + (mode === 'scheduled' ? 'a date after today' : 'today or later') + '.' : null}
        hint={mode === 'activate' ? 'Today means staff can pick it straight away.'
          : eff === TODAY_ISO ? 'From today. Notes dated before today keep Version ' + (cur ? cur.version : latest.version) + '.'
          : 'Until then, staff keep Version ' + (cur ? cur.version : latest.version) + '. Notes dated before ' + fmtDate(eff) + ' always will.'} />
      {mode !== 'activate' && (
        <React.Fragment>
          <label className="form-field">
            <span>What changed, and why <span className="ff-req-txt">(optional)</span></span>
            <div className="form-input"><input value={note} placeholder="e.g. County contract adds funding from October" onChange={e => setNote(e.target.value)} /></div>
          </label>
          <div className="pref-label">Changes in This Version</div>
          {changes.length || renamed ? (
            <table className="data-table sb-diff">
              <thead><tr><th /><th>Before</th><th>After</th></tr></thead>
              <tbody>
                {renamed && <tr><th>Name</th><td className="wrap">{service.name}</td><td className="wrap">{draft.name.trim()}</td></tr>}
                {changes.map(c => <tr key={c.label}><th>{c.label}</th><td className="wrap">{c.before}</td><td className="wrap">{c.after}</td></tr>)}
              </tbody>
            </table>
          ) : <div className="cr-applied-empty">No changes.</div>}
          {renamed && <div className="chc-note">The name isn’t versioned. Staff see the new name everywhere, including on earlier notes.</div>}
        </React.Fragment>
      )}
    </Overlay>
  );
}

function SbHistoryOverlay({ service, rules, onClose }) {
  const [open, setOpen] = useState(null);
  const vs = service.versions.slice().reverse();
  const cur = sbInEffect(service);
  return (
    <Overlay title={'History · ' + service.name} subtitle={sbPlural(service.versions.length, 'version')} size="lg" onClose={onClose} bodyClassName="cr-svc-body"
      footer={<React.Fragment><span className="spacer" /><Button variant="primary" onClick={onClose}>Done</Button></React.Fragment>}>
      <div className="cr-svc-scroll">
        <table className="data-table cr-svc-table sb-hist">
          <thead><tr><th>Version</th><th>Effective</th><th>Changed</th><th>Note</th><th /></tr></thead>
          <tbody>
            {vs.map(v => {
              const prev = service.versions.find(x => x.version === v.version - 1);
              const diff = prev ? sbDiff(prev.config, v.config, rules) : [];
              const state = !v.effective ? ['Draft', 'status-amber'] : v.effective > TODAY_ISO ? ['Scheduled', 'status-info'] : cur && v.version === cur.version ? ['In effect', 'status-active'] : ['Past', 'status-neutral'];
              return (
                <React.Fragment key={v.version}>
                  <tr>
                    <td><b>Version {v.version}</b> <span className={'badge ' + state[1]}>{state[0]}</span></td>
                    <td>{v.effective ? fmtDate(v.effective) : '—'}</td>
                    <td className="wrap">{fmtDate(v.changed)} · {sName(v.changed_by)}</td>
                    <td className="wrap">{v.note || '—'}</td>
                    <td>{prev && <Button size="sm" variant="ghost" onClick={() => setOpen(open === v.version ? null : v.version)}>{open === v.version ? 'Hide Changes' : 'Compare'}</Button>}</td>
                  </tr>
                  {open === v.version && (
                    <tr className="sb-hist-diff"><td colSpan={5}>
                      {diff.length ? (
                        <table className="data-table sb-diff">
                          <thead><tr><th /><th>Version {prev.version}</th><th>Version {v.version}</th></tr></thead>
                          <tbody>{diff.map(c => <tr key={c.label}><th>{c.label}</th><td className="wrap">{c.before}</td><td className="wrap">{c.after}</td></tr>)}</tbody>
                        </table>
                      ) : <div className="cr-applied-empty">Saved with no configuration changes.</div>}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Overlay>
  );
}

function ServiceEditPage({ id, kind = 'service' }) {
  const guard = useGuard();
  const rawNavigate = useRawNavigate();
  const [store, setStore] = useServices();
  const [rules] = useDueDateRules();
  const isTpl = kind === 'template';
  const item = isTpl ? store.templates.find(t => t.template_id === id) : store.services.find(s => s.service_id === id);
  const baseOf = it => (it ? { name: it.name, collection: it.collection || '', cfg: clone(isTpl ? it.config : sbCfg(it)) } : null);
  const [draft, setDraft] = useState(() => baseOf(item));
  useEffect(() => { setDraft(baseOf(item)); }, [id, kind]);
  const [drawer, setDrawer] = useState(null);
  const [saving, setSaving] = useState(null);
  const [history, setHistory] = useState(false);
  const [usingTpl, setUsingTpl] = useState(false);
  const original = baseOf(item);
  const dirty = !!(item && draft && JSON.stringify(draft) !== JSON.stringify(original));
  useEffect(() => { if (dirty) guard.markDirty(isTpl ? 'Template' : 'Service'); else guard.clearDirty(); }, [dirty]);
  useEffect(() => () => guard.clearDirty(), []);
  const listTo = isTpl ? SB_BASE + '/templates' : SB_BASE;

  if (!item || !draft) return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Service Builder', to: SB_BASE }, { label: 'Not found' }]} />
      <h1 className="page-title">{isTpl ? 'Template' : 'Service'} not found</h1>
      <p className="page-sub">Nothing matches <code>{id}</code>. It may already have been deleted.</p>
      <Button variant="secondary" onClick={() => guard.go(listTo)}>Back to Service Builder</Button>
    </div>
  );

  const cfg = draft.cfg;
  const setCfg = c => setDraft(d => ({ ...d, cfg: c }));
  const checks = sbChecks(cfg, draft.name, rules, isTpl);
  const blocked = checks.errors.length > 0;
  const tplName = !isTpl && item.started_from ? sbTemplateName(store, item.started_from) : null;
  const cur = !isTpl && sbInEffect(item), latest = !isTpl && sbLatest(item), next = !isTpl && sbScheduled(item)[0];
  const status = isTpl ? null : item.status;
  const saveMode = isTpl ? null : status === 'draft' ? 'draft' : latest.effective > TODAY_ISO ? 'scheduled' : 'new';

  const writeService = fn => setStore(s => ({ ...s, services: s.services.map(x => (x.service_id === id ? fn(x) : x)) }));
  const saveTemplate = () => {
    setStore(s => ({ ...s, templates: s.templates.map(t => (t.template_id === id ? { ...t, name: draft.name.trim(), collection: draft.collection.trim(), config: clone(cfg), updated: TODAY_ISO } : t)) }));
    guard.clearDirty();
    guard.setToast({ status: 'success', title: 'Template saved', detail: 'Services already made from it don’t change.' });
  };
  const saveDraft = () => {
    writeService(x => ({ ...x, name: draft.name.trim(), versions: x.versions.map((v, i) => (i === x.versions.length - 1 ? { ...v, changed: TODAY_ISO, changed_by: ME.id, config: clone(cfg) } : v)) }));
    guard.clearDirty();
    guard.setToast({ status: 'success', title: 'Draft saved', detail: 'Still not offered to staff.' });
  };
  const commit = ({ effective, note }) => {
    const mode = saving;
    writeService(x => {
      const vs = x.versions.slice(), last = vs[vs.length - 1];
      if (mode === 'activate') vs[vs.length - 1] = { ...last, effective, changed: TODAY_ISO, changed_by: ME.id, config: clone(cfg) };
      else if (mode === 'scheduled') vs[vs.length - 1] = { ...last, effective, changed: TODAY_ISO, changed_by: ME.id, note: note || last.note, config: clone(cfg) };
      else vs.push({ version: last.version + 1, effective, changed: TODAY_ISO, changed_by: ME.id, note, config: clone(cfg) });
      return { ...x, name: draft.name.trim(), status: mode === 'activate' ? 'active' : x.status, versions: vs };
    });
    setSaving(null);
    guard.clearDirty();
    const when = effective === TODAY_ISO ? 'from today' : 'from ' + fmtDate(effective);
    guard.setToast({ status: 'success',
      title: mode === 'activate' ? draft.name.trim() + ' is active' : mode === 'scheduled' ? 'Version ' + latest.version + ' updated' : 'Version ' + (latest.version + 1) + ' saved',
      detail: mode === 'activate' ? 'Offered to staff ' + when + '.' : 'Takes effect ' + when + '. Earlier notes keep the version they were written under.' });
  };
  const setStatus = st => {
    writeService(x => ({ ...x, status: st }));
    guard.setToast({ status: 'success', title: item.name + (st === 'inactive' ? ' is inactive' : ' is active again'),
      detail: st === 'inactive' ? 'No longer offered to staff. Notes already written keep it.' : 'Offered to staff again, on Version ' + (cur ? cur.version : latest.version) + '.' });
  };
  const duplicate = () => {
    const copy = { service_id: sbId('SVC'), name: 'Copy of ' + draft.name.trim(), started_from: item.started_from, status: 'draft', created: TODAY_ISO,
      versions: [{ version: 1, effective: null, changed: TODAY_ISO, changed_by: ME.id, note: 'Duplicated from ' + item.name + '.', config: clone(cfg) }] };
    setStore(s => ({ ...s, services: s.services.concat([copy]) }));
    guard.setToast({ status: 'success', title: 'Duplicated as a draft', detail: copy.name });
    guard.go(SB_BASE + '/services/' + copy.service_id);
  };
  const saveAsTemplate = () => {
    const t = { template_id: sbId('TPL'), name: draft.name.trim() + ' Template', collection: AGENCY.name, source: 'agency', updated: TODAY_ISO,
      config: { ...clone(cfg), programs: [] } };
    setStore(s => ({ ...s, templates: s.templates.concat([t]) }));
    guard.setToast({ status: 'success', title: 'Template created', detail: t.name + ' · programs left blank, so it fits any' });
    guard.go(SB_BASE + '/templates/' + t.template_id);
  };
  const remove = () => {
    setStore(s => (isTpl ? { ...s, templates: s.templates.filter(t => t.template_id !== id) } : { ...s, services: s.services.filter(x => x.service_id !== id) }));
    guard.clearDirty();
    guard.setToast({ status: 'success', title: (draft.name.trim() || 'Untitled') + ' deleted' });
    rawNavigate(listTo);
  };
  const discard = () => setDraft(baseOf(item));
  const primary = isTpl ? { label: 'Save Changes', go: saveTemplate, disabled: !dirty }
    : saveMode === 'draft' ? null
    : { label: !dirty ? 'Save Changes' : saveMode === 'scheduled' ? 'Update Version ' + latest.version : 'Save as Version ' + (latest.version + 1), go: () => setSaving(saveMode), disabled: !dirty || blocked };

  const card = (key, title, opts = {}) => (
    <SbCard title={title} required={opts.required} missing={opts.required && opts.missing} onEdit={() => setDrawer(key)}>{opts.body}</SbCard>
  );
  const tip = blocked ? 'Fix ' + sbPlural(checks.errors.length, 'issue') + ' in Checks first.' : null;

  return (
    <div className="page chc cr sb">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Service Builder', to: SB_BASE }].concat(isTpl ? [{ label: 'Templates', to: SB_BASE + '/templates' }] : [])
        .concat([{ label: item.name || 'Untitled' }])} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{item.name || (isTpl ? 'Untitled Template' : 'Untitled Service')} {!isTpl && sbStatusBadge(status)}</h1>
          <div className="page-sub">
            {isTpl ? (item.source === 'implementation' ? 'Built by your implementation team. ' : 'Your agency’s template. ') + 'A starting point for new services; changing it doesn’t change services already made from it.'
              : (item.started_from ? (tplName ? 'Started from ' + tplName : 'Started from a template that’s since been deleted') : 'Built from scratch') + ' · created ' + fmtDate(item.created) + '.'}
          </div>
        </div>
        <span className="spacer" />
        {dirty && <span className="badge status-amber"><Icon name="edit" size={12} /> Unsaved changes</span>}
        {!isTpl && <SbPreviewLocked />}
        {isTpl && <Button variant="secondary" onClick={() => setUsingTpl(true)} disabled={dirty}>Use Template</Button>}
        <Button variant="ghost" onClick={discard} disabled={!dirty}>Discard</Button>
        {saveMode === 'draft' && <Button variant="secondary" onClick={saveDraft} disabled={!dirty}>Save Draft</Button>}
        {saveMode === 'draft' && <Tooltip label={tip} wide><Button variant="primary" disabled={blocked} onClick={() => setSaving('activate')}>Activate</Button></Tooltip>}
        {primary && <Tooltip label={dirty ? tip : null} wide><Button variant="primary" disabled={primary.disabled} onClick={primary.go}>{primary.label}</Button></Tooltip>}
      </div>

      {!isTpl && (
        <div className="sb-versionbar" role="status">
          <Icon name="uiDocumentBulletListClock" size={18} />
          <span className="sb-versionbar-text">
            {status === 'draft' ? <React.Fragment><b>Draft.</b> Not offered to staff yet. Activate it to choose the date it takes effect.</React.Fragment>
              : <React.Fragment>
                <b>Version {cur ? cur.version : latest.version}</b> in effect since {fmtDate((cur || latest).effective)}
                {next && <React.Fragment> · <b>Version {next.version}</b> takes effect {fmtDate(next.effective)}</React.Fragment>}
                {status === 'inactive' && ' · inactive, so staff can’t pick it'}
                {dirty && <span className="sb-versionbar-edit"> · {saveMode === 'scheduled' ? 'editing Version ' + latest.version : 'your changes will be Version ' + (latest.version + 1)}</span>}
              </React.Fragment>}
          </span>
          <span className="spacer" />
          {item.versions.length > 1 && <Button size="sm" variant="ghost" onClick={() => setHistory(true)}>History ({item.versions.length})</Button>}
        </div>
      )}

      <div className="cr-layout sb-layout">
        <div className="sb-main">
          <section className="panel chc-config">
            <div className="chc-sec">
              <h2 className="chc-sectitle">Basics</h2>
              <div className="sb-basics">
                <label className="form-field">
                  <span>{isTpl ? 'Template name' : 'Name, as staff see it'} <span className="ff-req"> *</span></span>
                  <div className={'form-input' + (!draft.name.trim() ? ' invalid' : '')}><input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></div>
                </label>
                {isTpl ? (
                  <label className="form-field"><span>Collection</span>
                    <div className="form-input"><input value={draft.collection} placeholder="e.g. Medicaid Outpatient" onChange={e => setDraft(d => ({ ...d, collection: e.target.value }))} /></div>
                  </label>
                ) : (
                  <label className="form-field sb-duration"><span>Default duration <span className="ff-req-txt">(optional)</span></span>
                    <TextIn value={cfg.duration_min == null ? '' : String(cfg.duration_min)} suffix="min" inputMode="numeric"
                      onChange={v => setCfg({ ...cfg, duration_min: v.replace(/\D/g, '') ? parseInt(v.replace(/\D/g, ''), 10) : null })} />
                  </label>
                )}
              </div>
              <label className="form-field"><span>Description, for admins <span className="ff-req-txt">(optional)</span></span>
                <div className="form-input"><input value={cfg.description} onChange={e => setCfg({ ...cfg, description: e.target.value })} /></div>
              </label>
            </div>
          </section>

          <section className="panel chc-config">
            <div className="chc-sec">
              <h2 className="chc-sectitle">Who and Where</h2>
              <div className="sb-cards">
                {card('roles', 'Roles', { required: !isTpl, missing: !cfg.roles.length, body: <p className="sb-card-text">{sbJoin(cfg.roles, 3, 'No roles yet')}</p> })}
                {card('programs', 'Programs', { required: !isTpl, missing: !cfg.programs.length, body: <p className="sb-card-text">{sbProgramsLabel(cfg.programs, 3) === 'None' ? 'No programs yet' : sbProgramsLabel(cfg.programs, 3)}</p> })}
                {card('sites', 'Sites', { body: <p className="sb-card-text">{cfg.sites.length ? sbJoin(cfg.sites.map(sbSiteName), 2) : 'Any site its programs run at'}</p> })}
              </div>
            </div>
          </section>

          <section className="panel chc-config">
            <div className="chc-sec">
              <h2 className="chc-sectitle">Billing</h2>
              <div className="sb-cards">
                {card('codes', 'Service Codes', { body: cfg.codes.length
                  ? <ul className="sb-card-list">{cfg.codes.map(c => <li key={c.code_id}><b>{sbCodeLabel(c)}</b> {SB_CODE[c.code_id] ? SB_CODE[c.code_id].description : ''}</li>)}</ul>
                  : <p className="sb-card-text">Not billed</p> })}
                {card('payors', 'Payors', { body: <p className="sb-card-text">{sbJoin(cfg.payors.map(p => (SB_PAYOR[p] || {}).name || p), 3, 'None')}</p> })}
                {card('funding', 'Funding', { body: <p className="sb-card-text">{sbJoin(cfg.funding.map(f => (SB_FUND[f] || {}).name || f), 3, 'None')}</p> })}
              </div>
            </div>
          </section>

          <section className="panel chc-config">
            <div className="chc-sec">
              <h2 className="chc-sectitle">Clinical</h2>
              <div className="sb-cards">
                {card('dx', 'Diagnoses', { body: <p className="sb-card-text">{(SB_DX[cfg.dx_set] || {}).name || 'None'}<span className="sb-card-sub">{(SB_DX[cfg.dx_set] || {}).codes}</span></p> })}
                {card('precedence', 'Diagnosis Precedence', { body: <p className="sb-card-text">{(SB_PREC[cfg.precedence] || {}).name || 'None'}</p> })}
                {card('sensitivity', 'Sensitivity', { body: <p className="sb-card-text">{cfg.sensitivity}</p> })}
              </div>
            </div>
          </section>

          <section className="panel chc-config">
            <div className="chc-sec">
              <h2 className="chc-sectitle">What Staff Complete</h2>
              <SbSteps cfg={cfg} rules={rules} onChange={setCfg} />
            </div>
            <div className="chc-sec">
              <h2 className="chc-sectitle">Service Deadline</h2>
              <SbDeadline cfg={cfg} rules={rules} onChange={setCfg} />
            </div>
            <div className="chc-sec sb-danger">
              {isTpl ? <Button size="sm" variant="ghost" onClick={remove}>Delete Template</Button>
                : status === 'draft' ? <Button size="sm" variant="ghost" onClick={remove}>Delete Draft</Button>
                : status === 'active' ? <Button size="sm" variant="ghost" onClick={() => setStatus('inactive')} disabled={dirty}>Make Inactive</Button>
                : <Button size="sm" variant="secondary" onClick={() => setStatus('active')} disabled={dirty}>Make Active Again</Button>}
              <span className="spacer" />
              {!isTpl && <Button size="sm" variant="ghost" onClick={saveAsTemplate}>Save as Template</Button>}
              {!isTpl && <Button size="sm" variant="ghost" onClick={duplicate}>Duplicate</Button>}
            </div>
          </section>
        </div>

        <aside className="sb-rail" aria-label="Checks">
          <section className="panel">
            <div className="chc-sec">
              <h2 className="chc-sectitle">Checks</h2>
              <SbChecksList checks={checks} />
            </div>
          </section>
        </aside>
      </div>

      {drawer && <SbDrawerFor which={drawer} cfg={cfg} onApply={setCfg} onClose={() => setDrawer(null)} />}
      {saving && <SbSaveVersionOverlay mode={saving} service={item} base={original.cfg} draft={draft} rules={rules} onSave={commit} onClose={() => setSaving(null)} />}
      {history && <SbHistoryOverlay service={item} rules={rules} onClose={() => setHistory(false)} />}
      {usingTpl && <NewServiceOverlay templateId={id} onClose={() => setUsingTpl(false)} />}
    </div>
  );
}
