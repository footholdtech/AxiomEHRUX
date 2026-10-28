/* ===== Routes + mount ============================================ */

/* Skeletons. Enough of a destination that every breadcrumb and nav item leads
   somewhere real, without pretending to be the module. Each carries its own
   trail so these pages are not the one place the breadcrumb disappears. */
const STUBS = {
  '/client-medical-area': { title: 'Client Medical Area',
    blurb: 'The clinical modules for a single client — vitals, allergies, diagnoses, problem list, medications. Open a client to work inside one; nothing here is filed until you do.',
    crumbs: [{ label: 'Clients', to: '/clients' }, { label: 'Client Medical Area' }] },
  '/foster-home': { title: 'Foster Home', blurb: 'Program shell. Not tied to any client record.',
    crumbs: [{ label: 'Foster Home' }] },
  '/inpatient-module': { title: 'Inpatient Module', blurb: 'Program shell. Not tied to any client record.',
    crumbs: [{ label: 'Inpatient Module' }] },
  '/residential': { title: 'Residential', blurb: 'Program shell. Not tied to any client record.',
    crumbs: [{ label: 'Residential' }] },
};

/* Turn any other in-app route into a named destination rather than silently
   dropping the clinician on Home. The left nav and the global search between
   them can reach far more leaves than this prototype builds out, and a nav
   item that quietly does nothing reads as a bug. */
const titleFromPath = p => p.replace(/^\//, '').split('-')
  .map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');

function Routes({ config }) {
  const path = usePath();
  const guard = useGuard();
  if (!guard.signedIn) return <SignIn />;
  let m;
  if (match('/', path)) return <Home />;
  if (match('/clients', path)) return <AllClients />;
  if ((m = match('/chart/:id', path))) return <ChartPage id={m.id} config={config} />;
  if ((m = match('/chart/:id/:module', path))) return <ChartPage id={m.id} module={m.module} config={config} />;
  /* Client-specific module with no client in context — the picker, not a chart. */
  if ((m = match('/module/:slug', path))) return <ModulePage slug={m.slug} />;
  /* Admin › User Interface Options. Agency configuration, never client data —
     these pages must not adopt a client, and they do not. */
  if (match('/notifications', path)) return <NotificationsPage tab="task" />;
  if (match('/notifications/preferences', path)) return <NotifPreferencesPage />;
  if ((m = match('/notifications/:tab', path))) return <NotificationsPage tab={m.tab} />;
  if (match('/user-interface-options', path)) return <UIOptionsIndex />;
  if (match('/user-interface-options/client-header', path)) return <ClientHeaderListPage />;
  if (match('/user-interface-options/client-attributes', path)) return <ClientAttributesPage />;
  if ((m = match('/user-interface-options/client-header/:id', path))) return <ClientHeaderEditPage id={m.id} />;
  /* Section pages, so a section breadcrumb is never a dead end. */
  if (match('/documents', path) || match('/clinical-forms-search', path)) return <DocumentsPage />;
  if (match('/reports', path)) return <SectionIndexPage sectionKey="reports" />;
  if (match('/billing', path)) return <SectionIndexPage sectionKey="billing" />;
  if (match('/admin', path)) return <SectionIndexPage sectionKey="admin" />;
  if (match('/client-list', path)) return <AllClients crumbs={navTrail('Client List')} />;
  if (STUBS[path]) return <NonClientPage {...STUBS[path]} />;
  /* Any other nav destination: client-agnostic, with its section trail. */
  if (NAV_BY_SLUG[path.slice(1)] && !isClientModule(NAV_BY_SLUG[path.slice(1)])) return <AgencyPage label={NAV_BY_SLUG[path.slice(1)]} />;
  if (match('/signin', path)) return <SignIn />;
  if (path && path !== '/') {
    const title = titleFromPath(path);
    return <NonClientPage title={title} crumbs={[{ label: title }]}
      blurb="Not built out in this prototype. It is routed so the navigation never dead-ends." />;
  }
  return <Home />;
}

function Chrome({ config }) {
  const guard = useGuard();
  if (!guard.signedIn) return <SignIn />;
  return <AppShell><Routes config={config} /></AppShell>;
}

function App() {
  /* Agency configuration: whether a clinician can complete a note outright or
     it has to be pended to a manager. Flips the note's primary action. */
  const [requiresApproval, setRequiresApproval] = useState(false);
  const config = { requiresApproval, setRequiresApproval };
  return (
    <ThemeProvider>
      <UIConfigProvider>
        <Router>
          <GuardProvider>
            <Chrome config={config} />
          </GuardProvider>
        </Router>
      </UIConfigProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
