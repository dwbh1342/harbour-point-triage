// Harbour Point repairs policy, as machine-readable clauses.
// SYNTHETIC STAND-IN: written to mirror a typical UK social-landlord repairs
// policy with four priority bands. Replace with the client's published policy
// (clause wording, timescales and patterns) in week 1 of the build.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HPPolicy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BANDS = {
    P1: { name: 'Emergency', target: 'Attend within 4 hours, make safe within 24 hours', attendHours: 4 },
    P2: { name: 'Urgent', target: 'Complete within 5 working days', workingDays: 5 },
    P3: { name: 'Routine', target: 'Complete within 20 working days', workingDays: 20 },
    P4: { name: 'Planned', target: 'Batched into the planned programme within 90 days', calendarDays: 90 },
  };

  const TRADES = [
    'Plumbing', 'Electrical', 'Heating & Gas', 'Drainage', 'Roofing', 'Carpentry',
    'Glazing', 'Locks & Security', 'Damp & Mould', 'Pest Control', 'General Building',
  ];

  // Words that indicate a vulnerable household member. Mention never changes the
  // suggestion by itself; it sends the case to a coordinator, who checks the
  // tenancy vulnerability register (policy 4.3).
  const VULNERABILITY = "\\b(baby|newborn|infant|toddler|elderly|pensioner|disabled|disability|wheelchair|oxygen|chemo\\w*|pregnant|heart condition|asthma|copd|dementia|vulnerable|carer|[7-9]\\d years? old|aged [7-9]\\d|frail|terminal\\w*)\\b";

  // Tenant language that asserts danger. Always reaches a human (policy 2.1).
  const DANGER_CLAIM = "\\b(emergency|dangerous|unsafe|danger|fire)\\b";

  // Clause patterns run over redacted, lower-cased, spell-corrected text.
  // Any clause in P1 sends the report to the emergency queue for a human.
  const CLAUSES = [
    // ---- P1 Emergency ----
    { id: 'E1', band: 'P1', trade: 'Heating & Gas', title: 'Suspected gas escape',
      text: 'Any smell of gas or suspected gas escape. Tenant advised to call the gas emergency line (0800 111 999) and leave the property.',
      patterns: ["\\bgas\\b.{0,40}\\b(smell\\w*|leak\\w*|hiss\\w*|escape)", "\\b(smell\\w*|hiss\\w*|leak\\w*)\\b.{0,40}\\bgas\\b", "\\beggy smell", "rotten eggs?"] },
    { id: 'E2', band: 'P1', trade: 'Heating & Gas', title: 'Carbon monoxide alarm activated',
      text: 'Carbon monoxide alarm sounding or suspected CO exposure.',
      patterns: ["carbon monoxide", "\\bco (alarm|detector)"] },
    { id: 'E3', band: 'P1', trade: 'Plumbing', title: 'Uncontrollable water escape',
      text: 'Water escape that cannot be contained, flooding, burst pipes or water coming through a ceiling.',
      patterns: ["\\b(pouring|gushing|flooding|flooded|burst)\\b", "water (is )?(coming|pouring|dripping|leaking|running) (through|from|out of) (the )?\\w*\\s?ceiling", "(can't|cannot|won't) turn (off )?the water( off)?", "stopcock (won't|will not|doesn't|is stuck|won't move)", "water everywhere"] },
    { id: 'E4', band: 'P1', trade: 'Electrical', title: 'Water in contact with electrics',
      text: 'Water leaking into or near light fittings, sockets, switches or the consumer unit.',
      patterns: ["\\b(water|drip\\w*|leak\\w*)\\b.{0,40}\\b(light fitting|ceiling light|light|sockets?|plugs?|fuse ?box|consumer unit|electrics|switch|extension (lead|cable)|wires?|wiring)\\b", "\\b(light fitting|ceiling light|sockets?|plug socket|fuse ?box|consumer unit|electrics)\\b.{0,30}\\b(water|wet|drip\\w*|leak\\w*)\\b"] },
    { id: 'E5', band: 'P1', trade: 'Electrical', title: 'Dangerous electrics or total loss of power',
      text: 'Sparking, burning smell, exposed live wiring, or total loss of electrical supply not caused by the network operator.',
      patterns: ["\\bspark\\w*", "(exposed|bare|live) wires?", "burning smell|smell of burning|smells? like burning", "smoke (coming )?(from|out)", "\\bscorch\\w*", "(no|lost all|total loss of) (power|electric|electricity)\\b", "fuse ?box.{0,40}(hot|buzz\\w*|smoking|burning)", "went bang|\\bbang\\b.{0,30}(socket|plug)"] },
    { id: 'E6', band: 'P1', trade: 'Locks & Security', title: 'Property cannot be secured',
      text: 'External door or accessible window that cannot be locked or secured, including after a break-in.',
      patterns: ["(front|back|external|main|outside|patio) door.{0,40}(won't|wont|can't|cannot|doesn't|does not|will not) (lock|close|shut|secure)", "break[- ]?in|broken into|burgl\\w*|kicked in", "(can't|cannot) (be )?secure", "\\binsecure\\b", "window.{0,40}(can't|cannot|won't) (be )?(secured|close|shut|lock)", "open to the street", "lock has snapped"] },
    { id: 'E7', band: 'P1', trade: 'Drainage', title: 'Sewage escape or only WC unusable',
      text: 'Foul water or sewage escaping inside or outside the home, or the only WC blocked or unusable.',
      patterns: ["\\bsewage\\b", "\\b(only|one) (toilet|loo|wc)\\b", "(toilet|loo).{0,20}overflow\\w*"] },
    { id: 'E8', band: 'P1', trade: 'General Building', title: 'Structural danger',
      text: 'Collapse or imminent collapse of ceilings, walls, chimneys or roof coverings.',
      patterns: ["ceiling.{0,20}(collapsed|come down|came down|fallen|falling|caved|bowing|sagging)", "(bricks|masonry|tiles?|chimney).{0,30}(falling|fallen|fell|came off|coming off)", "falling (bricks|masonry)", "wall.{0,20}(collapsed|collapsing|bulging)", "cracks?.{0,40}(getting (wider|bigger)|widening)"] },
    { id: 'E9', band: 'P1', trade: 'Heating & Gas', title: 'No heating or hot water, vulnerable household',
      text: 'Total loss of heating or hot water where the household includes a vulnerable person. Coordinator confirms against the vulnerability register.',
      requires: 'vulnerability',
      patterns: ["no (heating|hot water|heat)\\b", "(boiler|heating).{0,30}(stopped|not working|broken|off|isn't working|won't come on)", "freezing"] },

    // ---- P2 Urgent ----
    { id: 'U1', band: 'P2', trade: 'Heating & Gas', title: 'Loss of heating or hot water',
      text: 'Partial or total loss of heating or hot water (no vulnerable household member).',
      patterns: ["no (heating|hot water|heat)\\b", "(boiler|heating|radiators?).{0,30}(not working|broken|stopped|won't|isn't|cutting out|losing pressure|error|fault|cold|not coming on|coming on)", "boiler.{0,20}\\b(code|pressure)\\b"] },
    { id: 'U2', band: 'P2', trade: 'Plumbing', title: 'Contained leak',
      text: 'Leak that is contained (for example caught in a bucket) and not near electrics.',
      patterns: ["leak\\w*.{0,30}\\b(sink|pipe|toilet|radiator|valve|bath|basin|washing machine|cistern)", "\\b(sink|pipe|toilet|radiator|valve|bath|basin|washing machine|cistern)\\b.{0,30}leak\\w*", "\\bbucket\\b", "(pipe|valve).{0,20}drip\\w*"] },
    { id: 'U3', band: 'P2', trade: 'Electrical', title: 'Partial loss of electrics',
      text: 'Some sockets or lights not working, or circuit protection repeatedly tripping.',
      patterns: ["\\b(sockets?|plugs?|lights?|switch(es)?)\\b.{0,30}(not working|stopped working|stopped|dead|don't work|doesn't work|broken)", "trip switch|tripping|trips out|fuse (keeps )?(blowing|tripping)"] },
    { id: 'U4', band: 'P2', trade: 'Drainage', title: 'Blocked drain, sink or bath',
      text: 'Blocked waste or drain where another WC remains usable.',
      patterns: ["\\bblocked\\b|blockage|won't drain|backing up|won't go down|not draining"] },
    { id: 'U5', band: 'P2', trade: 'Plumbing', title: 'WC not flushing',
      text: 'Toilet not flushing or cistern faulty.',
      patterns: ["(toilet|loo|cistern|flush)\\b.{0,30}(won't|doesn't|not working|broken|keeps running|running)", "flush.{0,20}broken"] },
    { id: 'U6', band: 'P2', trade: 'Electrical', title: 'Door entry system fault',
      text: 'Door entry, intercom or communal access system not working.',
      patterns: ["door entry|intercom|entry ?phone|buzzer"] },
    { id: 'U7', band: 'P2', trade: 'Pest Control', title: 'Pest infestation',
      text: 'Rats, mice, cockroaches, bedbugs or wasp nests at the property.',
      patterns: ["\\b(rats?|mice|mouse|cockroach\\w*|bed ?bugs|wasps?'? nest)\\b"] },
    { id: 'U8', band: 'P2', trade: 'Damp & Mould', title: 'Damp and mould (hazard assessment required)',
      text: 'Damp or mould reports must be assessed for health hazard within statutory timescales. Always reviewed by a coordinator.',
      alwaysReview: true,
      patterns: ["\\bmould\\w*|\\bdamp\\b|condensation|black spots"] },
    { id: 'U9', band: 'P2', trade: 'Roofing', title: 'Roof leak or missing tiles',
      text: 'Roof leaking into the home or loft, or slipped or missing tiles.',
      patterns: ["roof.{0,30}(leak\\w*|tiles?)", "(slipped|missing|loose) tiles?", "tiles?.{0,20}(slipped|off the roof|missing)"] },
    { id: 'U10', band: 'P2', trade: 'Glazing', title: 'Cracked or broken glazing (secure)',
      text: 'Cracked or broken glass where the opening can still be secured.',
      patterns: ["(cracked|crack|smashed|broken).{0,20}(window|glass|pane|glazing)", "(window|glass|pane|glazing).{0,30}(cracked|crack|smashed|broken)"] },

    // ---- P3 Routine ----
    { id: 'R1', band: 'P3', trade: 'Plumbing', title: 'Tap fault',
      text: 'Dripping, loose or stiff taps.',
      patterns: ["\\btaps?\\b"] },
    { id: 'R2', band: 'P3', trade: 'Carpentry', title: 'Internal door fault',
      text: 'Internal doors sticking, handles or hinges loose or broken.',
      patterns: ["(bedroom|bathroom|kitchen|internal|living room|cupboard|lounge|hall) door", "door handle", "\\bhinges?\\b"] },
    { id: 'R3', band: 'P3', trade: 'Carpentry', title: 'Kitchen units',
      text: 'Kitchen cupboards, drawers and worktops.',
      patterns: ["\\b(cupboards?|cabinet|drawers?|worktop|kitchen unit)\\b"] },
    { id: 'R4', band: 'P3', trade: 'General Building', title: 'Plaster and minor cracks',
      text: 'Loose plaster and non-structural cracks.',
      patterns: ["\\bplaster\\b", "\\bcracks? (in|on|above|appearing)"] },
    { id: 'R5', band: 'P3', trade: 'Electrical', title: 'Extractor fan',
      text: 'Kitchen or bathroom extractor fans faulty or noisy.',
      patterns: ["extractor|\\bfan\\b"] },
    { id: 'R6', band: 'P3', trade: 'Glazing', title: 'Window mechanism',
      text: 'Window handles, hinges, vents and draughts where the window can still be secured.',
      patterns: ["window.{0,30}(won't open|stiff|handle|hinge|draught|vent)", "\\bdraught\\w*", "trickle vent"] },
    { id: 'R7', band: 'P3', trade: 'Plumbing', title: 'Sealant and grout',
      text: 'Bath and shower sealant or grout.',
      patterns: ["sealant|silicone|grout"] },
    { id: 'R8', band: 'P3', trade: 'Roofing', title: 'Gutters and downpipes',
      text: 'Blocked, leaking or loose gutters and downpipes.',
      patterns: ["gutter\\w*|downpipe"] },
    { id: 'R9', band: 'P3', trade: 'Carpentry', title: 'Floors',
      text: 'Loose floorboards and damaged floor coverings provided by the landlord.',
      patterns: ["floorboards?|\\blino\\b|vinyl|floor tiles?|flooring"] },

    // ---- P4 Planned ----
    { id: 'L1', band: 'P4', trade: 'General Building', title: 'Fences, gates and outbuildings',
      text: 'Boundary fences, gates, sheds and paths.',
      patterns: ["\\b(fence|fencing|gate|shed|paving|garden path)\\b"] },
    { id: 'L2', band: 'P4', trade: 'General Building', title: 'Decoration',
      text: 'Redecoration and cosmetic paintwork.',
      patterns: ["repaint\\w*|redecorat\\w*|decorat\\w*|paint(ing)? (is )?(flaking|peeling)|paintwork|wallpaper"] },
    { id: 'L3', band: 'P4', trade: 'General Building', title: 'Improvements and replacements',
      text: 'Requests for upgrades or like-for-like replacement of ageing components.',
      patterns: ["new (kitchen|bathroom)|upgrade|replacement|walk-in shower|would like a new"] },
  ];

  const VERSION = 'policy-synth-2026.10';
  return { VERSION, BANDS, TRADES, CLAUSES, VULNERABILITY, DANGER_CLAIM };
});
