/* ===== Admin › User Interface Options › Communications ============
   How the agency shows up when staff email, text and call clients. Same shape
   as the Client Header admin: an index of the three areas, then one edit page
   per area with Discard / Save Changes and the unsaved-changes guard.

     Email        agency signatures (rich text), whether staff may edit them,
                  whether staff may add their own
     Texting      the agency's name in its three lengths and its sign-off, the
                  header and footer on every text, and the message templates
                  (greeting, welcome, billing, reminders, closures, no-shows,
                  crisis line) with a phone preview
     Phone Calls  the automated-call voice, a recorded or typed greeting that
                  plays first, and notifying support contacts for minors

   The staff side reads the saved settings: the Send Email signatures, the
   Send Text header, footer and "From Your Agency" saved replies.
   Agency configuration persists in this browser (localStorage), like the
   other UI options. Example wording is fictional, for review.
   ================================================================ */

/* ---- Settings ------------------------------------------------------ */
const COMMS_KEY = 'axiom-comms-config-v1';
const COMMS_DEFAULT = {
  agency: { long: AGENCY.name, short: 'Horizon', abbr: 'HW', closer: '—Your Team at Horizon' },
  email: {
    staffCanEdit: false, staffCanAddOwn: true,
    signatures: [
      { id: 'sig-standard', name: 'Standard', isDefault: true,
        html: '<b>{staff}</b>, {credentials}<br>{role} · {agency}<br>(555) 010-4000<br><br><i>Confidential: this email may contain protected health information. If you received it in error, tell the sender and delete it.</i>' },
      { id: 'sig-brief', name: 'Brief',
        html: '{staff} · {agency}<br><i>This email may contain protected health information.</i>' },
    ],
  },
  text: {
    header: 'Msg from staff at {abbr}:', footer: 'Reply STOP to opt out.', staffCanSave: true,
    templates: [
      { id: 'tpl-greeting', name: 'Greeting', body: 'Hi {name}, this is {staff} from {short}. {closer}' },
      { id: 'tpl-welcome', name: 'Welcome', body: 'Welcome to {agency}, {name}! Save this number to reach your care team between visits. {closer}' },
      { id: 'tpl-reminder', name: 'Appointment Reminder', body: 'Hi {name}, reminder: you have an appointment with {staff} on {date} at {time}. Reply C to confirm, or call us to reschedule. {closer}' },
      { id: 'tpl-noshow', name: 'No-Show Follow-Up', body: 'Hi {name}, we missed you today. Reply here or call us and we’ll find a new time. {closer}' },
      { id: 'tpl-billing', name: 'Billing Question', body: 'Hi {name}, we have a question about your billing. Please call {short} at (555) 010-4000 when you can. {closer}' },
      { id: 'tpl-closure', name: 'Office Closure', body: '{short} offices are closed on {date}. For urgent help, call or text 988. {closer}' },
      { id: 'tpl-crisis', name: 'Crisis Line Reply', body: 'If you’re in crisis, call or text 988 now, or call 911 in an emergency. This number isn’t watched around the clock. {closer}' },
    ],
  },
  phone: { voice: 'Female', greetingText: 'Hello, this is a message from {agency}.', recording: null, notifyMinorSupport: true },
};
let COMMS = (() => {
  try { const s = JSON.parse(localStorage.getItem(COMMS_KEY) || 'null'); if (s && s.agency) return s; } catch (e) {}
  return clone(COMMS_DEFAULT);
})();
/* Recordings stay in memory: audio is too large for localStorage. */
const COMMS_AUDIO = {};
const commsConfig = () => COMMS;
function saveComms(next) {
  COMMS = clone(next);
  try { localStorage.setItem(COMMS_KEY, JSON.stringify({ ...COMMS, phone: { ...COMMS.phone, recording: COMMS.phone.recording ? { ...COMMS.phone.recording, url: null } : null } })); } catch (e) {}
  touchRecords();
}

/* Placeholders admins and staff can use. Agency ones come from the settings,
   the rest from who's writing to whom. */
const COMMS_TOKENS = [
  ['{name}', 'Client’s preferred name'], ['{staff}', 'Staff member'], ['{agency}', 'Official name'], ['{short}', 'Short name'],
  ['{abbr}', 'Abbreviation'], ['{closer}', 'Sign-off'], ['{date}', 'Date'], ['{time}', 'Time'],
];
function fillComms(str, ctx = {}, cfg = COMMS) {
  const a = cfg.agency;
  const map = { '{agency}': a.long, '{short}': a.short, '{abbr}': a.abbr, '{closer}': a.closer,
    '{name}': ctx.name || 'Mari', '{staff}': ctx.staff || ME.name, '{role}': ctx.role || ME.role, '{credentials}': ctx.credentials || ME.credentials || '',
    '{date}': ctx.date || fmtDate(addDays(TODAY, 1)), '{time}': ctx.time || '10:00 AM' };
  return Object.keys(map).reduce((s, k) => s.split(k).join(map[k]), String(str || ''));
}

/* ---- Rich text (signatures) --------------------------------------- */
/* Uncontrolled contentEditable: the HTML is set once per item so the caret
   never jumps, and each edit reports back. */
function RichTextEditor({ id, html, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html || ''; }, [id]);
  const fmt = cmd => { ref.current.focus(); document.execCommand(cmd, false, null); onChange(ref.current.innerHTML); };
  const insert = tok => { ref.current.focus(); document.execCommand('insertText', false, tok); onChange(ref.current.innerHTML); };
  return (
    <div className="eml-editor">
      <div className="eml-tools" role="toolbar" aria-label={label + ' formatting'}>
        {[['uiTextBold', 'Bold', 'bold'], ['uiTextItalic', 'Italic', 'italic'], ['uiTextUnderline', 'Underline', 'underline']].map(([ic, l, c]) => (
          <Tooltip key={c} label={l}><button type="button" className="icon-btn" aria-label={l} onMouseDown={e => e.preventDefault()} onClick={() => fmt(c)}><Icon name={ic} size={18} /></button></Tooltip>
        ))}
        <span className="eml-tools-div" />
        <TokenMenu onPick={insert} only={['{staff}', '{agency}', '{short}', '{abbr}']} extra={[['{role}', 'Staff role'], ['{credentials}', 'Credentials']]} />
      </div>
      <div ref={ref} className="eml-area comms-sig-area" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label}
        onInput={e => onChange(e.currentTarget.innerHTML)} />
    </div>
  );
}
/* "Insert Placeholder" — a small menu of tokens. */
function TokenMenu({ onPick, only, extra }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menu = useRef(null);
  useOutside([ref, menu], () => setOpen(false));
  const list = COMMS_TOKENS.filter(([t]) => !only || only.indexOf(t) !== -1).concat(extra || []);
  return (
    <span ref={ref} className="sr-wrap">
      <button type="button" className={'dd-trigger sr-trigger' + (open ? ' open' : '')} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}><span>Insert Placeholder</span><Icon name="chevronDown" size={16} /></button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menu} className="dd-menu" role="menu" minWidth={240} maxHeight={300} onClose={() => setOpen(false)}>
          <div className="dd-list">
            {list.map(([t, l]) => (
              <button key={t} type="button" role="menuitem" className="dd-opt qa-opt" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(t); setOpen(false); }}>
                <span className="qa-opt-text"><span className="qa-opt-name">{l}</span><span className="qa-opt-meta">{t}</span></span>
              </button>
            ))}
          </div>
        </FloatMenu>
      )}
    </span>
  );
}

/* ---- Index -------------------------------------------------------- */
const COMMS_AREAS = [
  { key: 'email', icon: 'mail', title: 'Email', blurb: 'Agency signatures, and whether staff can change them or add their own.',
    meta: c => c.email.signatures.length + (c.email.signatures.length === 1 ? ' signature' : ' signatures') + ' · staff ' + (c.email.staffCanEdit ? 'can' : 'can’t') + ' edit them' },
  { key: 'texting', icon: 'chat', title: 'Texting', blurb: 'How the agency is named in texts, the header and footer on every message, and message templates.',
    meta: c => c.text.templates.length + ' templates · signs off “' + c.agency.closer + '”' },
  { key: 'phone', icon: 'phone', title: 'Phone Calls', blurb: 'The voice for automated calls, the greeting that plays first, and notifying support contacts for minors.',
    meta: c => c.phone.voice + ' voice · ' + (c.phone.recording ? 'recorded greeting' : 'spoken greeting') + (c.phone.notifyMinorSupport ? ' · minors’ contacts notified' : '') },
];
function CommunicationsPage() {
  const guard = useGuard();
  useRecordsVersion();
  const c = commsConfig();
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'User Interface Options', to: '/user-interface-options' }, { label: 'Communications' }]} />
      <div className="page-head-row"><div>
        <h1 className="page-title">Communications</h1>
        <div className="page-sub">How {c.agency.long} appears when staff email, text and call clients. These apply to every staff member.</div>
      </div></div>
      <Panel title="Communication Settings">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Area</th><th>What It Controls</th><th>Currently</th><th /></tr></thead>
            <tbody>
              {COMMS_AREAS.map(a => (
                <tr key={a.key}>
                  <td><span className="cam-name"><span className="attrm-glyph"><Icon name={a.icon} size={20} /></span>
                    <button className="lnk" onClick={() => guard.go('/user-interface-options/communications/' + a.key)}>{a.title}</button></span></td>
                  <td className="wrap">{a.blurb}</td>
                  <td className="wrap">{a.meta(c)}</td>
                  <td><Button size="sm" variant="secondary" onClick={() => guard.go('/user-interface-options/communications/' + a.key)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---- Edit pages --------------------------------------------------- */
function useCommsDraft(label) {
  const guard = useGuard();
  const rawNavigate = useRawNavigate();
  const [saved, setSaved] = useState(() => clone(commsConfig()));
  const [draft, setDraft] = useState(() => clone(commsConfig()));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => { if (dirty) guard.markDirty(label); else guard.clearDirty(); }, [dirty]);
  useEffect(() => () => guard.clearDirty(), []);
  const patch = (area, p) => setDraft(d => ({ ...d, [area]: { ...d[area], ...p } }));
  const save = () => { saveComms(draft); setSaved(clone(draft)); guard.clearDirty(); guard.setToast({ status: 'success', title: label + ' saved', detail: 'Applies to every staff member.' }); };
  const discard = () => setDraft(clone(saved));
  return { draft, setDraft, patch, dirty, save, discard, back: () => { guard.clearDirty(); rawNavigate('/user-interface-options/communications'); } };
}
function CommsShell({ title, sub, d, children }) {
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'User Interface Options', to: '/user-interface-options' },
        { label: 'Communications', to: '/user-interface-options/communications' }, { label: title }]} />
      <div className="page-head-row">
        <div><h1 className="page-title">{title}</h1><div className="page-sub">{sub}</div></div>
        <span className="spacer" />
        {d.dirty && <span className="badge status-amber"><Icon name="edit" size={12} /> Unsaved changes</span>}
        <Button variant="ghost" onClick={d.discard} disabled={!d.dirty}>Discard</Button>
        <Button variant="primary" onClick={d.save} disabled={!d.dirty}>Save Changes</Button>
      </div>
      <section className="panel chc-config">{children}</section>
    </div>
  );
}
function CommsSwitch({ name, help, checked, onChange }) {
  return (
    <div className="chc-switch">
      <Toggle checked={checked} onChange={onChange} />
      <div className="chc-switch-text"><div className="chc-switch-name">{name}</div><div className="chc-switch-help">{help}</div></div>
    </div>
  );
}

/* Email */
function CommsEmailPage() {
  const d = useCommsDraft('Email settings');
  const e = d.draft.email;
  const [sel, setSel] = useState(e.signatures[0] ? e.signatures[0].id : null);
  const sig = e.signatures.find(s => s.id === sel) || e.signatures[0];
  const setSigs = list => d.patch('email', { signatures: list });
  const update = p => setSigs(e.signatures.map(s => (s.id === sig.id ? { ...s, ...p } : s)));
  const add = () => { const s = { id: newId('sig'), name: 'New Signature', html: '{staff} · {agency}' }; setSigs(e.signatures.concat([s])); setSel(s.id); };
  const remove = () => { const rest = e.signatures.filter(s => s.id !== sig.id); if (sig.isDefault && rest[0]) rest[0] = { ...rest[0], isDefault: true }; setSigs(rest); setSel(rest[0] && rest[0].id); };
  const makeDefault = () => setSigs(e.signatures.map(s => ({ ...s, isDefault: s.id === sig.id })));
  return (
    <CommsShell title="Email" sub="Signatures on every email staff send to clients and contacts." d={d}>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Agency Signatures</h2>
        <div className="comms-split">
          <div className="comms-list" role="listbox" aria-label="Signatures">
            {e.signatures.map(s => (
              <button key={s.id} type="button" role="option" aria-selected={s.id === (sig && sig.id)} className={'comms-item' + (s.id === (sig && sig.id) ? ' on' : '')} onClick={() => setSel(s.id)}>
                <span>{s.name}</span>{s.isDefault && <span className="ntag ntag--info">Default</span>}
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={add}><Icon name="plus" size={14} /> Add Signature</Button>
          </div>
          {sig ? (
            <div className="comms-edit">
              <Field label="Name" required><TextIn value={sig.name} onChange={v => update({ name: v })} /></Field>
              <div className="ff"><div className="ff-label">Signature</div><RichTextEditor id={sig.id} html={sig.html} onChange={html => update({ html })} label="Signature" /></div>
              <div className="comms-edit-actions">
                {!sig.isDefault && <Button size="sm" variant="secondary" onClick={makeDefault}>Make Default</Button>}
                <span className="spacer" />
                <Button size="sm" variant="ghost" onClick={remove} disabled={e.signatures.length < 2}>Delete Signature</Button>
              </div>
              <div className="ff"><div className="ff-label">Preview</div>
                <div className="comms-email-pv">
                  <div className="comms-email-pv-body">Hi Mari, thanks for meeting with me today…</div>
                  <div className="eml-sig">
                    {!e.staffCanEdit && <span className="eml-sig-lock"><Icon name="uiLockClosed" size={14} /> Set by your agency</span>}
                    <div className="comms-sig-render" dangerouslySetInnerHTML={{ __html: fillComms(sig.html, {}, d.draft) }} />
                  </div>
                </div>
              </div>
            </div>
          ) : <div className="attrm-empty">No signatures. Add one.</div>}
        </div>
      </div>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Staff Permissions</h2>
        <CommsSwitch name="Staff Can Edit Agency Signatures" checked={e.staffCanEdit} onChange={v => d.patch('email', { staffCanEdit: v })}
          help="Off: agency signatures are locked in the email composer, so every email carries the same notice." />
        <CommsSwitch name="Staff Can Add Their Own Signatures" checked={e.staffCanAddOwn} onChange={v => d.patch('email', { staffCanAddOwn: v })}
          help="Personal signatures appear alongside the agency’s in the composer." />
      </div>
    </CommsShell>
  );
}

/* Texting */
function TextPreview({ cfg, body }) {
  return (
    <div className="txt-phone">
      <div className="txt-phone-top">{cfg.agency.long}</div>
      <div className="txt-bubble">
        <span className="txt-fixed">{fillComms(cfg.text.header, {}, cfg)}</span>
        <span>{fillComms(body, {}, cfg) || 'Message'}</span>
        <span className="txt-fixed">{fillComms(cfg.text.footer, {}, cfg)}</span>
      </div>
    </div>
  );
}
function CommsTextPage() {
  const d = useCommsDraft('Texting settings');
  const t = d.draft.text, a = d.draft.agency;
  const [sel, setSel] = useState(t.templates[0] ? t.templates[0].id : null);
  const tpl = t.templates.find(x => x.id === sel) || t.templates[0];
  const bodyRef = useRef(null);
  const setTpls = list => d.patch('text', { templates: list });
  const update = p => setTpls(t.templates.map(x => (x.id === tpl.id ? { ...x, ...p } : x)));
  const add = () => { const x = { id: newId('tpl'), name: 'New Template', body: 'Hi {name}, … {closer}' }; setTpls(t.templates.concat([x])); setSel(x.id); };
  const remove = () => { const rest = t.templates.filter(x => x.id !== tpl.id); setTpls(rest); setSel(rest[0] && rest[0].id); };
  const insertTok = tok => {
    const el = bodyRef.current; const s = el ? el.selectionStart : tpl.body.length, e2 = el ? el.selectionEnd : s;
    update({ body: tpl.body.slice(0, s) + tok + tpl.body.slice(e2) });
  };
  return (
    <CommsShell title="Texting" sub="How the agency is named and what every text says before and after a staff member’s message." d={d}>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Agency Name in Texts</h2>
        <div className="ovl-grid ovl-grid--4 comms-grid">
          <Field label="Official Name" hint="{agency}"><TextIn value={a.long} onChange={v => d.patch('agency', { long: v })} /></Field>
          <Field label="Short Name" hint="{short}"><TextIn value={a.short} onChange={v => d.patch('agency', { short: v })} /></Field>
          <Field label="Abbreviation" hint="{abbr}"><TextIn value={a.abbr} onChange={v => d.patch('agency', { abbr: v })} /></Field>
          <Field label="Sign-Off" hint="{closer}"><TextIn value={a.closer} onChange={v => d.patch('agency', { closer: v })} /></Field>
        </div>
      </div>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Header and Footer</h2>
        <div className="ovl-grid ovl-grid--2 comms-grid">
          <Field label="Header" hint="Starts every text."><TextIn value={t.header} onChange={v => d.patch('text', { header: v })} /></Field>
          <Field label="Footer" hint="Ends every text. Keep the opt-out wording your carrier requires."><TextIn value={t.footer} onChange={v => d.patch('text', { footer: v })} /></Field>
        </div>
      </div>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Message Templates</h2>
        <div className="comms-split comms-split--3">
          <div className="comms-list" role="listbox" aria-label="Templates">
            {t.templates.map(x => (
              <button key={x.id} type="button" role="option" aria-selected={x.id === (tpl && tpl.id)} className={'comms-item' + (x.id === (tpl && tpl.id) ? ' on' : '')} onClick={() => setSel(x.id)}>
                <span>{x.name}</span>
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={add}><Icon name="plus" size={14} /> Add Template</Button>
          </div>
          {tpl ? (
            <div className="comms-edit">
              <Field label="Name" required><TextIn value={tpl.name} onChange={v => update({ name: v })} /></Field>
              <div className="ff">
                <div className="ff-label ff-label--row"><span>Message</span><TokenMenu onPick={insertTok} /></div>
                <textarea ref={bodyRef} className="ta" rows={5} value={tpl.body} onChange={e => update({ body: e.target.value })} aria-label="Template message" />
                <div className="ff-hint">Staff see these under From Your Agency in Saved Replies. Placeholders fill in for each client and staff member.</div>
              </div>
              <div className="comms-edit-actions"><span className="spacer" /><Button size="sm" variant="ghost" onClick={remove}>Delete Template</Button></div>
            </div>
          ) : <div className="attrm-empty">No templates. Add one.</div>}
          <div className="txt-preview" aria-label="Preview on a client’s phone">
            <TextPreview cfg={d.draft} body={tpl ? tpl.body : ''} />
            <div className="ff-hint">Preview for a client named Mari, sent by {ME.name}.</div>
          </div>
        </div>
      </div>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Staff Permissions</h2>
        <CommsSwitch name="Staff Can Save Their Own Replies" checked={t.staffCanSave} onChange={v => d.patch('text', { staffCanSave: v })}
          help="Off: staff can only use the agency’s templates. Replies they already saved stay, but they can’t add new ones." />
      </div>
    </CommsShell>
  );
}

/* Phone */
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const AUDIO_EXTS = ['.mp3', '.wav', '.m4a'];
const AUDIO_MAX_MB = 5;
const VOICE_HINTS = { Female: /samantha|victoria|karen|zira|susan|moira|tessa|fiona|female|serena|allison|ava/i, Male: /alex|daniel|david|fred|tom|aaron|male|oliver|rishi|arthur/i };
function speakSample(text, gender) {
  if (!window.speechSynthesis) return false;
  const u = new SpeechSynthesisUtterance(text);
  const v = window.speechSynthesis.getVoices().find(x => /^en/i.test(x.lang) && VOICE_HINTS[gender].test(x.name));
  if (v) u.voice = v; else u.pitch = gender === 'Female' ? 1.2 : 0.8;
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  return true;
}
function CommsPhonePage() {
  const d = useCommsDraft('Phone call settings');
  const p = d.draft.phone;
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const canSpeak = !!window.speechSynthesis;
  const rec = p.recording;
  const audioUrl = rec && (COMMS_AUDIO[rec.id] || rec.url);
  const onFile = e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const ext = ((f.name.match(/\.[^.]+$/) || [''])[0]).toLowerCase();
    if (AUDIO_EXTS.indexOf(ext) === -1 || (f.type && AUDIO_TYPES.indexOf(f.type) === -1)) return setErr('“' + f.name + '” isn’t an MP3, WAV or M4A file.');
    if (f.size > AUDIO_MAX_MB * 1048576) return setErr('That file is ' + (f.size / 1048576).toFixed(1) + ' MB. Choose one under ' + AUDIO_MAX_MB + ' MB.');
    const id = newId('rec'); COMMS_AUDIO[id] = URL.createObjectURL(f);
    setErr(null); d.patch('phone', { recording: { id, name: f.name, size: f.size } });
  };
  return (
    <CommsShell title="Phone Calls" sub="Automated calls, like appointment reminders, and what plays before them." d={d}>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Automated Call Voice</h2>
        <div className="comms-row">
          <RadioGroup name="comms-voice" options={['Female', 'Male']} value={p.voice} onChange={v => d.patch('phone', { voice: v })} />
          {canSpeak
            ? <Button size="sm" variant="secondary" onClick={() => speakSample(fillComms('Hello, this is a reminder from {agency} about your appointment tomorrow at 10 AM.', {}, d.draft), p.voice)}>Play Sample</Button>
            : <Tooltip label="This browser can’t play voice samples."><Button size="sm" variant="secondary" disabled>Play Sample</Button></Tooltip>}
        </div>
      </div>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Greeting Before Automated Messages</h2>
        <div className="comms-greet">
          <div className="ff">
            <div className="ff-label">Recorded Greeting</div>
            {rec ? (
              <div className="comms-rec">
                {audioUrl ? <audio controls src={audioUrl} aria-label={'Recorded greeting: ' + rec.name} /> : <span className="ff-hint">Saved recording. Upload it again to play it here.</span>}
                <span className="comms-rec-name">{rec.name} · {Math.max(1, Math.round(rec.size / 1024))} KB</span>
                <Button size="sm" variant="ghost" onClick={() => d.patch('phone', { recording: null })}>Remove</Button>
              </div>
            ) : (
              <div className="comms-rec">
                <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept={AUDIO_EXTS.join(',') + ',audio/*'} onChange={onFile} />
                <Button size="sm" variant="secondary" onClick={() => fileRef.current.click()}><Icon name="plus" size={14} /> Upload Recording</Button>
              </div>
            )}
            <div className="ff-hint">MP3, WAV or M4A, up to {AUDIO_MAX_MB} MB. Keep it under 20 seconds. Plays before the automated part of every call.</div>
            {err && <div className="ff-error"><Icon name="warn" size={13} /> {err}</div>}
          </div>
          <Field label="Spoken Greeting" hint={'Reads: “' + fillComms(p.greetingText, {}, d.draft) + '” ' + (rec ? 'Used only if the recording can’t play.' : 'Read aloud in the voice above when there’s no recording.')}>
            <div className="comms-row comms-row--fill">
              <TextIn value={p.greetingText} onChange={v => d.patch('phone', { greetingText: v })} />
              {canSpeak && <Button size="sm" variant="secondary" onClick={() => speakSample(fillComms(p.greetingText, {}, d.draft), p.voice)}>Play</Button>}
            </div>
          </Field>
        </div>
      </div>
      <div className="chc-sec">
        <h2 className="chc-sectitle">Minors</h2>
        <CommsSwitch name="Notify Support Contacts for Minors" checked={p.notifyMinorSupport} onChange={v => d.patch('phone', { notifyMinorSupport: v })}
          help="When a client is under 18, automated calls also go to their support contacts who have a release of information on file." />
      </div>
    </CommsShell>
  );
}

function CommsAreaPage({ area }) {
  if (area === 'email') return <CommsEmailPage />;
  if (area === 'texting') return <CommsTextPage />;
  if (area === 'phone') return <CommsPhonePage />;
  return <NonClientPage title="Not Found" crumbs={[{ label: 'Communications', to: '/user-interface-options/communications' }, { label: 'Not Found' }]} blurb="There’s no communications area with that name." />;
}
