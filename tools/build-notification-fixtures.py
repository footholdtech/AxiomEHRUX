#!/usr/bin/env python3
"""Generate the notification-center fixture (100% fictional).

    python3 tools/build-notification-fixtures.py   # then tools/build-refdata.py

One file, fixtures/reference-data/notification_center.json, for the
notifications flyout and the All Notifications page. Every row references the
existing synthetic clients (CL-) and staff (ST-); the signed-in user is
ST-2003 (Priya Raman, LCSW). Times are relative to the prototype's "now",
2026-09-22 16:00 (after the last care-team note in client_notes.json).

Each row sits in one of three groups, ordered by urgency rather than data type:

  task     Approvals & Tasks — assigned to me and waiting on me. Always counted
           in the bell; only clears when actioned (signed, returned, delegated…).
  alert    Client Alerts — what I need to know to care for my clients. `urgent`
           rows (hospitalization, crisis call…) are counted until acknowledged
           and carry a follow-up window; the rest are due/expiring items shown
           with an unread dot, never a number.
  general  General & System — reports, announcements, maintenance. Never
           counted; unread dot only.

`source` records where the item lives in production today (tab › sub-tab), so
the mapping from the old notification center is explicit.
"""
import json, os
from datetime import datetime, timedelta

NOW = datetime(2026, 9, 22, 16, 0)
OUT = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'reference-data', 'notification_center.json')

def ago(hours=0, days=0):
    return (NOW - timedelta(hours=hours, days=days)).strftime('%Y-%m-%dT%H:%M:00')

def ahead(days=0, hours=0):
    return (NOW + timedelta(days=days, hours=hours)).strftime('%Y-%m-%dT%H:%M:00')

rows = []
def add(**r):
    r.setdefault('read', False)
    r.setdefault('urgent', False)
    r.setdefault('client_id', None)
    r.setdefault('from_staff_id', None)
    r['notification_id'] = 'NC-%03d' % (len(rows) + 1)
    rows.append(r)

# ---- Approvals & Tasks ----------------------------------------------------
add(category='task', kind='cosign', source='Pending Notifications › Pending Notifications',
    title='Co-sign progress note', detail='Case management progress note, 09/19 home visit.',
    client_id='CL-100235', from_staff_id='ST-2004', created=ago(days=2, hours=3), due=ago(days=-1),
    status='open', locked=True, link='Dynamic Progress Notes')
add(category='task', kind='signature', source='Pending Notifications › Pending Notifications',
    title='Sign treatment plan review', detail='Quarterly review — needs clinician sign-off before billing.',
    client_id='CL-100236', from_staff_id='ST-2006', created=ago(days=5, hours=1), due=ago(days=2),
    status='open', locked=True, link='Treatment Plan')
add(category='task', kind='approval', source='Pending Notifications › Pending Notifications',
    title='Approve crisis prevention plan', detail='Updated safety plan after weekend incident.',
    client_id='CL-100241', from_staff_id='ST-2004', created=ago(hours=20), due=ahead(days=1),
    status='open', locked=True, link='Crisis Prevention Plan')
add(category='task', kind='appt-request', source='Pending Notifications › Pending Patient Requests',
    title='Admission appointment request', detail='Intake requested Wed 09/24, 10:00 AM at Main Campus.',
    client_id='CL-100240', from_staff_id='ST-2009', created=ago(hours=3), due=ahead(days=1),
    status='open', locked=True, slot='Wed 09/24 · 10:00 AM')
add(category='task', kind='message', source='Pending Notifications › Messaging',
    title='Message from David Okafor', detail='Can you confirm Sam’s housing status before Thursday’s medication review?',
    client_id='CL-100239', from_staff_id='ST-2002', created=ago(hours=1, days=0), status='open', locked=False)
add(category='task', kind='shift-change', source='Staff scheduling (new)',
    title='On-call swap request', detail='Miguel Torres asked to swap on-call: Thu 09/25 ↔ Mon 09/29.',
    from_staff_id='ST-2008', created=ago(hours=26), due=ahead(days=2), status='open', locked=True)
add(category='task', kind='lab', source='Pending Notifications › Pending Labs',
    title='Review drug screen result', detail='Urine drug screen collected 09/20 — result ready for review.',
    client_id='CL-100235', from_staff_id='ST-2008', created=ago(hours=6), status='open', locked=True, link='Labs')
add(category='task', kind='referral', source='Pending Notifications › Specialist Referral',
    title='Housing referral accepted', detail='Hope Street Housing accepted the referral — confirm the intake date with the client.',
    client_id='CL-100242', from_staff_id='ST-2005', created=ago(days=1, hours=2), status='open', locked=False)
add(category='task', kind='order', source='Pending Notifications › Internal Orders',
    title='Approve transportation order', detail='Round-trip rides for 4 specialty appointments in October.',
    client_id='CL-100238', from_staff_id='ST-2004', created=ago(days=3), due=ago(days=1), status='open', locked=True)
add(category='task', kind='incomplete', source='Critical Info › Incomplete',
    title='Finish your progress note', detail='Draft started 09/18 — not yet signed.',
    client_id='CL-100234', created=ago(days=4), due=ago(days=1), status='open', locked=True, link='Dynamic Progress Notes')
add(category='task', kind='cosign', source='Pending Notifications › Pending Notifications',
    title='Co-sign psychiatric evaluation', detail='Initial evaluation, routed to Sandra Kim — you’re covering.',
    client_id='CL-100244', from_staff_id='ST-2002', created=ago(days=1, hours=5), due=ahead(days=1),
    status='open', locked=True, delegated_from='ST-2007', link='Psychiatric Evaluation')
# Done on my side; waiting on someone else. Never counted, never in the main
# queue — the "approved but still sitting in my box" failure from research.
add(category='task', kind='approval', source='Pending Notifications › Pending Notifications',
    title='Incident report — step 2 of 3', detail='You approved on 09/20. Waiting on Sandra Kim (Program Director).',
    client_id='CL-100245', from_staff_id='ST-2008', created=ago(days=3), status='waiting', waiting_on='ST-2007', locked=True)
add(category='task', kind='signature', source='Pending Notifications › Pending Notifications',
    title='Discharge summary — QA review', detail='You signed on 09/19. Waiting on Omar Farouk (QA).',
    client_id='CL-100243', created=ago(days=3, hours=4), status='waiting', waiting_on='ST-2010', locked=True)

# ---- Client Alerts: urgent --------------------------------------------------
add(category='alert', urgent=True, kind='hospitalization', source='Pending Notifications › Client Alerts',
    title='Admitted to inpatient psychiatry', detail='Riverside General, admitted 06:40 today. Reported by the regional health information exchange.',
    client_id='CL-100239', created=ago(hours=4, days=0), window_hours=24, status='Action needed', feed='Health information exchange')
add(category='alert', urgent=True, kind='crisis-call', source='Pending Notifications › Client Alerts',
    title='Called the 988 crisis line', detail='Call at 2:10 AM. Counselor recommended next-day follow-up with the care team.',
    client_id='CL-100241', created=ago(hours=9), window_hours=24, status='Action needed', feed='Crisis line partner')
add(category='alert', urgent=True, kind='urgent-appt', source='Pending Notifications › Pending Patient Requests',
    title='Requested an urgent appointment', detail='Portal request: “Feeling panicky and can’t sleep, can someone see me this week?”',
    client_id='CL-100245', created=ago(hours=2), window_hours=24, status='Action needed', feed='Client portal')
add(category='alert', urgent=True, kind='ed-visit', source='Pending Notifications › Client Alerts',
    title='Emergency department visit', detail='Mercy ED, discharged 10:15 PM on 09/21. Reported by the health plan.',
    client_id='CL-100238', created=ago(hours=12), window_hours=48, status='In progress', read=True, feed='Health plan')
add(category='alert', urgent=True, kind='incarceration', source='Pending Notifications › Client Alerts',
    title='Booked into county jail', detail='Booked 09/20. Jail liaison notified; release date unknown.',
    client_id='CL-100237', created=ago(days=2, hours=1), window_hours=72, status='In progress', read=True, feed='County jail liaison')

# ---- Client Alerts: due & expiring (not counted) ---------------------------
add(category='alert', kind='assessment-due', source='Critical Info › Upcoming Items',
    title='CANS expires in 28 days', detail='Last completed 10/20/2025. Reassess before 10/20.',
    client_id='CL-100242', created=ago(hours=5), due=ahead(days=28), link='CANS')
add(category='alert', kind='assessment-expired', source='Critical Info › Overdue Items',
    title='PHQ-9 expired', detail='Last completed 07/09. Due every 60 days for this program.',
    client_id='CL-100235', created=ago(days=1), due=ago(days=15), link='PHQ-9')
add(category='alert', kind='consent-needed', source='Critical Info › Additional Items',
    title='Consent for AI recording needed', detail='Required before an ambient-recorded session.',
    client_id='CL-100240', created=ago(hours=3), link='Consents')
add(category='alert', kind='consent-expiring', source='Critical Info › Upcoming Items',
    title='Release of information expires 10/01', detail='Shared with Riverside General. Renew if coordination continues.',
    client_id='CL-100239', created=ago(days=1, hours=3), due=ahead(days=9), read=True, link='Consents')
add(category='alert', kind='plan-review', source='Critical Info › Upcoming Items',
    title='Treatment plan review due in 6 days', detail='90-day review window closes 09/28.',
    client_id='CL-100244', created=ago(days=2), due=ahead(days=6), link='Treatment Plan')
add(category='alert', kind='note-gap', source='Critical Info › Overdue Items',
    title='No progress note in 31 days', detail='Last note 08/22. Program standard is one contact every 30 days.',
    client_id='CL-100243', created=ago(days=1, hours=6), due=ago(days=1), link='Dynamic Progress Notes')
add(category='alert', kind='follow-up', source='Critical Info › Follow Up Items',
    title='Appointment outcome not recorded', detail='09/19 appointment still shows “Scheduled”. Record whether it was kept.',
    client_id='CL-100238', created=ago(days=3), read=True)
add(category='alert', kind='assignment', source='Pending Notifications › Client Alerts',
    title='New client assigned to you', detail='Primary clinician, assigned by Heather Douglas.',
    client_id='CL-100240', from_staff_id='ST-2009', created=ago(hours=22))
# Care-team notes are NOT rows here: each unread note about one of my clients
# becomes its own Client Alert at runtime (17-notifications.jsx), sharing read
# state with the Client Notes thread. Aggregating them hid what each one said.

# ---- General & System (never counted) --------------------------------------
add(category='general', kind='report', source='System Notifications › Reports',
    title='Report ready: Caseload Compliance Summary', detail='Completed at 7:00 AM.', status='Completed', created=ago(hours=4))
add(category='general', kind='report', source='System Notifications › Reports',
    title='Report failed: Demographic Primary Residence', detail='The run stopped with an error. Try again or contact support.',
    status='Error', created=ago(days=1, hours=2))
add(category='general', kind='announcement', source='System Notifications › Announcements',
    title='Staff flu clinic Friday', detail='Fri 09/26, 12–3 PM, Main Campus room 104. No appointment needed.',
    from_staff_id='ST-2007', created=ago(days=1, hours=1))
add(category='general', kind='maintenance', source='System Notifications › Announcements',
    title='Scheduled maintenance Saturday night', detail='AxiomEHR will be unavailable Sat 09/27, 10 PM – midnight.',
    created=ago(days=2), read=True)
add(category='general', kind='announcement', source='System Notifications › Announcements',
    title='Updated telehealth consent form', detail='The new form is live for sessions from 10/01. A 10-minute training is in the Learning Center.',
    from_staff_id='ST-2010', created=ago(days=4), read=True)
add(category='general', kind='credential', source='Critical Info › Additional Items',
    title='Your CPR certification expires 10/15', detail='Upload the renewal to your staff profile.',
    created=ago(days=2, hours=4))

doc = {
    '_meta': {
        'description': 'Fictional notification-center items for the signed-in demo user (ST-2003). '
                       'Grouped by urgency (task / alert / general) rather than by data type.',
        'now': NOW.strftime('%Y-%m-%dT%H:%M:00'),
        'fields': ['notification_id', 'category', 'kind', 'urgent', 'source', 'title', 'detail', 'client_id',
                   'from_staff_id', 'created', 'due', 'window_hours', 'status', 'read', 'locked',
                   'delegated_from', 'waiting_on', 'link', 'feed', 'slot', 'notes_count'],
    },
    'records': rows,
}
with open(OUT, 'w') as f:
    json.dump(doc, f, indent=1, ensure_ascii=False)
print('notification_center.json:', len(rows), 'rows')
