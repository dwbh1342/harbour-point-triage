// Harbour Point repairs triage engine.
// Decision support only: it suggests trade, priority and a queue. A coordinator
// makes every decision. Deterministic: the same redacted text, policy version
// and model version always produce the same decision fingerprint.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HPEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ENGINE_VERSION = 'engine-0.4.0';
  const BAND_RANK = { P1: 1, P2: 2, P3: 3, P4: 4 };

  // Thresholds are configuration, reviewed at each go/no-go gate.
  const DEFAULT_CONFIG = {
    tradeConfidenceMin: 0.80,     // below this, coordinator review
    modelEmergencyFlag: 0.20,     // priority model P(P1) at or above this escalates
    vagueMaxContentTokens: 3,     // at or below this, ask the tenant to clarify
  };

  // ---------- Text handling ----------

  // Personal data is removed before anything else, so neither the models nor
  // the audit log see names, contact details or addresses.
  // [pattern, replacement, safe to apply case-insensitively to text in capitals]
  const REDACTIONS = [
    [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[email]', true],
    [/(?:\+44\s?|\b0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, '[phone]', true],
    [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g, '[postcode]', true],
    [/\b([Mm]y name is|[Tt]his is|[Ii] am)\s+[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?/g, '$1 [name]', true],
    [/\b(?:Mr|Mrs|Ms|Miss|Dr|Mx)\.?\s+[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?/g, '[name]', true],
    [/\b(?:[Ff]lat|[Aa]partment|[Aa]pt|[Uu]nit)\s+\d+[a-zA-Z]?\b,?(?:\s+[A-Z][a-z]+\s+(?:House|Court|Tower|Towers|Road|Street|Close|Gardens))?/g, '[unit]', true],
    [/\b\d+[a-zA-Z]?\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s+(?:Road|Rd|Street|St|Close|Court|Avenue|Ave|Lane|Way|Drive|Crescent|Grove|Place|Gardens)\b/g, '[address]', true],
    [/\b[A-Z][a-z]+\s+(?:House|Court|Tower|Towers|Estate|Road|Street|Close|Gardens)\b/g, '[address]', false],
    [/(^|\s)[-–—]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*$/g, '$1- [name]', false],
    [/\b(Thanks|Thank you|Regards|Cheers),?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*\.?\s*$/g, '$1 [name]', false],
  ];

  // Name and address rules key off capital letters, so text written in
  // capitals gets case-insensitive versions of the same rules.
  function redact(text) {
    let out = String(text || '');
    const letters = out.match(/[A-Za-z]/g) || [];
    const shouting = letters.length > 8 && letters.filter((c) => c <= 'Z').length / letters.length > 0.7;
    for (const [re, rep, foldSafe] of REDACTIONS) {
      if (shouting && !foldSafe) continue;
      out = out.replace(shouting ? new RegExp(re.source, re.flags + 'i') : re, rep);
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  // Common misspellings seen in repair reports (to be refreshed from real data).
  const SPELLING = {
    leeking: 'leaking', leek: 'leak', leakin: 'leaking', boiller: 'boiler', boilor: 'boiler',
    electic: 'electric', elecricity: 'electricity', electrisity: 'electricity', cieling: 'ceiling',
    celing: 'ceiling', mold: 'mould', moldy: 'mouldy', radiater: 'radiator', toliet: 'toilet',
    tiolet: 'toilet', sewerage: 'sewage', socked: 'socket', shoud: 'should', wont: "won't",
    cant: "can't", doesnt: "doesn't", isnt: "isn't", dont: "don't", sparkin: 'sparking',
    smel: 'smell', windo: 'window', kitchin: 'kitchen', bathrom: 'bathroom',
  };

  // Urgency words are removed from the features so that the way a tenant
  // writes ("URGENT!!!") never changes the outcome. Priority comes from the
  // hazard described, which is how consistent treatment is demonstrated.
  const URGENCY = /\b(urgent(ly)?|asap|immediately|right away|please+|pls|plz|help+)\b|!+/gi;

  function normalise(redacted) {
    let t = redacted.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    t = t.replace(/\[(email|phone|postcode|name|unit|address)\]/g, ' ');
    t = t.replace(/\b[a-z']+\b/g, (w) => SPELLING[w] || w);
    return t.replace(URGENCY, ' ').replace(/\s+/g, ' ').trim();
  }

  const STOP = new Set(('a an the and or but if of to in on at by for from with is are was were be been ' +
    'it its it\'s this that there here i i\'m im we my our me us you your he she they them their his her ' +
    'have has had do does did can could would should will just so very really also again still ' +
    'some any all as about into out up down over than then now when what which who how get got ' +
    'hi hello hey thanks thank cheers regards morning afternoon there someone come please ' +
    'tenant t caller called rang ring reports reported report says said phone call logged re ' +
    'advised touch available weekdays name email unit address postcode').split(/\s+/));

  function tokens(norm) {
    return (norm.match(/[a-z][a-z']*/g) || []).filter((w) => !STOP.has(w) && w.length > 1);
  }

  function features(norm) {
    const tk = tokens(norm);
    const f = tk.slice();
    for (let i = 0; i + 1 < tk.length; i++) f.push(tk[i] + '_' + tk[i + 1]);
    return f;
  }

  // ---------- Naive Bayes (trained offline on the coordinator-labelled sample) ----------

  function trainNB(docs, labels, alpha) {
    alpha = alpha || 0.5;
    const counts = {}, totals = {}, docCount = {}, vocab = new Set();
    docs.forEach((fs, i) => {
      const c = labels[i];
      counts[c] = counts[c] || {};
      totals[c] = totals[c] || 0;
      docCount[c] = (docCount[c] || 0) + 1;
      for (const f of fs) { counts[c][f] = (counts[c][f] || 0) + 1; totals[c]++; vocab.add(f); }
    });
    const classes = Object.keys(docCount).sort();
    const prior = {};
    for (const c of classes) prior[c] = Math.log(docCount[c] / docs.length);
    return { classes, prior, counts, totals, vocabSize: vocab.size, alpha };
  }

  function predictNB(model, fs) {
    const { classes, prior, counts, totals, vocabSize, alpha } = model;
    const known = fs.filter((f) => classes.some((c) => counts[c][f]));
    const scores = classes.map((c) => {
      let s = prior[c];
      const denom = totals[c] + alpha * vocabSize;
      for (const f of known) s += Math.log(((counts[c][f] || 0) + alpha) / denom);
      return s;
    });
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const z = exps.reduce((a, b) => a + b, 0);
    return classes.map((c, i) => ({ label: c, p: exps[i] / z }))
      .sort((a, b) => b.p - a.p || (a.label < b.label ? -1 : 1));
  }

  // ---------- Fingerprinting (FNV-1a over canonical JSON) ----------

  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // ---------- SLA ----------

  function addWorkingDays(d, n) {
    const out = new Date(d.getTime());
    while (n > 0) { out.setUTCDate(out.getUTCDate() + 1); const wd = out.getUTCDay(); if (wd !== 0 && wd !== 6) n--; }
    out.setUTCHours(17, 0, 0, 0);
    return out;
  }
  function slaDeadline(policy, band, receivedAt) {
    const b = policy.BANDS[band]; const d = new Date(receivedAt);
    if (b.attendHours) return new Date(d.getTime() + b.attendHours * 3600e3);
    if (b.workingDays) return addWorkingDays(d, b.workingDays);
    return new Date(d.getTime() + b.calendarDays * 86400e3);
  }

  // ---------- Clarifying questions for vague reports ----------

  const CLARIFY = [
    { re: /\b(leak\w*|water|drip\w*|flood\w*|wet)\b/, hazard: true, qs: ['Where is the water coming from, and is it coming through a ceiling?', 'Is any water near lights, sockets or the fuse box?', 'Can you stop it by turning off the stopcock?'] },
    { re: /\b(gas|smell\w*|fumes?)\b/, hazard: true, qs: ['Can you smell gas? If yes: leave the property, do not use switches, and call the gas emergency line on 0800 111 999.', 'Where is the smell strongest, and when did it start?'] },
    { re: /\b(electric\w*|power|lights?|sockets?|plugs?|fuse\w*|smoke|burning)\b/, hazard: true, qs: ['Is there any sparking, burning smell or water near the electrics?', 'Have you lost power to the whole home or just part of it?'] },
    { re: /\b(door|lock\w*|keys?)\b/, hazard: true, qs: ['Is it a front or back door, or an internal door?', 'Can you lock and secure your home tonight?'] },
    { re: /\b(window|glass)\b/, hazard: true, qs: ['Is the glass broken, and which floor is the window on?', 'Can the window be closed and locked?'] },
    { re: /\b(heating|boiler|radiators?|hot water|cold)\b/, hazard: true, qs: ['Do you have any heating or hot water at all?', 'Does anyone in the home have a health condition, a disability, or is anyone under 5 or over 75?'] },
    { re: /\b(toilet|loo|wc|drain\w*|sewage)\b/, hazard: true, qs: ['Is this the only toilet in your home?', 'Is it overflowing or is any waste escaping?'] },
    { re: /\b(ceiling|wall|roof)\b/, hazard: true, qs: ['Is anything cracking, bulging or falling?', 'Is water coming in?'] },
  ];
  // Chasers ("still not fixed") refer to an open job whose priority we cannot
  // see from the text, which could be an emergency.
  const REPEAT = /\b(again|still|not fixed|same problem|chasing|chase|no one came|nobody came)\b/;
  const REPEAT_QS = ['Check the open job in the booking system and confirm its priority.', 'What is still wrong, and has it got worse since you first reported it?'];
  const GENERIC_QS = ['Which room is affected, and what exactly is broken?', 'When did it start, and is it getting worse?'];

  // ---------- Engine ----------

  function createEngine(policy, model, config) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
    const compiled = policy.CLAUSES.map((c) => Object.assign({}, c, { res: c.patterns.map((p) => new RegExp(p, 'i')) }));
    const vulnRe = new RegExp(policy.VULNERABILITY, 'i');
    const dangerRe = new RegExp(policy.DANGER_CLAIM, 'i');
    const modelVersion = model.version;

    function matchClauses(norm, vulnerable) {
      const hits = [];
      for (const c of compiled) {
        if (c.requires === 'vulnerability' && !vulnerable) continue;
        const evidence = [];
        for (const re of c.res) { const m = norm.match(re); if (m) evidence.push(m[0].trim()); }
        if (evidence.length) hits.push({ id: c.id, band: c.band, trade: c.trade, title: c.title, text: c.text, alwaysReview: !!c.alwaysReview, evidence: Array.from(new Set(evidence)) });
      }
      return hits.sort((a, b) => BAND_RANK[a.band] - BAND_RANK[b.band] || (a.id < b.id ? -1 : 1));
    }

    // Typo repair against words seen at least twice in training. Fixes single
    // slips ("ottal loss of power") so that emergency rules still fire.
    const vocab = new Map(model.vocab || []);
    for (const c of policy.CLAUSES) for (const w of c.patterns.join(' ').match(/[a-z]{4,}/g) || []) if (!vocab.has(w)) vocab.set(w, 1);
    function spellCorrect(text) {
      const corrections = [];
      const out = text.replace(/[a-z]{4,}/g, (w) => {
        if (vocab.has(w) || STOP.has(w) || SPELLING[w]) return w;
        let best = null;
        for (const [v, n] of vocab) {
          if (Math.abs(v.length - w.length) > 1 || !oneEdit(w, v)) continue;
          if (!best || n > best[1] || (n === best[1] && v < best[0])) best = [v, n];
        }
        if (!best) return w;
        corrections.push({ from: w, to: best[0] });
        return best[0];
      });
      return { text: out, corrections };
    }
    function mergeClauses(a, b) {
      const byId = new Map(a.map((c) => [c.id, c]));
      for (const c of b) {
        const have = byId.get(c.id);
        if (have) have.evidence = Array.from(new Set(have.evidence.concat(c.evidence)));
        else byId.set(c.id, c);
      }
      return Array.from(byId.values()).sort((x, y) => BAND_RANK[x.band] - BAND_RANK[y.band] || (x.id < y.id ? -1 : 1));
    }

    function triage(report) {
      const raw = report.text || '';
      const redacted = redact(raw);
      const literal = normalise(redacted);
      const { text: norm, corrections } = spellCorrect(literal);
      const fs = features(literal); // models see the literal text; correction only feeds the rules
      const contentTokens = tokens(norm).length;
      const vulnMatch = norm.match(vulnRe) || literal.match(vulnRe);
      const dangerMatch = redacted.match(dangerRe);
      // Rules run on the literal and the corrected text; correction can only
      // add matches, never remove one.
      const clauses = mergeClauses(matchClauses(literal, !!vulnMatch), corrections.length ? matchClauses(norm, !!vulnMatch) : []);
      const top = clauses[0] || null;

      const tradeDist = predictNB(model.trade, fs);
      const prioDist = predictNB(model.priority, fs);
      const pP1 = (prioDist.find((x) => x.label === 'P1') || { p: 0 }).p;

      const trade = tradeDist[0];
      const ruleTrade = top ? top.trade : null;
      const priority = top ? top.band : null;
      const reasons = [];
      const add = (code, detail) => reasons.push({ code, detail });

      // Lane decision. Order matters: safety screens come first and nothing
      // later can move a report out of a human queue.
      let lane;
      const p1Clauses = clauses.filter((c) => c.band === 'P1');
      if (p1Clauses.length) add('POLICY_EMERGENCY_MATCH', 'Matches emergency clause ' + p1Clauses.map((c) => c.id).join(', '));
      if (dangerMatch) add('TENANT_REPORTS_DANGER', 'Tenant used the word "' + dangerMatch[0].toLowerCase() + '"');
      if (pP1 >= cfg.modelEmergencyFlag && !p1Clauses.length) add('MODEL_EMERGENCY_SIGNAL', 'Priority model gives ' + Math.round(pP1 * 100) + '% chance of emergency');
      const emergency = reasons.length > 0;

      const clarify = CLARIFY.filter((c) => c.re.test(norm));
      const repeat = REPEAT.test(norm);
      const hazardAdjacent = clarify.some((c) => c.hazard) || repeat;

      if (emergency) {
        lane = 'EMERGENCY';
      } else if (!top && contentTokens <= cfg.vagueMaxContentTokens) {
        lane = 'CLARIFY';
        add('TOO_VAGUE', 'Only ' + contentTokens + ' descriptive word(s); cannot tell what is broken');
        if (repeat) add('REPEAT_REPORT', 'Looks like a chaser for an open job; its priority is unknown');
        if (hazardAdjacent) add('POSSIBLE_HAZARD', 'Mentions something that could be an emergency; call back within 1 hour');
      } else {
        if (!top) add('NO_POLICY_MATCH', 'No policy clause matches; priority cannot be grounded');
        if (vulnMatch) add('VULNERABILITY_MENTIONED', 'Mentions "' + vulnMatch[0] + '"; check vulnerability register');
        if (top && top.alwaysReview) add('POLICY_REQUIRES_REVIEW', 'Clause ' + top.id + ' always needs a coordinator');
        if (trade.p < cfg.tradeConfidenceMin) add('LOW_TRADE_CONFIDENCE', 'Trade confidence ' + Math.round(trade.p * 100) + '%');
        if (ruleTrade && ruleTrade !== trade.label) add('TRADE_DISAGREEMENT', 'Model says ' + trade.label + ', clause ' + top.id + ' says ' + ruleTrade);
        if (top && prioDist[0].label !== priority && prioDist[0].p >= 0.5) add('PRIORITY_DISAGREEMENT', 'Model says ' + prioDist[0].label + ', policy says ' + priority);
        lane = reasons.length ? 'REVIEW' : 'CONFIRM';
      }

      // Anything in a fast human queue is treated as an emergency until a
      // coordinator has checked it; the policy band is kept alongside.
      const assumeP1 = (lane === 'EMERGENCY' && priority !== 'P1') || (lane === 'CLARIFY' && hazardAdjacent);
      const suggestedPriority = assumeP1 ? 'P1' : priority || prioDist[0].label;
      const prioritySource = assumeP1 ? (lane === 'EMERGENCY' ? 'assume_emergency_until_checked' : 'assume_emergency_until_clarified')
        : priority ? 'policy_clause' : 'model_only_ungrounded';
      const questions = lane === 'CLARIFY' ? (repeat ? REPEAT_QS : []).concat(clarify.length ? clarify.flatMap((c) => c.qs) : GENERIC_QS).slice(0, 4) : [];
      const received = report.received_at || new Date().toISOString();

      const decision = {
        lane,
        trade: trade.label,
        priority: suggestedPriority,
        priority_source: prioritySource,
        clause_ids: clauses.map((c) => c.id),
        reason_codes: reasons.map((r) => r.code),
      };
      const versions = { engine: ENGINE_VERSION, policy: policy.VERSION, model: modelVersion };

      return {
        id: report.id || null,
        versions,
        input: { redacted_text: redacted, normalised_text: norm, corrections, channel: report.channel || 'portal', received_at: received },
        decision,
        trade: { value: trade.label, confidence: round(trade.p), alternatives: tradeDist.slice(1, 3).map((x) => ({ label: x.label, p: round(x.p) })), rule_trade: ruleTrade },
        priority: { value: suggestedPriority, band: policy.BANDS[suggestedPriority].name, target: policy.BANDS[suggestedPriority].target, policy_band: priority, model_opinion: { label: prioDist[0].label, p: round(prioDist[0].p), p_emergency: round(pP1) } },
        clauses: clauses.map((c) => ({ id: c.id, band: c.band, title: c.title, text: c.text, evidence: c.evidence })),
        reasons,
        clarifying_questions: questions,
        sla_deadline: slaDeadline(policy, suggestedPriority, received).toISOString(),
        fingerprint: fnv(canonical({ decision, versions, text: redacted })),
      };
    }

    // Replays a stored audit record: re-runs on the stored redacted text and
    // checks the fingerprint matches what was recorded at decision time.
    function replay(record) {
      const again = triage({ id: record.id, text: record.input.redacted_text, channel: record.input.channel, received_at: record.input.received_at });
      return { match: again.fingerprint === record.fingerprint, fingerprint: again.fingerprint };
    }

    return { triage, replay, config: cfg, versions: { engine: ENGINE_VERSION, policy: policy.VERSION, model: modelVersion } };
  }

  function round(x) { return Math.round(x * 1000) / 1000; }

  // True when b is one substitution, insertion, deletion or adjacent swap from a.
  function oneEdit(a, b) {
    if (a === b) return false;
    if (a.length === b.length) {
      const diff = [];
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
      return diff.length === 1 || (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]);
    }
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    let i = 0;
    while (i < s.length && s[i] === l[i]) i++;
    return s.slice(i) === l.slice(i + 1);
  }

  function trainModels(reports) {
    const texts = reports.map((r) => normalise(redact(r.text)));
    const fs = texts.map(features);
    const trade = trainNB(fs, reports.map((r) => r.coordinator_trade));
    const priority = trainNB(fs, reports.map((r) => r.coordinator_priority));
    const counts = {};
    for (const t of texts) for (const w of t.match(/[a-z]{4,}/g) || []) counts[w] = (counts[w] || 0) + 1;
    const vocab = Object.entries(counts).filter(([, n]) => n >= 2).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    const body = { trade, priority, vocab, trained_on: reports.length };
    body.version = 'nb-' + fnv(canonical(body));
    return body;
  }

  return { createEngine, trainModels, redact, normalise, tokens, fingerprint: (o) => fnv(canonical(o)), ENGINE_VERSION, DEFAULT_CONFIG };
});
