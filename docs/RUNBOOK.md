# Appendix A: Runbook

For the team that operates the triage service. MVP state: runs as a static page; production steps are marked **(build)**.

## Service summary

| Item | Value |
|---|---|
| Purpose | Suggest trade, priority and queue for repair reports. Coordinators decide. |
| Owner | Service owner (to be named before Gate 2). Out of hours: repairs on-call manager. |
| Components | Redaction → policy rules → models → router → console → audit store. Booking API is read-only. |
| Versions | Engine, policy and model versions are printed in the console header and in every audit record. |
| Failure mode | Fail to human: if anything errors, the report goes to *Coordinator review* with no suggestion. |

## Daily checks (coordinator lead, 5 minutes)

1. The *Emergency check now* queue is empty, or every item is less than 30 minutes old.
2. Callbacks in *Needs clarifying* marked "1 hour" are within time.
3. Yesterday's overrides: scan reasons for anything that moved a band **up to P1**. Each one is a possible miss, so open an incident.

## Weekly checks (service owner)

- Queue mix against the baseline (Gate 1 figures). Investigate if *Ready to confirm* moves more than 10 points.
- Override rate by reason code, and emergency-queue precision (target ≥60%).
- Blind re-triage: a senior coordinator re-triages a random 10% of *Ready to confirm* without seeing the suggestion. Any band disagreement is logged.

## Kill switch

Set `routing.mode = "review_all"` **(build: feature flag)**. Every report then goes to *Coordinator review* and the service runs as a reading aid. Use it on any suspected missed emergency, a model or policy deploy problem, or a data incident. The coordinator lead or the service owner can flip it without approval.

## Incident: suspected missed or under-prioritised emergency

1. Make the tenant safe first: phone the tenant and dispatch through the emergency rota.
2. Flip the kill switch.
3. Replay the decision from the audit log (*Audit → Replay*). This confirms which versions, clauses and reasons produced it.
4. Classify the cause: rule gap, model, threshold, redaction, or human override.
5. Add the report (redacted) to the red-team regression set, fix it, run `node eval/evaluate.js`, and redeploy only when every safety metric passes.
6. Record the incident for the regulator file within 5 working days.

## Changing rules, thresholds or the model

All changes follow one path. Edit `src/policy.js` or the thresholds in `src/engine.js`, or retrain with `node eval/evaluate.js`. Then run the full evaluation. Then get two approvals: the repairs manager for policy meaning, and the service owner for the metrics. Bump the version and deploy. Old versions stay available so that historic decisions can be replayed.

Retrain monthly, or when the override rate rises above 15%, using adjudicated decisions only.

## Complaint or regulator request

Find the decision by report ID in the audit store. Replay it to show that the fingerprint matches. Export the record: redacted text, clauses, quoted evidence, reasons, versions, coordinator action and reason. That is the explanation of the classification.

## Rebuild the prototype

```bash
node data/generate.js && node eval/evaluate.js && node build.js
```
