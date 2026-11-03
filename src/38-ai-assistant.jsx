/* ===== Header AI assistant ==========================================
   An add-on agencies buy. One drawer, two scopes, decided by whether a
   client is in context — not by which button opened it:

     Chat With Chart   a chart is open      about that one client only
     AI Assistant      no client in context  about my work: caseload,
                                            calendar, tasks

   Two ways in: the top-bar button (every page, left of the user's avatar)
   and Chat With Chart in the client header. With a chart open, both open
   the chart's conversation; the AI adopts the client automatically.

   The chart scope is a wall, not a filter. Nothing from another chart is
   read or shown, a question naming someone else is declined without saying
   whether they exist, and the general conversation (which names other
   clients) is hidden while a chart is open. The only way out of the chart
   scope is out of the chart: Close Chart goes Home through the guard, so
   unsaved work is intercepted like any other navigation.

   The top-bar button is the one deliberate departure from the DS: a frosted,
   theme-coloured glass button. At rest it's still. On hover (only) the
   colours inside drift and blend; with reduced motion they don't move at
   all. Keyboard focus gets the brighter resting state and a focus ring.

   The drawer is the Notifications flyout's size and position. It answers
   from what the user can already open — nothing outside their access, no
   writes to the chart, nothing sent. PROTOTYPE SCOPE: no model is called.
   The suggested prompts are answered from the prototype's own data;
   anything else gets an honest "not in the prototype" reply.
   ================================================================ */

/* Whether this agency has bought the AI add-on. Agency configuration in
   production; on here. Off removes both buttons entirely, not disabled ones. */
const AI_ADDON = { enabled: true };
const AI_NAME = 'AI Assistant';
const AI_CHART_NAME = 'Chat With Chart';

const AI_PROMPTS = [
  { key: 'today', label: 'Prepare me for today', sub: 'Your appointments, what to know about each client, and what’s due', icon: 'uiCalendarToday' },
  { key: 'week', label: 'What’s scheduled for the week?', sub: 'Appointments for the next seven days, by day', icon: 'uiCalendarWeekNumbers' },
  { key: 'tasks', label: 'What tasks do I have outstanding?', sub: 'Open tasks, overdue first', icon: 'uiTaskListLTR' },
];
/* The chart's prompts name the client by the name they go by. */
const aiChartPrompts = c => [
  { key: 'prep', label: 'Prepare me for my next session with ' + c.shortName, sub: 'When it is, what’s changed since you last met, and what to raise', icon: 'uiCalendarPerson' },
  { key: 'sentiment', label: 'What are some of the strongest sentiments in my documentation with ' + c.shortName + '?', sub: 'Themes across your own signed notes, with the notes they come from', icon: 'uiEmoji' },
  { key: 'due', label: 'What documentation is due or due soon for ' + c.shortName + '?', sub: 'Assessments, your unsigned notes, the service plan review and open tasks', icon: 'uiDocumentBulletListClock' },
];
/* Typed questions reach the same answers when they're clearly one of them;
   anything else is out of scope for the prototype. */
const aiRoute = q => {
  const s = q.toLowerCase();
  if (/prepare|today|my day/.test(s)) return 'today';
  if (/week|schedul|calendar|appointment/.test(s)) return 'week';
  if (/task|outstanding|to.?do|overdue|due/.test(s)) return 'tasks';
  return 'other';
};
/* In a chart, a question that names another client is declined first —
   before any keyword could route it to an answer. Matched on capitalised
   names, and never on a name the chart's own client shares. */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namesOther = (text, client) => {
  const own = [client.first_name, client.last_name, client.preferred_name].filter(Boolean);
  return Object.values(CLIENT_BY_ID).some(c => c.client_id !== client.client_id
    && [c.first_name, c.last_name, c.preferred_name].some(w => w && w.length > 2 && own.indexOf(w) === -1 && new RegExp('\\b' + reEsc(w) + '\\b').test(text)));
};
const aiChartRoute = (q, client) => {
  if (namesOther(q, client)) return 'elsewhere';
  const s = q.toLowerCase();
  if (/sentiment|feel|mood|theme|tone/.test(s)) return 'sentiment';
  if (/due|overdue|documentation|paperwork|unsigned|sign/.test(s)) return 'due';
  if (/prepare|prep|next session|next appointment|meet/.test(s)) return 'prep';
  if (/caseload|my (day|week|schedule|calendar|tasks)|other clients|everyone/.test(s)) return 'mine';
  return 'other';
};

/* The general conversation lasts for the session: closing the drawer keeps
   it, New Conversation and signing out clear it. A chart's conversation
   lasts only while that chart is in context — switching clients or going
   Home ends it, so it can never be reopened against someone else. */
let AI_THREAD = [];
let AI_CHART = { cid: null, thread: [] };
const aiForget = () => { AI_THREAD = []; AI_CHART = { cid: null, thread: [] }; };
const aiTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* Both buttons open the same drawer, so whether it's open is shared. */
let AI_OPEN = false;
const AI_SUBS = new Set();
const setAiOpen = v => { AI_OPEN = v; AI_SUBS.forEach(f => f(v)); };
function useAiOpen() {
  const [open, setOpen] = useState(AI_OPEN);
  useEffect(() => { AI_SUBS.add(setOpen); return () => { AI_SUBS.delete(setOpen); }; }, []);
  return open;
}

/* ---- The buttons ----------------------------------------------------- */
/* The top bar's button is always mounted, so it owns the drawer. */
function AiAssistButton() {
  const guard = useGuard();
  const open = useAiOpen();
  const client = guard.client;
  useEffect(() => { if (AI_CHART.cid && AI_CHART.cid !== guard.clientId) AI_CHART = { cid: null, thread: [] }; }, [guard.clientId]);
  if (!AI_ADDON.enabled) return null;
  return (
    <React.Fragment>
      <Tooltip label={client ? AI_NAME + ': ' + client.shortName + '’s chart' : AI_NAME} placement="bottom">
        <button className="tn-ai" aria-label={AI_NAME} aria-haspopup="dialog" aria-expanded={open} onClick={() => setAiOpen(true)}>
          <span className="tn-ai-glow" aria-hidden="true"><span className="tn-ai-blob b1" /><span className="tn-ai-blob b2" /><span className="tn-ai-blob b3" /></span>
          <Icon name="uiChatSparkle" size={20} />
        </button>
      </Tooltip>
      {/* Keyed by scope: a different client (or none) is a different
          conversation, never the same one re-labelled. */}
      {open && <AiDrawer key={client ? client.client_id : 'me'} client={client} onClose={() => setAiOpen(false)} />}
    </React.Fragment>
  );
}

/* On a phone the button is pinned beside the name, in space that can't grow,
   so its label shortens to "Chat". Its accessible name stays the full one.
   In the Admin preview the header is a picture of a header: nothing opens. */
function ChatWithChartButton({ compact, preview }) {
  const open = useAiOpen();
  if (!AI_ADDON.enabled) return null;
  return (
    <button className={'cph-chat' + (compact ? ' cph-chat--compact' : '')} aria-label={compact ? AI_CHART_NAME : undefined}
      aria-haspopup="dialog" aria-expanded={preview ? undefined : open} onClick={preview ? undefined : () => setAiOpen(true)}>
      <Icon name="dsSparkle" size={compact ? 16 : 20} />
      <span>{compact ? 'Chat' : AI_CHART_NAME}</span>
    </button>
  );
}

/* ---- The drawer ------------------------------------------------------ */
function AiDrawer({ client, onClose }) {
  const guard = useGuard();
  const cid = client ? client.client_id : null;
  const prompts = client ? aiChartPrompts(client) : AI_PROMPTS;
  const [thread, setThread] = useState(client ? (AI_CHART.cid === cid ? AI_CHART.thread : []) : AI_THREAD);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null), bodyRef = useRef(null), timer = useRef(null);
  useEffect(() => { if (client) AI_CHART = { cid, thread }; else AI_THREAD = thread; }, [thread]);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    /* The guard's own dialog handles Escape while it's up. */
    const k = e => { if (e.key === 'Escape' && !document.querySelector('.ovl, .float-menu, .intercept')) onClose(); };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); clearTimeout(timer.current); };
  }, []);
  useEffect(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; }, [thread.length, busy]);

  const ask = (text, key) => {
    const t = text.trim();
    if (!t || busy) return;
    setThread(x => x.concat([{ id: 'u' + x.length, role: 'user', text: t }]));
    setQ(''); setBusy(true);
    /* A short pause, so the answer reads as an answer and not a page swap. */
    timer.current = setTimeout(() => {
      setThread(x => x.concat([{ id: 'a' + x.length, role: 'ai', kind: key || (client ? aiChartRoute(t, client) : aiRoute(t)), at: aiTime() }]));
      setBusy(false);
    }, 900);
  };
  /* Opening a client from an answer is a normal client switch: the guard
     intercepts unsaved work, and the drawer closes. */
  const openClient = cid => { onClose(); guard.setClient(cid); };
  const go = to => { onClose(); guard.go(to); };
  /* Leaving the chart is the only way out of its scope. The drawer stays
     open and, once the guard lets the move through, re-opens on Home in the
     general scope; cancelled, nothing changes. */
  const closeChart = () => guard.clearClient();
  const first = ME.name.split(' ')[0];
  const hour = new Date().getHours();
  const title = client ? AI_CHART_NAME : AI_NAME;

  return ReactDOM.createPortal(
    <React.Fragment>
      <div className="flyout-scrim" onClick={onClose} />
      <aside className="nfly aid" role="dialog" aria-modal="true" aria-labelledby="aid-title">
        <header className="nfly-head">
          <span className="aid-mark" aria-hidden="true"><Icon name="uiChatSparkle" size={18} /></span>
          <h2 id="aid-title">{title}</h2>
          <span className="spacer" />
          {thread.length > 0 && (
            <Tooltip label="New conversation" placement="bottom">
              <button className="icon-btn" aria-label="New conversation" disabled={busy} onClick={() => { setThread([]); if (inputRef.current) inputRef.current.focus(); }}>
                <Icon name="uiArrowCounterclockwise" size={18} />
              </button>
            </Tooltip>
          )}
          <button className="icon-btn" aria-label={'Close ' + title} onClick={onClose}><Icon name="close" size={20} /></button>
        </header>

        {client && (
          <div className="aid-ctx" role="group" aria-label="Chart in context">
            <Avatar name={client.name} size="M" />
            <div className="aid-ctx-who">
              <div className="aid-ctx-name">{client.displayName}</div>
              <div className="aid-ctx-sub">DOB {fmtDate(client.dob)} · Answers use this chart only</div>
            </div>
            <Tooltip label="Closes the chart and goes Home, where you can ask about your own work" placement="bottom" wide>
              <Button size="sm" variant="secondary" disabled={busy} onClick={closeChart}><Icon name="home" size={14} /> Close Chart</Button>
            </Tooltip>
          </div>
        )}

        <div className="nfly-body aid-body" ref={bodyRef} aria-live="polite">
          {!thread.length ? (
            <div className="aid-start">
              <div className="aid-hello">{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, {first}.</div>
              <p className="aid-scope">{client
                ? 'Ask about ' + client.shortName + '. Answers come only from this chart, never from anyone else’s, and nothing on it changes unless you change it.'
                : 'Ask about your clients, schedule and tasks. Answers come only from what you can already open, and nothing on a chart changes unless you change it.'}</p>
              <div className="aid-prompts">
                {prompts.map(p => (
                  <button key={p.key} type="button" className="aid-prompt" onClick={() => ask(p.label, p.key)}>
                    <span className="aid-prompt-ico"><Icon name={p.icon} size={20} /></span>
                    <span className="aid-prompt-text"><span className="aid-prompt-name">{p.label}</span><span className="aid-prompt-sub">{p.sub}</span></span>
                  </button>
                ))}
              </div>
            </div>
          ) : thread.map(m => (m.role === 'user'
            ? <div key={m.id} className="aid-q"><span>{m.text}</span></div>
            : <AiAnswer key={m.id} msg={m} client={client} onOpenClient={openClient} onGo={go} />))}
          {busy && <div className="aid-busy" role="status"><span className="aid-dots" aria-hidden="true"><i /><i /><i /></span>{client ? 'Reading ' + client.shortName + '’s chart…' : 'Looking through your caseload…'}</div>}
        </div>

        <footer className="aid-foot">
          {thread.length > 0 && (
            <div className="aid-chips" aria-label="Suggested questions">
              {prompts.map(p => <button key={p.key} type="button" className="aid-chip" disabled={busy} onClick={() => ask(p.label, p.key)}>{p.label}</button>)}
            </div>
          )}
          <div className="aid-compose">
            <textarea ref={inputRef} className="aid-input" rows={2} value={q} aria-label={'Ask ' + title}
              placeholder={client ? 'Ask about ' + client.shortName + '…' : 'Ask about your clients, schedule or tasks…'}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q); } }} />
            <Tooltip label={q.trim() ? 'Send' : 'Type a question first'} placement="top">
              <button className="aid-send" aria-label="Send" disabled={!q.trim() || busy} onClick={() => ask(q)}><Icon name="uiArrowUp" size={18} /></button>
            </Tooltip>
          </div>
          <div className="aid-disclaim">AI can be wrong. Check anything you act on against the chart.</div>
        </footer>
      </aside>
    </React.Fragment>,
    document.body);
}

/* ---- Answers ----------------------------------------------------------
   Built from the prototype's own data, so they match the rest of the app:
   appointments, the notifications store, attributes, assessments. Every
   client name opens their chart; every answer says what it's based on. */
const myAppts = (from, days) => {
  const end = addDays(from, days);
  return (RD.appointments || []).filter(a => a.staff_id === ME.id).map(a => ({ ...a, when: apptWhen(a) }))
    .filter(a => a.when && a.when >= from && a.when < end && !needsAccessRequest(a.client_id))
    .sort((a, b) => a.when - b.when);
};
const apptTime = a => noteTime('0000-00-00T' + a.start_time);
const dayName = d => d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

function AiClient({ cid, onOpen }) {
  const c = CLIENT_BY_ID[cid];
  if (!c) return null;
  return <button className="lnk aid-client" onClick={() => onOpen(cid)}>{c.preferred_name ? c.preferred_name + ' ' + c.last_name : c.name}</button>;
}

function AiAnswer({ msg, client, onOpenClient, onGo }) {
  const guard = useGuard();
  const ref = useRef(null);
  const n = client && client.shortName;
  /* A chart's answers never come from the general set, and the reverse:
     the scope decides which answers exist at all. */
  const body = client ? (
    msg.kind === 'prep' ? <AiPrep client={client} onGo={onGo} />
    : msg.kind === 'sentiment' ? <AiSentiment client={client} onGo={onGo} />
    : msg.kind === 'due' ? <AiDue client={client} onGo={onGo} />
    /* Declined without saying whether that person is a client here. */
    : msg.kind === 'elsewhere' ? <p>While {n}’s chart is open, I can only answer about {n}. To ask about someone else, open their chart.</p>
    : msg.kind === 'mine' ? <p>While {n}’s chart is open, I can only answer about {n}. For your caseload, schedule or tasks, use <b>Close Chart</b> above. It takes you Home, where I can answer about your own work.</p>
    : <p>I can’t answer that in this prototype. In the product, I’d answer from {n}’s chart only. Here, try one of the suggested questions below.</p>
  ) : msg.kind === 'today' ? <AiToday onOpen={onOpenClient} />
    : msg.kind === 'week' ? <AiWeek onOpen={onOpenClient} />
    : msg.kind === 'tasks' ? <AiTasks onOpen={onOpenClient} onGo={onGo} />
    : <p>I can’t answer that in this prototype. In the product, I’d answer from the records you can open. Here, try one of the suggested questions below.</p>;
  const sources = client
    ? { prep: n + '’s appointments, documents, assessments, attributes and diagnoses', sentiment: 'Your signed notes on ' + n + '’s chart', due: n + '’s assessments, service plan, tasks and your notes' }[msg.kind]
    : { today: 'Calendar, notifications, client attributes and assessments', week: 'Calendar', tasks: 'Notifications' }[msg.kind];
  const copy = () => {
    const text = ref.current ? ref.current.innerText : '';
    try { navigator.clipboard.writeText(text); } catch (e) {}
    guard.setToast({ status: 'success', title: 'Answer copied' });
  };
  return (
    <article className="aid-a">
      <div className="aid-a-tag"><Icon name="uiChatSparkle" size={14} /> AI-generated · {msg.at}</div>
      <div className="aid-a-body" ref={ref}>{body}</div>
      <div className="aid-a-foot">
        {sources && <span className="aid-a-src">Based on: {sources}</span>}
        <span className="spacer" />
        <button className="lnk" onClick={copy}>Copy</button>
      </div>
    </article>
  );
}

function AiToday({ onOpen }) {
  const appts = myAppts(TODAY, 1);
  const tasks = notifList('task').filter(n => n.due && _parse(n.due) <= TODAY);
  const urgent = notifList('alert').filter(n => n.urgent && !n.read);
  const flagsFor = cid => {
    const c = CLIENT_BY_ID[cid]; if (!c) return [];
    const hi = activeAttrs(c).filter(r => r.attribute.priority === 'high').map(r => r.attribute.name);
    const due = dueAssessmentsFor(c).filter(a => a.days < 0).map(a => (CATALOG_SHORT[a.code] || a.code) + ' overdue');
    const notes = getNotes(c).filter(noteNeedsRead).length;
    return hi.concat(due).concat(notes ? [notes + ' unread care-team note' + (notes === 1 ? '' : 's')] : []);
  };
  return (
    <React.Fragment>
      <p>Here’s your {dayName(TODAY)}: <b>{appts.length} appointment{appts.length === 1 ? '' : 's'}</b>, <b>{tasks.length} task{tasks.length === 1 ? '' : 's'}</b> due or overdue{urgent.length ? <React.Fragment>, and <b>{urgent.length} urgent alert{urgent.length === 1 ? '' : 's'}</b></React.Fragment> : null}.</p>
      {appts.length > 0 && (
        <React.Fragment>
          <h3 className="aid-h">Your appointments</h3>
          <ol className="aid-list">{appts.map(a => {
            const flags = flagsFor(a.client_id);
            return (
              <li key={a.appointment_id}>
                <span className="aid-when">{apptTime(a)}</span>
                <span className="aid-what"><AiClient cid={a.client_id} onOpen={onOpen} /> · {a.appointment_reason}
                  {flags.length > 0 && <span className="aid-flags">Before you meet: {flags.join(' · ')}</span>}
                </span>
              </li>
            );
          })}</ol>
        </React.Fragment>
      )}
      {tasks.length > 0 && (
        <React.Fragment>
          <h3 className="aid-h">Due today or overdue</h3>
          <ul className="aid-list">{tasks.slice(0, 4).map(n => (
            <li key={n.notification_id}><span className="aid-what">{n.title}{n.client_id && <React.Fragment> · <AiClient cid={n.client_id} onOpen={onOpen} /></React.Fragment>}
              <span className="aid-flags">{_parse(n.due) < TODAY ? 'Overdue since ' + fmtDate(n.due) : 'Due today'}</span></span></li>
          ))}</ul>
          {tasks.length > 4 && <p className="aid-more">And {tasks.length - 4} more. Ask “What tasks do I have outstanding?” for the full list.</p>}
        </React.Fragment>
      )}
      {urgent.length > 0 && (
        <React.Fragment>
          <h3 className="aid-h">Urgent alerts</h3>
          <ul className="aid-list">{urgent.slice(0, 3).map(n => (
            <li key={n.notification_id}><span className="aid-what">{n.title}{n.client_id && <React.Fragment> · <AiClient cid={n.client_id} onOpen={onOpen} /></React.Fragment>}</span></li>
          ))}</ul>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

function AiWeek({ onOpen }) {
  const appts = myAppts(TODAY, 7);
  const days = [];
  appts.forEach(a => { const k = isoOf(a.when); let d = days.find(x => x.k === k); if (!d) days.push(d = { k, when: a.when, rows: [] }); d.rows.push(a); });
  const tele = appts.filter(a => /Online/.test(a.meeting_type)).length;
  return (
    <React.Fragment>
      <p>You have <b>{appts.length} appointments</b> over the next seven days{tele ? ', ' + tele + ' of them telehealth' : ''}.</p>
      {days.map(d => (
        <React.Fragment key={d.k}>
          <h3 className="aid-h">{isoOf(d.when) === isoOf(TODAY) ? 'Today, ' : ''}{dayName(d.when)}</h3>
          <ol className="aid-list">{d.rows.map(a => (
            <li key={a.appointment_id}><span className="aid-when">{apptTime(a)}</span>
              <span className="aid-what"><AiClient cid={a.client_id} onOpen={onOpen} /> · {a.appointment_reason} · {a.duration_minutes} min</span></li>
          ))}</ol>
        </React.Fragment>
      ))}
      {!appts.length && <p>Nothing is scheduled with you this week.</p>}
    </React.Fragment>
  );
}

function AiTasks({ onOpen, onGo }) {
  const open = notifList('task').filter(n => n.status === 'open');
  const overdue = open.filter(n => n.due && _parse(n.due) < TODAY);
  const week = open.filter(n => n.due && _parse(n.due) >= TODAY && _parse(n.due) < addDays(TODAY, 7));
  const later = open.filter(n => overdue.indexOf(n) === -1 && week.indexOf(n) === -1);
  const group = (title, rows) => rows.length > 0 && (
    <React.Fragment key={title}>
      <h3 className="aid-h">{title} ({rows.length})</h3>
      <ul className="aid-list">{rows.map(n => (
        <li key={n.notification_id}><span className="aid-what">{n.title}{n.client_id && <React.Fragment> · <AiClient cid={n.client_id} onOpen={onOpen} /></React.Fragment>}
          <span className="aid-flags">{n.due ? (_parse(n.due) < TODAY ? 'Overdue since ' : 'Due ') + fmtDate(n.due) : 'No due date'}</span></span></li>
      ))}</ul>
    </React.Fragment>
  );
  return (
    <React.Fragment>
      <p>You have <b>{open.length} open task{open.length === 1 ? '' : 's'}</b>{overdue.length ? ', ' + overdue.length + ' overdue' : ''}.</p>
      {group('Overdue', overdue)}{group('Due this week', week)}{group('Later or no due date', later)}
      <p className="aid-more"><button className="lnk" onClick={() => onGo('/notifications/task')}>Open your tasks in Notifications</button> to work through them.</p>
    </React.Fragment>
  );
}

/* ---- Chart answers ----------------------------------------------------
   Everything here reads one client: the chart in context. No answer looks
   up another client, and links stay inside this chart (going anywhere
   else is the guard's business, as it is from any page). */
const relDay = d => {
  const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - TODAY) / 86400000);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : dayName(d);
};
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const chartAppts = c => getAppointments(c).map(a => ({ ...a, when: apptWhen(a), outcome: apptOutcome(a, TODAY) })).filter(a => a.when);

function AiPrep({ client, onGo }) {
  const cid = client.client_id, n = client.shortName;
  const appts = chartAppts(client);
  const next = appts.filter(a => a.staff_id === ME.id && a.outcome === 'Scheduled' && a.when >= TODAY).sort((a, b) => a.when - b.when)[0];
  const other = !next && appts.filter(a => a.outcome === 'Scheduled' && a.when >= TODAY).sort((a, b) => a.when - b.when)[0];
  const last = appts.filter(a => a.staff_id === ME.id && a.outcome === 'Attended' && a.when < TODAY).sort((a, b) => b.when - a.when)[0];
  const since = last ? last.when : addDays(TODAY, -30);
  const docs = clientDocs(cid, 10).filter(d => d.at > since && d.kind !== 'Upload');
  const scores = assessmentRows(client).filter(r => r.score);
  const newScores = scores.filter(r => _parse(r.date) > since);
  const unread = getNotes(client).filter(noteNeedsRead).length;
  const hi = activeAttrs(client).filter(r => r.attribute.priority === 'high').map(r => r.attribute.name);
  const dx = getDiagnoses(client).filter(d => isActiveStatus(d.status)).slice(0, 3);
  /* The same due list as the documentation answer, so the two never disagree. */
  const due = assessmentRows(client, true).filter(r => r.next).map(r => ({ key: r.key, name: r.name, days: Math.round((_parse(r.next) - TODAY) / 86400000) }))
    .filter(r => r.days <= 14).sort((x, y) => x.days - y.days);
  const openDoc = d => onGo('/chart/' + cid + '/doc-' + slugify(d.id));
  return (
    <React.Fragment>
      {next ? <p>Your next session with {n} is <b>{relDay(next.when)} at {apptTime(next)}</b>: {next.appointment_reason}, {next.duration_minutes} min, {/Online/.test(next.meeting_type) ? 'telehealth' : 'in person'}.</p>
        : <p>You don’t have a session booked with {n}.{other ? ' Their next appointment is ' + relDay(other.when) + ' at ' + apptTime(other) + ' with ' + sName(other.staff_id) + '.' : ''} Here’s where things stand on the chart.</p>}

      <h3 className="aid-h">{last ? 'Since you last met (' + fmtDate(last.date) + ')' : 'In the last 30 days'}</h3>
      <ul className="aid-list">
        {docs.slice(0, 4).map(d => (
          <li key={d.id}><span className="aid-what"><button className="lnk" onClick={() => openDoc(d)}>{d.name}</button> · {d.byId === ME.id ? 'you' : d.by}
            <span className="aid-flags">{fmtDate(d.at)}{d.status !== 'Signed' ? ' · ' + d.status : ''}</span></span></li>
        ))}
        {newScores.map(r => (
          <li key={r.key}><span className="aid-what">New {r.name}: <b>{r.score}</b>{r.band ? ' · ' + r.band.label : ''}<span className="aid-flags">{fmtDate(r.date)}</span></span></li>
        ))}
        {!docs.length && !newScores.length && <li><span className="aid-what">Nothing new on the chart.</span></li>}
      </ul>
      {docs.length > 4 && <p className="aid-more">And {docs.length - 4} more in Documents.</p>}

      <h3 className="aid-h">Keep in mind</h3>
      <ul className="aid-list">
        {hi.length > 0 && <li><span className="aid-what">High-priority attributes: {hi.join(', ')}</span></li>}
        {dx.length > 0 && <li><span className="aid-what">Active diagnoses: {dx.map(d => d.description).join('; ')}</span></li>}
        {scores.slice(0, 2).map(r => <li key={'s' + r.key}><span className="aid-what">Latest {r.name}: {r.score}{r.band ? ' · ' + r.band.label : ''} ({fmtDate(r.date)})</span></li>)}
        {unread > 0 && <li><span className="aid-what">{plural(unread, 'unread care-team note')} on the chart</span></li>}
        {!hi.length && !dx.length && !scores.length && !unread && <li><span className="aid-what">No flags, diagnoses or scores to note.</span></li>}
      </ul>

      {due.length > 0 && (
        <React.Fragment>
          <h3 className="aid-h">Worth raising</h3>
          <ul className="aid-list">{due.map(a => (
            <li key={a.key}><span className="aid-what">{a.name} is {a.days < 0 ? Math.abs(a.days) + ' days overdue' : a.days === 0 ? 'due today' : 'due in ' + plural(a.days, 'day')}. It could be done in session.</span></li>
          ))}</ul>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

/* Prototype: there's no note text to read, so the themes are a fixed pool,
   picked per chart and tied to real (fictional) notes the user wrote. The
   answer cites notes rather than quoting them. */
const AI_SENTIMENTS = {
  Positive: ['Hopeful about the new housing placement', 'Proud of keeping a regular sleep routine', 'Feels more supported by family since the joint session', 'Motivated by the part-time job search'],
  Concern: ['Anxious about an upcoming court date', 'Frustrated with medication side effects', 'Feeling isolated since moving', 'Worried about losing benefits at renewal'],
  Mixed: ['Mixed feelings about returning to school', 'Ambivalent about group sessions'],
};
const TONE_TAG = { Positive: 'is-good', Concern: 'is-warn', Mixed: '' };

function AiSentiment({ client, onGo }) {
  const cid = client.client_id, n = client.shortName;
  const mine = clientDocs(cid, 10).filter(d => d.byId === ME.id && d.kind === 'Note');
  const signed = mine.filter(d => d.status === 'Signed');
  if (!signed.length) return <p>You don’t have signed notes on {n}’s chart yet, so there’s nothing of yours to read.{mine.length ? ' ' + plural(mine.length, 'note') + ' of yours aren’t signed yet; I leave drafts out.' : ''} I don’t read colleagues’ notes for this question.</p>;
  const themes = [['Positive', 0], ['Concern', 0], [seed(cid + 'tone') % 2 ? 'Mixed' : 'Positive', 1]].map(([tone, k], i) => {
    const pool = AI_SENTIMENTS[tone];
    const cites = signed.filter((_, j) => (j + i) % 2 === 0 || signed.length === 1);
    return { tone, label: pool[(seed(cid + 'sent' + tone) + k) % pool.length], cites };
  });
  const openDoc = d => onGo('/chart/' + cid + '/doc-' + slugify(d.id));
  return (
    <React.Fragment>
      <p>Across your <b>{plural(signed.length, 'signed note')}</b> with {n} ({fmtDate(signed[signed.length - 1].at)} to {fmtDate(signed[0].at)}), these come through most strongly:</p>
      <ul className="aid-list">{themes.map(t => (
        <li key={t.label}><span className={'cph-qv-tag aid-tone ' + TONE_TAG[t.tone]}>{t.tone}</span>
          <span className="aid-what">{t.label}
            <span className="aid-flags">In {t.cites.length} of your notes · most recently <button className="lnk" onClick={() => openDoc(t.cites[0])}>{t.cites[0].name}, {fmtDate(t.cites[0].at)}</button></span></span></li>
      ))}</ul>
      <p className="aid-more">Read from your signed notes on this chart only. Drafts and colleagues’ notes are left out. Sentiment is a reading of your wording, not a clinical finding.</p>
    </React.Fragment>
  );
}

function AiDue({ client, onGo }) {
  const cid = client.client_id, n = client.shortName;
  const days = iso => Math.round((_parse(iso) - TODAY) / 86400000);
  const assess = assessmentRows(client, true).filter(r => r.next).map(r => ({ id: 'a' + r.key, label: r.name, days: days(r.next), to: r.module ? '/chart/' + cid + '/' + slugify(r.module) : null, what: 'Assessment' }));
  const plan = getServicePlans(client).find(p => p.status === 'Active' && p.review_date);
  const planRow = plan && { id: 'plan', label: (plan.plan_type ? plan.plan_type + ' ' : '') + 'service plan review', days: days(plan.review_date), to: '/chart/' + cid + '/service-plan', what: 'Service plan' };
  const tasks = notifList('task').filter(t => t.client_id === cid && t.status === 'open' && t.due).map(t => ({ id: t.notification_id, label: t.title, days: days(t.due), to: null, what: 'Task' }));
  const rows = assess.concat(planRow ? [planRow] : []).concat(tasks);
  const overdue = rows.filter(r => r.days < 0).sort((a, b) => a.days - b.days);
  const soon = rows.filter(r => r.days >= 0 && r.days <= 30).sort((a, b) => a.days - b.days);
  const drafts = clientDocs(cid, 10).filter(d => d.byId === ME.id && d.status !== 'Signed');
  const unfinished = incompleteNotes(client);
  const when = r => r.days < 0 ? plural(Math.abs(r.days), 'day') + ' overdue' : r.days === 0 ? 'Due today' : 'Due in ' + plural(r.days, 'day');
  const group = (title, list) => list.length > 0 && (
    <React.Fragment key={title}>
      <h3 className="aid-h">{title} ({list.length})</h3>
      <ul className="aid-list">{list.map(r => (
        <li key={r.id}><span className="aid-what">{r.to ? <button className="lnk" onClick={() => onGo(r.to)}>{r.label}</button> : r.label} · {r.what}
          <span className="aid-flags">{when(r)}</span></span></li>
      ))}</ul>
    </React.Fragment>
  );
  return (
    <React.Fragment>
      <p>For {n}: <b>{overdue.length} overdue</b>, <b>{soon.length} due in the next 30 days</b>{drafts.length + unfinished.length ? <React.Fragment>, and <b>{plural(drafts.length + unfinished.length, 'note')}</b> of yours to finish or sign</React.Fragment> : null}.</p>
      {group('Overdue', overdue)}{group('Due in the next 30 days', soon)}
      {(drafts.length > 0 || unfinished.length > 0) && (
        <React.Fragment>
          <h3 className="aid-h">Your notes to finish or sign ({drafts.length + unfinished.length})</h3>
          <ul className="aid-list">
            {unfinished.map(i => <li key={'u' + i.doc}><span className="aid-what">{i.doc}<span className="aid-flags">{i.meta}</span></span></li>)}
            {drafts.map(d => <li key={d.id}><span className="aid-what"><button className="lnk" onClick={() => onGo('/chart/' + cid + '/doc-' + slugify(d.id))}>{d.name}</button>
              <span className="aid-flags">{fmtDate(d.at)} · {d.status === 'Draft' ? 'Draft' : 'Waiting on co-signature'}</span></span></li>)}
          </ul>
        </React.Fragment>
      )}
      {!overdue.length && !soon.length && !drafts.length && !unfinished.length && <p>Nothing is due on {n}’s chart in the next 30 days.</p>}
    </React.Fragment>
  );
}
