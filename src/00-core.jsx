const { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext } = React;

/* ===== Theme registry — 10 modes from the Radicle Design System ===== */
const THEMES = [
  { slug: 'default',      name: 'Green',          swatch: '#509B7A' },
  { slug: 'purple',       name: 'Royal Purple',   swatch: '#82549A' },
  { slug: 'magenta',      name: 'Magenta',        swatch: '#E6A3BF' },
  { slug: 'dark-magenta', name: 'Dark Magenta',   swatch: '#4B0025' },
  { slug: 'yellow',       name: 'Clarity Yellow', swatch: '#EDB616' },
  { slug: 'orange',       name: 'Orange',         swatch: '#FA803A' },
  { slug: 'gold',         name: 'Paper Grain',    swatch: '#ADA076' },
  { slug: 'awards',       name: 'Printroom Mint', swatch: '#527B6E' },
  { slug: 'cyan',         name: 'Cyan',           swatch: '#26D2DC' },
  { slug: 'dark-blue',    name: 'Dark Blue',      swatch: '#1B1F3B' },
];
const ThemeContext = createContext(null);
const THEME_KEY = 'axiom-discharge-theme';
const readThemePref = () => { try { const r = localStorage.getItem(THEME_KEY); if (r) return JSON.parse(r); } catch (e) {} return { theme: 'purple', mode: 'light' }; };
function ThemeProvider({ children }) {
  const init = readThemePref();
  const [theme, setTheme] = useState(init.theme);
  const [mode, setMode] = useState(init.mode);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    try { localStorage.setItem(THEME_KEY, JSON.stringify({ theme, mode })); } catch (e) {}
  }, [theme, mode]);
  return <ThemeContext.Provider value={{ theme, mode, setTheme, setMode, themes: THEMES }}>{children}</ThemeContext.Provider>;
}
const useTheme = () => useContext(ThemeContext);

/* ===== Hash router (file:// friendly) =====
   navigate() here is the LOW-LEVEL move. Screens must not call it directly —
   they go through useGuard().go(), which runs the client-context intercepts
   first. See 20-context.jsx. */
const RouterCtx = createContext({ path: '/', navigate: () => {} });
function Router({ children }) {
  const get = () => window.location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(get());
  useEffect(() => { const h = () => setPath(get()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return <RouterCtx.Provider value={{ path, navigate: (to) => { if (get() === to) setPath(to); else window.location.hash = to; } }}>{children}</RouterCtx.Provider>;
}
const useRawNavigate = () => useContext(RouterCtx).navigate;
const usePath = () => useContext(RouterCtx).path;
function match(pattern, path) {
  if (pattern === '/') return path === '/' ? {} : null;
  const pp = pattern.split('/').filter(Boolean), ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i][0] === ':') params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

/* ===== Icons — Microsoft Fluent System Icons (window.FLUENT), with a small
   stroke-path fallback for glyphs the bundled set doesn't carry. ===== */
const ICONS = {
  menu: 'M3 12h18M3 6h18M3 18h18', home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  clients: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  documents: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  reports: 'M3 3v18h18M8 17V9m5 8V5m5 12v-6',
  billing: 'M2 7h20v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 7l2-3h16l2 3M2 11h20',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.5H9.2l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4L2.7 11a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.4 2.5h4.6l.4-2.5a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  chevronRight: 'M9 6l6 6-6 6', chevronDown: 'M6 9l6 6 6-6', chevronUp: 'M18 15l-6-6-6 6',
  close: 'M18 6 6 18M6 6l12 12', check: 'M20 6 9 17l-5-5',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  palette: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10c0 2-2 3-4 3h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22ZM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  plus: 'M12 5v14M5 12h14',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  messages: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 6 8-6',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4',
  sort: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4-.9L3 21l1.9-4.5A8.4 8.4 0 1 1 21 11.5z',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-5M12 8h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  swap: 'M7 16H3m0 0 4-4m-4 4 4 4M17 8h4m0 0-4-4m4 4-4 4',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  pen: 'M12 19l7-7-4-4-7 7-1 5 5-1zM3 21h6',
  /* Six dots, not a pair of arrows — the standard drag-handle glyph (the same
     construction Lucide's grip-vertical uses: a zero-length segment at each
     dot, which a round line-cap draws as a filled circle). Up/down arrows
     read as "move" controls, which this app already has as separate buttons;
     a grip reads as "drag", which is the other half of the same control. */
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
};
function Icon({ name, size = 18, className, style }) {
  /* DS client-header vectors come off the Figma asset endpoint authored on a
     20x20 grid, so they need their own viewBox — rendering them at 0 0 24 24
     would leave them floating small in the corner. Checked first because these
     are the exact design assets where both registries have a name. */
  const ds = (window.DSICONS || {})[name];
  if (ds) return <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" className={className} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ds }} />;
  const inner = (window.FLUENT || {})[name];
  if (inner) return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: inner }} />;
  const d = ICONS[name];
  if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true"><path d={d} /></svg>;
}

/* ===== Avatar — Radicle DS node 1308:4204. Fixed (non-theme) accent pairs
   assigned deterministically per person. Initials-only here: a prototype that
   is about "whose chart am I in" should never show a stock face next to a
   synthetic name. ===== */
const AV_COLORS = [
  { bg: '#ffdeec', border: '#b64775' }, { bg: '#ffc4ff', border: '#82549a' },
  { bg: '#ffedda', border: '#fa803a' }, { bg: '#f0fcf6', border: '#509b7a' },
  { bg: '#d4ffff', border: '#26d2dc' }, { bg: '#ecf4ff', border: '#505676' },
  { bg: '#fffad5', border: '#edb616' }, { bg: '#ffe2e2', border: '#fb2c36' },
  { bg: '#dafff8', border: '#8db7a9' }, { bg: '#dfffe2', border: '#00c950' },
  { bg: '#ded6bf', border: '#827449' }, { bg: '#ffeeff', border: '#e79ee6' },
];
const AV_SIZE = { XS: 20, S: 24, M: 28, L: 44, XL: 64 };
const AV_FONT = { XS: 10, S: 11, M: 12, L: 16, XL: 22 };
const hashStr = (s = '') => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const inits = (n = '') => n.replace(/[,"“”]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const avatarColor = (name) => AV_COLORS[hashStr(name) % AV_COLORS.length];
function Avatar({ name = '', size = 'S', color, stroke = true, style }) {
  const S = AV_SIZE[size] || 28, F = AV_FONT[size] || 12, c = color || avatarColor(name);
  return (
    <span data-node-id="1308:4204" style={{
      width: S, height: S, borderRadius: '9999px', flex: 'none', display: 'inline-grid', placeItems: 'center',
      overflow: 'hidden', userSelect: 'none', background: c.bg, color: '#36435c',
      border: stroke ? '1px solid ' + c.border : 'none', fontFamily: 'var(--font-sans)',
      fontWeight: 600, fontSize: F, lineHeight: 1, ...style,
    }}>{inits(name)}</span>
  );
}

/* ===== Primitives ===== */
function Toggle({ checked, onChange, id }) {
  return <label className="switch"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} id={id} /><span className="track" /></label>;
}
function Checkbox({ checked, onChange, indeterminate, disabled, label, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label className={'rds-checkbox' + (disabled ? ' is-disabled' : '')} data-node-id="932:1397" aria-label={ariaLabel}>
      <input ref={ref} type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange && onChange(e.target.checked)} />
      <span className="rds-checkbox__box" aria-hidden="true"><Icon name="check" size={14} /></span>
      {label != null && label !== '' && <span className="rds-checkbox__label">{label}</span>}
    </label>
  );
}
function Radio({ checked, onChange, label, name }) {
  return (
    <label className={'rds-radio' + (checked ? ' is-checked' : '')}>
      <input type="radio" name={name} checked={!!checked} onChange={() => onChange && onChange()} />
      <span className="rds-radio__dot" aria-hidden="true" />
      <span className="rds-radio__label">{label}</span>
    </label>
  );
}
function Button({ variant = 'secondary', size, children, onClick, disabled, type = 'button', style, title }) {
  return <button type={type} title={title} disabled={disabled} onClick={onClick} style={style}
    className={'btn btn-' + variant + (size === 'sm' ? ' sm' : '')}>{children}</button>;
}
function Dropdown({ value, options, onChange, placeholder = 'Please select...', invalid, id }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const c = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  return (
    <div className="dd" ref={ref}>
      <button id={id} type="button" className={'dd-trigger' + (open ? ' open' : '') + (invalid ? ' invalid' : '')} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={value ? 'dd-value' : 'dd-placeholder'}>{value || placeholder}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="dd-menu" role="listbox">
          {options.map(o => (
            <button key={o} type="button" role="option" aria-selected={o === value} className={'dd-opt' + (o === value ? ' active' : '')}
              onClick={() => { onChange(o); setOpen(false); }}>{o}{o === value && <Icon name="check" size={14} />}</button>
          ))}
        </div>
      )}
    </div>
  );
}
/* A checkbox dropdown for picking any number of options from a list too long
   to lay out as pills or a grid — built for the admin screens that assign
   staff roles or agency-wide actions, where an agency can have a hundred-plus
   roles and a wall of toggle buttons stops being readable long before that.
   Search is optional and off by default for short lists; the trigger's own
   summary text ("4 of 15 selected") is the only feedback while closed, on
   purpose — no colour, no badges, nothing stylised. */
function MultiSelectDropdown({ id, options, selected, onToggle, placeholder = 'Select…', searchable = false, emptyText = 'No matches.' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);
  useEffect(() => {
    const c = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', c);
    return () => document.removeEventListener('mousedown', c);
  }, []);
  useEffect(() => { if (open && searchable && searchRef.current) searchRef.current.focus(); }, [open, searchable]);

  const s = q.trim().toLowerCase();
  const filtered = s ? options.filter(o => o.label.toLowerCase().indexOf(s) !== -1) : options;
  const summary = !selected.length ? placeholder
    : selected.length === options.length ? 'All ' + options.length + ' selected'
    : selected.length + ' of ' + options.length + ' selected';

  return (
    <div className="msd" ref={ref}>
      <button id={id} type="button" className={'dd-trigger' + (open ? ' open' : '')}
        onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={selected.length ? 'dd-value' : 'dd-placeholder'}>{summary}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="msd-menu">
          {searchable && (
            <div className="msd-search">
              <Icon name="search" size={14} />
              <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" aria-label="Search options" />
              {q && <button className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={13} /></button>}
            </div>
          )}
          <div className="msd-list" role="listbox" aria-multiselectable="true">
            {filtered.length ? filtered.map(o => {
              const on = selected.indexOf(o.value) !== -1;
              /* A div, not a label: `Checkbox` renders its own <label>, and
                 nesting labels is invalid HTML that double-toggles in some
                 browsers — same fix as the attribute picker. */
              return (
                <div key={o.value} className="msd-opt" role="checkbox" aria-checked={on} tabIndex={0}
                  onClick={() => onToggle(o.value)}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(o.value); } }}>
                  <Checkbox checked={on} onChange={() => {}} ariaLabel={o.label} />
                  <span className="msd-opt-text">{o.label}</span>
                  {o.meta && <span className="msd-opt-meta">{o.meta}</span>}
                </div>
              );
            }) : <div className="msd-empty">{emptyText}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
function Panel({ title, action, children, defaultOpen = true, id }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel" id={id}>
      <div className={'acc-header' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}>
        <span className="acc-title">{title}</span>
        {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
        {/* No "Expand"/"Collapse" label — that real estate is reserved for
            actual context about what a collapsed section holds, not for
            restating what the chevron already shows.
            A real <button>, not a bare glyph riding the header's onClick: the
            standard `.icon-btn` gives it hover/pressed/focus states and makes
            it the one thing in this row a keyboard user can Tab to and
            operate. Being open is not a "selected" button state — it is just
            a rotated glyph — so no colour is tied to aria-expanded. */}
        <button type="button" className="icon-btn acc-toggle" aria-expanded={open}
          aria-label={(open ? 'Collapse ' : 'Expand ') + (typeof title === 'string' ? title : 'section')}>
          <Icon name="chevronDown" size={18} className={'toggle-ico' + (open ? ' open' : '')} />
        </button>
      </div>
      {open && <div className="acc-body">{children}</div>}
    </section>
  );
}
function Toast({ toast, onClose }) {
  useEffect(() => { if (!toast) return; const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast">
        <span className="toast-ico"><Icon name={toast.icon || 'check'} size={16} /></span>
        <div>
          <div className="toast-title">{toast.title}</div>
          {toast.detail && <div className="toast-detail">{toast.detail}</div>}
        </div>
        <button className="icon-btn" aria-label="Dismiss" onClick={onClose}><Icon name="close" size={15} /></button>
      </div>
    </div>
  );
}
/* ===== TabStrip — DS `tabs group`, contained (box) type ============
   RDS ↪ Tabs page, `.contained tab` (1018:5674). The component set ships
   `# of entries` 2–14 but no overflow variant; the overflow behaviour comes
   from the component's own documentation, which is explicit about it:

     "Avoid wrapping tabs to multiple lines, as it reduces scannability"
     "If the number of tabs exceeds the container width, tabs should scroll
      horizontally … For highly dynamic tab sets, consider a dropdown 'More'
      menu for overflow items"

   So the strip never wraps. Whatever does not fit on one line moves into a
   `More` menu, and picking from that menu promotes the tab to the front of the
   order so it is both visible and active — you should not have to go back into
   the menu to find where you just went.

   Measurement runs against a hidden mirror of the full set rather than the
   live row, so nothing is ever painted mid-reflow. */
function TabStrip({ tabs, active, onSelect, className }) {
  const wrapRef = useRef(null);
  const mirrorRef = useRef(null);
  const moreRef = useRef(null);
  const [order, setOrder] = useState(tabs);
  const [visible, setVisible] = useState(tabs.length);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Keep the order in step if the tab list itself changes, preserving any
     promotion the clinician has already made. */
  useEffect(() => {
    setOrder(prev => {
      const kept = prev.filter(t => tabs.indexOf(t) !== -1);
      const added = tabs.filter(t => kept.indexOf(t) === -1);
      return kept.concat(added);
    });
  }, [tabs]);

  const GAP = 2;   /* .tabs-default gap */
  const measure = useCallback(() => {
    const wrap = wrapRef.current, mirror = mirrorRef.current;
    if (!wrap || !mirror) return;
    const avail = wrap.clientWidth;
    const widths = Array.prototype.map.call(mirror.children, c => c.offsetWidth);
    if (!widths.length) return;
    const fit = budget => {
      let total = 0, n = 0;
      for (let i = 0; i < widths.length; i++) {
        total += widths[i] + (i ? GAP : 0);
        if (total <= budget) n = i + 1; else break;
      }
      return n;
    };
    let n = fit(avail);
    if (n < widths.length) {
      /* Something will overflow, so the More button needs room of its own. */
      const moreW = (moreRef.current && moreRef.current.offsetWidth) || 92;
      n = fit(avail - moreW - GAP);
    }
    setVisible(Math.max(1, Math.min(n, widths.length)));
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure, order]);

  useEffect(() => {
    const c = e => { if (moreRef.current && !moreRef.current.parentNode.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', c);
    return () => document.removeEventListener('mousedown', c);
  }, []);

  /* An active tab that has been pushed into the overflow — a deep link to a
     module, say — is promoted so the strip always shows where you are. */
  useEffect(() => {
    if (!active) return;
    const i = order.indexOf(active);
    if (i >= visible) setOrder(o => [active].concat(o.filter(t => t !== active)));
  }, [active, order, visible]);

  const promote = t => {
    setOrder(o => [t].concat(o.filter(x => x !== t)));
    setMenuOpen(false);
    onSelect(t);
  };

  const shown = order.slice(0, visible);
  const overflow = order.slice(visible);

  return (
    <div className={'tabstrip' + (className ? ' ' + className : '')} ref={wrapRef}>
      {/* Hidden mirror of the full set — measured, never shown. */}
      <div className="tabstrip-mirror tabs-default" ref={mirrorRef} aria-hidden="true">
        {order.map(t => <span key={t} className="tab-default">{t}</span>)}
      </div>

      <div className="tabs-default tabstrip-row" role="tablist">
        {shown.map(t => (
          <button key={t} role="tab" aria-selected={t === active}
            className={'tab-default' + (t === active ? ' active' : '')}
            onClick={() => onSelect(t)}>{t}</button>
        ))}
        {overflow.length > 0 && (
          <div className="tabstrip-more-wrap">
            <button ref={moreRef} className="tab-default tabstrip-more"
              aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}>
              More ({overflow.length}) <Icon name="chevronDown" size={15} />
            </button>
            {menuOpen && (
              <div className="tabstrip-menu" role="menu">
                {overflow.map(t => (
                  <button key={t} role="menuitem" className="tabstrip-menu-item"
                    onClick={() => promote(t)}>{t}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
