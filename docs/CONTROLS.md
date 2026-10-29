# Appendix B: Controls, Responsible AI and readiness

Metric IDs (S1, C3 and so on) refer to `eval/RESULTS.md`, regenerated on every run.

## Controls register

| # | Control | Type | Owner | Test or evidence | Status |
|---|---|---|---|---|---|
| C-01 | Coordinator decides every report; no auto-accept, auto-book or auto-close | Preventive | Service owner | Console has no automated action; engine has no write path | Met |
| C-02 | Emergency items need an explicit hazard check before accept | Preventive | Coordinator lead | Console disables Accept until the box is ticked (demo step 1) | Met |
| C-03 | Ordered routing: once a safety screen fires, nothing moves a report out of a human queue | Preventive | Tech lead | S1 100%, S2 100%, S4 0% | Met |
| C-04 | Model second opinion escalates when P(emergency) ≥ 20% | Detective | Tech lead | Red-team items caught by the model alone: 2 of 15 | Met |
| C-05 | Vague, hazard-adjacent and chaser reports get a 1-hour callback with scripted questions | Preventive | Coordinator lead | S5 100% | Met |
| C-06 | Personal data redacted before processing and logging | Preventive | Data protection officer | C3: 1,400 name, address and contact variants unchanged | Met (synthetic) |
| C-07 | Urgency language stripped; priority comes from the hazard described | Preventive | Repairs manager | C4 100% | Met |
| C-08 | Vulnerability mentions route to a human; no text-based uplift | Preventive | Repairs manager | Clause E9 needs a coordinator; register lookup on backlog | Partly met |
| C-09 | Every priority is grounded in a cited clause with verbatim evidence | Preventive | Repairs manager | G1–G4 100% | Met |
| C-10 | Deterministic, versioned decisions with fingerprint and replay | Detective | Tech lead | C1, C2 100% | Met |
| C-11 | Override needs a reason; reasons are monitored | Detective | Service owner | Console requires a reason (demo step 4) | Met (MVP) |
| C-12 | Change control: full evaluation and two approvals before any rule, threshold or model change | Preventive | Service owner | Runbook; evaluation harness | Designed |
| C-13 | Blind 10% re-triage of *Ready to confirm* | Detective | Coordinator lead | Runbook weekly check | Designed |
| C-14 | Kill switch routes everything to review | Corrective | Service owner | Runbook | Designed |

## Responsible AI checklist

| Question | Answer |
|---|---|
| Is a human accountable for each decision? | Yes. The coordinator; the tool only suggests (C-01, C-02). |
| Can any possible emergency avoid a human? | Not in testing: 48/48 test and 15/15 red-team emergencies reached a human. This is unproven on real data; Gate 1 tests it. |
| Can we explain any classification after the fact? | Yes. Clause, evidence, reasons, versions and replay (C-09, C-10). |
| Are tenants treated consistently? | Identical hazards get identical outputs regardless of name, address, contact details or tone (C3, C4). An equality impact assessment is still needed, covering non-native English writers and phone transcription. |
| Do protected characteristics influence output? | Not directly: they are not inputs, and names are redacted. Vulnerability text only routes to a human. Proxy risk (dialect, spelling) is partly mitigated by spell-correction and fallback to review; it needs an EIA with real data. |
| Data protection | Synthetic data only. Production processing stays in the tenancy and needs a DPIA before shadow mode. |
| Workforce | Modelled saving is 0.28 FTE. Positioned as decision support; coordinators co-design. |
| Known limits | Circular synthetic accuracy; narrow phrasing; 44% of the emergency queue is over-escalated; vulnerability lexicon gaps. |

## Production readiness checklist (9 of 22 met)

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Deterministic engine | Met | C1 |
| 2 | Explanation on every decision | Met | G1–G3 |
| 3 | Audit replay | Met | C2 |
| 4 | Redaction before processing | Met | C3 |
| 5 | No write access to client systems | Met | Booking adapter is read-only |
| 6 | Repeatable evaluation harness | Met | `eval/evaluate.js` |
| 7 | Red-team regression set | Met | 15 cases; 7 defects fixed |
| 8 | Versioning of engine, policy and model | Met | Header and audit record |
| 9 | Runbook | Met | Appendix A |
| 10 | Real policy encoded and signed off | Open | Gate 1 |
| 11 | Damp and mould timescales checked against Awaab's Law by legal | Open | Gate 1 |
| 12 | Real-data evaluation inside the tenancy | Open | Gate 1 |
| 13 | DPIA approved | Open | Gate 2 |
| 14 | Equality impact assessment | Open | Gate 2 |
| 15 | SSO and role-based access | Open | Build |
| 16 | Durable, append-only audit store with retention policy | Open | Build |
| 17 | Booking API adapter (read-only) | Open | Build |
| 18 | Monitoring dashboards and alerts | Open | Build |
| 19 | Kill switch implemented | Open | Build |
| 20 | Shadow-mode results meet Gate 1 thresholds on live traffic | Open | Gate 2 |
| 21 | Coordinator training and co-designed queues | Open | Gate 3 |
| 22 | Named service owner and support model | Open | Gate 2 |
