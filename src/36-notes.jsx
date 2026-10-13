/* ===== Notes and documents opened on the chart ==========================
   What a notification links to. Three modes, from the link set in
   17-notifications.jsx (NOTE_CTX):

     new      A note started from an alert via "Start Note" (or opened from
              the left nav). Signing it documents the follow-up and closes
              the alert that started it.
     draft    My own unfinished note ("Finish your progress note"). Signing
              clears the task.
     review   A document routed to me — co-sign, sign, approve, a lab result.
              The review happens on the document, not in a dialog.

   Note fields and checklists stand in for agency-configured templates; the
   content of documents under review is fictional.
   ================================================================ */

const NOTE_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
const NOTE_PLACES = ['Clinic office', 'Client’s home', 'Community', 'Hospital', 'Residential site', 'Telehealth', 'Phone'];

function NotePage({ client, doc }) {
  /* Read the link once: it must not change under the clinician mid-note. */
  const [ctx] = useState(() => getNoteCtx(client.client_id, doc));
  return ctx && ctx.mode === 'review'
    ? <DocReview client={client} doc={doc} ctx={ctx} />
    : <NoteEditor client={client} doc={doc} ctx={ctx} />;
}

/* Where to go when a note is finished or abandoned: back to the summary,
   where Needs Attention now shows the alert gone. A raw navigate, because
   the unsaved-work guard has just been cleared on purpose. */
function useBackToSummary(client) {
  const guard = useGuard();
  const navigate = useRawNavigate();
  return () => { guard.clearDirty(); navigate('/chart/' + client.client_id); };
}

/* The banner that ties a note to the notification behind it. */
function NoteLinkBanner({ ctx, kind }) {
  if (!ctx) return null;
  const n = ctx.n, win = n.urgent ? notifWindow(n) : null;
  return (
    <div className="chc-note chc-note--info note-link"><Icon name="bell" size={15} />
      <div>
        <b>{kind === 'review' ? 'Routed to you' : kind === 'draft' ? 'Your draft' : 'Started from a notification'}:</b> {n.title}
        {win ? ' · ' + win.label : ''}.{' '}
        {kind === 'review' ? 'Your decision here clears it from Approvals & Tasks.'
          : kind === 'draft' ? 'Signing it clears it from Approvals & Tasks.'
          : n.urgent ? 'Signing this note documents the follow-up and closes the alert.' : 'Signing this note clears the alert.'}
      </div>
    </div>
  );
}

function NoteEditor({ client, doc, ctx }) {
  const guard = useGuard();
  const back = useBackToSummary(client);
  const draft = ctx && ctx.mode === 'draft';
  const template = NOTE_TEMPLATES[doc] || NOTE_TEMPLATES['Progress Note'];
  const [f, setF] = useState(() => ({
    date: isoOf(TODAY), time: '10:00 AM', contact: '', place: '', minutes: '',
    checks: {}, narrative: draft ? 'Met with ' + client.name.split(' ')[0] + ' for a scheduled session. ' : '', plan: '', attest: false,
  }));
  const [tried, setTried] = useState(false);
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); guard.markDirty(doc); };
  const errs = {
    contact: !f.contact && 'Choose how the contact happened.',
    narrative: !f.narrative.trim() && 'Describe the contact.',
    attest: !f.attest && 'Attest before signing.',
  };
  const e = k => (tried ? errs[k] || null : null);
  const sign = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    if (ctx) {
      if (ctx.n.urgent) setAlertStatus(ctx.n.notification_id, 'Follow-up documented');
      resolveNotif(ctx.n.notification_id, 'note-signed', { doc });
      clearNoteCtx(client.client_id, doc);
    }
    guard.setToast({ icon: 'check', title: doc + ' signed',
      detail: ctx ? (ctx.n.urgent ? 'Follow-up documented — the alert is closed.' : 'Cleared from your notifications.') : 'Added to ' + client.name.split(' ')[0] + '’s chart.' });
    back();
  };
  return (
    <Panel title={doc}>
      <div className="note-page">
        <NoteLinkBanner ctx={ctx} kind={draft ? 'draft' : 'new'} />
        <div className="ovl-grid ovl-grid--4">
          <DateField label="Date of service" required value={f.date} onChange={v => set('date', v)} />
          <Field label="Start time"><Dropdown value={f.time} options={NOTE_TIMES} onChange={v => set('time', v)} /></Field>
          <Field label="Duration"><TextIn value={f.minutes} suffix="min" inputMode="numeric" onChange={v => set('minutes', v.replace(/\D/g, ''))} /></Field>
          <Field label="Location"><Dropdown value={f.place} options={NOTE_PLACES} onChange={v => set('place', v)} /></Field>
        </div>
        <Field label="Contact" required error={e('contact')}>
          <RadioGroup name={'contact-' + slugify(doc)} options={['In person', 'Phone', 'Video', 'Unable to reach']} value={f.contact} onChange={v => set('contact', v)} invalid={!!e('contact')} />
        </Field>
        <Field label={doc + ' checklist'} hint="From your agency’s template for this note.">
          <div className="ovl-checks ovl-checks--col">
            {template.map(t => <Checkbox key={t} label={t} checked={!!f.checks[t]} onChange={v => set('checks', { ...f.checks, [t]: v })} />)}
          </div>
        </Field>
        <Field label="Narrative" required error={e('narrative')} wide>
          <TextArea value={f.narrative} onChange={v => set('narrative', v)} rows={5} invalid={!!e('narrative')} placeholder="What happened in this contact, and how is the client now?" />
        </Field>
        <Field label="Plan and next steps" wide><TextArea value={f.plan} onChange={v => set('plan', v)} rows={2} /></Field>
        <div className={'ovl-attest' + (e('attest') ? ' is-missing' : '')}>
          <Checkbox checked={f.attest} onChange={v => set('attest', v)} label="I attest that this note is accurate and complete." />
        </div>
        <div className="note-foot">
          <Button variant="ghost" onClick={back}>Cancel</Button>
          <span className="spacer" />
          <Button variant="secondary" onClick={() => { guard.clearDirty(); guard.setToast({ icon: 'check', title: 'Draft saved', detail: ctx ? 'The notification stays open until the note is signed.' : 'Not filed to the chart yet.' }); }}>Save Draft</Button>
          <Button variant="primary" onClick={sign}>Sign Note</Button>
        </div>
      </div>
    </Panel>
  );
}

/* Fictional document content for review, by document type. */
function reviewBody(doc, n, client) {
  const first = client.name.split(' ')[0];
  if (doc === 'Laboratory') return { table: [['Urine drug screen (12-panel)', 'Negative, all panels', 'Collected 09/20 · Main Campus lab']] };
  if (doc === 'Service Plan') return { sections: [['Goals', 'Reduce depressive symptoms (PHQ-9 under 10) · Keep stable housing · Attend 3 of 4 monthly sessions'],
    ['Progress this quarter', first + ' attended 10 of 12 sessions and reports better sleep. Housing remains stable.'], ['Changes proposed', n.detail]] };
  if (doc === 'Crisis Prevention Plan') return { sections: [['Warning signs', 'Isolating, skipping meals, not answering calls'],
    ['Coping steps', 'Walk with a peer, call sister, use the grounding exercise card'], ['Who to contact', 'Care manager by day; 988 after hours'], ['What changed', n.detail]] };
  if (doc === 'Psychiatric Evaluation') return { sections: [['Reason for evaluation', 'Initial evaluation at intake'],
    ['Assessment', 'Presentation consistent with the working diagnosis on the problem list. No acute safety concerns at the time of evaluation.'], ['Recommendations', 'Continue therapy weekly; medication review in 4 weeks.']] };
  return { sections: [['Summary', n.detail], ['Contact', 'Home visit, 45 minutes. ' + first + ' was engaged and reviewed upcoming appointments.'],
    ['Plan', 'Follow up next week; confirm transportation for the specialty appointment.']] };
}

function DocReview({ client, doc, ctx }) {
  const guard = useGuard();
  const back = useBackToSummary(client);
  const n = ctx.n;
  const A = TASK_ACTIONS[n.kind] || {};
  const verb = { cosign: 'Co-sign', signature: 'Sign', approval: 'Approve', lab: 'Acknowledge Result' }[n.kind] || 'Complete';
  const status = { cosign: 'Awaiting your co-signature', signature: 'Awaiting your signature', approval: 'Awaiting your approval', lab: 'Result ready for your review' }[n.kind] || 'Waiting on you';
  const signs = n.kind === 'cosign' || n.kind === 'signature';
  const [attest, setAttest] = useState(false);
  const [returning, setReturning] = useState(false);
  const body = reviewBody(doc, n, client);
  const finish = (action, title, detail) => {
    resolveNotif(n.notification_id, action, { doc });
    clearNoteCtx(client.client_id, doc);
    guard.setToast({ icon: 'check', title, detail });
    back();
  };
  return (
    <Panel title={doc}>
      <div className="note-page">
        <NoteLinkBanner ctx={ctx} kind="review" />
        <div className="ovl-facts">
          <div><span>Author</span>{n.from_staff_id ? sName(n.from_staff_id) : '—'}</div>
          <div><span>Date</span>{fmtDate(n.created)}</div>
          <div><span>Program</span>{client.program || '—'}</div>
          <div><span>Status</span>{status}</div>
        </div>
        <article className="doc-body">
          {body.table ? (
            <table className="data-table compact">
              <thead><tr><th>Test</th><th>Result</th><th>Specimen</th></tr></thead>
              <tbody>{body.table.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          ) : body.sections.map(([h, t]) => (
            <section key={h} className="doc-sec"><h3>{h}</h3><p>{t}</p></section>
          ))}
        </article>
        {signs && <div className="ovl-attest"><Checkbox checked={attest} onChange={setAttest} label="I’ve reviewed this document and attest that it is accurate." /></div>}
        <div className="note-foot">
          {n.kind !== 'lab' && <Button variant="ghost" onClick={() => setReturning(true)}>Return for Edits</Button>}
          <span className="spacer" />
          <Button variant="secondary" onClick={back}>Back to Summary</Button>
          <Button variant="primary" disabled={signs && !attest} onClick={() => finish(n.kind, A.verb, 'Cleared from Approvals & Tasks.')}>{verb}</Button>
        </div>
      </div>
      {returning && (
        <ReasonOverlay n={n} client={client} title="Return for Edits" ask="What needs to change?"
          reasons={['Missing information', 'Incorrect service or code', 'Clinical content needs revision', 'Wrong client or date', 'Other']}
          cta="Send Back" onClose={() => setReturning(false)}
          onDone={r => finish('returned', 'Returned for edits', 'Sent back to ' + (n.from_staff_id ? sName(n.from_staff_id) : 'the author') + ' · ' + r)} />
      )}
    </Panel>
  );
}
