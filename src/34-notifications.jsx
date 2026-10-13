/* ===== Notification center — bell, flyout, All Notifications page ======
   Two surfaces over one store (17-notifications.jsx):

     · The bell in the top bar opens a flyout on the right — half the viewport
       on desktop, all of it on tablet — for a quick look and quick actions.
     · "All Notifications" opens /notifications/:group, a client-agnostic page
       for working a queue, cleaning up, and setting delivery preferences.

   Signal rules, kept deliberately strict so the bell stays meaningful:
     red number   only things that need me — open tasks, unread urgent alerts
     theme dot    something new I haven't seen, but nothing is waiting on me
     nothing      seen, or not mine to act on
   Red is never used for a dot that isn't counted.
   ================================================================ */

const NCount = ({ n, className }) => <span className={'ncount' + (className ? ' ' + className : '')} aria-hidden="true">{n > 99 ? '99+' : n}</span>;
const NDot = ({ tone, className }) => <span className={'ndot ndot--' + tone + (className ? ' ' + className : '')} aria-hidden="true" />;
const NTag = ({ tone, children }) => <span className={'ntag' + (tone ? ' ntag--' + tone : '')}>{children}</span>;
const GENERAL_ICON = { report: 'reports', announcement: 'chat', maintenance: 'admin', credential: 'shield', shift: 'calendar' };
/* The production tab an item used to live under, as a short "type" label for
   filtering — so nothing a user could find before is unfindable now. */
const notifType = n => { const t = n.source.split('›').pop().trim(); return t === 'Pending Notifications' ? 'Pended forms' : t; };

/* ---- Bell ------------------------------------------------------------ */
function NotifBell() {
  useNotifVersion();
  const [open, setOpen] = useState(false);
  const count = notifBellCount();
  const quiet = !count && notifBellQuiet();
  const label = 'Notifications' + (count ? ', ' + count + ' need you' : quiet ? ', new updates' : '');
  return (
    <React.Fragment>
      <button className="tn-link tn-bell" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="tn-bell-ico">
          <Icon name="bell" size={16} />
          {count > 0 && <NCount n={count} className="ncount--bell" />}
          {quiet && <NDot tone="quiet" className="ndot--bell" />}
        </span>
        Notifications
      </button>
      {open && <NotifFlyout onClose={() => setOpen(false)} />}
    </React.Fragment>
  );
}

/* ---- Group tabs (flyout and page) --------------------------------------- */
function NotifTabs({ active, onSelect }) {
  useNotifVersion();
  return (
    <div className="tabs-default ntabs" role="tablist">
      {NOTIF_GROUPS.map(g => {
        const c = notifGroupCount(g.key), dot = !c && notifGroupUnseen(g.key);
        return (
          <button key={g.key} role="tab" aria-selected={active === g.key}
            className={'tab-default ntab' + (active === g.key ? ' active' : '')} onClick={() => onSelect(g.key)}>
            {g.label}
            {c > 0 && <NCount n={c} />}
            {dot && <NDot tone="quiet" />}
            <span className="sr-only">{c ? ', ' + c + ' need you' : dot ? ', new' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---- Flyout ------------------------------------------------------------ */
function NotifFlyout({ onClose }) {
  useNotifVersion();
  const guard = useGuard();
  /* Opens on what needs you — the research's "wrong default surface" fix. */
  const [tab, setTab] = useState(() => (notifGroupCount('task') || !notifGroupCount('alert') ? 'task' : 'alert'));
  const closeRef = useRef(null);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    /* A dialog opened from a row owns Escape while it is up. */
    const k = e => { if (e.key === 'Escape' && !document.querySelector('.ovl, .float-menu')) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const goPage = t => { onClose(); guard.go('/notifications/' + t); };
  return ReactDOM.createPortal(
    <React.Fragment>
      <div className="flyout-scrim" onClick={onClose} />
      <aside className="nfly" role="dialog" aria-modal="true" aria-labelledby="nfly-title">
        <header className="nfly-head">
          <h2 id="nfly-title">Notifications</h2>
          <span className="spacer" />
          <Tooltip label="Delivery preferences" placement="bottom">
            <button className="icon-btn" aria-label="Delivery preferences" onClick={() => goPage('preferences')}><Icon name="admin" size={18} /></button>
          </Tooltip>
          <button ref={closeRef} className="icon-btn" aria-label="Close notifications" onClick={onClose}><Icon name="close" size={20} /></button>
        </header>
        <div className="nfly-tabs"><NotifTabs active={tab} onSelect={setTab} /></div>
        <div className="nfly-body"><NotifGroupView cat={tab} variant="flyout" onNavigate={onClose} /></div>
        <footer className="nfly-foot">
          <span className="ovl-hint">{tab === 'alert'
            ? 'Open an alert to review it. Mark client alerts as read from All Notifications.'
            : 'Showing what’s open. Filters and bulk actions are on the page.'}</span>
          <span className="spacer" />
          <Button variant="ghost" onClick={() => goPage(tab)}>All Notifications <Icon name="chevronRight" size={14} /></Button>
        </footer>
      </aside>
    </React.Fragment>,
    document.body);
}

/* ---- One group's list ----------------------------------------------------
   Shared by the flyout (compact, no selection) and the page (filters, bulk). */
function NotifGroupView({ cat, variant, onNavigate, filter, sel, setSel }) {
  useNotifVersion();
  const guard = useGuard();
  let items = notifList(cat);
  if (filter) items = items.filter(filter);
  const unread = items.filter(n => !n.read);
  const page = variant === 'page';
  const pick = page ? n => ({ selected: sel.indexOf(n.notification_id) !== -1,
    onSelect: v => setSel(s => (v ? s.concat([n.notification_id]) : s.filter(x => x !== n.notification_id))) }) : () => ({});
  const row = n => <NotifRow key={n.notification_id} n={n} variant={variant} onNavigate={onNavigate} selectable={page} {...pick(n)} />;

  const head = (
    <div className="ngroup-head">
      <span className="ngroup-blurb">{NOTIF_GROUP[cat].blurb}</span>
      <span className="spacer" />
      {/* Client alerts are marked read one by one, deliberately — and never
          from the flyout, which is a quick look, not a review. */}
      {(cat === 'general' || (cat === 'alert' && page)) && (
        <Button size="sm" variant="ghost" disabled={!unread.length} onClick={() => setNotifRead(unread.map(n => n.notification_id), true)}>
          <Icon name="check" size={14} /> Mark All as Read{unread.length ? ' (' + unread.length + ')' : ''}
        </Button>
      )}
    </div>
  );
  if (!items.length) return (
    <React.Fragment>{head}<div className="nempty"><Icon name="check" size={20} /><b>You’re all caught up.</b><span>Nothing {filter ? 'matches these filters' : 'here needs you right now'}.</span></div></React.Fragment>
  );
  if (cat === 'alert') {
    const urgent = items.filter(n => n.urgent);
    const notes = items.filter(n => n.kind === 'client-note').sort((a, b) => (b.important - a.important) || (new Date(b.created) - new Date(a.created)));
    const rest = items.filter(n => !n.urgent && n.kind !== 'client-note');
    const sec = (title, list) => !!list.length && <section className="nsec"><h3 className="nsec-title">{title} <span>{list.length}</span></h3>{list.map(row)}</section>;
    return (
      <React.Fragment>
        {head}
        {sec('Urgent — follow-up required', urgent)}
        {sec('Due, expiring and updates', rest)}
        {/* One row per note, Important first — never rolled up, so nothing a
            colleague flagged hides behind a count. */}
        {sec('Care-team notes', notes)}
      </React.Fragment>
    );
  }
  const waiting = cat === 'task' ? notifWaiting() : [];
  return (
    <React.Fragment>
      {head}
      <section className="nsec">{items.map(row)}</section>
      {cat === 'task' && !!waiting.length && (variant === 'flyout'
        ? <button className="lnk nwaiting-link" onClick={() => { onNavigate && onNavigate(); guard.go('/notifications/task'); }}>
            {waiting.length} item{waiting.length === 1 ? '' : 's'} you’ve finished {waiting.length === 1 ? 'is' : 'are'} waiting on someone else — not counted
          </button>
        : <WaitingOnOthers items={waiting} />)}
    </React.Fragment>
  );
}

/* The other half of the multi-approver fix: once I've done my step, the item
   leaves my queue and my count, and lives here until the chain finishes. */
function WaitingOnOthers({ items }) {
  const [open, setOpen] = useState(true);
  const guard = useGuard();
  return (
    <section className="nsec nwaiting">
      <button className="nsec-title nsec-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="chevronDown" size={14} className={open ? '' : 'is-collapsed'} /> Waiting on others <span>{items.length}</span>
        <span className="nsec-note">You’ve done your part. Not counted in your notifications.</span>
      </button>
      {open && items.map(n => {
        const c = CLIENT_BY_ID[n.client_id];
        return (
          <div key={n.notification_id} className="nwait-row">
            {c && <Avatar name={c.name} size="S" />}
            <div className="nrow-main">
              <div className="nrow-line1">{c && <span className="nrow-client-txt">{c.name}</span>}{c && <span className="nrow-sep">·</span>}<span className="nrow-title">{n.title}</span></div>
              <div className="nrow-detail">{n.detail}</div>
            </div>
            <span className="nrow-when">{notifAgo(n.created)}</span>
            <Button size="sm" variant="ghost" disabled={n.nudged} onClick={() => { nudgeNotif(n.notification_id); guard.setToast({ icon: 'check', title: 'Reminder sent', detail: 'To ' + sName(n.waiting_on) + '.' }); }}>
              {n.nudged ? 'Reminder Sent' : 'Send Reminder'}
            </Button>
          </div>
        );
      })}
    </section>
  );
}

/* ---- One row ------------------------------------------------------------- */
function NotifRow({ n, variant, onNavigate, selectable, selected, onSelect }) {
  const guard = useGuard();
  const c = n.client_id ? CLIENT_BY_ID[n.client_id] : null;
  const counted = notifCounted(n);
  /* Tasks have no read state — they're a to-do list and leave when done. */
  const dot = n.category !== 'task' && !n.read ? (counted ? 'urgent' : 'quiet') : null;
  const win = n.urgent ? notifWindow(n) : null;
  const due = notifDue(n);
  const openChart = () => { onNavigate && onNavigate(); guard.setClient(n.client_id); };
  /* In the client's own chart the client is already known: no name, no
     avatar, no icon. */
  const inChart = variant === 'chart';
  const showClient = c && !inChart;
  const icon = GENERAL_ICON[n.kind] || (n.kind === 'shift-change' ? 'calendar' : 'bell');   // rows with no client
  return (
    <article className={'nrow nrow--' + variant + (dot ? ' is-unread' : '') + (n.urgent ? ' is-urgent' : '') + (selected ? ' is-selected' : '')}>
      {selectable && <span className="nrow-check"><Checkbox checked={selected} onChange={onSelect} ariaLabel={'Select ' + n.title} /></span>}
      <span className="nrow-gutter">{dot && <NDot tone={dot} />}{dot && <span className="sr-only">Unread</span>}</span>
      {/* No lead in the chart: the client is known and kind icons were noise. */}
      {!inChart && <span className="nrow-lead">{showClient ? <Avatar name={c.name} size="M" /> : <span className="nrow-ico"><Icon name={icon} size={16} /></span>}</span>}
      <div className="nrow-main">
        <div className="nrow-line1">
          {showClient && <button className="lnk nrow-client" onClick={openChart}>{c.name}</button>}
          {showClient && <span className="nrow-sep" aria-hidden="true">·</span>}
          <span className="nrow-title">{n.title}</span>
          <span className="nrow-when">{notifAgoShort(n.created)}</span>
        </div>
        <div className="nrow-detail">{n.detail}</div>
        {/* Only what changes the next step: the follow-up window, a due date,
            Important, coverage. Urgency is carried by position, the red dot
            and the CTA — no "Urgent"/"Action needed" labels. Who sent it and
            the source feed are secondary: page only. */}
        {(() => {
          const tags = [
            win && <NTag key="w" tone={win.tone}>{win.label}</NTag>,
            due && <NTag key="d" tone={due.tone}>{due.label}</NTag>,
            n.important && <NTag key="i" tone="warn">Important</NTag>,
            n.delegated_from && <NTag key="c" tone="info">Covering for {sName(n.delegated_from)}</NTag>,
            n.kind === 'report' && <NTag key="r" tone={n.status === 'Error' ? 'danger' : 'good'}>{n.status}</NTag>,
            variant === 'page' && <span key="s" className="nrow-src">{[n.from_staff_id ? sName(n.from_staff_id) : n.feed, notifType(n)].filter(Boolean).join(' · ')}</span>,
          ].filter(Boolean);
          return tags.length ? <div className="nrow-meta">{tags}</div> : null;
        })()}
      </div>
      <NotifActions n={n} client={c} variant={variant} onNavigate={onNavigate} openChart={openChart} />
    </article>
  );
}

/* ---- Actions --------------------------------------------------------------
   Primary action and a More menu on the right of every row, plus the read
   toggle under them on anything that has a read state — same place on every
   row, the way Client Notes does it. */
function NotifActions({ n, client, variant, onNavigate, openChart }) {
  const guard = useGuard();
  const [mode, setMode] = useState(null);
  const close = () => setMode(null);
  const done = (action, title, detail, extra) => { resolveNotif(n.notification_id, action, extra); guard.setToast({ icon: 'check', title, detail }); close(); };
  const openModule = () => { onNavigate && onNavigate(); guard.go('/chart/' + n.client_id + (n.link ? '/' + slugify(n.link) : ''), { client: n.client_id }); };

  let primary = null; const more = [];
  const chartItem = client && variant !== 'chart' ? { label: 'Open ' + client.name.split(' ')[0] + '’s Chart', onClick: openChart } : null;
  const lockedDismiss = { label: 'Dismiss', disabled: true, reason: 'Required by your organization — complete, return or delegate it.' };

  if (n.category === 'task') {
    const A = TASK_ACTIONS[n.kind] || {};
    primary = { label: A.primary, onClick: () => (n.kind === 'incomplete' ? openModule() : n.kind === 'appt-request' ? done('accepted', 'Appointment accepted', n.slot + ' · added to the schedule')
      : n.kind === 'shift-change' ? done('approved', 'On-call swap approved', 'Both calendars are updated.') : setMode(n.kind === 'message' ? 'reply' : n.kind === 'referral' ? 'intake' : 'review')) };
    (A.more || []).forEach(k => {
      if (k === 'return') more.push({ label: 'Return for Edits…', onClick: () => setMode('return') });
      if (k === 'delegate') more.push({ label: 'Delegate…', onClick: () => setMode('delegate') });
      if (k === 'propose') more.push({ label: 'Propose Another Time…', onClick: () => setMode('propose') });
      if (k === 'decline') more.push({ label: 'Decline…', onClick: () => setMode('decline') });
      if (k === 'done') more.push({ label: 'Mark Done', onClick: () => done('done', 'Marked done', 'Removed from your queue.') });
      if (k === 'chart' && chartItem) more.push(chartItem);
    });
    if (n.locked) more.push(lockedDismiss);
  } else if (n.category === 'alert') {
    if (n.urgent) {
      primary = n.status === 'Action needed'
        ? { label: 'Start Follow-Up', onClick: () => { setAlertStatus(n.notification_id, 'In progress'); guard.setToast({ icon: 'check', title: 'Follow-up started', detail: 'It stays open until the follow-up is documented.' }); } }
        : { label: 'Document Follow-Up', onClick: () => setMode('followup') };
      if (chartItem) more.push(chartItem);
      more.push({ label: 'Delegate…', onClick: () => setMode('delegate') });
      more.push({ label: 'Dismiss', disabled: true, reason: 'Urgent alerts close when the follow-up is documented.' });
    } else {
      /* Opening is not reading. A clinical alert is marked read only when the
         clinician says so — that's the audit record. */
      primary = n.kind === 'client-note' ? { label: 'Open Note', onClick: () => setMode('notes') }
        : n.kind === 'assignment' || n.kind === 'follow-up' ? (variant === 'chart' ? null : { label: 'Open Chart', onClick: openChart })
        : { label: 'Open', onClick: openModule };
      if (chartItem && (!primary || primary.label !== 'Open Chart')) more.push(chartItem);
      more.push({ label: 'Dismiss', onClick: () => done('dismissed', 'Dismissed', n.title) });
    }
  } else {
    if (n.kind === 'report') primary = n.status === 'Error'
      ? { label: 'Try Again', onClick: () => { setNotifRead(n.notification_id, true); guard.setToast({ icon: 'check', title: 'Report queued', detail: 'You’ll get a notification when it’s ready.' }); } }
      : { label: 'View Report', onClick: () => { setNotifRead(n.notification_id, true); guard.setToast({ icon: 'info', title: 'Reports are out of scope', detail: 'This would open the report.' }); } };
    if (n.kind === 'credential') primary = { label: 'Upload Renewal', onClick: () => guard.setToast({ icon: 'info', title: 'Staff profile is out of scope', detail: 'This would open your profile.' }) };
    more.push({ label: 'Dismiss', onClick: () => done('dismissed', 'Dismissed', n.title) });
  }
  /* General items can be marked read anywhere. Client alerts only on the
     page, never in the flyout's quick look. */
  const hasRead = n.category === 'general' || (n.category === 'alert' && (variant === 'page' || variant === 'chart'));

  return (
    <div className="nrow-acts">
      <div className="nrow-acts-top">
        {/* Secondary everywhere: a column of primaries is a wall, and if
            everything is primary nothing is. */}
        {primary && primary.label && <Button size="sm" variant="secondary" onClick={primary.onClick}>{primary.label}</Button>}
        {!!more.length && <NMore items={more} label={'More actions for ' + n.title} />}
      </div>
      {hasRead && (
        <Tooltip label={n.urgent && !n.read ? 'Marks it seen. It stays open until the follow-up is documented.' : null} placement="bottom">
          <Button size="sm" variant="ghost" className={'nread-btn' + (n.read ? ' is-read' : '')} onClick={() => setNotifRead(n.notification_id, !n.read)}>
            {n.read ? 'Mark as Unread' : <React.Fragment><Icon name="check" size={14} /> Mark as Read</React.Fragment>}
          </Button>
        </Tooltip>
      )}
      {mode === 'review' && <ReviewOverlay n={n} client={client} onClose={close} onDone={done} onReturn={() => setMode('return')} />}
      {mode === 'return' && <ReasonOverlay n={n} client={client} title="Return for Edits" ask="What needs to change?" reasons={['Missing information', 'Incorrect service or code', 'Clinical content needs revision', 'Wrong client or date', 'Other']}
        cta="Send Back" onClose={close} onDone={r => done('returned', 'Returned for edits', 'Sent back to ' + (n.from_staff_id ? sName(n.from_staff_id) : 'the author') + ' · ' + r)} />}
      {mode === 'decline' && <ReasonOverlay n={n} client={client} title={n.kind === 'shift-change' ? 'Decline Swap' : 'Decline Request'} ask="Why are you declining?"
        reasons={n.kind === 'shift-change' ? ['Coverage gap', 'Conflicts with my schedule', 'Needs supervisor approval', 'Other'] : ['Not the right program', 'No availability', 'Needs a different clinician', 'Other']}
        cta="Decline" onClose={close} onDone={r => done('declined', 'Declined', r)} />}
      {mode === 'delegate' && <DelegateOverlay n={n} client={client} onClose={close} onDone={(to, note) => done('delegated', 'Delegated to ' + sName(to), 'Removed from your queue.', { to, note })} />}
      {mode === 'propose' && <ProposeOverlay n={n} client={client} onClose={close} onDone={when => done('proposed', 'New time proposed', when + ' · sent to ' + sName(n.from_staff_id))} />}
      {mode === 'reply' && <ReplyOverlay n={n} client={client} onClose={close} onDone={() => done('replied', 'Reply sent', 'To ' + sName(n.from_staff_id) + '.')} />}
      {mode === 'intake' && <IntakeDateOverlay n={n} client={client} onClose={close} onDone={d => done('confirmed', 'Intake date confirmed', fmtDate(d) + ' · Hope Street Housing notified')} />}
      {mode === 'followup' && <FollowUpOverlay n={n} client={client} onClose={close} onDone={note => { setAlertStatus(n.notification_id, 'Follow-up documented'); done('followed-up', 'Follow-up documented', note ? 'A progress note draft was added to the chart.' : 'Alert closed.'); }} />}
      {mode === 'notes' && client && <ClientNotesOverlay client={client} onClose={close} />}
    </div>
  );
}

function NMore({ items, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menuRef = useRef(null);
  useOutside([ref, menuRef], () => setOpen(false));
  return (
    <span ref={ref} className="nmore">
      <Tooltip label={open ? null : 'More actions'}>
        <button className="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="dsUtil6" size={18} /></button>
      </Tooltip>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu" role="menu" minWidth={240} onClose={() => setOpen(false)}>
          <div className="dd-list">
            {items.map(it => (
              <button key={it.label} type="button" role="menuitem" aria-disabled={it.disabled || undefined}
                className={'dd-opt' + (it.reason ? ' dd-opt--rich' : '') + (it.disabled ? ' is-disabled' : '')}
                onClick={() => { if (it.disabled) return; setOpen(false); it.onClick(); }}>
                {it.reason ? <span className="dd-opt-main"><span className="dd-opt-label">{it.label}</span><span className="dd-opt-reason"><Icon name="lock" size={12} /> {it.reason}</span></span> : it.label}
              </button>
            ))}
          </div>
        </FloatMenu>
      )}
    </span>
  );
}

/* ---- Action dialogs ------------------------------------------------------ */
const NotifFacts = ({ n, client }) => (
  <div className="ovl-facts">
    <div><span>Client</span>{client ? client.name : '—'}</div>
    <div><span>From</span>{n.from_staff_id ? sName(n.from_staff_id) : n.feed || '—'}</div>
    <div><span>Received</span>{notifAgo(n.created)}</div>
    <div><span>{n.window_hours ? 'Follow-up window' : 'Due'}</span>{n.window_hours ? n.window_hours + ' hours' : n.due ? fmtDate(n.due) : '—'}</div>
  </div>
);

function ReviewOverlay({ n, client, onClose, onDone, onReturn }) {
  const A = TASK_ACTIONS[n.kind] || {};
  const verb = { cosign: 'Co-sign', signature: 'Sign', approval: 'Approve', order: 'Approve Order', lab: 'Acknowledge Result' }[n.kind] || 'Complete';
  const [attest, setAttest] = useState(false);
  const signs = n.kind === 'cosign' || n.kind === 'signature';
  return (
    <Overlay size="md" title={n.title} subtitle={client ? client.name : null} onClose={onClose}
      footer={<React.Fragment>
        {n.kind !== 'lab' && <Button variant="ghost" onClick={onReturn}>Return for Edits</Button>}
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={signs && !attest} onClick={() => onDone(n.kind, A.verb, 'Removed from your queue' + (client ? ' · ' + client.name : '') + '.')}>{verb}</Button>
      </React.Fragment>}>
      <NotifFacts n={n} client={client} />
      <div className="nreview-doc">
        <div className="nreview-doc-head"><Icon name="documents" size={16} /> {n.title.replace(/^(Co-sign|Sign|Approve|Review) /, '')}</div>
        <p>{n.detail}</p>
        <p className="ovl-hint">The full document opens here in production. The prototype shows a summary only.</p>
      </div>
      {signs && <div className="ovl-attest"><Checkbox checked={attest} onChange={setAttest} label="I’ve reviewed this document and attest that it is accurate." /></div>}
    </Overlay>
  );
}

function ReasonOverlay({ n, client, title, ask, reasons, cta, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const go = () => { setTried(true); if (!reason) return; onDone(reason + (note ? ' — ' + note : '')); };
  return (
    <Overlay size="sm" title={title} subtitle={n.title + (client ? ' · ' + client.name : '')} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>{cta}</Button></React.Fragment>}>
      <Field label={ask} required error={tried && !reason ? 'Choose a reason.' : null}>
        <Dropdown value={reason} options={reasons} onChange={setReason} invalid={tried && !reason} />
      </Field>
      <Field label="Comment" wide><TextArea value={note} onChange={setNote} rows={3} placeholder="Optional — the sender sees this." /></Field>
    </Overlay>
  );
}

function DelegateOverlay({ n, client, onClose, onDone }) {
  const staff = (RD.staff || []).filter(s => s.staff_id !== ME.id);
  const opts = staff.map(s => ({ value: s.staff_id, label: sName(s.staff_id), sub: roleName(s.role_id) }));
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  return (
    <Overlay size="sm" title="Delegate" subtitle={n.title + (client ? ' · ' + client.name : '')} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { setTried(true); if (to) onDone(to, note); }}>Delegate</Button></React.Fragment>}>
      <Field label="Delegate to" required error={tried && !to ? 'Choose someone to take this.' : null}>
        <Dropdown value={to} options={opts} onChange={setTo} invalid={tried && !to} menuMinWidth={300} />
      </Field>
      <Field label="Note for them" wide><TextArea value={note} onChange={setNote} rows={2} placeholder="Optional" /></Field>
      <div className="ovl-hint">It moves to their Approvals & Tasks and leaves yours. You can see who has it in the audit trail.</div>
    </Overlay>
  );
}

const SLOT_TIMES = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
function ProposeOverlay({ n, client, onClose, onDone }) {
  const [date, setDate] = useState(isoOf(addDays(TODAY, 3)));
  const [time, setTime] = useState('10:00 AM');
  return (
    <Overlay size="sm" title="Propose Another Time" subtitle={client ? client.name : null} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!date} onClick={() => onDone(fmtDate(date) + ' · ' + time)}>Send Proposal</Button></React.Fragment>}>
      <div className="ovl-hint">Requested: {n.slot}</div>
      <div className="ovl-grid ovl-grid--2">
        <DateField label="Date" required value={date} onChange={setDate} />
        <Field label="Time" required><Dropdown value={time} options={SLOT_TIMES} onChange={setTime} /></Field>
      </div>
    </Overlay>
  );
}

function ReplyOverlay({ n, client, onClose, onDone }) {
  const [text, setText] = useState('');
  return (
    <Overlay size="md" title={'Reply to ' + sName(n.from_staff_id)} subtitle={client ? 'About ' + client.name : null} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!text.trim()} onClick={onDone}>Send Reply</Button></React.Fragment>}>
      <div className="cn-msg nreply-msg">
        <span className="cn-gutter" />
        <Avatar name={sName(n.from_staff_id)} size="M" />
        <div className="cn-msg-main">
          <div className="cn-msg-head"><span className="cn-msg-name">{sName(n.from_staff_id)}</span><span className="cn-msg-time">{notifAgo(n.created)}</span></div>
          <div className="cn-bubble"><p>{n.detail}</p></div>
        </div>
      </div>
      <Field label="Your reply" wide><TextArea value={text} onChange={setText} rows={3} placeholder="Write a reply…" /></Field>
    </Overlay>
  );
}

function IntakeDateOverlay({ n, client, onClose, onDone }) {
  const [date, setDate] = useState(isoOf(addDays(TODAY, 7)));
  return (
    <Overlay size="sm" title="Confirm Intake Date" subtitle={client ? client.name + ' · Hope Street Housing' : null} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!date} onClick={() => onDone(date)}>Confirm</Button></React.Fragment>}>
      <div className="ovl-grid ovl-grid--2"><DateField label="Intake date" required value={date} onChange={setDate} /></div>
      <div className="ovl-hint">Confirm with the client first. The provider is notified when you save.</div>
    </Overlay>
  );
}

/* Closed loop on a clinical event: the alert only clears when the follow-up is
   documented, and documenting it drafts a progress note — so a supervisor can
   see it happened without a spreadsheet. */
function FollowUpOverlay({ n, client, onClose, onDone }) {
  const [how, setHow] = useState('');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState(true);
  const [tried, setTried] = useState(false);
  const go = () => { setTried(true); if (!how || !outcome.trim()) return; onDone(note); };
  return (
    <Overlay size="md" title="Document Follow-Up" subtitle={(client ? client.name + ' · ' : '') + n.title} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Save Follow-Up</Button></React.Fragment>}>
      <NotifFacts n={n} client={client} />
      <Field label="How did you follow up?" required error={tried && !how ? 'Choose how you followed up.' : null}>
        <RadioGroup name={'fu-' + n.notification_id} options={['Phone', 'In person', 'Video', 'Coordinated with facility', 'Unable to reach']} value={how} onChange={setHow} invalid={tried && !how} />
      </Field>
      <Field label="Outcome and next steps" required error={tried && !outcome.trim() ? 'Describe the outcome.' : null} wide>
        <TextArea value={outcome} onChange={setOutcome} rows={3} invalid={tried && !outcome.trim()} />
      </Field>
      <Checkbox checked={note} onChange={setNote} label="Draft a progress note from this follow-up" />
    </Overlay>
  );
}

/* ---- All Notifications page ----------------------------------------------- */
const NOTIF_DAYS = ['Any time', 'Today', 'Last 7 days', 'Last 30 days'];
function NotificationsPage({ tab }) {
  useNotifVersion();
  const guard = useGuard();
  const t = ['task', 'alert', 'general'].indexOf(tab) !== -1 ? tab : 'task';
  const [q, setQ] = useState('');
  const [type, setType] = useState('All types');
  const [clientF, setClientF] = useState('All clients');
  const [days, setDays] = useState('Any time');
  const [scope, setScope] = useState('All');
  const [sel, setSel] = useState([]);
  const [bulk, setBulk] = useState(null);
  useEffect(() => { setSel([]); setType('All types'); setScope('All'); }, [t]);

  const total = notifBellCount();
  const sub = total ? total + ' item' + (total === 1 ? '' : 's') + ' need' + (total === 1 ? 's' : '') + ' you' : 'Nothing needs you right now';

  const all = notifList(t);
  const types = ['All types'].concat([...new Set(all.map(notifType))].sort());
  const clientNames = ['All clients'].concat([...new Set(all.filter(n => n.client_id).map(n => CLIENT_BY_ID[n.client_id].name))].sort());
  const scopes = t === 'task' ? ['All', 'Only mine', 'Covering for others'] : t === 'alert' ? ['All', 'Urgent', 'Due & expiring'] : ['All', 'Unread'];
  const dayLimit = { 'Today': 1, 'Last 7 days': 7, 'Last 30 days': 30 }[days];
  const s = q.trim().toLowerCase();
  const filter = n => (type === 'All types' || notifType(n) === type)
    && (clientF === 'All clients' || (n.client_id && CLIENT_BY_ID[n.client_id].name === clientF))
    && (!dayLimit || (NOTIF_NOW - new Date(n.created)) / 86400000 <= dayLimit)
    && (scope === 'All' || (scope === 'Only mine' && !n.delegated_from) || (scope === 'Covering for others' && n.delegated_from)
      || (scope === 'Urgent' && n.urgent) || (scope === 'Due & expiring' && !n.urgent) || (scope === 'Unread' && !n.read))
    && (!s || [n.title, n.detail, n.client_id && CLIENT_BY_ID[n.client_id].name, n.from_staff_id && sName(n.from_staff_id)].join(' ').toLowerCase().indexOf(s) !== -1);
  const shown = all.filter(filter);
  const filtered = q || type !== 'All types' || clientF !== 'All clients' || days !== 'Any time' || scope !== 'All';
  const allOn = shown.length > 0 && shown.every(n => sel.indexOf(n.notification_id) !== -1);
  const chosen = shown.filter(n => sel.indexOf(n.notification_id) !== -1);
  const bulkDone = (title, detail) => { setSel([]); guard.setToast({ icon: 'check', title, detail }); };

  return (
    <div className="page npage">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]} />
      <div className="page-head-row">
        <div><h1 className="page-title">Notifications</h1><div className="page-sub">{sub}</div></div>
        <span className="spacer" />
        {/* A link to its own page, not a tab: preferences are reachable from
            anywhere (the flyout, account Preferences) and aren't a view of
            this list. */}
        <button className="lnk npref-link" onClick={() => guard.go('/notifications/preferences')}><Icon name="admin" size={15} /> Delivery Preferences</button>
      </div>
      <NotifTabs active={t} onSelect={k => guard.go('/notifications/' + k)} />
      {(
        <section className="panel npanel">
          <div className="nfilters">
            <span className="mini-search"><Icon name="search" size={16} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notifications…" aria-label="Search notifications" /></span>
            <div className="nfilter"><span className="nfilter-lbl">{t === 'task' ? 'Assigned' : t === 'alert' ? 'Urgency' : 'Show'}</span><Dropdown value={scope} options={scopes} onChange={setScope} /></div>
            <div className="nfilter"><span className="nfilter-lbl">Type</span><Dropdown value={type} options={types} onChange={setType} menuMinWidth={220} /></div>
            {t !== 'general' && <div className="nfilter"><span className="nfilter-lbl">Client</span><Dropdown value={clientF} options={clientNames} onChange={setClientF} menuMinWidth={220} /></div>}
            <div className="nfilter"><span className="nfilter-lbl">Received</span><Dropdown value={days} options={NOTIF_DAYS} onChange={setDays} /></div>
            {filtered && <button className="lnk" onClick={() => { setQ(''); setType('All types'); setClientF('All clients'); setDays('Any time'); setScope('All'); }}>Clear filters</button>}
          </div>
          {!!shown.length && (
            <div className={'nbulk' + (sel.length ? ' on' : '')}>
              <Checkbox checked={allOn} indeterminate={!allOn && !!chosen.length} onChange={v => setSel(v ? shown.map(n => n.notification_id) : [])} label={sel.length ? sel.length + ' selected' : 'Select all ' + shown.length} />
              <span className="spacer" />
              {t === 'task' && <Button size="sm" variant="secondary" disabled={!chosen.length} onClick={() => setBulk('delegate')}>Delegate Selected…</Button>}
              {t !== 'task' && <Button size="sm" variant="secondary" disabled={!chosen.length} onClick={() => { setNotifRead(chosen.map(n => n.notification_id), true); bulkDone('Marked as read', chosen.length + ' item' + (chosen.length === 1 ? '' : 's')); }}>Mark as Read</Button>}
              {t !== 'task' && <Button size="sm" variant="secondary" disabled={!chosen.length} onClick={() => { setNotifRead(chosen.map(n => n.notification_id), false); bulkDone('Marked as unread', chosen.length + ' item' + (chosen.length === 1 ? '' : 's')); }}>Mark as Unread</Button>}
              {t === 'general' && <Button size="sm" variant="secondary" disabled={!chosen.length} onClick={() => { chosen.forEach(n => resolveNotif(n.notification_id, 'dismissed')); bulkDone('Dismissed', chosen.length + ' item' + (chosen.length === 1 ? '' : 's')); }}>Dismiss</Button>}
            </div>
          )}
          <NotifGroupView cat={t} variant="page" filter={filtered ? filter : null} sel={sel} setSel={setSel} />
          {bulk === 'delegate' && <DelegateOverlay n={{ title: chosen.length + ' selected item' + (chosen.length === 1 ? '' : 's') }} onClose={() => setBulk(null)}
            onDone={to => { chosen.forEach(n => resolveNotif(n.notification_id, 'delegated', { to })); setBulk(null); bulkDone('Delegated to ' + sName(to), chosen.length + ' item' + (chosen.length === 1 ? '' : 's') + ' removed from your queue.'); }} />}
        </section>
      )}
    </div>
  );
}

/* ---- Delivery preferences page — /notifications/preferences ----------------
   Its own page under Notifications. One matrix per section: notification type
   × channel. Locked cells are the org's floor; "—" means never sent that way. */
function NotifPrefToggle({ on, locked, na, onChange, label }) {
  if (na) return <Tooltip label="Not sent this way"><span className="npref-na" aria-label={label + ': not available'}>—</span></Tooltip>;
  if (locked) return (
    <Tooltip label="Set by your organization — can’t be turned off">
      <span className="nlocked"><Toggle checked disabled onChange={() => {}} /><Icon name="lock" size={13} /></span>
    </Tooltip>
  );
  return <span aria-label={label}><Toggle checked={on} onChange={onChange} /></span>;
}

function NotifPreferencesPage() {
  const guard = useGuard();
  const [saved, setSaved] = useState(readNotifPrefs);
  const [p, setP] = useState(saved);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const setCell = (row, ch, v) => setP(x => ({ ...x, matrix: { ...x.matrix, [row]: { ...x.matrix[row], [ch]: v } } }));
  const setK = (k, v) => setP(x => ({ ...x, [k]: v }));
  const setSub = (k, sub, v) => setP(x => ({ ...x, [k]: { ...x[k], [sub]: v } }));
  const staff = (RD.staff || []).filter(s => s.staff_id !== ME.id);
  const covBad = p.coverage.on && (!p.coverage.to || !p.coverage.until);
  const save = () => { writeNotifPrefs(p); setSaved(p); guard.setToast({ icon: 'check', title: 'Delivery preferences saved', detail: 'Changes apply to new notifications.' }); };
  /* Turn a whole channel on or off for a section, skipping locked/n.a. cells. */
  const setColumn = (sec, ch, v) => setP(x => {
    const m = { ...x.matrix };
    sec.rows.forEach(r => { if (r.lock.indexOf(ch) === -1 && r.na.indexOf(ch) === -1) m[r.key] = { ...m[r.key], [ch]: v }; });
    return { ...x, matrix: m };
  });
  return (
    <div className="page npage nprefs">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Notifications', to: '/notifications' }, { label: 'Delivery Preferences' }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Delivery Preferences</h1>
          <div className="page-sub">Choose what reaches you, and where. A lock means your organization requires it.</div>
        </div>
      </div>

      <div className="chc-note chc-note--info nprefs-privacy"><Icon name="lock" size={15} />
        <div>Mobile push, email and text never include client names or clinical details. They say you have something waiting and link back to AxiomEHR, where you sign in to see it.</div>
      </div>

      {NOTIF_PREF_SECTIONS.map(sec => (
        <section key={sec.key} className="panel npanel">
          <div className="nprefs-sec-head">
            <div>
              <h2 className="nprefs-title">{sec.title}</h2>
              <p className="nprefs-sub">{sec.blurb}</p>
            </div>
            {sec.emailTiming && (
              <div className="nfilter"><span className="nfilter-lbl">Send email</span>
                <Dropdown value={p.emailTiming[sec.key]} options={EMAIL_TIMING} onChange={v => setSub('emailTiming', sec.key, v)} /></div>
            )}
          </div>
          <table className="data-table nprefs-table">
            <colgroup><col /><col style={{ width: 130 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} /></colgroup>
            <thead><tr>
              <th>Notification</th>
              {NOTIF_CHANNELS.map(c => {
                const editable = sec.rows.filter(r => r.lock.indexOf(c.key) === -1 && r.na.indexOf(c.key) === -1);
                const allOn = editable.length && editable.every(r => p.matrix[r.key][c.key]);
                return (
                  <th key={c.key}>
                    <Tooltip label={c.hint} placement="bottom"><span>{c.label}</span></Tooltip>
                    {editable.length > 1 && <button className="lnk npref-col" aria-label={(allOn ? 'Turn all off: ' : 'Turn all on: ') + c.label + ', ' + sec.title} onClick={() => setColumn(sec, c.key, !allOn)}>{allOn ? 'Turn all off' : 'Turn all on'}</button>}
                  </th>
                );
              })}
            </tr></thead>
            <tbody>{sec.rows.map(r => (
              <tr key={r.key}>
                <td className="wrap">
                  <span className="npref-lbl">{r.label}</span>
                  {r.sub && <div className="cell-sub">{r.sub}</div>}
                  {r.timing === 'reminderLead' && (
                    <div className="npref-timing"><span className="cell-sub">Remind me</span>
                      <Dropdown value={p.reminderLead} options={REMINDER_LEADS} onChange={v => setK('reminderLead', v)} /></div>
                  )}
                  {r.timing === 'dailyAt' && (
                    <div className="npref-timing"><span className="cell-sub">Send at</span>
                      <Dropdown value={p.dailyAt} options={DAILY_TIMES} onChange={v => setK('dailyAt', v)} /></div>
                  )}
                </td>
                {NOTIF_CHANNELS.map(c => (
                  <td key={c.key}>
                    <NotifPrefToggle label={r.label + ' — ' + c.label} on={!!p.matrix[r.key][c.key]}
                      locked={r.lock.indexOf(c.key) !== -1} na={r.na.indexOf(c.key) !== -1} onChange={v => setCell(r.key, c.key, v)} />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </section>
      ))}

      <section className="panel npanel">
        <h2 className="nprefs-title">Quiet Hours</h2>
        <p className="nprefs-sub">Hold mobile, email and text notifications overnight. They wait in AxiomEHR. Urgent client alerts still come through.</p>
        <div className="switch-row"><Toggle checked={p.quiet.on} onChange={v => setSub('quiet', 'on', v)} id="nquiet" /><label className="lbl" htmlFor="nquiet">Quiet hours</label></div>
        {p.quiet.on && (
          <div className="ovl-grid ovl-grid--3 ncov-grid">
            <Field label="From"><Dropdown value={p.quiet.from} options={QUIET_TIMES} onChange={v => setSub('quiet', 'from', v)} /></Field>
            <Field label="Until"><Dropdown value={p.quiet.to} options={QUIET_TIMES} onChange={v => setSub('quiet', 'to', v)} /></Field>
            <Field label="Daily digest arrives"><Dropdown value={p.digestAt} options={DAILY_TIMES} onChange={v => setK('digestAt', v)} /></Field>
          </div>
        )}
      </section>

      <section className="panel npanel">
        <h2 className="nprefs-title">Coverage While You’re Away</h2>
        <p className="nprefs-sub">Send your Approvals & Tasks to a colleague while you’re out, so nothing waits on you.</p>
        <div className="switch-row"><Toggle checked={p.coverage.on} onChange={v => setSub('coverage', 'on', v)} id="ncov" /><label className="lbl" htmlFor="ncov">I’m out of office</label></div>
        {p.coverage.on && (
          <div className="ovl-grid ovl-grid--2 ncov-grid">
            <Field label="Delegate to" required>
              <Dropdown value={p.coverage.to} options={staff.map(s => ({ value: s.staff_id, label: sName(s.staff_id), sub: roleName(s.role_id) }))} onChange={v => setSub('coverage', 'to', v)} menuMinWidth={300} />
            </Field>
            <DateField label="Until" required value={p.coverage.until} onChange={v => setSub('coverage', 'until', v)} />
          </div>
        )}
        <div className="ovl-hint">Urgent client alerts still reach you and your supervisor while you’re away.</div>
      </section>

      <div className={'nprefs-foot' + (dirty ? ' is-dirty' : '')}>
        {dirty && <span className="ovl-running">You have unsaved changes.</span>}
        <span className="spacer" />
        <Button variant="secondary" disabled={!dirty} onClick={() => setP(saved)}>Discard Changes</Button>
        <Button variant="primary" disabled={!dirty || covBad} onClick={save}>Save Preferences</Button>
      </div>
    </div>
  );
}

/* ---- Client Summary: Needs Attention -----------------------------------------
   The in-chart view of the notification center (research: surface alerts
   where the work happens, not only in a global inbox). Same rows, tags,
   countdowns and actions as Notifications, so an urgent alert looks just as
   urgent here — plus the summary's own due and expiring work, de-duplicated
   against what the notification center already says. */
function ClientAttentionPanel({ client, derived }) {
  useNotifVersion();
  const cid = client.client_id;
  /* One list, no categories — each row's button already says what to do.
     Order carries the urgency: urgent alerts (least time left first), then
     unread Important notes, then tasks, then due and expiring work. */
  const all = notifList('alert').concat(notifList('task')).filter(n => n.client_id === cid
    && (n.kind !== 'client-note' || (n.important && !n.read)));
  const rank = n => (n.urgent ? 0 : n.kind === 'client-note' ? 1 : n.category === 'task' ? 2 : 3);
  const items = all.slice().sort((x, y) => rank(x) - rank(y) || notifSort(x, y));
  const norm = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const said = items.filter(n => rank(n) === 3).map(n => norm(n.title));
  const extra = (derived || []).filter(d => !said.some(t => t.indexOf(norm(d.code || d.label)) !== -1))
    .sort((x, y) => (y.overdue - x.overdue) || ((x.when || 0) - (y.when || 0)));
  if (!items.length && !extra.length) return null;
  return (
    /* Plain title, no count or link: the work is here, in this client's
       context; the bell in the header is the way out to everything. */
    <Panel id="needs-attention" title="Needs Attention">
      <div className="attn-list">
        {items.map(n => <NotifRow key={n.notification_id} n={n} variant="chart" />)}
        {extra.map((d, i) => (
          <article key={'d' + i} className="nrow nrow--chart">
            <span className="nrow-gutter" />
            <div className="nrow-main">
              <div className="nrow-line1"><span className="nrow-title">{d.label}</span></div>
              <div className="nrow-meta"><NTag tone={d.overdue ? 'warn' : null}>{d.detail.charAt(0).toUpperCase() + d.detail.slice(1)}</NTag></div>
            </div>
            <div className="nrow-acts" />
          </article>
        ))}
      </div>
    </Panel>
  );
}

/* ---- Dashboard module ----------------------------------------------------- */
function ApprovalsTasksModule() {
  useNotifVersion();
  const guard = useGuard();
  const items = notifList('task');
  return (
    <Panel title={'Approvals & Tasks (' + items.length + ')'}
      action={<button className="lnk" onClick={() => guard.go('/notifications/task')}>View all</button>}>
      <div className="nmodule">
        {items.slice(0, 5).map(n => <NotifRow key={n.notification_id} n={n} variant="flyout" />)}
        {!items.length && <div className="ov-empty">Nothing waiting on you.</div>}
      </div>
    </Panel>
  );
}
