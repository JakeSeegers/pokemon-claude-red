// STUDY CASES: trainers who stop you on the road can first talk with you as a fictional practice case for
// differential diagnosis (data: src/data/dxcases.js, built from the diagnosis-practice-case study tables).
//
//   1. The game rolls a target diagnosis and a rule-out pathway (3 to 5 differentials) from the tables.
//   2. Claude plays the trainer as the patient. Each turn you pick one of four questions. Every option carries a kind
//      (good, sensitive, rapport, leading, judgmental, off-topic, hostile), and the kind, not Claude, moves PATIENCE.
//   3. You name the diagnosis, then say what each clue you found rules out.
//   4. PATIENCE sets the battle on a spectrum: 5 is the normal battle, each lost point adds levels (capped near your
//      strongest POKéMON) and healing items. Your case score (0-100%) sets the reward on a spectrum: prize money
//      grows with the score, and higher scores add an item. The case notes (the answer key) come after the battle.
//
// OPTION > STUDY CASES: OFF, SOME (about 1 trainer in 3, always the same ones) or ALL. Needs Claude (src/game/claudenpc.js).
(function (G) {
  'use strict';
  const MAX_TURNS = 10, OPEN_TIMEOUT = 90000, TURN_TIMEOUT = 60000;
  const KIND_PATIENCE = { good: 0, sensitive: -1, rapport: 1, leading: -1, judgmental: -1, offtopic: -1, hostile: -2 };
  const KIND_LABEL = { good: 'Good question', sensitive: 'Sensitive topic', rapport: 'Good rapport', leading: 'Leading question', judgmental: 'Judgmental question', offtopic: 'Off-topic question', hostile: 'Hostile question' };
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (a, k) => shuffle(a.slice()).slice(0, k);

  // ---------------- names for menus ----------------
  // "Tourette's Disorder (motor and vocal tics, ...)" -> "Tourette's Disorder"; Neurocognitive "Major" -> full name
  function memberName(t, m) {
    let n = m.replace(/\s*\(.*$/, '').replace(/\.\s.*$/, '').trim();
    if (t.id === '3.16.2') n += ' Neurocognitive Disorder';
    return n;
  }
  // menu-sized labels: drop "(for example ...)" / "(only vs. ...)" notes, cut very long names
  function label(n) {
    n = String(n).replace(/\s*\((for example|only vs\.)[^)]*\)/g, '').trim();
    return n.length > 56 ? n.slice(0, 55) + '…' : n;
  }
  const pct = s => Math.round(s * 100) + '%';
  const meter = p => '▶'.repeat(Math.max(0, p)) + '▷'.repeat(Math.max(0, 5 - p));
  // a plain-text version of what Claude wrote: our font has no fancy quotes or markdown
  const plain = t => String(t || '').replace(/[*_`#]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

  // ---------------- the case roll (done by the game, as the skill does with python) ----------------
  function rollCase() {
    const t = G.DX_TABLES[rnd(G.DX_TABLES.length)];
    const target = t.members ? memberName(t, t.members[rnd(t.members.length)]) : t.name;
    const n = t.diffs.length, k = Math.min(n, 3 + rnd(3));
    const pathway = sample(t.diffs.map((d, i) => i), k).map(i => ({ diff: t.diffs[i][0], ruleOut: t.diffs[i][1] }));
    return { table: t, target, pathway };
  }

  // ---------------- the prompt ----------------
  const SYSTEM = [
    'You run a study game for differential diagnosis inside a pixel-art POKéMON RED remake (Kanto). The player is a student. They interview one fictional patient, then diagnose. The patient is a POKéMON TRAINER the player met on the road, who wants to talk before their battle.',
    'The first message gives the clinical content: the target diagnosis, its core features, and the rule-out pathway (each step is a differential and the finding that rules it out). Keep every criterion, duration, count and clue correct.',
    '',
    'Theme rules. Change names, places, objects and jobs to fit the POKéMON world (the clinic is the POKéMON CENTER, the school is the Trainer School, a phone can be a POKé BALL when the clinical meaning stays the same). The patient is a person, never a POKéMON. Keep the language respectful: never joke about the disorder or the patient. Do not copy text or dialogue from the franchise; write everything in your own words.',
    '',
    'Interview rules. Answer only what the question asks. Reveal a pathway clue only when a question points toward it, and never all clues at once. A collateral source (a family member, a friend, a gym mate) can add facts the patient hides or forgets. Never name the target diagnosis or any differential in the patient\'s words or in the feedback.',
    '',
    'Options. Each turn, write exactly four questions the player can ask next. Put one or two good options that lead to a core feature or a clue not found yet. Put at least one leading or judgmental option. Put at least one off-topic option, or a relevant but badly phrased one. Change the position of the good options each turn. Label every option with its true kind: good (open, relevant, respectful), sensitive (appropriate but on a sensitive topic; give it a short topic word), rapport (builds trust after a hard moment, and may also ask something), leading, judgmental, offtopic, hostile (threatening or shaming). The game uses the kinds to score the player, so label them honestly.',
    '',
    'Writing. Plain text only: no markdown, no emoji. Each option is a question of at most 48 characters. The patient\'s answer is 2 to 4 sentences, at most 300 characters, in character. Feedback is one short line about the question just asked, at most 70 characters (for example: Good. This question looks for a pattern.). Write POKéMON words in CAPS (POKéMON, POKé BALL, POKéMON CENTER).',
    '',
    'Safety. All cases are fictional and for study. For eating disorders, give weight only as a clinical finding (for example BMI) and never describe restriction, purging or weight-loss methods. For Factitious Disorder Imposed on Another, keep any harm general and non-graphic.',
  ].join('\n');

  const OPTION = { type: 'object', additionalProperties: false, required: ['text', 'kind', 'topic'], properties: {
    text: { type: 'string' }, kind: { type: 'string', enum: Object.keys(KIND_PATIENCE) }, topic: { type: 'string' } } };
  const OPEN_SCHEMA = { type: 'object', additionalProperties: false,
    required: ['patient_name', 'age', 'collateral', 'core_facts', 'clue_facts', 'neutral_facts', 'teaching_note', 'opening', 'options'],
    properties: {
      patient_name: { type: 'string' }, age: { type: 'integer' }, collateral: { type: 'string' },
      core_facts: { type: 'array', items: { type: 'string' } },
      clue_facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['step', 'fact'], properties: { step: { type: 'integer' }, fact: { type: 'string' } } } },
      neutral_facts: { type: 'array', items: { type: 'string' } },
      teaching_note: { type: 'string' }, opening: { type: 'string' },
      options: { type: 'array', items: OPTION },
    } };
  const TURN_SCHEMA = { type: 'object', additionalProperties: false, required: ['feedback', 'answer', 'revealed_steps', 'all_found', 'options'],
    properties: {
      feedback: { type: 'string' }, answer: { type: 'string' },
      revealed_steps: { type: 'array', items: { type: 'integer' } }, all_found: { type: 'boolean' },
      options: { type: 'array', items: OPTION },
    } };

  function brief(c, a) {
    const t = c.table, tc = (G.DATA.trainerClasses[a.obj.trainer.cls] || {}).name || 'TRAINER';
    const place = String(G.ow.map.name).replace(/([a-z])([A-Z0-9])/g, '$1 $2');
    return [
      'Target diagnosis: ' + c.target + (t.members ? ' (from the table ' + t.name + ')' : ''),
      'Diagnostic class: ' + t.group,
      'Core features: ' + t.core,
      'Rule-out pathway (one clue each, written as a finding; never name the differential):',
      c.pathway.map((p, i) => '  ' + (i + 1) + '. ' + p.diff + ': ' + p.ruleOut).join('\n'),
      '',
      'Setting: ' + place + ' in Kanto. The patient is a ' + tc + ' who stopped the player for a POKéMON battle and wants to talk first.',
      'Plan the hidden facts first: the core features with durations and counts (core_facts), one clue for each pathway step (clue_facts, step = its number above), one or two neutral facts, and a collateral source (who they are).',
      'teaching_note: one short teaching point for the answer key, for example: comorbidity is the default; Adjustment Disorder and Other Specified categories are used only when no specific disorder fits; a trait is not a diagnosis; give the subtype or specifier; history, course and tests can change the decision.',
      'opening: 2 to 4 sentences: who they are, why they want to talk, and one first quote from them. Only the chief complaint, no history.',
      'Then four options for the first question.',
    ].join('\n');
  }

  // one request; returns the parsed JSON or null
  function* call(c, schema, timeout, effort) {
    const text = yield* G.claude.request({ system: SYSTEM, messages: c.messages, format: schema, effort }, timeout);
    if (!text) return null;
    try { const j = JSON.parse(text); c.messages.push({ role: 'assistant', content: text }); return j; } catch (e) { console.warn('study case: bad JSON', e); return null; }
  }
  const goodOptions = opts => (Array.isArray(opts) ? opts : []).filter(o => o && o.text && KIND_PATIENCE[o.kind] !== undefined).slice(0, 4);

  // ---------------- the interview ----------------
  function* interview(c, a) {
    c.messages = [{ role: 'user', content: brief(c, a) }];
    const open = yield* call(c, OPEN_SCHEMA, OPEN_TIMEOUT, 'medium');
    if (!open || goodOptions(open.options).length < 2) return false;
    c.name = plain(open.patient_name).toUpperCase().slice(0, 12) || 'TRAINER';
    c.clues = {}; (open.clue_facts || []).forEach(f => { if (f.step >= 1 && f.step <= c.pathway.length) c.clues[f.step] = plain(f.fact); });
    c.teaching = plain(open.teaching_note);
    c.found = {}; c.patience = 5; c.topics = {};
    yield* G.say('This trainer wants to talk before the battle.\fSTUDY CASE: listen, ask good questions, then diagnose.\fPATIENCE ' + meter(5) + '\fBad questions use up PATIENCE and make the battle harder.');
    yield* G.say(plain(open.opening));
    let options = goodOptions(open.options), turn = 0, allFound = false;
    for (;;) {
      if (c.patience <= 0) { yield* G.say(c.name + ' has had enough and stops talking.\fYou have to diagnose with what you know.'); break; }
      if (turn >= MAX_TURNS) { yield* G.say(c.name + ': I think I\'ve said all I can for now.'); break; }
      const items = options.map(o => label(plain(o.text))).concat(['(I am ready to diagnose)']);
      const head = 'PATIENCE ' + meter(c.patience) + (allFound ? '\nYou know a lot now.' : '') + '\nWhat do you ask?';
      const r = yield* choose(head, items);
      if (r < 0 || r >= options.length) break;
      const o = options[r];
      // the kind of the chosen question moves PATIENCE, as in the skill's table (sensitive: once per topic)
      let d = KIND_PATIENCE[o.kind];
      if (o.kind === 'sensitive') { const tp = String(o.topic || o.text).toLowerCase(); if (c.topics[tp]) d = 0; c.topics[tp] = true; }
      c.patience = Math.max(0, Math.min(5, c.patience + d));
      turn++;
      c.messages.push({ role: 'user', content: 'The player asked option ' + 'ABCD'[r] + ' (' + o.kind + '): "' + o.text + '". PATIENCE is now ' + c.patience + '/5.' +
        (c.patience <= 0 ? ' PATIENCE is zero: the patient answers in one sentence that they want to stop talking.' : '') });
      const t = yield* call(c, TURN_SCHEMA, TURN_TIMEOUT, 'low');
      const note = KIND_LABEL[o.kind] + (d ? ' (PATIENCE ' + (d > 0 ? '+' : '') + d + ')' : '') + '.';
      if (!t) { yield* G.say(note + '\f' + c.name + ' goes quiet. Time to diagnose.'); break; }
      (t.revealed_steps || []).forEach(s => { if (c.clues[s]) c.found[s] = true; });
      allFound = !!t.all_found;
      yield* G.say(note + (t.feedback ? ' ' + plain(t.feedback) : '') + '\f' + c.name + ': ' + plain(t.answer));
      const next = goodOptions(t.options);
      if (next.length < 2) break;
      options = next;
    }
    return true;
  }
  // a question that stays on screen above its menu (like G.ask); the menu spans the screen for long questions
  function* choose(question, items, sel) {
    yield* G.say(question, { noWait: true });
    const bg = new G.ui.StaticBox(question);
    G.engine.push(bg);
    const r = yield* G.choose(items, { x: 6, w: 308, y: Math.max(4, G.ui.BOX.y - 2 - (items.length * 15 + 12)), noCancel: true, sel: sel || 0 });
    G.engine.pop(bg);
    return r;
  }

  // ---------------- diagnosis and rule-outs (scored by the game) ----------------
  function* diagnose(c) {
    const t = c.table, others = t.diffs.map(d => d[0]).filter(n => n !== c.target);
    const pathNames = c.pathway.map(p => p.diff);
    const pool = pathNames.concat(others.filter(n => !pathNames.includes(n)));
    const choices = shuffle([c.target].concat(pool.filter((n, i) => pool.indexOf(n) === i).slice(0, 4)));
    const r = yield* choose('What is your diagnosis?', choices.map(label));
    c.said = choices[r];
    c.dxRight = c.said === c.target;
    yield* G.say('Noted. The case notes come after the battle.');
    c.ruleRight = 0;
    for (let i = 0; i < c.pathway.length; i++) {
      const step = i + 1;
      if (!c.found[step] || !c.clues[step]) continue;
      const right = c.pathway[i].diff;
      const opts = shuffle([right].concat(sample(t.diffs.map(d => d[0]).filter(n => n !== right), 3)));
      yield* G.say('You found this clue:\f' + c.clues[step]);
      const k = yield* choose('What does this clue rule out?', opts.map(label));
      if (opts[k] === right) c.ruleRight++;
    }
    // the score: half for the diagnosis, half for the rule-outs (clues you never found count as missed)
    c.score = (c.dxRight ? 0.5 : 0) + 0.5 * c.ruleRight / c.pathway.length;
  }

  // ---------------- spectrum: PATIENCE -> battle, score -> reward ----------------
  function battleFor(p) {
    const lead = Math.max(1, ...G.state.party.map(m => m.level));
    const levels = [3, 2, 2, 1, 1, 0][p], heals = [2, 2, 1, 1, 0, 0][p];
    const heal = G.state.badges.length < 4 ? 'POTION' : G.state.badges.length < 7 ? 'SUPER_POTION' : 'HYPER_POTION';
    return { boost: { levels, cap: lead + 2 }, extraItems: Array(heals).fill(heal) };
  }
  function battleLine(name, p) {
    if (p >= 4) return name + ': Thanks for really listening. Now, a fair match!';
    if (p >= 2) return name + ': OK... let\'s just battle.';
    if (p >= 1) return name + ': I\'m done talking. I won\'t hold back!';
    return name + ' says nothing and gets ready to battle hard.';
  }
  function rewardFor(s) {
    const b = G.state.badges.length;
    const money = Math.round(s * (100 + 120 * b));
    const item = s >= 0.95 ? 'RARE_CANDY' : s >= 0.65 ? (b < 4 ? 'GREAT_BALL' : 'ULTRA_BALL') : s >= 0.35 ? (b < 4 ? 'POTION' : 'SUPER_POTION') : null;
    return { money, item };
  }
  function caseNotes(c) {
    const pages = ['CASE NOTES: ' + c.name + '\nScore ' + pct(c.score) + ', PATIENCE ' + c.patience + '/5',
      'Diagnosis: ' + c.target + (c.dxRight ? ' (you got it!)' : '\nYou said: ' + c.said),
      'Entry: ' + c.table.group];
    c.pathway.forEach((p, i) => pages.push((i + 1) + '. Rule out ' + p.diff + (c.found[i + 1] ? '' : ' (clue not found)') + '\nClue: ' + (c.clues[i + 1] || p.ruleOut)));
    if (c.teaching) pages.push('Note: ' + c.teaching);
    return pages.join('\f');
  }

  // ---------------- hooks used by G.trainerBattleFlow (src/game/battleflow.js) ----------------
  const keyOf = a => G.ow.map.name + ':' + a.obj.id;
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  let current = null;
  G.dxStudy = {
    before: function* (a) {
      const mode = G.state.options.study || 0;
      const why = m => { if (typeof console !== 'undefined') console.info('STUDY CASES (' + (a.obj && a.obj.id) + '): ' + m); return null; };
      if (!mode) return why('off. Turn it on with START > OPTION in the game.');
      if (!G.claude || !G.claude.available() || !G.DX_TABLES || !a.obj || !a.obj.trainer) return why('not available here.');
      const key = keyOf(a), cases = G.state.dxCases = G.state.dxCases || {};
      const saved = cases[key];
      if (saved) { // a rematch after a loss: same PATIENCE and score, no second interview
        current = { key, rematch: true, name: saved.name, patience: saved.p, score: saved.s };
        return { battle: battleFor(saved.p), battleLine: saved.name + ': Back for a rematch?' };
      }
      if (mode === 1 && hash(key) % 3) return why('SOME skips this trainer (set ALL for every trainer).'); // the same third every time
      const c = rollCase();
      c.key = key;
      why('starting a case.');
      if (!(yield* interview(c, a))) { yield* G.say('(The study case could not start: Claude did not answer.)'); return null; } // a normal battle
      yield* diagnose(c);
      cases[key] = { name: c.name, p: c.patience, s: c.score }; // kept, so a reload or a loss can't reroll the case
      (G.state.dxLog = G.state.dxLog || []).push({ at: Date.now(), table: c.table.id, dx: c.target, said: c.said, score: c.score, patience: c.patience });
      current = c;
      return { battle: battleFor(c.patience), battleLine: battleLine(c.name, c.patience) };
    },
    after: function* (a, result) {
      const c = current; current = null;
      if (!c) return;
      if (!c.rematch) yield* G.say(caseNotes(c));
      if (result !== 'win') { yield* G.say('Win the rematch to get ' + c.name + '\'s thanks.'); return; }
      const { money, item } = rewardFor(c.score);
      delete G.state.dxCases[c.key].p; G.state.dxCases[c.key].done = true;
      if (!money && !item) { yield* G.say(c.name + ': Good battle. Keep studying!'); return; }
      yield* G.say(c.name + ': ' + (c.score >= 0.65 ? 'You really understood me. Take this!' : 'Thanks for listening. Here!'));
      if (money) { G.state.money += money; if (G.sfx) G.sfx('item'); yield* G.say(G.state.name + ' got ¥' + money + ' for the case work!'); }
      if (item) yield* G.S.give(item);
    },
    // OPTION menu: OFF -> SOME -> ALL -> OFF
    toggle: function* () {
      const O = G.state.options, next = ((O.study || 0) + 1) % 3;
      if (next === 1 && !(yield* G.claude.ensureAccess('STUDY CASES'))) return;
      O.study = next;
    },
    label: () => 'STUDY CASES: ' + ['OFF', 'SOME', 'ALL'][G.state.options.study || 0],
  };
})(window.G);
