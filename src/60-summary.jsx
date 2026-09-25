/* ===== Discharge summary: selection intercept + PDF preview ========
   PROBLEM THIS SOLVES (issue 2). AxiomEHR today treats discharge as an event
   that resolves every diagnosis on the chart. Enrollment status and clinical
   status are different facts; one must not silently write the other. A client
   can finish a residential episode with an alcohol use disorder that is very
   much still active.

   So saving a discharge note now stops and asks one question — which of these
   belong on the printed summary — and states in the same breath that the answer
   changes the document and nothing else.
   ================================================================ */

function StatusPill({ status }) {
  return <span className={'badge ' + (STATUS_TONE[status] || 'status-neutral')}>{status}</span>;
}

function SelectTable({ caption, columns, rows, idKey, selected, onToggle, renderRow }) {
  const allOn = rows.length > 0 && rows.every(r => selected.has(r[idKey]));
  const someOn = rows.some(r => selected.has(r[idKey]));
  return (
    <div className="seltable">
      <div className="seltable-head">
        <Checkbox checked={allOn} indeterminate={!allOn && someOn} ariaLabel={'Select all ' + caption}
          onChange={v => rows.forEach(r => { if (selected.has(r[idKey]) !== v) onToggle(r[idKey]); })} />
        <span className="seltable-caption">{caption}</span>
        <span className="seltable-count">{rows.filter(r => selected.has(r[idKey])).length} of {rows.length} selected</span>
      </div>
      <div className="table-wrap">
        <table className="data-table compact select-rows">
          <thead><tr><th className="col-check" /><th>{columns[0]}</th><th>{columns[1]}</th><th>{columns[2]}</th><th>Status on chart</th></tr></thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const on = selected.has(r[idKey]);
              return (
                <tr key={r[idKey]} className={on ? 'is-selected' : ''} onClick={() => onToggle(r[idKey])}>
                  <td className="col-check" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={on} onChange={() => onToggle(r[idKey])} ariaLabel={'Include ' + (r.description || r.name)} />
                  </td>
                  {renderRow(r)}
                  <td><StatusPill status={r.status} />{r.resolved_date && <span className="cell-note"> {fmtDate(r.resolved_date)}</span>}</td>
                </tr>
              );
            }) : <tr className="empty-row"><td colSpan={5}>Nothing on the chart</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiagnosisSelectionIntercept({ client, action, initial, onCancel, onSave }) {
  const dx = client.diagnoses, probs = client.problems;
  /* Pre-selection rule: everything carrying an active status on the chart is
     checked; Resolved and Inactive are not. The clinician can override either
     way — this is a document-contents decision, not a clinical one. */
  const defaults = () => ({
    dx: new Set(dx.filter(d => isActiveStatus(d.status)).map(d => d.client_dx_id)),
    pr: new Set(probs.filter(p => isActiveStatus(p.status)).map(p => p.client_problem_id)),
  });
  const [sel, setSel] = useState(() => {
    if (!initial) return defaults();
    return { dx: new Set(initial.diagnoses.map(d => d.client_dx_id)), pr: new Set(initial.problems.map(p => p.client_problem_id)) };
  });
  const toggleDx = id => setSel(s => { const n = new Set(s.dx); n.has(id) ? n.delete(id) : n.add(id); return { ...s, dx: n }; });
  const togglePr = id => setSel(s => { const n = new Set(s.pr); n.has(id) ? n.delete(id) : n.add(id); return { ...s, pr: n }; });
  /* Both lists can run long, so they are tabbed rather than stacked. The count
     in each tab is everything listed in it, resolved items included — the tab
     is a size cue, not a clinical statement. */
  const [tab, setTab] = useState('dx');

  useEffect(() => { const k = e => { if (e.key === 'Escape') onCancel(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onCancel]);

  const total = sel.dx.size + sel.pr.size;
  const primary = dx.find(d => d.precedence === 'Primary');
  const primaryDropped = primary && !sel.dx.has(primary.client_dx_id);
  const activeDropped = dx.filter(d => isActiveStatus(d.status) && !sel.dx.has(d.client_dx_id)).length
    + probs.filter(p => isActiveStatus(p.status) && !sel.pr.has(p.client_problem_id)).length;

  const save = () => onSave({
    diagnoses: dx.filter(d => sel.dx.has(d.client_dx_id)),
    problems: probs.filter(p => sel.pr.has(p.client_problem_id)),
    capturedOn: isoOf(TODAY),
  });

  return (
    <React.Fragment>
      <div className="modal-scrim" onClick={onCancel} />
      <div className="dxmodal" role="dialog" aria-modal="true" aria-labelledby="dxmodal-title">
        {/* DS `.modal header` (2086:547): Roboto SemiBold 16/24 title — not
            Guyot — no leading icon, and the dismiss control in its own trailing
            group at the right edge rather than tacked onto the title. */}
        <div className="dxmodal-head" data-node-id="2086:547">
          <div className="dxmodal-head-content">
            <h2 className="dxmodal-title" id="dxmodal-title">Which diagnoses and problems appear on the discharge summary?</h2>
            <div className="dxmodal-sub">
              <Avatar name={client.name} size="XS" /> {client.displayName} · MRN {client.mrn} · DOB {fmtDate(client.dob)} ({client.age})
            </div>
          </div>
          <div className="modal-head-actions">
            <button className="icon-btn modal-dismiss" aria-label="Close" onClick={onCancel} data-node-id="2048:586">
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* Embedded info banner. This is informational, not interactive, so it
            takes system/info rather than the theme's interactive colour. */}
        <div className="info-banner" role="note">
          <Icon name="info" size={20} />
          <div>
            <b>Discharging {client.shortName} does not resolve anything on this chart.</b> Every status below stays exactly as it is.
            Diagnosis and problem status is clinical and is changed only in the Diagnosis and Problem List modules.
            Your choices here decide what prints on the summary document — nothing else.
          </div>
        </div>

        <div className="dxmodal-body">
          <div className="tabs-default dxmodal-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'dx'} className={'tab-default' + (tab === 'dx' ? ' active' : '')}
              onClick={() => setTab('dx')}>Diagnoses ({dx.length})</button>
            <button role="tab" aria-selected={tab === 'pr'} className={'tab-default' + (tab === 'pr' ? ' active' : '')}
              onClick={() => setTab('pr')}>Problems ({probs.length})</button>
          </div>

          {tab === 'dx' ? (
            <SelectTable
              caption="Diagnoses"
              columns={['Diagnosis', 'Precedence', 'Onset']}
              rows={dx} idKey="client_dx_id" selected={sel.dx} onToggle={toggleDx}
              renderRow={d => (<React.Fragment>
                <td><b>{d.icd10}</b> — {d.description}<div className="cell-sub">{d.diagnosis_type} · diagnosed by {sName(d.diagnosed_by_staff_id)}</div></td>
                <td>{d.precedence}</td>
                <td>{fmtDate(d.onset_date)}</td>
              </React.Fragment>)}
            />
          ) : (
            <SelectTable
              caption="Problems"
              columns={['Problem', 'Category', 'Onset']}
              rows={probs} idKey="client_problem_id" selected={sel.pr} onToggle={togglePr}
              renderRow={p => (<React.Fragment>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{fmtDate(p.onset_date)}</td>
              </React.Fragment>)}
            />
          )}

          {primaryDropped && (
            <div className="dxmodal-alert tone-warn">
              <Icon name="warn" size={16} />
              <div><b>The primary diagnosis is excluded.</b> {primary.icd10} — {primary.description} is the primary diagnosis on this chart. Most payors require it on a discharge summary.</div>
            </div>
          )}
          {!primaryDropped && activeDropped > 0 && (
            <div className="dxmodal-alert tone-info">
              <Icon name="info" size={16} />
              <div>{activeDropped} item{activeDropped === 1 ? '' : 's'} with an active status {activeDropped === 1 ? 'is' : 'are'} excluded from the summary. {activeDropped === 1 ? 'It stays' : 'They stay'} active on the chart.</div>
            </div>
          )}
        </div>

        <div className="dxmodal-foot">
          <button className="lnk" onClick={() => setSel(defaults())}>Reset to Chart Defaults</button>
          <span className="spacer" />
          <span className="dxmodal-total">{total} item{total === 1 ? '' : 's'} will print<span className="dxmodal-next">next: review the summary, then {action.toLowerCase()}</span></span>
          <Button variant="ghost" onClick={onCancel}>Back to Note</Button>
          <Button variant="primary" onClick={save} disabled={total === 0}>Generate Summary</Button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- The generated summary ------------------------------------- */
function Row({ label, children }) {
  if (children == null || children === '' || (Array.isArray(children) && !children.length)) return null;
  return <div className="pdf-row"><div className="pdf-k">{label}</div><div className="pdf-v">{Array.isArray(children) ? children.join(', ') : children}</div></div>;
}
function SigLine({ label, sig, date, credentials }) {
  return (
    <div className="pdf-sig">
      <div className="pdf-sig-line">{sig ? <span className="sig-script">{sig.name}</span> : <span className="pdf-sig-blank" />}</div>
      <div className="pdf-sig-label">{label}{credentials ? ', ' + credentials : ''}{date ? ' · ' + fmtDate(date) : ''}</div>
    </div>
  );
}

function SummaryPreview({ client, form, selection, config, filed, onClose, onBack }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const team = careTeam(client.client_id);
  const docNo = 'DS-' + client.client_id.replace('CL-', '') + '-' + isoOf(TODAY).replace(/-/g, '');
  return (
    <React.Fragment>
      <div className="modal-scrim pdf-scrim" onClick={() => onClose(false)} />
      <div className="pdf-shell" role="dialog" aria-modal="true" aria-label="Discharge summary preview">
        <div className="pdf-toolbar">
          <span className="pdf-toolbar-title"><Icon name="documents" size={16} /> Discharge Summary — {filed ? 'filed document' : 'preview'}</span>
          <span className="pdf-toolbar-meta">{docNo} · PDF · 1 page</span>
          <span className="spacer" />
          {!filed && <Button size="sm" variant="ghost" onClick={onBack}>Back to Selection</Button>}
          <Button size="sm" variant="secondary" onClick={() => window.print()}><Icon name="print" size={14} /> Print</Button>
          {filed
            ? <Button size="sm" variant="primary" onClick={() => onClose(false)}>Close</Button>
            : <Button size="sm" variant="primary" onClick={() => onClose(true)}>
                <Icon name="check" size={14} /> {config.requiresApproval ? 'Pend to Manager' : 'File to Chart'}
              </Button>}
        </div>

        <div className="pdf-scroll">
          <article className="pdf-page">
            <header className="pdf-head">
              <div>
                <div className="pdf-agency">{AGENCY.name}</div>
                <div className="pdf-agency-sub">{form.sites}</div>
              </div>
              <div className="pdf-doc">
                <div className="pdf-doctitle">Discharge Summary</div>
                <div className="pdf-docmeta">{docNo}</div>
                <div className="pdf-docmeta">Generated {fmtDate(TODAY)}</div>
              </div>
            </header>

            <section className="pdf-client">
              <div><span className="pdf-k">Client</span><b>{client.displayName}</b></div>
              <div><span className="pdf-k">MRN</span>{client.mrn}</div>
              <div><span className="pdf-k">Date of birth</span>{fmtDate(client.dob)} ({client.age})</div>
              <div><span className="pdf-k">Program</span>{client.program}</div>
              <div><span className="pdf-k">Intake date</span>{fmtDate(form.intakeDate)}</div>
              <div><span className="pdf-k">Discharge date</span>{fmtDate(form.dischargeDate)}</div>
            </section>

            <h3 className="pdf-h">Discharge</h3>
            <Row label="Discharge type">{form.dischargeType}</Row>
            <Row label="Reason for discharge">{[form.whyDischarged, form.whyDischargedDetail].filter(Boolean).join(' — ')}</Row>
            <Row label="Outcome of service provided">{form.outcome}</Row>
            <Row label="Cultural issues / special needs met">{form.culturalMet}</Row>
            <Row label="Medication only client">{form.medicationOnly ? 'Yes' : 'No'}</Row>

            <h3 className="pdf-h">Presenting Condition / Reason for Treatment</h3>
            <p className="pdf-p">{form.presentingCondition || <em>Not documented.</em>}</p>

            <h3 className="pdf-h">Summary of Treatment</h3>
            <Row label="Services provided">{form.servicesProvided}</Row>
            <Row label="Last counseling / CFT session">{form.lastCounselingDate ? fmtDate(form.lastCounselingDate) + (form.lastCounselingDetails ? ' — ' + form.lastCounselingDetails : '') : null}</Row>
            <Row label="Last bed date">{form.lastBedDate ? fmtDate(form.lastBedDate) + (form.lastBedDetails ? ' — ' + form.lastBedDetails : '') : null}</Row>
            <Row label="Strengths, needs, abilities, preferences">{form.strengths}</Row>
            <Row label="Goals achieved">{form.goalsAchieved}</Row>
            <Row label="Goals not achieved / continuing needs">{form.goalsNotAchieved}</Row>

            <h3 className="pdf-h">
              Diagnoses at Discharge
              <span className="pdf-h-note">status as recorded on the chart {fmtDate(selection.capturedOn)} — unchanged by this discharge</span>
            </h3>
            {selection.diagnoses.length ? (
              <table className="pdf-table">
                <thead><tr><th>ICD-10</th><th>Diagnosis</th><th>Precedence</th><th>Onset</th><th>Status</th></tr></thead>
                <tbody>{selection.diagnoses.map(d => (
                  <tr key={d.client_dx_id}><td>{d.icd10}</td><td>{d.description}</td><td>{d.precedence}</td><td>{fmtDate(d.onset_date)}</td><td>{d.status}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="pdf-p"><em>No diagnoses included on this summary.</em></p>}

            <h3 className="pdf-h">Problem List at Discharge</h3>
            {selection.problems.length ? (
              <table className="pdf-table">
                <thead><tr><th>Problem</th><th>Category</th><th>Onset</th><th>Status</th></tr></thead>
                <tbody>{selection.problems.map(p => (
                  <tr key={p.client_problem_id}><td>{p.name}</td><td>{p.category}</td><td>{fmtDate(p.onset_date)}</td><td>{p.status}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="pdf-p"><em>No problems included on this summary.</em></p>}

            <h3 className="pdf-h">Medications at Discharge</h3>
            {client.rx.length ? (
              <table className="pdf-table">
                <thead><tr><th>Medication</th><th>Directions</th><th>Qty</th><th>Days</th><th>Refills</th><th>Prescriber</th></tr></thead>
                <tbody>{client.rx.map(r => (
                  <tr key={r.rx_id}><td>{r.medication_display}</td><td>{r.sig}</td><td>{r.qty}</td><td>{r.days}</td><td>{r.refills}</td><td>{sName(r.prescriber_staff_id)}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="pdf-p"><em>{form.medsFound || 'No medications recorded at discharge.'}</em></p>}
            <Row label="Medication notes">{form.medsNote}</Row>
            <Row label="Disposition of member (medications, property, funds)">{form.disposition}</Row>

            <h3 className="pdf-h">Transition and Aftercare</h3>
            <Row label="Transition plan">{form.transitionPlan}</Row>
            <Row label="Recommendations for services / supports">{form.recommendations}</Row>
            <Row label="Resources offered or given">{form.resources}</Row>
            <Row label="Persons assisting with transition / discharge">{form.assistingPersons}</Row>

            <h3 className="pdf-h">Signatures</h3>
            <div className="pdf-sigs">
              <SigLine label="Patient" sig={form.patientSig} date={form.patientSigDate} />
              <SigLine label="Completing staff" sig={form.staffSig} date={form.staffSigDate} credentials={form.staffCredentials} />
              {form.bhtSig && <SigLine label="BHT" sig={form.bhtSig} date={form.bhtSigDate} credentials={form.bhtCredentials} />}
              {form.bhpSig && <SigLine label="BHP" sig={form.bhpSig} date={form.bhpSigDate} credentials={form.bhpCredentials} />}
            </div>
            <Row label="Completion status">{form.completionStatus}{form.statusComments ? ' — ' + form.statusComments : ''}</Row>
            <Row label="Assigned care team">{team.map(t => `${t.name} (${t.role})`)}</Row>

            <footer className="pdf-foot">
              <span>{AGENCY.name} · {AGENCY.product} · {docNo}</span>
              <span>Page 1 of 1</span>
              <span className="pdf-foot-warn">Prototype — synthetic data, not a clinical record</span>
            </footer>
          </article>
        </div>
      </div>
    </React.Fragment>
  );
}
