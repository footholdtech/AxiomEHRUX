/* ===== Cover Sheet: demographics, contact info, support contacts ======
   Production keeps all three on the Cover Sheet. The header's Demographics,
   Contact Info and Support Contacts quick views read the same derivation as
   the Cover Sheet page below, and link to the section they came from.

   Demographics and contact info are one record per client, edited in place
   on the Cover Sheet — there's nothing to "add", so their quick views link
   out. Support contacts are a list, so they get Add Contact.

   Everything the shared fixture set doesn't carry (marital status, county,
   orientation…) is derived from the client id: stable, and fictional.
   ================================================================ */

const MARITAL = ['Single', 'Married', 'Divorced', 'Separated', 'Widowed', 'Domestic partnership'];
const EMPLOYMENT = ['Employed full-time', 'Employed part-time', 'Unemployed — seeking work', 'Not in the labor force', 'Student', 'Retired', 'Unable to work'];
const SMOKING = ['Never smoker', 'Former smoker', 'Current every-day smoker', 'Current some-day smoker'];
const ORIENTATION = ['Straight or heterosexual', 'Straight or heterosexual', 'Gay or lesbian', 'Bisexual', 'Something else', 'Chose not to disclose'];
const COUNTIES = ['Clark County', 'Greene County', 'Champaign County', 'Madison County'];
const pickBy = (cid, k, list) => list[seed(cid + k) % list.length];

function coverSheet(client) {
  const cid = client.client_id;
  const ch = clientChannels(client);
  const attrs = client.records ? [] : activeAttrs(client).map(r => r.attribute_id);
  const unhoused = attrs.indexOf('ATTR-UNHOUSED') !== -1;
  const a = client.address || {};
  const preferred = ch.mobile ? (ch.textOptOut ? 'Cell phone' : pickBy(cid, 'pref', ['Cell phone', 'Text message', 'Email'])) : ch.home ? 'Home phone' : 'Email';
  return {
    name: { first: client.first_name, last: client.last_name, middle: CIN_ALPHA[seed(cid + 'mid') % CIN_ALPHA.length] + '.',
      preferred: client.preferred_name || null },
    personal: { dob: client.dob, age: client.age, language: client.primary_language, preferredLanguage: client.primary_language,
      interpreter: client.primary_language !== 'English' || attrs.indexOf('ATTR-INTERPRETER') !== -1,
      marital: client.age !== '' && client.age < 18 ? 'Single' : pickBy(cid, 'mar', MARITAL), smoking: pickBy(cid, 'smk', SMOKING),
      veteran: seed(cid + 'vet') % 6 === 0 && client.age >= 21 ? 'Veteran' : 'Not a veteran',
      employment: client.age !== '' && client.age < 18 ? 'Student' : pickBy(cid, 'emp', EMPLOYMENT) },
    gender: { atBirth: client.gender, identity: seed(cid + 'gi') % 9 === 0 ? 'Chose not to disclose' : client.gender, pronouns: client.pronouns,
      orientation: pickBy(cid, 'so', ORIENTATION) },
    race: { base: client.race, ethnicity: client.ethnicity, specific: null, tribal: null },
    ids: { mrn: client.mrn, medicaid: client.cin, funding: 'FS-' + String(100000 + seed(cid + 'fs') % 899999) },
    address: { unhoused, unknown: false, doNotMail: attrs.indexOf('ATTR-DONOTMAIL') !== -1, type: unhoused ? 'Mailing — agency site' : 'Home',
      status: seed(cid + 'as') % 4 === 0 ? 'Unverified' : 'Verified', line1: unhoused ? client.siteName : a.line1,
      city: a.city, state: a.state, zip: a.zip, county: pickBy(cid, 'cty', COUNTIES) },
    phone: { preferred, cell: ch.mobile, home: ch.home, work: null, email: ch.email, allowText: !!ch.mobile && !ch.textOptOut,
      textOptOut: ch.textOptOut, dnc: ch.dnc, portal: ch.portal, status: 'Active' },
    updated: { on: isoOf(addDays(TODAY, -(9 + seed(cid + 'upd') % 180))), by: derivedBy(cid + 'cover') },
  };
}

/* Header link to one section of the Cover Sheet. The page scrolls to it. */
let COVER_FOCUS = null;
function useCoverNav(client) {
  const go = useModuleNav(client);
  return section => { COVER_FOCUS = section; go('Cover Sheet'); };
}
const updatedLine = cs => 'Updated ' + fmtDate(cs.updated.on) + ' by ' + sName(cs.updated.by);

/* Labelled values in groups — one record's fields, not a table of records. */
function KvGroups({ groups }) {
  return (
    <div className="qvx-kvgroups">
      {groups.filter(Boolean).map(([head, rows]) => (
        <div key={head} className="qvx-kvgroup">
          <div className="qvx-kvhead">{head}</div>
          <dl className="qvx-kv">
            {rows.filter(Boolean).map(([k, v]) => (
              <div key={k} className="qvx-kvrow"><dt>{k}</dt><dd>{v == null || v === '' ? '—' : v}</dd></div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
const KvTag = ({ children, warn }) => <span className={'cph-qv-tag' + (warn ? ' is-warn' : '')}>{children}</span>;

/* The fields both the header and the page show, by section. `o` is the
   quick view's options; the page passes everything on. */
function demographicGroups(cs, o) {
  return [
    ['Name', [['Legal name', cs.name.first + ' ' + cs.name.middle + ' ' + cs.name.last], ['Preferred name', cs.name.preferred]]],
    ['Personal', [['Date of birth', fmtDate(cs.personal.dob) + ' (' + cs.personal.age + ')'],
      o.showLanguage && ['Primary language', cs.personal.language],
      o.showLanguage && ['Interpreter', cs.personal.interpreter ? <KvTag warn>Required</KvTag> : 'Not required']]],
    ['Gender', [['Gender at birth', cs.gender.atBirth], ['Pronouns', cs.gender.pronouns],
      o.showSogi && ['Gender identity', cs.gender.identity], o.showSogi && ['Sexual orientation', cs.gender.orientation]]],
    o.showRaceEthnicity && ['Race and Ethnicity', [['Race', cs.race.base], ['Ethnicity', cs.race.ethnicity], ['Tribal affiliation', cs.race.tribal]]],
    o.showSocial && ['Social', [['Marital status', cs.personal.marital], ['Veteran status', cs.personal.veteran], ['Employment', cs.personal.employment]]],
  ];
}
function contactGroups(cs, o, preview) {
  const p = cs.phone, a = cs.address;
  const tel = n => (preview || !n ? fmtPhone(n) : <a className="cph-link" href={'tel:' + n}>{fmtPhone(n)}</a>);
  return [
    ['Phone', [
      ['Cell', p.cell ? <React.Fragment>{tel(p.cell)} {p.textOptOut ? <KvTag warn>Opted out of texts</KvTag> : <KvTag>Text enabled</KvTag>}</React.Fragment> : null],
      ['Home', p.home ? tel(p.home) : null],
      p.dnc && ['Calls', <KvTag warn>Do Not Call</KvTag>],
      o.showPreferred && ['Preferred contact', p.preferred]]],
    /* An address has no break points, so it truncates in place; the full
       address is the tooltip. */
    ['Email and Portal', [['Email', p.email ? <span className="qvx-trunc" title={p.email}>{preview ? p.email : <a className="cph-link" href={'mailto:' + p.email}>{p.email}</a>}</span> : null],
      ['Client portal', p.portal ? 'Active' : <KvTag>Not set up</KvTag>],
      o.showPreferred && ['Preferred language', cs.personal.preferredLanguage]]],
    o.showAddress && ['Address', [
      a.unhoused && ['Housing', <KvTag warn>Unhoused</KvTag>],
      ['Street', a.line1], ['City', [a.city, a.state, a.zip].filter(Boolean).join(', ')], ['County', a.county],
      ['Status', a.status === 'Verified' ? 'Verified' : <KvTag warn>{a.status}</KvTag>],
      a.doNotMail && ['Mail', <KvTag warn>Do Not Mail</KvTag>]]],
  ];
}

/* ================= Header quick views ================= */
function DemographicsQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useCoverNav(client);
  const cs = coverSheet(client);
  return (
    <div className="cph-qvx">
      <QvBar title="Demographics" meta={preview ? null : updatedLine(cs)} preview={preview} viewAllLabel="Cover Sheet" onViewAll={() => go('client')} />
      <KvGroups groups={demographicGroups(cs, view.options)} />
    </div>
  );
}

function ContactQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useCoverNav(client);
  const cs = coverSheet(client);
  return (
    <div className="cph-qvx">
      <QvBar title="Contact Info" meta={preview ? null : updatedLine(cs)} preview={preview} viewAllLabel="Cover Sheet" onViewAll={() => go('address')} />
      <KvGroups groups={contactGroups(cs, view.options, preview)} />
    </div>
  );
}

function SupportQV({ view, client, preview }) {
  useRecordsVersion();
  const go = useCoverNav(client);
  const o = view.options;
  const [adding, setAdding] = useState(false);
  const all = getSupportContacts(client);
  const rows = o.consentOnly ? all.filter(s => s.release) : all;
  const released = all.filter(s => s.release).length;
  const team = client.team || careTeam(client.client_id);
  return (
    <div className="cph-qvx">
      <QvBar title="Support Contacts" meta={all.length + ' on file · ' + released + ' with a release'} preview={preview}
        viewAllLabel="Cover Sheet" onViewAll={() => go('contacts')}
        onAdd={() => setAdding(true)} addLabel="Add Contact" />
      <div className="qvx-split">
        {rows.length ? (
          <table className="data-table compact qvx-table qvx-side qvx-side--wide">
            <thead><tr><th>Name</th><th>Contact Type</th>{o.showRelationship && <th>Relationship</th>}<th>Phone</th><th>Release</th><th>Entered</th></tr></thead>
            <tbody>{rows.map(s => (
              <tr key={s.id || s.name}>
                <td className="wrap"><RecLink preview={preview} onOpen={() => go('contacts')}>{s.name}</RecLink>{s.preferred && <div className="cell-sub">Prefers {s.preferred.toLowerCase()}</div>}</td>
                <td>{s.type || '—'}{s.emergency && s.type !== 'Emergency Contact' && <div className="cell-sub">Emergency contact</div>}</td>
                {o.showRelationship && <td>{s.role || '—'}</td>}
                <td>{s.phone ? fmtPhone(s.phone) : '—'}</td>
                <td><KvTag warn={!s.release}>{s.release ? 'On file' : 'No release'}</KvTag></td>
                <EnteredCell on={s.entered_on} by={s.entered_by_staff_id} />
              </tr>
            ))}</tbody>
          </table>
        ) : <QvxEmpty>{o.consentOnly ? 'No contacts with a release on file.' : 'No support contacts on file.'}</QvxEmpty>}
        {o.showCareTeam !== false && <TeamBox team={team} />}
      </div>
      {adding && <AddSupportContactOverlay client={client} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* Production's Contact Info form, the parts that identify and reach the
   person. Adding a contact never shares anything with them: that needs a
   signed release, which is its own record. */
const CONTACT_TYPES = ['Emergency Contact', 'Guardian', 'Family', 'Friend', 'Payee', 'Primary Care Provider', 'Other'];
const RELATIONSHIPS = ['Parent', 'Sibling', 'Partner', 'Spouse', 'Adult Child', 'Grandparent', 'Friend', 'Other'];
function AddSupportContactOverlay({ client, onClose }) {
  const guard = useGuard();
  const [f, setF] = useState({ type: '', relationship: '', first: '', last: '', phone: '', email: '', preferred: '', language: '', emergency: false });
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const digits = f.phone.replace(/\D/g, '');
  const errs = { type: !f.type && 'Contact type is required.', last: !f.last.trim() && 'Last or facility name is required.',
    preferred: !f.preferred && 'Preferred contact is required.',
    phone: f.phone && digits.length !== 10 && 'Enter a 10-digit phone number.',
    reach: (f.preferred === 'Email' ? !f.email.trim() : f.preferred && !digits) && 'Add the ' + (f.preferred === 'Email' ? 'email address' : 'phone number') + ' for their preferred contact.' };
  const e = k => (tried ? errs[k] || null : null);
  const save = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    const name = [f.first.trim(), f.last.trim()].filter(Boolean).join(' ');
    addRecord('contacts', { id: newId('SC'), client_id: client.client_id, name, type: f.type, role: f.relationship || null,
      emergency: f.emergency || f.type === 'Emergency Contact', release: false, phone: digits || null, email: f.email.trim() || null,
      preferred: f.preferred, language: f.language || null, ...enteredNow() });
    guard.setToast({ status: 'success', title: 'Contact added', detail: name + ' · ' + f.type });
    onClose();
  };
  return (
    <Overlay size="md" title="Add Contact" subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add Contact</Button></React.Fragment>}>
      <div className="chc-note chc-note--info"><Icon name="info" size={15} />
        <div>Adding a contact doesn’t let staff share {client.shortName}’s information with them. That needs a signed release of information.</div>
      </div>
      <div className="ovl-grid ovl-grid--2">
        <Field label="Contact Type" required error={e('type')}><Dropdown value={f.type} options={CONTACT_TYPES} placeholder="Please select…" onChange={v => set('type', v)} invalid={!!e('type')} /></Field>
        <Field label="Relationship"><Dropdown value={f.relationship} options={RELATIONSHIPS} placeholder="Please select…" onChange={v => set('relationship', v)} /></Field>
        <Field label="First Name"><TextIn value={f.first} onChange={v => set('first', v)} /></Field>
        <Field label="Last / Facility Name" required error={e('last')}><TextIn value={f.last} onChange={v => set('last', v)} invalid={!!e('last')} /></Field>
        <Field label="Phone" error={e('phone')}><TextIn value={f.phone} onChange={v => set('phone', v.replace(/[^0-9()\- ]/g, ''))} placeholder="(555) 555-5555" inputMode="tel" invalid={!!e('phone')} /></Field>
        <Field label="Email"><TextIn value={f.email} onChange={v => set('email', v)} type="email" /></Field>
        <Field label="Preferred Contact" required error={e('preferred') || e('reach')}><Dropdown value={f.preferred} options={['Phone call', 'Text message', 'Email']} placeholder="Please select…" onChange={v => set('preferred', v)} invalid={!!(e('preferred') || e('reach'))} /></Field>
        <Field label="Preferred Language"><Dropdown value={f.language} options={['English', 'Spanish', 'Vietnamese', 'Tagalog', 'Mandarin', 'Other']} placeholder="Please select…" onChange={v => set('language', v)} /></Field>
      </div>
      <Checkbox checked={f.emergency || f.type === 'Emergency Contact'} disabled={f.type === 'Emergency Contact'} onChange={v => set('emergency', v)} label="Emergency contact" />
    </Overlay>
  );
}

/* ================= The Cover Sheet page ================= */
/* Production's sections, read-only here: editing a demographic field isn't
   part of the prototype. Contact History (support contacts) is a list, with
   Add Contact. Arriving from a header quick view scrolls to its section. */
const COVER_ALL = { showLanguage: true, showSogi: true, showRaceEthnicity: true, showSocial: true, showPreferred: true, showAddress: true };
function CoverSheetPage({ client }) {
  useRecordsVersion();
  const [adding, setAdding] = useState(false);
  const cs = coverSheet(client);
  const contacts = getSupportContacts(client);
  const attrs = activeAttrs(client);
  const refs = { client: useRef(null), address: useRef(null), contacts: useRef(null) };
  useEffect(() => {
    const r = COVER_FOCUS && refs[COVER_FOCUS]; COVER_FOCUS = null;
    if (r && r.current) r.current.scrollIntoView({ block: 'start' });
  }, []);
  return (
    <div className="pf-page cover">
      <div className="pf-sample">{updatedLine(cs)}. Editing these fields isn’t part of the prototype.</div>
      <div ref={refs.client}><Panel title="Client"><KvGroups groups={demographicGroups(cs, COVER_ALL).concat([
        ['Identifiers', [['MRN', cs.ids.mrn], ['Medicaid ID', cs.ids.medicaid], ['Funding source #', cs.ids.funding]]]])} /></Panel></div>
      <Panel title="Attributes">
        <div className="cph-flags-list cover-attrs">
          {attrs.length ? attrs.map(r => <span key={r.assignment_id} className="cph-attr"><AttrGlyph attr={r.attribute} />{r.attribute.name}<AttrFlag attr={r.attribute} /></span>)
            : <span className="cph-attr cph-attr--none">No attributes on this chart</span>}
        </div>
      </Panel>
      <div ref={refs.address}><Panel title="Address and Phone"><KvGroups groups={contactGroups(cs, COVER_ALL)} /></Panel></div>
      <div ref={refs.contacts}>
        <Panel title={'Contact History (' + contacts.length + ')'}
          action={<Button size="sm" variant="primary" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Add Contact</Button>}>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Contact Type</th><th>Name</th><th>Relationship</th><th>Contact Details</th><th>Release</th><th>Entered</th></tr></thead>
              <tbody>
                {contacts.map(s => (
                  <tr key={s.id || s.name}>
                    <td>{s.type || '—'}</td><td className="wrap">{s.name}</td><td>{s.role || '—'}</td>
                    <td className="wrap">{s.phone ? 'Phone: ' + fmtPhone(s.phone) : '—'}{s.email && <div className="cell-sub">{s.email}</div>}</td>
                    <td><KvTag warn={!s.release}>{s.release ? 'On file' : 'No release'}</KvTag></td>
                    <EnteredCell on={s.entered_on} by={s.entered_by_staff_id} />
                  </tr>
                ))}
                {!contacts.length && <tr><td colSpan={6} className="cam-empty">No contacts on file.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      {adding && <AddSupportContactOverlay client={client} onClose={() => setAdding(false)} />}
    </div>
  );
}
