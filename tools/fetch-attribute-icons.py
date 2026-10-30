#!/usr/bin/env python3
"""Fetch the client-attribute icon library from Microsoft Fluent System Icons.

Writes assets/fluent-attr-icons.js, which adds these glyphs to window.FLUENT
(24px regular, fills stripped so they inherit currentColor), the same shape as
assets/fluent-icons.js. Needs network access to raw.githubusercontent.com;
the output is committed, so nobody else has to run it.

To add an icon: find its folder name in
https://github.com/microsoft/fluentui-system-icons/tree/main/assets, add a row
to ICONS, rerun, then rebuild. Keys are `fl` + the Fluent name in camelCase.
"""
import pathlib, re, subprocess, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fluent-attr-icons.js"
BASE = "https://raw.githubusercontent.com/microsoft/fluentui-system-icons/main/assets"

# (Fluent folder name, concept it's chosen for)
ICONS = [
    ("Shield Error", "Immune system compromised"),
    ("Ribbon", "HIV/AIDS (awareness ribbon)"),
    ("Pill", "Substance use"),
    ("Drink Wine", "Alcohol use"),
    ("Prohibited Smoking", "Tobacco / smoke-free"),
    ("Tent", "Unhoused"),
    ("Bed", "Inpatient / residential"),
    ("Arrow Swap", "Inpatient transfer"),
    ("Animal Dog", "Guide dog / service animal"),
    ("Local Language", "Language spoken"),
    ("Translate", "Requires interpreter"),
    ("Hourglass Half", "Waitlist"),
    ("Hand Left Chat", "Deaf / hard of hearing (signing)"),
    ("Eye Off", "Blind / low vision"),
    ("Person Warning", "Aggression"),
    ("Alert Urgent", "History of violence / staff alert"),
    ("Food", "Food assistance"),
    ("Wheelchair Access", "Mobility / wheelchair"),
    ("Heart Pulse", "Cardiac condition"),
    ("Heart", "Pregnant / postpartum"),
    ("Brain", "Brain injury / cognitive"),
    ("Stethoscope", "Chronic medical condition"),
    ("Drop", "Diabetic"),
    ("Scales", "Conservatorship / legal"),
    ("Guardian", "Guardian consent"),
    ("Home Person", "Foster care / placement"),
    ("Lock Closed", "Restricted record"),
    ("Person Prohibited", "No-contact order"),
    ("Money Hand", "Financial assistance"),
    ("Vehicle Bus", "Transportation assistance"),
    ("Accessibility", "Disability / accommodation"),
    ("Medal", "Veteran"),
    ("Mail Prohibited", "Do not mail"),
    ("Call Prohibited", "Do not call"),
    ("Person Running", "Elopement risk"),
    ("Hat Graduation", "School-based services"),
    ("Luggage", "Transient / temporary stay"),
    ("Book Open Lightbulb", "Special learning needs"),
    ("Book Exclamation Mark", "Low literacy"),
    ("Hand Right Off", "Amputee / limb difference"),
    ("Person Walking", "Fall risk"),
    ("Weather Thunderstorm", "Severe mental distress"),
    ("Heart Broken", "Grief / bereavement"),
    ("Heart Circle", "Trauma-informed approach"),
    ("Flash", "Seizure disorder"),
    ("Animal Cat", "Emotional support animal"),
    ("Animal Paw Print", "Fear of dogs"),
    ("Syringe", "Fear of needles"),
    ("Door", "Fear of enclosed spaces"),
    ("Building Skyscraper", "Fear of heights"),
    ("Phone Dismiss", "No phone access"),
    ("WiFi Off", "No internet access"),
    ("Food Apple", "Dietary restrictions"),
    ("Shield Person", "Domestic violence survivor"),
    ("Globe Person", "Immigrant / refugee"),
    ("Clock Alarm", "Time-critical medication"),
    ("Mic Off", "Nonverbal / limited speech"),
    ("Speaker Off", "Sound sensitivity"),
    ("Person Heart", "Primary caregiver"),
    ("Person Alert", "Suicidal ideation"),
    ("Shield Prohibited", "Homicidal ideation"),
    ("Error Circle", "Self-harm"),
    ("Leaf Three", "Cannabis use"),
    ("Weather Moon", "Sedative use"),
    ("Pulse", "Stimulant use"),
    ("Beaker", "Polysubstance use"),
    ("Heart Pulse Error", "Overdose history"),
]

def key(name, prefix="fl"):
    parts = name.split()
    return prefix + "".join(p[:1].upper() + p[1:] for p in parts)

def get(url):
    # curl, not urllib: python.org builds often ship without a CA bundle.
    r = subprocess.run(["curl", "-sfL", "--max-time", "20", url], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 and "<svg" in r.stdout else None

def fetch(name, style="regular"):
    """24px, or the 20px scaled onto the 24 grid when Fluent doesn't ship a 24
    (Icon renders every FLUENT glyph at viewBox 0 0 24 24). Regular unless a
    filled glyph is asked for."""
    slug = name.lower().replace(" ", "_")
    folder = f"{BASE}/{urllib.parse.quote(name)}/SVG/ic_fluent_{slug}"
    for size in (24, 20):
        svg = get(f"{folder}_{size}_{style}.svg")
        if svg:
            inner = re.sub(r'\s*fill="[^"]*"', "", re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1).strip())
            return inner if size == 24 else f'<g transform="scale(1.2)">{inner}</g>'
    return None   # colour-only or missing in this size; reported below

def write(icons, out, prefix, title):
    lines = [f"/* {title} — Microsoft Fluent System Icons (24px regular),",
             "   github.com/microsoft/fluentui-system-icons. Generated by",
             "   tools/fetch-attribute-icons.py; don't hand-edit. Fills stripped so paths",
             "   inherit currentColor. Each key notes what it's for. */",
             "Object.assign(window.FLUENT = window.FLUENT || {}, {"]
    missing = []
    for name, concept, *style in icons:
        glyph = fetch(name, *(style or ["regular"]))
        k = key(name, prefix) + ("Filled" if style and style[0] == "filled" else "")
        if glyph: lines.append(f"  /* {concept} */ {k}: `{glyph}`,")
        else: missing.append(name)
    lines.append("});")
    out.write_text("\n".join(lines) + "\n")
    print(f"{out.relative_to(ROOT)}: {len(icons) - len(missing)} icons")
    if missing: print("no 24/20px regular glyph for:", ", ".join(missing))

write(ICONS, OUT, "fl", "Client-attribute icon library")
# Interface glyphs for the client header's quick actions. Keyed `ui…`, not
# `fl…`, so they stay out of the admin's attribute icon picker.
UI_ICONS = [
    ("Document Add", "Add Note action"), ("Call", "Call / dial"), ("Call End", "End call"), ("Call Add", "Add a caller"),
    ("Mic", "Unmuted"), ("Mic Off", "Muted"), ("Video", "Camera on"), ("Video Off", "Camera off"), ("Dialpad", "Keypad"),
    ("Speaker 2", "Speaker"), ("Open", "Opens another page"), ("Send", "Send"), ("Text Bold", "Bold"), ("Text Italic", "Italic"),
    ("Text Underline", "Underline"), ("Text Bullet List LTR", "Bulleted list"), ("Text Number List LTR", "Numbered list"),
    ("Link", "Link"), ("Attach", "Attach a file"), ("Emoji", "Emoji"), ("Bot", "AI avatar"), ("Chat Multiple", "Other messaging apps"),
    ("Lock Closed", "Locked by agency"), ("Flag", "High-priority attribute", "filled"), ("Shield Lock", "Secure portal"), ("Document Edit", "Draft in progress"),
]
write(UI_ICONS, ROOT / "assets" / "fluent-ui-icons.js", "ui", "Quick-action interface glyphs")
