/* ===== Admin › User Interface Options ============================
   The administrator half of the two-level UI configuration described in
   15-uiconfig.jsx. An index of the things an agency can shape, and — the one
   built out here — the client-header editor.

   The header is the piece that matters most across populations. A prescriber
   needs the medication list and the acuity scores in front of them; a
   children's-services intake coordinator needs the language, the supports and
   the guardian, and has no use for BMI. Today the header is the same for
   everyone, so both are reading around each other's fields.

   THREE SCREENS, not one. The editor used to be a single page that mixed a
   preset switcher, every field for whichever preset was selected, and a
   live-rendered preview, all open at once — reasonable when there was one
   header, unreadable once there were several with roles, quick views, actions
   and a status each. It is now:
     index        → this file's UIOptionsIndex, unchanged
     list         → ClientHeaderListPage — every saved header, at a glance
     edit/create  → ClientHeaderEditPage — one header, full detail
   ================================================================ */

/* ---- Index ------------------------------------------------------ */

/* Stylised previews. Deliberately not screenshots and not the real
   components: a card is a way in, and a live component at card size reads as
   broken rather than small. These are drawn from the same tokens, so the theme
   still carries through. */
function PvLogo() {
  return (
    <div className="uio-pv uio-pv-logo">
      <div className="uio-pv-bar"><span className="uio-pv-mark" /><span className="uio-pv-word" /></div>
      <div className="uio-pv-body"><span className="uio-pv-line w60" /><span className="uio-pv-line w40" /></div>
    </div>
  );
}
function PvColor() {
  return (
    <div className="uio-pv uio-pv-color">
      <div className="uio-pv-bar" />
      <div className="uio-pv-swatches">
        {['default', 'purple', 'orange', 'cyan', 'awards'].map(s => (
          <span key={s} className="uio-pv-sw" style={{ background: (THEMES.find(t => t.slug === s) || {}).swatch }} />
        ))}
      </div>
    </div>
  );
}
function PvTabs() {
  return (
    <div className="uio-pv uio-pv-tabs">
      <div className="uio-pv-tabrow">
        <span className="uio-pv-tab on" /><span className="uio-pv-tab" /><span className="uio-pv-tab" /><span className="uio-pv-tab" />
      </div>
      <div className="uio-pv-body"><span className="uio-pv-line w80" /><span className="uio-pv-line w50" /></div>
    </div>
  );
}
function PvHeader() {
  return (
    <div className="uio-pv uio-pv-header">
      <div className="uio-pv-hrow">
        <span className="uio-pv-av" />
        <span className="uio-pv-stack"><span className="uio-pv-line w70" /><span className="uio-pv-line w40" /></span>
        <span className="uio-pv-dots"><i /><i /><i /></span>
      </div>
      <div className="uio-pv-pills"><span className="on" /><span /><span /><span /></div>
      <div className="uio-pv-strip"><i /><i /><i /><i /><i /></div>
    </div>
  );
}

const UI_OPTION_CARDS = [
  {
    key: 'header', title: 'Client Header', Preview: PvHeader, ready: true,
    to: '/user-interface-options/client-header',
    blurb: 'Which quick views appear, in what order, and whether the medical strip and action toolbar show at all. Saved as named headers and assigned to staff roles.',
    meta: cfg => cfg.presets.length + ' header' + (cfg.presets.length === 1 ? '' : 's') + ' · '
      + cfg.presets.reduce((n, p) => n + p.roles.length, 0) + ' of ' + STAFF_ROLE_NAMES.length + ' roles assigned',
  },
  {
    key: 'logo', title: 'Agency Logo', Preview: PvLogo, ready: false,
    blurb: 'The mark in the top bar, on printed documents and on the sign-in screen. Light and dark variants, plus a favicon.',
    meta: () => 'Using the default AxiomEHR mark',
  },
  {
    key: 'color', title: 'Default Site Colour', Preview: PvColor, ready: false,
    blurb: 'The theme every staff member starts on, and whether they may change it for themselves.',
    meta: () => THEMES.length + ' themes available',
  },
  {
    key: 'tabs', title: 'Tab Sets', Preview: PvTabs, ready: false,
    blurb: 'Which chart tabs a program sees, in what order, and which one a chart opens on.',
    meta: () => 'Chart, module and dashboard tab sets',
  },
];

function UIOptionsIndex() {
  const guard = useGuard();
  const { config } = useUIConfig();
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'User Interface Options' }]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">User Interface Options</h1>
          <div className="page-sub">
            Agency-wide appearance and layout. These are set once here and inherited by every
            staff member; some can then be overridden by the individual in Preferences.
          </div>
        </div>
      </div>

      <div className="uio-cards">
        {UI_OPTION_CARDS.map(c => (
          <section key={c.key} className={'panel uio-card' + (c.ready ? '' : ' uio-card--soon')}>
            <div className="uio-card-pv"><c.Preview /></div>
            <div className="uio-card-body">
              <div className="uio-card-head">
                <h2 className="uio-card-title">{c.title}</h2>
                {!c.ready && <span className="badge status-neutral">Not in this prototype</span>}
              </div>
              <p className="uio-card-blurb">{c.blurb}</p>
              <div className="uio-card-foot">
                <span className="uio-card-meta">{c.meta(config)}</span>
                <Button size="sm" variant={c.ready ? 'primary' : 'secondary'} disabled={!c.ready}
                  onClick={() => c.to && guard.go(c.to)}>Configure</Button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---- Shared bits -------------------------------------------------- */

/* No usage log exists in this prototype — there is nothing real to read. This
   is a deterministic, illustrative stand-in only: roughly scaled by how many
   roles a header serves, zero for an inactive one (nobody can be on a header
   that is not in circulation). A real build reads this from wherever staff
   sessions are logged. */
function usageLast30d(preset) {
  if (preset.status === 'inactive') return 0;
  if (!preset.roles.length) return 0;
  return preset.roles.length * (3 + seed(preset.id + 'u') % 5) + seed(preset.id + 'u2') % 12;
}

/* ---- Client header list ------------------------------------------- */

function ClientHeaderListPage() {
  const guard = useGuard();
  const { config } = useUIConfig();
  const unassigned = STAFF_ROLE_NAMES.filter(r => !config.presets.some(p => p.roles.indexOf(r) !== -1));
  const defaultPreset = config.presets.find(p => p.id === config.defaultPresetId) || config.presets[0];

  return (
    <div className="page chc">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'User Interface Options', to: '/user-interface-options' },
        { label: 'Client Header' },
      ]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Client Header</h1>
          <div className="page-sub">
            Every saved header, who it's for, and whether it's actually in front of anyone yet.
            Open one to change what it shows.
          </div>
        </div>
        <span className="spacer" />
        <Button variant="primary" onClick={() => guard.go('/user-interface-options/client-header/new')}>
          <Icon name="plus" size={15} /> New Header
        </Button>
      </div>

      {!!unassigned.length && (
        <div className="info-banner" role="note">
          <Icon name="info" size={20} />
          <div>
            {unassigned.length} role{unassigned.length === 1 ? '' : 's'} {unassigned.length === 1 ? 'is' : 'are'} not
            assigned to a header and will use <b>{defaultPreset.name}</b>: {unassigned.join(', ')}.
          </div>
        </div>
      )}

      <Panel title={'Saved Headers (' + config.presets.length + ')'}>
        <div className="table-wrap">
          <table className="data-table chc-list-table">
            <thead>
              <tr>
                <th>Header</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Users, last 30 days</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {config.presets.map(p => {
                const shown = p.roles.slice(0, 3);
                const more = p.roles.length - shown.length;
                return (
                  <tr key={p.id}>
                    <td className="wrap">
                      <button className="lnk chc-list-name" onClick={() => guard.go('/user-interface-options/client-header/' + p.id)}>
                        {p.name}
                      </button>
                      {p.id === config.defaultPresetId && <span className="badge status-info chc-list-default">Default</span>}
                      {p.description && <div className="chc-list-desc">{p.description}</div>}
                    </td>
                    <td className="wrap">
                      {p.roles.length
                        ? <span>{shown.join(', ')}{more > 0 ? ' +' + more + ' more' : ''}</span>
                        : <span className="chc-list-empty">No roles assigned</span>}
                    </td>
                    <td>
                      <span className={'badge ' + (p.status === 'inactive' ? 'status-neutral' : 'status-active')}>
                        {p.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td>{usageLast30d(p)}</td>
                    <td>
                      <Button size="sm" variant="secondary"
                        onClick={() => guard.go('/user-interface-options/client-header/' + p.id)}>Edit</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---- Quick-view options editor ------------------------------------ */

/* One line describing what a quick view is currently set to, so the list reads
   without opening every row. */
function qvSummary(view) {
  const def = QV_BY_KEY[view.key];
  if (!def) return '';
  const parts = [];
  def.options.forEach(opt => {
    const val = view.options[opt.key];
    if (opt.kind === 'bool') { if (val) parts.push(opt.label.replace(/^Show /, '')); }
    else if (opt.kind === 'choice') parts.push(val);
    else if (opt.kind === 'fields') {
      const total = opt.choices.length + (view.options[opt.key + 'Custom'] || []).length;
      parts.push((val || []).length + ' of ' + total + ' fields');
    }
  });
  return parts.length ? parts.join(' · ') : def.blurb;
}

/* The "which fields" picker. Custom fields — a school's "Grade Level", a
   program's own ID — are provisioned elsewhere in Admin, not typed in here;
   this only lets the admin choose whether an already-provisioned one shows on
   this particular header, grouped under its own heading so it reads as a
   distinct set rather than something missing from the catalogue. */
function FieldsOption({ opt, view, onChange }) {
  const chosen = view.options[opt.key] || [];
  const custom = view.options[opt.key + 'Custom'] || [];

  const toggle = ch => onChange({
    ...view,
    options: { ...view.options, [opt.key]: chosen.indexOf(ch) !== -1 ? chosen.filter(x => x !== ch) : chosen.concat([ch]) },
  });
  const Row = ({ ch }) => {
    const on = chosen.indexOf(ch) !== -1;
    return (
      <div className="qvo-field-opt" role="checkbox" aria-checked={on} tabIndex={0}
        onClick={() => toggle(ch)}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(ch); } }}>
        <Checkbox checked={on} onChange={() => {}} ariaLabel={ch} />
        <span>{ch}</span>
      </div>
    );
  };

  return (
    <div className="qvo-row">
      <span className="qvo-label">{opt.label}</span>
      {opt.help && <div className="qvo-help">{opt.help}</div>}
      {!!opt.choices.length && (
        <React.Fragment>
          {!!custom.length && <div className="qvo-subhead">Standard fields</div>}
          <div className="qvo-fields">{opt.choices.map(ch => <Row key={ch} ch={ch} />)}</div>
        </React.Fragment>
      )}
      {!!custom.length && (
        <React.Fragment>
          <div className="qvo-subhead">Custom fields</div>
          <div className="qvo-help">Added elsewhere in Admin for this agency. Choose whether it shows on this header.</div>
          <div className="qvo-fields">{custom.map(ch => <Row key={ch} ch={ch} />)}</div>
        </React.Fragment>
      )}
      {!opt.choices.length && !custom.length && (
        <div className="qvo-help">No custom fields have been added for this agency yet.</div>
      )}
    </div>
  );
}

function QuickViewOptions({ view, onChange }) {
  const def = QV_BY_KEY[view.key];
  if (!def) return null;
  const set = (k, v) => onChange({ ...view, options: { ...view.options, [k]: v } });
  return (
    <div className="qvo">
      {!!def.lockedFields && (
        <div className="qvo-row">
          <span className="qvo-label">Always shown</span>
          <div className="qvo-help">Every header identifies the client the same way. These cannot be turned off here.</div>
          <div className="qvo-fields">
            {def.lockedFields.map(f => (
              <div key={f} className="qvo-field-opt is-locked">
                <Checkbox checked disabled onChange={() => {}} ariaLabel={f} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!def.options.length && !def.lockedFields && <div className="qvo-none">No further options.</div>}
      {def.options.map(opt => {
        const val = view.options[opt.key];
        if (opt.kind === 'bool') {
          return (
            <div key={opt.key} className="qvo-row">
              <Checkbox checked={!!val} onChange={v => set(opt.key, v)} label={opt.label} />
              {opt.help && <div className="qvo-help">{opt.help}</div>}
            </div>
          );
        }
        if (opt.kind === 'choice') {
          return (
            <div key={opt.key} className="qvo-row qvo-row--choice">
              <span className="qvo-label">{opt.label}</span>
              <Dropdown value={val} options={opt.choices} onChange={v => set(opt.key, v)} />
            </div>
          );
        }
        return <FieldsOption key={opt.key} opt={opt} view={view} onChange={onChange} />;
      })}
    </div>
  );
}

/* Reorderable list. Pointer drag AND explicit move buttons: drag-and-drop is
   the obvious gesture and is unusable from a keyboard, so the buttons are not
   a fallback, they are the accessible path. The grip is decorative — it is
   the up/down buttons next to it that keyboard users actually operate. */
function QuickViewOrder({ views, onChange }) {
  const [dragIx, setDragIx] = useState(null);
  const [overIx, setOverIx] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  const move = (from, to) => {
    if (to < 0 || to >= views.length || from === to) return;
    const next = views.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  const remove = i => onChange(views.filter((_, ix) => ix !== i));
  const patch = (i, v) => onChange(views.map((x, ix) => (ix === i ? v : x)));

  return (
    <ul className="qvlist">
      {views.map((view, i) => {
        const def = QV_BY_KEY[view.key] || { label: view.key, icon: 'grid' };
        const open = openKey === view.key;
        return (
          <li key={view.key}
            className={'qvitem' + (dragIx === i ? ' is-dragging' : '') + (overIx === i && dragIx !== i ? ' is-over' : '')}
            draggable
            onDragStart={e => { setDragIx(i); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={e => { e.preventDefault(); setOverIx(i); }}
            onDrop={e => { e.preventDefault(); if (dragIx != null) move(dragIx, i); setDragIx(null); setOverIx(null); }}
            onDragEnd={() => { setDragIx(null); setOverIx(null); }}>
            <div className="qvitem-row">
              <span className="qvitem-grip" aria-hidden="true" title="Drag to reorder"><Icon name="grip" size={16} /></span>
              <span className="qvitem-ord">{i + 1}</span>
              <span className="qvitem-ico"><Icon name={def.icon} size={20} /></span>
              <span className="qvitem-text">
                <span className="qvitem-name">{def.label}</span>
                <span className="qvitem-sub">{qvSummary(view)}</span>
              </span>
              <span className="qvitem-acts">
                <button className="icon-btn" aria-label={'Move ' + def.label + ' up'} disabled={i === 0}
                  onClick={() => move(i, i - 1)}><Icon name="chevronUp" size={16} /></button>
                <button className="icon-btn" aria-label={'Move ' + def.label + ' down'} disabled={i === views.length - 1}
                  onClick={() => move(i, i + 1)}><Icon name="chevronDown" size={16} /></button>
                <button className={'lnk qvitem-opt' + (open ? ' on' : '')} aria-expanded={open}
                  onClick={() => setOpenKey(k => (k === view.key ? null : view.key))}>
                  {open ? 'Hide options' : 'Options'}
                </button>
                <button className="icon-btn" aria-label={'Remove ' + def.label} disabled={views.length === 1}
                  onClick={() => remove(i)}><Icon name="close" size={16} /></button>
              </span>
            </div>
            {open && <QuickViewOptions view={view} onChange={v => patch(i, v)} />}
          </li>
        );
      })}
    </ul>
  );
}

/* ---- Preview overlay ----------------------------------------------
   The real component, not a mock — but behind a button, not sitting open on
   the page by default. An admin previews on demand (often exactly to test a
   header before switching it to Active), rather than every edit re-rendering
   a chunk of chart nobody asked to see yet.

   The CLIENT shown here is not one of this prototype's usual synthetic
   caseload — Maria Gonzalez, DeShawn Carter and so on read as real people on
   purpose, so the rest of the app feels true to life. An admin configuration
   screen needs the opposite: nobody should be able to glance at this preview
   and wonder for a second whether they are looking at an actual client's
   chart. Every field below is deliberately, unmistakably fictional. */
const PREVIEW_CLIENT = {
  client_id: 'PREVIEW-0000', mrn: 'MRN-DEMO-0000', axiomId: '12345',
  cin: 'DEMO-CIN-00', sharedServiceId: '*DEMO-0000',
  first_name: 'Michael', last_name: 'Mouse', preferred_name: 'Mickey',
  name: 'Michael Mouse', displayName: 'Michael “Mickey” Mouse', shortName: 'Mickey',
  dob: '1928-11-18', age: ageOf('1928-11-18'), gender: 'Male', pronouns: 'He/Him',
  race: 'Prefers not to say', ethnicity: 'Prefers not to say', primary_language: 'English',
  status: 'Active', email: 'mickey.mouse.demo@example.com', phone: '555-010-1111',
  address: { line1: '1 Storybook Lane', city: 'Anytown', state: 'CA', zip: '90000' },
  program: 'Preview Program', programId: null, siteName: 'Preview Site',
  enrollment_date: '2020-01-01', funding: 'Demo — Not Billed',
  residence: 'Toon Manor', housingType: 'Independent',
  /* A care team of Disney characters can never be mistaken for a real
     assignment pulled off a real roster — see the `client.team ||
     careTeam(...)` fallback in `QuickViewBody`. */
  team: [
    { id: 'PREVIEW-T1', name: 'Donald Duck', role: 'Case Manager' },
    { id: 'PREVIEW-T2', name: 'Minnie Mouse', role: 'Primary Care Provider' },
  ],
  attrs: [{ name: 'Infectious Laugh' }, { name: 'Can-Do Attitude' }, { name: 'Fear of Lonesome Ghosts' }],
  vitals: {
    date_time: '2026-08-01T09:00:00', height_in: 27, weight_lbs: 42, bmi: 15.2,
    temp_f: 98.6, pulse_bpm: 88, bp_systolic: 100, bp_diastolic: 65, o2_sat_pct: 99, pain_scale: 0,
  },
  vitalsAll: [{ date_time: '2026-08-01T09:00:00' }],
  allergies: [{ allergy_id: 'PREVIEW-AL1', allergen: 'Cheese Wedges', reaction: 'Uncontrollable Giggling', allergen_category: 'Food', severity_flag: 'Low', status: 'Active' }],
  rx: [{ rx_id: 'PREVIEW-RX1', medication_display: 'Wonder Vitamin, Chewable', sig: 'Chew one tablet daily with cheese', rx_type: 'Current', qty: 30, days: 30, refills: 2 }],
  diagnoses: [{ client_dx_id: 'PREVIEW-DX1', icd10: 'Z99.9', description: 'Chronic Cheerfulness (unspecified)', status: 'Active', precedence: 'Primary', onset_date: '2020-01-01' }],
  problems: [{ client_problem_id: 'PREVIEW-PR1', name: 'Occasional Mischief', category: 'Behavioral', status: 'Active', onset_date: '2020-01-01' }],
  /* Records for the clinical quick views, so every one of them has something
     to show in the preview — all as fictional as the rest of this record. The
     getters in 16-records.jsx use these instead of the fixtures. */
  records: {
    meds: [
      { med_rx_id: 'PREVIEW-M1', medication_display: 'Wonder Vitamin, Chewable 1 tab', drug_class: 'Supplement', schedule: null, sig: 'Chew one tablet daily with cheese',
        refills_authorized: 3, refills_remaining: 2, prescriber_staff_id: null, pharmacy: 'Toontown Apothecary', start_date: '2026-06-01', end_date: '2026-12-01', last_filled: '2026-09-01', status: 'Active', rx_status: 'E-PRESCRIBED' },
      { med_rx_id: 'PREVIEW-M2', medication_display: 'Calm-Down Cocoa 8 oz', drug_class: 'Comfort', schedule: 'C-IV', sig: 'One mug at bedtime as needed',
        refills_authorized: 1, refills_remaining: 1, prescriber_staff_id: null, pharmacy: 'Toontown Apothecary', start_date: '2026-07-01', end_date: '2026-10-30', last_filled: '2026-08-15', status: 'Active', rx_status: 'E-PRESCRIBED' },
      { med_rx_id: 'PREVIEW-M3', medication_display: 'Giggle Suppressant 5 mg', drug_class: 'Antitickle', schedule: null, sig: 'Take one before serious meetings',
        refills_authorized: 0, refills_remaining: 0, prescriber_staff_id: null, pharmacy: 'Toontown Apothecary', start_date: '2025-01-01', end_date: '2025-04-01', last_filled: '2025-03-01', status: 'Discontinued', discontinued_date: '2025-02-10', discontinued_reason: 'Ineffective' },
    ],
    vitals: [{ vitals_id: 'PREVIEW-V1', date_time: '2026-08-01T09:00:00', height_in: 27, weight_lbs: 42, bmi: 15.2, temp_f: 98.6, pulse_bpm: 88, resp_rate: 16, bp_systolic: 100, bp_diastolic: 65, o2_sat_pct: 99, pain_scale: 0 }],
    immunizations: [{ immunization_id: 'PREVIEW-I1', vaccine: 'Influenza (2025–26)', dose: '1 of 1', date: '2025-10-15', status: 'Administered', lot: 'LOT-TOON001' }],
    injections: [{ injection_id: 'PREVIEW-J1', medication: 'Cyanocobalamin (Vitamin B12)', dose: '1000 mcg', date_given: '2026-09-01', next_due: '2026-10-01', interval_days: 30, site: 'Left deltoid' }],
    admins: [{ administration_id: 'PREVIEW-A1', form_id: 'PHQ9', date: '2026-09-01', administered_by_staff_id: null, responses: [0, 0, 1, 0, 0, 0, 1, 0, 0], score: 2, band: 'Minimal', flagged: false }],
    notes: [
      { note_id: 'PREVIEW-N1', subject: 'Big ears, bigger heart', body: 'Brought cheese for the whole group again. Morale is excellent.', important: false, timestamp: '2026-09-21T10:00:00', author_staff_id: null, author_name: 'Sample Case Manager', author_role: 'Case Manager', read_by: [] },
      { note_id: 'PREVIEW-N2', subject: 'Avoid haunted houses', body: 'Reminder: no field trips to anything resembling a lonesome-ghost situation.', important: true, timestamp: '2026-09-18T14:30:00', author_staff_id: null, author_name: 'Sample Clinician', author_role: 'Clinician', read_by: ['ST-2003'] },
    ],
  },
};

function HeaderPreviewModal({ preset, onClose }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <React.Fragment>
      <div className="modal-scrim" onClick={onClose} />
      <div className="chc-previewmodal" role="dialog" aria-modal="true" aria-label={'Preview — ' + preset.name}>
        <div className="intercept-head">
          <div className="modal-head-content">
            <h2 className="intercept-title">Preview — {preset.name}</h2>
          </div>
          <div className="modal-head-actions">
            <button className="icon-btn modal-dismiss" aria-label="Close" onClick={onClose} data-node-id="2048:586">
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>
        <div className="chc-previewmodal-body">
          <div className="chc-note">
            The real component with this header's current settings — including anything not saved
            yet. The client shown is a fixed demo record, not anyone on a real caseload. Expanded
            here so the quick views are visible; staff choose collapsed or expanded for themselves
            in Preferences.
          </div>
          <div className="chc-preview">
            <ClientPageHeader key={preset.id} client={PREVIEW_CLIENT} preset={preset} preview />
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- Client header editor ------------------------------------------
   One header per visit — the preset switcher that used to live beside this
   editor is gone; ClientHeaderListPage is where you pick which one to open. */
function ClientHeaderEditPage({ id }) {
  const guard = useGuard();
  /* Save, Delete and Cancel-on-a-new-header all navigate back to the list
     immediately after resolving the very thing the "unsaved changes"
     intercept exists to protect — there is nothing left to lose by the time
     they call it. `guard.go()` would still intercept anyway: `clearDirty()`
     only schedules a state update, and the `guard` object captured in this
     render closes over the OLD one no matter how the navigate call is
     deferred, so the fix is not timing — it is going around the guard
     entirely for this one, deliberate case, the way `useRawNavigate` exists
     to allow. `guard.clearDirty()` still runs first so the rest of the app's
     navigation stops thinking anything is unsaved. */
  const rawNavigate = useRawNavigate();
  const { config, setConfig } = useUIConfig();
  const isNew = id === 'new';
  const original = isNew ? null : config.presets.find(p => p.id === id);

  const blankPreset = () => ({
    id: 'hp-' + Date.now().toString(36), name: 'New Header', description: '', status: 'active',
    roles: [], showClinicalStrip: true, showActions: true, actions: DEFAULT_ACTIONS.slice(),
    quickViews: [makeView('general'), makeView('contact')],
  });
  /* `original` is `undefined` for an `:id` that doesn't match any saved
     preset — `clone(undefined)` throws (`JSON.stringify` returns the bare word
     `undefined`, which `JSON.parse` then rejects), so this has to fall back to
     something clonable even though the not-found branch below is what
     actually renders in that case and this draft is never shown. */
  const [draft, setDraft] = useState(() => (isNew || !original ? blankPreset() : clone(original)));
  /* `Routes` renders this component at the same tree position for every
     `:id`, so navigating from one header's edit URL straight to another's —
     a pasted link, the back button, editing the hash bar — re-renders this
     same instance with a new `id` prop rather than mounting a fresh one. The
     `useState` initialiser above only ever runs once; without this, the
     previous header's draft would silently keep showing under the new one's
     breadcrumb and title. Same trap as `ChartPage` re-adopting a client. */
  useEffect(() => {
    const found = isNew ? null : config.presets.find(p => p.id === id);
    setDraft(isNew || !found ? blankPreset() : clone(found));
  }, [id]);
  const [previewOpen, setPreviewOpen] = useState(false);
  /* A brand-new header has no saved self to diverge from — Save (here, Create)
     is always available rather than staying disabled until something changes. */
  const dirty = isNew || (original ? JSON.stringify(draft) !== JSON.stringify(original) : false);
  useEffect(() => { if (dirty) guard.markDirty('Client Header Configuration'); else guard.clearDirty(); }, [dirty]);
  useEffect(() => () => guard.clearDirty(), []);

  if (!isNew && !original) {
    return (
      <div className="page">
        <Breadcrumbs items={[
          { label: 'Admin', to: '/admin' }, { label: 'User Interface Options', to: '/user-interface-options' },
          { label: 'Client Header', to: '/user-interface-options/client-header' }, { label: 'Not found' },
        ]} />
        <h1 className="page-title">Header not found</h1>
        <p className="page-sub">No saved header matches <code>{id}</code>. It may already have been deleted.</p>
        <Button variant="secondary" onClick={() => guard.go('/user-interface-options/client-header')}>Back to Client Header</Button>
      </div>
    );
  }

  const patch = obj => setDraft(d => ({ ...d, ...obj }));
  const isDefault = !isNew && draft.id === config.defaultPresetId;

  /* Who else currently owns a role, so claiming it here is never a silent
     theft — checked against the saved config, since this page only drafts the
     one header, not the whole set. */
  const ownerOf = role => config.presets.find(p => p.id !== draft.id && p.roles.indexOf(role) !== -1);
  const toggleRole = role => patch({ roles: draft.roles.indexOf(role) !== -1 ? draft.roles.filter(r => r !== role) : draft.roles.concat([role]) });
  const toggleAction = key => patch({ actions: draft.actions.indexOf(key) !== -1 ? draft.actions.filter(a => a !== key) : draft.actions.concat([key]) });

  const addView = key => patch({ quickViews: draft.quickViews.concat([makeView(key)]) });
  const available = QUICKVIEW_CATALOG.filter(q => !draft.quickViews.some(v => v.key === q.key));

  const clearDirtyThenGo = to => { guard.clearDirty(); rawNavigate(to); };

  const save = () => {
    setConfig(c => {
      /* Claiming a role here takes it off whichever other saved header holds
         it — the same exclusivity rule, now enforced at save time since this
         page only ever drafts the one preset. */
      const stripped = c.presets.map(p => (p.id === draft.id ? p : { ...p, roles: p.roles.filter(r => draft.roles.indexOf(r) === -1) }));
      const exists = stripped.some(p => p.id === draft.id);
      return { ...c, presets: exists ? stripped.map(p => (p.id === draft.id ? draft : p)) : stripped.concat([draft]) };
    });
    guard.setToast({
      icon: 'check', title: isNew ? 'Client header created' : 'Client header saved',
      detail: draft.name + ' · ' + draft.roles.length + ' role' + (draft.roles.length === 1 ? '' : 's')
        + ' · ' + (draft.status === 'inactive' ? 'inactive — staff won’t see it yet' : 'active'),
    });
    clearDirtyThenGo('/user-interface-options/client-header');
  };
  const discard = () => { if (isNew) clearDirtyThenGo('/user-interface-options/client-header'); else setDraft(clone(original)); };

  const setDefault = () => {
    setConfig(c => ({ ...c, defaultPresetId: draft.id }));
    guard.setToast({ icon: 'check', title: draft.name + ' set as the default header', detail: 'Any role not explicitly assigned elsewhere now falls back to this one.' });
  };
  const deletePreset = () => {
    if (config.presets.length < 2 || isDefault) return;
    setConfig(c => ({ ...c, presets: c.presets.filter(p => p.id !== draft.id) }));
    guard.setToast({ icon: 'check', title: draft.name + ' deleted', detail: 'Any role that was assigned to it now falls back to the default header.' });
    clearDirtyThenGo('/user-interface-options/client-header');
  };

  const roleOptions = STAFF_ROLE_NAMES.map(r => {
    const owner = ownerOf(r);
    return { value: r, label: r, meta: owner ? owner.name : null };
  });
  const actionOptions = QUICK_ACTIONS_CATALOG.map(a => ({ value: a.key, label: a.label }));

  return (
    <div className="page chc">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'User Interface Options', to: '/user-interface-options' },
        { label: 'Client Header', to: '/user-interface-options/client-header' },
        { label: isNew ? 'New Header' : draft.name },
      ]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{isNew ? 'New Header' : draft.name}</h1>
          <div className="page-sub">
            {isNew ? 'Name it, assign it to the roles that should get it, and choose what it shows.'
              : 'Assigned to the staff roles below. Staff can pick a different saved header for themselves in Preferences.'}
          </div>
        </div>
        <span className="spacer" />
        {dirty && <span className="badge status-amber"><Icon name="edit" size={12} /> Unsaved changes</span>}
        <Button variant="secondary" onClick={() => setPreviewOpen(true)}><Icon name="dsSparkle" size={14} /> Preview</Button>
        <Button variant="ghost" onClick={discard} disabled={!isNew && !dirty}>{isNew ? 'Cancel' : 'Discard'}</Button>
        <Button variant="primary" onClick={save} disabled={!dirty}>{isNew ? 'Create Header' : 'Save Changes'}</Button>
      </div>

      {/* One section, not four expandable panels — every control here
          describes the same header and saves in the same action, so nothing
          about it benefits from being collapsible or split apart. */}
      <section className="panel chc-config">
        <div className="chc-sec">
          <h2 className="chc-sectitle">Name and Assignment</h2>
          <label className="form-field"><span>Header name</span>
            <div className="form-input"><input value={draft.name} onChange={e => patch({ name: e.target.value })} /></div>
          </label>
          <label className="form-field"><span>What it is for</span>
            <div className="form-input"><input value={draft.description} placeholder="e.g. Children’s services — supports and language forward"
              onChange={e => patch({ description: e.target.value })} /></div>
          </label>

          <div className="chc-switch">
            <Toggle checked={draft.status !== 'inactive'} disabled={isDefault}
              onChange={v => patch({ status: v ? 'active' : 'inactive' })} />
            <div className="chc-switch-text">
              <div className="chc-switch-name">Active</div>
              <div className="chc-switch-help">
                {isDefault
                  ? 'This is the agency’s default header, so it stays active — set a different header as default first if you need to turn this one off.'
                  : 'Off means staff assigned to this header fall back to the default instead. Use this to build and preview a header before it reaches anyone’s chart.'}
              </div>
            </div>
          </div>

          <div className="pref-label">Applies to roles</div>
          <div className="chc-note">
            A role belongs to one header. Picking a role here takes it off whichever header holds it now.
          </div>
          <MultiSelectDropdown id="chc-roles-select" searchable placeholder="Select roles…"
            selected={draft.roles} onToggle={toggleRole} options={roleOptions} />

          {!isNew && (
            <div className="chc-presetfoot">
              <Button size="sm" variant="secondary" disabled={isDefault} onClick={setDefault}>Set as Default</Button>
              <span className="spacer" />
              <Button size="sm" variant="ghost" disabled={config.presets.length < 2 || isDefault} onClick={deletePreset}>
                Delete Header
              </Button>
            </div>
          )}
        </div>

        <div className="chc-sec">
          <h2 className="chc-sectitle">What the Header Shows</h2>
          <div className="chc-switch">
            <Toggle checked={draft.showClinicalStrip} onChange={v => patch({ showClinicalStrip: v })} />
            <div className="chc-switch-text">
              <div className="chc-switch-name">Medical information strip</div>
              <div className="chc-switch-help">
                The slim band along the bottom — weight, height, BMI, blood pressure and the
                allergy, vitals, problem and medication counts. Off for programs where vitals
                are not why the chart is open.
              </div>
            </div>
          </div>
          <div className="chc-switch">
            <Toggle checked={draft.showActions} onChange={v => patch({ showActions: v })} />
            <div className="chc-switch-text">
              <div className="chc-switch-name">Actions toolbar</div>
              <div className="chc-switch-help">
                The round buttons at the right, plus More Actions and Chat With Chart. Turn off
                entirely, or leave on and choose which round buttons appear below.
              </div>
            </div>
          </div>
        </div>

        <div className="chc-sec">
          <h2 className="chc-sectitle">Quick Contact Actions</h2>
          <div className="chc-note">
            Which round buttons appear in the actions toolbar — add a note, call, text, email,
            start a chat, schedule an appointment. Not every role messages or prescribes; show
            only what a role actually uses.
          </div>
          {/* Same treatment as General's locked fields: Client Notes is in every
              header and can't be turned off, so say so here rather than leave
              an admin wondering where it's configured. */}
          <div className="qvo-field-opt is-locked chc-locked">
            <Checkbox checked disabled onChange={() => {}} ariaLabel="Client Notes" />
            <span><b>Client Notes</b> — always shown, ahead of the actions below, with an unread count. Not configurable.</span>
          </div>
          {draft.showActions ? (
            <MultiSelectDropdown id="chc-actions-select" placeholder="Select actions…"
              selected={draft.actions} onToggle={toggleAction} options={actionOptions} />
          ) : (
            <div className="chc-note chc-note--warn">
              <Icon name="warn" size={15} /> The actions toolbar is off above, so nothing here shows on the header.
            </div>
          )}
        </div>

        <div className="chc-sec">
          <h2 className="chc-sectitle">Quick Views ({draft.quickViews.length})</h2>
          <div className="chc-note">
            The pills in the expanded header, in the order they appear. Drag the grip to reorder, or
            use the arrows. Open <b>Options</b> on any row to narrow what it shows. There's no limit:
            pills wrap to two rows, and past that staff page through them with arrows.
          </div>
          <QuickViewOrder views={draft.quickViews} onChange={v => patch({ quickViews: v })} />

          <div className="pref-label">Add a quick view</div>
          <div className="chc-avail">
            {available.map(q => (
              <button key={q.key} className="chc-add" onClick={() => addView(q.key)}>
                <Icon name={q.icon} size={18} />
                <span className="chc-add-text">
                  <span className="chc-add-name">{q.label}</span>
                  <span className="chc-add-blurb">{q.blurb}</span>
                </span>
                <Icon name="plus" size={15} />
              </button>
            ))}
            {!available.length && <div className="chc-note">Every quick view in the catalogue is already on this header.</div>}
          </div>
        </div>
      </section>

      {previewOpen && <HeaderPreviewModal preset={draft} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
