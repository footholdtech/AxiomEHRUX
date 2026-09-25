#!/usr/bin/env python3
"""Generate client_diagnoses.json + client_problems.json.

Extends the shared synthetic EHR reference dataset (ehr-synthetic-data skill)
with the two per-client tables this prototype needs and the seed does not ship:
which diagnosis codes and which problem-list items belong to which client, and
— the whole point of the discharge prototype — what *status* each one carries.

100% fictional. Every client_id/staff_id already exists in the seed; only the
join rows and statuses are new. Deterministic (fixed seed), so re-running gives
byte-identical output and every teammate sees the same chart.
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
RD = HERE.parent / "fixtures" / "reference-data"

load = lambda n: json.loads((RD / n).read_text())["records"]
clients, dx_codes, problems = load("clients.json"), load("diagnosis_codes.json"), load("problem_list.json")

# FNV-1a — same hash the app uses, so ordering is stable across languages.
def seed(s):
    h = 2166136261
    for ch in str(s):
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

def pick(arr, key, n):
    out, used, x = [], set(), seed(key) or 1
    for _ in range(min(n, len(arr)) * 12):
        if len(out) == min(n, len(arr)):
            break
        x = ((x * 1103515245) + 12345) & 0xFFFFFFFF
        i = x % len(arr)
        if i not in used:
            used.add(i)
            out.append(arr[i])
    return out

# Statuses a diagnosis can hold. "Resolved" is a *clinical* judgement, recorded
# independently of whether the client is still enrolled — the distinction this
# prototype exists to demonstrate.
DX_STATUS = ["Active", "Active", "Active", "In Remission", "Provisional", "Resolved"]
PROB_STATUS = ["Active", "Active", "Active", "Resolved", "Inactive"]
PRECEDENCE = ["Primary", "Secondary", "Tertiary", "Quaternary"]
DX_TYPE = ["Behavioral Health", "Behavioral Health", "Substance Use", "Medical"]

# Hand-pinned chart for the demo client (DeShawn "Dee" Carter, residential) so
# the discharge walkthrough always shows a clinically coherent mix: active SUD +
# PTSD, a depressive episode in remission, and one genuinely resolved diagnosis.
PINNED = {
    "CL-100235": [
        ("F10.20", "Primary",    "Substance Use",     "Active",       "2023-08-14", None,         "ST-2002"),
        ("F43.10", "Secondary",  "Behavioral Health", "Active",       "2023-09-02", None,         "ST-2002"),
        ("F32.1",  "Tertiary",   "Behavioral Health", "In Remission", "2023-09-02", None,         "ST-2002"),
        ("F12.10", "Quaternary", "Substance Use",     "Resolved",     "2023-08-14", "2025-04-30", "ST-2006"),
        ("F51.01", "Quaternary", "Medical",           "Provisional",  "2026-02-11", None,         "ST-2001"),
    ]
}
# F51.01 is not in the shared code table; carry its description inline.
EXTRA_DESC = {"F51.01": "Primary insomnia"}

PINNED_PROBS = {
    "CL-100235": [
        ("PROB-HOMELESS",  "Active",   "2023-08-14", None),
        ("PROB-UNEMPLOYED","Active",   "2023-08-14", None),
        ("PROB-SLEEP",     "Active",   "2025-11-03", None),
        ("PROB-JUSTICE",   "Active",   "2023-08-14", None),
        ("PROB-SI",        "Resolved", "2023-08-20", "2024-03-15"),
        ("PROB-ISOLATION", "Resolved", "2023-09-02", "2025-06-01"),
    ]
}

PROVIDERS = ["ST-2001", "ST-2002", "ST-2003", "ST-2006"]
dx_by_code = {d["icd10"]: d for d in dx_codes}

dx_rows, prob_rows, n = [], [], 1
for c in clients:
    cid = c["client_id"]
    if cid in PINNED:
        rows = PINNED[cid]
    else:
        chosen = pick(dx_codes, cid + "dx", 2 + seed(cid + "n") % 3)
        rows = []
        for i, d in enumerate(chosen):
            s = seed(cid + d["icd10"])
            rows.append((d["icd10"], PRECEDENCE[min(i, 3)], DX_TYPE[s % len(DX_TYPE)],
                         DX_STATUS[s % len(DX_STATUS)], "2024-0%d-1%d" % (1 + s % 8, s % 9),
                         None, PROVIDERS[s % len(PROVIDERS)]))
    for icd, prec, typ, status, onset, resolved, prov in rows:
        d = dx_by_code.get(icd, {})
        dx_rows.append({
            "client_dx_id": "CDX-%04d" % n,
            "client_id": cid,
            "icd10": icd,
            "snomed_ct": d.get("snomed_ct"),
            "description": d.get("description") or EXTRA_DESC.get(icd, icd),
            "diagnosis_type": typ,
            "precedence": prec,
            "status": status,
            "onset_date": onset,
            "resolved_date": resolved if status == "Resolved" else None,
            "diagnosed_by_staff_id": prov,
        })
        n += 1

m = 1
for c in clients:
    cid = c["client_id"]
    if cid in PINNED_PROBS:
        rows = PINNED_PROBS[cid]
    else:
        chosen = pick(problems, cid + "pl", 2 + seed(cid + "p") % 4)
        rows = []
        for p in chosen:
            s = seed(cid + p["problem_id"])
            st = PROB_STATUS[s % len(PROB_STATUS)]
            rows.append((p["problem_id"], st, "2024-0%d-0%d" % (1 + s % 8, 1 + s % 8),
                         "2025-1%d-0%d" % (s % 3, 1 + s % 8) if st == "Resolved" else None))
    for pid, status, onset, resolved in rows:
        p = next((x for x in problems if x["problem_id"] == pid), {})
        prob_rows.append({
            "client_problem_id": "CPL-%04d" % m,
            "client_id": cid,
            "problem_id": pid,
            "name": p.get("name", pid),
            "category": p.get("category", "Psychosocial"),
            "status": status,
            "onset_date": onset,
            "resolved_date": resolved,
        })
        m += 1

def write(name, description, fields, records):
    (RD / name).write_text(json.dumps(
        {"_meta": {"description": description, "fictional": True, "fields": fields}, "records": records},
        indent=2) + "\n")
    print(f"{name}: {len(records)} records")

write("client_diagnoses.json",
      "Per-client diagnosis assignments (joins clients.json to diagnosis_codes.json). "
      "100% fictional — no real PHI. Status is clinical and independent of enrollment/discharge status.",
      ["client_dx_id", "client_id", "icd10", "snomed_ct", "description", "diagnosis_type",
       "precedence", "status", "onset_date", "resolved_date", "diagnosed_by_staff_id"],
      dx_rows)

write("client_problems.json",
      "Per-client problem-list entries (joins clients.json to problem_list.json). "
      "100% fictional — no real PHI. Status is clinical and independent of enrollment/discharge status.",
      ["client_problem_id", "client_id", "problem_id", "name", "category", "status",
       "onset_date", "resolved_date"],
      prob_rows)
