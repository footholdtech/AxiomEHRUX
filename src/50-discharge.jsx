/* ===== Client chart + Discharge Plan =============================
   The form mirrors the live AxiomEHR "Input Clinical Discharge" page: same
   sections, same field labels, same required markers, same control types.
   What changes is the interaction design around it. ==================== */

/* Client Summary is the landing tab for every chart: opening someone's record
   should show you the record, not drop you straight into a form. */
const CHART_HOME_TAB = 'Client Summary';
const CHART_TABS = [CHART_HOME_TAB, 'Dynamic Progress Notes', 'Discharge Plan', 'Problem List', 'Quality Management', 'Psychiatric Evaluation', 'Psychotherapy Progress Note'];
const OUTCOME_OPTIONS = ['Full Resolution', 'Partial Resolution', 'No Resolution'];
const WHY_DISCHARGED = ['Voluntary Discharge', 'In-Voluntary Discharge'];

/* ---- Form primitives ------------------------------------------- */
function Field({ label, required, hint, error, children, wide }) {
  return (
    <div className={'ff' + (wide ? ' ff-wide' : '')}>
      <div className="ff-label">
        {label}{required && <span className="ff-req"> * <span className="ff-req-txt">(Required)</span></span>}
      </div>
      {children}
      {hint && !error && <div className="ff-hint">{hint}</div>}
      {error && <div className="ff-error"><Icon name="warn" size={13} /> {error}</div>}
    </div>
  );
}
function TextArea({ value, onChange, placeholder = 'Please input...', rows = 2, invalid }) {
  return <textarea className={'ta' + (invalid ? ' invalid' : '')} rows={rows} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}
/* DateField owns its own label so the Today / 7 / 30 quick-set can sit on the
   label's baseline, right-aligned, the way the product renders it. Nesting it
   inside <Field> pushed the quick-set between the label and the input and left
   the label floating well above the control. */
function DateField({ label, required, error, value, onChange }) {
  const setRel = n => onChange(isoOf(addDays(TODAY, n)));
  return (
    <div className="ff">
      <div className="ff-label ff-label--row">
        <span>{label}{required && <span className="ff-req"> * <span className="ff-req-txt">(Required)</span></span>}</span>
        <span className="date-quick">
          <button type="button" className="quick" onClick={() => setRel(0)}>Today</button>
          <button type="button" className="quick" onClick={() => setRel(7)}>7</button>
          <button type="button" className="quick" onClick={() => setRel(30)}>30</button>
        </span>
      </div>
      <div className={'form-input date-input' + (error ? ' invalid' : '')}>
        <Icon name="calendar" size={15} />
        <input value={value ? fmtDate(value) : ''} placeholder="MM/DD/YYYY" readOnly onClick={() => setRel(0)} />
        {value && <button type="button" className="date-clear" aria-label="Clear date" onClick={() => onChange('')}><Icon name="close" size={13} /></button>}
      </div>
      {error && <div className="ff-error"><Icon name="warn" size={13} /> {error}</div>}
    </div>
  );
}
function RadioGroup({ name, options, value, onChange, invalid }) {
  return <div className={'radio-group' + (invalid ? ' invalid' : '')}>{options.map(o => <Radio key={o} name={name} label={o} checked={value === o} onChange={() => onChange(o)} />)}</div>;
}
function CheckGroup({ options, value = [], onChange, columns }) {
  const toggle = o => onChange(value.indexOf(o) !== -1 ? value.filter(x => x !== o) : value.concat([o]));
  return <div className="check-group" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` } : null}>
    {options.map(o => <Checkbox key={o} label={o} checked={value.indexOf(o) !== -1} onChange={() => toggle(o)} />)}
  </div>;
}
function MultiSelect({ value = [], options, onChange, placeholder = 'Please select...', invalid }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menuRef = useRef(null);
  useOutside([ref, menuRef], () => setOpen(false));
  const toggle = o => onChange(value.indexOf(o) !== -1 ? value.filter(x => x !== o) : value.concat([o]));
  return (
    <div className="dd" ref={ref}>
      <button type="button" className={'dd-trigger' + (open ? ' open' : '') + (invalid ? ' invalid' : '')} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={value.length ? 'dd-value' : 'dd-placeholder'}>{value.length ? value.join(', ') : placeholder}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && <FloatMenu anchorRef={ref} menuRef={menuRef} className="dd-menu" onClose={() => setOpen(false)}><div className="dd-list">{options.map(o => (
        <div key={o} className={'dd-opt' + (value.indexOf(o) !== -1 ? ' active' : '')} onClick={() => toggle(o)}>
          <Checkbox checked={value.indexOf(o) !== -1} onChange={() => toggle(o)} label={o} />
        </div>
      ))}</div></FloatMenu>}
    </div>
  );
}
function SignatureField({ value, onChange, signer, invalid }) {
  if (value) return (
    <div className="sig-done">
      <span className="sig-script">{value.name}</span>
      <span className="sig-when">Signed {fmtDate(value.date)}</span>
      <button type="button" className="icon-btn" aria-label="Clear signature" onClick={() => onChange(null)}><Icon name="close" size={14} /></button>
    </div>
  );
  return <Button variant="secondary" size="sm" onClick={() => onChange({ name: signer, date: isoOf(TODAY) })} style={invalid ? { borderColor: 'var(--foreground-system-error, #b3261e)' } : null}>
    <Icon name="pen" size={14} /> Get Signature
  </Button>;
}

/* ---- Discharge Plan --------------------------------------------- */
const REQUIRED_FIELDS = [
  ['dischargeType', 'Discharge Type'],
  ['servicesProvided', 'Services Provided'],
  ['outcome', 'Outcome of Service Provided'],
  ['culturalMet', 'Were Cultural Issues / Special Needs Met'],
  ['whyDischarged', 'Why was the client discharged?'],
  ['patientSig', 'Patient Signature'],
  ['patientSigDate', 'Patient Signature date'],
  ['staffSig', 'Completing Staff Signature'],
  ['staffSigDate', 'Completing Staff Signature date'],
  ['completionStatus', 'Completion Status'],
];
const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

function initialForm(c) {
  return {
    dischargeType: '', presentingCondition: '',
    intakeDate: c.enrollment_date, dischargeDate: isoOf(TODAY),
    medicationOnly: false, sites: c.siteName,
    lastCounselingDate: '', lastCounselingDetails: '',
    lastBedDate: '', lastBedDetails: '',
    servicesProvided: [], outcome: '', culturalMet: '',
    strengths: '', recommendations: '',
    whyDischarged: '', whyDischargedDetail: '',
    medsFound: c.rx.length ? 'Medications Found' : '', medsNote: '',
    disposition: '', goalsAchieved: '', goalsNotAchieved: '', transitionPlan: '',
    resources: [], assistingPersons: '',
    patientSig: null, patientSigDate: '',
    staffSig: null, staffSigDate: '', staffCredentials: ME.credentials || '',
    bhtSig: null, bhtSigDate: '', bhtCredentials: '',
    bhpSig: null, bhpSigDate: '', bhpCredentials: '',
    completionStatus: '', statusComments: '',
  };
}
function demoAnswers(c, requiresApproval) {
  const team = careTeam(c.client_id);
  const lead = STAFF[team[0].id] || {};
  return {
    dischargeType: 'Completed Treatment — Step-Down to Outpatient',
    presentingCondition: `${c.shortName} entered residential treatment following an alcohol-related hospitalization, with co-occurring trauma symptoms and no stable housing. Presenting concerns were daily alcohol use, nightmares and hypervigilance, and inability to maintain employment.`,
    lastCounselingDate: isoOf(addDays(TODAY, -3)), lastCounselingDetails: 'Final individual session and CFT with sister present. Reviewed relapse-prevention plan and outpatient handoff.',
    lastBedDate: isoOf(addDays(TODAY, -1)), lastBedDetails: 'Final night in Unit 2 step-down housing. Room cleared, personal property returned.',
    servicesProvided: ['Residential Treatment', 'Individual Therapy', 'Group Therapy', 'Case Management', 'Medication Management'],
    outcome: 'Partial Resolution',
    culturalMet: 'Yes',
    strengths: 'Consistent group attendance; strong relationship with older sister who has offered transitional housing; motivated by return to trade work; responds well to structure and peer accountability.',
    recommendations: `Outpatient continuation with ${team[0].name} (${team[0].role}), ${siteName(lead.site_id)}, Mon/Thu 9:00–17:00, ${lead.phone || '555-020-0000'}. Medication management to continue with the prescribing provider. Peer Connect referral submitted for community recovery support.`,
    whyDischarged: 'Voluntary Discharge',
    whyDischargedDetail: 'Member met residential treatment objectives and elected to step down to outpatient with agreement from the treatment team.',
    medsFound: c.rx.length ? 'Medications Found' : 'Medications Not Found',
    medsNote: '30-day supply dispensed at discharge; outpatient prescriber appointment scheduled before first refill is due.',
    disposition: 'All personal property and funds held in the resident account were returned and signed for. Medications released to member with written instructions.',
    goalsAchieved: 'Maintained abstinence for the final 90 days of the residential episode. Completed trauma-focused group. Re-established contact with family support. Obtained state ID and applied for transitional housing.',
    goalsNotAchieved: 'Employment goal not met — member is not yet working. Sleep remains disrupted and will be followed in outpatient. Housing is transitional rather than permanent.',
    transitionPlan: 'Outpatient therapy weekly for 8 weeks then re-evaluate; medication management every 4 weeks; peer support specialist assigned; staying with sister for 60 days while the housing application is processed; crisis line and warm line numbers provided and rehearsed.',
    resources: RESOURCE_OPTIONS.slice(),
    assistingPersons: 'Member; member’s sister (natural support, present at discharge meeting); assigned case manager; peer support specialist.',
    patientSig: { name: c.name, date: isoOf(TODAY) }, patientSigDate: isoOf(TODAY),
    staffSig: { name: ME.name, date: isoOf(TODAY) }, staffSigDate: isoOf(TODAY), staffCredentials: ME.credentials || 'LCSW',
    bhtSig: { name: team[1].name, date: isoOf(TODAY) }, bhtSigDate: isoOf(TODAY), bhtCredentials: team[1].credentials || 'BHT',
    completionStatus: requiresApproval ? 'Pend to Manager' : 'Complete',
    statusComments: '',
  };
}

function DischargePlan({ client, config, onOpenModule }) {
  const guard = useGuard();
  const [form, setForm] = useState(() => initialForm(client));
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState(null);      // null | 'preview'
  const [selection, setSelection] = useState(null);
  const [filed, setFiled] = useState(null);      // the completed record, once saved
  const [historyOpen, setHistoryOpen] = useState(false);

  /* Re-initialise whenever the chart changes, so one client's answers can never
     appear inside another client's note. */
  useEffect(() => { setForm(initialForm(client)); setErrors({}); setFiled(null); setStage(null); guard.clearDirty(); }, [client.client_id]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => (e[k] ? { ...e, [k]: undefined } : e));
    guard.markDirty('Discharge Plan');
  };
  const setMany = obj => { setForm(f => ({ ...f, ...obj })); setErrors({}); guard.markDirty('Discharge Plan'); };

  const validate = () => {
    const e = {};
    REQUIRED_FIELDS.forEach(([k, label]) => { if (isEmpty(form[k])) e[k] = label + ' is required.'; });
    setErrors(e);
    return e;
  };

  const primaryLabel = config.requiresApproval ? 'Pend to Manager' : 'Save as Complete';
  const onPrimary = () => {
    const e = validate();
    const keys = Object.keys(e);
    if (keys.length) {
      guard.setToast({ icon: 'warn', title: `${keys.length} required field${keys.length > 1 ? 's' : ''} still need${keys.length > 1 ? '' : 's'} an answer`, detail: 'Highlighted below. Use “Prefill demo answers” in the prototype bar to fill the note quickly.' });
      const first = document.querySelector('.ff-error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!form.completionStatus) set('completionStatus', config.requiresApproval ? 'Pend to Manager' : 'Complete');
    /* No selection step. Whatever is active on the chart at the moment of
       saving is what the summary shows — the customer confirmed they don't
       need to pick. Resolved and Inactive items stay off the document, and
       nothing on the chart changes status either way. */
    setSelection({
      diagnoses: client.diagnoses.filter(d => isActiveStatus(d.status)),
      problems: client.problems.filter(p => isActiveStatus(p.status)),
      capturedOn: isoOf(TODAY),
    });
    setStage('preview');
  };
  const onPreviewClose = (didFile) => {
    setStage(null);
    if (didFile) {
      setFiled({ at: TODAY, status: config.requiresApproval ? 'Pended to Manager' : 'Complete', selection });
      guard.clearDirty();
      guard.setToast({
        icon: 'check',
        title: config.requiresApproval ? 'Discharge Plan pended to manager' : 'Discharge Plan saved as complete',
        detail: `${selection.diagnoses.length + selection.problems.length} item${selection.diagnoses.length + selection.problems.length === 1 ? '' : 's'} included on the summary. No diagnosis or problem status was changed.`,
      });
    }
  };

  const readOnly = !!filed;
  const rx = client.rx;

  return (
    <React.Fragment>
      <PrototypeBar
        config={config}
        onPrefill={() => setMany(demoAnswers(client, config.requiresApproval))}
        onReset={() => { setForm(initialForm(client)); setErrors({}); setFiled(null); guard.clearDirty(); }}
      />

      <div className="dp-head">
        <h1 className="page-title">Discharge Plan</h1>
        <button className={'pill-btn' + (historyOpen ? ' active' : '')} onClick={() => setHistoryOpen(o => !o)}><Icon name="calendar" size={14} /> Discharge Plan History</button>
        <span className="pill-btn active"><Icon name="edit" size={14} /> Input Clinical Discharge</span>
        <span className="spacer" />
        {filed
          ? <span className={'badge ' + (filed.status === 'Complete' ? 'status-active' : 'status-info')}>{filed.status} · {fmtDate(filed.at)}</span>
          : guard.dirty ? <span className="badge status-amber"><Icon name="edit" size={12} /> Unsaved changes</span>
          : <span className="badge status-neutral">Not started</span>}
      </div>

      {historyOpen && (
        <Panel title="Discharge Plan History">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Discharge Type</th><th>Discharge Date</th><th>Status</th><th>Create Info</th><th>Update Info</th><th>Action</th></tr></thead>
              <tbody>
                {filed
                  ? <tr><td>{form.dischargeType}</td><td>{fmtDate(form.dischargeDate)}</td><td><span className="badge status-active">{filed.status}</span></td>
                      <td>{ME.name} · {fmtDate(TODAY)}</td><td>{ME.name} · {fmtDate(TODAY)}</td><td><a className="lnk" onClick={() => setStage('preview')}>View Summary</a></td></tr>
                  : <tr className="empty-row"><td colSpan={6}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Input Clinical Discharge">
        <fieldset className="dp-form" disabled={readOnly}>

          <SubSection title="Discharge Summary Type">
            <div className="ff-row cols-1">
              <Field label="Discharge Type" required error={errors.dischargeType}>
                <Dropdown value={form.dischargeType} options={DISCHARGE_TYPES} onChange={v => set('dischargeType', v)} invalid={!!errors.dischargeType} />
              </Field>
            </div>
          </SubSection>

          <SubSection>
            <Field label="Presenting Condition/Reason for Treatment" wide>
              <TextArea value={form.presentingCondition} onChange={v => set('presentingCondition', v)} rows={3} />
            </Field>
          </SubSection>

          <SubSection title="Discharge Summary">
            <div className="ff-row cols-4">
              <DateField label="Intake Date" value={form.intakeDate} onChange={v => set('intakeDate', v)} />
              <DateField label="Discharge Date" value={form.dischargeDate} onChange={v => set('dischargeDate', v)} />
              <Field label="Medication Only Client?"><div className="ff-inline"><Checkbox checked={form.medicationOnly} onChange={v => set('medicationOnly', v)} ariaLabel="Medication only client" /></div></Field>
              <Field label="Sites"><Dropdown value={form.sites} options={SITE_OPTIONS} onChange={v => set('sites', v)} /></Field>
            </div>
          </SubSection>

          <SubSection title="Last Counseling (individual, family, group) Session or CFT Information">
            <div className="ff-row cols-2-wide">
              <DateField label="Date" value={form.lastCounselingDate} onChange={v => set('lastCounselingDate', v)} />
              <Field label="Details"><TextArea value={form.lastCounselingDetails} onChange={v => set('lastCounselingDetails', v)} /></Field>
            </div>
          </SubSection>

          <SubSection title="Last Bed Date">
            <div className="ff-row cols-2-wide">
              <DateField label="Date" value={form.lastBedDate} onChange={v => set('lastBedDate', v)} />
              <Field label="Details"><TextArea value={form.lastBedDetails} onChange={v => set('lastBedDetails', v)} /></Field>
            </div>
          </SubSection>

          <SubSection title="Summary of Treatment">
            <div className="ff-row cols-1">
              <Field label="Services Provided" required error={errors.servicesProvided}>
                <MultiSelect value={form.servicesProvided} options={SERVICES_PROVIDED} onChange={v => set('servicesProvided', v)} invalid={!!errors.servicesProvided} />
              </Field>
            </div>
            <div className="ff-row cols-2">
              <Field label="Outcome of Service Provided" required error={errors.outcome}>
                <RadioGroup name="outcome" options={OUTCOME_OPTIONS} value={form.outcome} onChange={v => set('outcome', v)} invalid={!!errors.outcome} />
              </Field>
              <Field label="Were Cultural Issues / Special Needs Met" required error={errors.culturalMet}>
                <RadioGroup name="cultural" options={['Yes', 'No']} value={form.culturalMet} onChange={v => set('culturalMet', v)} invalid={!!errors.culturalMet} />
              </Field>
            </div>
            <Field label="List member Strengths, Needs, Abilities, Preferences" wide>
              <TextArea value={form.strengths} onChange={v => set('strengths', v)} rows={3} />
            </Field>
            <Field wide label="Recommendations for services/supports (referral information, such as contact name, telephone number, locations, hours, and days of services, when applicable, list specific providers if available)">
              <TextArea value={form.recommendations} onChange={v => set('recommendations', v)} rows={3} />
            </Field>
            <Field label="Why was the client discharged?" required error={errors.whyDischarged} wide>
              <RadioGroup name="why" options={WHY_DISCHARGED} value={form.whyDischarged} onChange={v => set('whyDischarged', v)} invalid={!!errors.whyDischarged} />
              <TextArea value={form.whyDischargedDetail} onChange={v => set('whyDischargedDetail', v)} rows={2} />
            </Field>

            <div className="sub-label">Medication (at Discharge)</div>
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr><th>Medication</th><th>Form-Strength</th><th>Directions</th><th>Quantity</th><th>Duration</th><th>Refills</th><th>Provider</th><th>Prescribed</th></tr></thead>
                <tbody>
                  {rx.length ? rx.map(r => (
                    <tr key={r.rx_id}>
                      <td>{r.medication_display.replace(/\s+[\d.]+\s*m[gl].*$/i, '')}</td>
                      <td>{(r.medication_display.match(/[\d.]+\s*m[gl]/i) || ['—'])[0]}</td>
                      <td className="cell-wrap">{r.sig}</td>
                      <td>{r.qty}</td><td>{r.days} days</td><td>{r.refills}</td>
                      <td>{sName(r.prescriber_staff_id)}</td><td>{fmtDate(r.start_date)}</td>
                    </tr>
                  )) : <tr className="empty-row"><td colSpan={8}>No data</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="ff-row cols-1">
              <Field label="">
                <RadioGroup name="medsfound" options={['Medications Found', 'Medications Not Found']} value={form.medsFound} onChange={v => set('medsFound', v)} />
                <TextArea value={form.medsNote} onChange={v => set('medsNote', v)} />
              </Field>
            </div>

            <Field label="Disposition of Member (medications, property, funds)" wide>
              <TextArea value={form.disposition} onChange={v => set('disposition', v)} rows={2} />
            </Field>
            <Field wide label="Goals Achieved (summarize goals and objectives met or partially met from service plan)" hint="Additional goals achieved">
              <TextArea value={form.goalsAchieved} onChange={v => set('goalsAchieved', v)} rows={3} />
            </Field>
            <Field wide label="Goals not Achieved (continuing needs/concerns)" hint="Additional goals not achieved">
              <TextArea value={form.goalsNotAchieved} onChange={v => set('goalsNotAchieved', v)} rows={3} />
            </Field>
            <Field wide label="Transition Plan (list ongoing recovery supports and follow-up needs to support member discharge per member’s preferences — natural supports, continuity for ongoing medication, community supports, personal medicine, meaningful daily activities, well-being)">
              <TextArea value={form.transitionPlan} onChange={v => set('transitionPlan', v)} rows={3} />
            </Field>
            <Field label="Was the member offered/given the following resources?" wide>
              <CheckGroup options={RESOURCE_OPTIONS} value={form.resources} onChange={v => set('resources', v)} columns={3} />
            </Field>
          </SubSection>

          <DiagnosisSection client={client} onOpenModule={onOpenModule} />

          <SubSection>
            <Field wide label="Person/s assisting member with transition/discharge (member, family, guardian, advocate)">
              <TextArea value={form.assistingPersons} onChange={v => set('assistingPersons', v)} rows={2} />
            </Field>
          </SubSection>

          <SubSection title="Signatures">
            <div className="sig-grid">
              <Field label="Patient Signature" required error={errors.patientSig}>
                <SignatureField value={form.patientSig} signer={client.name} invalid={!!errors.patientSig}
                  onChange={v => { set('patientSig', v); set('patientSigDate', v ? v.date : ''); }} />
              </Field>
              <DateField label="Date" required error={errors.patientSigDate} value={form.patientSigDate} onChange={v => set('patientSigDate', v)} />
              <div />

              <Field label="Completing Staff Signature" required error={errors.staffSig}>
                <SignatureField value={form.staffSig} signer={ME.name} invalid={!!errors.staffSig}
                  onChange={v => { set('staffSig', v); set('staffSigDate', v ? v.date : ''); }} />
              </Field>
              <DateField label="Date" required error={errors.staffSigDate} value={form.staffSigDate} onChange={v => set('staffSigDate', v)} />
              <Field label="Credentials"><TextArea value={form.staffCredentials} onChange={v => set('staffCredentials', v)} rows={1} /></Field>

              <Field label="BHT Signature">
                <SignatureField value={form.bhtSig} signer={careTeam(client.client_id)[1].name}
                  onChange={v => { set('bhtSig', v); set('bhtSigDate', v ? v.date : ''); }} />
              </Field>
              <DateField label="Date" value={form.bhtSigDate} onChange={v => set('bhtSigDate', v)} />
              <Field label="Credentials"><TextArea value={form.bhtCredentials} onChange={v => set('bhtCredentials', v)} rows={1} /></Field>

              <Field label="BHP Signature">
                <SignatureField value={form.bhpSig} signer={careTeam(client.client_id)[2].name}
                  onChange={v => { set('bhpSig', v); set('bhpSigDate', v ? v.date : ''); }} />
              </Field>
              <DateField label="Date" value={form.bhpSigDate} onChange={v => set('bhpSigDate', v)} />
              <Field label="Credentials"><TextArea value={form.bhpCredentials} onChange={v => set('bhpCredentials', v)} rows={1} /></Field>
            </div>
          </SubSection>

          <SubSection title="Complete">
            <div className="ff-row cols-2">
              <Field label="Completion Status" required error={errors.completionStatus}>
                <Dropdown value={form.completionStatus} options={COMPLETION_STATUSES} onChange={v => set('completionStatus', v)} invalid={!!errors.completionStatus} />
              </Field>
              <Field label="Status Comments"><TextArea value={form.statusComments} onChange={v => set('statusComments', v)} /></Field>
            </div>
          </SubSection>
        </fieldset>

        <div className="dp-actions">
          {readOnly ? (
            <React.Fragment>
              <Button variant="primary" onClick={() => setStage('preview')}><Icon name="documents" size={15} /> View Discharge Summary</Button>
              <Button variant="ghost" onClick={() => { setFiled(null); }}>Reopen Note</Button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Button variant="primary" onClick={onPrimary}>{primaryLabel}</Button>
              <Button variant="secondary" onClick={() => { guard.clearDirty(); guard.setToast({ icon: 'check', title: 'Draft Saved', detail: 'Nothing has been filed to the chart yet.' }); }}>Save Draft</Button>
              <span className="spacer" />
              <Button variant="ghost" onClick={() => { setForm(initialForm(client)); setErrors({}); guard.clearDirty(); }}>Reset</Button>
            </React.Fragment>
          )}
        </div>
      </Panel>

      {stage === 'preview' && selection && (
        <SummaryPreview client={client} form={form} selection={selection} config={config} filed={filed} onClose={onPreviewClose} />
      )}
    </React.Fragment>
  );
}

function SubSection({ title, children }) {
  return <div className="dp-sub">{title && <div className="dp-sub-title">{title}</div>}{children}</div>;
}

/* The Diagnosis block inside the note. In the product this table is empty and
   "Open Diagnosis" is the only way to see anything. Here it shows the live
   chart list WITH status, and says plainly that discharging does not change
   it — so the rule is visible before the clinician ever hits save. */
function DiagnosisSection({ client, onOpenModule }) {
  const dx = client.diagnoses;
  return (
    <SubSection title="Diagnosis">
      <div className="table-wrap">
        <table className="data-table compact">
          <thead><tr><th>Diagnosis</th><th>Precedence</th><th>Type</th><th>Onset</th><th>Status on chart</th></tr></thead>
          <tbody>
            {dx.length ? dx.map(d => (
              <tr key={d.client_dx_id}>
                <td><b>{d.icd10}</b> — {d.description}</td>
                <td>{d.precedence}</td>
                <td>{d.diagnosis_type}</td>
                <td>{fmtDate(d.onset_date)}</td>
                <td><span className={'badge ' + (STATUS_TONE[d.status] || 'status-neutral')}>{d.status}</span>
                  {d.resolved_date && <span className="cell-note"> {fmtDate(d.resolved_date)}</span>}</td>
              </tr>
            )) : <tr className="empty-row"><td colSpan={5}>No data</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="inline-note">
        <Icon name="info" size={16} />
        <div>
          <b>Discharging this client does not resolve these diagnoses.</b> Diagnosis status is clinical and is maintained in the Diagnosis module.
          When you save this note you will choose which of them appear on the printed discharge summary — that choice affects the document only.
        </div>
      </div>
      {/* Not buttons. These leave the Discharge Plan for another module, so
          they read as links and go through the guard — unsaved work on this
          note is intercepted before the navigation happens. */}
      <div className="ff-links">
        <a className="lnk" onClick={() => onOpenModule('Diagnosis')}>Edit Diagnoses</a>
        <a className="lnk" onClick={() => onOpenModule('Problem List')}>Edit Problems</a>
      </div>
    </SubSection>
  );
}

/* Prototype-only controls. Visibly not part of the product UI. */
function PrototypeBar({ config, onPrefill, onReset }) {
  return (
    <div className="proto-bar">
      <span className="proto-tag">Prototype controls</span>
      <Button size="sm" variant="ghost" onClick={onPrefill}>Prefill Demo Answers</Button>
      <Button size="sm" variant="ghost" onClick={onReset}>Clear Note</Button>
      <span className="spacer" />
      <label className="proto-toggle">
        <span>Agency configuration:</span>
        <b>{config.requiresApproval ? 'Notes require manager approval' : 'Clinician can complete'}</b>
        <Toggle checked={config.requiresApproval} onChange={config.setRequiresApproval} />
      </label>
    </div>
  );
}

/* ---- Client Summary ---------------------------------------------
   The landing tab for a chart: what a provider needs to know before they do
   anything, and nothing the client header already tells them. The header
   carries identity, care team, allergies and vitals counts — so none of that
   is repeated here.

   Six things, in the order a provider actually asks them:
     what needs doing · what has been done · what the client said ·
     when they are next in · how they are tracking · what changed recently

   Restraint on colour is deliberate. Only two things are ever tinted: work
   that is overdue, and a missed appointment. Everything else is neutral text,
   because if the whole page is coloured none of it reads as urgent.

   No design existed for this, so the layout is improvised: a main column with
   modules paired side-by-side where they are narrow enough, and a timeline in
   a right rail that collapses underneath on narrow viewports. */

/* Attendance is not in the fixture — `completion_status` is blank on all but
   three of 171 rows — so it is derived from the appointment id. Deterministic,
   so the same appointment always reads the same way. */
const apptOutcome = (a, today) => {
  const d = _parse(a.date);
  if (!d) return 'Scheduled';
  if (d > today) return 'Scheduled';
  const r = seed(a.appointment_id) % 10;
  return r === 0 ? 'No Show' : r === 1 ? 'Cancelled' : 'Attended';
};

/* Cadence text from the assessments catalogue drives the next-due date. */
const cadenceDays = c => /90 days/.test(c) ? 90 : /6 months/.test(c) ? 182 : /year/.test(c) ? 365 : 0;

const CONSENTS = [
  { name: 'AI Recording Consent', required: true },
  { name: 'Release of Information', required: true },
  { name: 'Telehealth Consent', required: false },
  { name: 'Notice of Privacy Practices', required: true },
];

/* Programs that track an acuity/progress score. Not every program does, and
   saying so is more useful than showing an empty chart. */
const PROGRESS_PROGRAMS = ['Recovery Today', 'New Foundations', 'Back on Track'];

function useClientSummaryData(client) {
  return useMemo(() => {
    const cid = client.client_id;
    const today = TODAY;

    /* 1. Work that needs doing ------------------------------------ */
    /* `assessments` is an object, not an array: {_meta, instruments,
       sample_results}. Reading it as a list silently produced no due dates. */
    const cat = ((RD.assessments || {}).instruments) || [];
    const results = ((RD.assessments || {}).sample_results) || [];
    const dueAssessments = pick(cat, cid + 'due', Math.min(3, cat.length)).map(a => {
      const every = cadenceDays(a.typical_cadence) || 180;
      const last = addDays(today, -(every - (seed(cid + a.assessment_id) % 40) + 20));
      const next = addDays(last, every);
      const days = Math.round((next - today) / 86400000);
      return { kind: 'Assessment', name: a.name, last, next, days };
    });
    const consents = CONSENTS.map(c => {
      const r = seed(cid + c.name) % 5;
      return { kind: 'Consent', name: c.name, signed: r > 1, expires: r === 1 ? addDays(today, 9) : null, required: c.required };
    });
    const attention = dueAssessments
      .filter(a => a.days < 45)
      .map(a => ({ label: a.name, detail: a.days < 0 ? Math.abs(a.days) + ' days overdue' : 'due in ' + a.days + ' days', overdue: a.days < 0, when: a.next }))
      .concat(consents.filter(c => !c.signed && c.required).map(c => ({ label: c.name, detail: 'not signed', overdue: true, when: null })))
      .concat(consents.filter(c => c.expires).map(c => ({ label: c.name, detail: 'expires ' + fmtDate(c.expires), overdue: false, when: c.expires })));

    /* 2. Recent documentation -------------------------------------
       Shared with the client header's "Clinical Notes" quick view — see
       clientDocs() in 10-data.jsx. Two derivations would drift, and a header
       disagreeing with the page under it is worse than either being wrong. */
    const docs = clientDocs(cid, 6);

    /* 3. Correspondence ------------------------------------------- */
    const real = (RD.clientMessages || []).filter(m => m.recipient_id === cid || m.sender_id === cid);
    const msgs = (real.length ? real : Array.from({ length: 4 }).map((_, i) => {
      const s = seed(cid + 'msg' + i);
      return {
        message_id: cid + '-m' + i,
        sender_type: i % 2 === 0 ? 'client' : 'staff',
        sender_id: i % 2 === 0 ? cid : ME.id,
        timestamp: addDays(today, -(i * 2 + 1)).toISOString(),
        body: [
          'Can I move my Thursday appointment to the afternoon?',
          'Of course — I have 3:30 open. I have moved it and sent a confirmation.',
          'The new prescription is making me drowsy in the mornings.',
          'Thanks for telling me. I have flagged it for the prescriber to review this week.',
        ][i % 4],
      };
    })).slice(0, 5);

    /* 4. Appointments --------------------------------------------- */
    const appts = (RD.appointments || []).filter(a => a.client_id === cid)
      .map(a => ({ ...a, when: _parse(a.date), outcome: apptOutcome(a, today) }))
      .filter(a => a.when)
      .sort((a, b) => a.when - b.when);

    /* 5. Engagement ------------------------------------------------ */
    const past = appts.filter(a => a.when <= today);
    const attended = past.filter(a => a.outcome === 'Attended').length;
    const noShows = past.filter(a => a.outcome === 'No Show').length;
    /* A real recorded result beats a derived one. Only five clients have one
       in the fixture, so the rest fall back to a deterministic trend. */
    const recorded = results.filter(r => r.client_id === cid && r.score != null)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const recordedInstrument = recorded && cat.find(i => i.assessment_id === recorded.assessment_id);
    const tracksProgress = !!recorded || PROGRESS_PROGRAMS.indexOf(client.program) !== -1;
    const scores = tracksProgress
      ? [0, 1, 2].map(i => 14 - i * 2 - (seed(cid + 'sc' + i) % 3)).reverse()
      : null;
    const goalsTotal = 4 + (seed(cid + 'g') % 3);
    const goalsOnTrack = 1 + (seed(cid + 'gt') % goalsTotal);

    /* 6. Timeline -------------------------------------------------- */
    const team = careTeam(cid);
    const timeline = [
      { at: docs[0] && docs[0].at, what: docs[0] ? docs[0].name + ' ' + (docs[0].status === 'Signed' ? 'signed' : 'saved as ' + docs[0].status.toLowerCase()) : null, who: docs[0] && docs[0].by },
      { at: addDays(today, -1), what: 'Contact details updated', who: ME.name },
      { at: addDays(today, -2), what: 'Message from ' + client.shortName, who: client.name },
      { at: addDays(today, -4), what: 'Appointment scheduled', who: sName(team[0] && team[0].id) },
      { at: addDays(today, -6), what: team[0] ? team[0].name + ' assigned as ' + team[0].role : 'Care team updated', who: ME.name },
      { at: addDays(today, -9), what: 'Consent captured — Notice of Privacy Practices', who: ME.name },
      { at: addDays(today, -13), what: 'Program enrollment confirmed — ' + client.program, who: ME.name },
    ].filter(t => t.at && t.what);

    return { attention, docs, msgs, appts, past, attended, noShows, tracksProgress, scores, recorded, recordedInstrument, goalsTotal, goalsOnTrack, timeline };
  }, [client.client_id]);
}

/* ---- Month calendar ---------------------------------------------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function ApptCalendar({ appts }) {
  const [cursor, setCursor] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();

  const byDay = {};
  appts.forEach(a => {
    if (a.when.getFullYear() === year && a.when.getMonth() === month) {
      (byDay[a.when.getDate()] = byDay[a.when.getDate()] || []).push(a);
    }
  });
  const monthAppts = appts.filter(a => a.when.getFullYear() === year && a.when.getMonth() === month);
  const missed = monthAppts.filter(a => a.outcome === 'No Show');

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = d => d && year === TODAY.getFullYear() && month === TODAY.getMonth() && d === TODAY.getDate();
  const step = n => setCursor(new Date(year, month + n, 1));

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" aria-label="Previous month" onClick={() => step(-1)}><Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
        <span className="cal-title">{MONTHS[month]} {year}</span>
        <button className="icon-btn" aria-label="Next month" onClick={() => step(1)}><Icon name="chevronRight" size={16} /></button>
        <span className="spacer" />
        <span className="cal-count">{monthAppts.length} appointment{monthAppts.length === 1 ? '' : 's'}</span>
      </div>
      <div className="cal-grid" role="grid">
        {DOW.map((d, i) => <div key={'h' + i} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          const list = d ? (byDay[d] || []) : [];
          const miss = list.some(a => a.outcome === 'No Show');
          return (
            <div key={i} className={'cal-cell' + (!d ? ' empty' : '') + (isToday(d) ? ' today' : '')}
              title={list.length ? list.map(a => (a.start_time || '') + ' ' + (a.title || a.type)).join('\n') : undefined}>
              {d && <span className="cal-day">{d}</span>}
              {list.length > 0 && (
                <span className="cal-marks">
                  {list.slice(0, 3).map((a, j) => <span key={j} className={'cal-dot' + (a.outcome === 'No Show' ? ' miss' : '')} />)}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
                </span>
              )}
              {miss && <span className="sr-only">Missed appointment</span>}
            </div>
          );
        })}
      </div>
      {missed.length > 0 && (
        <div className="cal-missed">
          {missed.length} missed appointment{missed.length === 1 ? '' : 's'} this month
          <span> — {missed.map(a => fmtDate(a.when)).join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function ClientSummary({ client, onOpenTab }) {
  const d = useClientSummaryData(client);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const docs = showAllDocs ? d.docs : d.docs.slice(0, 4);
  const rate = d.past.length ? Math.round((d.attended / d.past.length) * 100) : null;

  return (
    <div className="cs">
      <div className="cs-main">
        {/* 1. What needs doing. Hidden entirely when there is nothing — an
            empty "all clear" card is just another thing to read past. */}
        {d.attention.length > 0 && (
          <Panel title={`Needs Attention (${d.attention.length})`}>
            <ul className="cs-attn">
              {d.attention.map((a, i) => (
                <li key={i} className={a.overdue ? 'is-overdue' : ''}>
                  <span className="cs-attn-label">{a.label}</span>
                  <span className="cs-attn-detail">{a.detail}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {/* Care-team notes about this client — the same thread as the header's
            Client Notes overlay, so read state is shared. */}
        <ClientNotesPanel client={client} />

        <div className="cs-pair">
          {/* 2. What has been done */}
          <Panel title="Recent Documentation"
            action={d.docs.length > 4 ? <button className="lnk" onClick={() => setShowAllDocs(s => !s)}>{showAllDocs ? 'Show less' : 'Show all'}</button> : null}>
            <ul className="cs-docs">
              {docs.map(doc => (
                <li key={doc.id}>
                  <span className="cs-doc-main">
                    <span className="cs-doc-name">{doc.name}</span>
                    <span className="cs-doc-meta">{doc.kind} · {doc.by} · {fmtDate(doc.at)}</span>
                  </span>
                  <span className={'cs-doc-status' + (doc.status === 'Signed' ? '' : ' pending')}>{doc.status}</span>
                </li>
              ))}
              {!docs.length && <div className="ov-empty">Nothing documented yet.</div>}
            </ul>
          </Panel>

          {/* 3. What the client said */}
          <Panel title="Messages">
            <div className="cs-msgs">
              {d.msgs.map(m => {
                const fromClient = m.sender_type === 'client';
                return (
                  <div key={m.message_id} className={'cs-msg' + (fromClient ? ' in' : '')}>
                    <div className="cs-msg-who">{fromClient ? client.shortName : sName(m.sender_id)}<span>{fmtDate(m.timestamp)}</span></div>
                    <div className="cs-msg-body">{m.body}</div>
                  </div>
                );
              })}
              {!d.msgs.length && <div className="ov-empty">No correspondence.</div>}
            </div>
            <div className="msgr-composer cs-composer">
              <input placeholder={'Message ' + client.shortName + '...'} aria-label={'Message ' + client.shortName} />
              <Button size="sm" variant="primary">Send</Button>
            </div>
          </Panel>
        </div>

        {/* 4. When they are in */}
        <Panel title="Appointments"><ApptCalendar appts={d.appts} /></Panel>

        {/* 5. How they are tracking */}
        <Panel title="Engagement and Progress">
          <div className="cs-metrics">
            <div className="cs-metric">
              <span className="cs-metric-val">{rate === null ? '—' : rate + '%'}</span>
              <span className="cs-metric-label">Attendance</span>
              <span className="cs-metric-sub">{d.attended} of {d.past.length} kept{d.noShows ? ' · ' + d.noShows + ' missed' : ''}</span>
            </div>
            <div className="cs-metric">
              <span className="cs-metric-val">{d.goalsOnTrack}/{d.goalsTotal}</span>
              <span className="cs-metric-label">Service plan goals on track</span>
              <span className="cs-metric-sub">{client.program}</span>
            </div>
            {d.recorded ? (
              <div className="cs-metric">
                <span className="cs-metric-val">{d.recorded.score}</span>
                <span className="cs-metric-label">{d.recordedInstrument ? d.recordedInstrument.name : 'Assessment'}</span>
                <span className="cs-metric-sub">{d.recorded.interpretation} · {fmtDate(d.recorded.date)}</span>
              </div>
            ) : d.tracksProgress ? (
              <div className="cs-metric">
                <span className="cs-metric-val">
                  {d.scores[d.scores.length - 1]}
                  <span className={'cs-trend ' + (d.scores[d.scores.length - 1] < d.scores[0] ? 'down' : 'up')}>
                    {d.scores[d.scores.length - 1] < d.scores[0] ? '↓' : '↑'}
                  </span>
                </span>
                <span className="cs-metric-label">Acuity score</span>
                <span className="cs-metric-sub">last three: {d.scores.join(' → ')}{d.scores[d.scores.length - 1] < d.scores[0] ? ' · improving' : ' · worsening'}</span>
              </div>
            ) : (
              <div className="cs-metric cs-metric--muted">
                <span className="cs-metric-val">—</span>
                <span className="cs-metric-label">Acuity score</span>
                <span className="cs-metric-sub">not tracked for {client.program}</span>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* 6. What changed recently */}
      <aside className="cs-rail">
        <Panel title="Activity">
          <ol className="cs-timeline">
            {d.timeline.map((t, i) => (
              <li key={i}>
                <span className="cs-tl-when">{fmtDate(t.at)}</span>
                <span className="cs-tl-what">{t.what}</span>
                <span className="cs-tl-who">{t.who}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </aside>
    </div>
  );
}

/* ---- Chart page -------------------------------------------------- */
function ChartPage({ id, module, config }) {
  const guard = useGuard();
  const [tab, setTab] = useState(() => (module && CLIENT_MODULES[module]) || CHART_HOME_TAB);
  const client = CLIENT_BY_ID[id];
  /* The URL names the module, so a chart reached from the left nav opens on it
     rather than always on the overview. */
  useEffect(() => { if (module && CLIENT_MODULES[module]) setTab(CLIENT_MODULES[module]); }, [module]);
  /* A different client is a fresh chart. Carrying the previous tab across
     would land you in someone else's Discharge Plan because that is where you
     happened to be standing — so every switch resets to the overview. */
  useEffect(() => { setTab((module && CLIENT_MODULES[module]) || CHART_HOME_TAB); }, [id]);
  /* Publish the active tab so the breadcrumb in the app shell can name it, and
     clear it on the way out so a stale tab never trails a different page. */
  const { setChartTab } = guard;
  useEffect(() => { setChartTab(tab); return () => setChartTab(null); }, [tab, setChartTab]);

  /* Deep-link entry: adopt the chart so the banner is never wrong about what is
     on screen. If a *different* client was already in context — someone edited
     the URL, or used the back button — that is a real switch, so intercept it. */
  useEffect(() => {
    if (!client || guard.clientId === id) return;
    /* The router follows `hashchange`, which lands a tick after the state
       update, so this effect gets one more run while the chart is still
       mounted but the URL has already moved on. Re-adopting there would
       silently undo a deliberate "Leave and Clear Client". `navigate` writes
       location.hash synchronously, so the live URL is the honest source. */
    const live = window.location.hash.replace(/^#/, '') || '/';
    if (live.indexOf('/chart/' + id) !== 0) return;
    if (guard.clientId == null) guard.adopt(id);
    else guard.request({ to: '/chart/' + id, client: id, onCancel: () => guard.go('/chart/' + guard.clientId, { client: guard.clientId }) });
  }, [id, client, guard.clientId]);

  if (!client) return (
    <div className="page"><h1 className="page-title">Chart not found</h1>
      <p className="page-sub">No client matches <code>{id}</code>.</p>
      <Button variant="secondary" onClick={() => guard.go('/clients')}>Back to All Clients</Button></div>
  );

  const v = client.vitals;
  const switchTab = t => {
    if (t === tab) return;
    /* Changing the note you are on is a context change too — it goes through
       the same guard, so unsaved work is intercepted. */
    guard.request({ client: id, onCommit: () => setTab(t) });
  };

  return (
    <div className="page">
      {/* Breadcrumbs and the client header are chrome now, not page content —
          `ChartChrome` in the app shell renders them at full width above this,
          per artboard 4433:94068. The hand-rolled `.clinical-strip` that used
          to sit here is gone: the header carries the DS one. */}
      {/* Never wraps: overflow goes to a More menu, per the DS tabs docs. */}
      <TabStrip className="chart-tabs" tabs={CHART_TABS} active={tab} onSelect={switchTab} />

      {tab === CHART_HOME_TAB
        ? <ClientSummary client={client} onOpenTab={switchTab} />
        : tab === 'Discharge Plan'
        ? <DischargePlan client={client} config={config} onOpenModule={switchTab} />
        : <Panel title={tab}>
            <div className="stub"><Icon name="info" size={20} />
              <div>{tab} is out of scope for this prototype. It is here so you can try switching notes with unsaved work in the Discharge Plan.</div>
            </div>
          </Panel>}
    </div>
  );
}
