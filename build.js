// Builds the single-file demo: inlines the engine, policy, booking mock,
// trained model, evaluation results, demo queue and handover pack.
// Usage: node build.js [prototype-url]
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
const url = process.argv[2] || '{{PROTOTYPE_URL}}';

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

// ---------- Minimal markdown to HTML for the handover pack ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https:\/\/claude\.ai\/\S+?)(?=[\s.,]|$)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}
function md(src) {
  const lines = src.replace(/\{\{PROTOTYPE_URL\}\}/g, url).split(/\r?\n/);
  const out = [];
  let i = 0;
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const lang = l.slice(3).trim(); const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      out.push(lang === 'mermaid' ? '<div class="arch" data-arch></div>' : '<pre class="code"><code>' + esc(body.join('\n')) + '</code></pre>');
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,3}) (.*)/))) { const n = m[1].length; out.push(`<h${n + 1} id="${slug(m[2])}">${inline(m[2])}</h${n + 1}>`); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = [];
      for (; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(lines[i]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push('<div class="tablewrap"><table><thead><tr>' + head.map((h) => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const ordered = /^\d/.test(l); const items = [];
      for (; i < lines.length && /^(- |\d+\. )/.test(lines[i]); i++) items.push(lines[i].replace(/^(- |\d+\. )/, ''));
      out.push((ordered ? '<ol>' : '<ul>') + items.map((x) => '<li>' + inline(x) + '</li>').join('') + (ordered ? '</ol>' : '</ul>'));
      continue;
    }
    if (/^> /.test(l)) { out.push('<p class="callout">' + inline(l.slice(2)) + '</p>'); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#|\||- |\d+\. |```|> )/.test(lines[i]); i++) para.push(lines[i]);
    out.push('<p>' + inline(para.join(' ')) + '</p>');
  }
  return out.join('\n');
}

const docs = [
  ['handover', 'Handover pack', read('docs/HANDOVER.md')],
  ['runbook', 'A · Runbook', read('docs/RUNBOOK.md')],
  ['controls', 'B · Controls and checklists', read('docs/CONTROLS.md')],
  ['results', 'C · Evaluation results', read('eval/RESULTS.md')],
  ['backlog', 'D · Backlog', read('docs/BACKLOG.md')],
].map(([id, label, src]) => ({ id, label, html: md(src) }));

const data = { model, results, queue, docs, url };
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
