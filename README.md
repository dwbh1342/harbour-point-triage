# Harbour Point repairs triage (MVP)

Decision support for repairs coordinators. It suggests a trade, a priority band and a queue, explains why, and logs a replayable record. Coordinators make every decision. **All data is synthetic.**

Prototype: https://claude.ai/artifact/TnCeJjgw3nbUm6jvu6SfUK (private until shared)

Handover pack: https://claude.ai/artifact/PZ988iZuvsAh3GcU29g8nH (private until shared)

## Run

Needs Node 18 or later. There are no dependencies.

```bash
node data/generate.js && node eval/evaluate.js && node build.js
```

Then open `dist/harbour-point-triage.html`.

## Layout

| Path | What it is |
|---|---|
| `src/policy.js` | Synthetic repairs policy: four bands, 31 clauses (replace with the client's) |
| `src/engine.js` | Redaction, spell-correction, rules, naive Bayes models, ordered router, fingerprint and replay |
| `src/booking.js` | Mock of the read-only booking availability API |
| `src/model.json` | Trained models (generated) |
| `data/generate.js` | Seeded generator for 500 synthetic reports (JSON and CSV) |
| `eval/evaluate.js` | Evaluation plan: safety, quality, groundedness, consistency, robustness, value |
| `eval/RESULTS.md` | Latest results (generated) |
| `app/index.html` | Console template; `build.js` inlines everything into `dist/` |
| `docs/HANDOVER.md` | Source text of the handover pack doc, six sections of 300 words or fewer (`node tools_wordcount.js docs/HANDOVER.md`) |
| `docs/RUNBOOK.md`, `docs/CONTROLS.md`, `docs/BACKLOG.md` | Appendices A, B and D |
