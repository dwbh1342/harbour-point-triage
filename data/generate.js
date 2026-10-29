// Generates 500 SYNTHETIC repair reports shaped like the client's historic
// sample: free text, channel, the trade and priority a coordinator assigned,
// and ~15% reports too brief to say what is broken.
//
// No real tenant data is used or needed. Ground truth ("truth_*") is the band
// the synthetic policy assigns; "coordinator_*" adds realistic human
// inconsistency (7% priority, 4% trade) so evaluation can be run against both.
//
// Templates marked holdout:true only appear in the test split, to measure how
// the model copes with phrasing it has never seen.
//
// Usage: node data/generate.js  (seeded; output is reproducible)
'use strict';
const fs = require('fs');
const path = require('path');

let seed = 20261029;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;

const ROOMS = ['kitchen', 'bathroom', 'bedroom', 'living room', 'hallway'];
const WHEN = ['since yesterday', 'this morning', 'for about a week', 'since the weekend', 'for two days', ''];
const VULN = ['my baby', 'my elderly mum', 'my disabled son', 'my wife who is pregnant'];
const VULN2 = ['disabled', '86 years old', 'on oxygen', 'a pensioner with a heart condition'];

// [scenario id, trade, priority band, clause, weight, templates (H: = holdout)]
const S = [
  ['gas_smell', 'Heating & Gas', 'P1', 'E1', 3, ['I can smell gas in the {room}, it is quite strong', 'there is a smell of gas near the cooker {when}', 'gas smell coming from the boiler cupboard', 'H:think there might be a gas leak, sort of eggy smell by the meter']],
  ['co_alarm', 'Heating & Gas', 'P1', 'E2', 2, ['carbon monoxide alarm keeps going off in the {room}', 'CO alarm beeping and will not stop, we have opened the windows', 'H:the carbon monoxide detector by the boiler is sounding']],
  ['ceiling_water', 'Plumbing', 'P1', 'E3', 4, ['water is pouring through the {room} ceiling from the flat above', 'burst pipe in the {room}, water everywhere', 'pipe has burst under the sink and it is flooding the kitchen', 'H:water coming through the ceiling and the stopcock won\'t move']],
  ['water_electrics', 'Electrical', 'P1', 'E4', 2, ['water dripping from the ceiling light in the {room}', 'water leaking into the fuse box', 'H:there is water coming out of the light fitting in the bathroom and the lights flickered']],
  ['sparking', 'Electrical', 'P1', 'E5', 3, ['socket in the {room} is sparking when I plug anything in', 'burning smell coming from the plug socket {when}', 'exposed wires hanging out of the wall where the light was', 'H:the fuse box is making a buzzing noise and feels hot']],
  ['no_power', 'Electrical', 'P1', 'E5', 2, ['no power at all in the whole flat {when}', 'lost all electricity, neighbours have power', 'H:total loss of power to the house, trip switch won\'t reset']],
  ['insecure_door', 'Locks & Security', 'P1', 'E6', 3, ['front door won\'t lock, the lock has snapped', 'someone tried to break in and the back door frame is smashed', 'the front door won\'t shut properly after a break-in', 'H:our flat was burgled last night and the door is hanging off']],
  ['ground_window', 'Glazing', 'P1', 'E6', 1, ['ground floor window smashed and can\'t be secured', 'kids threw a brick through the front window, window can\'t close now', 'H:living room window was smashed last night, flat is open to the street']],
  ['sewage', 'Drainage', 'P1', 'E7', 2, ['sewage coming up through the bath and toilet', 'only toilet is blocked and overflowing', 'H:raw sewage in the garden coming out of the drain cover']],
  ['ceiling_collapse', 'General Building', 'P1', 'E8', 1, ['part of the {room} ceiling has collapsed', 'ceiling has come down in the hallway', 'H:bricks falling off the chimney onto the path']],
  ['heating_vulnerable', 'Heating & Gas', 'P1', 'E9', 3, ['no heating or hot water and {vuln} is in the house', 'boiler has stopped working completely, I am {vuln2} and it is freezing', 'H:heating broken since yesterday, I have a newborn baby and the flat is really cold']],

  ['no_heating', 'Heating & Gas', 'P2', 'U1', 9, ['no heating {when}, radiators are all cold', 'boiler keeps losing pressure and cutting out', 'no hot water, boiler showing an error code', 'H:the heating isn\'t coming on at all, thermostat is on but nothing happens']],
  ['contained_leak', 'Plumbing', 'P2', 'U2', 7, ['leak under the kitchen sink, I have put a bucket under it', 'pipe behind the toilet is leaking slowly', 'radiator valve leaking onto the carpet in the {room}', 'H:the washing machine waste pipe is leaking whenever we use it']],
  ['partial_electrics', 'Electrical', 'P2', 'U3', 5, ['sockets in the {room} have stopped working', 'the trip switch keeps tripping when the oven is on', 'lights in the {room} not working, changed the bulb already', 'H:half the plugs in the kitchen are dead but the rest of the flat is fine']],
  ['blocked_drain', 'Drainage', 'P2', 'U4', 5, ['kitchen sink is blocked and won\'t drain', 'bath water won\'t go down, drain is blocked', 'toilet is blocked, we have a second toilet downstairs', 'H:outside drain is backing up and smells']],
  ['toilet_flush', 'Plumbing', 'P2', 'U5', 3, ['toilet won\'t flush, the handle just spins', 'cistern keeps running and won\'t fill', 'H:the flush on our loo has broken, have to pour water down it']],
  ['entry_system', 'Electrical', 'P2', 'U6', 2, ['door entry intercom for the block isn\'t working', 'communal door entry buzzer broken, can\'t let visitors in', 'H:the entry phone in the flat doesn\'t open the main door downstairs']],
  ['pests', 'Pest Control', 'P2', 'U7', 3, ['rats in the bin store and I have seen one in the kitchen', 'mice droppings in the kitchen cupboards', 'wasps nest above the back door', 'H:cockroaches in the kitchen, getting worse']],
  ['damp_mould', 'Damp & Mould', 'P2', 'U8', 5, ['black mould spreading on the {room} walls', 'damp patch on the bedroom ceiling and the wallpaper is peeling', 'condensation and mould around all the windows', 'H:mould in my son\'s bedroom, he has asthma and it is getting worse']],
  ['roof_leak', 'Roofing', 'P2', 'U9', 3, ['roof is leaking into the loft when it rains', 'some tiles have slipped off the roof after the storm', 'H:water stain spreading on the top floor ceiling every time it rains, think it is the roof']],
  ['cracked_glass', 'Glazing', 'P2', 'U10', 2, ['{room} window pane is cracked', 'glass in the back door has cracked but it still locks', 'H:double glazing unit has a crack across it from top to bottom']],

  ['dripping_tap', 'Plumbing', 'P3', 'R1', 7, ['{room} tap is dripping constantly', 'hot tap in the bathroom won\'t turn off fully', 'H:the mixer tap is loose and wobbles when you use it']],
  ['internal_door', 'Carpentry', 'P3', 'R2', 6, ['{room} door is sticking and won\'t close', 'bathroom door handle has come off', 'internal door hinge is broken, door is dropping', 'H:the kitchen door catches on the floor and is hard to open']],
  ['kitchen_units', 'Carpentry', 'P3', 'R3', 6, ['kitchen cupboard door has fallen off', 'drawer runners broken in the kitchen', 'worktop is lifting near the cooker', 'H:the cabinet under the sink is swollen and falling apart']],
  ['plaster', 'General Building', 'P3', 'R4', 5, ['crack in the plaster on the {room} wall', 'plaster coming away from the wall in the hallway', 'H:hairline cracks appearing above the doorframes']],
  ['extractor', 'Electrical', 'P3', 'R5', 4, ['extractor fan in the bathroom has stopped working', 'kitchen extractor is really noisy', 'H:bathroom fan doesn\'t come on with the light anymore']],
  ['window_mech', 'Glazing', 'P3', 'R6', 5, ['{room} window won\'t open, handle is stiff', 'window handle has snapped off in the bedroom', 'draught coming through the window frame', 'H:trickle vent on the window is broken']],
  ['sealant', 'Plumbing', 'P3', 'R7', 3, ['sealant around the bath is black and peeling', 'grout in the shower is coming away', 'H:silicone round the shower tray has split']],
  ['gutter', 'Roofing', 'P3', 'R8', 3, ['gutter is overflowing when it rains', 'gutter hanging off the front of the house', 'H:downpipe has come loose from the wall']],
  ['flooring', 'Carpentry', 'P3', 'R9', 3, ['floorboard is loose in the hallway', 'lino lifting in the kitchen, trip hazard', 'H:floor tiles in the bathroom are cracked and loose']],

  ['fencing', 'General Building', 'P4', 'L1', 4, ['fence panel blown down in the back garden', 'garden gate is rotten and won\'t latch', 'H:the boundary fence between us and next door is leaning badly']],
  ['decorating', 'General Building', 'P4', 'L2', 3, ['communal hallway needs repainting', 'would like the {room} redecorated now the leak was fixed', 'H:paint is flaking on the stairwell walls']],
  ['improvement', 'General Building', 'P4', 'L3', 2, ['can I get a new kitchen, the current one is very old', 'requesting an upgrade to a walk-in shower', 'H:would like a replacement front door as ours is old and tatty']],
];

// Vague reports: what the tenant wrote, and what it turned out to be after a callback.
const VAGUE = [
  ['leak', ['ceiling_water', 'contained_leak', 'roof_leak', 'dripping_tap']],
  ['leak in kitchen', ['contained_leak', 'ceiling_water']],
  ['door', ['insecure_door', 'internal_door']], ['door broken', ['insecure_door', 'internal_door']],
  ['heating', ['no_heating', 'heating_vulnerable']], ['boiler', ['no_heating']],
  ['smell', ['gas_smell', 'blocked_drain', 'damp_mould']], ['light', ['partial_electrics', 'water_electrics']],
  ['electrics', ['partial_electrics', 'sparking']], ['window', ['window_mech', 'cracked_glass', 'ground_window']],
  ['toilet', ['toilet_flush', 'blocked_drain', 'sewage']], ['water', ['ceiling_water', 'contained_leak']],
  ['kitchen', ['kitchen_units', 'contained_leak']], ['repair needed', null], ['broken again', null],
  ['still not fixed', null], ['ceiling', ['ceiling_collapse', 'ceiling_water', 'plaster']], ['bathroom', ['sealant', 'extractor', 'dripping_tap']],
];

const NAMES = ['Mohammed Khan', 'Agnieszka Nowak', 'Chloe Williams', 'Adebayo Okafor', 'Siobhan Murphy', 'Priya Patel', 'Tom Evans', 'Mei Lin'];
const STREETS = ['Tower Court', 'Harbour Road', 'Elm Close', 'Quayside Gardens'];
const OPEN_PORTAL = ['', 'Hi, ', 'Hello, ', 'Hi there, ', 'Good morning, '];
const CLOSE_PORTAL = ['', ' Thanks.', ' Please can someone come out.', ' Can you help?', ' Thank you'];
const OPEN_PHONE = ['Tenant called: ', 'T rang to report ', 'Caller reports ', 'Phone report: '];
const CLOSE_PHONE = ['', ' Advised tenant we will be in touch.', ' Tenant available weekdays.'];
const MISSPELL = { boiler: 'boiller', leaking: 'leeking', ceiling: 'cieling', toilet: 'toliet', electricity: 'elecricity', radiator: 'radiater' };

function fill(t) {
  return t.replace('{room}', pick(ROOMS)).replace('{when}', pick(WHEN)).replace('{vuln}', pick(VULN)).replace('{vuln2}', pick(VULN2)).replace(/\s+/g, ' ').replace(/\s,/g, ',').trim();
}
function typo(text) {
  const words = text.split(' ');
  const idx = words.map((w, i) => (w.length >= 5 ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return text;
  const i = pick(idx); const w = words[i]; const j = 1 + Math.floor(rnd() * (w.length - 2));
  words[i] = w.slice(0, j - 1) + w[j] + w[j - 1] + w.slice(j + 1);
  return words.join(' ');
}
const ADJACENT_TRADES = { Plumbing: 'Drainage', Drainage: 'Plumbing', Electrical: 'Heating & Gas', 'Heating & Gas': 'Plumbing', Carpentry: 'General Building', 'General Building': 'Carpentry', Glazing: 'Carpentry', Roofing: 'General Building', 'Damp & Mould': 'General Building', 'Pest Control': 'General Building', 'Locks & Security': 'Carpentry' };
const BANDS = ['P1', 'P2', 'P3', 'P4'];

const byId = Object.fromEntries(S.map((s) => [s[0], s]));
const weighted = S.flatMap((s) => Array(s[4]).fill(s));

const N = 500, N_VAGUE = 75, N_TEST = 200;
const reports = [];
const seenBySplit = { train: 0, test: 0 };
const start = Date.UTC(2025, 9, 1);
for (let i = 0; i < N; i++) {
  const split = i % 5 < 2 ? 'test' : 'train'; // 40% test
  const vague = seenBySplit[split]++ % 20 < 3; // exactly 15% in each split
  const channel = chance(0.45) ? 'phone' : 'portal';
  let sc, text, holdout = false;
  if (vague) {
    const [word, options] = pick(VAGUE);
    sc = options ? byId[pick(options)] : pick(weighted);
    text = word;
  } else {
    sc = pick(weighted);
    const pool = sc[5].filter((t) => split === 'test' || !t.startsWith('H:'));
    const tpl = pick(pool);
    holdout = tpl.startsWith('H:');
    text = fill(tpl.replace(/^H:/, ''));
    if (chance(0.10)) text = typo(text);
    if (chance(0.06)) for (const [k, v] of Object.entries(MISSPELL)) text = text.replace(new RegExp('\\b' + k + '\\b'), v);
    if (chance(0.06)) text += ' This is urgent!';
    if (chance(0.02)) text += ' It is an emergency.';
  }
  if (!vague && channel === 'portal' && chance(0.10)) text = 'My name is ' + pick(NAMES) + ', flat ' + (1 + Math.floor(rnd() * 40)) + ' ' + pick(STREETS) + '. ' + text;
  text = channel === 'phone' ? pick(OPEN_PHONE) + text + pick(CLOSE_PHONE) : (vague ? text : pick(OPEN_PORTAL) + text + pick(CLOSE_PORTAL));
  text = text.charAt(0).toUpperCase() + text.slice(1);

  const truthPriority = sc[2], truthTrade = sc[1];
  let cPriority = truthPriority, cTrade = truthTrade;
  if (!vague && chance(0.07)) {
    const k = BANDS.indexOf(truthPriority); const down = chance(0.6);
    cPriority = BANDS[Math.max(0, Math.min(3, k + (down ? 1 : -1)))];
  }
  if (!vague && chance(0.04)) cTrade = ADJACENT_TRADES[truthTrade];

  const received = new Date(start + Math.floor(rnd() * 360) * 86400e3 + (7 + Math.floor(rnd() * 12)) * 3600e3 + Math.floor(rnd() * 60) * 60e3);
  reports.push({
    id: 'SYN-' + String(i + 1).padStart(4, '0'), split, channel, received_at: received.toISOString(),
    property_type: pick(['flat', 'flat', 'house', 'maisonette', 'bungalow']), text,
    coordinator_trade: cTrade, coordinator_priority: cPriority,
    truth_trade: truthTrade, truth_priority: truthPriority, truth_clause: sc[3], scenario: sc[0],
    is_vague: vague, holdout_phrasing: holdout, synthetic: true,
  });
}

const out = path.join(__dirname, 'synthetic_reports.json');
fs.writeFileSync(out, JSON.stringify(reports, null, 1));
const csvCols = ['id', 'split', 'channel', 'received_at', 'property_type', 'text', 'coordinator_trade', 'coordinator_priority', 'truth_trade', 'truth_priority', 'truth_clause', 'is_vague', 'holdout_phrasing'];
const csv = [csvCols.join(',')].concat(reports.map((r) => csvCols.map((c) => '"' + String(r[c]).replace(/"/g, '""') + '"').join(','))).join('\n');
fs.writeFileSync(path.join(__dirname, 'synthetic_reports.csv'), csv);
const dist = (k) => reports.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
console.log('Wrote', reports.length, 'synthetic reports to', out);
console.log('Priority (truth):', dist('truth_priority'), 'Vague:', reports.filter((r) => r.is_vague).length, 'Test:', reports.filter((r) => r.split === 'test').length);
console.log('Coordinator priority != policy:', reports.filter((r) => r.coordinator_priority !== r.truth_priority).length);
