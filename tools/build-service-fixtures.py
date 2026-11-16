#!/usr/bin/env python3
"""Generate services.json: Admin > Service Builder seed data.

A service is the container for what a staff member does with a client. An
admin defines the building blocks once (service codes, diagnosis sets,
precedence logic, sensitivity classes, documents, appointment types, due
date rules) and a service subscribes to them, alongside the programs, roles,
sites, payors and funding that already live elsewhere in the product.

  blocks           The libraries a service picks from. Due date rules live in
                   due_date_rules.json; programs, roles, sites, payors and
                   funding come from the shared synthetic dataset.
  templates        Starting points only. Picking one pre-fills a new service;
                   after that the two are independent. Most are shipped by an
                   implementation team ("source": "implementation"), a few are
                   the agency's own.
  services         What staff pick. Each has versions with effective dates;
                   the version in effect on a date of service is the one a
                   note uses. A service is either one document (most of them)
                   or a workflow of ordered steps with a deadline of its own.
  staff_security   Each staff member's specific security: the programs, sites
                   and sensitivity classes they're cleared for. A service is
                   offered to someone only if their role is on it AND they
                   pass every security it carries.
  instances        Services performed or in progress for a few clients, so the
                   chart's Services page has something to show.

Due date rules attach at two levels: to a step (a consent renews yearly) and,
for a workflow, to the service as its deadline (the whole intake within 5
days of referral). Rule ids must match tools/build-due-date-fixtures.py.

Service codes and modifiers are public HCPCS/CPT identifiers used as
configuration, the same way diagnosis_codes.json uses ICD-10-CM. All
configuration and every client link is fictional. Deterministic. Run before
tools/build-refdata.py.
"""
import json, pathlib, copy

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "fixtures" / "reference-data" / "services.json"

# ---- Building blocks ------------------------------------------------------
SERVICE_CODES = [
    ("SC-90791", "90791", "Psychiatric diagnostic evaluation", "per evaluation"),
    ("SC-90832", "90832", "Psychotherapy, 30 minutes", "per session"),
    ("SC-90834", "90834", "Psychotherapy, 45 minutes", "per session"),
    ("SC-90837", "90837", "Psychotherapy, 60 minutes", "per session"),
    ("SC-90847", "90847", "Family psychotherapy, client present", "per session"),
    ("SC-90839", "90839", "Psychotherapy for crisis, first 60 minutes", "per session"),
    ("SC-H0031", "H0031", "Mental health assessment, non-physician", "per assessment"),
    ("SC-H0032", "H0032", "Mental health service plan development, non-physician", "per plan"),
    ("SC-T1017", "T1017", "Targeted case management", "per 15 minutes"),
    ("SC-H0038", "H0038", "Self-help / peer services", "per 15 minutes"),
    ("SC-H2011", "H2011", "Crisis intervention service", "per 15 minutes"),
    ("SC-H2015", "H2015", "Comprehensive community support services", "per 15 minutes"),
]
MODIFIERS = [
    ("HA", "Child / adolescent program"), ("HE", "Mental health program"),
    ("HF", "Substance use program"), ("HO", "Master's degree level"), ("95", "Synchronous telehealth"),
]
DIAGNOSIS_SETS = [
    ("DXS-BH", "Any behavioral health diagnosis", "F01–F99"),
    ("DXS-MOOD", "Depressive and anxiety disorders", "F32–F33, F41"),
    ("DXS-SUD", "Substance use disorders", "F10–F19"),
    ("DXS-TRAUMA", "Trauma and stressor-related disorders", "F43"),
    ("DXS-CHILD", "Child and adolescent conditions", "F32–F33, F43, F90–F98"),
    ("DXS-SMI", "Serious mental illness", "F20–F29, F31, F33"),
]
PRECEDENCE = [
    ("DXP-EPISODE", "Primary on the client’s current episode",
     "Uses the diagnosis ranked Primary on the client’s open episode in the program the service is performed in."),
    ("DXP-SET", "Highest-ranked in this service’s set",
     "Uses the highest-ranked active diagnosis that falls in the service’s diagnosis set. If none does, staff choose."),
    ("DXP-STAFF", "Staff choose on the note",
     "Staff pick one of the client’s active diagnoses that falls in the service’s diagnosis set."),
]
# Labels match SENSITIVITY in src/32-quickviews.jsx, so a staff member's
# clearances and a service's class are the same words.
SENSITIVITY = [
    ("SEN-STD", "Standard", None),
    ("SEN-MH", "Sensitive — mental health", None),
    ("SEN-PART2", "Sensitive — substance use (42 CFR Part 2)", "Release of Information"),
]
DOCUMENTS = [
    # name, category, default due date rule (pre-fills when added to a service)
    ("Progress Note", "Note", None), ("Psychotherapy Progress Note", "Note", None),
    ("Therapy Note", "Note", None), ("Case Management Note", "Note", None),
    ("Crisis Follow-Up Note", "Note", None), ("Peer Support Note", "Note", None),
    ("Nurse Progress Note", "Note", None), ("Hospital Discharge Follow-Up", "Note", "DDR-004"),
    ("Psychiatric Evaluation", "Assessment", None), ("Psychosocial Assessment Note", "Assessment", None),
    ("CANS", "Assessment", "DDR-001"), ("PHQ", "Assessment", "DDR-007"),
    ("Suicide Risk Screening", "Assessment", "DDR-008"), ("PRAPARE", "Assessment", None),
    ("Informed Consent", "Consent", "DDR-002"), ("Release of Information", "Consent", "DDR-002"),
    ("Service Plan", "Plan", "DDR-003"), ("Support & Safety Plan", "Plan", None),
    ("Discharge Plan", "Plan", None), ("Closure", "Form", None),
    ("Client Satisfaction Survey", "Form", None), ("Quality of Life Questionnaire", "Form", "DDR-002"),
]
APPOINTMENT_TYPES = [
    ("Initial Session", "DDR-005"), ("Follow-Up Session", None),
    ("Post-Discharge Follow-Up", "DDR-004"), ("Service Plan Review Meeting", "DDR-003"),
]
# Which codes a payor takes. Medicare and the commercial plans pay CPT
# codes only; Medicaid, the county contract and the grants take HCPCS too.
CPT_ONLY = ["PAYER-MEDICAREB", "PAYER-ANTHEM", "PAYER-UHC"]

R = {  # role names, from roles.json
    "PSY": "Psychiatric Provider", "SW": "Social Worker", "TH": "Clinical Provider / Therapist",
    "CM": "Case Manager", "RN": "Nurse", "HS": "Housing Supervisor", "INT": "Intake Coordinator",
    "PEER": "Peer Support Specialist", "CD": "Clinical Director",
}
def roles(*ks): return [R[k] for k in ks]

ALL_PROGRAMS = ["PRG-GEN-THX", "PRG-OUTP-01", "PRG-COUNSEL", "PRG-RES-01", "PRG-IOP-01", "PRG-CRISIS-01", "PRG-PEER-01"]
OUTPATIENT = ["PRG-GEN-THX", "PRG-OUTP-01", "PRG-COUNSEL"]

_n = [0]
def step(kind, name, *rules, required=True, after=None):
    _n[0] += 1
    return {"step_id": f"STP-{_n[0]:03d}", "kind": kind, "name": name, "required": required,
            "rule_ids": list(rules), "after": after}
def doc(name, *rules, **kw): return step("Document", name, *rules, **kw)
def appt(name, *rules, **kw): return step("Appointment", name, *rules, **kw)
def code(cid, units=1, *mods): return {"code_id": cid, "units": units, "modifiers": list(mods)}

def config(*, roles_, programs=(), sites=(), codes=(), payors=(), funding=(), dx="DXS-BH",
           precedence="DXP-EPISODE", sensitivity="Standard", duration=None, steps=(), deadline=None,
           description=""):
    return {"description": description, "roles": list(roles_), "programs": list(programs), "sites": list(sites),
            "codes": list(codes), "payors": list(payors), "funding": list(funding), "dx_set": dx,
            "precedence": precedence, "sensitivity": sensitivity, "duration_min": duration,
            "steps": list(steps), "deadline_rule_id": deadline}

MEDICAID_COUNTY = ["PAYER-OHMEDICAID", "PAYER-COUNTY-MH"]
MEDICAID_COUNTY_F = ["FUND-MEDICAID", "FUND-COUNTY"]

# ---- Templates --------------------------------------------------------------
def T(tid, name, collection, source, cfg, updated="2026-05-12"):
    return {"template_id": tid, "name": name, "collection": collection, "source": source,
            "updated": updated, "config": cfg}

def intake_steps():
    return [doc("Informed Consent", "DDR-002"), doc("Release of Information", "DDR-002"),
            doc("Psychosocial Assessment Note"), doc("PHQ", "DDR-007", required=False),
            doc("Service Plan", "DDR-003"), appt("Initial Session", "DDR-005")]

TEMPLATES = [
    T("TPL-THERAPY", "Standard Therapy", "Medicaid Outpatient", "implementation", config(
        description="Individual psychotherapy. One note; billed by session length.",
        roles_=roles("TH", "SW", "CD"), codes=[code("SC-90834")],
        payors=MEDICAID_COUNTY + ["PAYER-ANTHEM", "PAYER-UHC"], funding=MEDICAID_COUNTY_F + ["FUND-COMMERCIAL"],
        duration=45, steps=[doc("Psychotherapy Progress Note")])),
    T("TPL-CM", "Standard Case Management", "Medicaid Outpatient", "implementation", config(
        description="Targeted case management, billed in 15-minute units.",
        roles_=roles("CM", "SW", "HS"), codes=[code("SC-T1017", 2)], payors=MEDICAID_COUNTY,
        funding=MEDICAID_COUNTY_F, precedence="DXP-SET", duration=30, steps=[doc("Case Management Note")])),
    T("TPL-PEER", "Peer Support Session", "Medicaid Outpatient", "implementation", config(
        description="Peer support, billed in 15-minute units.",
        roles_=roles("PEER"), codes=[code("SC-H0038", 2)], payors=MEDICAID_COUNTY, funding=MEDICAID_COUNTY_F,
        precedence="DXP-SET", duration=30, steps=[doc("Peer Support Note")])),
    T("TPL-CHECKIN", "Post Class Check-In", "Medicaid Outpatient", "implementation", config(
        description="A short check-in after a group class. One progress note.",
        roles_=roles("TH", "SW", "CM", "PEER"), codes=[code("SC-H2015", 1)], payors=MEDICAID_COUNTY,
        funding=MEDICAID_COUNTY_F, precedence="DXP-SET", duration=15, steps=[doc("Progress Note")])),
    T("TPL-CRISIS-FU", "Crisis Follow-Up", "Crisis Services", "implementation", config(
        description="Follow-up after a crisis contact: the note and a risk screening.",
        roles_=roles("TH", "SW", "RN"), codes=[code("SC-H2011", 2)], payors=MEDICAID_COUNTY,
        funding=MEDICAID_COUNTY_F, sensitivity="Sensitive — mental health", duration=30,
        steps=[doc("Crisis Follow-Up Note"), doc("Suicide Risk Screening", "DDR-008")])),
    T("TPL-INTAKE", "Standard Intake", "Medicaid Outpatient", "implementation", config(
        description="Everything a new client needs, due within 14 days of referral.",
        roles_=roles("INT", "TH", "SW"), codes=[code("SC-H0031"), code("SC-H0032")], payors=MEDICAID_COUNTY,
        funding=MEDICAID_COUNTY_F, precedence="DXP-STAFF", steps=intake_steps(), deadline="DDR-011")),
    T("TPL-CRISIS-INTAKE", "Crisis Intake", "Crisis Services", "implementation", config(
        description="Intake for a crisis admission, due within 5 days of referral.",
        roles_=roles("INT", "TH", "SW"), codes=[code("SC-H0031"), code("SC-H2011", 4)], payors=MEDICAID_COUNTY,
        funding=MEDICAID_COUNTY_F, precedence="DXP-STAFF", sensitivity="Sensitive — mental health",
        steps=[doc("Informed Consent", "DDR-002"), doc("Suicide Risk Screening", "DDR-008"),
               doc("Psychosocial Assessment Note"), doc("Support & Safety Plan"), doc("Service Plan", "DDR-003")],
        deadline="DDR-010")),
    T("TPL-DISCHARGE", "Residential Discharge", "Residential", "implementation", config(
        description="Discharge paperwork and the 7-day follow-up. Not billed.",
        roles_=roles("SW", "CM", "TH", "RN"), payors=[], funding=[], precedence="DXP-EPISODE",
        steps=[doc("Discharge Plan"), doc("Closure"), doc("Client Satisfaction Survey", required=False),
               appt("Post-Discharge Follow-Up", "DDR-004")], deadline="DDR-012")),
    T("TPL-REVIEW", "Annual Treatment Review", "Medicaid Outpatient", "implementation", config(
        description="The yearly plan review, with the consents and screening that renew with it.",
        roles_=roles("TH", "SW", "CM"), codes=[code("SC-H0032")], payors=MEDICAID_COUNTY, funding=MEDICAID_COUNTY_F,
        steps=[doc("Service Plan", "DDR-003"), doc("PHQ", "DDR-007"), doc("Informed Consent", "DDR-002"),
               doc("Release of Information", "DDR-002")], deadline="DDR-002")),
    T("TPL-FAMILY", "Child & Family Therapy", "Horizon Wellness", "agency", config(
        description="Family therapy for children and youth, with the CANS that goes with it.",
        roles_=roles("TH", "SW"), codes=[code("SC-90847", 1, "HA")], payors=MEDICAID_COUNTY, funding=MEDICAID_COUNTY_F,
        dx="DXS-CHILD", duration=50, steps=[doc("Therapy Note"), doc("CANS", "DDR-001")]), updated="2026-08-02"),
    T("TPL-SUD", "SUD Individual Counseling", "Horizon Wellness", "agency", config(
        description="Substance use counseling. Part 2 protected, so a release is part of it.",
        roles_=roles("TH", "SW"), codes=[code("SC-90832", 1, "HF")], payors=["PAYER-OHMEDICAID", "PAYER-SABG"],
        funding=["FUND-MEDICAID", "FUND-STATE-BLOCK"], dx="DXS-SUD", precedence="DXP-SET",
        sensitivity="Sensitive — substance use (42 CFR Part 2)", duration=30,
        steps=[doc("Progress Note"), doc("Release of Information", "DDR-002")]), updated="2026-06-30"),
]
TPL = {t["template_id"]: t for t in TEMPLATES}

# ---- Services ---------------------------------------------------------------
def svc(sid, name, tid, *, status="active", versions, created="2025-07-01"):
    return {"service_id": sid, "name": name, "started_from": tid, "status": status,
            "created": created, "versions": versions}

def ver(v, effective, cfg, *, changed=None, by="ST-2010", note=""):
    return {"version": v, "effective": effective, "changed": changed or effective, "changed_by": by,
            "note": note, "config": cfg}

def from_tpl(tid, **over):
    """A copy of a template's configuration with fresh step ids, tailored."""
    cfg = copy.deepcopy(TPL[tid]["config"]) if tid else config(roles_=[])
    for s in cfg["steps"]:
        _n[0] += 1
        s["step_id"] = f"STP-{_n[0]:03d}"
    alias = {"duration": "duration_min", "dx": "dx_set", "deadline": "deadline_rule_id"}
    for k, v in over.items():
        assert alias.get(k, k) in cfg, k
        cfg[alias.get(k, k)] = v
    return cfg

SERVICES = []
def add(*a, **k): SERVICES.append(svc(*a, **k))

# Individual therapy: one note, billed by length. Three versions on the 60m,
# to show what History holds.
th60_v1 = from_tpl("TPL-THERAPY", programs=OUTPATIENT, codes=[code("SC-90837")], duration=60,
                   payors=MEDICAID_COUNTY + ["PAYER-ANTHEM"])
th60_v2 = copy.deepcopy(th60_v1); th60_v2["payors"] = th60_v1["payors"] + ["PAYER-UHC"]
th60_v3 = copy.deepcopy(th60_v2); th60_v3["codes"] = [code("SC-90837", 1, "HO")]
add("SVC-001", "Individual Therapy 60m", "TPL-THERAPY", versions=[
    ver(1, "2025-07-01", th60_v1, note="Created from Standard Therapy."),
    ver(2, "2026-01-01", th60_v2, changed="2025-12-10", note="UnitedHealthcare contract signed."),
    ver(3, "2026-07-01", th60_v3, changed="2026-06-12", by="ST-2007", note="Medicaid now requires the HO modifier for master’s-level clinicians."),
])
add("SVC-002", "Individual Therapy 45m", "TPL-THERAPY", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-THERAPY", programs=OUTPATIENT + ["PRG-IOP-01"]), note="Created from Standard Therapy.")])
add("SVC-003", "Individual Therapy 30m", "TPL-THERAPY", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-THERAPY", programs=OUTPATIENT, codes=[code("SC-90832")], duration=30), note="Created from Standard Therapy.")])
add("SVC-004", "Telehealth Therapy 45m", "TPL-THERAPY", created="2026-02-01", versions=[
    ver(1, "2026-02-01", from_tpl("TPL-THERAPY", programs=["PRG-GEN-THX", "PRG-OUTP-01"], codes=[code("SC-90834", 1, "95")]), note="Created from Standard Therapy.")])
add("SVC-005", "Residential Individual Therapy 45m", "TPL-THERAPY", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-THERAPY", programs=["PRG-RES-01"], sites=["SITE-RES-A", "SITE-RES-B"],
                                  payors=MEDICAID_COUNTY, funding=MEDICAID_COUNTY_F), note="Created from Standard Therapy.")])

# Case management. The 15m has a version scheduled for next month.
cm15 = from_tpl("TPL-CM", programs=["PRG-GEN-THX", "PRG-OUTP-01", "PRG-COUNSEL", "PRG-RES-01", "PRG-IOP-01", "PRG-PEER-01"],
                codes=[code("SC-T1017", 1)], duration=15)
cm15_v2 = copy.deepcopy(cm15); cm15_v2["payors"] = cm15["payors"] + ["PAYER-COMMUNITY-FDN"]; cm15_v2["funding"] = cm15["funding"] + ["FUND-GRANT"]
add("SVC-006", "Case Management 15m", "TPL-CM", versions=[
    ver(1, "2025-07-01", cm15, note="Created from Standard Case Management."),
    ver(2, "2026-10-01", cm15_v2, changed="2026-09-15", by="ST-2007", note="Community Wellness Foundation grant starts October 1."),
])
add("SVC-007", "Case Management 30m", "TPL-CM", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CM", programs=["PRG-GEN-THX", "PRG-OUTP-01", "PRG-COUNSEL", "PRG-RES-01", "PRG-IOP-01", "PRG-PEER-01"]), note="Created from Standard Case Management.")])
add("SVC-008", "Housing Case Management 30m", "TPL-CM", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CM", programs=["PRG-RES-01"], roles=roles("HS", "CM"), sites=["SITE-RES-A", "SITE-RES-B"],
                                  funding=MEDICAID_COUNTY_F + ["FUND-HUD"]), note="Created from Standard Case Management.")])
add("SVC-009", "Crisis Case Management 15m", "TPL-CM", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CM", programs=["PRG-CRISIS-01"], codes=[code("SC-T1017", 1)], duration=15,
                                  sites=["SITE-CRISIS-01"], sensitivity="Sensitive — mental health"), note="Created from Standard Case Management.")])

# Peer support.
add("SVC-010", "Peer Support 30m", "TPL-PEER", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-PEER", programs=["PRG-PEER-01", "PRG-RES-01"]), note="Created from Peer Support Session.")])
add("SVC-011", "Peer Support 60m", "TPL-PEER", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-PEER", programs=["PRG-PEER-01"], codes=[code("SC-H0038", 4)], duration=60), note="Created from Peer Support Session.")])
add("SVC-012", "Recovery Coaching 30m", "TPL-PEER", created="2026-04-01", versions=[
    ver(1, "2026-04-01", from_tpl("TPL-PEER", programs=["PRG-IOP-01", "PRG-PEER-01"],
                                  steps=[doc("Peer Support Note"), doc("Quality of Life Questionnaire", "DDR-002", required=False)]),
        note="Created from Peer Support Session; adds the quality of life questionnaire.")])

# Post class check-ins: the brief's example. The 15m changes next month.
ci15 = from_tpl("TPL-CHECKIN", programs=["PRG-IOP-01", "PRG-OUTP-01", "PRG-GEN-THX"])
ci15_v2 = copy.deepcopy(ci15); ci15_v2["steps"] = ci15["steps"] + [doc("PHQ", "DDR-007", required=False)]
add("SVC-013", "Standard 15m Post Class Check-In", "TPL-CHECKIN", created="2026-03-01", versions=[
    ver(1, "2026-03-01", ci15, note="Created from Post Class Check-In."),
    ver(2, "2026-10-01", ci15_v2, changed="2026-09-18", note="Offers the PHQ when a check-in raises concern."),
])
add("SVC-031", "Residential Check-In 15m", "TPL-CHECKIN", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CHECKIN", programs=["PRG-RES-01"], sites=["SITE-RES-A", "SITE-RES-B"], roles=roles("SW", "CM", "TH", "HS", "RN")),
        note="Created from Post Class Check-In, for residential programs.")])
add("SVC-014", "Standard 30m Post Class Check-In", "TPL-CHECKIN", status="draft", created="2026-09-10", versions=[
    ver(1, None, from_tpl("TPL-CHECKIN", programs=["PRG-IOP-01"], codes=[code("SC-H2015", 2)], duration=30),
        changed="2026-09-10", note="Created from Post Class Check-In.")])

# Crisis follow-up.
add("SVC-015", "Crisis Follow-Up 15m", "TPL-CRISIS-FU", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CRISIS-FU", programs=["PRG-CRISIS-01", "PRG-IOP-01"], codes=[code("SC-H2011", 1)], duration=15), note="Created from Crisis Follow-Up.")])
add("SVC-016", "Crisis Follow-Up 30m", "TPL-CRISIS-FU", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CRISIS-FU", programs=["PRG-CRISIS-01"]), note="Created from Crisis Follow-Up.")])

# Intakes: workflows with a deadline.
add("SVC-017", "Standard Intake", "TPL-INTAKE", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-INTAKE", programs=OUTPATIENT), note="Created from Standard Intake.")])
add("SVC-018", "Residential Admission Intake", "TPL-INTAKE", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-INTAKE", programs=["PRG-RES-01"], sites=["SITE-RES-A", "SITE-RES-B"], roles=roles("INT", "SW", "CM")),
        note="Created from Standard Intake.")])
add("SVC-019", "IOP Intake", "TPL-INTAKE", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-INTAKE", programs=["PRG-IOP-01"]), note="Created from Standard Intake.")])
add("SVC-020", "Teen Crisis Intake", "TPL-CRISIS-INTAKE", created="2026-05-01", versions=[
    ver(1, "2026-05-01", from_tpl("TPL-CRISIS-INTAKE", programs=["PRG-CRISIS-01", "PRG-GEN-THX"], dx="DXS-CHILD",
                                  codes=[code("SC-H0031", 1, "HA"), code("SC-H2011", 4, "HA")],
                                  steps=[doc("Informed Consent", "DDR-002"), doc("Release of Information", "DDR-002"),
                                         doc("Suicide Risk Screening", "DDR-008"), doc("Psychosocial Assessment Note"),
                                         doc("CANS", "DDR-001"), doc("Support & Safety Plan"), doc("Service Plan", "DDR-003")]),
        note="Created from Crisis Intake; adds the release and the CANS for youth.")])
add("SVC-021", "Adult Crisis Intake", "TPL-CRISIS-INTAKE", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-CRISIS-INTAKE", programs=["PRG-CRISIS-01"], sites=["SITE-CRISIS-01"]), note="Created from Crisis Intake.")])

# Discharges.
add("SVC-022", "Residential Discharge", "TPL-DISCHARGE", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-DISCHARGE", programs=["PRG-RES-01"], sites=["SITE-RES-A", "SITE-RES-B"]), note="Created from Residential Discharge.")])
add("SVC-023", "IOP Step-Down Discharge", "TPL-DISCHARGE", status="draft", created="2026-09-02", versions=[
    ver(1, None, from_tpl("TPL-DISCHARGE", programs=["PRG-IOP-01"], sites=[]), changed="2026-09-02", note="Created from Residential Discharge.")])

# Reviews.
add("SVC-024", "Annual Treatment Review", "TPL-REVIEW", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-REVIEW", programs=OUTPATIENT), note="Created from Annual Treatment Review.")])
add("SVC-025", "Residential Treatment Review", "TPL-REVIEW", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-REVIEW", programs=["PRG-RES-01"], deadline_rule_id="DDR-003"),
        note="Created from Annual Treatment Review; reviewed on the service plan cycle instead.")])

# Agency templates.
add("SVC-026", "Child & Family Therapy 50m", "TPL-FAMILY", created="2026-08-02", versions=[
    ver(1, "2026-08-02", from_tpl("TPL-FAMILY", programs=["PRG-GEN-THX", "PRG-CRISIS-01"]), note="Created from Child & Family Therapy.")])
add("SVC-027", "SUD Individual Counseling 30m", "TPL-SUD", created="2026-07-01", versions=[
    ver(1, "2026-07-01", from_tpl("TPL-SUD", programs=["PRG-IOP-01", "PRG-RES-01"]), note="Created from SUD Individual Counseling.")])
add("SVC-028", "SUD Individual Counseling 45m", "TPL-SUD", status="inactive", created="2025-07-01", versions=[
    ver(1, "2025-07-01", from_tpl("TPL-SUD", programs=["PRG-IOP-01"], codes=[code("SC-90834", 1, "HF")], duration=45),
        note="Created from SUD Individual Counseling."),
])

# A single document with a one-time rule: the survey after a reassignment.
add("SVC-032", "Post Reassignment Satisfaction Survey", None, created="2026-04-11", versions=[
    ver(1, "2026-04-11", config(description="Asks the client how the change of provider went. Not billed.", roles_=roles("CM", "SW", "TH"),
                                programs=OUTPATIENT + ["PRG-IOP-01"], steps=[doc("Client Satisfaction Survey", "DDR-006")]),
        by="ST-2007", note="Created from scratch.")])

# Built from scratch.
add("SVC-029", "Psychiatric Evaluation", None, versions=[
    ver(1, "2025-07-01", config(description="The prescriber’s initial evaluation.", roles_=roles("PSY"), programs=ALL_PROGRAMS,
                                codes=[code("SC-90791")], payors=MEDICAID_COUNTY + CPT_ONLY, funding=MEDICAID_COUNTY_F + ["FUND-MEDICARE", "FUND-COMMERCIAL"],
                                precedence="DXP-STAFF", duration=60, steps=[doc("Psychiatric Evaluation")]), note="Created from scratch.")])
add("SVC-030", "Nurse Visit", None, versions=[
    ver(1, "2025-07-01", config(description="A nursing contact: vitals, medication check, education.", roles_=roles("RN"),
                                programs=["PRG-RES-01", "PRG-IOP-01", "PRG-CRISIS-01"], codes=[code("SC-H2015", 1)],
                                payors=MEDICAID_COUNTY, funding=MEDICAID_COUNTY_F, duration=15, steps=[doc("Nurse Progress Note")]),
        note="Created from scratch.")])

# ---- Staff security ---------------------------------------------------------
# ST-2003 (Priya Raman, Social Worker) is the signed-in user. She is cleared
# for mental health records but not Part 2, and not for Peer Connect — so a
# couple of services are deliberately out of her reach.
STAFF_SECURITY = [
    {"staff_id": "ST-2001", "programs": ALL_PROGRAMS, "sites": ["SITE-MAIN-01", "SITE-MAIN-02"], "sensitivity": ["Standard", "Sensitive — mental health"]},
    {"staff_id": "ST-2002", "programs": ALL_PROGRAMS, "sites": ["SITE-MAIN-01", "SITE-MAIN-02", "SITE-CRISIS-01"], "sensitivity": ["Standard", "Sensitive — mental health", "Sensitive — substance use (42 CFR Part 2)"]},
    {"staff_id": "ST-2003", "programs": ["PRG-GEN-THX", "PRG-OUTP-01", "PRG-COUNSEL", "PRG-RES-01", "PRG-IOP-01", "PRG-CRISIS-01"],
     "sites": ["SITE-MAIN-01", "SITE-MAIN-02", "SITE-RES-A", "SITE-CRISIS-01"], "sensitivity": ["Standard", "Sensitive — mental health"]},
    {"staff_id": "ST-2004", "programs": ["PRG-RES-01", "PRG-PEER-01"], "sites": ["SITE-RES-A", "SITE-RES-B"], "sensitivity": ["Standard"]},
    {"staff_id": "ST-2005", "programs": ["PRG-RES-01"], "sites": ["SITE-RES-A", "SITE-RES-B"], "sensitivity": ["Standard"]},
    {"staff_id": "ST-2006", "programs": ["PRG-GEN-THX", "PRG-OUTP-01", "PRG-COUNSEL", "PRG-IOP-01"], "sites": ["SITE-MAIN-01", "SITE-MAIN-02"],
     "sensitivity": ["Standard", "Sensitive — mental health", "Sensitive — substance use (42 CFR Part 2)"]},
    {"staff_id": "ST-2007", "programs": ALL_PROGRAMS, "sites": ["SITE-MAIN-01", "SITE-MAIN-02", "SITE-RES-A", "SITE-RES-B", "SITE-CRISIS-01"],
     "sensitivity": ["Standard", "Sensitive — mental health", "Sensitive — substance use (42 CFR Part 2)"]},
    {"staff_id": "ST-2008", "programs": ["PRG-RES-01", "PRG-IOP-01"], "sites": ["SITE-RES-B"], "sensitivity": ["Standard", "Sensitive — mental health"]},
    {"staff_id": "ST-2009", "programs": ALL_PROGRAMS, "sites": ["SITE-MAIN-01", "SITE-MAIN-02"], "sensitivity": ["Standard"]},
    {"staff_id": "ST-2010", "programs": ALL_PROGRAMS, "sites": ["SITE-MAIN-01", "SITE-MAIN-02", "SITE-RES-A", "SITE-RES-B", "SITE-CRISIS-01"],
     "sensitivity": ["Standard", "Sensitive — mental health", "Sensitive — substance use (42 CFR Part 2)"]},
]

# ---- Instances --------------------------------------------------------------
# Services performed or under way for clients on Priya's caseload. Step
# status refers to the steps of the version in effect on the date of service.
SVC_BY_ID = {s["service_id"]: s for s in SERVICES}
def current(sid, on):
    vs = [v for v in SVC_BY_ID[sid]["versions"] if v["effective"] and v["effective"] <= on]
    return vs[-1]
def inst(iid, cid, sid, dos, *, by="ST-2003", done=(), anchor=None, status=None):
    v = current(sid, dos)
    steps = [{"step_id": s["step_id"], "status": "done" if s["name"] in done else "todo",
              "done_on": done[s["name"]] if s["name"] in done else None} for s in v["config"]["steps"]]
    complete = all(x["status"] == "done" for x, s in zip(steps, v["config"]["steps"]) if s["required"])
    return {"instance_id": iid, "client_id": cid, "service_id": sid, "version": v["version"],
            "date_of_service": dos, "anchor_date": anchor or dos, "started_by": by,
            "status": status or ("complete" if complete else "open"), "steps": steps}

INSTANCES = [
    # DeShawn Carter, discharging from New Foundations today (TODAY is
    # 2026-09-22 in the prototype). The follow-up is already booked.
    inst("SI-001", "CL-100235", "SVC-022", "2026-09-22", anchor="2026-09-22", done={"Post-Discharge Follow-Up": "2026-09-22"}),
    inst("SI-002", "CL-100235", "SVC-005", "2026-09-15", done={"Psychotherapy Progress Note": "2026-09-15"}),
    inst("SI-003", "CL-100235", "SVC-005", "2026-09-08", done={"Psychotherapy Progress Note": "2026-09-08"}),
    inst("SI-004", "CL-100235", "SVC-025", "2026-03-02", by="ST-2004",
         done={"Service Plan": "2026-03-02", "PHQ": "2026-03-02", "Informed Consent": "2026-03-04", "Release of Information": "2026-03-04"}),
    # Samuel Weiss: his annual review is open, due on his enrollment
    # anniversary (enrolled 2021-11-30).
    inst("SI-005", "CL-100239", "SVC-024", "2026-09-21", anchor="2021-11-30", done={"PHQ": "2026-09-21"}),
    inst("SI-006", "CL-100239", "SVC-001", "2026-09-14", done={"Psychotherapy Progress Note": "2026-09-14"}),
    # Emily Nguyen: weekly therapy, one of them before v3 took effect.
    inst("SI-007", "CL-100236", "SVC-001", "2026-09-17", done={"Psychotherapy Progress Note": "2026-09-17"}),
    inst("SI-008", "CL-100236", "SVC-001", "2026-06-25", done={"Psychotherapy Progress Note": "2026-06-25"}),
]

def main():
    data = {
        "_meta": {
            "description": "Admin > Service Builder seed: building block libraries, templates, versioned services, "
                           "staff specific security, and a few service instances for synthetic clients. Agency "
                           "configuration plus fictional client links only. 100% fictional.",
            "fields": {
                "templates": ["template_id", "name", "collection", "source", "updated", "config"],
                "services": ["service_id", "name", "started_from", "status", "created", "versions"],
                "versions": ["version", "effective", "changed", "changed_by", "note", "config"],
                "config": ["description", "roles", "programs", "sites", "codes", "payors", "funding", "dx_set",
                           "precedence", "sensitivity", "duration_min", "steps", "deadline_rule_id"],
                "steps": ["step_id", "kind", "name", "required", "rule_ids", "after"],
                "instances": ["instance_id", "client_id", "service_id", "version", "date_of_service", "anchor_date",
                              "started_by", "status", "steps"],
            },
        },
        "blocks": {
            "service_codes": [{"code_id": a, "code": b, "description": c, "unit": d} for a, b, c, d in SERVICE_CODES],
            "modifiers": [{"modifier": a, "description": b} for a, b in MODIFIERS],
            "diagnosis_sets": [{"set_id": a, "name": b, "codes": c} for a, b, c in DIAGNOSIS_SETS],
            "precedence": [{"precedence_id": a, "name": b, "description": c} for a, b, c in PRECEDENCE],
            "sensitivity": [{"sensitivity_id": a, "name": b, "requires_document": c} for a, b, c in SENSITIVITY],
            "documents": [{"name": a, "category": b, "default_rule_id": c} for a, b, c in DOCUMENTS],
            "appointment_types": [{"name": a, "default_rule_id": b} for a, b in APPOINTMENT_TYPES],
            "cpt_only_payors": CPT_ONLY,
        },
        "templates": TEMPLATES,
        "services": SERVICES,
        "staff_security": STAFF_SECURITY,
        "instances": INSTANCES,
    }
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("wrote", OUT.relative_to(ROOT), "·", len(TEMPLATES), "templates,", len(SERVICES), "services,", len(INSTANCES), "instances")

if __name__ == "__main__":
    main()
