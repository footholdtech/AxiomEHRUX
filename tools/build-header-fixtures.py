#!/usr/bin/env python3
"""Generate the per-client tables behind the client header's clinical quick views.

Extends the shared synthetic EHR reference dataset (ehr-synthetic-data skill)
with what the seed doesn't ship but the header needs to match production:

  formulary_additions.json      extra formulary rows + controlled-substance schedules
  medication_history.json       current / expired / discontinued medications per client
  immunizations.json            vaccine records
  injections.json               long-acting injectables and other injections
  vitals_history.json           several readings per client (seed has one)
  assessment_forms.json         instrument definitions: items, response scales, bands
  assessment_administrations.json  scored administrations with item-level responses
  client_notes.json             care-team notes about a client, with read state

100% fictional. Every client_id / staff_id already exists in the seed; only the
rows are new. Deterministic (fixed hash), so re-running gives byte-identical
output and every teammate sees the same chart. Drug and vaccine names are real
public product names; nothing here is client-linked real-world data.

Assessment item wording is ABBREVIATED for the prototype. A production build
must use each instrument's validated wording and licensing terms.

Run before tools/build-refdata.py.
"""
import json, pathlib, datetime as dt

HERE = pathlib.Path(__file__).resolve().parent
RD = HERE.parent / "fixtures" / "reference-data"
load = lambda n: json.loads((RD / n).read_text())["records"]
clients, staff, meds, rx_seed, vit_seed = (load("clients.json"), load("staff.json"),
    load("medications.json"), load("prescriptions.json"), load("vitals.json"))
msgs = load("messages_staff_to_staff.json")

TODAY = dt.date(2026, 9, 22)          # the app pins "today" to the same date

def seed(s):                           # FNV-1a, same hash as the app
    h = 2166136261
    for ch in str(s):
        h ^= ord(ch); h = (h * 16777619) & 0xFFFFFFFF
    return h

def pick(arr, key, n):
    out, used, x = [], set(), seed(key) or 1
    for _ in range(min(n, len(arr)) * 12):
        if len(out) == min(n, len(arr)): break
        x = ((x * 1103515245) + 12345) & 0xFFFFFFFF
        i = x % len(arr)
        if i not in used: used.add(i); out.append(arr[i])
    return out

iso = lambda d: d.isoformat()
ago = lambda days: TODAY - dt.timedelta(days=days)
age = lambda dob: (TODAY - dt.date.fromisoformat(dob)).days // 365

def write(name, description, fields, records):
    (RD / name).write_text(json.dumps(
        {"_meta": {"description": description, "fictional": True, "fields": fields},
         "records": records}, indent=2) + "\n")
    print(f"{name}: {len(records)} records")

# ---- Formulary + schedules ------------------------------------------------
ADDITIONS = [
    ("MED-011", "Buprenorphine/Naloxone (Suboxone)", ["2 mg/0.5 mg", "8 mg/2 mg"], "Partial Opioid Agonist", "Opioid use disorder", "C-III"),
    ("MED-012", "Lorazepam (Ativan)", ["0.5 mg", "1 mg"], "Benzodiazepine", "Acute anxiety", "C-IV"),
    ("MED-013", "Methylphenidate (Ritalin)", ["10 mg", "20 mg"], "Stimulant", "ADHD", "C-II"),
    ("MED-014", "Prazosin", ["1 mg", "2 mg"], "Alpha-1 Blocker", "Trauma-related nightmares", None),
    ("MED-015", "Hydroxyzine", ["25 mg", "50 mg"], "Antihistamine", "Anxiety / sleep", None),
    ("MED-016", "Clonidine", ["0.1 mg", "0.2 mg"], "Alpha-2 Agonist", "Withdrawal symptoms / ADHD", None),
    ("MED-017", "Gabapentin", ["100 mg", "300 mg"], "Anticonvulsant", "Anxiety / neuropathic pain", None),
]
SCHEDULE = {"MED-001": "C-II"}
SCHEDULE.update({a[0]: a[5] for a in ADDITIONS if a[5]})
formulary = meds + [{"medication_id": a[0], "name": a[1], "strengths": a[2], "class": a[3], "common_use": a[4]} for a in ADDITIONS]
write("formulary_additions.json",
      "Formulary rows added to medications.json for the medication quick view, plus a "
      "controlled-substance schedule for every formulary row that has one (null = not controlled).",
      ["medication_id", "name", "strengths", "class", "common_use", "schedule"],
      [{"medication_id": a[0], "name": a[1], "strengths": a[2], "class": a[3], "common_use": a[4], "schedule": a[5]} for a in ADDITIONS]
      + [{"medication_id": m["medication_id"], "schedule": SCHEDULE.get(m["medication_id"])} for m in meds])
med_by = {m["medication_id"]: m for m in formulary}

# ---- Medication history ---------------------------------------------------
PRESCRIBERS = ["ST-2002", "ST-2001"]
PHARMACIES = ["Northside Community Pharmacy", "Riverton Rx", "Maple Grove Pharmacy", "Clinic Dispensary"]
SIGS = ["Take 1 tablet by mouth daily", "Take 1 tablet by mouth twice daily", "Take 1 tablet by mouth at bedtime",
        "Take 1 tablet by mouth every 8 hours as needed", "Take 1 tablet by mouth every morning"]
DC_REASONS = ["Adverse effect", "Ineffective", "Client request", "Changed to alternative", "Course completed"]

PINNED_MEDS = {   # demo client: residential SUD + PTSD — a clinically coherent list
    "CL-100235": [
        ("MED-010", "50 mg", "Take 1 tablet by mouth daily", "Active", 120, None),
        ("MED-011", "8 mg/2 mg", "Dissolve 1 film under the tongue daily", "Active", 60, None),
        ("MED-007", "50 mg", "Take 1 tablet by mouth at bedtime as needed for sleep", "Active", 75, None),
        ("MED-014", "1 mg", "Take 1 capsule by mouth at bedtime", "Active", 40, None),
        ("MED-003", "50 mg", "Take 1 tablet by mouth daily", "Discontinued", 240, "Adverse effect"),
        ("MED-012", "0.5 mg", "Take 1 tablet by mouth every 8 hours as needed for anxiety", "Expired", 300, None),
        ("MED-016", "0.1 mg", "Take 1 tablet by mouth every 6 hours as needed for withdrawal", "Expired", 380, None),
    ]
}

med_rows, n = [], 1
def add_med(cid, mid, strength, sig, status, started_days_ago, dc_reason, prescriber=None, pharmacy=None, rx_status=None):
    global n
    m = med_by[mid]; sched = SCHEDULE.get(mid); s = seed(cid + mid + strength)
    start = ago(started_days_ago); days = 30 if sched else (30, 60, 90)[s % 3]
    end = start + dt.timedelta(days=days * (1 + s % 3))
    if status == "Active" and end < TODAY: end = TODAY + dt.timedelta(days=5 + s % 40)
    if status == "Expired" and end >= TODAY: end = TODAY - dt.timedelta(days=10 + s % 60)
    authorized = 0 if sched == "C-II" else (s % 4 if sched else 1 + s % 5)
    med_rows.append({
        "med_rx_id": "MRX-%04d" % n, "client_id": cid, "medication_id": mid,
        "medication_display": f"{m['name']} {strength}", "strength": strength, "form": "Tablet",
        "drug_class": m["class"], "schedule": sched, "sig": sig, "qty": days if "twice" not in sig else days * 2,
        "days_supply": days, "refills_authorized": authorized,
        "refills_remaining": 0 if status != "Active" else min(authorized, s % (authorized + 1)),
        "prescriber_staff_id": prescriber or PRESCRIBERS[s % 2],
        "pharmacy": pharmacy or PHARMACIES[s % len(PHARMACIES)],
        "start_date": iso(start), "end_date": iso(end),
        "last_filled": iso(min(TODAY, start + dt.timedelta(days=(s % 3) * days))),
        "status": status, "rx_status": rx_status or ("E-PRESCRIBED" if status == "Active" else status.upper()),
        "discontinued_date": iso(start + dt.timedelta(days=20 + s % 40)) if status == "Discontinued" else None,
        "discontinued_reason": dc_reason if status == "Discontinued" else None,
    })
    n += 1

for c in clients:
    cid = c["client_id"]
    if cid in PINNED_MEDS:
        for row in PINNED_MEDS[cid]: add_med(cid, *row)
        continue
    for r in rx_seed:    # carry the seed's prescriptions over so both tables agree
        if r["client_id"] != cid: continue
        st = "Expired" if r["rx_type"] == "Expired" else "Active"
        add_med(cid, r["medication_id"], r["medication_display"].split(" ", 1)[-1].split()[-2] + " mg"
                if r["medication_display"].endswith("mg") else med_by[r["medication_id"]]["strengths"][0],
                r["sig"], st, (TODAY - dt.date.fromisoformat(r["start_date"])).days, None,
                prescriber=r["prescriber_staff_id"], rx_status=r["rx_status"])
    have = {r["medication_id"] for r in med_rows if r["client_id"] == cid}
    for i, m in enumerate(pick(formulary, cid + "meds", 3 + seed(cid + "mc") % 4)):
        if m["medication_id"] in have: continue
        s = seed(cid + m["medication_id"])
        status = ("Active", "Active", "Expired", "Discontinued")[s % 4]
        add_med(cid, m["medication_id"], m["strengths"][s % len(m["strengths"])], SIGS[s % len(SIGS)],
                status, 30 + s % 400, DC_REASONS[s % len(DC_REASONS)])
write("medication_history.json",
      "Per-client medication list for the header's Medications quick view — Active, Expired and "
      "Discontinued — with controlled-substance schedule and refill counts. Includes every row "
      "of prescriptions.json, so the two never disagree.",
      list(med_rows[0].keys()), med_rows)

# ---- Immunizations --------------------------------------------------------
VACCINES = [("Influenza (2025–26)", 1, "Deltoid IM"), ("COVID-19 (2025–26)", 1, "Deltoid IM"),
            ("Tdap", 1, "Deltoid IM"), ("Hepatitis A", 2, "Deltoid IM"), ("Hepatitis B", 3, "Deltoid IM"),
            ("Pneumococcal (PCV20)", 1, "Deltoid IM"), ("HPV", 2, "Deltoid IM"), ("Zoster (recombinant)", 2, "Deltoid IM")]
imm, n = [], 1
for c in clients:
    cid, a = c["client_id"], age(c["dob"])
    pool = [v for v in VACCINES if not (v[0] == "HPV" and a > 26) and not (v[0].startswith("Zoster") and a < 50)]
    for v in pick(pool, cid + "imm", 3 + seed(cid + "ic") % 3):
        s = seed(cid + v[0]); status = ("Administered", "Administered", "Administered", "Historical", "Declined")[s % 5]
        imm.append({"immunization_id": "IMM-%04d" % n, "client_id": cid, "vaccine": v[0],
                    "dose": f"{1 + s % v[1]} of {v[1]}" if v[1] > 1 else "1 of 1",
                    "date": iso(ago(20 + s % 700)), "site_route": v[2] if status == "Administered" else None,
                    "lot": ("LOT-%s%03d" % (v[0][:3].upper(), s % 1000)) if status == "Administered" else None,
                    "administered_by_staff_id": "ST-2008" if status == "Administered" else None,
                    "status": status, "source": "Reported by client" if status == "Historical" else None})
        n += 1
write("immunizations.json", "Per-client immunization records. Lot numbers are fictional.",
      list(imm[0].keys()), imm)

# ---- Injections -----------------------------------------------------------
INJECTABLES = [("Aripiprazole ER (Abilify Maintena)", "400 mg", 28, None), ("Paliperidone palmitate (Invega Sustenna)", "156 mg", 28, None),
               ("Naltrexone ER (Vivitrol)", "380 mg", 28, None), ("Haloperidol decanoate", "100 mg", 28, None),
               ("Buprenorphine ER (Sublocade)", "300 mg", 28, "C-III"), ("Cyanocobalamin (Vitamin B12)", "1000 mcg", 30, None)]
SITES = ["Left deltoid", "Right deltoid", "Left gluteal", "Right gluteal", "Abdomen (subcutaneous)"]
inj, n = [], 1
for c in clients:
    cid = c["client_id"]
    chosen = [INJECTABLES[2]] if cid == "CL-100235" else (pick(INJECTABLES, cid + "inj", 1) if seed(cid + "hasinj") % 2 else [])
    for name, dose, every, sched in chosen:
        k = 4 + seed(cid + name) % 4
        for j in range(k):     # most recent first; the latest dose's next-due may be overdue
            given = ago(3 + (seed(cid + name + "o") % 30) + j * every)
            inj.append({"injection_id": "INJ-%04d" % n, "client_id": cid, "medication": name, "dose": dose,
                        "schedule": sched, "date_given": iso(given), "next_due": iso(given + dt.timedelta(days=every)) if j == 0 else None,
                        "interval_days": every, "site": SITES[(seed(cid) + j) % len(SITES)],
                        "given_by_staff_id": "ST-2008", "lot": "LOT-INJ%04d" % (seed(cid + str(j)) % 10000)})
            n += 1
write("injections.json", "Per-client injection administrations (long-acting injectables and others). "
      "next_due is set on the most recent dose only.", list(inj[0].keys()), inj)

# ---- Vitals history ---------------------------------------------------------
vit, n = [], 1
for c in clients:
    cid = c["client_id"]
    base = next((v for v in vit_seed if v["client_id"] == cid), None)
    s0 = seed(cid + "v"); h = base["height_in"] if base else 60 + s0 % 14; w = base["weight_lbs"] if base else 125 + s0 % 90
    for j in range(3 + s0 % 3):
        s = seed(cid + "v" + str(j)); wt = w - j * (s % 4) + (s % 3)
        vit.append({"vitals_id": "VH-%04d" % n, "client_id": cid, "recorded_by_staff_id": "ST-2008",
                    "date_time": (base["date_time"][:10] if (base and j == 0) else iso(ago(40 + j * 45 + s % 20))) + "T09:%02d:00" % (s % 60),
                    "height_in": h, "weight_lbs": wt, "bmi": round(wt * 703 / (h * h), 1),
                    "temp_f": round(97.8 + (s % 14) / 10, 1), "pulse_bpm": 62 + s % 30, "resp_rate": 14 + s % 5,
                    "bp_systolic": 108 + s % 38, "bp_diastolic": 68 + s % 22, "o2_sat_pct": 95 + s % 5, "pain_scale": s % 4})
        n += 1
write("vitals_history.json", "Several vitals readings per client, most recent first. The first row per client "
      "matches vitals.json where the seed has one.", list(vit[0].keys()), vit)

# ---- Assessment forms (abbreviated wording) -------------------------------
FREQ4 = [["Not at all", 0], ["Several days", 1], ["More than half the days", 2], ["Nearly every day", 3]]
PCL = [["Not at all", 0], ["A little bit", 1], ["Moderately", 2], ["Quite a bit", 3], ["Extremely", 4]]
YN = [["No", 0], ["Yes", 1]]
AIMS_SCALE = [["None", 0], ["Minimal", 1], ["Mild", 2], ["Moderate", 3], ["Severe", 4]]
AUD_FREQ = [["Never", 0], ["Less than monthly", 1], ["Monthly", 2], ["Weekly", 3], ["Daily or almost daily", 4]]
SDOH_RISK = [["No", 0], ["Yes", 1]]
FORMS = [
    {"form_id": "PHQ9", "name": "PHQ-9", "full_name": "Patient Health Questionnaire-9", "module": "PHQ",
     "prompt": "Over the last 2 weeks, how often have you been bothered by…", "scale": FREQ4,
     "items": ["Little interest or pleasure in activities", "Feeling down or hopeless", "Trouble with sleep",
               "Feeling tired or low energy", "Poor appetite or overeating", "Feeling bad about yourself",
               "Trouble concentrating", "Moving or speaking unusually slowly, or restless",
               "Thoughts of self-harm or being better off dead"],
     "bands": [[0, "Minimal"], [5, "Mild"], [10, "Moderate"], [15, "Moderately severe"], [20, "Severe"]],
     "flag_item": 9},
    {"form_id": "PCL5", "name": "PCL-5", "full_name": "PTSD Checklist for DSM-5", "module": "PCL5",
     "prompt": "In the past month, how much were you bothered by…", "scale": PCL,
     "items": ["Repeated disturbing memories", "Repeated disturbing dreams", "Feeling as if it were happening again",
               "Feeling upset when reminded", "Strong physical reactions to reminders", "Avoiding memories or feelings",
               "Avoiding external reminders", "Trouble remembering parts of it", "Strong negative beliefs",
               "Blaming self or others", "Strong negative feelings", "Loss of interest in activities",
               "Feeling distant from others", "Trouble feeling positive emotions", "Irritability or angry outbursts",
               "Taking risks or self-destructive behavior", "Being superalert or on guard", "Feeling jumpy or easily startled",
               "Difficulty concentrating", "Trouble falling or staying asleep"],
     "bands": [[0, "Below threshold"], [33, "Probable PTSD"]]},
    {"form_id": "ACE", "name": "ACE", "full_name": "Adverse Childhood Experiences", "module": "ACE",
     "prompt": "Before your 18th birthday…", "scale": YN,
     "items": ["Emotional abuse by a parent or adult", "Physical abuse by a parent or adult", "Sexual abuse",
               "Felt unloved or unsupported by family", "Neglect of basic needs", "Parents separated or divorced",
               "Witnessed violence against a parent", "Lived with someone who misused alcohol or drugs",
               "Household member with mental illness", "Household member incarcerated"],
     "bands": [[0, "No ACEs reported"], [1, "1–3 ACEs"], [4, "High (4 or more)"]]},
    {"form_id": "PCPTSD5", "name": "PC-PTSD-5", "full_name": "Primary Care PTSD Screen for DSM-5", "module": "PC-PTSD",
     "prompt": "In the past month, have you…", "scale": YN,
     "items": ["Had nightmares or unwanted thoughts about it", "Tried hard not to think about it or avoided reminders",
               "Been constantly on guard or easily startled", "Felt numb or detached", "Felt guilty or unable to stop blaming yourself"],
     "bands": [[0, "Negative screen"], [3, "Positive screen"]]},
    {"form_id": "AUDIT", "name": "AUDIT", "full_name": "Alcohol Use Disorders Identification Test", "module": "AUDIT",
     "prompt": "Thinking about the past year…", "scale": AUD_FREQ,
     "items": ["How often you have a drink containing alcohol", "Drinks on a typical drinking day (scored 0–4)",
               "How often 6 or more drinks on one occasion", "Unable to stop once started", "Failed to do what was expected",
               "Needed a drink in the morning", "Felt guilt or remorse after drinking", "Unable to remember the night before",
               "You or someone else injured because of drinking (scored 0, 2, 4)", "Others concerned about your drinking (scored 0, 2, 4)"],
     "bands": [[0, "Low risk"], [8, "Hazardous"], [16, "Harmful"], [20, "Possible dependence"]]},
    {"form_id": "AIMS", "name": "AIMS", "full_name": "Abnormal Involuntary Movement Scale", "module": "AIMS",
     "prompt": "Rate the highest severity observed in each area…", "scale": AIMS_SCALE,
     "items": ["Muscles of facial expression", "Lips and perioral area", "Jaw", "Tongue",
               "Upper extremities", "Lower extremities", "Neck, shoulders and hips"],
     "bands": [[0, "No significant movements"], [2, "Possible — review"], [6, "Probable — review"]]},
    {"form_id": "SDOH", "name": "SDOH", "full_name": "Social Determinants of Health Screen", "module": "SDOH",
     "prompt": "In the past 12 months…", "scale": SDOH_RISK,
     "items": ["Worried about losing housing", "Ran out of food before having money for more", "Lacked transportation to appointments",
               "Utilities shut off or threatened", "Felt unsafe where you live", "Felt lonely or isolated most of the time",
               "Unemployed and seeking work", "Trouble paying for medicine or care"],
     "bands": [[0, "No needs identified"], [1, "Some needs"], [3, "Multiple needs"]]},
]
write("assessment_forms.json", "Instrument definitions for the header's assessment quick views. Item wording "
      "is ABBREVIATED for prototyping; production must use each instrument's validated wording and licensing terms.",
      ["form_id", "name", "full_name", "module", "prompt", "scale", "items", "bands", "flag_item"], FORMS)

def band(form, score):
    out = form["bands"][0][1]
    for lo, label in form["bands"]:
        if score >= lo: out = label
    return out

adm, n = [], 1
for c in clients:
    cid = c["client_id"]
    for f in FORMS:
        s0 = seed(cid + f["form_id"])
        if cid != "CL-100235" and s0 % 3 == 0: continue          # not every client has every instrument
        sev = (s0 % 100) / 100                                   # 0..1 baseline severity
        if cid == "CL-100235" and f["form_id"] in ("PCL5", "AUDIT", "PHQ9"): sev = 0.62
        if f["form_id"] == "AIMS": sev *= 0.3                     # movement findings are uncommon
        top = f["scale"][-1][1]
        runs = 1 if f["form_id"] == "ACE" else 1 + s0 % 3         # ACE is typically given once
        for j in range(runs):                               # 1–3 administrations, most recent first
            level = max(0.0, sev - 0.12 * (2 - j) + 0.0)          # older ones a little worse = improving
            resp = []
            for i in range(len(f["items"])):
                r = seed(cid + f["form_id"] + str(j) + str(i)) % 100 / 100
                v = int(round(level * top + (r - 0.5) * top * 0.6))
                v = max(0, min(top, v))
                if f["form_id"] == "AUDIT" and i >= 8: v = (0, 2, 4)[min(2, v // 2)]
                resp.append(v)
            if f["form_id"] == "PHQ9" and resp[8] and seed(cid + "si") % 4: resp[8] = 0   # keep item 9 rare
            score = sum(resp)
            adm.append({"administration_id": "ADM-%04d" % n, "client_id": cid, "form_id": f["form_id"],
                        "date": iso(ago(12 + (s0 % 25) + j * 90)), "administered_by_staff_id": ("ST-2006", "ST-2003", "ST-2002")[(s0 + j) % 3],
                        "responses": resp, "score": score, "band": band(f, score),
                        "flagged": bool(f.get("flag_item") and resp[f["flag_item"] - 1] > 0)})
            n += 1
write("assessment_administrations.json", "Scored administrations with item-level responses, per client "
      "and instrument, most recent first. Illustrative only — not scoring guidance.",
      list(adm[0].keys()), adm)

# ---- Client notes (care team ↔ care team, about one client) ---------------
TEMPLATES = [
    ("Scheduling", "Asked to move Thursday sessions to afternoons — please check before booking.", False),
    ("New allergy reported", "Mentioned a shellfish allergy at the front desk today. It isn't in the chart yet.", True),
    ("Transportation", "Transportation voucher approved through the end of the month.", False),
    ("Check-in suggested", "Was tearful in group this morning. Worth a check-in before the next session.", True),
    ("Pharmacy follow-up", "Pharmacy called about prior authorization on the latest refill. Told them the prescriber will follow up.", False),
    ("Court date moved", "Court date moved to the 14th. A letter of attendance will be needed.", False),
    ("Contact preference", "Prefers text only — please don't call the home number.", True),
    ("Housing", "Housing application submitted; waiting to hear back from the landlord.", False),
    ("Missed dose", "Missed this morning's medication pass. Came in at noon and took it.", True),
]
notes, n = [], 1
for c in clients:
    cid = c["client_id"]
    for k, t in enumerate(pick(TEMPLATES, cid + "notes", 2 + seed(cid + "nc") % 3)):
        s = seed(cid + t[0])
        author = ("ST-2004", "ST-2006", "ST-2008", "ST-2009", "ST-2005")[s % 5]
        readers = [x["staff_id"] for x in staff if seed(cid + t[0] + x["staff_id"]) % 3 == 0 and x["staff_id"] != author]
        if k == 0 and "ST-2003" in readers: readers.remove("ST-2003")   # at least one unread for the signed-in user
        notes.append({"note_id": "CN-%04d" % n, "client_id": cid, "author_staff_id": author,
                      "timestamp": "%sT%02d:%02d:00" % (iso(ago(k * 3 + s % 4)), 8 + s % 9, s % 60),
                      "subject": t[0], "body": t[1], "important": t[2], "read_by": readers})
        n += 1
    for m in msgs:   # fold in the seed's staff messages that name this client
        if m.get("related_client_id") != cid: continue
        notes.append({"note_id": "CN-%04d" % n, "client_id": cid, "author_staff_id": m["sender_staff_id"],
                      "timestamp": m["timestamp"], "subject": "Care coordination", "body": m["body"].replace(cid, "this client"),
                      "important": False, "read_by": ["ST-2003"] if m["read_status"] == "Read" else []})
        n += 1
write("client_notes.json", "Notes care-team staff leave each other about a client. read_by lists the staff "
      "who have opened each one; the header badge counts unread for the signed-in user.",
      list(notes[0].keys()), notes)
