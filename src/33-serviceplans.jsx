/* ===== Service Plans quick view ========================================
   The golden thread: documentation should trace back to the client's plan,
   so the active plans sit in the header, one click from any note being
   written. Every plan the agency uses shows here; where a plan template came
   from isn't something the clinician needs to see.

   Same pattern as the other clinical quick views: a summary (status, last
   edit, goal progress against the plan's own start and review dates), "View
   all" to the Service Plan module, and a dialog with the whole plan to read
   (and copy a goal from); editing happens in the module. Fields follow
   production's Service Plan form (Service Plan · Goals/Objective ·
   Agreements). Data is fictional.
   ================================================================ */

const DAY_MS = 86400000;
/* "Outpatient" → "Outpatient Service Plan"; a custom "Housing Stability Plan" stays as is. */
const planTitle = p => (/plan$/i.test(p.plan_type) ? p.plan_type : p.plan_type + ' Service Plan');
/* Where a plan stands: goal progress against how much of the plan period has
   passed. "Behind" only when goals trail the calendar by more than 10 points
   — plans aren't linear, and a hair's difference isn't news. */
function planProgress(plan) {
  const start = _parse(plan.plan_date), end = _parse(plan.review_date);
  const total = Math.max(1, Math.round((end - start) / DAY_MS));
  const day = Math.max(0, Math.min(total, Math.round((TODAY - start) / DAY_MS)));
  const timePct = Math.round((day / total) * 100);
  const goals = plan.goals || [];
  const goalPct = goals.length ? Math.round(goals.reduce((n, g) => n + (g.progress_pct || 0), 0) / goals.length) : 0;
  const verdict = plan.status === 'Completed' ? { label: 'Completed', tone: 'good' }
    : goalPct >= timePct - 10 ? { label: 'On track', tone: null } : { label: 'Behind schedule', tone: 'warn' };
  return { day, total, timePct, goalPct, verdict, met: goals.filter(g => g.status === 'Met').length, goals: goals.length };
}

/* Goal progress bar with a marker for "today" inside the plan period, so
   progress always reads against the dates the plan set for itself. On the
   card the dates live in a tooltip on the bar (hover or focus) to save room;
   the dialog shows them under it. */
function PlanProgress({ plan, large }) {
  const p = planProgress(plan);
  const done = plan.status === 'Completed';
  const when = done ? 'Plan period ended' : 'Today · day ' + p.day + ' of ' + p.total;
  const dates = 'Start ' + fmtDate(plan.plan_date) + ' · ' + when + ' · Review ' + fmtDate(plan.review_date);
  const bar = (
    <div className="sp-bar" role="img" tabIndex={large ? undefined : 0}
      aria-label={'Goal progress ' + p.goalPct + '%' + (done ? '' : ', with ' + p.timePct + '% of the plan period passed') + '. ' + dates}>
      <span className="sp-bar-fill" style={{ width: p.goalPct + '%' }} />
      {!done && <span className="sp-bar-now" style={{ left: p.timePct + '%' }} />}
    </div>
  );
  return (
    <div className={'sp-prog' + (large ? ' sp-prog--lg' : '')}>
      <div className="sp-prog-head">
        <span>Goal progress <b>{p.goalPct}%</b></span>
        <NTag tone={p.verdict.tone}>{p.verdict.label}</NTag>
      </div>
      {large ? bar : <Tooltip label={dates} placement="bottom">{bar}</Tooltip>}
      {large && (
        <div className="sp-prog-dates">
          <span>Start {fmtDate(plan.plan_date)}</span><span>{when}</span><span>Review {fmtDate(plan.review_date)}</span>
        </div>
      )}
    </div>
  );
}
/* The client header's own status badge (Active green; anything else neutral). */
const PlanStatus = ({ status }) => <span className={'cph-status cph-status--' + (status === 'Active' ? 'success' : 'inactive')}>{status}</span>;

const PLAN_FILTERS = ['Active', 'All'];
function ServicePlansQV({ view, client, preview }) {
  const go = useModuleNav(client);
  const opts = view.options || {};
  const [filter, setFilter] = useState(opts.defaultFilter || 'Active');
  const [openId, setOpenId] = useState(null);
  const all = getServicePlans(client);
  const rows = filter === 'All' ? all : all.filter(p => p.status === 'Active');
  const open = all.find(p => p.plan_id === openId);
  const activeN = all.filter(p => p.status === 'Active').length;
  return (
    <div className="cph-qvx">
      <QvBar title="Service Plans" meta={activeN + ' active'} preview={preview} onViewAll={() => go('Service Plan')} />
      <div className="qvx-filterrow">
        <div className="qvx-filters" role="tablist" aria-label="Filter service plans">
          {PLAN_FILTERS.map(f => (
            <button key={f} role="tab" aria-selected={filter === f} className={'cph-pill' + (filter === f ? ' selected' : '')}
              onClick={() => setFilter(f)}>{f} ({f === 'All' ? all.length : activeN})</button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="sp-cards">
          {rows.map(p => {
            const pr = planProgress(p);
            /* Name as plain text, not a link — View Plan opens the dialog in
               place, and a link would suggest leaving the page. When the card
               has room the button sits to the right of the summary. */
            return (
              <div key={p.plan_id} className="qvx-card sp-card">
                <div className="sp-card-main">
                  <div className="sp-card-head">
                    <span className="sp-card-title">{p.plan_type}</span>
                    <PlanStatus status={p.status} />
                  </div>
                  <div className="qvx-card-meta">Last edited {fmtDate(p.last_edited)}{p.last_edited_by ? ' by ' + sName(p.last_edited_by) : ''}
                    {' · '}{pr.goals} objective{pr.goals === 1 ? '' : 's'}, {pr.met} met</div>
                  <PlanProgress plan={p} />
                </div>
                <div className="sp-card-act"><Button size="sm" variant="secondary" onClick={() => setOpenId(p.plan_id)}>View Plan</Button></div>
              </div>
            );
          })}
        </div>
      ) : <QvxEmpty>{filter === 'Active' ? 'No active service plans.' : 'No service plans on file.'}</QvxEmpty>}
      {open && <ServicePlanOverlay plan={open} client={client} preview={preview} onClose={() => setOpenId(null)} onOpenModule={() => { setOpenId(null); go('Service Plan'); }} />}
    </div>
  );
}

/* ---- The plan, in place: real text, with a copy button per goal --------- */
const staffOrDash = id => (id ? sName(id) : '—');
function goalText(g, i) {
  return ['Goal ' + (i + 1) + ' — ' + g.domain_of_wellness,
    'Identified need: ' + g.identified_need,
    'Specific objective: ' + g.specific_objective,
    'Baseline measure: ' + g.baseline_measure,
    'Current measure: ' + g.current_measure,
    'Target measure: ' + g.target_measure,
    'Progress: ' + g.progress_pct + '% (' + g.status + ')',
    'Interventions:'].concat(g.interventions.map(v => '  - ' + v.service_category + ' (' + v.service_code + '), ' + v.frequency + ', ' + staffOrDash(v.provider_staff_id))).join('\n');
}
/* Clipboard, with the old textarea fallback for contexts that block the API. */
function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-10000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
  fallback(); return Promise.resolve();
}

function SpRow({ k, children }) {
  return <div className="sp-row"><dt>{k}</dt><dd>{children}</dd></div>;
}

function ServicePlanOverlay({ plan, client, preview, onClose, onOpenModule }) {
  const guard = useGuard();
  const copy = (text, what) => copyText(text).then(() => guard.setToast({ icon: 'check', title: what + ' copied', detail: 'Paste it into your note.' }));
  return (
    <Overlay size="lg" title={planTitle(plan)} subtitle={client.displayName} onClose={onClose}
      footer={<React.Fragment>
        <span className="spacer" />
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {/* Editing is the module's job — this leaves the page. */}
        {!preview && <Button variant="primary" onClick={onOpenModule}>Edit Service Plan <Icon name="external" size={13} /></Button>}
      </React.Fragment>}>
      <article className="sp-doc">
        <div className="ovl-facts">
          <div><span>Status</span><PlanStatus status={plan.status} /></div>
          <div><span>Objectives</span>{(plan.goals || []).length} · {(plan.goals || []).filter(g => g.status === 'Met').length} met</div>
          <div><span>Plan date → review</span>{fmtDate(plan.plan_date)} → {fmtDate(plan.review_date)}</div>
          <div><span>Last edited</span>{fmtDate(plan.last_edited)}{plan.last_edited_by ? ' · ' + sName(plan.last_edited_by) : ''}</div>
        </div>
        <PlanProgress plan={plan} large />

        <section className="sp-sec">
          <h3>Service Plan</h3>
          <dl className="sp-dl">
            <SpRow k="Individuals at service planning meeting">{plan.individuals_at_meeting}</SpRow>
            <SpRow k="Family / natural supports in planning">{plan.family_supports}</SpRow>
            <SpRow k="Recommended services">{plan.recommended_services}</SpRow>
            <SpRow k="Behavioral health transition plan">{plan.transition_plan}</SpRow>
            <SpRow k="SMI determination">{plan.smi_determination}</SpRow>
          </dl>
        </section>

        <section className="sp-sec">
          <h3>Goals and Objectives <span>{plan.goals.length}</span></h3>
          {plan.goals.map((g, i) => (
            <div key={g.goal_id} className="sp-goal">
              <div className="sp-goal-head">
                <b>Goal {i + 1} · {g.domain_of_wellness}</b>
                <NTag tone={g.status === 'Met' ? 'good' : null}>{g.status} · {g.progress_pct}%</NTag>
                <span className="spacer" />
                <Tooltip label="Copy this goal">
                  <button className="icon-btn" aria-label={'Copy goal ' + (i + 1)} onClick={() => copy(goalText(g, i), 'Goal ' + (i + 1))}><Icon name="dsDocCopy" size={18} /></button>
                </Tooltip>
              </div>
              <dl className="sp-dl">
                <SpRow k="Identified need">{g.identified_need}</SpRow>
                <SpRow k="Specific objective">{g.specific_objective}</SpRow>
                <SpRow k="Baseline measure">{g.baseline_measure}</SpRow>
                <SpRow k="Current measure">{g.current_measure}</SpRow>
                <SpRow k="Target measure">{g.target_measure}</SpRow>
              </dl>
              <table className="data-table compact sp-ints">
                <thead><tr><th>Intervention / service category</th><th>Service code</th><th>Frequency</th><th>Provider</th></tr></thead>
                <tbody>{g.interventions.map((v, j) => (
                  <tr key={j}><td>{v.service_category}</td><td>{v.service_code}</td><td>{v.frequency}</td><td>{staffOrDash(v.provider_staff_id)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </section>

        <section className="sp-sec">
          <h3>Agreements</h3>
          <dl className="sp-dl">
            <SpRow k="Agreement">{plan.agreement}</SpRow>
            <SpRow k="Copy offered in preferred language">{plan.copy_offered ? 'Yes' : 'No'}</SpRow>
          </dl>
          <table className="data-table compact sp-ints">
            <thead><tr><th>Signature</th><th>Signed by</th><th>Date</th></tr></thead>
            <tbody>{plan.signatures.map((sg, j) => (
              <tr key={j}><td>{sg.role}</td><td>{sg.staff_id ? sName(sg.staff_id) : sg.role === 'Client' ? client.name : '—'}</td><td>{sg.date ? fmtDate(sg.date) : 'Pending'}</td></tr>
            ))}</tbody>
          </table>
        </section>
      </article>
    </Overlay>
  );
}
