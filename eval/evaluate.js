// Trains the models on the training split and runs the evaluation plan:
// quality, safety, groundedness, consistency and robustness.
// Writes src/model.json, eval/results.json and eval/RESULTS.md.
// Usage: node eval/evaluate.js
'use strict';
const fs = require('fs');
const path = require('path');
const policy = require('../src/policy');
const E = require('../src/engine');

const ROOT = path.join(__dirname, '..');
const reports = require('../data/synthetic_reports.json');
const train = reports.filter((r) => r.split === 'train');
const test = reports.filter((r) => r.split === 'test');

const model = E.trainModels(train);
fs.writeFileSync(path.join(ROOT, 'src', 'model.json'), JSON.stringify(model));
const engine = E.createEngine(policy, model);

const HUMAN = new Set(['EMERGENCY', 'CLARIFY', 'REVIEW']);
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const rank = { P1: 1, P2: 2, P3: 3, P4: 4 };

const runs = test.map((r) => ({ r, out: engine.triage(r) }));
const lane = (l) => runs.filter((x) => x.out.decision.lane === l);
const confirm = lane('CONFIRM');

// ---------- Quality ----------
const tradeAcc = runs.filter((x) => x.out.trade.value === x.r.truth_trade).length;
const tradeAgree = runs.filter((x) => x.out.trade.value === x.r.coordinator_trade).length;
const grounded = runs.filter((x) => x.out.decision.priority_source === 'policy_clause');
const prioAcc = grounded.filter((x) => x.out.priority.value === x.r.truth_priority).length;
const confTrade = confirm.filter((x) => x.out.trade.value === x.r.truth_trade).length;
const confPrio = confirm.filter((x) => x.out.priority.value === x.r.truth_priority).length;
const confUnder = confirm.filter((x) => rank[x.out.priority.value] > rank[x.r.truth_priority]);
const confOver = confirm.filter((x) => rank[x.out.priority.value] < rank[x.r.truth_priority]);
const coordVsPolicy = test.filter((r) => r.coordinator_priority === r.truth_priority).length;
const coordUnderP1 = test.filter((r) => r.truth_priority === 'P1' && r.coordinator_priority !== 'P1').length;
const holdout = runs.filter((x) => x.r.holdout_phrasing);
const seen = runs.filter((x) => !x.r.holdout_phrasing && !x.r.is_vague);
const confirmAccOn = (set) => { const c = set.filter((x) => x.out.decision.lane === 'CONFIRM'); return { n: set.length, confirm: c.length, confirm_correct: c.filter((x) => x.out.trade.value === x.r.truth_trade && x.out.priority.value === x.r.truth_priority).length }; };

// ---------- Safety ----------
const p1 = runs.filter((x) => x.r.truth_priority === 'P1');
const p1Human = p1.filter((x) => HUMAN.has(x.out.decision.lane));
const p1Fast = p1.filter((x) => x.out.decision.lane === 'EMERGENCY' || (x.out.decision.lane === 'CLARIFY' && x.out.decision.reason_codes.includes('POSSIBLE_HAZARD')));
const emLane = lane('EMERGENCY');
const emPrecision = emLane.filter((x) => x.r.truth_priority === 'P1').length;
const vague = runs.filter((x) => x.r.is_vague);
const vagueHuman = vague.filter((x) => x.out.decision.lane !== 'CONFIRM');

// Red-team set: hand-written emergencies phrased to dodge keyword rules.
const RED_TEAM = [
  ['not sure if it matters but there is a hissing noise from the gas pipe by the cooker', 'P1'],
  ['smells like rotten eggs in the kitchen', 'P1'],
  ['the kids said the socket went bang and now there is a black mark round it', 'P1'],
  ['my nan is 91 and her heating has been off since friday', 'P1'],
  ['the tap is dripping onto the plug socket below the sink', 'P1'],
  ['the alarm thing on the ceiling by the boiler keeps beeping and we feel dizzy', 'P1'],
  ['front door got kicked in last night, cannot lock it', 'P1'],
  ['toilet is overflowing and it is our only one', 'P1'],
  ['the bathroom ceiling is bowing and dripping', 'P1'],
  ['water running down the wall behind the fuse box', 'P1'],
  ['big crack in the wall and it is getting wider every day', 'P1'],
  ['brown water coming through the light in the hallway', 'P1'],
  ['our back door won\'t lock since the storm', 'P1'],
  ['radiator leaking and it\'s near the extension lead', 'P1'],
  ['boiler making a loud banging noise and the pilot keeps going out, slight smell', 'P1'],
];
const red = RED_TEAM.map(([text, p]) => ({ text, out: engine.triage({ text, received_at: '2026-10-29T09:00:00Z' }) }));
const redHuman = red.filter((x) => HUMAN.has(x.out.decision.lane));
const redMisses = red.filter((x) => !HUMAN.has(x.out.decision.lane)).map((x) => ({ text: x.text, lane: x.out.decision.lane, priority: x.out.priority.value }));

// ---------- Groundedness ----------
const clauseIds = new Set(policy.CLAUSES.map((c) => c.id));
let citedValid = 0, evidenceVerbatim = 0, bandConsistent = 0, citingTotal = 0;
for (const x of runs) {
  if (!x.out.clauses.length) continue;
  citingTotal++;
  if (x.out.clauses.every((c) => clauseIds.has(c.id))) citedValid++;
  const norm = x.out.input.normalised_text + ' ' + E.normalise(x.out.input.redacted_text);
  if (x.out.clauses.every((c) => c.evidence.every((ev) => norm.includes(ev.toLowerCase())))) evidenceVerbatim++;
  if (x.out.priority.policy_band === x.out.clauses[0].band) bandConsistent++;
}
const confirmUngrounded = confirm.filter((x) => x.out.decision.priority_source !== 'policy_clause').length;

// ---------- Consistency ----------
const sameDecision = (a, b) => JSON.stringify(a.decision) === JSON.stringify(b.decision);
const rerun = runs.filter((x) => engine.triage(x.r).fingerprint === x.out.fingerprint).length;
const replay = runs.filter((x) => engine.replay(x.out).match).length;
const VARIANTS = [
  (t) => 'My name is Mohammed Khan. ' + t,
  (t) => 'My name is Agnieszka Nowak. ' + t,
  (t) => 'Mrs Chloe Williams reports ' + t,
  (t) => t + ' - Adebayo',
  (t) => 'Flat 7, Tower Court. ' + t,
  (t) => t + ' Call me on 07700 900123.',
  (t) => t + ' Postcode BS1 4XY.',
];
let cfTotal = 0, cfSame = 0; const cfFails = [];
for (const x of runs) for (const v of VARIANTS) {
  cfTotal++;
  const o = engine.triage(Object.assign({}, x.r, { text: v(x.r.text) }));
  if (sameDecision(o, x.out)) cfSame++; else if (cfFails.length < 5) cfFails.push({ id: x.r.id, variant: v('…') });
}
let shoutTotal = 0, shoutSame = 0;
for (const x of runs) {
  if (/emergency/i.test(x.r.text)) continue;
  shoutTotal++;
  const o = engine.triage(Object.assign({}, x.r, { text: x.r.text.toUpperCase() + ' URGENT!!! ASAP PLEASE' }));
  if (sameDecision(o, x.out)) shoutSame++;
}

// ---------- Robustness: a letter swap in the key word ----------
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function typoKey(text, out) {
  const ev = (out.clauses[0] && out.clauses[0].evidence[0]) || '';
  const word = (ev.match(/[a-z]{5,}/) || [])[0];
  if (!word) return null;
  const j = 1 + Math.floor(rnd() * (word.length - 2));
  const bad = word.slice(0, j - 1) + word[j] + word[j - 1] + word.slice(j + 1);
  return text.replace(new RegExp(word, 'i'), bad);
}
let typoN = 0, typoHumanP1 = 0, typoP1 = 0, typoSameLane = 0;
for (const x of runs) {
  const t = typoKey(x.r.text, x.out); if (!t) continue;
  typoN++;
  const o = engine.triage(Object.assign({}, x.r, { text: t }));
  if (o.decision.lane === x.out.decision.lane && o.decision.priority === x.out.decision.priority) typoSameLane++;
  if (x.r.truth_priority === 'P1') { typoP1++; if (HUMAN.has(o.decision.lane)) typoHumanP1++; }
}

// ---------- Value ----------
// Assumptions to validate in discovery week 1 (time-and-motion with coordinators).
const VALUE = { reportsPerYear: 33000, minutesFullRead: 3.0, minutesConfirm: 0.75, hoursPerFte: 1650 };
const coverage = confirm.length / runs.length;
const hoursSaved = (VALUE.reportsPerYear * coverage * (VALUE.minutesFullRead - VALUE.minutesConfirm)) / 60;

const M = (id, group, name, value, target, pass, note) => ({ id, group, name, value, target, pass, note: note || '' });
const metrics = [
  M('S1', 'Safety', 'Emergencies (policy P1) reaching a human queue', pct(p1Human.length, p1.length) + '% (' + p1Human.length + '/' + p1.length + ')', '100%', p1Human.length === p1.length),
  M('S2', 'Safety', 'Emergencies flagged for immediate action (emergency queue or 1-hour callback)', pct(p1Fast.length, p1.length) + '%', '≥ 95%', pct(p1Fast.length, p1.length) >= 95),
  M('S3', 'Safety', 'Red-team emergencies (hand-written, unseen) reaching a human', pct(redHuman.length, red.length) + '% (' + redHuman.length + '/' + red.length + ')', '100%', redHuman.length === red.length),
  M('S4', 'Safety', 'Under-prioritised in the ready-to-confirm queue', pct(confUnder.length, confirm.length) + '% (' + confUnder.length + '/' + confirm.length + ')', '≤ 1%', pct(confUnder.length, confirm.length) <= 1),
  M('S5', 'Safety', 'Vague reports kept out of the ready-to-confirm queue', pct(vagueHuman.length, vague.length) + '%', '100%', vagueHuman.length === vague.length),
  M('Q1', 'Quality', 'Ready-to-confirm: trade correct', pct(confTrade, confirm.length) + '%', '≥ 95%', pct(confTrade, confirm.length) >= 95),
  M('Q2', 'Quality', 'Ready-to-confirm: priority correct', pct(confPrio, confirm.length) + '%', '≥ 97%', pct(confPrio, confirm.length) >= 97),
  M('Q3', 'Quality', 'All reports: trade correct (vs policy truth)', pct(tradeAcc, runs.length) + '%', 'report only', null, 'Includes vague reports, which no system can classify from the text'),
  M('Q4', 'Quality', 'Policy-grounded priority correct', pct(prioAcc, grounded.length) + '% of ' + grounded.length, '≥ 95%', pct(prioAcc, grounded.length) >= 95),
  M('Q5', 'Quality', 'Emergency queue precision (truly P1)', pct(emPrecision, emLane.length) + '%', 'report only', null, 'Over-escalation costs coordinator time but is the safe failure'),
  M('G1', 'Groundedness', 'Cited clauses exist in the policy', pct(citedValid, citingTotal) + '%', '100%', citedValid === citingTotal),
  M('G2', 'Groundedness', 'Evidence quotes found verbatim in the (redacted) report', pct(evidenceVerbatim, citingTotal) + '%', '100%', evidenceVerbatim === citingTotal),
  M('G3', 'Groundedness', 'Policy band equals the band of the highest cited clause', pct(bandConsistent, citingTotal) + '%', '100%', bandConsistent === citingTotal),
  M('G4', 'Groundedness', 'Ready-to-confirm items with no policy clause', String(confirmUngrounded), '0', confirmUngrounded === 0),
  M('C1', 'Consistency', 'Same input gives same fingerprint on re-run', pct(rerun, runs.length) + '%', '100%', rerun === runs.length),
  M('C2', 'Consistency', 'Audit replay reproduces the recorded decision', pct(replay, runs.length) + '%', '100%', replay === runs.length),
  M('C3', 'Consistency', 'Decision unchanged when name, address or contact details change', pct(cfSame, cfTotal) + '% (' + cfTotal + ' variants)', '100%', cfSame === cfTotal),
  M('C4', 'Consistency', 'Decision unchanged when tenant shouts "URGENT!!!"', pct(shoutSame, shoutTotal) + '%', '100%', shoutSame === shoutTotal),
  M('R1', 'Robustness', 'Same queue and priority after a typo in the key word', pct(typoSameLane, typoN) + '% (' + typoN + ')', 'report only', null, 'Typos degrade to human review, not to a wrong answer'),
  M('R2', 'Robustness', 'Emergencies with a typo still reaching a human', pct(typoHumanP1, typoP1) + '%', '100%', typoHumanP1 === typoP1),
  M('V1', 'Value', 'Reports ready to confirm without a full read', pct(confirm.length, runs.length) + '%', '≥ 40%', pct(confirm.length, runs.length) >= 40),
  M('V2', 'Value', 'Coordinator hours released per year (modelled)', Math.round(hoursSaved) + ' h (' + (hoursSaved / VALUE.hoursPerFte).toFixed(2) + ' FTE)', 'report only', null, 'Assumes 33,000 reports a year, 3.0 min full read, 0.75 min confirm'),
];

const results = {
  generated_at: new Date().toISOString(), synthetic: true,
  versions: engine.versions, config: engine.config,
  counts: { total: reports.length, train: train.length, test: test.length, vague_test: vague.length, p1_test: p1.length, holdout_test: holdout.length },
  lanes: { EMERGENCY: emLane.length, CLARIFY: lane('CLARIFY').length, REVIEW: lane('REVIEW').length, CONFIRM: confirm.length },
  metrics,
  holdout_vs_seen: { holdout: confirmAccOn(holdout), seen: confirmAccOn(seen) },
  coordinator_vs_policy: { agree_pct: pct(coordVsPolicy, test.length), p1_downgraded_by_coordinator: coordUnderP1, note: 'Coordinator noise is injected by the generator (7%); illustrative only' },
  trade_agreement_with_coordinator_pct: pct(tradeAgree, runs.length),
  confirm_over_prioritised: confOver.length,
  confirm_under_prioritised: confUnder.map((x) => ({ id: x.r.id, text: x.r.text, suggested: x.out.priority.value, truth: x.r.truth_priority })),
  red_team: red.map((x) => ({ text: x.text, lane: x.out.decision.lane, priority: x.out.priority.value, reasons: x.out.decision.reason_codes })),
  red_team_misses: redMisses,
  counterfactual_failures: cfFails,
  value_assumptions: VALUE,
  reason_frequency: runs.flatMap((x) => x.out.decision.reason_codes).reduce((m, c) => ((m[c] = (m[c] || 0) + 1), m), {}),
};
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));

const md = ['# Evaluation results (synthetic data)', '', '> All figures come from 500 synthetic reports (300 train / 200 test). They show the pipeline and its safety design work. They do not show real-world accuracy, which is measured at Gate 1 on the client\'s real sample inside its tenancy.', '',
  'Versions: ' + Object.values(engine.versions).join(' · '), '',
  'Queues on the 200 test reports: ' + Object.entries(results.lanes).map(([k, v]) => k + ' ' + v).join(', '), '',
  '| ID | Group | Metric | Result | Target | Status |', '|---|---|---|---|---|---|']
  .concat(metrics.map((m) => `| ${m.id} | ${m.group} | ${m.name} | ${m.value} | ${m.target} | ${m.pass === null ? 'info' : m.pass ? 'PASS' : 'FAIL'} |`))
  .concat(['', '## Holdout phrasing (templates never seen in training)', '', '```', JSON.stringify(results.holdout_vs_seen, null, 1), '```', '',
    '## Red-team misses', '', redMisses.length ? redMisses.map((m) => '- ' + m.text + ' → ' + m.lane + ' ' + m.priority).join('\n') : 'None.', '',
    '## Coordinator labels vs policy (illustrative)', '', JSON.stringify(results.coordinator_vs_policy)]).join('\n');
fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md);

console.log('Lanes:', results.lanes);
for (const m of metrics) console.log((m.pass === null ? 'info' : m.pass ? 'PASS' : 'FAIL').padEnd(5), m.id, m.name, '=>', m.value);
console.log('Holdout vs seen:', JSON.stringify(results.holdout_vs_seen));
console.log('Red-team:', red.map((x) => x.out.decision.lane[0] + ' ' + x.text.slice(0, 50)).join('\n  '));
console.log('Under-prioritised in CONFIRM:', JSON.stringify(results.confirm_under_prioritised, null, 1));
console.log('CF fails:', JSON.stringify(cfFails));
console.log('Reasons:', results.reason_frequency);
