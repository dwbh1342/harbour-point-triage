// Builds the single-file demo: inlines the engine, policy, booking mock,
// trained model, evaluation results and demo queue. The handover pack is a
// separate document (see README).
// Usage: node build.js
'use strict';
const fs = require('fs');
const path = require('path');
const policy = require('./src/policy');
const E = require('./src/engine');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const model = JSON.parse(read('src/model.json'));
const results = JSON.parse(read('eval/results.json'));
const reports = JSON.parse(read('data/synthetic_reports.json'));

// ---------- Demo queue: 24 held-out test reports, in overnight arrival order ----------
const PICKS = [
  'hallway tap is dripping constantly', 'Leak under the kitchen sink, I have put a bucket', 'condensation and mould around all the windows Advised',
  'someone tried to break in', 'drawer runners broken', 'T rang to report leak', 'no hot water, boiler showing an error code',
  'garden gate is rotten', 'paint is flaking on the stairwell', 'My name is Tom Evans', 'kitchen sink is blocked',
  'Tenant called: heating', 'rats in the bin store', 'Caller reports still not fixed', 'the flush on our loo has broken',
  'carbon monoixde detector', 'extractor fan in the bathroom', 'Repair needed', 'replacement front door',
  'bathroom door handle has come off', 'roof is leaking into the loft', 'gas smell coming from the boiler cupboard',
  'communal hallway needs repainting', 'water coming thruogh the ceiling',
];
const test = reports.filter((r) => r.split === 'test');
const start = Date.UTC(2026, 9, 25, 18, 10);
const queue = PICKS.map((frag, i) => {
  const r = test.find((x) => x.text.includes(frag));
  if (!r) throw new Error('Demo pick not found: ' + frag);
  return { id: r.id, channel: r.channel, text: r.text, received_at: new Date(start + i * 35 * 60e3).toISOString(), truth_priority: r.truth_priority, truth_trade: r.truth_trade };
});

const data = { model, results, queue };
const libs = ['src/policy.js', 'src/engine.js', 'src/booking.js'].map(read).join('\n');
const json = JSON.stringify(data).replace(/</g, '\\u003c');

let html = read('app/index.html');
html = html.replace('/*__LIBS__*/', () => libs).replace('/*__DATA__*/', () => 'window.HP_DATA = ' + json + ';');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'harbour-point-triage.html');
fs.writeFileSync(out, html);
const engine = E.createEngine(policy, model);
const lanes = queue.map((q) => engine.triage(q).decision.lane).reduce((m, l) => ((m[l] = (m[l] || 0) + 1), m), {});
console.log('Wrote', out, (html.length / 1024).toFixed(0) + ' KB', 'demo queue lanes:', lanes);
console.log('Gas report position:', PICKS.findIndex((p) => p.startsWith('gas')) + 1, 'at', queue[PICKS.findIndex((p) => p.startsWith('gas'))].received_at);
