#!/usr/bin/env python3
"""Generate residential_census.json: who is in which bed at Maple Grove.

The shared client fixtures only put four clients in residential care, which
is too few for a roster or a bulk worklist to mean anything. This adds ten
more residents (same shape as clients.json) and a bed assignment for all
fourteen, with the residential fields a residential client header shows:
unit, room, bed, admit date, attending, admission reason, legal status,
expected discharge and precautions. A vitals reading and the odd allergy
come with each new resident, so their header isn't empty.

100% fictional: names are invented, phones are 555 numbers, emails are
example.com. Deterministic. Run before tools/build-refdata.py.
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
RD = HERE.parent / "fixtures" / "reference-data"

UNITS = {
    "A1": ("SITE-RES-A", "SITE-RES-A-UNIT-1", "Unit 1 - Men's Housing"),
    "A2": ("SITE-RES-A", "SITE-RES-A-UNIT-2", "Unit 2 - Step-Down Housing"),
    "B1": ("SITE-RES-B", "SITE-RES-B-UNIT-1", "Unit 1 - Women's Housing"),
    "B2": ("SITE-RES-B", "SITE-RES-B-UNIT-2", "Unit 2 - Family Housing"),
}
REASONS = [
    "Alcohol use disorder, step-down after detox",
    "Opioid use disorder on MAT",
    "Co-occurring depression and stimulant use",
    "PTSD with alcohol use",
    "Bipolar disorder, stabilization after inpatient stay",
    "Cannabis and alcohol use, court referral",
]
LEGAL = ["Voluntary", "Voluntary", "Court Ordered Treatment", "Voluntary", "Probation condition"]
PRECAUTIONS = [None, None, "Fall risk", None, "Q15 observation", None, "Seizure precautions", None]

# New residents: first, preferred, last, dob, gender, language
NEW = [
    ("Gabriel", "Gabe", "Okonkwo", "1983-05-14", "Male", "English", "A1"),
    ("Luis", None, "Echeverría", "1991-08-29", "Male", "Spanish", "A1"),
    ("Peter", None, "Halvorsen", "1969-02-03", "Male", "English", "A1"),
    ("Jordan", None, "Reyes-Whitlock", "1998-12-21", "Non-binary", "English", "A2"),
    ("Andre", None, "Baptiste", "1976-10-09", "Male", "Haitian Creole", "A2"),
    ("Naomi", None, "Feldstein", "1987-04-17", "Female", "English", "B1"),
    ("Keisha", "Kiki", "Monroe", "1995-06-30", "Female", "English", "B1"),
    ("Rosa", None, "Villanueva", "1972-09-12", "Female", "Spanish", "B1"),
    ("Mei", None, "Takahashi", "2003-01-26", "Female", "English", "B2"),
    ("Tanya", None, "Petrovic", "1990-03-08", "Female", "English", "B2"),
]
# Existing residential clients from clients.json and where they sleep.
EXISTING = [("CL-100235", "A1"), ("CL-100241", "A1"), ("CL-100238", "B1"), ("CL-100244", "B1")]

residents, vitals, allergies, beds = [], [], [], []
for i, (first, pref, last, dob, gender, lang, unit) in enumerate(NEW):
    n = 100401 + i
    site, _, _ = UNITS[unit]
    residents.append({
        "client_id": f"CL-{n}", "mrn": f"MRN00{n - 99000:05d}",
        "first_name": first, "last_name": last, "preferred_name": pref,
        "dob": dob, "gender": gender, "race": None, "ethnicity": None, "primary_language": lang,
        "email": f"{first.lower()}.{last.lower().replace('í', 'i')}.demo@example.com", "phone": f"555-030-{n % 10000:04d}",
        "address": {"line1": "700 Maple Grove Way" if site == "SITE-RES-A" else "702 Maple Grove Way", "city": "Millbrook", "state": "OH", "zip": "45602"},
        "program_ids": ["PRG-RES-01"], "site_id": site,
        "enrollment_date": f"2026-0{6 + i % 3}-{10 + i:02d}", "status": "Active",
    })
    vitals.append({
        "vitals_id": f"VIT-R{i + 1:03d}", "client_id": f"CL-{n}", "recorded_by_staff_id": "ST-2008",
        "date_time": f"2026-09-{15 + i % 6:02d}T08:{10 + i * 3:02d}:00",
        "height_in": 62 + (i * 5) % 12, "weight_lbs": 128 + (i * 17) % 70, "bmi": round(21.5 + (i * 1.7) % 8, 1),
        "temp_f": 98.2 + (i % 4) / 10, "pulse_bpm": 66 + (i * 7) % 24, "resp_rate": 14 + i % 4,
        "bp_systolic": 112 + (i * 9) % 30, "bp_diastolic": 70 + (i * 5) % 16, "o2_sat_pct": 96 + i % 4, "pain_scale": i % 3,
    })
    if i % 3 == 0:
        allergies.append({"allergy_id": f"ALG-R{i + 1:03d}", "client_id": f"CL-{n}",
                          "allergen": ["Penicillin", "Sulfa drugs", "Latex", "Peanuts"][i % 4],
                          "allergen_category": ["Drug Class", "Drug Class", "Environmental", "Food"][i % 4],
                          "reaction": ["Rash", "Hives", "Contact dermatitis", "Anaphylaxis"][i % 4],
                          "severity_flag": ["Moderate", "Moderate", "Low", "High"][i % 4],
                          "medication_context": None, "status": "Active"})

# Legal status must agree with the chart. For the existing clients it comes
# from their active attribute assignments; a new resident who is court
# ordered or on probation gets the matching attribute, so the header's
# attribute box and its Legal Status field never contradict each other.
TODAY = "2026-09-22"
ASSIGN = json.loads((RD / "client_attribute_assignments.json").read_text())["records"]
LEGAL_ATTR = {"Court Ordered Treatment": "ATTR-COURTORDERED", "Probation condition": "ATTR-PROBATION"}
def legal_from_chart(cid):
    live = {a["attribute_id"] for a in ASSIGN if a["client_id"] == cid and not a["removed"]
            and (a["end_date"] is None or a["end_date"] >= TODAY)}
    return ("Court Ordered Treatment" if "ATTR-COURTORDERED" in live
            else "Probation condition" if "ATTR-PROBATION" in live else "Voluntary")
attributes = []

order = [(c, u) for c, u in EXISTING] + [(r["client_id"], NEW[i][6]) for i, r in enumerate(residents)]
by_unit = {}
for cid, unit in order:
    by_unit.setdefault(unit, []).append(cid)
ROOM_BASE = {"A1": 101, "A2": 201, "B1": 101, "B2": 201}
k = 0
for unit, cids in by_unit.items():
    site, sub_id, sub_name = UNITS[unit]
    for j, cid in enumerate(cids):
        building = "A" if site == "SITE-RES-A" else "B"
        admit_m, admit_d = 6 + (k * 5) % 4, 1 + (k * 11) % 27
        if admit_m == 9:   # nobody is admitted after the pinned TODAY (09/22)
            admit_d = min(admit_d, 18)
        beds.append({
            "client_id": cid, "site_id": site, "unit_id": sub_id, "unit_name": sub_name,
            "room": f"{building}-{ROOM_BASE[unit] + (j if unit == 'B2' else j // 2)}", "bed": "A" if unit == "B2" else "AB"[j % 2],
            "admit_date": f"2026-{admit_m:02d}-{admit_d:02d}",
            "attending_staff_id": ["ST-2002", "ST-2001"][k % 2],
            "admission_reason": REASONS[k % len(REASONS)],
            "legal_status": legal_from_chart(cid) if cid in dict(EXISTING) else LEGAL[k % len(LEGAL)],
            # The discharge demo client leaves today (2026-09-22, the pinned TODAY).
            "expected_discharge": "2026-09-22" if cid == "CL-100235" else f"2026-{10 + k % 3:02d}-{5 + (k * 7) % 22:02d}",
            "precautions": PRECAUTIONS[k % len(PRECAUTIONS)],
        })
        if cid not in dict(EXISTING) and beds[-1]["legal_status"] in LEGAL_ATTR:
            start = beds[-1]["admit_date"]
            attributes.append({"assignment_id": f"CA-R{len(attributes) + 1:03d}", "client_id": cid,
                "attribute_id": LEGAL_ATTR[beds[-1]["legal_status"]], "start_date": start, "end_date": None,
                "added_by_staff_id": "ST-2004", "added_at": start + "T10:00", "removed": False,
                "history": [{"action": "added", "at": start + "T10:00", "by_staff_id": "ST-2004",
                             "start_date": start, "end_date": None, "reason": None}]})
        k += 1

# Children living with a parent in family housing. Not clients — they're the
# parent's dependents, as in production's Dependents action — but they hold a
# bed, so they're the parent's roommates and they're on the attendance list.
DEPENDENTS_SRC = {"CL-100409": [("Hana", "Takahashi", "2022-05-03")],
                  "CL-100410": [("Luka", "Petrovic", "2019-11-20"), ("Ana", "Petrovic", "2023-02-14")]}
dependents = []
for b in beds:
    for i, (first, last, dob) in enumerate(DEPENDENTS_SRC.get(b["client_id"], [])):
        dependents.append({"dependent_id": f"DEP-{len(dependents) + 1:03d}", "parent_client_id": b["client_id"],
                           "first_name": first, "last_name": last, "dob": dob, "relationship": "Child",
                           "site_id": b["site_id"], "room": b["room"], "bed": "BCD"[i]})

# Daily Attendance: the morning check for today (the pinned TODAY) and last
# night's. A resident with no record today reads "Not recorded".
STATUS_TODAY = ["Present", "Present", "Present", None, "Present", "On leave", "Present", "Present", None, "Present", "Present", "Present", "Present", "Present"]
attendance = []
subjects = [b["client_id"] for b in beds] + [d["dependent_id"] for d in dependents]
for i, sid in enumerate(subjects):
    attendance.append({"subject_id": sid, "date": "2026-09-21", "time": f"20:{30 + i:02d}",
                       "status": "Present", "by_staff_id": "ST-2005" if i % 2 else "ST-2004"})
    st = STATUS_TODAY[i % len(STATUS_TODAY)]
    parent = next((d["parent_client_id"] for d in dependents if d["dependent_id"] == sid), None)
    if parent:   # children are checked with their parent
        st = STATUS_TODAY[subjects.index(parent) % len(STATUS_TODAY)]
    if st:
        attendance.append({"subject_id": sid, "date": TODAY, "time": f"07:{5 + i * 2:02d}",
                           "status": st, "by_staff_id": "ST-2008"})

(RD / "residential_census.json").write_text(json.dumps({"_meta": {
    "description": "Maple Grove residential census: ten additional fictional residents, a bed assignment "
                   "for all fourteen residential clients, vitals, allergies and legal-status attributes for the new residents, children in family housing, and Daily Attendance records.",
    "fictional": True}, "records": {"residents": residents, "beds": beds, "vitals": vitals, "allergies": allergies, "attributes": attributes,
                                     "dependents": dependents, "attendance": attendance}},
    indent=2, ensure_ascii=False) + "\n")
print(f"residential_census.json: {len(residents)} new residents, {len(beds)} beds, {len(dependents)} dependents, {len(attendance)} attendance records")
