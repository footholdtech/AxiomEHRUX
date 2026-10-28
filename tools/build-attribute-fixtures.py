#!/usr/bin/env python3
"""Generate the client-attribute tables behind the client header and the
Manage Attributes dialog.

  attribute_catalog.json            Radicle's standard attribute library: default
                                    names, icons, categories and suggestion rules
                                    that an agency admin picks from
  attribute_library.json            the agency's own list (admin-managed;
                                    clinicians pick from it, they can't add to it):
                                    standard entries it turned on, plus its own
  client_attribute_assignments.json which attributes are on which chart, with
                                    start/end dates and an audit trail

Extends the shared synthetic EHR reference dataset (ehr-synthetic-data skill).
The library keeps the seed's 15 `client_attributes.json` ids and adds more. 100%
fictional: every client_id / staff_id already exists in the seed. Deterministic,
so re-running gives byte-identical output.

Glyphs are keys into window.FLUENT / window.DSICONS (see
tools/fetch-attribute-icons.py). An `image` instead of an `icon` is a picture:
the standard nationality flags, or one an agency admin uploaded.

`suggest` drives "Suggested from the chart": an attribute is suggested when the
client has an ACTIVE diagnosis whose ICD-10 code starts with one of `icd10`, or
an ACTIVE problem-list entry named in `problems`. Suggestions are only ever
offered; nothing is applied automatically.

Run before tools/build-refdata.py.
"""
import json, pathlib, datetime as dt

HERE = pathlib.Path(__file__).resolve().parent
RD = HERE.parent / "fixtures" / "reference-data"
load = lambda n: json.loads((RD / n).read_text())["records"]
clients, staff = load("clients.json"), load("staff.json")
STAFF_IDS = [s["staff_id"] for s in staff]

TODAY = dt.date(2026, 9, 22)          # the app pins "today" to the same date

def seed(s):                           # FNV-1a, same hash as the app
    h = 2166136261
    for ch in str(s):
        h ^= ord(ch); h = (h * 16777619) & 0xFFFFFFFF
    return h

def write(name, description, fields, records):
    (RD / name).write_text(json.dumps(
        {"_meta": {"description": description, "fictional": True, "fields": fields},
         "records": records}, indent=2) + "\n")
    print(f"{name}: {len(records)} records")

# An uploaded image, standing in for what an admin would upload: a six-stripe
# pride flag. Its colours are the image's own content, not UI colour.
PRIDE_FLAG = ("data:image/svg+xml;utf8," + "".join([
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>",
    "<clipPath id='r'><rect x='2' y='4' width='16' height='12' rx='2'/></clipPath><g clip-path='url(%23r)'>",
    *[f"<rect x='2' y='{4 + i * 2}' width='16' height='2' fill='%23{c}'/>"
      for i, c in enumerate(["E40303", "FF8C00", "FFED00", "008026", "24408E", "732982"])],
    "</g></svg>"]))

# (id, name, category, glyph, suggest)
LIB = [
    ("ATTR-SPANISH", "Spanish Speaking", "Language & Communication", "flLocalLanguage", None),
    ("ATTR-INTERPRETER", "Requires Interpreter", "Language & Communication", "flTranslate", None),
    ("ATTR-DEAF", "Deaf / Hard of Hearing", "Language & Communication", "flHandLeftChat", None),
    ("ATTR-LOWVISION", "Blind / Low Vision", "Language & Communication", "flEyeOff", None),
    ("ATTR-DONOTMAIL", "Do Not Mail", "Contact Preferences", "flMailProhibited", None),
    ("ATTR-DONOTCALL", "Do Not Call", "Contact Preferences", "flCallProhibited", None),
    ("ATTR-NOCONTACT", "No-Contact Order", "Contact Preferences", "flPersonProhibited", None),
    ("ATTR-COURTORDERED", "Court Ordered Treatment", "Legal", "dsGavel", None),
    ("ATTR-PROBATION", "On Probation/Parole", "Legal", "dsGavel",
        {"problems": ["Involvement with Justice System"]}),
    ("ATTR-MINOR", "Minor / Requires Guardian Consent", "Legal", "flGuardian", None),
    ("ATTR-CONSERVATOR", "Conservatorship", "Legal", "flScales", None),
    ("ATTR-FOSTERCARE", "Foster Care Involvement", "Legal", "flHomePerson", None),
    ("ATTR-ALLERGY", "Known Medication Allergy", "Medical", "dsSyringe", None),
    ("ATTR-IMMUNO", "Immune System Compromised", "Medical", "flShieldError", {"icd10": ["B20", "D80", "D81", "D82", "D83", "D84"]}),
    ("ATTR-HIV", "HIV/AIDS", "Medical", "flRibbon", {"icd10": ["B20", "Z21"]}),
    ("ATTR-DIABETIC", "Diabetic", "Medical", "flDrop", {"icd10": ["E10", "E11", "E13"]}),
    ("ATTR-SICKLECELL", "Sickle Cell Disease", "Medical", "flStethoscope", {"icd10": ["D57"]}),
    ("ATTR-CARDIAC", "Cardiac Condition", "Medical", "flHeartPulse", {"icd10": ["I20", "I21", "I25", "I50"]}),
    ("ATTR-TBI", "Traumatic Brain Injury", "Medical", "flBrain", {"icd10": ["S06"]}),
    ("ATTR-PREGNANT", "Pregnant / Postpartum", "Medical", "flHeart", {"icd10": ["O", "Z33", "Z34", "Z39"]}),
    ("ATTR-SUBSTANCE", "Substance Abuse", "Behavioral Health", "flPill",
        {"icd10": ["F10", "F11", "F12", "F13", "F14", "F15", "F16", "F18", "F19"]}),
    ("ATTR-TOBACCO", "Tobacco Use", "Behavioral Health", "flProhibitedSmoking", {"icd10": ["F17"]}),
    ("ATTR-HIGHRISK", "High Risk Flag", "Safety", "dsWarning",
        {"problems": ["Suicidal Ideation", "Homicidal Ideation", "Non-Suicidal Self-Injury"]}),
    ("ATTR-AGGRESSION", "Aggression", "Safety", "flPersonWarning", None),
    ("ATTR-VIOLENCE", "History of Violence", "Safety", "flAlertUrgent", None),
    ("ATTR-ELOPEMENT", "Elopement Risk", "Safety", "flPersonRunning", None),
    ("ATTR-UNHOUSED", "Unhoused", "Social Needs", "flTent",
        {"icd10": ["Z59.0"], "problems": ["Housing Instability / Homelessness"]}),
    ("ATTR-FOOD", "Needs Food Assistance", "Social Needs", "flFood",
        {"icd10": ["Z59.4"], "problems": ["Food Insecurity"]}),
    ("ATTR-TRANSPORT", "Needs Transportation", "Social Needs", "flVehicleBus", None),
    ("ATTR-FINANCIAL", "Financial Assistance", "Social Needs", "flMoneyHand", None),
    ("ATTR-WHEELCHAIR", "Requires Wheelchair Access", "Accessibility", "flWheelchairAccess", None),
    ("ATTR-GUIDEDOG", "Guide Dog", "Accessibility", "flAnimalDog", None),
    ("ATTR-ACCOMMODATION", "Disability Accommodation", "Accessibility", "flAccessibility", None),
    ("ATTR-INPT-TRANSFER", "Inpatient Transfer", "Care Coordination", "flArrowSwap", None),
    ("ATTR-HFW-WAITLIST", "HFW Waitlist", "Care Coordination", "flHourglassHalf", None),
    ("ATTR-SCHOOL", "School-Based Services", "Care Coordination", "flHatGraduation", None),
    ("ATTR-RESTRICTED", "Restricted Record", "Care Coordination", "flLockClosed", None),
    ("ATTR-VETERAN", "Veteran Status", "Demographic", "flMedal", None),
    ("ATTR-LGBTQ", "LGBTQ+ Identified", "Demographic", None, None),   # uploaded image
]
# Standard entries an agency hasn't turned on yet, so the admin library has a
# real range to pick from. Same shape as LIB.
EXTRA = [
    ("ATTR-IMMIGRANT", "Immigrant / Refugee", "Nationality & Immigration", "flGlobePerson", None),
    ("ATTR-TRANSIENT", "Transient / Temporary Stay", "Social Needs", "flLuggage", None),
    ("ATTR-RESIDENTIAL", "Residential Placement", "Care Coordination", "flBed", None),
    ("ATTR-CAREGIVER", "Primary Caregiver", "Social Needs", "flPersonHeart", {"problems": ["Caregiver Strain"]}),
    ("ATTR-LEARNING", "Special Learning Needs", "Accessibility", "flBookOpenLightbulb", None),
    ("ATTR-LITERACY", "Low Literacy", "Language & Communication", "flBookExclamationMark", None),
    ("ATTR-NONVERBAL", "Nonverbal / Limited Speech", "Language & Communication", "flMicOff", None),
    ("ATTR-NOPHONE", "No Phone Access", "Contact Preferences", "flPhoneDismiss", None),
    ("ATTR-NOINTERNET", "No Internet Access", "Contact Preferences", "flWiFiOff", None),
    ("ATTR-AMPUTEE", "Amputee / Limb Difference", "Accessibility", "flHandRightOff", {"icd10": ["Z89"]}),
    ("ATTR-ESA", "Emotional Support Animal", "Accessibility", "flAnimalCat", None),
    ("ATTR-SOUND", "Sound Sensitivity", "Accessibility", "flSpeakerOff", None),
    ("ATTR-FALLRISK", "Fall Risk", "Safety", "flPersonWalking", None),
    ("ATTR-DV", "Domestic Violence Survivor", "Safety", "flShieldPerson", {"problems": ["Domestic Violence Exposure"]}),
    ("ATTR-SEIZURE", "Seizure Disorder", "Medical", "flFlash", {"icd10": ["G40"]}),
    ("ATTR-TIMEDMED", "Time-Critical Medication", "Medical", "flClockAlarm", None),
    ("ATTR-DIET", "Dietary Restrictions", "Medical", "flFoodApple", None),
    ("ATTR-DISTRESS", "Severe Mental Distress", "Behavioral Health", "flWeatherThunderstorm", None),
    ("ATTR-GRIEF", "Grief / Bereavement", "Behavioral Health", "flHeartBroken", {"problems": ["Unresolved Grief / Bereavement"]}),
    ("ATTR-TRAUMA", "Trauma-Informed Approach", "Behavioral Health", "flHeartCircle", {"icd10": ["F43.1"]}),
    ("ATTR-FEAR-NEEDLES", "Fear of Needles", "Phobias", "flSyringe", None),
    ("ATTR-FEAR-DOGS", "Fear of Dogs", "Phobias", "flAnimalPawPrint", None),
    ("ATTR-FEAR-ENCLOSED", "Fear of Enclosed Spaces", "Phobias", "flDoor", None),
    ("ATTR-FEAR-HEIGHTS", "Fear of Heights", "Phobias", "flBuildingSkyscraper", None),
]
# Nationality flags, drawn as small images (flags are colour; a glyph can't be).
# Civil flags without coats of arms, where that is a real flag in its own right.
def flag(bands, vertical=False, star=None, weights=None):
    w = weights or [1] * len(bands); tot = sum(w); parts, pos = [], 0.0
    for c, k in zip(bands, w):
        size = (16 if vertical else 12) * k / tot
        parts.append(f"<rect x='{2 + pos:.2f}' y='4' width='{size + 0.05:.2f}' height='12' fill='%23{c}'/>" if vertical
                     else f"<rect x='2' y='{4 + pos:.2f}' width='16' height='{size + 0.05:.2f}' fill='%23{c}'/>")
        pos += size
    if star:
        import math
        pts = " ".join(f"{10 + (3.6 if i % 2 == 0 else 1.45) * math.sin(math.pi * i / 5):.2f},"
                       f"{10 - (3.6 if i % 2 == 0 else 1.45) * math.cos(math.pi * i / 5):.2f}" for i in range(10))
        parts.append(f"<polygon points='{pts}' fill='%23{star}'/>")
    return ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>"
            "<clipPath id='r'><rect x='2' y='4' width='16' height='12' rx='2'/></clipPath>"
            f"<g clip-path='url(%23r)'>{''.join(parts)}</g></svg>")
FLAGS = [
    ("ATTR-NAT-CO", "Nationality: Colombia", flag(["FCD116", "003893", "CE1126"], weights=[2, 1, 1])),
    ("ATTR-NAT-SV", "Nationality: El Salvador", flag(["0F47AF", "FFFFFF", "0F47AF"])),
    ("ATTR-NAT-GT", "Nationality: Guatemala", flag(["4997D0", "FFFFFF", "4997D0"], vertical=True)),
    ("ATTR-NAT-HT", "Nationality: Haiti", flag(["00209F", "D21034"])),
    ("ATTR-NAT-NG", "Nationality: Nigeria", flag(["008751", "FFFFFF", "008751"], vertical=True)),
    ("ATTR-NAT-SO", "Nationality: Somalia", flag(["4189DD"], star="FFFFFF")),
    ("ATTR-NAT-UA", "Nationality: Ukraine", flag(["0057B7", "FFD700"])),
    ("ATTR-NAT-VN", "Nationality: Vietnam", flag(["DA251D"], star="FFFF00")),
]
# Canada: red–white–red (1:2:1) with a simplified maple leaf.
LEAF = [(0,-1),(.15,-.7),(.35,-.8),(.3,-.35),(.6,-.55),(.55,-.4),(.85,-.45),(.75,-.15),(.85,-.05),(.45,.25),(.5,.4),
        (.08,.35),(.08,.8),(-.08,.8),(-.08,.35),(-.5,.4),(-.45,.25),(-.85,-.05),(-.75,-.15),(-.85,-.45),(-.55,-.4),
        (-.6,-.55),(-.3,-.35),(-.35,-.8),(-.15,-.7)]
CANADA = flag(["D52B1E", "FFFFFF", "D52B1E"], vertical=True, weights=[1, 2, 1]).replace(
    "</g></svg>", "<polygon points='" + " ".join(f"{10 + 3.3 * x:.2f},{10.2 + 3.3 * y:.2f}" for x, y in LEAF)
    + "' fill='%23D52B1E'/></g></svg>")

# Agency-made attributes with uploaded images: the school-based case. A school
# or grade level is quick to recognise as a mark, and nothing in a standard
# library could know an agency's schools. Fictional schools; colours are each
# image's own content.
def badge(inner, bg, shape="rect"):
    frame = (f"<rect x='1' y='1' width='18' height='18' rx='4' fill='%23{bg}'/>" if shape == "rect" else
             f"<circle cx='10' cy='10' r='9' fill='%23{bg}'/>" if shape == "circle" else
             f"<path d='M10 1 L18 4 V10 C18 14.5 14.5 17.6 10 19 C5.5 17.6 2 14.5 2 10 V4 Z' fill='%23{bg}'/>")
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>" + frame + inner + "</svg>"
def letters(s, fg, size):
    return (f"<text x='10' y='{10 + size * 0.36:.1f}' font-family='Arial,Helvetica,sans-serif' font-weight='700' "
            f"font-size='{size}' text-anchor='middle' fill='%23{fg}'>{s}</text>")
PAW = ("<g fill='%23F28C28'><ellipse cx='10' cy='12.6' rx='3.6' ry='3'/><ellipse cx='5.6' cy='8.6' rx='1.5' ry='1.9'/>"
       "<ellipse cx='8.3' cy='6.3' rx='1.5' ry='1.9'/><ellipse cx='11.7' cy='6.3' rx='1.5' ry='1.9'/><ellipse cx='14.4' cy='8.6' rx='1.5' ry='1.9'/></g>")
BOLT = "<polygon points='11.5,3 5.5,11 9.5,11 8,17 14.5,8.6 10.5,8.6' fill='%23FFD23F'/>"
STAR = "<polygon points='10,3.5 11.9,8 16.6,8.2 12.9,11.1 14.2,15.7 10,13 5.8,15.7 7.1,11.1 3.4,8.2 8.1,8' fill='%23FFFFFF'/>"
SCHOOL = [
    ("ATTR-SCH-LINCOLN", "Lincoln Elementary", badge(letters("LE", "F5C518", 8.5), "1F3A68", "shield")),
    ("ATTR-SCH-WESTVIEW", "Westview Middle Wildcats", badge(PAW, "1C1C1C", "circle")),
    ("ATTR-SCH-EASTLAKE", "Eastlake High Lightning", badge(BOLT, "4B2C83", "circle")),
    ("ATTR-SCH-NORTHSIDE", "Northside Stars Academy", badge(STAR, "0B7A75", "rect")),
    ("ATTR-EDU-IEP", "IEP in Place", badge(letters("IEP", "FFFFFF", 7), "2E6DB4")),
    ("ATTR-EDU-504", "504 Plan", badge(letters("504", "FFFFFF", 7), "6A4C93")),
    ("ATTR-EDU-G4", "Grade 4", badge(letters("G4", "1F3A68", 8.5), "BFE3F5")),
    ("ATTR-EDU-G9", "Grade 9", badge(letters("G9", "4B2C83", 8.5), "E3D7F5")),
]
# Made by this agency, not from the standard library.
CUSTOM = {"ATTR-HFW-WAITLIST"}
# Turned off by this agency's admin: not selectable any more, still on the
# charts that already had it.
INACTIVE = {"ATTR-TOBACCO"}

# How an attribute comes off a chart — an admin setting per attribute.
#   "remove":   a clinician can remove it (it stays in the audit trail)
#   "end-date": it can only end by setting an end date, e.g. a court order
END_DATE_ONLY = {"ATTR-COURTORDERED", "ATTR-PROBATION", "ATTR-CONSERVATOR", "ATTR-MINOR", "ATTR-NOCONTACT"}
# The note topic preselected when a clinician adds an internal note from the
# attribute (still editable). Topics are the prototype's NOTE_TOPICS list.
NOTE_TOPIC = {
    "ATTR-SPANISH": "Care coordination", "ATTR-INTERPRETER": "Care coordination", "ATTR-DEAF": "Care coordination",
    "ATTR-LOWVISION": "Care coordination", "ATTR-DONOTMAIL": "Contact information", "ATTR-DONOTCALL": "Contact information",
    "ATTR-NOCONTACT": "Court / legal", "ATTR-COURTORDERED": "Court / legal", "ATTR-PROBATION": "Court / legal",
    "ATTR-MINOR": "Guardian", "ATTR-CONSERVATOR": "Guardian", "ATTR-FOSTERCARE": "Guardian",
    "ATTR-ALLERGY": "Allergies", "ATTR-SUBSTANCE": "Substance use", "ATTR-TOBACCO": "Substance use",
    "ATTR-UNHOUSED": "Housing", "ATTR-TRANSPORT": "Transportation", "ATTR-INPT-TRANSFER": "Hospital discharge",
    "ATTR-HFW-WAITLIST": "Referrals",
}
def entry(aid, name, cat, glyph, suggest, image=None):
    return {"name": name, "category": cat, "icon": glyph, "image": image,
            "suggest": suggest or {}, "removal": "end-date" if aid in END_DATE_ONLY else "remove",
            "note_topic": NOTE_TOPIC.get(aid, "Other")}
catalog = []
for aid, name, cat, glyph, suggest in LIB + EXTRA:
    if aid in CUSTOM: continue
    catalog.append({"catalog_id": aid.replace("ATTR-", "STD-"),
                    **entry(aid, name, cat, glyph, suggest, PRIDE_FLAG if aid == "ATTR-LGBTQ" else None)})
for aid, name, img in FLAGS:
    catalog.append({"catalog_id": aid.replace("ATTR-", "STD-"), **entry(aid, name, "Nationality & Immigration", None, None, img)})
catalog.append({"catalog_id": "STD-FRENCH", **entry("ATTR-FRENCH", "French Speaking", "Language & Communication", None, None, CANADA)})
catalog.sort(key=lambda r: (r["category"], r["name"]))

library = []
for aid, name, cat, glyph, suggest in LIB:
    library.append({"attribute_id": aid, "catalog_id": None if aid in CUSTOM else aid.replace("ATTR-", "STD-"),
                    "source": "custom" if aid in CUSTOM else "standard",
                    **entry(aid, name, cat, glyph, suggest, PRIDE_FLAG if aid == "ATTR-LGBTQ" else None),
                    "status": "Inactive" if aid in INACTIVE else "Active"})
# A few standard images the agency has turned on, so flags show in the list.
ON_FROM_CATALOG = ["STD-FRENCH", "STD-NAT-HT", "STD-NAT-UA", "STD-NAT-VN"]
for c in catalog:
    if c["catalog_id"] in ON_FROM_CATALOG:
        library.append({"attribute_id": c["catalog_id"].replace("STD-", "ATTR-"), "catalog_id": c["catalog_id"], "source": "standard",
                        **{k: v for k, v in c.items() if k != "catalog_id"}, "status": "Active"})
for aid, name, img in SCHOOL:
    library.append({"attribute_id": aid, "catalog_id": None, "source": "custom",
                    **entry(aid, name, "Education", None, None, img), "status": "Active"})
# Random chart picks only draw on the original list: school and nationality
# attributes need a real reason to be on a chart.
LIB_IDS = [aid for aid, *_ in LIB if aid not in INACTIVE]

# ---- Assignments --------------------------------------------------------
def at(d, hhmm="09:00"): return f"{d.isoformat()}T{hhmm}"
def days(n): return TODAY - dt.timedelta(days=n)

def event(action, when, by, start=None, end=None, reason=None):
    return {"action": action, "at": when, "by_staff_id": by,
            "start_date": start, "end_date": end, "reason": reason}

rows, n = [], 0
def assign(cid, aid, start, end=None, by=None, added=None, history=None, removed=False):
    global n
    n += 1
    by = by or STAFF_IDS[seed(cid + aid) % len(STAFF_IDS)]
    added = added or at(min(start, TODAY), f"{8 + seed(cid + aid + 'h') % 8:02d}:{seed(cid + aid + 'm') % 60:02d}")
    hist = [event("added", added, by, start.isoformat(), end.isoformat() if end else None)] + (history or [])
    rows.append({"assignment_id": f"CA-{n:04d}", "client_id": cid, "attribute_id": aid,
                 "start_date": start.isoformat(), "end_date": end.isoformat() if end else None,
                 "added_by_staff_id": by, "added_at": added, "removed": removed, "history": hist})

DEMO = "CL-100235"   # DeShawn "Dee" Carter — the walkthrough client
for c in clients:
    cid = c["client_id"]
    if cid == DEMO:
        # One of each state the dialog has to show: active with a planned end,
        # active open-ended, scheduled, ended, and removed in error. Left off on
        # purpose so they appear as suggestions: Substance Abuse (active F10.20),
        # Unhoused and High Risk Flag (active problems).
        assign(cid, "ATTR-COURTORDERED", dt.date(2025, 11, 3), dt.date(2027, 5, 3), by="ST-2004",
               added=at(dt.date(2025, 11, 3), "10:12"),
               history=[event("dates", at(dt.date(2026, 2, 10), "14:40"), "ST-2007", "2025-11-03", "2027-05-03",
                              "End date set from the court order")])
        rows[-1]["history"][0]["end_date"] = None
        assign(cid, "ATTR-ALLERGY", dt.date(2024, 6, 12), by="ST-2008", added=at(dt.date(2024, 6, 12), "08:31"))
        assign(cid, "ATTR-INPT-TRANSFER", TODAY + dt.timedelta(days=6), TODAY + dt.timedelta(days=20),
               by="ST-2006", added=at(days(1), "16:05"))
        assign(cid, "ATTR-DONOTCALL", dt.date(2025, 1, 15), dt.date(2026, 3, 1), by="ST-2009",
               added=at(dt.date(2025, 1, 15), "11:20"),
               history=[event("ended", at(dt.date(2026, 3, 1), "09:47"), "ST-2003", "2025-01-15", "2026-03-01",
                              "Client asked to be called again")])
        assign(cid, "ATTR-VETERAN", dt.date(2026, 5, 4), by="ST-2009", added=at(dt.date(2026, 5, 4), "13:02"),
               removed=True,
               history=[event("removed", at(dt.date(2026, 5, 6), "15:18"), "ST-2010", "2026-05-04", None,
                              "Entered in error")])
        continue
    enrolled = dt.date.fromisoformat(c.get("enrollment_date") or "2025-01-01")
    picked = set()
    if (c.get("primary_language") or "English") != "English":
        assign(cid, "ATTR-INTERPRETER", enrolled); picked.add("ATTR-INTERPRETER")
        if c.get("primary_language") == "Spanish":
            assign(cid, "ATTR-SPANISH", enrolled); picked.add("ATTR-SPANISH")
    years = (TODAY - dt.date.fromisoformat(c["dob"])).days // 365
    unfit = {"ATTR-HFW-WAITLIST", "ATTR-INPT-TRANSFER", "ATTR-LGBTQ"}   # not something to scatter at random
    if c.get("gender") != "Female": unfit.add("ATTR-PREGNANT")
    if years >= 18: unfit |= {"ATTR-MINOR", "ATTR-SCHOOL", "ATTR-FOSTERCARE"}
    else: unfit |= {"ATTR-VETERAN", "ATTR-CONSERVATOR", "ATTR-PROBATION"}
    pool = [a for a in LIB_IDS if a not in picked and a not in unfit]
    for i in range(1 + seed(cid) % 3):
        aid = pool[seed(cid + "p" + str(i)) % len(pool)]
        if aid in picked: continue
        picked.add(aid)
        start = enrolled + dt.timedelta(days=seed(cid + aid) % 200)
        start = min(start, days(3))
        assign(cid, aid, start)
    if seed(cid + "ended") % 2:      # about half the charts carry one ended attribute
        aid = pool[seed(cid + "e") % len(pool)]
        if aid not in picked:
            start = days(300 + seed(cid + "es") % 200); end = days(20 + seed(cid + "ee") % 100)
            who = STAFF_IDS[seed(cid + "ew") % len(STAFF_IDS)]
            assign(cid, aid, start, end,
                   history=[event("ended", at(end, "10:00"), who, start.isoformat(), end.isoformat(), None)])

# The inactive one is still on a chart, so the admin page can say so.
assign("CL-100243", "ATTR-TOBACCO", dt.date(2025, 3, 18), by="ST-2008", added=at(dt.date(2025, 3, 18), "10:40"))

write("attribute_catalog.json",
      "Radicle's standard client attribute library: default names, icons, categories, "
      "suggestion rules, removal rule and note topic. Agency admins turn entries on for "
      "their staff (see attribute_library.json). `image` is used where a glyph can't work "
      "(flags).",
      ["catalog_id", "name", "category", "icon", "image", "suggest", "removal", "note_topic"], catalog)
write("attribute_library.json",
      "The agency's client attributes: standard entries it turned on (catalog_id) and its "
      "own (source custom). Managed by administrators; clinicians apply "
      "attributes from it and can't create new ones. `icon` is a glyph key, `image` an "
      "uploaded picture (data URI). `suggest` lists ICD-10 prefixes and problem names that "
      "make the attribute a suggestion when active on the chart. `removal` is remove | end-date. "
      "`note_topic` preselects the topic of a note added from the attribute.",
      ["attribute_id", "catalog_id", "source", "name", "category", "icon", "image", "suggest", "removal",
       "note_topic", "status"], library)
write("client_attribute_assignments.json",
      "Attributes applied to client charts, with effective dates and an audit trail. "
      "An attribute is active from start_date through end_date (inclusive); null end_date "
      "means open-ended. `removed` marks an entry removed as entered in error; it stays "
      "for the audit trail. History actions: added, dates, ended, removed.",
      ["assignment_id", "client_id", "attribute_id", "start_date", "end_date", "added_by_staff_id",
       "added_at", "removed", "history"], rows)
