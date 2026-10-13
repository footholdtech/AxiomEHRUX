/* ===== Client context + navigation guard ==========================
   PROBLEM THIS SOLVES (issue 1). In AxiomEHR today the application is
   permanently tethered to a client record: you land already inside somebody's
   chart, and the chart you are in can change under you. Clinicians misread
   whose record they are documenting in.

   The model here:
     · Client context starts EMPTY. Home, Reports, Admin etc. have no client.
     · A client enters context only when the clinician deliberately puts them
       there (opening a chart, or the context switcher in the top bar).
     · Any move that would change or drop that context is intercepted, and the
       intercept names both charts explicitly.
     · Signing out clears context. Signing back in starts empty again — context
       is never restored from a previous session.
   ================================================================ */

/* Which client (if any) a route belongs to. Routes not listed are non-client
   pages, and navigating to one drops the chart context. */
function clientIdForPath(to) {
  if (!to) return null;
  const m = match('/chart/:id', to) || match('/chart/:id/:module', to);
  return m ? m.id : null;
}
const ROUTE_LABELS = {
  '/': 'Home', '/clients': 'All Clients', '/reports': 'Reports',
  '/billing': 'Billing', '/admin': 'Admin', '/signin': 'Sign in',
};
const labelForPath = to => ROUTE_LABELS[to] || (clientIdForPath(to) ? 'client chart' : to);

/* ---- Session ---------------------------------------------------- */
const SessionCtx = createContext(null);
const useSession = () => useContext(SessionCtx);

/* ---- Guard ------------------------------------------------------ */
const GuardCtx = createContext(null);
const useGuard = () => useContext(GuardCtx);

function GuardProvider({ children }) {
  const navigate = useRawNavigate();
  const [signedIn, setSignedIn] = useState(true);
  /* signInCount only exists so the prototype can prove the point: the banner on
     Home after a fresh sign-in says "no client in context", every time. */
  const [signInCount, setSignInCount] = useState(0);
  const [clientId, setClientIdRaw] = useState(null);
  /* dirty = { label, clientId } for the note currently holding unsaved edits */
  const [dirty, setDirty] = useState(null);
  const [intercept, setIntercept] = useState(null);
  const [toast, setToast] = useState(null);
  /* Which tab the open chart is showing. It lives here because the breadcrumb
     is rendered by the app shell (`ChartChrome`) while the tab is owned by the
     chart page, and the trail needs to name the tab you are actually on. */
  const [chartTab, setChartTab] = useState(null);

  const client = clientId ? CLIENT_BY_ID[clientId] : null;

  const commit = useCallback((req) => {
    if (req.signOut) {
      setSignedIn(false);
      setClientIdRaw(null);
      setDirty(null);
      setIntercept(null);
      navigate('/signin');
      return;
    }
    setClientIdRaw(req.client ?? null);
    if (req.discardDirty !== false) setDirty(null);
    if (req.onCommit) req.onCommit();
    if (req.to) navigate(req.to);
    setIntercept(null);
    if (req.toast) setToast(req.toast);
  }, [navigate]);

  /* The single entry point for every navigation, client switch, note switch
     and sign-out in the app. Screens never call navigate() directly. */
  const request = useCallback((req) => {
    const target = req.client !== undefined ? req.client : clientIdForPath(req.to);
    const full = { ...req, client: target };
    const reasons = [];
    if (dirty) reasons.push('unsaved');
    if (clientId && target && target !== clientId) reasons.push('switch');
    /* Leaving a chart only warrants an interruption if there is something to
       lose. Someone who opened a chart, read it and headed back to Home has
       taken no action worth confirming — the client is simply cleared. A
       switch still intercepts either way, because that one changes whose
       record the next thing you type lands in. */
    else if (clientId && !target && !req.signOut && dirty) reasons.push('leave');
    else if (req.signOut && clientId) reasons.push('signout');
    if (!reasons.length) return commit(full);
    setIntercept({ req: full, reasons });
  }, [clientId, dirty, commit]);

  const value = {
    clientId, client, signedIn, signInCount, dirty, toast, setToast, chartTab, setChartTab,
    go: (to, opts) => request({ to, ...(opts || {}) }),
    setClient: (id, opts) => request({ to: '/chart/' + id, client: id, ...(opts || {}) }),
    clearClient: (opts) => request({ to: '/', client: null, ...(opts || {}) }),
    signOut: () => request({ signOut: true, client: null }),
    signIn: () => { setSignedIn(true); setSignInCount(n => n + 1); setClientIdRaw(null); setDirty(null); navigate('/'); },
    /* Deep-link entry only: the URL already names the chart, so adopting it is
       not a context change the clinician could be surprised by. */
    adopt: (id) => setClientIdRaw(id),
    markDirty: (label) => setDirty(d => (d && d.label === label && d.clientId === clientId) ? d : { label, clientId }),
    clearDirty: () => setDirty(null),
    request,
  };
  return (
    <GuardCtx.Provider value={value}>
      {children}
      {intercept && <NavIntercept intercept={intercept} dirty={dirty}
        onCancel={() => { const oc = intercept.req.onCancel; setIntercept(null); if (oc) oc(); }}
        onCommit={commit} currentClient={client} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </GuardCtx.Provider>
  );
}

/* A link that always routes through the guard. */
function GLink({ to, client, className, style, children, title }) {
  const guard = useGuard();
  return <a href={'#' + to} title={title} className={className} style={style}
    onClick={e => { e.preventDefault(); guard.request({ to, ...(client !== undefined ? { client } : {}) }); }}>{children}</a>;
}

/* ---- The intercept overlay -------------------------------------
   Copy and layout per Lisa's handling spec for the dev team (see the three
   variants on artboard 4090:39441):

     switch + unsaved  "Unsaved Changes"  warning banner + identity pair
                       Stay on Page · Switch Without Saving
     switch, clean     "Switch Clients?"  plain question + identity pair
                       Cancel · Yes, Switch Clients
     leaving, unsaved  "Unsaved Changes"  warning banner, no identity pair
                       Stay on Page · Leave Without Saving

   Two rules the spec makes explicit and that are easy to get wrong: the
   question lives *inside* the warning banner when there is unsaved work rather
   than being repeated above it, and the identity pair appears only when a
   client is actually changing — leaving a page is not a switch. */
function NavIntercept({ intercept, dirty, onCancel, onCommit, currentClient }) {
  const { req, reasons } = intercept;
  const target = req.client ? CLIENT_BY_ID[req.client] : null;
  const unsaved = reasons.indexOf('unsaved') !== -1;
  const kind = reasons.indexOf('switch') !== -1 ? 'switch'
    : reasons.indexOf('signout') !== -1 ? 'signout'
    : reasons.indexOf('leave') !== -1 ? 'leave' : 'unsaved';

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel]);

  /* One question per situation, asked once. With unsaved work it is the second
     sentence of the warning; without, it is the whole body. */
  const question = kind === 'switch' ? 'Are you sure you want to switch clients?'
    : kind === 'signout' ? 'Are you sure you want to sign out?'
    : 'Are you sure you want to leave this page?';

  const COPY = unsaved
    ? {
        title: 'Unsaved Changes',
        cancel: 'Stay on Page',
        confirm: kind === 'switch' ? 'Switch Without Saving'
          : kind === 'signout' ? 'Sign Out Without Saving'
          : 'Leave Without Saving',
      }
    : {
        title: kind === 'switch' ? 'Switch Clients?' : kind === 'signout' ? 'Sign Out?' : 'Leave This Page?',
        cancel: 'Cancel',
        confirm: kind === 'switch' ? 'Yes, Switch Clients' : kind === 'signout' ? 'Yes, Sign Out' : 'Yes, Leave',
      };

  return ReactDOM.createPortal(
    <React.Fragment>
      <div className="modal-scrim" onClick={onCancel} />
      <div className="intercept" role="alertdialog" aria-modal="true" aria-labelledby="intercept-title">
        {/* DS `.modal header` (2086:547) — no leading glyph, dismiss pinned right. */}
        <div className="intercept-head">
          <div className="modal-head-content">
            <h2 className="intercept-title" id="intercept-title">{COPY.title}</h2>
          </div>
          <div className="modal-head-actions">
            <button className="icon-btn modal-dismiss" aria-label="Close" onClick={onCancel} data-node-id="2048:586">
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        <div className="intercept-body">
          {unsaved
            ? <div className="warn-banner" role="note">
                <Icon name="warn" size={20} />
                <div>You have unsaved changes on this page. {question}</div>
              </div>
            : <p className="intercept-lede">{question}</p>}

          {kind === 'switch' && (
            <div className="switch-pair">
              <div className="switch-side">
                <div className="switch-cap">Leaving</div>
                <div className="switch-who"><Avatar name={currentClient?.name || ''} size="M" />
                  <span>{currentClient?.displayName || 'No client'}</span></div>
              </div>
              <span className="switch-arrow" aria-hidden="true"><Icon name="chevronRight" size={20} /></span>
              <div className="switch-side">
                <div className="switch-cap">Switching to</div>
                <div className="switch-who"><Avatar name={target?.name || ''} size="M" />
                  <span>{target?.displayName || '—'}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="intercept-foot">
          {/* Deliberately no "keep this client in context" escape hatch. Leaving a
              chart clears the client outright — carrying one onto an unrelated
              page is the tethering problem this prototype argues against. */}
          <Button variant="secondary" onClick={onCancel}>{COPY.cancel}</Button>
          <Button variant="primary" onClick={() => onCommit(req)}>{COPY.confirm}</Button>
        </div>
      </div>
    </React.Fragment>,
  document.body);
}
