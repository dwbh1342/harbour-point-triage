# Evaluation results (synthetic data)

> All figures come from 500 synthetic reports (300 train / 200 test). They show the pipeline and its safety design work. They do not show real-world accuracy, which is measured at Gate 1 on the client's real sample inside its tenancy.

Versions: engine-0.4.0 · policy-synth-2026.10 · nb-c89dda58

Queues on the 200 test reports: EMERGENCY 75, CLARIFY 15, REVIEW 34, CONFIRM 76

| ID | Group | Metric | Result | Target | Status |
|---|---|---|---|---|---|
| S1 | Safety | Emergencies (policy P1) reaching a human queue | 100% (48/48) | 100% | PASS |
| S2 | Safety | Emergencies flagged for immediate action (emergency queue or 1-hour callback) | 100% | ≥ 95% | PASS |
| S3 | Safety | Red-team emergencies (hand-written, unseen) reaching a human | 100% (15/15) | 100% | PASS |
| S4 | Safety | Under-prioritised in the ready-to-confirm queue | 0% (0/76) | ≤ 1% | PASS |
| S5 | Safety | Vague reports kept out of the ready-to-confirm queue | 100% | 100% | PASS |
| Q1 | Quality | Ready-to-confirm: trade correct | 100% | ≥ 95% | PASS |
| Q2 | Quality | Ready-to-confirm: priority correct | 100% | ≥ 97% | PASS |
| Q3 | Quality | All reports: trade correct (vs policy truth) | 81.5% | report only | info |
| Q4 | Quality | Policy-grounded priority correct | 97.3% of 149 | ≥ 95% | PASS |
| Q5 | Quality | Emergency queue precision (truly P1) | 56% | report only | info |
| G1 | Groundedness | Cited clauses exist in the policy | 100% | 100% | PASS |
| G2 | Groundedness | Evidence quotes found verbatim in the (redacted) report | 100% | 100% | PASS |
| G3 | Groundedness | Policy band equals the band of the highest cited clause | 100% | 100% | PASS |
| G4 | Groundedness | Ready-to-confirm items with no policy clause | 0 | 0 | PASS |
| C1 | Consistency | Same input gives same fingerprint on re-run | 100% | 100% | PASS |
| C2 | Consistency | Audit replay reproduces the recorded decision | 100% | 100% | PASS |
| C3 | Consistency | Decision unchanged when name, address or contact details change | 100% (1400 variants) | 100% | PASS |
| C4 | Consistency | Decision unchanged when tenant shouts "URGENT!!!" | 100% | 100% | PASS |
| R1 | Robustness | Same queue and priority after a typo in the key word | 93.1% (144) | report only | info |
| R2 | Robustness | Emergencies with a typo still reaching a human | 100% | 100% | PASS |
| V1 | Value | Reports ready to confirm without a full read | 38% | ≥ 40% | FAIL |
| V2 | Value | Coordinator hours released per year (modelled) | 470 h (0.28 FTE) | report only | info |

## Holdout phrasing (templates never seen in training)

```
{
 "holdout": {
  "n": 57,
  "confirm": 1,
  "confirm_correct": 1
 },
 "seen": {
  "n": 113,
  "confirm": 75,
  "confirm_correct": 75
 }
}
```

## Red-team misses

None.

## Coordinator labels vs policy (illustrative)

{"agree_pct":97.5,"p1_downgraded_by_coordinator":1,"note":"Coordinator noise is injected by the generator (7%); illustrative only"}