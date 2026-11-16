#!/usr/bin/env python3
"""Generate due_date_rules.json: Admin > Due Date Rules seed data.

Two things, neither of them client data:

  program_populations  Which populations each program in programs.json
                       serves. programs.json has no population field, and a
                       rule scoped to "all child programs" needs one. A rule
                       scoped to a population resolves to whatever programs
                       carry that tag, so a new child program joins it without
                       anyone editing the rule.
  rules                Twelve due date rules, named the way an admin would name
                       them: the brief's two (IBHIS CANS every 6 months for
                       child programs; an annual consent for all programs) and
                       the shapes an agency typically needs around them.

Which services use which rule is NOT here. A service subscribes to rules
(see tools/build-service-fixtures.py and services.json); a rule doesn't
know its services. The Due Date Rules page derives "Applied To" from the
services.

All configuration, all fictional. Program and staff ids come from the shared
synthetic dataset. Deterministic. Run before tools/build-refdata.py.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "fixtures" / "reference-data" / "due_date_rules.json"

POPULATIONS = ["Children & youth", "Transition-age youth", "Adults", "Older adults"]

PROGRAM_POPULATIONS = [
    {"program_id": "PRG-GEN-THX", "populations": ["Children & youth", "Adults"]},   # individual/family therapy
    {"program_id": "PRG-OUTP-01", "populations": ["Adults", "Older adults"]},
    {"program_id": "PRG-COUNSEL", "populations": ["Transition-age youth", "Adults"]},
    {"program_id": "PRG-RES-01", "populations": ["Adults"]},
    {"program_id": "PRG-IOP-01", "populations": ["Transition-age youth", "Adults"]},
    {"program_id": "PRG-CRISIS-01", "populations": ["Children & youth", "Transition-age youth", "Adults", "Older adults"]},
    {"program_id": "PRG-PEER-01", "populations": ["Adults", "Older adults"]},
]

def rule(rid, name, *, first, anchor, repeat, warn, scope, status="active",
         cancel=False, override=False, updated="2026-08-14", by="ST-2010"):
    return {
        "rule_id": rid, "name": name, "status": status,
        "first_due": {"n": first[0], "unit": first[1]}, "anchor": anchor,
        "repeat": None if repeat is None else {"n": repeat[0], "unit": repeat[1]},
        "warn": {"n": warn[0], "unit": warn[1]},
        "scope": scope,
        "allow_cancel": cancel, "allow_start_override": override,
        "updated": updated, "updated_by_staff_id": by,
    }

ALL = {"type": "all"}
CHILD = {"type": "population", "population": "Children & youth"}
ADULT = {"type": "population", "population": "Adults"}
HIGH_ACUITY = {"type": "programs", "programs": ["PRG-CRISIS-01", "PRG-IOP-01"]}

RULES = [
    rule("DDR-001", "IBHIS CANS Reassessment", first=(6, "months"), anchor="ibhis-enroll",
         repeat=(6, "months"), warn=(30, "days"), scope=CHILD, updated="2026-07-02"),
    rule("DDR-002", "Standard Annual Consent", first=(12, "months"), anchor="program-enroll",
         repeat=(12, "months"), warn=(2, "months"), scope=ALL, updated="2026-06-18"),
    rule("DDR-003", "Service Plan Review", first=(30, "days"), anchor="program-enroll",
         repeat=(6, "months"), warn=(14, "days"), scope=ALL, override=True, updated="2026-08-14"),
    rule("DDR-004", "Post-Discharge Follow-Up", first=(7, "days"), anchor="discharge", repeat=None,
         warn=(2, "days"), scope=ALL, cancel=True, updated="2026-05-30", by="ST-2007"),
    rule("DDR-005", "First Contact After Assignment", first=(10, "days"), anchor="assignment",
         repeat=None, warn=(3, "days"), scope=ALL, updated="2026-04-11", by="ST-2007"),
    rule("DDR-006", "Post Reassignment Satisfaction", first=(30, "days"), anchor="reassignment",
         repeat=None, warn=(7, "days"), scope=ALL, cancel=True, updated="2026-04-11", by="ST-2007"),
    rule("DDR-007", "Quarterly Adult Screening", first=(3, "months"), anchor="client-enroll",
         repeat=(3, "months"), warn=(14, "days"), scope=ADULT, updated="2026-03-03"),
    rule("DDR-008", "Bi-Weekly High Acuity Assessments", first=(2, "weeks"), anchor="program-enroll",
         repeat=(2, "weeks"), warn=(2, "days"), scope=HIGH_ACUITY, updated="2026-09-01"),
    # Retired: replaced by First Contact After Assignment. No service uses it
    # any more, so it is the one rule that can be deleted.
    rule("DDR-009", "Intake Assessment (Retired)", first=(30, "days"), anchor="referral",
         repeat=None, warn=(7, "days"), scope=ALL, status="inactive", updated="2026-01-20"),
    # Service deadlines: a workflow service (an intake, a discharge) uses one
    # of these for the whole container, on top of each step's own rules.
    rule("DDR-010", "Crisis Intake Within 5 Days", first=(5, "days"), anchor="referral", repeat=None,
         warn=(2, "days"), scope=ALL, updated="2026-05-01", by="ST-2007"),
    rule("DDR-011", "Intake Within 14 Days", first=(14, "days"), anchor="referral", repeat=None,
         warn=(4, "days"), scope=ALL, updated="2026-05-01", by="ST-2007"),
    rule("DDR-012", "Discharge Paperwork Within 3 Days", first=(3, "days"), anchor="discharge", repeat=None,
         warn=(1, "days"), scope=ALL, updated="2026-05-01", by="ST-2007"),
]

def main():
    data = {
        "_meta": {
            "description": "Admin > Due Date Rules seed: when documentation is due relative to a service date, "
                           "how often, and how early staff are warned; plus the populations each program serves. "
                           "Agency configuration only; no client data. 100% fictional.",
            "fields": {
                "rules": ["rule_id", "name", "status", "first_due", "anchor", "repeat", "warn", "scope",
                          "allow_cancel", "allow_start_override", "updated", "updated_by_staff_id"],
                "program_populations": ["program_id", "populations"],
            },
        },
        "populations": POPULATIONS,
        "program_populations": PROGRAM_POPULATIONS,
        "rules": RULES,
    }
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    print("wrote", OUT.relative_to(ROOT), "·", len(RULES), "rules")

if __name__ == "__main__":
    main()
