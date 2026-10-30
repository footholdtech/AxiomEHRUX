/* ===== Client header quick actions ================================
   The round buttons in the client header, each a real interaction:

     Add Note        inline menu: incomplete notes first, then every type A–Z
     Call            call screen: confirm the number, dial, mute, camera on a
                     mobile, keypad, add a caller, end
     Text            quick plain-text message with saved messages and a phone
                     preview showing the agency's header and footer
     Email           rich-text composer: recipients, saved replies, signatures
                     (some locked by the agency), attachments
     Chat            the secure client-portal thread (an add-on agencies buy)
     Appointment     the scheduling form, modelled on production's
     More            future channels (AI avatar, WhatsApp), shown unavailable

   A channel the client can't be reached on is disabled, and its tooltip says
   why: opted out, no mobile number, no portal, Do Not Call on the chart.

   Everything sends into the session store only. Contact details are
   fictional (555 numbers, example.com and .example addresses).
   ================================================================ */

/* ---- Contact channels ------------------------------------------- */
const fmtPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : p; };
const emailFor = name => String(name || '').toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.') + '@horizonwellness.example';
const ME_EMAIL = emailFor(ME.name);

/* A few charts are set up to show each way a channel can be unavailable. */
const CONTACT_OVERRIDES = {
  'CL-100239': { mobile: null, home: '555-010-7239' },        // landline only
  'CL-100241': { mobile: null, home: null },                  // no phone on file
  'CL-100243': { textOptOut: '2026-03-02' },                  // replied STOP
  'CL-100236': { portal: false },                             // never set up the portal
};
function clientChannels(c) {
  const o = CONTACT_OVERRIDES[c.client_id] || {};
  const dnc = !c.records && activeAttrs(c).some(r => r.attribute_id === 'ATTR-DONOTCALL');
  return {
    mobile: 'mobile' in o ? o.mobile : c.phone || null,
    home: 'home' in o ? o.home : (seed(c.client_id + 'home') % 3 === 0 ? '555-010-' + (7000 + seed(c.client_id) % 999) : null),
    email: c.email || null,
    portal: 'portal' in o ? o.portal : true,
    textOptOut: o.textOptOut || null,
    dnc,
  };
}
/* Whether the signed-in user may edit a client's contact details. Everyone
   in this prototype can; production would read it from their role. */
const CAN_EDIT_CONTACTS = true;
/* { disabled, reason, fix } for one action on one chart. Reasons are one
   plain sentence about the client. `fix` is the way to recover — offered only
   when there is one the user can take (a client opting out isn't something
   staff can undo for them). */
function quickActionState(key, c, preview) {
  if (preview) return { disabled: true, reason: 'Not available in the preview.' };
  const ch = clientChannels(c), first = c.shortName;
  const contactFix = (lead) => CAN_EDIT_CONTACTS ? { lead, label: 'Update Contact Info', to: '/chart/' + c.client_id + '/cover-sheet' } : null;
  const no = (reason, fix) => ({ disabled: true, reason, fix: fix || null });
  switch (key) {
    case 'call':
      if (ch.dnc) return no(first + ' has asked not to be called.');
      if (!ch.mobile && !ch.home) return no(first + ' has no phone number on file.', contactFix('To add one, '));
      return { disabled: false };
    case 'text':
      if (ch.textOptOut) return no(first + ' has disabled texting as a communication channel.');
      if (!ch.mobile) return no(first + ' has no phone number with texting enabled.', contactFix('To add a text-enabled phone method, '));
      return { disabled: false };
    case 'email':
      return ch.email ? { disabled: false } : no(first + ' has no email address on file.', contactFix('To add one, '));
    case 'chat':
      return ch.portal ? { disabled: false } : no(first + ' hasn’t set up the client portal.', { lead: 'You can ', label: 'Send a Portal Invite', to: null });
    default:
      return { disabled: false };
  }
}

/* ---- The buttons ------------------------------------------------- */
/* One round button and whatever it opens.
   A disabled one stays focusable (aria-disabled, not disabled) so its reason
   can be reached by keyboard. Its tooltip can hold a link to fix the problem,
   so unlike a plain tooltip it stays open while the pointer moves into it,
   and the link is the next thing Tab reaches. */
function ReasonTip({ label, st, children }) {
  const guard = useGuard();
  const [show, setShow] = useState(false);
  const t = useRef(null);
  const open = () => { clearTimeout(t.current); setShow(true); };
  const close = () => { clearTimeout(t.current); t.current = setTimeout(() => setShow(false), 120); };
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <span className="tip-anchor qa-reason-anchor" onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close}>
      {children}
      {show && (
        <span className="tip tip--bottom tip--wide qa-reason" role="tooltip">
          {st.reason}
          {st.fix && <React.Fragment>{' ' + st.fix.lead}
            <button type="button" className="qa-reason-link" onClick={() => { setShow(false); if (st.fix.to) guard.go(st.fix.to, { client: undefined }); }}>{st.fix.label}</button>.</React.Fragment>}
        </span>
      )}
    </span>
  );
}
function QuickAction({ a, client, preview }) {
  const st = quickActionState(a.key, client, preview);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);
  const menu = a.key === 'note';
  const button = (
    <button ref={ref} type="button" className={'cph-icon-btn' + (st.disabled ? ' is-disabled' : '') + (open ? ' is-open' : '')}
      aria-label={a.label + (st.disabled ? '. Unavailable: ' + st.reason : '')} aria-disabled={st.disabled || undefined}
      aria-haspopup={menu ? 'menu' : 'dialog'} aria-expanded={menu ? open : undefined}
      onClick={() => { if (!st.disabled) setOpen(o => !o); }}>
      <Icon name={a.icon} size={20} />
    </button>
  );
  return (
    <React.Fragment>
      {st.disabled ? <ReasonTip st={st}>{button}</ReasonTip> : <Tooltip label={a.label}>{button}</Tooltip>}
      {open && a.key === 'note' && <AddNoteMenu anchorRef={ref} client={client} onClose={close} />}
      {open && a.key === 'call' && <CallOverlay client={client} onClose={close} />}
      {open && a.key === 'text' && <TextOverlay client={client} onClose={close} />}
      {open && a.key === 'email' && <EmailOverlay client={client} onClose={close} />}
      {open && a.key === 'chat' && <PortalChatOverlay client={client} onClose={close} />}
      {open && a.key === 'appointment' && <ScheduleAppointmentOverlay client={client} onClose={close} />}
    </React.Fragment>
  );
}

/* ---- Add Note ------------------------------------------------------ */
/* Notes to pick back up: drafts saved here, a draft started from an alert,
   and "Finish your note" tasks. */
function incompleteNotes(client) {
  const cid = client.client_id, out = [];
  noteDraftsFor(cid).forEach(d => out.push({ doc: d.doc, meta: 'Draft saved ' + d.saved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }));
  notifAll().filter(n => n.client_id === cid && !n.done).forEach(n => {
    if (n.kind === 'incomplete' && n.link) out.push({ doc: n.link, meta: n.title + (n.due ? ' · due ' + fmtDate(n.due) : ''), ctx: { id: n.notification_id, mode: 'draft' } });
    else if (n.draft) out.push({ doc: n.draft, meta: 'Started from: ' + n.title, ctx: { id: n.notification_id, mode: 'new' } });
  });
  return out.filter((x, i) => out.findIndex(y => y.doc === x.doc) === i);
}
function AddNoteMenu({ anchorRef, client, onClose }) {
  const guard = useGuard();
  const menuRef = useRef(null);
  useOutside([anchorRef, menuRef], onClose);
  const incomplete = incompleteNotes(client);
  const types = START_NOTE_TYPES.slice().sort((a, b) => a.localeCompare(b));
  const go = (doc, ctx) => {
    onClose();
    guard.go('/chart/' + client.client_id + '/' + slugify(doc), { client: client.client_id,
      onCommit: ctx ? () => setNoteCtx(client.client_id, doc, ctx) : undefined });
  };
  return (
    <FloatMenu anchorRef={anchorRef} menuRef={menuRef} className="dd-menu qa-menu" role="menu" minWidth={300} maxHeight={420} onClose={onClose}>
      <div className="dd-list">
        {incomplete.length > 0 && (
          <React.Fragment>
            <div className="qa-menu-sub">Pick Up Where You Left Off</div>
            {incomplete.map(i => (
              <button key={'i' + i.doc} type="button" role="menuitem" className="dd-opt qa-opt" onClick={() => go(i.doc, i.ctx)}>
                <Icon name="uiDocumentEdit" size={18} />
                <span className="qa-opt-text"><span className="qa-opt-name">{i.doc}</span><span className="qa-opt-meta">{i.meta}</span></span>
              </button>
            ))}
            <div className="qa-menu-sub">All Notes</div>
          </React.Fragment>
        )}
        {types.map(t => <button key={t} type="button" role="menuitem" className="dd-opt" onClick={() => go(t)}>{t}</button>)}
      </div>
    </FloatMenu>
  );
}

/* ---- More --------------------------------------------------------- */
const MORE_CHANNELS = [
  { key: 'avatar', icon: 'uiBot', label: 'AI Avatar Check-In', blurb: 'A guided check-in the client completes with an AI avatar.' },
  { key: 'whatsapp', icon: 'uiChatMultiple', label: 'WhatsApp', blurb: 'Message the client in WhatsApp.' },
  { key: 'video', icon: 'uiVideo', label: 'Video Visit Link', blurb: 'Send a link to a scheduled telehealth visit.' },
];
function MoreActionsButton({ client, preview }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menuRef = useRef(null);
  useOutside([ref, menuRef], () => setOpen(false));
  return (
    <React.Fragment>
      <Tooltip label="More Actions">
        <button ref={ref} type="button" className={'cph-icon-btn cph-icon-btn--sq' + (open ? ' is-open' : '')} aria-label="More Actions"
          aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="dsUtil6" size={20} /></button>
      </Tooltip>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu qa-menu" role="menu" minWidth={300} maxHeight={360} onClose={() => setOpen(false)}>
          <div className="dd-head">More Ways to Reach {client.shortName}</div>
          <div className="dd-list">
            {MORE_CHANNELS.map(m => (
              <button key={m.key} type="button" role="menuitem" className="dd-opt qa-opt" aria-disabled="true" disabled>
                <Icon name={m.icon} size={18} />
                <span className="qa-opt-text"><span className="qa-opt-name">{m.label}</span><span className="qa-opt-meta">{m.blurb} Not available in this prototype.</span></span>
              </button>
            ))}
          </div>
          <div className="dd-foot">Your agency turns these channels on.</div>
        </FloatMenu>
      )}
    </React.Fragment>
  );
}

/* ---- Call ---------------------------------------------------------- */
const fmtDur = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
function CallCtl({ icon, label, on, disabled, reason, onClick, danger }) {
  const btn = (
    <button type="button" className={'call-ctl' + (on ? ' on' : '') + (danger ? ' danger' : '')} aria-pressed={danger ? undefined : !!on}
      aria-disabled={disabled || undefined} aria-label={label + (disabled ? '. ' + reason : '')} onClick={() => { if (!disabled) onClick(); }}>
      <span className="call-ctl-btn"><Icon name={icon} size={22} /></span>
      <span className="call-ctl-label">{label}</span>
    </button>
  );
  return disabled ? <Tooltip label={reason} wide>{btn}</Tooltip> : btn;
}
function CallOverlay({ client, onClose }) {
  const guard = useGuard();
  const ch = clientChannels(client);
  const numbers = [ch.mobile && { kind: 'Mobile', n: ch.mobile }, ch.home && { kind: 'Home', n: ch.home }].filter(Boolean);
  const [num, setNum] = useState(numbers[0]);
  const [phase, setPhase] = useState('ready');          // ready | live | ended
  const [startAt, setStartAt] = useState(null);
  const [endAt, setEndAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false), [cam, setCam] = useState(false), [pad, setPad] = useState(false);
  const [digits, setDigits] = useState(''), [adding, setAdding] = useState(false), [addNum, setAddNum] = useState(''), [others, setOthers] = useState([]);
  useEffect(() => { if (phase !== 'live') return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [phase]);
  const secs = startAt ? Math.floor(((phase === 'live' ? now : endAt) - startAt) / 1000) : 0;
  const connected = phase === 'live' && secs >= 3;    // a few seconds of ringing
  const dial = () => { setStartAt(Date.now()); setNow(Date.now()); setPhase('live'); };
  const end = () => {
    const at = Date.now(); setEndAt(at); setPhase('ended'); setCam(false); setPad(false); setAdding(false);
    addPageRow(client.client_id, 'Calls', { id: newId('CALL'), at: nowIso(), by_staff_id: ME.id, number: num.n, seconds: Math.floor((at - startAt) / 1000) });
  };
  const closeAll = () => { if (phase === 'live') end(); onClose(); };
  const noteAboutCall = () => { onClose(); guard.go('/chart/' + client.client_id + '/progress-note', { client: client.client_id }); };
  const videoReason = num && num.kind !== 'Mobile' ? 'Video needs a mobile number.' : !connected ? 'Available once the call connects.' : null;

  return (
    <Overlay size="sm" title="Call" subtitle={client.displayName} onClose={closeAll} bodyClassName="call-body"
      footer={phase === 'ended'
        ? <React.Fragment><Button variant="secondary" onClick={noteAboutCall}>Add a Note About This Call</Button><span className="spacer" /><Button variant="primary" onClick={onClose}>Done</Button></React.Fragment>
        : null}>
      <div className={'call-stage' + (cam ? ' is-video' : '')}>
        {cam ? <div className="call-selfview" aria-label="Your camera is on"><Icon name="uiVideo" size={28} /><span>Your camera is on</span></div>
          : <Avatar name={client.name} size="XL" />}
        <div className="call-name">{client.displayName}</div>
        <div className="call-number">{num ? num.kind + ' · ' + fmtPhone(num.n) : 'No number'}</div>
        <div className="call-status" aria-live="polite">
          {phase === 'ready' ? 'Confirm the number, then call.' : phase === 'ended' ? 'Call ended · ' + fmtDur(secs) : connected ? fmtDur(secs) : 'Calling… ' + fmtDur(secs)}
        </div>
        {others.length > 0 && <div className="call-others">{others.map(o => <span key={o} className="ntag">+ {fmtPhone(o)}</span>)}</div>}
      </div>

      {phase === 'ready' && (
        <div className="call-ready">
          {numbers.length > 1 && (
            <div className="call-pick" role="radiogroup" aria-label="Number to call">
              {numbers.map(x => (
                <button key={x.kind} type="button" role="radio" aria-checked={num === x} className={'pill-btn' + (num === x ? ' active' : '')} onClick={() => setNum(x)}>
                  {x.kind} · {fmtPhone(x.n)}
                </button>
              ))}
            </div>
          )}
          <Button variant="primary" className="call-go" onClick={dial}><Icon name="uiCall" size={18} /> Call {fmtPhone(num.n)}</Button>
        </div>
      )}

      {phase === 'live' && (
        <React.Fragment>
          {pad && (
            <div className="call-pad">
              <div className="call-pad-digits" aria-live="polite">{digits || 'Enter digits'}</div>
              <div className="call-pad-grid">{KEYPAD.map(k => <button key={k} type="button" className="call-key" onClick={() => setDigits(d => d + k)}>{k}</button>)}</div>
            </div>
          )}
          {adding && (
            <div className="call-add">
              <Field label="Add a caller"><TextIn value={addNum} onChange={v => setAddNum(v.replace(/[^0-9()\- ]/g, ''))} placeholder="(555) 000-0000" /></Field>
              <Button size="sm" variant="secondary" disabled={addNum.replace(/\D/g, '').length < 10}
                onClick={() => { setOthers(o => o.concat([addNum.replace(/\D/g, '')])); setAddNum(''); setAdding(false); }}>Add to Call</Button>
            </div>
          )}
          <div className="call-ctls">
            <CallCtl icon={muted ? 'uiMicOff' : 'uiMic'} label={muted ? 'Unmute' : 'Mute'} on={muted} onClick={() => setMuted(m => !m)} />
            <CallCtl icon={cam ? 'uiVideoOff' : 'uiVideo'} label={cam ? 'Camera Off' : 'Camera'} on={cam} disabled={!!videoReason} reason={videoReason} onClick={() => setCam(c => !c)} />
            <CallCtl icon="uiDialpad" label="Keypad" on={pad} onClick={() => { setPad(p => !p); setAdding(false); }} />
            <CallCtl icon="uiCallAdd" label="Add Caller" on={adding} onClick={() => { setAdding(a => !a); setPad(false); }} />
            <CallCtl icon="uiCallEnd" label="End" danger onClick={end} />
          </div>
          {cam && <div className="call-hint">{client.shortName}’s phone will ask to turn on their camera. Your own camera follows this device’s permissions.</div>}
        </React.Fragment>
      )}
    </Overlay>
  );
}

/* ---- Text --------------------------------------------------------- */
/* The agency's header and footer wrap every text (set in admin; fixed here). */
/* Set in Admin › User Interface Options › Communications › Texting. */
const textHeader = () => fillComms(commsConfig().text.header);
const textFooter = () => fillComms(commsConfig().text.footer);
/* The signed-in user's own saved messages, in their voice. Fictional. */
const SAVED_TEXTS = [
  { label: 'Checking in', body: 'Hey {name}, just checking in. I noticed you hadn’t picked up your last prescription. Anything we can chat about?' },
  { label: 'Appointment reminder', body: 'Hi {name}, reminder that we’re meeting tomorrow. Text me back if you need to move it.' },
  { label: 'Missed you', body: 'Hi {name}, I tried to call you today. Call me back when you have a minute, no rush.' },
  { label: 'Thanks for today', body: 'Thanks for coming in today, {name}. Reach out if anything comes up before next week.' },
];
const TEXT_DRAFTS = {};
function TextOverlay({ client, onClose }) {
  const guard = useGuard();
  const ch = clientChannels(client);
  const cid = client.client_id;
  const [body, setBody] = useState(TEXT_DRAFTS[cid] || '');
  const set = v => { setBody(v); TEXT_DRAFTS[cid] = v; };
  const n = body.length, segs = Math.max(1, Math.ceil((n + textHeader().length + textFooter().length + 2) / 160));
  const send = () => {
    addPageRow(cid, 'Text Messages', { id: newId('SMS'), at: nowIso(), by_staff_id: ME.id, body: body.trim(), to: ch.mobile, status: 'Delivered' });
    delete TEXT_DRAFTS[cid];
    guard.setToast({ status: 'success', title: 'Text sent', detail: 'To ' + client.shortName + ' at ' + fmtPhone(ch.mobile) + '.' });
    onClose();
  };
  /* The full history is a page, so this is navigation: the button says so
     with an outward arrow. An unsent message is kept for next time. */
  const openAll = () => { onClose(); guard.go('/chart/' + cid + '/text-messages', { client: cid }); };
  return (
    <Overlay size="md" title="Send Text Message" subtitle={client.displayName} onClose={onClose} bodyClassName="txt-body"
      footer={<React.Fragment>
        <Button variant="secondary" onClick={openAll}>Open Messages <Icon name="uiOpen" size={16} /></Button>
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={send} disabled={!body.trim()}><Icon name="uiSend" size={16} /> Send Text</Button>
      </React.Fragment>}>
      <div className="txt-grid">
        <div className="txt-compose">
          <div className="ovl-facts txt-facts"><div><span>To</span>Mobile · {fmtPhone(ch.mobile)}</div><div><span>From</span>{AGENCY.name} text line</div></div>
          <div className="txt-msg-head">
            <span className="txt-msg-label">Message</span>
            <SavedReplies kind="text" client={client} text={body} onInsert={v => set(body.trim() ? body.replace(/\s+$/, '') + ' ' + v : v)} />
          </div>
          <textarea className="ta" rows={5} value={body} onChange={e => set(e.target.value)} aria-label="Message"
            placeholder={'Write a quick text to ' + client.shortName + '…'} />
          <div className="ff-hint txt-count">{n + ' characters · sends as ' + segs + (segs === 1 ? ' text' : ' texts') + (TEXT_DRAFTS[cid] && body ? ' · kept if you close this' : '')}</div>
        </div>
        <div className="txt-preview" aria-label="How the text looks on the client’s phone">
          <div className="txt-phone">
            <div className="txt-phone-top">{commsConfig().agency.long}</div>
            <div className="txt-bubble">
              <span className="txt-fixed">{textHeader()}</span>
              <span>{body.trim() || 'Your message appears here.'}</span>
              <span className="txt-fixed">{textFooter()}</span>
            </div>
          </div>
          <div className="ff-hint">The header and footer are set by your agency.</div>
        </div>
      </div>
    </Overlay>
  );
}

/* ---- Email -------------------------------------------------------- */
/* The agency's signatures (Admin › Communications › Email), locked unless the
   agency lets staff edit them, then the user's own if that's allowed. "No
   Signature" only exists when staff may change signatures at all. */
const MY_SIGNATURES = [
  { id: 'full', name: 'My Full Signature', body: ME.name + '\n' + ME.role + ' · ' + AGENCY.name + '\n(555) 010-4000' },
  { id: 'short', name: 'My Short Signature', body: '— ' + ME.name.split(' ')[0] },
];
function emailSignatures() {
  const e = commsConfig().email;
  const agency = e.signatures.slice().sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
    .map(s => ({ id: s.id, name: s.name, html: fillComms(s.html), locked: !e.staffCanEdit, agency: true }));
  return agency.concat(e.staffCanAddOwn ? MY_SIGNATURES : [], e.staffCanEdit ? [{ id: 'none', name: 'No Signature', body: '' }] : []);
}
const EMAIL_REPLIES = [
  { label: 'Appointment Follow-Up', body: 'Thanks for meeting with me. Here’s a summary of what we covered and the next steps we agreed on.' },
  { label: 'Paperwork Request', body: 'When you have a moment, please complete the attached form and send it back to me, or bring it to your next appointment.' },
  { label: 'Resource List', body: 'Here are the community resources we talked about. Let me know if any of them work for you.' },
];
/* ---- Saved replies -------------------------------------------------
   A user's own library of reusable messages, for any composer: texts and
   email now, and built to drop into notes, service plans or assessments.
   - Choose one to put it in the message.
   - Save New Reply keeps what's in the message now. It's off until there's
     something to save, and its tooltip says so.
   - Rename in place: the name becomes an input; the check (or Enter) keeps
     it; clicking away or Escape drops the edit.
   - Delete removes it at once, and the toast offers Undo.
   - The client's name is stored as {name} and filled in with their
     preferred name, or their first name when there isn't one, so a reply
     written for one client reads right for the next.
   Session only; each user's own. */
const SAVED_REPLIES = {
  text: SAVED_TEXTS.map((s, i) => ({ id: 'txt-' + i, name: s.label, body: s.body })),
  email: EMAIL_REPLIES.map((s, i) => ({ id: 'eml-' + i, name: s.label, body: s.body })),
};
function SavedReplies({ kind, client, text, onInsert }) {
  const guard = useGuard();
  useRecordsVersion();
  const items = SAVED_REPLIES[kind];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);          // { id, name } while renaming
  const ref = useRef(null), menuRef = useRef(null);
  const close = () => { setOpen(false); setEditing(null); };
  useOutside([ref, menuRef], close);
  /* shortName is the preferred name when there is one, else the first name. */
  const first = client.shortName;
  const fill = body => body.split('{name}').join(first);
  const canSave = !!(text || '').trim();
  /* Texts also offer the agency's templates (Admin › Communications ›
     Texting), and the agency can turn off saving personal replies. */
  const agencyTpls = kind === 'text' ? commsConfig().text.templates : [];
  const mayKeep = kind !== 'text' || commsConfig().text.staffCanSave;
  const fillAgency = body => fillComms(body, { name: first, staff: ME.name });
  const put = list => { SAVED_REPLIES[kind] = list; touchRecords(); };
  const saveNew = () => {
    /* Either name the clinician typed becomes the placeholder. */
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = [first, client.first_name].filter(Boolean).sort((a, b) => b.length - a.length)
      .reduce((s, n) => s.replace(new RegExp('\\b' + esc(n) + '\\b', 'g'), '{name}'), text.trim());
    const words = text.trim().replace(/\s+/g, ' ').split(' ').slice(0, 4).join(' ');
    const r = { id: newId('RPL'), name: words.length > 32 ? words.slice(0, 32) + '…' : words, body };
    put([r].concat(items));
    setEditing({ id: r.id, name: r.name });              // name it straight away
  };
  const rename = () => { const n = editing.name.trim(); if (n) put(items.map(x => (x.id === editing.id ? { ...x, name: n } : x))); setEditing(null); };
  const del = r => {
    const at = items.indexOf(r);
    put(items.filter(x => x !== r));
    guard.setToast({ status: 'success', title: '“' + r.name + '” deleted',
      action: { label: 'Undo', onClick: () => { const cur = SAVED_REPLIES[kind].slice(); cur.splice(Math.min(at, cur.length), 0, r); put(cur); } } });
  };
  const newBtn = (
    <button type="button" className="btn btn-ghost sm sr-new-btn" aria-disabled={!canSave || undefined} onClick={() => canSave && saveNew()}>
      <Icon name="plus" size={14} /> Save New Reply
    </button>
  );
  return (
    <span ref={ref} className="sr-wrap">
      <button type="button" className={'dd-trigger sr-trigger' + (open ? ' open' : '')} aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <span>Saved Replies</span><Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu sr-menu" role="menu" minWidth={340} maxHeight={380} onClose={close}>
          <div className="sr-new">
            {!mayKeep ? <span className="sr-note">Your agency doesn’t allow saving new replies.</span>
              : canSave ? newBtn : <Tooltip wide label="To save a new reply, write your message first, then save it here.">{newBtn}</Tooltip>}
          </div>
          <div className="dd-list">
            {items.map(r => (editing && editing.id === r.id ? (
              <div key={r.id} className="sr-row is-editing">
                <div className="form-input sr-name-input">
                  <input autoFocus value={editing.name} aria-label="Reply name" onChange={e => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rename(); } }} />
                </div>
                <Tooltip label="Save Name"><button type="button" className="icon-btn" aria-label="Save name" onClick={rename}><Icon name="check" size={16} /></button></Tooltip>
              </div>
            ) : (
              <div key={r.id} className="sr-row">
                <button type="button" role="menuitem" className="dd-opt sr-pick" onClick={() => { onInsert(fill(r.body)); close(); }}>
                  <span className="sr-name">{r.name}</span><span className="sr-preview">{fill(r.body)}</span>
                </button>
                {mayKeep && <Tooltip label="Rename"><button type="button" className="icon-btn" aria-label={'Rename ' + r.name} onClick={() => setEditing({ id: r.id, name: r.name })}><Icon name="dsEdit" size={16} /></button></Tooltip>}
                {mayKeep && <Tooltip label="Delete"><button type="button" className="icon-btn" aria-label={'Delete ' + r.name} onClick={() => del(r)}><Icon name="trash" size={16} /></button></Tooltip>}
              </div>
            )))}
            {!items.length && <div className="sr-empty">No saved replies yet. Write a message, then save it here.</div>}
            {agencyTpls.length > 0 && <div className="qa-menu-sub sr-agency-sub"><Icon name="uiLockClosed" size={12} /> From Your Agency</div>}
            {agencyTpls.map(r => (
              <div key={r.id} className="sr-row">
                <button type="button" role="menuitem" className="dd-opt sr-pick" onClick={() => { onInsert(fillAgency(r.body)); close(); }}>
                  <span className="sr-name">{r.name}</span><span className="sr-preview">{fillAgency(r.body)}</span>
                </button>
              </div>
            ))}
          </div>
          <div className="dd-foot">Only you see your saved replies. The client’s preferred name, or first name, fills in wherever you used it.</div>
        </FloatMenu>
      )}
    </span>
  );
}

const ATTACH_TYPES = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
const ATTACH_MAX_MB = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailSuggestions(client) {
  const team = (client.team || careTeam(client.client_id)).map(t => ({ name: t.name, email: emailFor(t.name), kind: t.role + ' · care team' }));
  const sup = supportContacts(client).map(s => ({ name: s.name, email: s.name.toLowerCase().replace(/[^a-z]/g, '') + '.demo@example.com', kind: s.role + ' · support contact',
    blocked: s.release ? null : 'No release of information on file.' }));
  return team.concat(sup);
}
function EmailOverlay({ client, onClose }) {
  const guard = useGuard();
  const ch = clientChannels(client);
  const [to, setTo] = useState([{ name: client.name, email: ch.email, kind: 'Client' }]);
  const [q, setQ] = useState(''), [pick, setPick] = useState(false);
  const [subject, setSubject] = useState('');
  const sigs = emailSignatures();
  const [sig, setSig] = useState(() => (sigs[0] ? sigs[0].id : 'none'));
  const [files, setFiles] = useState([]), [fileErr, setFileErr] = useState(null);
  const [linking, setLinking] = useState(false), [linkUrl, setLinkUrl] = useState('');
  const [tried, setTried] = useState(false);
  const [bodyText, setBodyText] = useState('');
  const hasBody = !!bodyText.trim();
  const editor = useRef(null), fileRef = useRef(null), pickRef = useRef(null), pickMenu = useRef(null);
  useOutside([pickRef, pickMenu], () => setPick(false));
  const fmt = cmd => { editor.current && editor.current.focus(); document.execCommand(cmd, false, null); };
  const addLink = () => { if (!linkUrl.trim()) return; editor.current.focus(); document.execCommand('createLink', false, linkUrl.trim()); setLinking(false); setLinkUrl(''); };
  const insert = txt => { editor.current.focus(); document.execCommand('insertText', false, txt); setBodyText(editor.current.innerText); };
  const addTo = r => { if (!to.some(x => x.email === r.email)) setTo(t => t.concat([r])); setQ(''); setPick(false); };
  const sugg = emailSuggestions(client).filter(s => !to.some(x => x.email === s.email) && (!q || (s.name + s.email + s.kind).toLowerCase().indexOf(q.toLowerCase()) !== -1));
  const typedOk = EMAIL_RE.test(q.trim());
  const onFiles = e => {
    const list = [...(e.target.files || [])]; e.target.value = '';
    const bad = list.find(f => ATTACH_TYPES.indexOf(((f.name.match(/\.[^.]+$/) || [''])[0]).toLowerCase()) === -1);
    const big = list.find(f => f.size > ATTACH_MAX_MB * 1048576);
    if (bad) return setFileErr('“' + bad.name + '” can’t be attached. Use PDF, Word, PNG or JPG.');
    if (big) return setFileErr('“' + big.name + '” is over ' + ATTACH_MAX_MB + ' MB.');
    setFileErr(null); setFiles(fs => fs.concat(list.map(f => ({ name: f.name, size: f.size }))));
  };
  const s = sigs.find(x => x.id === sig) || sigs[0];
  const err = { to: !to.length ? 'Add at least one recipient.' : null, subject: !subject.trim() ? 'Add a subject.' : null, body: !hasBody ? 'Write the message.' : null };
  const send = () => {
    setTried(true);
    if (err.to || err.subject || err.body) return;
    addPageRow(client.client_id, 'Emails', { id: newId('EML'), at: nowIso(), by_staff_id: ME.id, to: to.map(x => x.email), subject: subject.trim(), files: files.length });
    guard.setToast({ status: 'success', title: 'Email sent', detail: subject.trim() + ' · to ' + to.length + (to.length === 1 ? ' recipient' : ' recipients') });
    onClose();
  };
  return (
    <Overlay size="lg" title="Send Email" subtitle={client.displayName} onClose={onClose} bodyClassName="eml-body"
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <span className="spacer" />
        <Button variant="primary" onClick={send}><Icon name="uiSend" size={16} /> Send Email</Button>
      </React.Fragment>}>
      <Field label="From"><div className="form-input is-disabled"><input value={ME.name + ' <' + ME_EMAIL + '>'} disabled aria-label="From" /></div></Field>
      <Field label="To" required error={tried ? err.to : null}>
        <div className="eml-to" ref={pickRef}>
          {to.map(r => (
            <span key={r.email} className="eml-chip" title={r.email}>{r.name}<span className="eml-chip-mail">{r.email}</span>
              <button type="button" className="eml-chip-x" aria-label={'Remove ' + r.name} onClick={() => setTo(t => t.filter(x => x !== r))}><Icon name="close" size={12} /></button>
            </span>
          ))}
          <input className="eml-to-input" value={q} placeholder="Add care team, support contacts or an email address" aria-label="Add a recipient"
            onFocus={() => setPick(true)} onChange={e => { setQ(e.target.value); setPick(true); }}
            onKeyDown={e => { if (e.key === 'Enter' && typedOk) { e.preventDefault(); addTo({ name: q.trim(), email: q.trim(), kind: 'Email address' }); } }} />
        </div>
        {pick && (sugg.length > 0 || typedOk) && (
          <FloatMenu anchorRef={pickRef} menuRef={pickMenu} className="dd-menu" role="listbox" minWidth={360} maxHeight={280} onClose={() => setPick(false)}>
            <div className="dd-list">
              {typedOk && <button type="button" role="option" className="dd-opt qa-opt" onClick={() => addTo({ name: q.trim(), email: q.trim(), kind: 'Email address' })}>
                <span className="qa-opt-text"><span className="qa-opt-name">Add {q.trim()}</span><span className="qa-opt-meta">New email address</span></span></button>}
              {sugg.map(r => (
                <button key={r.email} type="button" role="option" className="dd-opt qa-opt" disabled={!!r.blocked} aria-disabled={!!r.blocked || undefined} onClick={() => !r.blocked && addTo(r)}>
                  <Avatar name={r.name} size="S" />
                  <span className="qa-opt-text"><span className="qa-opt-name">{r.name}</span><span className="qa-opt-meta">{r.blocked ? r.kind + ' · ' + r.blocked : r.kind + ' · ' + r.email}</span></span>
                </button>
              ))}
            </div>
          </FloatMenu>
        )}
      </Field>
      <Field label="Subject" required error={tried ? err.subject : null}><TextIn value={subject} onChange={setSubject} invalid={tried && !!err.subject} /></Field>

      <div className="ff">
        <div className="ff-label ff-label--row"><span>Message<span className="ff-req"> * <span className="ff-req-txt">(Required)</span></span></span></div>
        <div className={'eml-editor' + (tried && err.body ? ' invalid' : '')}>
          <div className="eml-tools" role="toolbar" aria-label="Formatting">
            {[['uiTextBold', 'Bold', 'bold'], ['uiTextItalic', 'Italic', 'italic'], ['uiTextUnderline', 'Underline', 'underline'],
              ['uiTextBulletListLTR', 'Bulleted list', 'insertUnorderedList'], ['uiTextNumberListLTR', 'Numbered list', 'insertOrderedList']].map(([ic, l, c]) => (
              <Tooltip key={c} label={l}><button type="button" className="icon-btn" aria-label={l} onMouseDown={e => e.preventDefault()} onClick={() => fmt(c)}><Icon name={ic} size={18} /></button></Tooltip>
            ))}
            <Tooltip label="Link"><button type="button" className="icon-btn" aria-label="Link" aria-pressed={linking} onMouseDown={e => e.preventDefault()} onClick={() => setLinking(l => !l)}><Icon name="uiLink" size={18} /></button></Tooltip>
            <span className="eml-tools-div" />
            <SavedReplies kind="email" client={client} text={bodyText} onInsert={insert} />
          </div>
          {linking && (
            <div className="eml-link">
              <TextIn value={linkUrl} onChange={setLinkUrl} placeholder="https://" aria-label="Link address" />
              <Button size="sm" variant="secondary" onClick={addLink} disabled={!linkUrl.trim()}>Add Link</Button>
            </div>
          )}
          <div ref={editor} className="eml-area" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Message"
            data-placeholder={'Write to ' + client.shortName + '…'} onInput={e => setBodyText(e.currentTarget.innerText)} />
          {s && (s.body || s.html) && (
            <div className="eml-sig">
              {s.locked && <span className="eml-sig-lock"><Icon name="uiLockClosed" size={14} /> Set by your agency</span>}
              {s.html
                ? <div key={s.id} className="comms-sig-render" contentEditable={!s.locked} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: s.html }} />
                : <pre>{s.body}</pre>}
            </div>
          )}
        </div>
        {tried && err.body && <div className="ff-error"><Icon name="warn" size={13} /> {err.body}</div>}
      </div>

      <div className="eml-row">
        <Field label="Signature">
          <Dropdown value={s ? s.name : ''} options={sigs.map(x => x.name)} onChange={v => setSig(sigs.find(x => x.name === v).id)} menuMinWidth={240} />
        </Field>
        <Field label="Attachments" hint={'PDF, Word, PNG or JPG, up to ' + ATTACH_MAX_MB + ' MB each. Sent through secure email.'} error={fileErr}>
          <div className="eml-files">
            <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" accept={ATTACH_TYPES.join(',')} onChange={onFiles} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current.click()}><Icon name="uiAttach" size={16} /> Attach Files</Button>
            {files.map((f, i) => (
              <span key={i} className="eml-chip">{f.name}<span className="eml-chip-mail">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                <button type="button" className="eml-chip-x" aria-label={'Remove ' + f.name} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
              </span>
            ))}
          </div>
        </Field>
      </div>
    </Overlay>
  );
}

/* ---- Chat (client portal) ------------------------------------------ */
/* Everything the client has received through the portal, oldest first.
   Shared with the Client Summary's Messages widget. Where the fixtures have
   no thread for a client, a short fictional one stands in. */
function portalMessages(client) {
  const cid = client.client_id;
  const real = (RD.clientMessages || []).filter(m => m.recipient_id === cid || m.sender_id === cid);
  const base = real.length ? real.slice() : Array.from({ length: 4 }).map((_, i) => ({
    message_id: cid + '-m' + i, sender_type: i % 2 === 0 ? 'client' : 'staff', sender_id: i % 2 === 0 ? cid : ME.id,
    timestamp: addDays(TODAY, -(i * 2 + 1)).toISOString(),
    body: ['Can I move my Thursday appointment to the afternoon?', 'Of course — I have 3:30 open. I have moved it and sent a confirmation.',
      'The new prescription is making me drowsy in the mornings.', 'Thanks for telling me. I have flagged it for the prescriber to review this week.'][i % 4],
  }));
  return base.concat(pageRows(cid, 'Portal Messages').slice().reverse())
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}
const EMOJI = ['🙂', '😀', '👍', '🙏', '❤️', '👏', '🎉', '💪', '🌟', '☀️', '📅', '✅', '📝', '💊', '🏠', '🚌', '📞', '🤝', '😊', '😔', '🤔', '⏰', '📍', '👋'];
function PortalChatOverlay({ client, onClose }) {
  const guard = useGuard();
  useRecordsVersion();
  const cid = client.client_id;
  const msgs = portalMessages(client);
  const [body, setBody] = useState(''), [files, setFiles] = useState([]), [emoji, setEmoji] = useState(false);
  const thread = useRef(null), fileRef = useRef(null), emoRef = useRef(null), emoMenu = useRef(null);
  useOutside([emoRef, emoMenu], () => setEmoji(false));
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [msgs.length]);
  const send = () => {
    if (!body.trim() && !files.length) return;
    addPageRow(cid, 'Portal Messages', { message_id: newId('MSG'), sender_type: 'staff', sender_id: ME.id, timestamp: nowIso() + ':00', body: body.trim(), files: files.map(f => f.name) });
    setBody(''); setFiles([]);
  };
  let lastDay = null;
  return (
    <Overlay size="md" title="Chat" subtitle={client.displayName} onClose={onClose} bodyClassName="cn-ovl-body chat-body">
      <div className="chat-secure"><Icon name="uiShieldLock" size={16} /> Secure client portal. Everything {client.shortName} has received from your agency and care team.</div>
      <div className="cn-thread chat-thread" ref={thread} aria-label={'Portal messages with ' + client.shortName}>
        {msgs.map(m => {
          const fromClient = m.sender_type === 'client';
          const name = fromClient ? client.name : sName(m.sender_id);
          const mine = !fromClient && m.sender_id === ME.id;
          const day = noteAgo(String(m.timestamp)); const showDay = day !== lastDay; lastDay = day;
          return (
            <React.Fragment key={m.message_id}>
              {showDay && <div className="cn-day"><span>{day}</span></div>}
              <article className={'cn-msg' + (mine ? ' is-mine' : '') + (fromClient ? ' is-client' : '')}>
                <span className="cn-gutter" />
                <Avatar name={name} size="M" />
                <div className="cn-msg-main">
                  <div className="cn-msg-head">
                    <span className="cn-msg-name">{mine ? 'You' : fromClient ? client.shortName : name}</span>
                    {!fromClient && !mine && <span className="cn-msg-role">{staffRole(m.sender_id)}</span>}
                    <span className="cn-msg-time">{noteTime(String(m.timestamp).length >= 16 ? String(m.timestamp) : String(m.timestamp) + 'T09:00')}</span>
                  </div>
                  <div className="cn-bubble-row"><div className="cn-bubble">
                    {m.body && <p>{m.body}</p>}
                    {(m.files || []).map(f => <span key={f} className="ntag"><Icon name="uiAttach" size={12} /> {f}</span>)}
                  </div></div>
                </div>
              </article>
            </React.Fragment>
          );
        })}
      </div>
      <div className="chat-compose">
        {files.length > 0 && <div className="eml-files">{files.map((f, i) => (
          <span key={i} className="eml-chip">{f.name}<button type="button" className="eml-chip-x" aria-label={'Remove ' + f.name} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button></span>
        ))}</div>}
        <div className="chat-row">
          <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" accept={ATTACH_TYPES.join(',')}
            onChange={e => { const l = [...(e.target.files || [])]; e.target.value = ''; setFiles(fs => fs.concat(l.map(f => ({ name: f.name })))); }} />
          <Tooltip label="Attach a file"><button type="button" className="icon-btn" aria-label="Attach a file" onClick={() => fileRef.current.click()}><Icon name="uiAttach" size={20} /></button></Tooltip>
          <span ref={emoRef}><Tooltip label="Emoji"><button type="button" className="icon-btn" aria-label="Emoji" aria-expanded={emoji} onClick={() => setEmoji(x => !x)}><Icon name="uiEmoji" size={20} /></button></Tooltip></span>
          {emoji && (
            <FloatMenu anchorRef={emoRef} menuRef={emoMenu} className="dd-menu" role="listbox" minWidth={232} maxHeight={200} onClose={() => setEmoji(false)}>
              <div className="chat-emoji">{EMOJI.map(e => <button key={e} type="button" className="chat-emo" aria-label={'Insert ' + e} onClick={() => { setBody(b => b + e); setEmoji(false); }}>{e}</button>)}</div>
            </FloatMenu>
          )}
          <textarea className="ta chat-input" rows={2} value={body} placeholder={'Message ' + client.shortName + '…'} aria-label={'Message ' + client.shortName}
            onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
          <Button variant="primary" onClick={send} disabled={!body.trim() && !files.length}><Icon name="uiSend" size={16} /> Send</Button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---- Schedule Appointment ------------------------------------------- */
/* Production's New Appointment form, kept field for field so the teams can
   see its weight. Times in 15-minute steps; end time follows from duration;
   transportation is required for in-person visits; the room list follows
   the site. */
const APPT_TIMES = Array.from({ length: 49 }).map((_, i) => { const m = 7 * 60 + i * 15; const h = Math.floor(m / 60), mm = m % 60; return ((h % 12) || 12) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); });
const toMin = t => { const [hm, ap] = t.split(' '); let [h, m] = hm.split(':').map(Number); if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0; return h * 60 + m; };
const fromMin = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return ((h % 12) || 12) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
const TRANSPORT = ['Not needed', 'Client arranges own', 'Agency van', 'Bus pass', 'Rideshare voucher'];
const FREQUENCY = ['Does not repeat', 'Daily', 'Weekly', 'Every 2 weeks', 'Monthly'];
function ScheduleAppointmentOverlay({ client, onClose }) {
  const guard = useGuard();
  const nowSlot = () => { const d = new Date(); const m = Math.min(19 * 60, Math.max(7 * 60, Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15) * 15)); return fromMin(m); };
  const [f, setF] = useState({ staff: ME.name, date: isoOf(TODAY), start: '', duration: '30', site: '', reason: '', meeting: '', room: '', transport: '', inRoom: false, comments: '', reminder: true, frequency: FREQUENCY[0] });
  const [guests, setGuests] = useState([client]);
  const [gq, setGq] = useState('');
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v, ...(k === 'site' ? { room: '' } : {}) }));
  const site = (RD.sites || []).find(s => s.name === f.site);
  const rooms = site ? (site.sublocations || []).map(r => r.name) : [];
  const end = f.start ? fromMin(toMin(f.start) + parseInt(f.duration, 10)) : '';
  const reasons = [...new Set((RD.appointments || []).map(a => a.appointment_reason).filter(Boolean))].sort();
  const needTransport = f.meeting === 'In Person';
  const err = {
    staff: !f.staff && 'Choose a staff member.', date: !f.date && 'Choose a date.', guests: !guests.length && 'Add at least one client.',
    start: !f.start && 'Choose a start time.', site: !f.site && 'Choose a site.', reason: !f.reason && 'Choose a reason.',
    meeting: !f.meeting && 'Choose a meeting type.', transport: needTransport && !f.transport && 'Choose how the client gets here.',
  };
  const e = k => (tried ? err[k] || null : null);
  const matches = gq.trim() ? CLIENTS.filter(c => !guests.includes(c) && c.name.toLowerCase().indexOf(gq.trim().toLowerCase()) !== -1).slice(0, 5) : [];
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const [h, rest] = f.start.split(':'), hh = (parseInt(h, 10) % 12) + (/PM/.test(rest) ? 12 : 0);
    guests.forEach(g => addPageRow(g.client_id, 'Appointments', { appointment_id: newId('APT'), client_id: g.client_id, staff_id: staffIdByName(f.staff), date: f.date,
      start_time: String(hh).padStart(2, '0') + ':' + rest.slice(0, 2), appointment_reason: f.reason, meeting_type: f.meeting, completion_status: 'Scheduled' }));
    guard.setToast({ status: 'success', title: 'Appointment scheduled', detail: fmtDate(f.date) + ' · ' + f.start + '–' + end + ' with ' + f.staff + (f.frequency !== FREQUENCY[0] ? ' · repeats ' + f.frequency.toLowerCase() : '') });
    onClose();
  };
  return (
    <Overlay size="md" title="New Appointment" subtitle={client.displayName} onClose={onClose} bodyClassName="appt-body"
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><span className="spacer" /><Button variant="primary" onClick={save}>Schedule Appointment</Button></React.Fragment>}>
      <div className="ovl-grid ovl-grid--2">
        <Field label="Staff Member" required error={e('staff')}><Dropdown value={f.staff} options={staffOptions()} onChange={v => set('staff', v)} /></Field>
        <DateField label="Date" required value={f.date} onChange={v => set('date', v)} error={e('date')} />
      </div>
      <div className="appt-guests">
        <div className="appt-guests-head">Guest List</div>
        <MiniSearch value={gq} onChange={setGq} placeholder="Search clients to add" />
        {matches.length > 0 && (
          <div className="appt-guest-results">{matches.map(c => (
            <button key={c.client_id} type="button" className="picker-row" onClick={() => { setGuests(g => g.concat([c])); setGq(''); }}>
              <Avatar name={c.name} size="S" /><span className="picker-text"><span className="picker-name">{c.name}</span></span><Icon name="plus" size={16} />
            </button>
          ))}</div>
        )}
        <div className="appt-guest-list">{guests.map(g => (
          <span key={g.client_id} className="appt-guest"><Avatar name={g.name} size="M" /><span>{g.name}</span>
            <button type="button" className="icon-btn" aria-label={'Remove ' + g.name} onClick={() => setGuests(x => x.filter(y => y !== g))}><Icon name="close" size={14} /></button>
          </span>
        ))}</div>
        {e('guests') && <div className="ff-error"><Icon name="warn" size={13} /> {e('guests')}</div>}
      </div>
      <div className="ovl-grid ovl-grid--2">
        <div className="ff">
          <div className="ff-label ff-label--row"><span>Start Time<span className="ff-req"> * <span className="ff-req-txt">(Required)</span></span></span>
            <span className="date-quick"><button type="button" className="quick" onClick={() => set('start', nowSlot())}>Now</button></span></div>
          <Dropdown value={f.start} options={APPT_TIMES} placeholder="Please select an option" onChange={v => set('start', v)} invalid={!!e('start')} />
          {e('start') && <div className="ff-error"><Icon name="warn" size={13} /> {e('start')}</div>}
        </div>
        <Field label="End Time"><div className="form-input is-disabled"><input value={end} placeholder="Follows from duration" disabled aria-label="End time" /></div></Field>
        <Field label="Duration" required><Dropdown value={f.duration} options={['15', '30', '45', '60', '90', '120']} display={v => v + ' minutes'} onChange={v => set('duration', v)} /></Field>
        <Field label="Appointment Site" required error={e('site')}><Dropdown value={f.site} options={SITE_OPTIONS} placeholder="Please select an option" onChange={v => set('site', v)} invalid={!!e('site')} menuMinWidth={260} /></Field>
        <Field label="Reason" required error={e('reason')}><Dropdown value={f.reason} options={reasons} placeholder="Select a reason" onChange={v => set('reason', v)} invalid={!!e('reason')} /></Field>
        <Field label="Meeting Type" required error={e('meeting')}><Dropdown value={f.meeting} options={['In Person', 'Telehealth', 'Phone']} placeholder="Please select an option" onChange={v => set('meeting', v)} invalid={!!e('meeting')} /></Field>
        <Field label="Room Number"><Dropdown value={f.room} options={rooms} placeholder={rooms.length ? 'Please select an option' : f.site ? 'No rooms at this site' : 'Choose a site first'} onChange={v => set('room', v)} /></Field>
        <Field label="Transportation" required={needTransport} error={e('transport')}><Dropdown value={f.transport} options={TRANSPORT} placeholder="Please select an option" onChange={v => set('transport', v)} invalid={!!e('transport')} /></Field>
      </div>
      <Checkbox checked={f.inRoom} onChange={v => set('inRoom', v)} label="Client in room" />
      <Field label="Comments"><TextArea value={f.comments} onChange={v => set('comments', v)} rows={2} placeholder="Comment" /></Field>
      <Checkbox checked={f.reminder} onChange={v => set('reminder', v)} label="Needs a reminder" />
      <Field label="Frequency"><Dropdown value={f.frequency} options={FREQUENCY} onChange={v => set('frequency', v)} /></Field>
    </Overlay>
  );
}
