/* ===== Notification center — store and rules ========================
   Three groups, ordered by what happens if the item is missed rather than by
   where the data came from (see tools/build-notification-fixtures.py):

     task     Approvals & Tasks — assigned to me, waiting on me. Every open one
              counts in the bell, read or not. It leaves the list only when it
              is actioned: signed, approved, returned, delegated, declined…
     alert    Client Alerts. Urgent ones (hospitalization, crisis call…) count
              until I've marked them read, and stay open until the follow-up is
              documented. Care-team notes marked Important also count until
              read. The rest — due, expiring, assigned, other notes — show an
              unread dot and never a number.
     general  General & System. Never counted; unread dot only.

   PROTOTYPE SCOPE. Session edits live in memory (a reload starts clean),
   except delivery preferences, which persist in localStorage like the other
   user preferences. Every write here is something a real build would POST.
   ================================================================ */

const NOTIF_EVT = 'axiom-notifs-changed';
/* The prototype's "now" — the same instant the fixture generator used. */
const NOTIF_NOW = new Date('2026-09-22T16:00:00');
const NSESSION = {
  read: {},        // id -> bool, overrides the fixture
  status: {},      // id -> alert follow-up status
  done: {},        // id -> { action, at, to?, note? } — task actioned / item dismissed
  nudged: {},      // id -> true (reminder sent on a waiting item)
  draft: {},       // id -> note type started from this notification
};
const touchNotifs = () => window.dispatchEvent(new Event(NOTIF_EVT));
/* Also listens for record changes: care-team notes live in the records store,
   and marking one read in the Client Notes thread must show here too. */
function useNotifVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV(x => x + 1);
    window.addEventListener(NOTIF_EVT, f);
    window.addEventListener(RECORDS_EVT, f);
    return () => { window.removeEventListener(NOTIF_EVT, f); window.removeEventListener(RECORDS_EVT, f); };
  }, []);
  return v;
}

const NOTIF_GROUPS = [
  { key: 'task', label: 'Approvals & Tasks', blurb: 'Waiting on you. These stay until you act on them.' },
  { key: 'alert', label: 'Client Alerts', blurb: 'What you need to know to care for your clients.' },
  { key: 'general', label: 'General & System', blurb: 'Reports, announcements and system news.' },
];
const NOTIF_GROUP = Object.fromEntries(NOTIF_GROUPS.map(g => [g.key, g]));

/* ---- Read ------------------------------------------------------------ */
/* A care-team note reaches the notification center only when its author
   ticked Notify Care Team; otherwise it just lives on the client's chart.
   Each notified note from the last 14 days about one of my clients is its own
   Client Alert, counted until I mark it read (the read receipt). Read state is
   the note's own (16-records.jsx), shared with the Client Notes thread and the
   client header, and changes only when someone deliberately marks it. */
const NOTE_PREFIX = 'CNN-';
function noteNotifs() {
  const since = NOTIF_NOW - 14 * 86400000;
  return MY_CASELOAD.flatMap(c => getNotes(c)
    .filter(n => n.notify_team && n.author_staff_id !== ME.id && !n.deleted && new Date(n.timestamp) >= since)
    .map(n => ({
      notification_id: NOTE_PREFIX + n.note_id, note_id: n.note_id, category: 'alert', kind: 'client-note', urgent: false,
      source: 'Pending Notifications › Patient Notes', title: n.topic || 'Care-team note', detail: n.body,
      client_id: c.client_id, from_staff_id: n.author_staff_id, created: n.timestamp, read: n.read, importance: n.importance || 'Low',
      status: null, done: NSESSION.done[NOTE_PREFIX + n.note_id] || null,
    })));
}
function notifAll() {
  return (RD.notifCenter || []).map(n => ({
    ...n,
    read: NSESSION.read[n.notification_id] !== undefined ? NSESSION.read[n.notification_id] : !!n.read,
    status: NSESSION.status[n.notification_id] || n.status,
    done: NSESSION.done[n.notification_id] || null,
    nudged: !!NSESSION.nudged[n.notification_id],
    draft: NSESSION.draft[n.notification_id] || null,
  })).concat(noteNotifs());
}
const _ts = iso => new Date(iso).getTime();
/* Counted = it needs me: open tasks, unread urgent alerts, and unread
   care-team notes sent with Notify Care Team (only those reach this store). */
const notifCounted = n => !n.done && ((n.category === 'task' && n.status === 'open')
  || (n.category === 'alert' && (n.urgent || n.kind === 'client-note') && !n.read));
/* Note importance, low to high — production's four levels. */
const NOTE_IMPORTANCE = ['Low', 'Medium', 'High', 'Critical'];
const importanceRank = v => NOTE_IMPORTANCE.indexOf(v || 'Low');
/* Only High and Critical take a tone; Low and Medium stay neutral. */
const importanceTone = v => (importanceRank(v) >= 2 ? 'warn' : null);
/* Urgent alerts first, the least time left at the top; then anything past
   due; then tasks oldest-first (longest waiting) and everything else newest. */
const _deadline = n => _ts(n.created) + (n.window_hours || 0) * 3600000;
function notifSort(a, b) {
  const rank = n => (n.urgent ? 0 : n.due && _ts(n.due) < NOTIF_NOW ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (rank(a) === 0) return _deadline(a) - _deadline(b);
  return a.category === 'task' ? _ts(a.created) - _ts(b.created) : _ts(b.created) - _ts(a.created);
}
function notifList(cat) {
  return notifAll().filter(n => n.category === cat && !n.done && n.status !== 'waiting').sort(notifSort);
}
const notifWaiting = () => notifAll().filter(n => n.category === 'task' && n.status === 'waiting' && !n.done);
const notifGroupCount = cat => notifList(cat).filter(notifCounted).length;
const notifGroupUnseen = cat => notifList(cat).some(n => !n.read && !notifCounted(n) && n.category !== 'task');
const notifBellCount = () => notifAll().filter(notifCounted).length;
const notifBellQuiet = () => NOTIF_GROUPS.some(g => notifGroupUnseen(g.key));

/* ---- Time ------------------------------------------------------------ */
function notifAgo(iso) {
  const m = Math.round((NOTIF_NOW - new Date(iso)) / 60000);
  if (m < 60) return Math.max(1, m) + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : d + ' days ago';
}
/* Compact form for the title line of a row: "15m ago", "5h ago", "2d ago". */
function notifAgoShort(iso) {
  const m = Math.max(1, Math.round((NOTIF_NOW - new Date(iso)) / 60000));
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  return h < 24 ? h + 'h ago' : Math.round(h / 24) + 'd ago';
}
/* Follow-up window on an urgent alert: "17 h left" / "Overdue by 2 h". */
function notifWindow(n) {
  if (!n.window_hours) return null;
  const left = Math.round((_ts(n.created) + n.window_hours * 3600000 - NOTIF_NOW) / 3600000);
  return left >= 0 ? { label: 'Follow up within ' + n.window_hours + ' h · ' + left + ' h left', tone: left <= 6 ? 'warn' : null }
    : { label: 'Follow-up overdue by ' + -left + ' h', tone: 'danger' };
}
/* Due date on a task or a due/expiring alert. */
function notifDue(n) {
  if (!n.due) return null;
  const days = Math.round((_ts(n.due) - NOTIF_NOW) / 86400000);
  if (days < 0) return { label: 'Overdue · ' + -days + ' day' + (days === -1 ? '' : 's'), tone: 'warn' };
  if (days === 0) return { label: 'Due today', tone: 'warn' };
  return { label: 'Due in ' + days + ' day' + (days === 1 ? '' : 's'), tone: null };
}

/* ---- Write ----------------------------------------------------------- */
function setNotifRead(ids, read) {
  [].concat(ids).forEach(id => {
    if (id.indexOf(NOTE_PREFIX) === 0) setNoteRead(id.slice(NOTE_PREFIX.length), read);
    else NSESSION.read[id] = read;
  });
  touchNotifs();
}
/* Changing status is not reading: an alert is read only when it's marked read. */
function setAlertStatus(id, status) { NSESSION.status[id] = status; touchNotifs(); }
function resolveNotif(id, action, extra) {
  NSESSION.done[id] = { action, at: NOTIF_NOW.toISOString(), ...(extra || {}) };
  touchNotifs();
}
function nudgeNotif(id) { NSESSION.nudged[id] = true; touchNotifs(); }

/* ---- Notes started from, or opened by, a notification ------------------
   AxiomEHR agencies configure their own note templates per program, client
   and clinician, so a notification can't know which note a follow-up needs.
   "Start Note" asks; the chosen note opens on the chart with a link back to
   the notification, and signing it is what closes the loop. Review items
   (co-sign, sign, approve, lab) open the actual document instead of a dialog.

   `NOTE_CTX` is that link, keyed by client + document. Session-only. */
const START_NOTE_TYPES = ['Case Management Note', 'Care Coordination Note', 'Crisis Follow-Up Note', 'Engagement Session Note',
  'Hospital Discharge Follow-Up', 'Peer Support Note', 'Progress Note', 'Residential Check-In', 'Therapy Note'];
/* The agency template's checklist for each type — fictional, to show that
   every note asks for something different. */
const NOTE_TEMPLATES = {
  'Case Management Note': ['Benefits and entitlements', 'Housing', 'Transportation', 'Referrals made or updated'],
  'Care Coordination Note': ['Spoke with an outside provider', 'Release of information on file', 'Shared plan updated'],
  'Crisis Follow-Up Note': ['Safety plan reviewed with the client', 'Access to lethal means discussed', 'Crisis and after-hours numbers confirmed', 'Next appointment scheduled'],
  'Engagement Session Note': ['Goals reviewed', 'Barriers to engagement discussed', 'Next contact scheduled'],
  'Hospital Discharge Follow-Up': ['Discharge summary received', 'Medications reconciled', 'Follow-up appointment within 7 days', 'Transportation arranged'],
  'Peer Support Note': ['Recovery goals discussed', 'Community resources shared'],
  'Progress Note': ['Goals addressed', 'Interventions delivered', 'Response to interventions'],
  'Residential Check-In': ['Room and safety check', 'Medication pass observed', 'House meeting attended', 'Curfew and visitors reviewed'],
  'Therapy Note': ['Symptoms reviewed', 'Intervention delivered', 'Between-session practice assigned'],
};
const NOTE_CTX = {};
const noteCtxKey = (cid, doc) => cid + '|' + doc;
function setNoteCtx(cid, doc, ctx) { NOTE_CTX[noteCtxKey(cid, doc)] = ctx; }
function getNoteCtx(cid, doc) {
  const c = NOTE_CTX[noteCtxKey(cid, doc)];
  if (!c) return null;
  const n = notifAll().find(x => x.notification_id === c.id);
  return n && !n.done ? { ...c, n } : null;
}
function clearNoteCtx(cid, doc) { delete NOTE_CTX[noteCtxKey(cid, doc)]; }
/* Starting a note marks the alert In progress and remembers which note, so
   the row can offer "Continue" instead of asking again. */
function startNoteFrom(n, doc) {
  setNoteCtx(n.client_id, doc, { id: n.notification_id, mode: 'new' });
  NSESSION.draft[n.notification_id] = doc;
  if (n.urgent) NSESSION.status[n.notification_id] = 'In progress';
  touchNotifs();
}

/* ---- What each kind of item lets you do --------------------------------
   `primary` is the one obvious next step; `more` is the rest. A locked item
   (org policy) can't be dismissed without being actioned — the research's
   "staff mute it out of fatigue" failure. */
/* `opens`: the action opens the linked document on the chart (in review
   mode) rather than a dialog — that's where the reviewing happens. */
const TASK_ACTIONS = {
  cosign: { primary: 'Review & Co-sign', verb: 'Co-signed', opens: true, more: ['return', 'delegate', 'chart'] },
  signature: { primary: 'Review & Sign', verb: 'Signed', opens: true, more: ['return', 'delegate', 'chart'] },
  approval: { primary: 'Review & Approve', verb: 'Approved', opens: true, more: ['return', 'delegate', 'chart'] },
  order: { primary: 'Review Order', verb: 'Approved', more: ['return', 'delegate', 'chart'] },
  lab: { primary: 'Review Result', verb: 'Result acknowledged', opens: true, more: ['delegate', 'chart'] },
  'appt-request': { primary: 'Accept', verb: 'Accepted', more: ['propose', 'decline', 'delegate', 'chart'] },
  'shift-change': { primary: 'Approve', verb: 'Approved', more: ['decline'] },
  message: { primary: 'Reply', verb: 'Replied', more: ['done', 'chart'] },
  referral: { primary: 'Confirm Intake Date', verb: 'Intake date confirmed', more: ['done', 'chart'] },
  incomplete: { primary: 'Continue Note', verb: null, more: [] },
};

/* ---- Delivery preferences --------------------------------------------
   Per notification type, per channel. The org sets the floor (`lock`: a
   channel that is always on), the user sets the rest. `na` lists channels a
   type is never sent on — text is reserved for things that need you now.
   External channels carry no PHI: they say something is waiting and link back. */
const NOTIF_CHANNELS = [
  { key: 'app', label: 'In AxiomEHR', hint: 'The bell and notification center' },
  { key: 'mobile', label: 'Mobile app', hint: 'Push notification on your phone' },
  { key: 'email', label: 'Email', hint: 'No client names or clinical details' },
  { key: 'text', label: 'Text message', hint: 'Only for time-sensitive items' },
];
const NO_TEXT = ['text'];
const NOTIF_PREF_SECTIONS = [
  { key: 'task', title: 'Approvals & Tasks', blurb: 'Assigned to you and waiting on you. These always appear in AxiomEHR until they’re done.', emailTiming: true, rows: [
    { key: 'signatures', label: 'Signatures and co-signs', sub: 'Notes, plans and evaluations routed to you', lock: ['app'], na: NO_TEXT, on: ['app', 'mobile', 'email'] },
    { key: 'approvals', label: 'Approvals and orders', sub: 'Crisis plans, internal orders, transportation', lock: ['app'], na: NO_TEXT, on: ['app', 'email'] },
    { key: 'labs', label: 'Lab and screening results to review', lock: ['app'], na: NO_TEXT, on: ['app', 'mobile'] },
    { key: 'requests', label: 'Admission and appointment requests', lock: ['app'], na: [], on: ['app', 'mobile', 'email'] },
    { key: 'messages', label: 'Direct messages from staff', lock: ['app'], na: NO_TEXT, on: ['app', 'mobile'] },
    { key: 'referrals', label: 'Referral responses', lock: [], na: NO_TEXT, on: ['app'] },
    { key: 'incomplete', label: 'Your unfinished notes', sub: 'A reminder the morning after you leave a draft', lock: [], na: NO_TEXT, on: ['app', 'email'] },
  ] },
  { key: 'urgent', title: 'Urgent Client Alerts', blurb: 'Always on in AxiomEHR and the mobile app. If one isn’t followed up in its window, your supervisor is notified too.', rows: [
    { key: 'hospital', label: 'Hospital admission or ED visit', lock: ['app', 'mobile'], na: [], on: ['app', 'mobile', 'email', 'text'] },
    { key: 'crisis', label: 'Crisis line call', lock: ['app', 'mobile'], na: [], on: ['app', 'mobile', 'email', 'text'] },
    { key: 'justice', label: 'Incarceration or release', lock: ['app', 'mobile'], na: [], on: ['app', 'mobile', 'email'] },
    { key: 'urgentreq', label: 'Urgent appointment requests', lock: ['app', 'mobile'], na: [], on: ['app', 'mobile', 'text'] },
  ] },
  { key: 'alert', title: 'Other Client Alerts', blurb: 'Due and expiring work and updates about your clients. These never add to your count.', emailTiming: true, rows: [
    { key: 'assess', label: 'Assessments due or expired', sub: 'CANS, ANSA, PHQ-9 and other scheduled instruments', lock: [], na: NO_TEXT, on: ['app', 'email'] },
    { key: 'consent', label: 'Consents needed or expiring', lock: [], na: NO_TEXT, on: ['app', 'email'] },
    { key: 'plans', label: 'Treatment plan reviews', lock: [], na: NO_TEXT, on: ['app', 'email'] },
    { key: 'gaps', label: 'Documentation gaps', sub: 'No contact or note within the program standard', lock: [], na: NO_TEXT, on: ['app'] },
    { key: 'assign', label: 'New client assignments', lock: [], na: NO_TEXT, on: ['app', 'mobile', 'email'] },
    { key: 'notes', label: 'Care-team notes about your clients', lock: ['app'], na: NO_TEXT, on: ['app', 'mobile'] },
  ] },
  { key: 'calendar', title: 'Calendar & Scheduling', blurb: 'Changes to your schedule and reminders before you’re due somewhere.', emailTiming: true, rows: [
    { key: 'apptNew', label: 'Appointment scheduled for you', sub: 'When someone else books time on your calendar', lock: [], na: NO_TEXT, on: ['app', 'mobile'] },
    { key: 'apptChange', label: 'Appointment rescheduled or canceled', lock: [], na: [], on: ['app', 'mobile', 'text'] },
    { key: 'checkin', label: 'Client checked in', sub: 'Front desk or kiosk check-in for your next appointment', lock: [], na: NO_TEXT, on: ['app', 'mobile'] },
    { key: 'noshow', label: 'Client no-show', lock: [], na: NO_TEXT, on: ['app'] },
    { key: 'reminder', label: 'Upcoming appointment reminder', lock: [], na: [], on: ['app', 'mobile'], timing: 'reminderLead' },
    { key: 'daily', label: 'Daily schedule summary', lock: [], na: NO_TEXT, on: ['email'], timing: 'dailyAt' },
    { key: 'telehealth', label: 'Room or telehealth link changes', lock: [], na: [], on: ['app', 'mobile', 'text'] },
    { key: 'shift', label: 'Shift and on-call changes', lock: [], na: [], on: ['app', 'mobile', 'email'] },
  ] },
  { key: 'general', title: 'General & System', blurb: 'Reports, announcements and system news. These never add to your count.', emailTiming: true, rows: [
    { key: 'reports', label: 'Report ready or failed', lock: [], na: NO_TEXT, on: ['app'] },
    { key: 'announce', label: 'Agency announcements', lock: [], na: NO_TEXT, on: ['app', 'email'] },
    { key: 'maint', label: 'Scheduled maintenance and outages', lock: ['app'], na: NO_TEXT, on: ['app', 'email'] },
    { key: 'cred', label: 'Your credential and training reminders', lock: [], na: NO_TEXT, on: ['app', 'email'] },
  ] },
];
const EMAIL_TIMING = ['Right away', 'If unread after 2 hours', 'Daily digest'];
const REMINDER_LEADS = ['15 minutes before', '30 minutes before', '1 hour before', 'The day before'];
const DAILY_TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM'];
const QUIET_TIMES = ['6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '6:00 AM', '7:00 AM', '8:00 AM'];
const NOTIF_PREFS_KEY = 'axiom-notif-prefs-v2';
function notifPrefDefaults() {
  const matrix = {};
  NOTIF_PREF_SECTIONS.forEach(sec => sec.rows.forEach(r => {
    matrix[r.key] = Object.fromEntries(NOTIF_CHANNELS.map(c => [c.key, r.on.indexOf(c.key) !== -1 || r.lock.indexOf(c.key) !== -1]));
  }));
  return {
    matrix,
    emailTiming: { task: 'If unread after 2 hours', alert: 'Daily digest', calendar: 'Right away', general: 'Daily digest' },
    reminderLead: '30 minutes before', dailyAt: '7:00 AM', digestAt: '7:00 AM',
    quiet: { on: true, from: '8:00 PM', to: '7:00 AM' },
    coverage: { on: false, to: '', until: '' },
  };
}
function readNotifPrefs() {
  const d = notifPrefDefaults();
  try { const r = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)); if (r && r.matrix) return { ...d, ...r, matrix: { ...d.matrix, ...r.matrix } }; } catch (e) {}
  return d;
}
function writeNotifPrefs(p) { try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)); } catch (e) {} touchNotifs(); }
