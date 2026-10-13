/* ===== App chrome ================================================
   Top bar, client-context switcher, the persistent client banner, the clinical
   forms rail and the sign-in screen. ================================ */

/* Clinical forms rail — the module list from AxiomEHR, alphabetical, as in the
   product today. Names are product features, not client data. */
const CLINICAL_FORMS = [
  'ACE', 'AIMS', 'Allergy', 'Announcements Center', 'Appointments', 'ASAM', 'AUDIT',
  'CALOCUS', 'CINA', 'CIWA', 'Clinical Forms Search', 'Closure', 'Communications Center',
  'COT - Court Ordered Treatment', 'Cover Sheet', 'COWS', 'Crisis Intervention Relapse Plan',
  'Crisis Prevention Plan', 'CRM - Client Relationship Management', 'CYBHI', 'Daily Extract',
  'Dashboard', 'Data Import', 'Demographic', 'Detailed Columbia - Suicide Severity Rating Scale',
  'Diagnosis', 'Direct Messaging', 'Discharge Plan', 'Dynamic Form Builder', 'Dynamic Forms',
  'Dynamic Progress Notes', 'Dynamic Report', 'Dynamic Service Plan', 'eMar', 'Encounter Entry',
  'Engagement', 'Enrollment History', 'Flow Sheet', 'GAD-7', 'Group Note', 'Health Information',
  'Immunization', 'Informed Consent', 'Injection', 'Inpatient Note', 'Laboratory', 'LOCUS', 'MAT',
  'Nurse Progress Note', 'Patient Assignment', 'Payor Assignment', 'PC-PTSD', 'PCL5', 'PHQ',
  'PRAPARE', 'Prescription', 'Problem List', 'Programs', 'Progress Note', 'Psychiatric Evaluation',
  'Psychosocial Assessment Note', 'Psychotherapy Progress Note', 'Quality Management',
  'Scanned Documents', 'SDOH', 'Service Plan', 'Suicide Risk Screening', 'Support & Safety Plan',
  'Vitals', 'WHO - Assist', 'WRAP Meeting',
];

/* ---- Navigation model -------------------------------------------
   Shape and tokens come from the DS `vertical navigation` component set
   (4425:92142): a 230px rail, a 300px flyout, `.navigation item` at 12px
   padding, and `.flyout category` headers at 44px on surface/secondary.

   The Clients flyout is transcribed from get_design_context on 4425:92185.
   Documents / Reports / Billing / Admin were read from the DS Vertical
   Navigation page; re-verify their item lists against 4425:92214, :92243,
   :92272 and :92301 when the Testing file is the frontmost Figma tab.

   Category children map onto the module list this prototype already routes
   (CLIENT_MODULE_NAMES), so a leaf still opens the picker when no client is
   in context rather than adopting one. */
const NAV_SECTIONS = [
  { key: 'home', label: 'Home', icon: 'home', to: '/' },
  {
    key: 'clients', label: 'Clients', icon: 'clients',
    categories: [
      { label: 'Client Medical Area', items: ['Vitals', 'Allergy', 'Diagnosis', 'Problem List', 'Health Information', 'Immunization', 'Laboratory', 'Prescription', 'eMar', 'Injection', 'MAT', 'Flow Sheet'] },
      { label: 'Client Management', items: ['Demographic', 'Enrollment History', 'Programs', 'Payor Assignment', 'Patient Assignment', 'Engagement', 'Closure'] },
    ],
    links: ['Client List', 'Prospective Client Management'],
  },
  {
    key: 'documents', label: 'Documents', icon: 'documents',
    categories: [
      { label: 'Assessments', items: ['ACE', 'AIMS', 'ASAM', 'AUDIT', 'CALOCUS', 'CINA', 'CIWA', 'COWS', 'GAD-7', 'LOCUS', 'PC-PTSD', 'PCL5', 'PHQ', 'PRAPARE', 'SDOH', 'Suicide Risk Screening', 'WHO - Assist', 'Psychosocial Assessment Note', 'Psychiatric Evaluation'] },
      { label: 'Notes', items: ['Progress Note', 'Group Note', 'Nurse Progress Note', 'Inpatient Note', 'Dynamic Progress Notes', 'Psychotherapy Progress Note', 'Encounter Entry'] },
      { label: 'Plans', items: ['Service Plan', 'Dynamic Service Plan', 'Discharge Plan', 'Crisis Prevention Plan', 'Crisis Intervention Relapse Plan', 'Support & Safety Plan', 'WRAP Meeting'] },
    ],
    links: ['Clinical Forms Search', 'Other Forms', 'Scanned Documents'],
  },
  {
    key: 'reports', label: 'Reports', icon: 'reports',
    categories: [],
    links: ['Analytics', 'Dynamic Report Builder', 'Report History', 'Run Report'],
  },
  {
    key: 'billing', label: 'Billing', icon: 'billing',
    categories: [],
    links: ['Payment Management', 'Revenue Cycle Management (RCM)'],
  },
  {
    key: 'admin', label: 'Admin', icon: 'admin',
    categories: [
      { label: 'Builders', items: ['Dynamic Form Builder', 'Dynamic Forms', 'Dynamic Report'] },
    ],
    links: ['Announcement Centre', 'Daily Extract', 'Data Import', 'Encounter Form Management', 'Group Editor', 'HR', 'Patient/Employee Restriction', 'Program Management', 'Service Plan Field Manager', 'Specific Security', 'Support', 'User Interface Options'],
  },
];

/* The second rail section — `Landing Pages` in the component. Program shells,
   not client modules, so they never take a client with them. */
const NAV_LANDING = ['Foster Home', 'Inpatient Module', 'Residential'];

/* ---- Global search ---------------------------------------------
   DS `top navigation` → `Search w/prefix` (Radicle Design System, node
   1876:36155 on the ↪ Top Navigation page). The DS annotations are explicit
   and are implemented here rather than paraphrased:

     "Search: always include search to help users find resources and navigate"
     "Do not hide Search behind a button icon if there is enough space"
     "Always include placeholder text … give users hints about the content
      they're searching for and/or what parameters they can use"
     Anatomy: search icon · placeholder · container · trailing accessory ·
              input text · clear button

   So it is present on every screen, with or without a client. It searches
   clients *and* pages/modules, because a clinician navigating to "Vitals" and
   one looking up "Moreno" are the same gesture.

   Code Connect maps this node to `src/primitives/Search/Search.tsx`, which
   belongs to axiom-ehr-prototype and does not exist here — HANDOFF §1 says
   leave that mapping alone. This is the deliberate best-effort mirror the
   playbook calls for in that case, not div-soup: one component, DS tokens,
   tagged with its node id. */
const SEARCH_SCOPES = ['All', 'Clients', 'Pages'];

/* Everything reachable by name, flattened once. Categories contribute their
   children, not themselves — "Assessments" is a drawer, not a destination. */
const PAGE_INDEX = (() => {
  const out = [];
  const add = (label, where) => { if (!out.some(p => p.label === label)) out.push({ label, where }); };
  NAV_SECTIONS.forEach(s => {
    add(s.label, 'Navigation');
    (s.categories || []).forEach(cat => cat.items.forEach(i => add(i, s.label + ' › ' + cat.label)));
    (s.links || []).forEach(l => add(l, s.label));
  });
  NAV_LANDING.forEach(l => add(l, 'Landing Pages'));
  return out;
})();

function GlobalSearch() {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('All');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    const c = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', c);
    return () => document.removeEventListener('mousedown', c);
  }, []);

  const s = q.trim().toLowerCase();
  const clientHits = (scope === 'Pages' || !s) ? [] : CLIENTS.filter(x =>
    x.name.toLowerCase().indexOf(s) !== -1 ||
    x.mrn.toLowerCase().indexOf(s) !== -1 ||
    x.client_id.toLowerCase().indexOf(s) !== -1).slice(0, 5);
  const pageHits = (scope === 'Clients' || !s) ? [] : PAGE_INDEX.filter(p =>
    p.label.toLowerCase().indexOf(s) !== -1).slice(0, 6);

  const openModule = name => {
    const slug = slugify(name);
    if (!isClientModule(name)) return guard.go('/' + slug);
    if (guard.clientId) return guard.go('/chart/' + guard.clientId + '/' + slug, { client: guard.clientId });
    return guard.go('/module/' + slug);
  };
  const reset = () => { setQ(''); setOpen(false); };
  const clear = () => { setQ(''); if (inputRef.current) inputRef.current.focus(); };

  const hasResults = clientHits.length > 0 || pageHits.length > 0;
  return (
    <div className="gsearch" ref={ref} data-node-id="1876:36155">
      <div className="gsearch-box">
        {/* 3. Search w/prefix — the category prefix filter */}
        <label className="gsearch-scope">
          <span className="sr-only">Search scope</span>
          <select value={scope} onChange={e => setScope(e.target.value)} aria-label="Search scope">
            {SEARCH_SCOPES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <Icon name="chevronDown" size={14} />
        </label>
        <span className="gsearch-rule" aria-hidden="true" />
        <Icon name="search" size={18} className="gsearch-ico" />
        <input
          ref={inputRef}
          className="gsearch-input"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') reset(); }}
          placeholder="Search clients by name or MRN, or jump to a page"
          aria-label="Search clients, pages and modules"
          aria-expanded={open && hasResults}
        />
        {q && (
          <button className="icon-btn gsearch-clear" onClick={clear} aria-label="Clear search">
            <Icon name="close" size={14} />
          </button>
        )}
        <button className="icon-btn gsearch-mic" aria-label="Search by voice" title="Voice search — not wired up in this prototype">
          <Icon name="mic" size={18} />
        </button>
      </div>

      {open && s && (
        <div className="gsearch-pop" role="listbox" aria-label="Search results">
          {clientHits.length > 0 && (
            <div className="gsearch-group">
              <div className="gsearch-group-cap">Clients</div>
              {clientHits.map(x => (
                <button key={x.client_id} className="gsearch-item" role="option"
                  onClick={() => { reset(); if (x.client_id !== guard.clientId) guard.setClient(x.client_id); }}>
                  <Avatar name={x.name} size="S" />
                  <span className="gsearch-item-text">
                    <span className="gsearch-item-name">{x.name}</span>
                    <span className="gsearch-item-meta">DOB {fmtDate(x.dob)} · MRN {x.mrn} · {x.program}</span>
                  </span>
                  {x.client_id === guard.clientId && <span className="badge status-active">In context</span>}
                </button>
              ))}
            </div>
          )}
          {pageHits.length > 0 && (
            <div className="gsearch-group">
              <div className="gsearch-group-cap">Pages &amp; Modules</div>
              {pageHits.map(p => (
                <button key={p.label} className="gsearch-item" role="option"
                  onClick={() => { reset(); openModule(p.label); }}>
                  <span className="gsearch-item-ico"><Icon name="grid" size={16} /></span>
                  <span className="gsearch-item-text">
                    <span className="gsearch-item-name">{p.label}</span>
                    <span className="gsearch-item-meta">{p.where}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {!hasResults && <div className="gsearch-none">Nothing matches “{q}”.</div>}
        </div>
      )}
    </div>
  );
}

function TopNav({ onHamburger, navOpen, onPrefs }) {
  const guard = useGuard();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => { const c = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  return (
    <header className="topnav">
      <div className="tn-left">
        <button className={'hamburger' + (navOpen ? ' active' : '')} aria-label="Menu" aria-expanded={navOpen} onClick={onHamburger}><Icon name="menu" size={20} /></button>
        <button className="org" onClick={() => guard.go('/')} title={'Go to ' + AGENCY.name + ' home'}>
          <span className="logo-dot"><Icon name="plus" size={9} /></span> {AGENCY.name}
        </button>
        <GlobalSearch />
      </div>
      <div className="tn-right">
        <NotifBell />
        <a className="tn-link"><Icon name="calendar" size={16} /> Calendar</a>
        <a className="tn-link"><Icon name="messages" size={16} /> Messages</a>
        <div className="menu-anchor" ref={menuRef}>
          <button className="tn-avatar-btn" onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu">
            <Avatar name={ME.name} size="M" />
          </button>
          {menuOpen && (
            <div className="dropdown" role="menu">
              <div className="menu-head">
                <Avatar name={ME.name} size="M" />
                <div><div className="name">{ME.name}{ME.credentials ? ', ' + ME.credentials : ''}</div><div className="role">{ME.role}</div></div>
              </div>
              <button className="menu-item" onClick={() => { setMenuOpen(false); onPrefs(); }}><Icon name="palette" size={17} /> Preferences</button>
              <button className="menu-item"><Icon name="admin" size={17} /> Account settings</button>
              <button className="menu-item" onClick={() => { setMenuOpen(false); guard.signOut(); }}><Icon name="logout" size={17} /> Sign out</button>
            </div>
          )}
        </div>
        {/* The standalone build hands the logo over as a data URI; the dev
            build loads it from assets/. */}
        <img className="brand-logo" src={window.__AXIOM_LOGO || 'assets/radicle-health.svg'} alt="Radicle Health" />
      </div>
    </header>
  );
}

/* ---- Client page header ----------------------------------------
   Radicle DS `client page header`, node 8139:96518 — variants
   `has filter bar?=default` (8139:96530, expanded) and `=collapsed`
   (8139:96664). Icons are the component's own vectors (assets/ds-icons.js).

   PLACEMENT. Per artboard 4433:94068 this is not page content: the content
   container holds `breadcrumbs` then `client page header` at the full 1440,
   and only the *body* beneath it is inset (x=32, 1376 wide). So it is rendered
   by `ChartChrome` in the app shell, full-bleed, and it frames the page rather
   than sitting inside it.

   The tab pills appear on the expanded variant only. The DS was updated to
   drop them from the collapsed state.

   CONFIGURABLE. Which pills appear, whether the action row and the Clinical
   Info strip appear at all, and what each pill shows are all agency
   configuration now — see 15-uiconfig.jsx and Admin › User Interface Options.
   The header reads the resolved preset rather than a hard-coded list. */

/* The round buttons, then a divider, then one radius-xl button, then a
   divider, then Chat With Chart — the DS row shape. Which round buttons
   appear (and how many) is agency configuration now — `QUICK_ACTIONS_CATALOG`
   in 15-uiconfig.jsx is the full set an admin can choose from; a header shows
   whichever subset it was configured with, in the catalogue's order. The
   vectors are authoritative but the DS exports them as unnamed `<g id="icon">`,
   so these labels are read off the rendered design. They exist because the
   DS's own button docs require it: "Icon-only buttons must provide an
   accessible name via aria-label… describe the action, not the icon shape." */

/* Glyphs a clinician can pick from when naming a brand-new attribute. The four
   the DS frame shows, plus the general-purpose Fluent flags already bundled. */
const ATTR_ICONS = ['dsPeople', 'dsSyringe', 'dsWarning', 'dsGavel', 'flag', 'check', 'clients'];

/* Default glyph per attribute, matched on the name because this prototype's
   attributes come from the shared fixture vocabulary rather than the four the
   design frame happens to show. */
const attrIcon = (name = '') => {
  const n = name.toLowerCase();
  if (/allerg/.test(n)) return 'dsSyringe';
  if (/court|legal|guardian|probation|parole/.test(n)) return 'dsGavel';
  if (/ideation|suicid|risk|elope|aggress|self-harm/.test(n)) return 'dsWarning';
  return 'dsPeople';
};

/* ---- Manage attributes overlay ---------------------------------
   Opened from the pencil inside the attribute box. Pick from the agency's
   configured vocabulary, or name a new one and choose its glyph. Prototype
   scope: the selection lives in component state, nothing is written back. */
function AttributesOverlay({ client, selected, onClose, onSave }) {
  const [sel, setSel] = useState(() => new Set(selected.map(a => a.name)));
  const [custom, setCustom] = useState([]);
  const [draft, setDraft] = useState('');
  const [draftIcon, setDraftIcon] = useState(ATTR_ICONS[0]);
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const vocab = (RD.attributes || []).map(a => a.name);
  const toggle = n => setSel(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const addCustom = () => {
    const name = draft.trim();
    if (!name || sel.has(name)) return;
    setCustom(c => c.concat([{ name, icon: draftIcon }]));
    setSel(s => new Set(s).add(name));
    setDraft('');
  };
  const save = () => {
    const byName = {};
    custom.forEach(c => { byName[c.name] = c.icon; });
    onSave([...sel].map(name => ({ name, icon: byName[name] || attrIcon(name) })));
  };

  return ReactDOM.createPortal(
    <React.Fragment>
      <div className="modal-scrim" onClick={onClose} />
      <div className="attrmodal" role="dialog" aria-modal="true" aria-labelledby="attrmodal-title">
        <div className="intercept-head">
          <div className="modal-head-content">
            <h2 className="intercept-title" id="attrmodal-title">Manage Client Attributes</h2>
          </div>
          <div className="modal-head-actions">
            <button className="icon-btn modal-dismiss" aria-label="Close" onClick={onClose} data-node-id="2048:586">
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        <div className="info-banner" role="note">
          <Icon name="info" size={20} />
          <div>Attributes flag handling requirements on <b>{client.shortName}</b>’s chart. They are not diagnoses and nothing here changes clinical status.</div>
        </div>

        <div className="attrmodal-body">
          <div className="attrmodal-cap">Agency Attributes</div>
          <div className="attrmodal-list">
            {/* A div, not a label: `Checkbox` renders its own <label>, and
                nesting labels is invalid HTML that double-toggles in some
                browsers. The row owns the click and the box is
                pointer-events:none, so exactly one toggle fires wherever you
                hit it. */}
            {vocab.map(n => (
              <div key={n} className={'attrmodal-opt' + (sel.has(n) ? ' on' : '')} role="checkbox"
                aria-checked={sel.has(n)} tabIndex={0} onClick={() => toggle(n)}
                onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(n); } }}>
                <Checkbox checked={sel.has(n)} onChange={() => {}} ariaLabel={n} />
                <Icon name={attrIcon(n)} size={20} />
                <span>{n}</span>
              </div>
            ))}
            {custom.map(c => (
              <div key={c.name} className="attrmodal-opt on" role="checkbox"
                aria-checked={sel.has(c.name)} tabIndex={0} onClick={() => toggle(c.name)}
                onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(c.name); } }}>
                <Checkbox checked={sel.has(c.name)} onChange={() => {}} ariaLabel={c.name} />
                <Icon name={c.icon} size={20} />
                <span>{c.name}</span>
                <span className="badge status-info">New</span>
              </div>
            ))}
          </div>

          <div className="attrmodal-cap">Add a New Attribute</div>
          <div className="attrmodal-new">
            <div className="attrmodal-icons" role="radiogroup" aria-label="Attribute icon">
              {ATTR_ICONS.map(ic => (
                <button key={ic} type="button" role="radio" aria-checked={draftIcon === ic}
                  className={'attrmodal-ic' + (draftIcon === ic ? ' on' : '')}
                  aria-label={'Icon ' + ic} onClick={() => setDraftIcon(ic)}>
                  <Icon name={ic} size={20} />
                </button>
              ))}
            </div>
            <div className="form-input attrmodal-input">
              <input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                placeholder="Attribute name, e.g. Requires Wheelchair Access" aria-label="New attribute name" />
            </div>
            <Button variant="secondary" onClick={addCustom} disabled={!draft.trim()}>Add Attribute</Button>
          </div>
        </div>

        <div className="intercept-foot">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <span className="spacer" />
          <span className="attrmodal-count">{sel.size} selected</span>
          <Button variant="primary" onClick={save}>Save Attributes</Button>
        </div>
      </div>
    </React.Fragment>,
  document.body);
}

/* ---- Quick-view bodies -----------------------------------------
   One renderer per entry in QUICKVIEW_CATALOG. Each returns the columns that
   go inside the expanded header's detail row, so the row keeps the component's
   own rhythm — a 214px flags card, flexible `.cph-data` stacks, and the brand
   care-team box — whichever quick view is selected.

   Sub-options are honoured here, not just stored: "Active problems only"
   actually filters, and "Identifiers to display" actually decides the rows.
   A configuration screen whose switches do nothing teaches the wrong thing. */

function QvCol({ head, children, className }) {
  return (
    <div className={'cph-data' + (className ? ' ' + className : '')}>
      {head && <div className="cph-qv-head">{head}</div>}
      {children}
    </div>
  );
}
function QvRow({ k, v, icon, suffix, copy }) {
  return (
    <div className="cph-row">
      {icon && <Icon name={icon} size={20} className="cph-rowico" />}
      {k && <span className="cph-k">{k}:</span>}
      <span className="cph-v" title={typeof v === 'string' ? v : undefined}>{v == null || v === '' ? '—' : v}</span>
      {copy && <Icon name="dsDocCopy" size={20} className="cph-copy" />}
      {suffix && <span className="cph-suffix">{suffix}</span>}
    </div>
  );
}
/* A list entry: one line of substance, one of context. */
function QvItem({ name, meta, tag, tone }) {
  return (
    <div className="cph-qv-item">
      <div className="cph-qv-item-main">
        <span className="cph-qv-item-name" title={name}>{name}</span>
        {tag && <span className={'cph-qv-tag' + (tone ? ' ' + tone : '')}>{tag}</span>}
      </div>
      {meta && <div className="cph-qv-item-meta">{meta}</div>}
    </div>
  );
}
const QvEmpty = ({ children }) => <QvCol><div className="cph-qv-empty">{children}</div></QvCol>;

const GENERAL_FIELDS = {
  'Axiom ID': c => c.axiomId, 'CIN': c => c.cin, 'Shared Service ID': c => c.sharedServiceId,
  'MRN': c => c.mrn, 'Funding': c => c.funding, 'Residence': c => c.residence,
  'Housing Type': c => c.housingType, 'Primary Language': c => c.primary_language,
};
const GENERAL_COPYABLE = ['Axiom ID', 'CIN', 'MRN'];

function AttrBox({ shown, onEdit }) {
  return (
    <div className="cph-flags">
      <div className="cph-flags-list">
        {shown.map(a => <span key={a.name} className="cph-attr"><Icon name={a.icon} size={20} />{a.name}</span>)}
        {!shown.length && <span className="cph-attr cph-attr--none">No attributes on this chart</span>}
      </div>
      {/* Inside the box, per the design. */}
      <button className="icon-btn cph-pencil" aria-label="Manage Client Attributes" title="Manage Client Attributes" onClick={onEdit}>
        <Icon name="dsEdit" size={20} />
      </button>
    </div>
  );
}
function TeamBox({ team }) {
  return (
    <div className="cph-team">
      <div className="cph-team-head">Care Team ({team.length})</div>
      <div className="cph-team-grid">
        {team.map(t => (
          <div key={t.id} className="cph-member">
            <Avatar name={t.name} size="XS" />
            <div className="cph-member-text">
              <div className="cph-member-name">{t.name}</div>
              <div className="cph-member-role">{t.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickViewBody({ view, client, attrsShown, onEditAttrs, preview }) {
  /* Clinical views (allergies, medications, vitals, immunizations,
     injections, scored instruments) live in 32-quickviews.jsx. */
  if (view && isClinicalQV(view.key)) return <ClinicalQuickView view={view} client={client} preview={preview} />;
  const o = (view && view.options) || {};
  const cid = client.client_id;
  /* `client.team` lets a caller supply the care team directly rather than
     deriving it from the fixture staff pool — the admin header preview uses
     this for a fixed, obviously-fictional demo team so a config screen never
     surfaces a real staff assignment under a fake client. */
  const team = client.team || careTeam(cid);

  switch (view && view.key) {
    case 'general': {
      const fields = (o.fields || []).filter(f => GENERAL_FIELDS[f]);
      const half = Math.ceil(fields.length / 2);
      const cols = [fields.slice(0, half), fields.slice(half)].filter(a => a.length);
      return (
        <React.Fragment>
          {o.showAttributes && <AttrBox shown={attrsShown} onEdit={onEditAttrs} />}
          {cols.map((col, i) => (
            <QvCol key={i}>
              {col.map(f => <QvRow key={f} k={f} v={GENERAL_FIELDS[f](client)} copy={GENERAL_COPYABLE.indexOf(f) !== -1} />)}
            </QvCol>
          ))}
          {!fields.length && <QvEmpty>No identifiers selected for this header.</QvEmpty>}
          {o.showCareTeam && <TeamBox team={team} />}
        </React.Fragment>
      );
    }

    case 'enrollment': {
      const prg = PRG[client.programId];
      const start = _parse(client.enrollment_date);
      const days = start ? Math.round((TODAY - start) / 86400000) : null;
      /* One prior episode for roughly two clients in three — enough to show
         what the "include closed enrollments" switch does. Derived, like the
         rest of the episode data the fixture set does not carry. */
      const hadPrior = seed(cid + 'pe') % 3 !== 0;
      const priorEnd = addDays(start || TODAY, -(30 + seed(cid + 'pe1') % 400));
      const priorStart = addDays(priorEnd, -(120 + seed(cid + 'ps') % 300));
      const payors = (RD.payors || []).filter(p => p.client_id === cid);
      return (
        <React.Fragment>
          <QvCol head="Current episode">
            <QvRow k="Program" v={client.program} />
            <QvRow k="Modality" v={prg && prg.modality} />
            <QvRow k="Site" v={client.siteName} />
            <QvRow k="Enrolled" v={fmtDate(client.enrollment_date)} suffix={days != null ? days + ' days' : null} />
            <QvRow k="Status" v={client.status} />
          </QvCol>
          {o.showClosed && (
            <QvCol head="Closed enrollments">
              {hadPrior
                ? <QvItem name={client.program} meta={fmtDate(priorStart) + ' – ' + fmtDate(priorEnd)} tag="Closed" />
                : <div className="cph-qv-empty">No closed enrollments.</div>}
            </QvCol>
          )}
          {o.showPayor && (
            <QvCol head="Payor">
              {payors.length ? payors.map(p => (
                <QvItem key={p.assignment_id}
                  name={(PAYOR_PROVIDER[p.payor_provider_id] || {}).name || p.payor_provider_id}
                  meta={p.policy_type + ' · policy ' + (p.policy_number || '—') + ' · from ' + fmtDate(p.begin_date)}
                  tag={p.num_visits_authorized ? p.num_visits_authorized + ' visits auth.' : null} />
              )) : <div className="cph-qv-empty">No payor assignment on file.</div>}
            </QvCol>
          )}
        </React.Fragment>
      );
    }

    case 'contact': {
      const a = client.address || {};
      return (
        <React.Fragment>
          <QvCol head="Reach the client">
            <div className="cph-row"><Icon name="dsMail" size={20} className="cph-rowico" />
              <a className="cph-link" href={'mailto:' + client.email}>{client.email}</a></div>
            <div className="cph-row"><Icon name="dsPhone" size={20} className="cph-rowico" />
              <a className="cph-link" href={'tel:' + client.phone}>{client.phone}</a>
              <span className="cph-suffix">Text Enabled</span></div>
            {o.showPreferred && <QvRow k="Preferred method" v={seed(cid + 'pm') % 2 ? 'Phone call' : 'Text message'} />}
            {o.showPreferred && <QvRow k="Language" v={client.primary_language} />}
          </QvCol>
          {o.showAddress && (
            <QvCol head="Address">
              <QvRow k="Street" v={a.line1} />
              <QvRow k="City" v={[a.city, a.state, a.zip].filter(Boolean).join(', ')} />
              <QvRow k="Residence" v={client.residence} />
              <QvRow k="Housing Type" v={client.housingType} />
            </QvCol>
          )}
        </React.Fragment>
      );
    }

    case 'appointments': {
      const n = parseInt(o.count, 10) || 5;
      let appts = (RD.appointments || []).filter(x => x.client_id === cid)
        .map(x => ({ ...x, when: _parse(x.date), outcome: apptOutcome(x, TODAY) }))
        .filter(x => x.when);
      if (!o.includeMissed) appts = appts.filter(x => x.outcome !== 'No Show' && x.outcome !== 'Cancelled');
      const upcoming = appts.filter(x => x.when > TODAY).sort((x, y) => x.when - y.when).slice(0, n);
      const recent = appts.filter(x => x.when <= TODAY).sort((x, y) => y.when - x.when).slice(0, n);
      const row = x => (
        <QvItem key={x.appointment_id} name={x.appointment_reason || x.type}
          meta={fmtDate(x.date) + ' · ' + x.start_time + ' · ' + sName(x.staff_id)}
          tag={x.outcome === 'Scheduled' ? null : x.outcome}
          tone={x.outcome === 'No Show' ? 'is-warn' : null} />
      );
      return (
        <React.Fragment>
          <QvCol head="Upcoming">
            {upcoming.length ? upcoming.map(row) : <div className="cph-qv-empty">Nothing scheduled.</div>}
          </QvCol>
          <QvCol head="Recent">
            {recent.length ? recent.map(row) : <div className="cph-qv-empty">No past appointments.</div>}
          </QvCol>
        </React.Fragment>
      );
    }

    case 'notes': {
      const n = parseInt(o.count, 10) || 5;
      let docs = clientDocs(cid, 10);
      if (o.unsignedFirst) {
        const open = d => d.status !== 'Signed';
        docs = docs.filter(open).concat(docs.filter(d => !open(d)));
      }
      docs = docs.slice(0, n);
      const half = Math.ceil(docs.length / 2);
      return (
        <React.Fragment>
          {[docs.slice(0, half), docs.slice(half)].filter(c => c.length).map((col, i) => (
            <QvCol key={i} head={i === 0 ? 'Recent documentation' : ' '}>
              {col.map(d => (
                <QvItem key={d.id} name={d.name} meta={fmtDate(d.at) + ' · ' + d.by}
                  tag={d.status === 'Signed' ? null : d.status}
                  tone={d.status === 'Draft' ? 'is-warn' : null} />
              ))}
            </QvCol>
          ))}
          {!docs.length && <QvEmpty>No documentation on this chart.</QvEmpty>}
        </React.Fragment>
      );
    }

    case 'diagnoses': {
      const list = o.activeOnly ? client.diagnoses.filter(d => isActiveStatus(d.status)) : client.diagnoses;
      const half = Math.ceil(list.length / 2);
      if (!list.length) return <QvEmpty>{o.activeOnly ? 'No active diagnoses on this chart.' : 'No diagnoses on this chart.'}</QvEmpty>;
      return (
        <React.Fragment>
          {[list.slice(0, half), list.slice(half)].filter(c => c.length).map((col, i) => (
            <QvCol key={i} head={i === 0 ? (o.activeOnly ? 'Active diagnoses (' + list.length + ')' : 'Diagnoses (' + list.length + ')') : ' '}>
              {col.map(d => (
                <QvItem key={d.client_dx_id} name={(o.showCodes ? d.icd10 + ' — ' : '') + d.description}
                  meta={d.precedence + ' · onset ' + fmtDate(d.onset_date)} tag={d.status} />
              ))}
            </QvCol>
          ))}
        </React.Fragment>
      );
    }

    case 'problems': {
      const list = o.activeOnly ? client.problems.filter(p => isActiveStatus(p.status)) : client.problems;
      const half = Math.ceil(list.length / 2);
      if (!list.length) return <QvEmpty>{o.activeOnly ? 'No active problems on this chart.' : 'No problems on this chart.'}</QvEmpty>;
      return (
        <React.Fragment>
          {[list.slice(0, half), list.slice(half)].filter(c => c.length).map((col, i) => (
            <QvCol key={i} head={i === 0 ? (o.activeOnly ? 'Active problems (' + list.length + ')' : 'Problem list (' + list.length + ')') : ' '}>
              {col.map(p => (
                <QvItem key={p.client_problem_id} name={p.name}
                  meta={[o.showCategory ? p.category : null, 'onset ' + fmtDate(p.onset_date)].filter(Boolean).join(' · ')}
                  tag={p.status} />
              ))}
            </QvCol>
          ))}
        </React.Fragment>
      );
    }

    case 'support': {
      let list = supportContacts(client);
      if (o.consentOnly) list = list.filter(s => s.release);
      return (
        <React.Fragment>
          <QvCol head="Support contacts">
            {list.length ? list.map(s => (
              <QvItem key={s.name} name={s.name}
                meta={[o.showRelationship ? s.role : null, s.emergency ? 'Emergency contact' : null].filter(Boolean).join(' · ')}
                tag={s.release ? 'Release on file' : 'No release'}
                tone={s.release ? null : 'is-warn'} />
            )) : <div className="cph-qv-empty">No contacts with a release on file.</div>}
          </QvCol>
          <TeamBox team={team} />
        </React.Fragment>
      );
    }

    case 'assessments': {
      const n = parseInt(o.count, 10) || 3;
      const cat = ((RD.assessments || {}).instruments) || [];
      const results = ((RD.assessments || {}).sample_results) || [];
      /* Same seed key as the Client Summary tab's due list, so the header and
         the page agree about which instruments this client is on. */
      const list = pick(cat, cid + 'due', Math.min(n, cat.length));
      if (!list.length) return <QvEmpty>No assessment instruments configured.</QvEmpty>;
      return (
        <QvCol head="Assessments">
          {list.map(a => {
            const every = cadenceDays(a.typical_cadence) || 180;
            const last = addDays(TODAY, -(every - (seed(cid + a.assessment_id) % 40) + 20));
            const next = addDays(last, every);
            const days = Math.round((next - TODAY) / 86400000);
            const score = results.find(r => r.client_id === cid && r.assessment_id === a.assessment_id);
            return (
              <QvItem key={a.assessment_id} name={a.name}
                meta={(o.showScores && score ? 'Score ' + score.score + ' · ' + score.interpretation + ' · ' : '')
                  + 'last ' + fmtDate(last)}
                tag={days < 0 ? Math.abs(days) + ' days overdue' : 'due in ' + days + ' days'}
                tone={days < 0 ? 'is-warn' : null} />
            );
          })}
        </QvCol>
      );
    }

    case 'incidents':
      return (
        <QvCol head={'Incidents · last ' + (o.windowDays || '90 days')}>
          <div className="cph-qv-empty">No reportable incidents in this window.</div>
          <div className="cph-qv-note">Incident records are out of scope for this prototype — the option is here to show the configuration, not the data.</div>
        </QvCol>
      );

    case 'demographics':
      return (
        <React.Fragment>
          <QvCol head="Demographics">
            <QvRow k="Gender" v={client.gender} />
            <QvRow k="Pronouns" v={client.pronouns} />
            <QvRow k="Date of birth" v={fmtDate(client.dob) + ' (' + client.age + ')'} />
            {o.showRaceEthnicity && <QvRow k="Race" v={client.race} />}
          </QvCol>
          <QvCol head=" ">
            {o.showRaceEthnicity && <QvRow k="Ethnicity" v={client.ethnicity} />}
            {o.showLanguage && <QvRow k="Language" v={client.primary_language} />}
            {o.showLanguage && <QvRow k="Interpreter" v={client.primary_language === 'English' ? 'Not required' : 'Required'} />}
            <QvRow k="MRN" v={client.mrn} />
          </QvCol>
        </React.Fragment>
      );

    default:
      return <QvEmpty>This quick view is not built out in the prototype.</QvEmpty>;
  }
}

/* ---- Quick-view pill pager ----------------------------------------
   The pills get a fixed share of the header: up to two rows. Past that they
   page — previous/next arrows move between sets in the admin's order, so a
   header can carry every quick view production offers without the header
   growing. Pages are computed against a hidden mirror of every pill, so
   nothing is painted mid-reflow; the page holding the active quick view is
   always the one shown. */
function PillPager({ views, active, onSelect }) {
  const wrapRef = useRef(null), mirrorRef = useRef(null), arrowsRef = useRef(null);
  const [pages, setPages] = useState([views.map((_, i) => i)]);
  const [page, setPage] = useState(0);
  const GAP = 8;                 /* .cph-tabs gap (spacing/xs) */
  const keySig = views.map(v => v.key).join('|');

  const measure = useCallback(() => {
    const wrap = wrapRef.current, mirror = mirrorRef.current;
    if (!wrap || !mirror) return;
    const widths = Array.prototype.map.call(mirror.children, c => c.offsetWidth);
    const paginate = budget => {
      const out = []; let cur = [], row = 1, x = 0;
      widths.forEach((w, i) => {
        const need = cur.length && x ? x + GAP + w : w;
        if (need <= budget || !cur.length) { cur.push(i); x = need; }
        else if (row < 2) { row++; cur.push(i); x = w; }
        else { out.push(cur); cur = [i]; row = 1; x = w; }
      });
      if (cur.length) out.push(cur);
      return out;
    };
    const full = wrap.clientWidth;
    let p = paginate(full);
    if (p.length > 1) p = paginate(full - ((arrowsRef.current && arrowsRef.current.offsetWidth) || 104) - GAP);
    setPages(p);
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure, keySig]);

  /* Keep the active pill on screen — after a resize, or when the admin's
     order changes underneath it. */
  useEffect(() => {
    const at = views.findIndex(v => v.key === active);
    const p = pages.findIndex(pg => pg.indexOf(at) !== -1);
    if (p !== -1 && p !== page) setPage(p);
    else if (page >= pages.length) setPage(0);
  }, [active, pages]);

  const shown = pages[Math.min(page, pages.length - 1)] || [];
  const go = d => {
    const next = Math.max(0, Math.min(pages.length - 1, page + d));
    /* Paging browses; it doesn't change which quick view is open below. The
       open one stays selected until the clinician picks another pill. */
    setPage(next);
  };
  const label = qv => (QV_BY_KEY[qv.key] || { label: qv.key }).label;
  return (
    <div className="cph-pager" ref={wrapRef}>
      <div className="cph-tabs cph-pager-mirror" ref={mirrorRef} aria-hidden="true">
        {views.map(qv => <span key={qv.key} className="cph-pill">{label(qv)}</span>)}
      </div>
      <div className="cph-tabs cph-pager-rows" role="tablist">
        {shown.map(i => {
          const qv = views[i];
          return (
            <button key={qv.key} role="tab" aria-selected={active === qv.key}
              className={'cph-pill' + (active === qv.key ? ' selected' : '')}
              onClick={() => onSelect(qv.key)}>{label(qv)}</button>
          );
        })}
      </div>
      {pages.length > 1 && (
        <div className="cph-pager-arrows" ref={arrowsRef}>
          <Tooltip label="Previous quick views">
            <button className="icon-btn" aria-label="Previous quick views" disabled={page === 0} onClick={() => go(-1)}>
              <Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </Tooltip>
          <span className="cph-pager-count" aria-live="polite">{page + 1} of {pages.length}</span>
          <Tooltip label="More quick views">
            <button className="icon-btn" aria-label="More quick views" disabled={page >= pages.length - 1} onClick={() => go(1)}>
              <Icon name="chevronRight" size={18} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/* `preset` overrides the resolved one — that is how the Admin configuration
   page previews a draft with the real component instead of a mock of it. */
function ClientPageHeader({ client, preset, preview }) {
  const ui = useUIConfig();
  const header = preset || (ui && ui.header) || SEED_CONFIG.presets[0];
  const views = (header.quickViews && header.quickViews.length) ? header.quickViews : [makeView('general')];
  /* Collapsed by default: expanded is 410px in the design, which is a lot of
     chart to spend before the clinician has read anything. The clinician can
     change that in Preferences; a wide monitor makes the trade different. */
  const collapsedDefault = preview ? false : (ui && ui.prefs ? ui.prefs.collapsedByDefault !== false : true);
  const [expanded, setExpanded] = useState(!collapsedDefault);
  const [tab, setTab] = useState(views[0].key);
  const [editing, setEditing] = useState(false);
  const [attrs, setAttrs] = useState(null);   // null = use the client's own
  /* The strip reads the same records as the quick views, so a vitals reading
     or allergy added from the header shows up here at once. */
  useRecordsVersion();
  const allVitals = getVitals(client);
  const v = allVitals[0] || client.vitals;
  const shown = attrs || client.attrs.map(a => ({ name: a.name, icon: attrIcon(a.name) }));

  /* A new chart returns to the clinician's default and forgets any local
     attribute edits. */
  useEffect(() => { setExpanded(!collapsedDefault); setAttrs(null); }, [client.client_id, collapsedDefault]);
  /* An admin can remove the quick view somebody is standing on. Fall back to
     the first one rather than rendering an empty detail row. */
  useEffect(() => {
    if (!views.some(x => x.key === tab)) setTab(views[0].key);
  }, [views, tab]);
  const activeView = views.find(x => x.key === tab) || views[0];

  /* Expanded/collapsed is the clinician's choice and nothing else changes it.
     Scrolling used to fold the header automatically; it was removed because
     the header moving on its own while you read is more disruptive than the
     height it saves. The header still pins under the top bar. */

  const clinicalInfo = [
    { label: 'Weight', value: v ? v.weight_lbs + ' Lbs' : '—' },
    { label: 'Height', value: v ? Math.floor(v.height_in / 12) + 'ft, ' + (v.height_in % 12) + 'in' : '—' },
    { label: 'BMI', value: v ? v.bmi : '—' },
    { label: 'Blood Pressure', value: v ? v.bp_systolic + '/' + v.bp_diastolic : '—' },
    { count: 'Allergies (' + getAllergies(client).filter(a => (a.status || 'Active') === 'Active').length + ')' },
    { count: 'Vitals (' + allVitals.length + ')' },
    { count: 'Problems List (' + client.problems.length + ')' },
    { count: 'Current Meds (' + getMeds(client).filter(m => m.status === 'Active').length + ')' },
    /* The DS frame labels this "Biological Sex" and its value is the one item
       in the row rendered Regular rather than Medium. */
    { label: 'Biological Sex', value: client.gender, regularValue: true },
    { count: 'Work list' },
  ];

  return (
    <section className={'cph' + (expanded ? ' cph--expanded' : '')} data-node-id="8139:96518"
      aria-label={'Client header — ' + client.displayName}>
      <div className="cph-top">
        <div className="cph-identity">
          <Avatar name={client.name} size="L" />
          <div className="cph-demo">
            <div className="cph-nameline">
              <h1 className="cph-name">{client.displayName}</h1>
              <span className={'cph-status cph-status--' + (client.status === 'Active' ? 'success' : 'inactive')}>{client.status}</span>
            </div>
            <div className="cph-pronouns">{client.pronouns}</div>
            <div className="cph-dob"><b>DOB:</b> <span>{fmtDate(client.dob)}, {client.age} yr old</span></div>
          </div>
        </div>

        <div className="cph-nav">
          <div className="cph-actions">
            {/* Client Notes is always here, ahead of the configurable actions —
                a care-team note nobody sees is a care risk, not a layout
                preference, so no header configuration can remove it. */}
            <ClientNotesButton client={client} preview={preview} />
            {header.showActions && (
              <React.Fragment>
                <span className="cph-divider" aria-hidden="true" />
                {QUICK_ACTIONS_CATALOG.filter(a => (header.actions || DEFAULT_ACTIONS).indexOf(a.key) !== -1).map(a => (
                  <Tooltip key={a.key} label={a.label}>
                    <button className="cph-icon-btn" aria-label={a.label}><Icon name={a.icon} size={20} /></button>
                  </Tooltip>
                ))}
                <span className="cph-divider" aria-hidden="true" />
                <Tooltip label="More Actions">
                  <button className="cph-icon-btn cph-icon-btn--sq" aria-label="More Actions"><Icon name="dsUtil6" size={20} /></button>
                </Tooltip>
                <span className="cph-divider" aria-hidden="true" />
                <button className="cph-chat">
                  <Icon name="dsSparkle" size={20} />
                  <span>Chat With Chart</span>
                </button>
              </React.Fragment>
            )}
          </div>

          <div className="cph-navrow">
            {/* Pills are an expanded-state affordance only. */}
            {expanded ? <PillPager views={views} active={tab} onSelect={setTab} /> : <span className="spacer" />}
            <button className="cph-toggle" aria-expanded={expanded} onClick={() => setExpanded(x => !x)}>
              <span>{expanded ? 'Collapse Details' : 'Expand Details'}</span>
              <Icon name={expanded ? 'dsChevUp' : 'dsChevDown'} size={20} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="cph-detail">
          <div className="cph-detail-inner">
            <QuickViewBody view={activeView} client={client} attrsShown={shown} preview={preview}
              onEditAttrs={() => setEditing(true)} />
          </div>
        </div>
      )}

      {/* Clinical Info strip — present in both variants in the DS, and the
          first thing a children's-services agency asks to turn off. Separators
          are real 1px borders on the items, not a gap, per the component. */}
      {header.showClinicalStrip && (
        <div className="cph-clinical">
          <span className="cph-clinical-label">Clinical Info:</span>
          <div className="cph-clinical-items">
            {clinicalInfo.map((it, i) => (
              <span key={i} className="cph-ci">
                {it.count
                  ? <span className="cph-ci-count">{it.count}</span>
                  : <React.Fragment>
                      <span className="cph-ci-k">{it.label}:</span>
                      <span className={it.regularValue ? 'cph-ci-v cph-ci-v--regular' : 'cph-ci-v'}>{it.value}</span>
                    </React.Fragment>}
              </span>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <AttributesOverlay client={client} selected={shown} onClose={() => setEditing(false)}
          onSave={next => { setAttrs(next); setEditing(false); }} />
      )}
    </section>
  );
}

/* ---- Breadcrumbs ------------------------------------------------
   One trail component for every page that needs one. Each crumb but the last
   navigates through the guard, so a trail can never sidestep an intercept;
   the last is the current page and is deliberately not a link. */
function Breadcrumbs({ items }) {
  const guard = useGuard();
  const path = usePath();
  const go = it => {
    if (!it.to) return;
    const opts = it.client !== undefined ? { client: it.client } : {};
    if (it.to !== path) return guard.go(it.to, opts);
    /* Already here. A chart crumb means "this client's summary": on another
       tab, go back to it; on the summary, reload it. Either way it runs
       through the guard, so unsaved work is still intercepted. */
    if (it.chartHome && guard.chartTab && guard.chartTab !== CHART_HOME_TAB)
      return window.dispatchEvent(new Event('axiom-chart-home'));
    guard.request({ to: it.to, ...opts, onCommit: requestPageReload });
  };
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={it.label + i}>
            {i > 0 && <span className="sep"><Icon name="chevronRight" size={13} /></span>}
            {last || !it.to
              ? <span className={last ? 'current' : ''} aria-current={last ? 'page' : undefined}>{it.label}</span>
              : <button type="button" className="crumb-link" onClick={() => go(it)}>{it.label}</button>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ---- Chart chrome ----------------------------------------------
   Breadcrumbs + client header, in the order artboard 4433:94068 puts them and
   at the content container's full width. Lives in the app shell rather than
   the page so it frames the content and can pin to the top on scroll. */
function ChartChrome() {
  const guard = useGuard();
  const path = usePath();
  const c = guard.client;
  if (!c) return null;
  if (clientIdForPath(path) !== c.client_id) return null;
  return (
    <div className="chart-chrome">
      {/* Clients › <client> › <active tab>. The trail has to describe how you
          actually got here: you went straight to the chart and you are standing
          on one of its tabs. "Client Medical Area" was wrong — that is a
          sibling destination, not an ancestor of this chart. */}
      <Breadcrumbs items={[
        { label: 'Clients', to: '/clients' },
        { label: c.name, to: '/chart/' + c.client_id, client: c.client_id, chartHome: true },
        { label: guard.chartTab || CHART_HOME_TAB },
      ]} />
      <ClientPageHeader client={c} />
    </div>
  );
}

/* ---- Left navigation -------------------------------------------
   Rail + flyout, per the DS component set. Selecting a rail section with
   children opens the flyout beside it rather than navigating; the flyout's
   own categories expand in place. Only leaves navigate. */
function LeftNav({ open, navRef }) {
  const guard = useGuard();
  const path = usePath();
  const [section, setSection] = useState(null);
  const [cats, setCats] = useState({});
  /* Closing the rail also collapses the flyout, so reopening starts clean
     rather than restoring whichever section was last poked at. Navigating
     does not close the rail — the clinician's own "keep navigation open"
     expectation applies to every click, not just this one. */
  useEffect(() => { if (!open) setSection(null); }, [open]);

  /* Only the flyout — the category panel beside the rail — behaves like a
     transient overlay. The rail itself never auto-closes; it is scoped to
     `section` so it can never fire while no flyout is open, and it targets
     `navRef`, which wraps the rail *and* the flyout, so switching from one
     open section to another (a genuine in-nav click) does not register as
     "outside" and briefly flash-close the flyout. */
  useEffect(() => {
    if (!section) return;
    const onDown = e => { if (navRef.current && !navRef.current.contains(e.target)) setSection(null); };
    const onKey = e => { if (e.key === 'Escape') setSection(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [section, navRef]);

  /* A client-specific module never adopts a client to have something to show.
     With a chart already in context it opens inside that chart; without one it
     opens empty, on a picker scoped to this clinician's caseload. */
  const openModule = name => {
    const slug = slugify(name);
    if (!isClientModule(name)) return guard.go('/' + slug);
    if (guard.clientId) return guard.go('/chart/' + guard.clientId + '/' + slug, { client: guard.clientId });
    return guard.go('/module/' + slug);
  };

  const current = NAV_SECTIONS.find(s => s.key === section) || null;
  const toggleCat = label => setCats(c => ({ ...c, [label]: !c[label] }));

  return (
    <nav ref={navRef} className={'leftnav' + (open ? ' open' : '') + (current ? ' flyout-open' : '')}
      aria-hidden={!open} aria-label="Main" data-node-id="4425:92142">
      <div className="leftnav-rail">
        <div className="ln-body">
          {NAV_SECTIONS.map(s => {
            const hasChildren = !s.to;
            const selected = hasChildren ? section === s.key : path === s.to;
            return (
              <button key={s.key} className={'ln-item' + (selected ? ' selected' : '')}
                aria-expanded={hasChildren ? section === s.key : undefined}
                onClick={() => { if (!hasChildren) { setSection(null); return guard.go(s.to); } setSection(k => k === s.key ? null : s.key); }}>
                <span className="ln-left"><Icon name={s.icon} size={24} /><span className="ln-label">{s.label}</span></span>
                {hasChildren && <Icon name="chevronRight" size={20} className="ln-chev" />}
              </button>
            );
          })}
        </div>
        <div className="leftnav-divider" />
        <div className="ln-body ln-landing">
          {NAV_LANDING.map(l => (
            <button key={l} className="ln-item ln-item--plain" onClick={() => { setSection(null); guard.go('/' + slugify(l)); }}>
              <span className="ln-label">{l}</span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="leftnav-flyout" data-node-id="4425:92185">
          <div className="ln-fly-head">
            <Icon name={current.icon} size={24} />
            <span>{current.label}</span>
          </div>
          <div className="ln-fly-list">
            {current.categories.map(cat => (
              <div key={cat.label} className="ln-cat-wrap">
                <button className="ln-cat" aria-expanded={!!cats[cat.label]} onClick={() => toggleCat(cat.label)}>
                  <span>{cat.label}</span>
                  <Icon name={cats[cat.label] ? 'chevronUp' : 'chevronDown'} size={20} />
                </button>
                {cats[cat.label] && (
                  <div className="ln-cat-items">
                    {cat.items.map(i => (
                      <button key={i} className="ln-fly-link ln-fly-link--nested" onClick={() => { setSection(null); openModule(i); }}>{i}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {current.links.map(l => (
              <button key={l} className="ln-fly-link" onClick={() => { setSection(null); openModule(l); }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ---- Preferences flyout ----------------------------------------
   The user half of the two-level UI configuration. The admin decides which
   client headers exist and which role gets which (Admin › User Interface
   Options — not reachable from here); the individual just picks which of the
   admin's headers they want, and whether it opens collapsed. One dropdown: the
   selected value already says which header is in effect, so nothing here
   needs to repeat that as a subheading or a separate "currently showing"
   line. */
/* Everything in the body is a draft until Save — picking a theme swatch or a
   different client header doesn't touch the live app until you commit it, and
   Cancel (or the scrim, or Escape) walks away with nothing changed. Hooks run
   unconditionally above the `open` check, since the component stays mounted
   (just rendering null) between opens rather than remounting fresh each time —
   without the resync effect a second open would show whatever was drafted and
   abandoned the first time, not the app's actual current settings. */
function PreferencesFlyout({ open, onClose }) {
  const guardP = useGuard();
  const themeCtx = useTheme();
  const ui = useUIConfig();
  const draftOf = () => ({
    mode: themeCtx.mode, theme: themeCtx.theme,
    headerPreset: ui.prefs.headerPreset, collapsedByDefault: ui.prefs.collapsedByDefault !== false,
  });
  const [draft, setDraft] = useState(draftOf);
  useEffect(() => { if (open) setDraft(draftOf()); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;

  const { presets, prefs, roleAssigned } = ui;
  const patch = obj => setDraft(d => ({ ...d, ...obj }));
  const dirty = draft.mode !== themeCtx.mode || draft.theme !== themeCtx.theme
    || draft.headerPreset !== prefs.headerPreset
    || draft.collapsedByDefault !== (prefs.collapsedByDefault !== false);

  /* Only a header actually in circulation can be picked here — one an admin
     has switched to inactive (often to test it before rolling it out) is not
     ready for a staff member to choose yet, even though the admin can still
     reach it directly from Admin › User Interface Options to preview it. */
  const activePresets = presets.filter(p => p.status !== 'inactive');
  const ROLE_OPTION = 'Use my role’s header (' + roleAssigned.name + ')';
  const headerOptions = [ROLE_OPTION].concat(activePresets.map(p => p.name));
  const selectedActive = activePresets.find(p => p.id === draft.headerPreset);
  const headerValue = draft.headerPreset === 'auto' || !selectedActive ? ROLE_OPTION : selectedActive.name;
  const pickHeader = label => {
    if (label === ROLE_OPTION) return patch({ headerPreset: 'auto' });
    const p = activePresets.find(x => x.name === label);
    if (p) patch({ headerPreset: p.id });
  };

  const save = () => {
    themeCtx.setMode(draft.mode);
    themeCtx.setTheme(draft.theme);
    ui.setPrefs({ headerPreset: draft.headerPreset, collapsedByDefault: draft.collapsedByDefault });
    onClose();
  };

  return (
    <React.Fragment>
      <div className="flyout-scrim" onClick={onClose} />
      <aside className="flyout" role="dialog" aria-label="Preferences">
        <header>
          <h2>Preferences</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </header>
        <div className="body">
          <div className="switch-row"><span>Dark mode</span><Toggle checked={draft.mode === 'dark'} onChange={v => patch({ mode: v ? 'dark' : 'light' })} /></div>

          <div className="pref-label">Client Header</div>
          <Dropdown id="pref-header-select" value={headerValue} options={headerOptions} onChange={pickHeader} />
          {/* Checked by default: the expanded header is 410px, which is a lot
              of chart to spend before you have read anything. On a tall monitor
              that trade goes the other way, so it is a choice, not a rule. */}
          <div className="pref-check">
            <Checkbox checked={draft.collapsedByDefault}
              onChange={v => patch({ collapsedByDefault: v })}
              label="Collapsed by Default" />
            <div className="pref-note pref-note--tight">
              Opens every chart with the header collapsed. You can still expand it on any chart.
            </div>
          </div>

          <div className="pref-label">Theme</div>
          <div className="swatches">
            {themeCtx.themes.map(t => (
              <button key={t.slug} className={'swatch' + (t.slug === draft.theme ? ' active' : '')} title={t.name} aria-label={t.name}
                style={{ background: t.swatch }} onClick={() => patch({ theme: t.slug })} />
            ))}
          </div>

          <div className="pref-label">Notifications</div>
          <button className="lnk pref-link" onClick={() => { onClose(); guardP.go('/notifications/preferences'); }}>
            Delivery preferences <Icon name="chevronRight" size={14} />
          </button>
          <div className="pref-note pref-note--tight">What reaches you in AxiomEHR, the mobile app, email and text.</div>
        </div>
        <footer className="foot">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!dirty}>Save Preferences</Button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

function AppShell({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  const reload = usePageReload();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const navRef = useRef(null);

  /* The rail (first panel) is not an overlay — it stays open across clicks
     and navigation, exactly like the clinician's own "keep navigation open"
     expectation, and the ONLY thing that closes it is the hamburger. There is
     deliberately no click-away or Escape handling here: that was the earlier
     bug — an outside mousedown closed the rail (shifting the page content
     back under the cursor) a beat before the click's own mouseup landed, so
     the click that was supposed to both close the rail's context and press a
     button underneath it did the first and silently ate the second. Only the
     second panel — the section flyout beside the rail — behaves like a
     transient overlay, and that click-away lives in `LeftNav` itself, scoped
     to the flyout alone. */
  return (
    <div className={'app' + (navOpen ? ' nav-open' : '')}>
      <TopNav navOpen={navOpen}
        onHamburger={() => setNavOpen(o => !o)} onPrefs={() => setPrefsOpen(true)} />
      {/* Breadcrumbs + client header. Artboard 4433:94068 puts these in the
          content container at its full width, above the inset page body — so
          they frame the page rather than sitting inside it. */}
      <ChartChrome />
      <div className="app-body">
        <div className="main">
          <main className={'content' + (reload.busy ? ' is-reloading' : '')} aria-busy={reload.busy || undefined}>
            {reload.busy && <div className="page-reload"><Spinner label="Refreshing…" /></div>}
            <React.Fragment key={reload.key}>{children}</React.Fragment>
          </main>
        </div>
      </div>
      <LeftNav open={navOpen} navRef={navRef} />
      <PreferencesFlyout open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

/* ---- Sign in ----------------------------------------------------
   Exists purely to demonstrate the session rule: signing back in never
   restores the client you were in before. */
function SignIn() {
  const guard = useGuard();
  return (
    <div className="signin">
      <form className="signin-card" onSubmit={e => { e.preventDefault(); guard.signIn(); }}>
        <div className="signin-brand"><span className="logo-dot"><Icon name="plus" size={11} /></span> {AGENCY.product}</div>
        <h1 className="signin-title">Sign In to {AGENCY.name}</h1>
        <p className="signin-sub">You have been signed out. Client context was cleared.</p>
        <label className="form-field"><span>Username</span>
          <div className="form-input"><Icon name="user" size={16} /><input defaultValue={ME.name.toLowerCase().replace(' ', '.')} readOnly /></div>
        </label>
        <label className="form-field"><span>Password</span>
          <div className="form-input"><Icon name="lock" size={16} /><input type="password" defaultValue="demo-prototype" readOnly /></div>
        </label>
        <Button variant="primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Sign In</Button>
        <p className="signin-note">Prototype — no authentication, no real credentials, no real client data.</p>
      </form>
    </div>
  );
}
