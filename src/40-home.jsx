/* ===== Non-client screens ========================================
   Home is client-free: no chart, no client header. It does not announce that
   fact — an empty client context is ordinary EHR behaviour, and a callout
   explaining it every time is noise. The absence of the header IS the signal.

   The dashboard follows artboard 4090:39455: nine accordion modules on a
   two-column grid, three of them full width. Deliberately close to the
   AxiomEHR home a case manager already knows, so the prototype's argument is
   about client context and discharge — not about a homepage nobody recognises.
   ================================================================ */

/* Small shared table for the dashboard modules. The real DataTable is heavier
   than these summary lists need. */
function MiniTable({ cols, rows, empty, dense }) {
  if (!rows.length) return <div className="ov-empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className={'data-table' + (dense ? ' compact' : '')}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={c.right ? { textAlign: 'right' } : null}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c, j) => <td key={j} style={c.right ? { textAlign: 'right' } : null}>{c.cell(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* A compact filter row — the artboard puts one at the top of most modules. */
function ModuleFilters({ children }) {
  return <div className="mod-filters">{children}</div>;
}
function MiniSearch({ value, onChange, placeholder }) {
  return (
    <span className="mini-search">
      <Icon name="search" size={16} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Search...'} aria-label={placeholder || 'Search'} />
    </span>
  );
}

/* ---- 1. My Clients ---------------------------------------------- */
function MyClientsModule() {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const rows = MY_CASELOAD.filter(c => !q || (c.name + ' ' + c.mrn + ' ' + c.program).toLowerCase().indexOf(q.toLowerCase()) !== -1);
  return (
    <Panel title="My Clients" action={<button className="lnk" onClick={() => guard.go('/clients')}>View All Clients</button>}>
      <ModuleFilters>
        <MiniSearch value={q} onChange={setQ} placeholder="Search your clients..." />
        <span className="spacer" />
        <span className="mod-count">{rows.length} of {MY_CASELOAD.length}</span>
      </ModuleFilters>
      <MiniTable
        cols={[
          { label: 'Client', cell: c => (
            <button className="cell-user cell-link" onClick={() => guard.setClient(c.client_id)} title={'Open ' + c.name + '’s chart'}>
              <Avatar name={c.name} size="S" /> <span>{c.name}</span>
            </button>) },
          { label: 'ID', cell: c => c.mrn },
          { label: 'Programs', cell: c => c.program },
          { label: 'Last Visit', cell: c => c.lastVisit },
          { label: 'Next Appointment', cell: c => c.nextAppt },
          { label: 'Site', cell: c => c.siteName },
          { label: 'Action', right: true, cell: c => (
            <Button size="sm" variant="secondary" onClick={() => guard.setClient(c.client_id)}>Open Chart</Button>) },
        ]}
        rows={rows}
        empty={`No clients match “${q}”.`}
      />
    </Panel>
  );
}

/* ---- 2. Pending Notifications ----------------------------------- */
function PendingNotificationsModule() {
  const guard = useGuard();
  const rows = (RD.notifications || []).slice(0, 6);
  return (
    <Panel title="Pending Notifications">
      <MiniTable dense
        cols={[
          { label: 'Form Type', cell: n => n.form_type },
          { label: 'Section', cell: n => n.section },
          { label: 'Site', cell: n => siteName(n.site_id) },
          { label: 'Pended By', cell: n => sName(n.pended_by_staff_id) },
          { label: 'Client', cell: n => {
            const c = CLIENT_BY_ID[n.client_id];
            return c ? <button className="cell-link" onClick={() => guard.setClient(c.client_id)}><span>{c.name}</span></button> : '—';
          } },
        ]}
        rows={rows}
        empty="Nothing pending."
      />
    </Panel>
  );
}

/* ---- 3. Critical Info -------------------------------------------
   Tabbed, per the artboard. The Overdue tab carries the documentation that
   used to live in its own "Documentation Due" panel — it is the entry point
   for the discharge walkthrough, so it must stay reachable from Home. */
const CRITICAL_TABS = ['Overdue', 'Upcoming', 'Additional', 'Follow Up', 'Incomplete'];
function CriticalInfoModule() {
  const guard = useGuard();
  const [tab, setTab] = useState('Overdue');
  const demo = CLIENT_BY_ID[DEMO_CLIENT_ID];
  const others = MY_CASELOAD.filter(c => c.client_id !== DEMO_CLIENT_ID);
  const build = (names, from) => names.map((name, i) => ({
    client: from[i % from.length], type: name, days: (tab === 'Overdue' ? -(i + 1) : i + 2),
  }));
  const rowsByTab = {
    Overdue: [{ client: demo, type: 'Discharge Plan', days: 0 }].concat(build(['Progress Note', 'Treatment Plan Review'], others)),
    Upcoming: build(['Psychiatric Evaluation', 'Service Plan', 'Quality Management'], others),
    Additional: build(['Consent Renewal', 'Payor Assignment'], others),
    'Follow Up': build(['Crisis Prevention Plan'], others),
    Incomplete: build(['PHQ', 'Suicide Risk Screening'], others),
  };
  const rows = rowsByTab[tab] || [];
  return (
    <Panel title="Critical Info">
      <TabStrip className="mod-tabs" tabs={CRITICAL_TABS} active={tab} onSelect={setTab} />
      <MiniTable dense
        cols={[
          { label: 'Staff', cell: () => ME.name },
          { label: 'Client', cell: r => (
            <button className="cell-link" onClick={() => guard.setClient(r.client.client_id)}><span>{r.client.name}</span></button>) },
          { label: 'Type', cell: r => r.type },
          { label: 'Days', cell: r => r.days === 0 ? <span className="badge status-amber">Due today</span>
            : r.days < 0 ? <span className="badge status-danger">{Math.abs(r.days)} overdue</span>
            : <span className="badge status-neutral">in {r.days}</span> },
          /* Open the note itself when it is a real client module — this row is
             the entry point for the discharge walkthrough, and landing on the
             overview would make you hunt for the tab you just clicked. */
          { label: 'Action', right: true, cell: r => (
            <Button size="sm" variant="secondary" onClick={() => {
              const slug = slugify(r.type);
              if (isClientModule(r.type)) guard.setClient(r.client.client_id, { to: '/chart/' + r.client.client_id + '/' + slug });
              else guard.setClient(r.client.client_id);
            }}>Open</Button>) },
        ]}
        rows={rows}
        empty="Nothing in this list."
      />
    </Panel>
  );
}

/* ---- 4. My Team -------------------------------------------------- */
function MyTeamModule() {
  const [q, setQ] = useState('');
  const team = (RD.staff || []).slice(0, 8).map(s => ({
    id: s.staff_id,
    name: sName(s.staff_id),
    role: roleName(s.role_id),
    clients: 3 + (seed(s.staff_id) % 12),
    appts: seed(s.staff_id + 'a') % 6,
    pastDue: seed(s.staff_id + 'p') % 3,
  }));
  const rows = team.filter(t => !q || (t.name + ' ' + t.role).toLowerCase().indexOf(q.toLowerCase()) !== -1);
  return (
    <Panel title="My Team">
      <ModuleFilters>
        <MiniSearch value={q} onChange={setQ} placeholder="Search your team..." />
      </ModuleFilters>
      <MiniTable
        cols={[
          { label: 'Associate Name', cell: t => <span className="cell-user"><Avatar name={t.name} size="S" /> {t.name}</span> },
          { label: 'Job Description', cell: t => t.role },
          { label: 'Clients', cell: t => t.clients },
          { label: 'Today’s Appointments', cell: t => t.appts },
          { label: 'Note Past Due', cell: t => t.pastDue ? <span className="badge status-danger">{t.pastDue}</span> : <span className="badge status-neutral">0</span> },
          { label: 'Action', right: true, cell: () => <button className="lnk">View Caseload</button> },
        ]}
        rows={rows}
        empty={`No one matches “${q}”.`}
      />
    </Panel>
  );
}

/* ---- 5. Messenger ------------------------------------------------ */
function MessengerModule() {
  const msgs = (RD.staffMessages || []);
  const threads = msgs.slice(0, 4).map(m => ({
    id: m.message_id,
    who: sName(m.sender_staff_id),
    body: m.body,
    when: m.timestamp,
    unread: m.read_status !== 'Read',
  }));
  const [active, setActive] = useState(threads.length ? threads[0].id : null);
  const current = threads.find(t => t.id === active) || threads[0];
  return (
    <Panel title="Messenger" action={<button className="lnk">+ New Message</button>}>
      <div className="msgr">
        <div className="msgr-list">
          {threads.map(t => (
            <button key={t.id} className={'msgr-thread' + (t.id === active ? ' on' : '')} onClick={() => setActive(t.id)}>
              <Avatar name={t.who} size="S" />
              <span className="msgr-thread-text">
                <span className="msgr-who">{t.who}{t.unread && <span className="msgr-dot" aria-label="Unread" />}</span>
                <span className="msgr-snip">{t.body}</span>
              </span>
            </button>
          ))}
          {!threads.length && <div className="ov-empty">No messages.</div>}
        </div>
        <div className="msgr-pane">
          {current ? (
            <React.Fragment>
              <div className="msgr-pane-head"><Avatar name={current.who} size="S" /> {current.who}</div>
              <div className="msgr-body">
                <div className="msgr-bubble">{current.body}</div>
                <div className="msgr-when">{fmtDate(current.when)}</div>
              </div>
              <div className="msgr-composer">
                <input placeholder="Type a message..." aria-label="Type a message" />
                <Button size="sm" variant="primary">Send</Button>
              </div>
            </React.Fragment>
          ) : <div className="ov-empty">Nothing selected.</div>}
        </div>
      </div>
    </Panel>
  );
}

/* ---- 6. Upcoming Appointments ------------------------------------ */
function UpcomingAppointmentsModule() {
  const guard = useGuard();
  const appts = (RD.appointments || [])
    .filter(a => a.staff_id === ME.id)
    .slice(0, 6)
    .map(a => ({ ...a, client: CLIENT_BY_ID[a.client_id] }));
  const list = appts.length ? appts : (RD.appointments || []).slice(0, 6).map(a => ({ ...a, client: CLIENT_BY_ID[a.client_id] }));
  return (
    <Panel title="Upcoming Appointments">
      <div className="appt-list">
        {list.map(a => (
          <div key={a.appointment_id} className="appt-row">
            <div className="appt-time">{a.start_time || '—'}<span>{fmtDate(a.date)}</span></div>
            <div className="appt-main">
              <div className="appt-title">{a.title || a.appointment_reason || a.type}</div>
              <div className="appt-meta">
                {a.client
                  ? <button className="cell-link" onClick={() => guard.setClient(a.client.client_id)}><span>{a.client.name}</span></button>
                  : 'Unassigned'} · {a.meeting_type || a.place_of_service}
              </div>
            </div>
            <span className={'badge ' + (a.completion_status === 'Complete' ? 'status-active' : 'status-neutral')}>
              {a.completion_status || 'Scheduled'}
            </span>
          </div>
        ))}
        {!list.length && <div className="ov-empty">Nothing scheduled.</div>}
      </div>
    </Panel>
  );
}

/* ---- 7. Pending Labs ---------------------------------------------
   No lab fixture exists in the shared synthetic set, so these are derived
   deterministically from the caseload — fictional, stable across reloads, and
   clearly not a clinical record. */
const LAB_PANELS = ['CBC w/ Differential', 'Comprehensive Metabolic', 'Lipid Panel', 'TSH', 'Hemoglobin A1c', 'Urine Drug Screen'];
const LAB_STATUS = ['Pending', 'Approved', 'Pending', 'Rejected', 'Approved'];
function PendingLabsModule() {
  const guard = useGuard();
  const rows = MY_CASELOAD.slice(0, 5).map((c, i) => ({
    client: c,
    panel: LAB_PANELS[seed(c.client_id + 'lab') % LAB_PANELS.length],
    date: addDays(TODAY, -(1 + (seed(c.client_id + 'd') % 20))),
    status: LAB_STATUS[i % LAB_STATUS.length],
  }));
  const tone = s => s === 'Approved' ? 'status-active' : s === 'Rejected' ? 'status-danger' : 'status-amber';
  return (
    <Panel title="Pending Labs">
      <MiniTable dense
        cols={[
          { label: 'Client', cell: r => (
            <button className="cell-link" onClick={() => guard.setClient(r.client.client_id)}><span>{r.client.name}</span></button>) },
          { label: 'ID', cell: r => r.client.mrn },
          { label: 'Date', cell: r => fmtDate(r.date) },
          { label: 'Panels', cell: r => r.panel },
          { label: 'Status', cell: r => <span className={'badge ' + tone(r.status)}>{r.status}</span> },
        ]}
        rows={rows}
        empty="No labs pending."
      />
    </Panel>
  );
}

/* ---- 8. Announcements --------------------------------------------
   Agency notices. Fictional, and deliberately about the software and the
   agency rather than anything clinical. */
const ANNOUNCEMENTS = [
  { id: 'a1', urgent: true, title: 'Upcoming changes to the copay workflow',
    body: 'Copay collection moves to the billing module on 1 October. Front-desk staff should complete the 20-minute refresher before then.' },
  { id: 'a2', urgent: true, title: 'What’s new in Axiom 2.4',
    body: 'Discharge summaries now record which diagnoses were printed, separately from their clinical status on the chart.' },
  { id: 'a3', urgent: false, title: 'Product launch timeline',
    body: 'The scheduling refresh ships to all sites in November. Pilot sites start 6 October.' },
  { id: 'a4', urgent: false, title: 'Employee training programs',
    body: 'Trauma-informed care refresher sessions are open for registration through the end of the month.' },
  { id: 'a5', urgent: false, title: 'Corporate social responsibility initiatives',
    body: 'Volunteer day is 18 October. Teams can nominate a local partner organisation until Friday.' },
];
function AnnouncementsModule() {
  const [ack, setAck] = useState(() => new Set());
  const allAcked = ack.size === ANNOUNCEMENTS.length;
  return (
    <Panel title="Announcements" action={
      <button className="lnk" onClick={() => setAck(allAcked ? new Set() : new Set(ANNOUNCEMENTS.map(a => a.id)))}>
        {allAcked ? 'Clear All' : 'Acknowledge All'}
      </button>}>
      <div className="ann-list">
        {ANNOUNCEMENTS.map(a => (
          <div key={a.id} className={'ann' + (ack.has(a.id) ? ' acked' : '')}>
            <span className={'ann-dot' + (a.urgent ? ' urgent' : '')} aria-hidden="true" />
            <div className="ann-text">
              <div className="ann-title">{a.title}</div>
              <div className="ann-body">{a.body}</div>
            </div>
            <button className="lnk ann-ack" onClick={() => setAck(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}>
              {ack.has(a.id) ? 'Acknowledged' : 'Acknowledge'}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---- 9. Productivity ---------------------------------------------- */
const PRODUCTIVITY_FILTERS = ['Up to Date', 'Upcoming', 'Overdue'];
function ProductivityModule() {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('Overdue');
  const rows = MY_CASELOAD
    .filter(c => !q || (c.name + ' ' + c.mrn + ' ' + c.email).toLowerCase().indexOf(q.toLowerCase()) !== -1)
    .filter(c => PRODUCTIVITY_FILTERS[seed(c.client_id + 'pf') % 3] === filter || !filter);
  return (
    <Panel title="Productivity">
      <ModuleFilters>
        <MiniSearch value={q} onChange={setQ} placeholder="Search clients..." />
        <div className="pill-row" role="tablist">
          {PRODUCTIVITY_FILTERS.map(f => (
            <button key={f} role="tab" aria-selected={filter === f}
              className={'pill-btn' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <span className="spacer" />
        <Button size="sm" variant="secondary">Export</Button>
      </ModuleFilters>
      <MiniTable dense
        cols={[
          { label: 'Client', cell: c => (
            <button className="cell-link" onClick={() => guard.setClient(c.client_id)}><span>{c.name}</span></button>) },
          { label: 'ID', cell: c => c.mrn },
          { label: 'Program', cell: c => c.program },
          { label: 'Phone', cell: c => c.phone },
          { label: 'Email', cell: c => <span className="cell-ellipsis">{c.email}</span> },
          { label: 'Last Appointment', cell: c => c.lastVisit },
          { label: 'Next Appointment', cell: c => c.nextAppt },
        ]}
        rows={rows}
        empty="No clients in this view."
      />
    </Panel>
  );
}

function Home() {
  const greeting = TODAY.getHours() < 12 ? 'Good morning' : 'Good afternoon';
  const todayLabel = TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="page home">
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{greeting}, {ME.name.split(' ')[0]}</h1>
          <div className="page-sub">{todayLabel} · {ME.role} · {ME.site}</div>
        </div>
      </div>

      {/* Two-column grid; three modules span both, per the artboard. */}
      <div className="home-grid">
        <div className="home-span2"><MyClientsModule /></div>
        <ApprovalsTasksModule />
        <CriticalInfoModule />
        <div className="home-span2"><MyTeamModule /></div>
        <MessengerModule />
        <UpcomingAppointmentsModule />
        <PendingLabsModule />
        <AnnouncementsModule />
        <div className="home-span2"><ProductivityModule /></div>
      </div>
    </div>
  );
}

function AllClients() {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const rows = CLIENTS.filter(c => !q || (c.name + ' ' + c.mrn + ' ' + c.program).toLowerCase().indexOf(q.toLowerCase()) !== -1);
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Clients' }]} />
      <div className="page-head-row">
        <div><h1 className="page-title">All Clients</h1><div className="page-sub">{rows.length} of {CLIENTS.length} clients</div></div>
      </div>
      <Panel title="Client Roster" action={
        <span className="ln-search" style={{ width: 280 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, MRN or program…" aria-label="Search clients" />
        </span>
      }>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Client</th><th>MRN</th><th>DOB</th><th>Program</th><th>Site</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.client_id} className={c.client_id === guard.clientId ? 'row-current' : ''}>
                  <td><span className="cell-user"><Avatar name={c.name} size="S" /> {c.name}</span></td>
                  <td>{c.mrn}</td>
                  <td>{fmtDate(c.dob)} ({c.age})</td>
                  <td>{c.program}</td>
                  <td>{c.siteName}</td>
                  <td><span className={'badge ' + (c.status === 'Active' ? 'status-active' : 'status-neutral')}>{c.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    {c.client_id === guard.clientId
                      ? <span className="badge status-info">In context</span>
                      : <Button size="sm" variant="secondary" onClick={() => guard.setClient(c.client_id)}>Open Chart</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function NonClientPage({ title, blurb, crumbs }) {
  return (
    <div className="page">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="page-head-row"><div><h1 className="page-title">{title}</h1><div className="page-sub">{blurb}</div></div></div>
      <Panel title={title}>
        <div className="stub">
          <Icon name="info" size={20} />
          <div>Out of scope for this prototype. {title} exists here so you can walk the context intercept: open a chart, then navigate to this page.</div>
        </div>
      </Panel>
    </div>
  );
}

/* ===== Client module, opened with no client in context ============
   Issue 3. Previously the left nav quietly adopted a client so the module had
   something to render — which is exactly the tethering the redesign is meant
   to remove. Now the module opens empty, and the only way forward is to choose
   a client from a list already scoped to this clinician's caseload.
   NOTE: layout here is DS-token scaffolding. Pending the artboard at
   node 4423:86972 for the real empty-state treatment. */
function ClientPicker({ heading, clients, onPick, emptyText }) {
  if (!clients.length) return <div className="picker-empty">{emptyText}</div>;
  return (
    <div className="picker-group">
      <div className="picker-group-head">{heading} <span className="picker-count">{clients.length}</span></div>
      {clients.map(c => (
        <button key={c.client_id} className="picker-row" onClick={() => onPick(c)}>
          <Avatar name={c.name} size="S" />
          <span className="picker-text">
            <span className="picker-name">{c.name}</span>
            <span className="picker-meta">MRN {c.mrn} · DOB {fmtDate(c.dob)} ({c.age}) · {c.program}</span>
          </span>
          <span className={'badge ' + (c.status === 'Active' ? 'status-active' : 'status-neutral')}>{c.status}</span>
          <Icon name="chevronRight" size={16} />
        </button>
      ))}
    </div>
  );
}

function ModulePage({ slug }) {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const searchRef = useRef(null);
  const name = CLIENT_MODULES[slug] || 'Module';
  /* Focus the search, but not with autoFocus — that scrolls the page down to
     the input on mount and hides the page header. */
  useEffect(() => { if (searchRef.current) searchRef.current.focus({ preventScroll: true }); }, [slug]);

  const matches = c => !q || (c.name + ' ' + c.mrn + ' ' + c.client_id + ' ' + c.program).toLowerCase().indexOf(q.toLowerCase()) !== -1;
  const direct = CASELOAD.direct.filter(matches);
  const indirect = CASELOAD.indirect.filter(matches);
  const open = c => guard.setClient(c.client_id, { to: '/chart/' + c.client_id + '/' + slug });

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Clients', to: '/clients' }, { label: name }]} />
      <div className="page-head-row">
        <div><h1 className="page-title">{name}</h1><div className="page-sub">No client selected</div></div>
      </div>
      <Panel title={`Select a Client to Open ${name}`}>
        <div className="picker">
          <div className="picker-search">
            <Icon name="search" size={18} />
            <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)}
              placeholder={`Search your caseload to open ${name}…`} aria-label={'Search clients to open ' + name} />
            {q && <button className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={15} /></button>}
          </div>
          <div className="picker-scope">Showing your assigned clients only — {CASELOAD.direct.length} direct, {CASELOAD.indirect.length} indirect.</div>
          <ClientPicker heading="Direct Caseload" clients={direct} onPick={open} emptyText={`No direct-caseload clients match “${q}”.`} />
          <ClientPicker heading="Indirect Caseload" clients={indirect} onPick={open} emptyText={`No indirect-caseload clients match “${q}”.`} />
        </div>
      </Panel>
    </div>
  );
}
