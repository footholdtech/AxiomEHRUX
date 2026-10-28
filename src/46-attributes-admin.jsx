/* ===== Admin › User Interface Options › Client Attributes ==========
   Where an agency decides which attributes its staff can put on a chart.

   What an attribute is, for now: a mark and a name in the client header — a
   reminder of what to consider when making clinical and administrative
   decisions. It does nothing on its own. (A later iteration could apply or end
   attributes automatically from other workflows; nothing here assumes that.)

   - The list is finite so attributes can be reported on. Admins build it from
     Radicle's standard library (default names, icons, categories, suggestion
     rules) and add their own with an icon or an uploaded image.
   - Per attribute: name, category, mark, whether it needs an end date to come
     off a chart, the topic a note about it defaults to, and Active/Inactive.
   - Inactive means staff can't add it any more. Nothing is removed: charts
     that have it keep it, with its history.
   Data and persistence: 16-records.jsx (agencyAttrs, saveAgencyAttr, …).
   ================================================================ */

/* Uploads: small, square-ish marks shown at 20 × 20. PNG and SVG keep a
   transparent background; JPG is accepted for photos of printed logos. An
   SVG is only ever shown through <img>, which doesn't run scripts in it. */
const ATTR_UPLOAD = { types: ['image/png', 'image/jpeg', 'image/svg+xml'], exts: ['.png', '.jpg', '.jpeg', '.svg'], maxKB: 100 };
const ATTR_UPLOAD_HINT = 'PNG, JPG or SVG, up to 100 KB. It shows at 20 × 20 px, so a simple, square image works best.';

/* Every glyph an admin can choose: the four the DS client header shows, then
   the Fluent attribute set (assets/fluent-attr-icons.js). */
const DS_ATTR_GLYPHS = ['dsPeople', 'dsSyringe', 'dsWarning', 'dsGavel'];
const attrGlyphKeys = () => DS_ATTR_GLYPHS.concat(Object.keys(window.FLUENT || {}).filter(k => /^fl[A-Z]/.test(k)));
const glyphLabel = k => k.replace(/^(fl|ds)/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
/* Standard images an admin can pick like a glyph. */
const attrStdImages = () => ATTR_CATALOG.filter(c => c.image);
const isStdImage = img => ATTR_CATALOG.some(c => c.image === img);
/* A yes in a table column: the mark, with words for screen readers. */
const CamCheck = ({ label }) => <span className="cam-check" role="img" aria-label={label}><Icon name="check" size={18} /></span>;
const attrCategories = () => [...new Set(ATTR_CATALOG.map(c => c.category).concat(agencyAttrs().map(a => a.category)).filter(Boolean))].sort();

/* "Suggested from the chart" rules, in words. Read-only for now. */
function suggestText(s) {
  if (!s) return null;
  const parts = [];
  if (s.icd10 && s.icd10.length) parts.push('an active diagnosis starting ' + s.icd10.join(', '));
  if (s.problems && s.problems.length) parts.push('an active problem: ' + s.problems.join(', '));
  return parts.length ? 'Suggested to staff when a chart has ' + parts.join(', or ') + '.' : null;
}

/* The mark as the header shows it: the expanded attribute box's container. */
function AttrPreview({ attr }) {
  return (
    <div className="cam-preview" aria-label="Preview in the client header">
      <span className="cph-attr"><AttrGlyph attr={attr} />{(attr.name || '').trim() || 'Attribute name'}</span>
    </div>
  );
}

/* ---- Edit / create ------------------------------------------------ */
function AttributeEditOverlay({ attr, onClose }) {
  const guard = useGuard();
  const isNew = !attr;
  const [f, setF] = useState(() => attr ? { ...attr } : {
    attribute_id: newId('ATTR'), catalog_id: null, source: 'custom', name: '', category: '', icon: null, image: null,
    suggest: {}, removal: 'remove', note_topic: 'Other', status: 'Active' });
  const [tried, setTried] = useState(false);
  const [fileErr, setFileErr] = useState(null);
  const fileRef = useRef(null);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const usage = attr ? attrUsage(attr.attribute_id) : { now: 0, ever: 0 };
  const name = (f.name || '').trim();
  const dup = name && agencyAttrs().some(a => a.attribute_id !== f.attribute_id && a.name.trim().toLowerCase() === name.toLowerCase());
  const err = {
    name: !name ? 'Give the attribute a name.' : dup ? 'Your agency already has an attribute called “' + name + '”.' : null,
    category: !f.category ? 'Choose a category.' : null,
    mark: !f.icon && !f.image ? 'Choose an icon or upload an image.' : null,
  };
  const goingInactive = attr && attr.status === 'Active' && f.status === 'Inactive';

  const onFile = e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ext = ((file.name || '').match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (ATTR_UPLOAD.types.indexOf(file.type) === -1 || ATTR_UPLOAD.exts.indexOf(ext) === -1)
      return setFileErr('“' + file.name + '” isn’t a PNG, JPG or SVG. Choose one of those.');
    if (file.size > ATTR_UPLOAD.maxKB * 1024)
      return setFileErr('That image is ' + Math.ceil(file.size / 1024) + ' KB. Choose one under ' + ATTR_UPLOAD.maxKB + ' KB.');
    const rd = new FileReader();
    rd.onload = () => { setFileErr(null); setF(x => ({ ...x, image: rd.result, icon: null })); };
    rd.readAsDataURL(file);
  };

  const save = () => {
    setTried(true);
    if (err.name || err.category || err.mark) return;
    saveAgencyAttr({ ...f, name });
    guard.setToast({ status: 'success', title: isNew ? name + ' created' : name + ' saved',
      detail: f.status === 'Inactive' ? 'Staff can’t add it to charts. Charts that have it keep it.' : 'Staff can add it to client charts.' });
    onClose();
  };

  return (
    <Overlay size="md" title={isNew ? 'New Attribute' : 'Edit Attribute'} onClose={onClose} bodyClassName="cam-edit"
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <span className="spacer" />
        <Button variant="primary" onClick={save}>{isNew ? 'Create Attribute' : 'Save Attribute'}</Button>
      </React.Fragment>}>
      <div className="ovl-grid ovl-grid--2">
        <Field label="Name" required error={tried ? err.name : null}>
          <TextIn value={f.name} onChange={v => set('name', v)} placeholder="e.g. Requires Wheelchair Access" invalid={tried && !!err.name} />
        </Field>
        <Field label="Category" required error={tried ? err.category : null}>
          <Dropdown value={f.category} options={attrCategories()} placeholder="Please select an option" onChange={v => set('category', v)} invalid={tried && !!err.category} />
        </Field>
      </div>

      <Field label="Icon" required error={tried ? err.mark : null}>
        <div className="cam-glyphs" role="radiogroup" aria-label="Icon">
          {attrGlyphKeys().map(k => (
            <Tooltip key={k} label={glyphLabel(k)}>
              <button type="button" role="radio" aria-checked={!f.image && f.icon === k} aria-label={glyphLabel(k)}
                className={'cam-glyph' + (!f.image && f.icon === k ? ' on' : '')} onClick={() => { setF(x => ({ ...x, icon: k, image: null })); setFileErr(null); }}>
                <Icon name={k} size={20} />
              </button>
            </Tooltip>
          ))}
          {/* The library's standard images (flags), so an admin can use one
              without uploading it. */}
          {attrStdImages().map(c => (
            <Tooltip key={c.catalog_id} label={c.name}>
              <button type="button" role="radio" aria-checked={f.image === c.image} aria-label={c.name}
                className={'cam-glyph' + (f.image === c.image ? ' on' : '')} onClick={() => { setF(x => ({ ...x, image: c.image, icon: null })); setFileErr(null); }}>
                <img className="attr-img" src={c.image} width={20} height={20} alt="" />
              </button>
            </Tooltip>
          ))}
        </div>
      </Field>
      <div className="cam-upload">
        <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true"
          accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" onChange={onFile} />
        <Button size="sm" variant="secondary" onClick={() => fileRef.current && fileRef.current.click()}>
          <Icon name="plus" size={14} /> {f.image && !isStdImage(f.image) ? 'Replace Image' : 'Upload an Image'}
        </Button>
        {f.image && !isStdImage(f.image) && <Button size="sm" variant="ghost" onClick={() => set('image', null)}>Remove Image</Button>}
        <div className="ff-hint">{ATTR_UPLOAD_HINT}</div>
        {fileErr && <div className="ff-error"><Icon name="warn" size={13} /> {fileErr}</div>}
      </div>

      <Field label="Preview">
        <AttrPreview attr={f} />
      </Field>

      <Checkbox checked={f.removal === 'end-date'} onChange={v => set('removal', v ? 'end-date' : 'remove')} label="Require End Date on Removal" />

      <div className="ovl-grid ovl-grid--2">
        <Field label="Note Topic" hint="Preselected when staff add an internal note about this attribute.">
          <Dropdown value={f.note_topic} options={NOTE_TOPICS} onChange={v => set('note_topic', v)} menuMinWidth={260} />
        </Field>
      </div>

      {suggestText(f.suggest) && (
        <Field label="Suggested From the Chart">
          <div className="cam-suggest">{suggestText(f.suggest)}</div>
        </Field>
      )}

      <Field label="Status">
        <div className="cam-status">
          <Toggle checked={f.status === 'Active'} onChange={v => set('status', v ? 'Active' : 'Inactive')} />
          <span>{f.status === 'Active' ? 'Active: staff can add it to a client’s chart' : 'Inactive: staff can’t add it to a chart'}</span>
        </div>
      </Field>
      {goingInactive && (
        <div className="ovl-alert ovl-alert--warn" role="note">
          <Icon name="alertWarning" size={20} className="ovl-alert-ico" />
          <div><b>Staff will no longer be able to select {name || 'this attribute'}.</b> No historical data is removed.
            {usage.now > 0
              ? ' It stays on the ' + usage.now + (usage.now === 1 ? ' chart that has' : ' charts that have') + ' it until staff remove it or it ends.'
              : usage.ever > 0 ? ' Past entries stay in each chart’s history.' : ''}</div>
        </div>
      )}
    </Overlay>
  );
}

/* ---- Add from the standard library -------------------------------- */
function AttributeLibraryOverlay({ onClose }) {
  const guard = useGuard();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const inList = _ix(agencyAttrs().filter(a => a.catalog_id), 'catalog_id');
  const ql = q.trim().toLowerCase();
  const items = ATTR_CATALOG.filter(c => !ql || c.name.toLowerCase().indexOf(ql) !== -1 || c.category.toLowerCase().indexOf(ql) !== -1);
  const cats = [];
  items.forEach(c => { let g = cats.find(x => x.name === c.category); if (!g) cats.push(g = { name: c.category, items: [] }); g.items.push(c); });
  cats.sort((a, b) => a.name.localeCompare(b.name));
  const toggle = id => setSel(s => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
  const add = () => {
    addFromCatalog(ATTR_CATALOG.filter(c => sel.has(c.catalog_id)));
    guard.setToast({ status: 'success', title: sel.size + (sel.size === 1 ? ' attribute added' : ' attributes added'), detail: 'Staff can now add them to client charts.' });
    onClose();
  };
  return (
    <Overlay size="lg" title="Add From Library" onClose={onClose} bodyClassName="cam-lib"
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <span className="spacer" />
        <Button variant="primary" onClick={add} disabled={!sel.size}>{sel.size ? 'Add ' + sel.size + (sel.size === 1 ? ' Attribute' : ' Attributes') : 'Add Attributes'}</Button>
      </React.Fragment>}>
      <MiniSearch value={q} onChange={setQ} placeholder="Search the library by name or category" />
      <div className="cam-lib-groups">
        {cats.map(g => (
          <div key={g.name} className="cam-lib-group">
            <div className="attrm-sub">{g.name}</div>
            <div className="cam-lib-grid">
              {g.items.map(c => {
                const have = inList[c.catalog_id];
                const checked = !!have || sel.has(c.catalog_id);
                const act = () => { if (!have) toggle(c.catalog_id); };
                return (
                  /* Same row pattern as Manage Attributes: the row owns the click. */
                  <div key={c.catalog_id} className={'attrmodal-opt' + (have ? ' is-on-chart' : '')} role="checkbox" aria-checked={checked}
                    aria-disabled={!!have} tabIndex={have ? -1 : 0} onClick={act}
                    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(); } }}>
                    <Checkbox checked={checked} disabled={!!have} onChange={() => {}} ariaLabel={c.name} />
                    <span className="attrm-glyph"><AttrGlyph attr={c} /></span>
                    <span className="attrmodal-opt-text">
                      <span className="attrmodal-opt-name">{c.name}</span>
                      {have && <span className="attrmodal-opt-why">{have.status === 'Inactive' ? 'In your list, inactive' : 'In your list'}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!cats.length && <div className="attrm-empty">Nothing in the library matches “{q.trim()}”. Create your own attribute instead.</div>}
      </div>
    </Overlay>
  );
}

/* ---- The page ------------------------------------------------------ */
const ATTR_STATUS_FILTERS = ['Active', 'Inactive', 'All'];

function ClientAttributesPage() {
  useRecordsVersion();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Active');
  const [editing, setEditing] = useState(null);      // an attribute, or 'new'
  const [adding, setAdding] = useState(false);
  const all = agencyAttrs();
  const count = s => (s === 'All' ? all.length : all.filter(a => a.status === s).length);
  const ql = q.trim().toLowerCase();
  const rows = all.filter(a => status === 'All' || a.status === status)
    .filter(a => !ql || a.name.toLowerCase().indexOf(ql) !== -1 || (a.category || '').toLowerCase().indexOf(ql) !== -1)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page cam">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'User Interface Options', to: '/user-interface-options' },
        { label: 'Client Attributes' },
      ]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Client Attributes</h1>
          <div className="page-sub">
            The attributes your staff can add to a client’s chart. Each shows as an icon in the client header,
            a reminder of what to consider when making clinical and administrative decisions.
          </div>
        </div>
        <span className="spacer" />
        <div className="cam-head-actions">
          <Button variant="secondary" onClick={() => setAdding(true)}>Add From Library</Button>
          <Button variant="primary" onClick={() => setEditing('new')}><Icon name="plus" size={15} /> New Attribute</Button>
        </div>
      </div>

      <Panel title={'Agency Attributes (' + all.length + ')'}>
        <div className="cam-filters">
          <MiniSearch value={q} onChange={setQ} placeholder="Search by name or category" />
          <div className="cam-pills" role="group" aria-label="Status">
            {ATTR_STATUS_FILTERS.map(s => (
              <button key={s} type="button" className={'pill-btn' + (status === s ? ' active' : '')} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s} ({count(s)})
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table cam-table">
            <thead>
              <tr><th>Attribute</th><th>Category</th><th className="cam-c">Custom</th><th className="cam-c">End Date on Removal</th><th className="cam-c">On Charts</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.attribute_id}>
                  <td className="wrap">
                    <span className="cam-name"><span className="attrm-glyph"><AttrGlyph attr={a} /></span>
                      <button className="lnk" onClick={() => setEditing(a)}>{a.name}</button></span>
                  </td>
                  <td className="wrap">{a.category}</td>
                  <td className="cam-c">{a.source === 'custom' && <CamCheck label="Custom to your agency" />}</td>
                  <td className="cam-c">{a.removal === 'end-date' && <CamCheck label="End date required on removal" />}</td>
                  <td className="cam-c">{attrUsage(a.attribute_id).now}</td>
                  <td><span className={'badge ' + (a.status === 'Inactive' ? 'status-neutral' : 'status-active')}>{a.status}</span></td>
                  <td><Button size="sm" variant="secondary" onClick={() => setEditing(a)}>Edit</Button></td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="cam-empty">
                  {ql ? 'No attributes match “' + q.trim() + '”.' : status === 'Inactive' ? 'No inactive attributes.' : 'No attributes yet. Add some from the library.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {editing && <AttributeEditOverlay attr={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {adding && <AttributeLibraryOverlay onClose={() => setAdding(false)} />}
    </div>
  );
}
