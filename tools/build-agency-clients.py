#!/usr/bin/env python3
"""Generate clients_agency.json: clients at the agency who are NOT in the
signed-in clinician's caseload, so the prototype can show "break the glass"
(the Client Access Request intercept).

  access.scope = "other-program"   enrolled in a program the clinician doesn't serve
  access.scope = "restricted"      a record the agency has restricted

Same shape as clients.json, plus `access`. 100% fictional: names are invented,
phones are 555 numbers, emails are example.com. Deterministic.

Run before tools/build-refdata.py.
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
RD = HERE.parent / "fixtures" / "reference-data"
load = lambda n: json.loads((RD / n).read_text())["records"]
programs = [p["program_id"] for p in load("programs.json")]
sites = [s["site_id"] for s in load("sites_locations.json")]

# first, preferred, last, dob, gender, language, program index, site index, status, scope
PEOPLE = [
    ("Elena", None, "Vasquez", "1988-06-02", "Female", "Spanish", 3, 1, "Active", "other-program"),
    ("Kofi", None, "Mensah", "1995-01-17", "Male", "English", 4, 2, "Active", "other-program"),
    ("Wren", None, "Calloway", "2001-09-30", "Non-binary", "English", 2, 0, "Active", "other-program"),
    ("Thomas", "Tom", "Nakamura", "1979-12-11", "Male", "English", 5, 3, "Active", "other-program"),
    ("Priscilla", None, "Duarte", "1966-04-25", "Female", "Portuguese", 1, 4, "Discharged", "other-program"),
    ("Mateo", None, "Ibarra", "1999-07-08", "Male", "Spanish", 0, 2, "Active", "other-program"),
    ("Hannah", None, "Lindqvist", "1984-03-19", "Female", "English", 2, 1, "Active", "restricted"),
    ("Desmond", "Dez", "Achebe", "1972-10-05", "Male", "English", 4, 0, "Active", "restricted"),
]

rows = []
for i, (first, pref, last, dob, gender, lang, pi, si, status, scope) in enumerate(PEOPLE):
    n = 100301 + i
    rows.append({
        "client_id": f"CL-{n}", "mrn": f"MRN00{n - 99000:05d}",
        "first_name": first, "last_name": last, "preferred_name": pref,
        "dob": dob, "gender": gender, "race": None, "ethnicity": None, "primary_language": lang,
        "email": f"{first.lower()}.{last.lower()}.demo@example.com", "phone": f"555-020-{n % 10000:04d}",
        "address": {"line1": f"{100 + i * 37} Example Ave", "city": "Springfield", "state": "OH", "zip": "45501"},
        "program_ids": [programs[pi % len(programs)]], "site_id": sites[si % len(sites)],
        "enrollment_date": f"2025-0{1 + i % 9}-1{i % 9}", "status": status,
        "access": {"scope": scope},
    })

(RD / "clients_agency.json").write_text(json.dumps({"_meta": {
    "description": "Agency clients outside the signed-in clinician's caseload, for the Client Access "
                   "Request ('break the glass') intercept. access.scope is other-program or restricted.",
    "fictional": True, "fields": list(rows[0].keys())}, "records": rows}, indent=2) + "\n")
print(f"clients_agency.json: {len(rows)} records")
