# Appendix D: Backlog

Ordered by gate. Size: S under 3 days, M 1–2 weeks, L over 2 weeks.

| # | Item | Why | Gate | Size |
|---|---|---|---|---|
| 1 | Encode the published repairs policy; repairs manager signs off each clause | The current policy is a synthetic stand-in | 1 | M |
| 2 | Run the evaluation on the 500 real reports inside the tenancy, with panel adjudication | Synthetic accuracy is circular | 1 | M |
| 3 | Calibrate thresholds (trade confidence, model escalation) on real data | Set on synthetic data; emergency precision is 56% | 1 | S |
| 4 | Look up the open job for chasers ("still not fixed") and inherit its priority | Chasers currently get a blanket 1-hour callback | 1 | M |
| 5 | Look up the vulnerability register instead of text cues | Lexicon missed "my nan is 91"; text-based cues are an equality risk | 1 | M |
| 6 | Booking API adapter (read-only) | The mock stands in for the real API | 2 | M |
| 7 | Durable audit store, SSO, roles, kill switch | Production readiness items 15, 16 and 19 | 2 | L |
| 8 | Shadow-mode logging and comparison report | Gate 2 evidence | 2 | M |
| 9 | Monitoring dashboard and alerts | Runbook weekly checks | 2 | M |
| 10 | Broaden phrasing: retrain on adjudicated real reports; consider a small in-tenancy language model as a third opinion, with the same grounding rules | Unseen phrasing reached *Ready to confirm* in only 1 of 57 cases | 3 | L |
| 11 | Damp and mould: hazard assessment workflow and Awaab's Law timers | Statutory | 3 | M |
| 12 | Phone transcription quality check | Phone reports are second-hand text | 3 | S |

## Defects found by evaluation (all fixed, kept as regression tests)

| # | Found by | Defect | Fix |
|---|---|---|---|
| D1 | Red team | "Crack in the wall getting wider" landed in *Ready to confirm* as Routine | Clause E8: widening cracks |
| D2 | Consistency (C4) | Text in capitals bypassed name redaction | Case-insensitive redaction for strong patterns |
| D3 | Consistency (C4) | The fix for D2 erased "the street" as an address, removing E6 evidence | Case-fold strong patterns only |
| D4 | Consistency (C3) | "[postcode]" placeholder matched "boiler … code" | Strip placeholders; word boundaries |
| D5 | Safety (S2) | Chasers with hidden emergencies got no fast callback | REPEAT_REPORT → 1-hour callback |
| D6 | Robustness (R2) | Typo "ottal loss of power" became Urgent in *Ready to confirm* | Domain spell-correction feeding the rules |
| D7 | Red team | Spell-correction changed "lead" to "leak" and lowered the model's emergency signal; "extension lead" was not treated as electrics | Models read literal text; E4 covers extension leads |
