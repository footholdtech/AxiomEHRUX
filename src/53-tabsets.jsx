/* ===== Tab sets ===================================================
   Three pieces, one model (see TAB_PAGES and SEED_TAB_SETS in 15-uiconfig.jsx):

     IN THE CHART  ChartTabBar — the DS "tabs set" component (RDS 4666:71569):
                   contained tabs, then More, Edit and Tabs Set at the right.
     STAFF         Preferences picks a set (30-chrome.jsx), and the Tabs Set
                   menu here switches sets or makes a personal one.
     ADMIN         TabSetListPage / TabSetEditPage, the same shape as the
                   client-header pages, but simpler: a name, roles, and an
                   ordered list of pages.

   WHAT CHANGED FROM THE PREVIOUS STRIP, AND WHY
   - It scrolls instead of reshuffling. The old strip promoted whatever you
     picked from More to the front, so the order you had learned kept changing
     under you. The set's order is now fixed; the track scrolls (buttons,
     wheel, trackpad, arrow keys) and the active tab is always brought into
     view. The DS overflow guidance names scrolling first.
   - More reaches every client page, not just the overflow. It lists the set
     (so a long set is one search away) and every other client page. A page
     outside the set opens as a temporary tab after a divider, with a close
     button, so you can move between it and the set without editing anything.
   - Only client pages. A tab never takes you out of the chart.
   ================================================================ */

const tabSetSummary = set => set.tabs.length + ' tab' + (set.tabs.length === 1 ? '' : 's') + ': ' + set.tabs.join(', ');
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* ---- In-chart tab bar --------------------------------------------- */
function ChartTabBar({ tabs, extras = [], active, onSelect, onCloseExtra, preview, className }) {
  const trackRef = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const [editor, setEditor] = useState(null);
  const extra = extras.filter(e => tabs.indexOf(e) === -1);
  const all = tabs.concat(extra);
  const sig = all.join('|');

  const sync = useCallback(() => {
    const el = trackRef.current; if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge(e => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    /* A mouse wheel only scrolls vertically. Over an overflowing strip it
       moves the strip instead, as browser tab bars do; a trackpad's sideways
       swipe already works natively. Non-passive so the page doesn't move too. */
    const wheel = e => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(sync); ro.observe(el); }
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync); el.removeEventListener('wheel', wheel);
      if (ro) ro.disconnect(); window.removeEventListener('resize', sync);
    };
  }, [sync]);
  useEffect(sync, [sig]);

  /* The tab you're on is always in view: a deep link, a pick from More, or
     arrowing past the edge. Computed rather than scrollIntoView, which can
     also scroll the page vertically. */
  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    const t = Array.prototype.find.call(el.children, c => c.getAttribute('data-tab') === active);
    if (!t) return;
    const pad = 40, l = t.offsetLeft, r = l + t.offsetWidth;
    let to = null;
    if (l < el.scrollLeft + pad) to = Math.max(0, l - pad);
    else if (r > el.scrollLeft + el.clientWidth - pad) to = r - el.clientWidth + pad;
    if (to != null) el.scrollTo({ left: to, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [active, sig]);

  const page = dir => {
    const el = trackRef.current; if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.75), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  /* ARIA tabs, manual activation: arrows move focus, Enter or Space opens.
     Opening a tab can raise the unsaved-work intercept, so it should never
     happen just because focus passed over it. */
  const onKeyDown = e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
    const list = Array.prototype.slice.call(trackRef.current.querySelectorAll('[role="tab"]'));
    const i = list.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    list[n].focus();
    const host = list[n].parentNode, el = trackRef.current;
    if (host.offsetLeft < el.scrollLeft) el.scrollLeft = host.offsetLeft - 40;
    else if (host.offsetLeft + host.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = host.offsetLeft + host.offsetWidth - el.clientWidth + 40;
  };

  return (
    <div className={'tset' + (preview ? ' tset--preview' : '') + (className ? ' ' + className : '')}>
      <div className={'tset-trackwrap' + (edge.left ? ' fade-l' : '') + (edge.right ? ' fade-r' : '')}>
        {edge.left && (
          <button type="button" className="icon-btn tset-scroll tset-scroll--l" aria-label="Scroll tabs left" tabIndex={-1} onClick={() => page(-1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
        )}
        <div className="tabs-default tset-track" role="tablist" aria-label="Chart pages" ref={trackRef} onKeyDown={onKeyDown}>
          {all.map((t, i) => {
            const isExtra = i >= tabs.length;
            const on = t === active;
            return (
              <React.Fragment key={t}>
                {isExtra && i === tabs.length && <span className="tset-sep" role="presentation" />}
                <div data-tab={t} role="presentation"
                  className={'tab-default tset-tab' + (on ? ' active' : '') + (isExtra ? ' tset-tab--extra' : '')}>
                  <button type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className="tset-tab-btn"
                    title={isExtra ? t + ' — not in this tab set' : t} onClick={() => !on && onSelect(t)}>{t}</button>
                  {isExtra && onCloseExtra && (
                    <button type="button" className="tset-tab-close" aria-label={'Close ' + t} onClick={() => onCloseExtra(t)}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {edge.right && (
          <button type="button" className="icon-btn tset-scroll tset-scroll--r" aria-label="Scroll tabs right" tabIndex={-1} onClick={() => page(1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>

      <div className="tset-tools">
        <TabMoreMenu tabs={tabs} active={active} onSelect={onSelect} preview={preview} />
        {!preview && (
          <React.Fragment>
            <TabSetEditButton onEdit={setEditor} />
            <TabSetMenu onNew={() => setEditor({ mode: 'new' })} />
          </React.Fragment>
        )}
      </div>
      {editor && <TabSetEditorOverlay {...editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

/* A search box inside a menu: the DS search field, sized for a menu. */
function MenuSearch({ value, onChange, placeholder, inputRef }) {
  return (
    <div className="msd-search tset-search">
      <Icon name="search" size={14} />
      <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => onChange('')}><Icon name="close" size={13} /></button>}
    </div>
  );
}

/* Focus the search once FloatMenu has measured and shown the menu. */
function useMenuFocus(open, ref) {
  useEffect(() => {
    if (!open) return;
    const f = requestAnimationFrame(() => ref.current && ref.current.focus());
    return () => cancelAnimationFrame(f);
  }, [open]);
}

/* ---- More --------------------------------------------------------
   Every client page, one search away: this set first, in its order, then
   everything else alphabetically. */
function TabMoreMenu({ tabs, active, onSelect, preview }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null), menuRef = useRef(null), searchRef = useRef(null);
  const close = () => { setOpen(false); setQ(''); };
  useOutside([ref, menuRef], close);
  useMenuFocus(open, searchRef);

  const s = q.trim().toLowerCase();
  const hit = t => !s || t.toLowerCase().indexOf(s) !== -1;
  const inSet = tabs.filter(hit);
  const others = preview ? [] : TAB_PAGES.filter(t => tabs.indexOf(t) === -1 && hit(t));
  const pick = t => { close(); if (t !== active) onSelect(t); };
  const Item = ({ t, outside }) => (
    <button type="button" role="menuitem" className={'tset-mi' + (t === active ? ' is-current' : '')} onClick={() => pick(t)}>
      <span className="tset-mi-label">{t}</span>
      {t === active ? <Icon name="check" size={14} /> : outside ? <span className="tset-mi-meta">Opens as a temporary tab</span> : null}
    </button>
  );

  return (
    <div className="tset-anchor" ref={ref}>
      <Button variant="secondary" className={'tset-btn' + (open ? ' is-open' : '')} onClick={() => (open ? close() : setOpen(true))}>
        <span>More</span><Icon name="chevronDown" size={16} />
      </Button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="tset-menu" role="menu" minWidth={300} maxHeight={420} align="right" onClose={close}>
          <MenuSearch value={q} onChange={setQ} placeholder="Search pages" inputRef={searchRef} />
          <div className="tset-menu-list">
            {!!inSet.length && <div className="tset-mh">In this tab set</div>}
            {inSet.map(t => <Item key={t} t={t} />)}
            {!!others.length && <div className="tset-mh">Other client pages</div>}
            {others.map(t => <Item key={t} t={t} outside />)}
            {!inSet.length && !others.length && <div className="msd-empty">No results found</div>}
          </div>
        </FloatMenu>
      )}
    </div>
  );
}

/* ---- Edit (pencil) -----------------------------------------------
   My own set: edit it. An agency set: copy it into one of my own, because
   staff can't change what their agency assigned. The tooltip says which. */
function TabSetEditButton({ onEdit }) {
  const ui = useUIConfig();
  const set = ui.tabSet;
  const label = set.mine ? 'Edit ' + set.name : 'Customize ' + set.name;
  return (
    <Tooltip label={label}>
      <button type="button" className="btn btn-secondary tset-icon" aria-label={label}
        onClick={() => onEdit(set.mine ? { mode: 'edit', set } : { mode: 'copy', set })}>
        <Icon name="edit" size={16} />
      </button>
    </Tooltip>
  );
}

/* ---- Tabs Set (switcher) ------------------------------------------ */
function TabSetMenu({ onNew }) {
  const ui = useUIConfig();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null), menuRef = useRef(null), searchRef = useRef(null);
  const close = () => { setOpen(false); setQ(''); };
  useOutside([ref, menuRef], close);
  useMenuFocus(open, searchRef);

  const s = q.trim().toLowerCase();
  const hit = set => !s || set.name.toLowerCase().indexOf(s) !== -1 || set.tabs.some(t => t.toLowerCase().indexOf(s) !== -1);
  const agency = ui.agencyTabSets.filter(hit);
  const mine = ui.myTabSets.filter(hit);
  const pick = set => {
    close();
    if (set.id === ui.tabSet.id) return;
    ui.chooseTabSet(set.id);
  };
  const Opt = ({ set }) => {
    const on = set.id === ui.tabSet.id;
    return (
      <button type="button" role="menuitemradio" aria-checked={on} className={'tset-mi tset-mi--rich' + (on ? ' is-current' : '')} onClick={() => pick(set)}>
        <span className="tset-mi-main">
          <span className="tset-mi-label">{set.name}{set.id === ui.roleTabSet.id && <span className="tset-mi-tag">Your role’s set</span>}</span>
          <span className="tset-mi-sub">{set.tabs.join(', ')}</span>
        </span>
        {on && <Icon name="check" size={14} />}
      </button>
    );
  };

  return (
    <div className="tset-anchor" ref={ref}>
      <Button variant="secondary" className={'tset-btn' + (open ? ' is-open' : '')} onClick={() => (open ? close() : setOpen(true))}>
        <span>Tabs Set</span><Icon name="chevronDown" size={16} />
      </Button>
      {open && (
        <FloatMenu anchorRef={ref} menuRef={menuRef} className="tset-menu" role="menu" minWidth={340} maxHeight={460} align="right" onClose={close}>
          <MenuSearch value={q} onChange={setQ} placeholder="Search tab sets" inputRef={searchRef} />
          <div className="tset-menu-list">
            {!!agency.length && <div className="tset-mh">Agency tab sets</div>}
            {agency.map(set => <Opt key={set.id} set={set} />)}
            {!!mine.length && <div className="tset-mh">My tab sets</div>}
            {mine.map(set => <Opt key={set.id} set={set} />)}
            {!agency.length && !mine.length && <div className="msd-empty">No results found</div>}
          </div>
          <div className="tset-menu-foot">
            <button type="button" className="tset-mi tset-mi--add" onClick={() => { close(); onNew(); }}>
              <Icon name="plus" size={16} /><span>Add New Tabs Set</span>
            </button>
          </div>
        </FloatMenu>
      )}
    </div>
  );
}

/* ---- Picker: shared by Admin and staff ------------------------------
   Left, every client page with a checkbox; right, the set in order. Checking
   a page adds it to the end. Drag the grip or use the arrows to reorder —
   the arrows are the keyboard path, not a fallback. The first page is the
   one a chart opens on, and says so. */
function TabSetPicker({ tabs, onChange, invalid }) {
  const [q, setQ] = useState('');
  const [dragIx, setDragIx] = useState(null);
  const [overIx, setOverIx] = useState(null);
  const s = q.trim().toLowerCase();
  const pages = s ? TAB_PAGES.filter(t => t.toLowerCase().indexOf(s) !== -1) : TAB_PAGES;

  const toggle = t => onChange(tabs.indexOf(t) !== -1 ? tabs.filter(x => x !== t) : tabs.concat([t]));
  const move = (from, to) => {
    if (to < 0 || to >= tabs.length || from === to) return;
    const next = tabs.slice(); next.splice(to, 0, next.splice(from, 1)[0]); onChange(next);
  };

  return (
    <div className="tsp">
      <div className="tsp-col">
        <div className="tsp-head">Client Pages <span className="tsp-count">{TAB_PAGES.length}</span></div>
        <MenuSearch value={q} onChange={setQ} placeholder="Search client pages" />
        <div className="tsp-list" role="group" aria-label="Client pages">
          {pages.map(t => {
            const on = tabs.indexOf(t) !== -1;
            return (
              <div key={t} className="msd-opt" role="checkbox" aria-checked={on} tabIndex={0}
                onClick={() => toggle(t)}
                onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(t); } }}>
                <Checkbox checked={on} onChange={() => {}} ariaLabel={t} presentational />
                <span className="msd-opt-text">{t}</span>
              </div>
            );
          })}
          {!pages.length && <div className="msd-empty">No results found</div>}
        </div>
      </div>

      <div className={'tsp-col' + (invalid ? ' is-invalid' : '')}>
        <div className="tsp-head">In This Tab Set <span className="tsp-count">{tabs.length}</span></div>
        {tabs.length ? (
          <ol className="qvlist tsp-order">
            {tabs.map((t, i) => (
              <li key={t}
                className={'qvitem' + (dragIx === i ? ' is-dragging' : '') + (overIx === i && dragIx !== i ? ' is-over' : '')}
                draggable
                onDragStart={e => { setDragIx(i); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t); } }}
                onDragOver={e => { e.preventDefault(); setOverIx(i); }}
                onDrop={e => { e.preventDefault(); if (dragIx != null) move(dragIx, i); setDragIx(null); setOverIx(null); }}
                onDragEnd={() => { setDragIx(null); setOverIx(null); }}>
                <div className="qvitem-row">
                  <span className="qvitem-grip" aria-hidden="true" title="Drag to reorder"><Icon name="grip" size={16} /></span>
                  <span className="qvitem-ord">{i + 1}</span>
                  <span className="qvitem-text">
                    <span className="qvitem-name">{t}</span>
                    {i === 0 && <span className="qvitem-sub">Charts open on this tab</span>}
                  </span>
                  <span className="qvitem-acts">
                    <button type="button" className="icon-btn" aria-label={'Move ' + t + ' up'} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="chevronUp" size={16} /></button>
                    <button type="button" className="icon-btn" aria-label={'Move ' + t + ' down'} disabled={i === tabs.length - 1} onClick={() => move(i, i + 1)}><Icon name="chevronDown" size={16} /></button>
                    <button type="button" className="icon-btn" aria-label={'Remove ' + t} onClick={() => toggle(t)}><Icon name="close" size={16} /></button>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="tsp-empty">Choose at least one page from Client Pages. The first one is where charts open.</div>
        )}
      </div>
    </div>
  );
}

/* ---- Staff: make or edit my own set ---------------------------------
   mode 'new'  — from Add New Tabs Set; starts with Client Summary.
   mode 'copy' — from the pencil on an agency set; starts as a copy of it.
   mode 'edit' — from the pencil on a set of my own. */
function TabSetEditorOverlay({ mode, set, onClose }) {
  const ui = useUIConfig();
  const guard = useGuard();
  const [draft, setDraft] = useState(() => (
    mode === 'edit' ? { ...set, tabs: set.tabs.slice() }
      : mode === 'copy' ? { id: 'my-' + Date.now().toString(36), name: 'My ' + set.name, tabs: set.tabs.slice() }
      : { id: 'my-' + Date.now().toString(36), name: '', tabs: [CHART_HOME_TAB] }));
  const [tried, setTried] = useState(false);
  const nameMissing = !draft.name.trim();
  const tabsMissing = !draft.tabs.length;

  const save = () => {
    setTried(true);
    if (nameMissing || tabsMissing) return;
    ui.saveMyTabSet({ ...draft, name: draft.name.trim() });
    ui.chooseTabSet(draft.id);
    guard.setToast({ status: 'success', title: mode === 'edit' ? 'Tab set saved' : 'Tab set created',
      detail: draft.name.trim() + ' · ' + draft.tabs.length + ' tab' + (draft.tabs.length === 1 ? '' : 's') + ' · only you can see it' });
    onClose();
  };
  const remove = () => {
    ui.deleteMyTabSet(set.id);
    guard.setToast({ status: 'success', title: set.name + ' deleted', detail: 'You’re back on ' + ui.roleTabSet.name + ', your role’s tab set.' });
    onClose();
  };

  const title = mode === 'edit' ? 'Edit Tab Set' : mode === 'copy' ? 'Customize Tab Set' : 'Add New Tabs Set';
  return (
    <Overlay title={title} size="lg" onClose={onClose} bodyClassName="tse-body"
      footer={<React.Fragment>
        {mode === 'edit' && <Button variant="ghost" onClick={remove}>Delete Tab Set</Button>}
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save</Button>
      </React.Fragment>}>
      {mode === 'copy' && (
        <div className="info-banner" role="note">
          <Icon name="info" size={20} />
          <div><b>{set.name}</b> is set by your agency. Your changes are saved as a tab set of your own. The agency’s stays as it is, and you can switch back to it from Tabs Set.</div>
        </div>
      )}
      <label className="form-field tse-name">
        <span>Tab set name <span className="ff-req"> *</span></span>
        <div className={'form-input' + (tried && nameMissing ? ' invalid' : '')}><input value={draft.name} placeholder="Enter a name" onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></div>
        {tried && nameMissing && <span className="ff-error"><Icon name="warn" size={13} /> Give the tab set a name.</span>}
      </label>
      <div className="chc-note">Only client pages can be tabs, so a tab never takes you out of the chart. Only you can see the tab sets you make.</div>
      <TabSetPicker tabs={draft.tabs} onChange={tabs => setDraft(d => ({ ...d, tabs }))} invalid={tried && tabsMissing} />
      {tried && tabsMissing && <div className="ff-error"><Icon name="warn" size={13} /> Add at least one page.</div>}
    </Overlay>
  );
}

/* ---- Admin: list -------------------------------------------------- */
const TS_BASE = '/user-interface-options/tab-sets';

function TabSetListPage() {
  const guard = useGuard();
  const { config } = useUIConfig();
  const sets = config.tabSets;
  const unassigned = STAFF_ROLE_NAMES.filter(r => !sets.some(s => s.roles.indexOf(r) !== -1));
  const def = sets.find(s => s.id === config.defaultTabSetId) || sets[0];

  return (
    <div className="page chc">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'User Interface Options', to: '/user-interface-options' },
        { label: 'Tab Sets' },
      ]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Tab Sets</h1>
          <div className="page-sub">
            The tabs a chart shows, in order, and the one it opens on. Assign each set to the roles
            that should get it. Staff can pick a different set, or make their own, for themselves.
          </div>
        </div>
        <span className="spacer" />
        <Button variant="primary" onClick={() => guard.go(TS_BASE + '/new')}><Icon name="plus" size={15} /> New Tab Set</Button>
      </div>

      {!!unassigned.length && (
        <div className="info-banner" role="note">
          <Icon name="info" size={20} />
          <div>
            {unassigned.length} role{unassigned.length === 1 ? '' : 's'} {unassigned.length === 1 ? 'is' : 'are'} not
            assigned to a tab set and will use <b>{def.name}</b>: {unassigned.join(', ')}.
          </div>
        </div>
      )}

      <Panel title={'Saved Tab Sets (' + sets.length + ')'}>
        <div className="table-wrap">
          <table className="data-table chc-list-table">
            <thead><tr><th>Tab Set</th><th>Tabs</th><th>Roles</th><th>Status</th><th>Users, last 30 days</th><th /></tr></thead>
            <tbody>
              {sets.map(s => {
                const shown = s.roles.slice(0, 3), more = s.roles.length - shown.length;
                return (
                  <tr key={s.id}>
                    <td className="wrap">
                      <button className="lnk chc-list-name" onClick={() => guard.go(TS_BASE + '/' + s.id)}>{s.name}</button>
                      {s.id === config.defaultTabSetId && <span className="badge status-info chc-list-default">Default</span>}
                      {s.description && <div className="chc-list-desc">{s.description}</div>}
                    </td>
                    <td className="wrap ts-list-tabs">
                      <span>{s.tabs.length} · </span>{s.tabs.slice(0, 4).join(', ')}{s.tabs.length > 4 ? ' +' + (s.tabs.length - 4) + ' more' : ''}
                    </td>
                    <td className="wrap">
                      {s.roles.length ? <span>{shown.join(', ')}{more > 0 ? ' +' + more + ' more' : ''}</span>
                        : <span className="chc-list-empty">No roles assigned</span>}
                    </td>
                    <td><span className={'badge ' + (s.status === 'inactive' ? 'status-neutral' : 'status-active')}>{s.status === 'inactive' ? 'Inactive' : 'Active'}</span></td>
                    <td>{usageLast30d(s)}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => guard.go(TS_BASE + '/' + s.id)}>Edit</Button></td>
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

/* ---- Admin: edit / create ------------------------------------------ */
function TabSetEditPage({ id }) {
  const guard = useGuard();
  /* Same reason as ClientHeaderEditPage: after Save or Delete there is
     nothing left to protect, so leave without the unsaved-work intercept. */
  const rawNavigate = useRawNavigate();
  const { config, setConfig } = useUIConfig();
  const isNew = id === 'new';
  const original = isNew ? null : config.tabSets.find(s => s.id === id);
  const blank = () => ({ id: 'ts-' + Date.now().toString(36), name: 'New Tab Set', description: '', status: 'active', roles: [], tabs: [CHART_HOME_TAB] });
  const [draft, setDraft] = useState(() => (isNew || !original ? blank() : clone(original)));
  /* Same instance across `:id` changes — resync, as the header editor does. */
  useEffect(() => {
    const found = isNew ? null : config.tabSets.find(s => s.id === id);
    setDraft(isNew || !found ? blank() : clone(found));
  }, [id]);
  const [previewTab, setPreviewTab] = useState(null);
  const [tried, setTried] = useState(false);
  const dirty = isNew || (original ? JSON.stringify(draft) !== JSON.stringify(original) : false);
  useEffect(() => { if (dirty) guard.markDirty('Tab Set Configuration'); else guard.clearDirty(); }, [dirty]);
  useEffect(() => () => guard.clearDirty(), []);

  if (!isNew && !original) {
    return (
      <div className="page">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'User Interface Options', to: '/user-interface-options' },
          { label: 'Tab Sets', to: TS_BASE }, { label: 'Not found' }]} />
        <h1 className="page-title">Tab set not found</h1>
        <p className="page-sub">No saved tab set matches <code>{id}</code>. It may already have been deleted.</p>
        <Button variant="secondary" onClick={() => guard.go(TS_BASE)}>Back to Tab Sets</Button>
      </div>
    );
  }

  const patch = obj => setDraft(d => ({ ...d, ...obj }));
  const isDefault = !isNew && draft.id === config.defaultTabSetId;
  const ownerOf = role => config.tabSets.find(s => s.id !== draft.id && s.roles.indexOf(role) !== -1);
  const toggleRole = role => patch({ roles: draft.roles.indexOf(role) !== -1 ? draft.roles.filter(r => r !== role) : draft.roles.concat([role]) });
  const leave = () => { guard.clearDirty(); rawNavigate(TS_BASE); };
  const nameMissing = !draft.name.trim();

  const save = () => {
    setTried(true);
    if (nameMissing || !draft.tabs.length) return;
    const clean = { ...draft, name: draft.name.trim() };
    setConfig(c => {
      const stripped = c.tabSets.map(s => (s.id === clean.id ? s : { ...s, roles: s.roles.filter(r => clean.roles.indexOf(r) === -1) }));
      const exists = stripped.some(s => s.id === clean.id);
      return { ...c, tabSets: exists ? stripped.map(s => (s.id === clean.id ? clean : s)) : stripped.concat([clean]) };
    });
    guard.setToast({ status: 'success', title: isNew ? 'Tab set created' : 'Tab set saved',
      detail: clean.name + ' · ' + clean.tabs.length + ' tabs · ' + clean.roles.length + ' role' + (clean.roles.length === 1 ? '' : 's')
        + ' · ' + (clean.status === 'inactive' ? 'inactive — staff won’t see it yet' : 'active') });
    leave();
  };
  const discard = () => { if (isNew) leave(); else { setDraft(clone(original)); setTried(false); } };
  const setDefault = () => {
    setConfig(c => ({ ...c, defaultTabSetId: draft.id }));
    guard.setToast({ status: 'success', title: draft.name + ' set as the default tab set', detail: 'Any role not assigned elsewhere now falls back to this one.' });
  };
  const remove = () => {
    if (config.tabSets.length < 2 || isDefault) return;
    setConfig(c => ({ ...c, tabSets: c.tabSets.filter(s => s.id !== draft.id) }));
    guard.setToast({ status: 'success', title: draft.name + ' deleted', detail: 'Its roles fall back to the default tab set. Staff who had picked it are moved back to their role’s set.' });
    leave();
  };

  const roleOptions = STAFF_ROLE_NAMES.map(r => { const o = ownerOf(r); return { value: r, label: r, meta: o ? o.name : null }; });
  const pv = draft.tabs.indexOf(previewTab) !== -1 ? previewTab : draft.tabs[0];

  return (
    <div className="page chc">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'User Interface Options', to: '/user-interface-options' },
        { label: 'Tab Sets', to: TS_BASE },
        { label: isNew ? 'New Tab Set' : draft.name || 'Untitled Tab Set' },
      ]} />
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{isNew ? 'New Tab Set' : draft.name || 'Untitled Tab Set'}</h1>
          <div className="page-sub">
            {isNew ? 'Name it, assign it to the roles that should get it, and choose its tabs.'
              : 'Assigned to the staff roles below. Staff can pick a different set, or make their own, for themselves.'}
          </div>
        </div>
        <span className="spacer" />
        {dirty && !isNew && <span className="badge status-amber"><Icon name="edit" size={12} /> Unsaved changes</span>}
        <Button variant="ghost" onClick={discard} disabled={!isNew && !dirty}>{isNew ? 'Cancel' : 'Discard'}</Button>
        <Button variant="primary" onClick={save} disabled={!dirty}>{isNew ? 'Create Tab Set' : 'Save Changes'}</Button>
      </div>

      <section className="panel chc-config">
        <div className="chc-sec">
          <h2 className="chc-sectitle">Name and Assignment</h2>
          <label className="form-field">
            <span>Tab set name <span className="ff-req"> *</span></span>
            <div className={'form-input' + (tried && nameMissing ? ' invalid' : '')}><input value={draft.name} onChange={e => patch({ name: e.target.value })} /></div>
            {tried && nameMissing && <span className="ff-error"><Icon name="warn" size={13} /> Give the tab set a name.</span>}
          </label>
          <label className="form-field"><span>What it is for</span>
            <div className="form-input"><input value={draft.description} placeholder="e.g. Detox unit — withdrawal scales and med pass first"
              onChange={e => patch({ description: e.target.value })} /></div>
          </label>

          <div className="chc-switch">
            <Toggle checked={draft.status !== 'inactive'} disabled={isDefault} onChange={v => patch({ status: v ? 'active' : 'inactive' })} />
            <div className="chc-switch-text">
              <div className="chc-switch-name">Active</div>
              <div className="chc-switch-help">
                {isDefault
                  ? 'This is the agency’s default tab set, so it stays active. Set a different one as default first if you need to turn this off.'
                  : 'Off means staff assigned to this set fall back to the default, and nobody can pick it in Preferences. Use this to build a set before it reaches anyone.'}
              </div>
            </div>
          </div>

          <div className="pref-label">Applies to roles</div>
          <div className="chc-note">A role belongs to one tab set. Picking a role here takes it off whichever set holds it now.</div>
          <MultiSelectDropdown id="ts-roles-select" searchable placeholder="Select roles…" selected={draft.roles} onToggle={toggleRole} options={roleOptions} />

          {!isNew && (
            <div className="chc-presetfoot">
              <Button size="sm" variant="secondary" disabled={isDefault} onClick={setDefault}>Set as Default</Button>
              <span className="spacer" />
              <Button size="sm" variant="ghost" disabled={config.tabSets.length < 2 || isDefault} onClick={remove}>Delete Tab Set</Button>
            </div>
          )}
        </div>

        <div className="chc-sec">
          <h2 className="chc-sectitle">Tabs ({draft.tabs.length})</h2>
          <div className="chc-note">
            Only client pages can be tabs. Agency pages such as Revenue Cycle Management, the CRM, dashboards and
            Admin aren’t listed: a tab changes the view inside a chart, and those would take staff out of it. They
            stay in the left navigation and search. Client Summary starts first; it can be moved or removed.
          </div>
          <div className="ts-preview">
            <div className="ts-preview-label">How it looks in a chart</div>
            <ChartTabBar preview tabs={draft.tabs} active={pv} onSelect={setPreviewTab} />
          </div>
          <TabSetPicker tabs={draft.tabs} onChange={tabs => patch({ tabs })} invalid={tried && !draft.tabs.length} />
          {tried && !draft.tabs.length && <div className="ff-error"><Icon name="warn" size={13} /> Add at least one page.</div>}
        </div>
      </section>
    </div>
  );
}
