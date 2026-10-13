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
  // lowyield: polite and reasonable but subtly less useful; it costs no PATIENCE, only one of the case's turns
  const KIND_PATIENCE = { good: 0, lowyield: 0, sensitive: -1, rapport: 1, leading: -1, judgmental: -1, offtopic: -1, hostile: -2 };
  const KIND_LABEL = { good: 'Good question', lowyield: 'Low-yield question', sensitive: 'Sensitive topic', rapport: 'Good rapport', leading: 'Leading question', judgmental: 'Judgmental question', offtopic: 'Off-topic question', hostile: 'Hostile question' };
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (a, k) => shuffle(a.slice()).slice(0, k);

  // ---------------- names for menus ----------------
  // "Tourette's Disorder (motor and vocal tics, ...)" -> "Tourette's Disorder"; Neurocognitive "Major" -> full name
  function memberName(t, m) {
    // only a trailing note goes: "Social (Pragmatic) Communication Disorder" and "Premature (Early) Ejaculation" stay whole
    let n = m.replace(/\.\s.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (t.id === '3.16.2') n += ' Neurocognitive Disorder';
    if (t.id === '3.18.1') n += ' Disorder'; // "Exhibitionistic" -> "Exhibitionistic Disorder"
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
  // CASE LEVEL grows with badges: 1 (0-2) overlaps only, 2 (3-5) + a mimic, 3 (6-8) + mimic and maybe a comorbidity
  const caseLevel = () => { const b = G.state.badges.length; return b >= 6 ? 3 : b >= 3 ? 2 : 1; };
  const targetOf = t => t.members ? memberName(t, t.members[rnd(t.members.length)]) : t.name;
  // second diagnoses and red herrings come from another chapter, and never from a childhood-only diagnosis (Reactive
  // Attachment needs signs before age 5, so it can't sit on top of an adult's case)
  const CHILD_ONLY = new Set(['3.1.1', '3.1.2', '3.1.5', '3.1.6', '3.4.4', '3.5.2', 'x.1.1', 'x.7.1', 'x.7.2', 'x.19.1', 'x.19.2']);
  // townsfolk who can share an ADULT CASE from "their clinic files": adult-looking sprites only
  const CLINICIANS = new Set(['scientist', 'gentleman', 'middle_aged_man', 'middle_aged_woman', 'silph_worker_m', 'silph_worker_f', 'balding_guy']);
  // ---------------- who the NPC is: their sprite gives an age group and a sex ----------------
  // child (about 5-9), kid (10-13, youngsters and bug catchers), teen, adult, elder. A case has to fit them.
  const PEOPLE = {
    little_boy: ['child', 'm'], little_girl: ['child', 'f'], gameboy_kid: ['child', 'm'], youngster: ['kid', 'm'],
    girl: ['teen', 'f'], brunette_girl: ['teen', 'f'], swimmer: ['adult', 'm'], cooltrainer_m: ['adult', 'm'], cooltrainer_f: ['adult', 'f'],
    beauty: ['adult', 'f'], daisy: ['adult', 'f'], mom: ['adult', 'f'], middle_aged_woman: ['adult', 'f'], silph_worker_f: ['adult', 'f'],
    channeler: ['adult', 'f'], nurse: ['adult', 'f'], link_receptionist: ['adult', 'f'], super_nerd: ['adult', 'm'], scientist: ['adult', 'm'],
    hiker: ['adult', 'm'], biker: ['adult', 'm'], gambler: ['adult', 'm'], rocker: ['adult', 'm'], sailor: ['adult', 'm'], cook: ['adult', 'm'],
    fisher: ['adult', 'm'], gentleman: ['adult', 'm'], middle_aged_man: ['adult', 'm'], balding_guy: ['adult', 'm'], silph_worker_m: ['adult', 'm'],
    guard: ['adult', 'm'], clerk: ['adult', 'm'], waiter: ['adult', 'm'], rocket: ['adult', 'm'], gym_guide: ['adult', 'm'], captain: ['adult', 'm'],
    safari_zone_worker: ['adult', 'm'], bike_shop_clerk: ['adult', 'm'], bill: ['adult', 'm'],
    gramps: ['elder', 'm'], gambler_asleep: ['elder', 'm'], fishing_guru: ['elder', 'm'], warden: ['elder', 'm'], mr_fuji: ['elder', 'm'], granny: ['elder', 'f'],
  };
  // a sprite not in the list counts as an adult of either sex
  const personOf = a => { const p = PEOPLE[a && a.sprite]; return p ? { age: p[0], sex: p[1] } : a ? { age: 'adult', sex: null } : null; };
  const AGE_TEXT = { child: 'a young child (about 6 to 9)', kid: 'a kid (about 10 to 13)', teen: 'a teenager (about 14 to 18)', adult: 'an adult', elder: 'an older adult (65 or more)' };
  // tables that need an adult patient (personality disorders, substance use and withdrawal, gambling, neurocognitive
  // decline, medication side effects, malingering), and the tables a child or kid can have
  const ADULT_ONLY = new Set(['3.15.1', '3.15.2', '3.16.2', 'x.15.1', 'x.15.2', 'x.16.1', 'x.20.1', 'x.21.1', '3.17.1', '3.17.2', '3.17.3', '3.17.4',
    '3.17.5', '3.17.6', '3.17.7', '3.17.8', '3.17.9', '3.17.10', '3.17.11', '3.9.5', '3.4.3', '3.10.4']);
  const KID_OK = new Set(['3.1.1', '3.1.2', '3.1.3', '3.1.4', '3.1.5', '3.1.6', 'x.1.1', '3.4.1', '3.4.4', '3.5.1', '3.5.2', '3.5.3', '3.5.4', '3.5.7',
    '3.6.1', '3.6.4', '3.7.1', '3.7.2', 'x.7.1', 'x.7.2', '3.10.1', 'x.10.1', 'x.19.1', 'x.19.2', '3.11.1', 'x.11.4', 'x.11.5', '3.14.1', '3.14.2', '3.14.3']);
  function tableFits(t, who) {
    if (!who) return true;
    if (who.age === 'child' || who.age === 'kid') return KID_OK.has(t.id) && (t.id !== 'x.7.1' || who.age === 'child');
    if (who.age === 'teen') return !ADULT_ONLY.has(t.id) && t.id !== 'x.7.1';
    return !CHILD_ONLY.has(t.id);
  }
  const otherTable = t => { const pool = G.DX_TABLES.filter(x => x.group !== t.group && !CHILD_ONLY.has(x.id)); return pool[rnd(pool.length)]; };
  function rollCase(adult, who) {
    const all = adult ? G.DX_ADULT_TABLES : G.DX_TABLES, fit = all.filter(t => tableFits(t, who));
    const list = fit.length ? fit : all;
    const t = list[rnd(list.length)], level = caseLevel();
    const target = targetOf(t);
    const n = t.diffs.length, k = Math.min(n, level === 1 ? 3 : level === 2 ? 3 + rnd(2) : 4 + rnd(2));
    const pathway = sample(t.diffs.map((d, i) => i), k).map(i => ({ diff: t.diffs[i][0], ruleOut: t.diffs[i][1] }));
    const c = { source: 'live', table: t, target, pathway, level, adult: !!adult, system: adult ? SYSTEM_ADULT : SYSTEM, log: [] };
    // a TWIST (about 1 case in 4): the symptoms look like the table's disorder, but the real answer is one of its
    // rule-outs that needs no (or another) mental diagnosis: a medical cause, a substance, a normal reaction
    const twistIdx = t.diffs.map((d, i) => i).filter(i => TWIST.test(t.diffs[i][0]));
    if (!adult && twistIdx.length && rnd(4) === 0) {
      const i = twistIdx[rnd(twistIdx.length)];
      c.twist = true; c.lure = target; c.target = t.diffs[i][0]; c.twistWhy = t.diffs[i][1];
      c.pathway = [{ diff: target, ruleOut: 'the real cause (' + t.diffs[i][1] + ') explains the symptoms better' }]
        .concat(pathway.filter(p => p.diff !== c.target)).slice(0, Math.max(3, k));
    }
    if (level >= 2) { const m = otherTable(t); c.mimic = { name: targetOf(m), core: m.core }; }
    if (level >= 3 && !c.twist && rnd(2)) { const m = otherTable(t); c.comorbid = { name: targetOf(m), core: m.core }; }
    return c;
  }
  // rule-outs that can be the real answer of a TWIST case: medical, substance, normal or not-a-disorder explanations
  const TWIST = /medical|substance|medication|normal|bereavement|nonpathological|isolated panic|extreme danger|realistic|proportionate|appropriate for age|short sleeper|long sleeper|insufficient sleep|sleep deprivation/i;

  // ---------------- the prompt ----------------
  const SYSTEM = [
    'You run a study game for differential diagnosis inside a pixel-art POKéMON RED remake (Kanto). The player is a student. They interview one fictional patient, then diagnose. The patient is a POKéMON TRAINER the player met on the road, who wants to talk before their battle.',
    'The first message gives the clinical content: the target diagnosis, its core features, and the rule-out pathway (each step is a differential and the finding that rules it out). Keep every criterion, duration, count and clue correct.',
    '',
    'Theme rules. Change names, places, objects and jobs to fit the POKéMON world (the clinic is the POKéMON CENTER, the school is the Trainer School, a phone can be a POKé BALL when the clinical meaning stays the same). The patient is a person, never a POKéMON. Keep the language respectful: never joke about the disorder or the patient. Do not copy text or dialogue from the franchise; write everything in your own words.',
    '',
    'Make the case feel real, not a list of denials. For each pathway step there is an overlap: a true symptom the patient has that the target shares with that differential, so the differential looks possible at first. Write each clue as a concrete, positive finding where you can (a timeline, a context, what a family member saw, a test result), not a bare "no". About half of the good questions should get a "yes" with detail.',
    '',
    'Interview rules. Answer only what the question asks. Reveal a pathway clue only when a question points toward it, and never all clues at once. A low-yield question gets a short, true answer with little new detail. A collateral source (a family member, a friend, a gym mate) can add facts the patient hides or forgets. Never name the target diagnosis or any differential in the patient\'s words or in the feedback.',
    '',
    'Options. Each turn, write exactly four questions the player can ask next: one good option (sometimes two) that leads to a core feature, an overlap or a clue not found yet; one or two lowyield options; exactly one offtopic option that is a light, funny question about the POKéMON world (a favorite POKéMON, a gym, a snack); and at most one leading, judgmental or sensitive option. Lowyield options must sound as reasonable and polite as the good ones, so the player has to think: a closed yes/no question, a question about something already known, a question that digs into an area already ruled out, or one that jumps to a conclusion too early. Change the position of the good options each turn. Label every option with its true kind: good (open, relevant, respectful), lowyield, sensitive (appropriate but on a sensitive topic; give it a short topic word), rapport (builds trust after a hard moment, and may also ask something), leading, judgmental, offtopic, hostile (threatening or shaming). The game uses the kinds to score the player, so label them honestly.',
    '',
    'Writing. Plain text only: no markdown, no emoji. Each option is a question of at most 48 characters. The patient\'s answer is 2 to 4 sentences, at most 300 characters, in character. Feedback is one short line about what the question just asked checks, at most 70 characters, and it must not start with a verdict word like Good or Bad, because the game already shows one (for example: This looks for a pattern over time.). Write POKéMON words in CAPS (POKéMON, POKé BALL, POKéMON CENTER).',
    '',
    'Safety. All cases are fictional and for study. For eating disorders, give weight only as a clinical finding (for example BMI) and never describe restriction, purging or weight-loss methods. For Factitious Disorder Imposed on Another, keep any harm general and non-graphic. Keep elimination disorders (enuresis, encopresis) clinical and non-graphic, and never make them a joke.',
  ].join('\n');
  // OPTION > ADULT CASES (Sexual Dysfunctions, Paraphilic Disorders): the skill allows these only for adult patients, in
  // a plain clinical setting with no theme, in clinical, non-explicit language. Same game rules otherwise.
  const SYSTEM_ADULT = SYSTEM.split('\n').map(line => {
    if (line.startsWith('You run a study game')) return 'You run a study game for differential diagnosis. The player is a student. They interview one fictional adult patient in a plain outpatient clinic, then diagnose. A clinician in the game shares this case from their files.';
    if (line.startsWith('Theme rules.')) return 'Setting rules. No theme at all: a plain, present-day outpatient clinic, ordinary names and jobs, and no POKéMON words, places or creatures anywhere in the case, the options or the feedback. The patient is an adult. Keep the language respectful and professional: never joke about the disorder or the patient.';
    if (line.startsWith('Options.')) return line.replace('exactly one offtopic option that is a light, funny question about the POKéMON world (a favorite POKéMON, a gym, a snack)', 'exactly one offtopic option (small talk about the weather, traffic or a hobby)');
    if (line.startsWith('Interview rules.')) return line.replace('(a family member, a friend, a gym mate)', '(a partner, a family member, a friend)');
    if (line.startsWith('Writing.')) return line.replace(' Write POKéMON words in CAPS (POKéMON, POKé BALL, POKéMON CENTER).', '');
    if (line.startsWith('Safety.')) return line + ' This case is about sexual function or sexual interest: use clinical, non-explicit language only, never describe sexual acts in detail, and keep the patient and everyone involved an adult. For Paraphilic Disorders, focus on criteria (duration, distress, impairment, consent), and describe any nonconsenting act only in general, non-graphic terms.';
    return line;
  }).join('\n');

  // step: the pathway step a good option checks (its answer must reveal that step's overlap or clue), 0 = none
  const OPTION = { type: 'object', additionalProperties: false, required: ['text', 'kind', 'topic', 'step'], properties: {
    text: { type: 'string' }, kind: { type: 'string', enum: Object.keys(KIND_PATIENCE) }, topic: { type: 'string' }, step: { type: 'integer' } } };
  const OPEN_SCHEMA = { type: 'object', additionalProperties: false,
    required: ['patient_name', 'age', 'collateral', 'core_facts', 'clue_facts', 'mimic_explanation', 'neutral_facts', 'teaching_note', 'opening', 'scene', 'options'],
    properties: {
      patient_name: { type: 'string' }, age: { type: 'integer' }, collateral: { type: 'string' },
      core_facts: { type: 'array', items: { type: 'string' } },
      clue_facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['step', 'overlap', 'fact'], properties: { step: { type: 'integer' }, overlap: { type: 'string' }, fact: { type: 'string' } } } },
      mimic_explanation: { type: 'string' },
      neutral_facts: { type: 'array', items: { type: 'string' } },
      teaching_note: { type: 'string' }, opening: { type: 'string' }, scene: { type: 'string' },
      options: { type: 'array', items: OPTION },
    } };
  const TURN_SCHEMA = { type: 'object', additionalProperties: false, required: ['feedback', 'answer', 'revealed_steps', 'all_found', 'options'],
    properties: {
      feedback: { type: 'string' }, answer: { type: 'string' },
      revealed_steps: { type: 'array', items: { type: 'integer' } }, all_found: { type: 'boolean' },
      options: { type: 'array', items: OPTION },
    } };

  function brief(c, a) {
    const t = c.table, tc = a.obj.trainer ? (G.DATA.trainerClasses[a.obj.trainer.cls] || {}).name || 'TRAINER' : null;
    const who = String(a.sprite || a.obj.sprite || 'townsperson').replace(/_/g, ' ');
    const place = String(G.ow.map.name).replace(/([a-z])([A-Z0-9])/g, '$1 $2');
    return [
      c.twist ? 'The case LOOKS LIKE: ' + c.lure + '. The real answer is: ' + c.target + ' (see TWIST below).'
        : 'Target diagnosis: ' + c.target + (t.members ? ' (from the table ' + t.name + ')' : ''),
      'Diagnostic class: ' + t.group,
      'Core features' + (c.twist ? ' of what it looks like (show only some of them)' : '') + ': ' + t.core,
      'Rule-out pathway (one clue each, written as a finding; never name the differential):',
      c.pathway.map((p, i) => '  ' + (i + 1) + '. ' + p.diff + ': ' + p.ruleOut + (p.probe ? ' (a question that checks it: "' + p.probe + '")' : '')).join('\n'),
      '',
      c.adult ? 'Setting: a plain outpatient clinic, no theme. The patient is an adult (25 or older) who came in for help.' :
      'Setting: ' + place + ' in Kanto. ' + (tc ? 'The patient is a ' + tc + ' who stopped the player for a POKéMON battle and wants to talk first.'
        : 'The patient is a local person (they look like: ' + who + ') whom the player just spoke to, and who opens up about something on their mind.'),
      !c.adult && personOf(a) ? 'The patient is ' + AGE_TEXT[personOf(a).age] + (personOf(a).sex ? ', ' + (personOf(a).sex === 'f' ? 'female' : 'male') : '') + '. Their age, sex and life must fit this.' : '',
      !c.adult && a.obj.textLabel && G.textFor(a.obj.textLabel) !== '...' ? 'What this person says in the original game (their personality and life): ' + G.fmt(G.textFor(a.obj.textLabel)).replace(/\f/g, ' ') : '',
      c.comorbid ? 'Comorbidity: the patient ALSO meets criteria for ' + c.comorbid.name + ' (' + c.comorbid.core + '). Put its core features in core_facts too, so a careful interview can find both. Never name it.' : '',
      c.mimic ? 'Mimic (a red herring): give the patient one or two symptoms that look like ' + c.mimic.name + ' (' + c.mimic.core + '), but that something else fully explains (a medicine, a recent stressor, a normal reaction, a medical condition). The explanation must come out only if the player asks about it. Put the explanation in mimic_explanation and never name the mimic.' : 'mimic_explanation: an empty string (this case has no mimic).',
      c.twist ? 'TWIST: the patient does NOT have ' + c.lure + '. The real explanation is step 1\'s opposite: "' + c.target + '" (' + c.twistWhy + '). Give them symptoms that look like ' + c.lure + ' at first, but make the evidence for the real explanation clear and positive (a test, a timeline, a cause, a normal context) once the player asks. Step 1 is ruled out by that evidence. Do not hint at the twist in the opening.' : '',
      'Every good option must check one specific thing: a pathway step (set step to its number, and the answer must reveal that step\'s overlap or clue) or a core feature (step 0). Never offer a good option that leads nowhere.',
      'Plan the hidden facts first: the core features with durations and counts (core_facts); for each pathway step (clue_facts, step = its number above) an overlap (a true symptom shared with that differential) and the clue that rules it out; one or two neutral facts; and a collateral source (who they are).',
      'teaching_note: one short teaching point for the answer key, for example: comorbidity is the default; Adjustment Disorder and Other Specified categories are used only when no specific disorder fits; a trait is not a diagnosis; give the subtype or specifier; history, course and tests can change the decision.',
      'opening: only the patient\'s own words, 1 to 3 sentences, no quotation marks: why they want to talk, the chief complaint only, no history and no narration.',
      'scene: one short narration line in the style of the game ("You see a young man sitting on the bench, pale and sweaty."), or an empty string. The game shows it only now and then.',
      'Then four options for the first question.',
    ].join('\n');
  }

  // one request; returns the parsed JSON or null
  function* call(c, schema, timeout, effort) {
    const text = yield* G.claude.request({ system: c.system || SYSTEM, messages: c.messages, format: schema, effort }, timeout);
    if (!text) return null;
    try { const j = JSON.parse(text); c.messages.push({ role: 'assistant', content: text }); return j; } catch (e) { console.warn('study case: bad JSON', e); return null; }
  }
  const goodOptions = opts => (Array.isArray(opts) ? opts : []).filter(o => o && o.text && KIND_PATIENCE[o.kind] !== undefined).slice(0, 4);

  // ---------------- the interview ----------------
  // every case keeps a log for OPTION > DOWNLOAD CASE LOG: what was said, asked, chosen, and the case notes
  const note = (c, line) => c.log.push(line);
  function* sayLog(c, text) { note(c, text.replace(/\f/g, ' ')); yield* G.say(text); }
  // the full explanation only for the first two cases; after that a single short line
  function* intro(c, a) {
    const seen = G.state.dxIntros = (G.state.dxIntros || 0) + 1;
    const extra = c.level >= 3 ? ' Watch for a second diagnosis and a red herring.' : c.level === 2 ? ' Watch for a red herring.' : '';
    if (seen > 2) { yield* G.say((c.adult ? 'ADULT CASE. ' : '') + 'CASE LEVEL ' + c.level + '.' + extra); return; }
    yield* G.say((a.obj.trainer ? 'This trainer wants to talk before the battle.' : c.adult ? 'ADULT CASE: a clinic case, with no theme.' : 'STUDY CASE') + '\fCASE LEVEL ' + c.level + '.' + extra +
      '\fListen, ask good questions, then diagnose.\fPATIENCE ' + meter(5) +
      '\fBad questions use up PATIENCE' + (a.obj.trainer ? ' and make the battle harder.' : ' and shrink their thanks.'));
  }
  // the opening: the person's own words, with a short scene line now and then (about 1 time in 3)
  function* opening(c, open) {
    const scene = plain(open.scene || ''), text = plain(open.opening).replace(/^"|"$/g, '');
    if (scene && (open.sceneAlways || rnd(3) === 0)) yield* sayLog(c, scene);
    // an opening can start with someone else speaking ("MOM: ..."); otherwise it is the patient
    yield* sayLog(c, /^[A-Z][A-Z .']{1,14}:/.test(text) ? text : c.name + ': ' + text);
  }
  // the game shows "Good question." itself, so a reply's feedback that starts with the same verdict is trimmed
  const trimVerdict = f => plain(f).replace(/^(good|great|nice|bad|poor|ok|okay|low[- ]yield|off[- ]topic|leading|judgmental|hostile|sensitive)( question)?[.!,:]\s*/i, '');
  // a clue is found by one question: remember which one and what the patient said, in the order found
  function markFound(c, step, q, a) {
    if (!(step >= 1) || !c.clues[step] || c.found[step]) return;
    c.found[step] = true; c.foundBy[step] = { q, a }; c.foundOrder.push(step);
  }
  // the kind of the chosen question moves PATIENCE, as in the skill's table (sensitive: once per topic)
  function applyKind(c, o) {
    let d = KIND_PATIENCE[o.kind];
    if (o.kind === 'sensitive') { const tp = String(o.topic || o.text).toLowerCase(); if (c.topics[tp]) d = 0; c.topics[tp] = true; }
    c.patience = Math.max(0, Math.min(5, c.patience + d));
    note(c, '> ' + o.text + '   [' + o.kind + (d ? ', PATIENCE ' + (d > 0 ? '+' : '') + d : '') + ' -> ' + c.patience + '/5]');
    return KIND_LABEL[o.kind] + (d ? ' (PATIENCE ' + (d > 0 ? '+' : '') + d + ')' : '') + '.';
  }
  function* endCheck(c, turn) {
    if (c.patience <= 0) { yield* sayLog(c, c.name + ' has had enough and stops talking.\fYou have to diagnose with what you know.'); return true; }
    if (turn >= MAX_TURNS) { yield* sayLog(c, c.name + ': I think I\'ve said all I can for now.'); return true; }
    return false;
  }
  const askHead = (c, allFound) => 'PATIENCE ' + meter(c.patience) + (allFound ? '\nYou know a lot now.' : '') + '\nWhat do you ask?';

  // LIVE: Claude plays the patient
  function* liveInterview(c, a) {
    c.messages = [{ role: 'user', content: brief(c, a) }];
    let open;
    if (c.plan) { // a PREPARED case: the plan stands in for Claude's opening reply, so the opening call is skipped
      open = c.plan;
      c.messages.push({ role: 'assistant', content: JSON.stringify(open) });
    } else open = yield* call(c, OPEN_SCHEMA, OPEN_TIMEOUT, 'medium');
    if (!open || goodOptions(open.options).length < 2) return false;
    c.name = plain(open.patient_name).toUpperCase().slice(0, 12) || 'TRAINER';
    c.clues = {}; c.overlaps = {};
    (open.clue_facts || []).forEach(f => { if (f.step >= 1 && f.step <= c.pathway.length) { c.clues[f.step] = plain(f.fact); c.overlaps[f.step] = plain(f.overlap); } });
    c.mimicWhy = plain(open.mimic_explanation);
    c.teaching = plain(open.teaching_note);
    c.found = {}; c.foundBy = {}; c.foundOrder = []; c.patience = 5; c.topics = {};
    yield* intro(c, a);
    yield* opening(c, open);
    let options = goodOptions(open.options), turn = 0, allFound = false;
    for (;;) {
      if (yield* endCheck(c, turn)) break;
      const r = yield* choose(askHead(c, allFound), options.map(o => label(plain(o.text))).concat(['(I am ready to diagnose)']));
      if (r < 0 || r >= options.length) break;
      const o = options[r], kindNote = applyKind(c, o);
      turn++;
      // a good question about a step finds that step's clue, whatever the reply says
      const probe = (o.kind === 'good' || o.kind === 'rapport') && o.step >= 1 ? o.step : 0;
      c.messages.push({ role: 'user', content: 'The player asked option ' + 'ABCD'[r] + ' (' + o.kind + (o.step ? ', step ' + o.step : '') + '): "' + o.text + '". PATIENCE is now ' + c.patience + '/5.' +
        (o.step >= 1 && o.kind === 'good' ? ' Answer with the overlap and the clue of step ' + o.step + '.' : '') +
        (c.patience <= 0 ? ' PATIENCE is zero: the patient answers in one sentence that they want to stop talking.' : '') });
      const t = yield* call(c, TURN_SCHEMA, TURN_TIMEOUT, 'low');
      if (!t) { markFound(c, probe, o.text, ''); yield* sayLog(c, kindNote + '\f' + c.name + ' goes quiet. Time to diagnose.'); break; }
      [probe].concat(t.revealed_steps || []).forEach(s => markFound(c, s, plain(o.text), plain(t.answer)));
      allFound = !!t.all_found;
      const fb = trimVerdict(t.feedback || '');
      yield* sayLog(c, kindNote + (fb ? ' ' + fb : '') + '\f' + c.name + ': ' + plain(t.answer));
      const next = goodOptions(t.options);
      if (next.length < 2) break;
      options = next;
    }
    return true;
  }

  const interview = liveInterview;

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
  // small tables (for example, Specific Learning Disorder has one differential): fill the menu with names from the
  // same chapter first, then from anywhere
  function padNames(t, have, n) {
    if (n <= 0) return [];
    const near = G.DX_TABLES.filter(x => x !== t && x.group === t.group), far = G.DX_TABLES.filter(x => x.group !== t.group);
    const names = shuffle(near.map(x => x.name)).concat(shuffle(far.map(x => x.name)));
    return names.filter((x, i) => !have.includes(x) && names.indexOf(x) === i).slice(0, n);
  }
  function* diagnose(c) {
    const t = c.table;
    // every name the menus can use for this case: the answer, what it looked like (a TWIST's lure), the pathway, the table
    const names = [c.target].concat(c.lure ? [c.lure] : [], c.pathway.map(p => p.diff), t.diffs.map(d => d[0]))
      .filter((n, i, all) => all.indexOf(n) === i);
    const others = names.filter(n => n !== c.target).slice(0, 4);
    const choices = shuffle([c.target].concat(others, padNames(t, [c.target].concat(others), 4 - others.length)));
    const r = yield* choose('What is your diagnosis?', choices.map(label));
    c.said = choices[r];
    c.dxRight = c.said === c.target;
    note(c, 'DIAGNOSIS: you said ' + c.said + ' (' + (c.dxRight ? 'right' : 'answer: ' + c.target) + ')');
    yield* G.say(c.trainer ? 'Noted. The case notes come after the battle.' : 'Noted.');
    c.ruleRight = 0;
    // the clues you found, in the order you found them, shown as you heard them: your question and the reply
    for (const step of c.foundOrder) {
      const right = c.pathway[step - 1].diff, by = c.foundBy[step];
      const pool = names.filter(n => n !== right && n !== c.target);
      const near = sample(pool, 3);
      const opts = shuffle([right].concat(near, padNames(t, [right].concat(near), 3 - near.length)));
      yield* G.say(by.a ? 'You asked: "' + by.q + '"\f' + c.name + ' said: ' + by.a + '\fIn short: ' + c.clues[step] : 'You found this clue:\f' + c.clues[step]);
      const k = yield* choose(by.a ? 'What does that answer rule out?' : 'What does this clue rule out?', opts.map(label));
      if (opts[k] === right) c.ruleRight++;
      note(c, 'RULE-OUT for "' + by.q + '" -> you said ' + opts[k] + ' (' + (opts[k] === right ? 'right' : 'answer: ' + right) + ')');
    }
    // LEVEL 3 always asks about a second diagnosis, so a comorbid case is not given away ("None" is right without one)
    if (c.level >= 3) {
      const right = c.comorbid ? c.comorbid.name : 'None';
      const decoys = shuffle(G.DX_TABLES.filter(x => x !== c.table && (!c.comorbid || targetOf(x) !== c.comorbid.name))).slice(0, c.comorbid ? 3 : 4).map(targetOf);
      const opts = ['None'].concat(shuffle((c.comorbid ? [c.comorbid.name] : []).concat(decoys)));
      const k = yield* choose('Is there a second diagnosis?', opts.map(label));
      c.saidSecond = opts[k]; c.secondRight = opts[k] === right;
      note(c, 'SECOND DIAGNOSIS: you said ' + c.saidSecond + ' (' + (c.secondRight ? 'right' : 'answer: ' + right) + ')');
    }
    // the score: the diagnosis (50%, or 40% + 10% for the second one at LEVEL 3) and the rule-outs (50%; clues you
    // never found count as missed)
    c.score = (c.level >= 3 ? (c.dxRight ? 0.4 : 0) + (c.secondRight ? 0.1 : 0) : (c.dxRight ? 0.5 : 0)) + 0.5 * c.ruleRight / c.pathway.length;
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
  // ---------------- boons: the reward for a good case ----------------
  // Money grows with the score. On top of that, one boon is drawn from the score's tier (35% / 65% / 95%):
  // [item, count], or a special boon ({ repel: steps }, { mon: true }). After 5 badges the basic items upgrade.
  const BOONS = {
    1: [['POTION', 2], ['ANTIDOTE', 2], ['PARLYZ_HEAL', 2], ['AWAKENING', 1], ['BURN_HEAL', 1], ['ESCAPE_ROPE', 1], ['REPEL', 2], ['POKE_BALL', 3], ['FRESH_WATER', 2], ['X_DEFEND', 1], { repel: 100 }],
    2: [['SUPER_POTION', 2], ['GREAT_BALL', 2], ['REVIVE', 1], ['FULL_HEAL', 2], ['SUPER_REPEL', 1], ['X_ATTACK', 2], ['X_SPEED', 2], ['X_SPECIAL', 2], ['DIRE_HIT', 1], ['ETHER', 2], ['NUGGET', 1], { repel: 200 }],
    3: [['RARE_CANDY', 1], ['PP_UP', 1], ['HP_UP', 1], ['PROTEIN', 1], ['IRON', 1], ['CARBOS', 1], ['CALCIUM', 1], ['MAX_REVIVE', 1], ['ULTRA_BALL', 3], ['ELIXER', 1],
      ['MOON_STONE', 1], ['FIRE_STONE', 1], ['WATER_STONE', 1], ['THUNDER_STONE', 1], ['LEAF_STONE', 1], { mon: true }, { mon: true }],
  };
  const UPGRADE = { POTION: 'SUPER_POTION', SUPER_POTION: 'HYPER_POTION', POKE_BALL: 'GREAT_BALL', GREAT_BALL: 'ULTRA_BALL', REPEL: 'SUPER_REPEL', SUPER_REPEL: 'MAX_REPEL', ETHER: 'MAX_ETHER', FRESH_WATER: 'LEMONADE' };
  // a POKéMON the person raised and wants to see travel: not legendary, a few levels under your strongest
  const GIFT_MONS = ['EEVEE', 'PIKACHU', 'ABRA', 'DRATINI', 'LAPRAS', 'PORYGON', 'CHANSEY', 'SCYTHER', 'PINSIR', 'KANGASKHAN', 'TAUROS', 'HITMONLEE', 'HITMONCHAN', 'OMANYTE', 'KABUTO', 'GROWLITHE', 'VULPIX', 'MAGNEMITE', 'FARFETCHD', 'LICKITUNG'];
  function rewardFor(s) {
    const b = G.state.badges.length;
    const money = s < FAIL_SCORE ? 0 : Math.round(s * (100 + 120 * b)); // a failed case earns nothing
    const tier = s >= 0.95 ? 3 : s >= 0.65 ? 2 : s >= 0.35 ? 1 : 0;
    let boon = tier ? BOONS[tier][rnd(BOONS[tier].length)] : null;
    if (Array.isArray(boon) && b >= 5 && UPGRADE[boon[0]]) boon = [UPGRADE[boon[0]], boon[1]];
    return { money, boon, tier };
  }
  // hand out the reward: money, then the boon; a score of 65% or more also lifts one waiting curse
  function* giveReward(c, giver) {
    const { money, boon, tier } = rewardFor(c.score);
    if (money) { G.state.money += money; if (G.sfx) G.sfx('item'); yield* G.say(G.state.name + ' got ¥' + money + ' for the case work!'); }
    if (tier >= 2 && (G.state.dxCurse || 0) > 0) {
      G.state.dxCurse--;
      yield* G.say(giver + ' sees that something heavy follows you...\fThey help you let it go. One curse is lifted!' + (G.state.dxCurse ? '\f(Curses still waiting: ' + G.state.dxCurse + ')' : ''));
    }
    if (!boon) return;
    if (Array.isArray(boon)) { yield* G.S.give(boon[0], boon[1]); return; }
    if (boon.repel) {
      G.state.repel = Math.max(G.state.repel || 0, boon.repel);
      yield* G.say(giver + ' tells you the quiet paths around here.\fWeak wild POKéMON will keep away for ' + boon.repel + ' steps!');
      return;
    }
    if (boon.mon) {
      const lead = Math.max(5, ...G.state.party.map(m => m.level));
      const sp = GIFT_MONS[rnd(GIFT_MONS.length)];
      yield* G.say(giver + ': I raised this one, but it wants to see the world.\fPlease take it with you!');
      if (!(yield* G.S.giftMon(sp, Math.max(5, lead - 5)))) yield* G.S.give('RARE_CANDY', 1); // no room: a RARE CANDY instead
    }
  }
  function caseNotes(c) {
    const pages = ['CASE NOTES: ' + c.name + '\nScore ' + pct(c.score) + ', PATIENCE ' + c.patience + '/5',
      (c.twist ? 'TWIST! It looked like ' + c.lure + ', but it was not.\n' : '') + 'Answer: ' + c.target + (c.dxRight ? ' (you got it!)' : '\nYou said: ' + c.said),
      'Entry: ' + c.table.group + (c.table.draft ? '\n(Draft table: check it against the book.)' : '')];
    if (c.level >= 3) pages.push('Second diagnosis: ' + (c.comorbid ? c.comorbid.name : 'none') + (c.secondRight ? ' (you got it!)' : '\nYou said: ' + c.saidSecond));
    c.pathway.forEach((p, i) => pages.push((i + 1) + '. Rule out ' + p.diff +
      (c.foundBy && c.foundBy[i + 1] ? '\nFound by: "' + c.foundBy[i + 1].q + '"' : '\nClue not found.' + (p.probe ? ' To find it, ask: "' + p.probe + '"' : '')) +
      (c.overlaps && c.overlaps[i + 1] ? '\nLooked like it: ' + c.overlaps[i + 1] : '') + '\nRuled out by: ' + (c.clues[i + 1] || p.ruleOut)));
    if (c.mimic) pages.push('Red herring: it looked like ' + c.mimic.name + (c.mimicWhy ? ', but ' + c.mimicWhy : '.'));
    if (c.teaching) pages.push('Note: ' + c.teaching);
    return pages.join('\f');
  }

  // No battle with townsfolk, so the results become their thanks. A failed case (under FAIL_SCORE) earns nothing.
  // Otherwise:
  //   heal  = PATIENCE/5 x min(1, score/65%) of every POKéMON's lost HP: a full heal needs PATIENCE 5 and 65%+
  //   score -> the same money and boon as a trainer's reward (giveReward)
  function* npcThanks(c) {
    const p = c.patience, failed = c.score < FAIL_SCORE;
    // in an ADULT CASE the patient is in the clinic file, so the townsperson who shared it does the thanking
    const who = c.adult ? 'The clinician' : c.name;
    if (failed) {
      yield* G.say(c.adult ? 'The clinician: ' + (p >= 4 ? 'Good bedside manner, but that diagnosis would not help the patient. Study the notes.' : 'That case did not go well. Study the notes.')
        : p >= 4 ? who + ': You listened well... but I don\'t think you understood me.' : who + ' walks away, still troubled.');
      return;
    }
    yield* G.say(c.adult ? 'The clinician: ' + (p >= 4 ? 'You handled that interview well.' : p >= 2 ? 'Not bad. Keep practicing.' : 'Right answer, but that patient would not come back...')
      : who + ': ' + (p >= 4 ? 'Thank you for really listening.' : p >= 2 ? 'Thanks for hearing me out.' : 'Well... thanks, I guess.'));
    const share = (p / 5) * Math.min(1, c.score / 0.65), full = share >= 0.999;
    const party = G.state.party.filter(m => m.hp > 0 || full);
    if (share > 0 && party.length) {
      if (full) party.forEach(m => m.healFull());
      else party.forEach(m => { m.hp = Math.min(m.maxhp, m.hp + Math.ceil((m.maxhp - m.hp) * share)); });
      if (G.sfx) G.sfx('heal');
      yield* G.say(who + (full ? ' looked after your team. Your POKéMON are fully healed!' : ' helped your POKéMON rest a little. They got back some HP.'));
    }
    yield* giveReward(c, who);
  }

  // ---------------- the curse: a failed case costs the next POKéMON that faints ----------------
  // A case fails below FAIL_SCORE (the same line where the reward item starts). Each failure adds one curse
  // (G.state.dxCurse). The next of your POKéMON to faint in a normal battle is released after that battle. Your
  // last POKéMON is never released, and link battles and the Battle Tower don't count.
  const FAIL_SCORE = 0.35;
  let doomed = null;
  G.onPlayerFaint = m => { if ((G.state.dxCurse || 0) > 0 && !doomed) doomed = m; };
  function* checkFail(c) {
    if (c.score >= FAIL_SCORE) return;
    G.state.dxCurse = (G.state.dxCurse || 0) + 1;
    yield* G.say('The case went badly. A heavy feeling follows you...\fCURSE: the next POKéMON of yours that faints will be released.' +
      (G.state.dxCurse > 1 ? '\f(Curses waiting: ' + G.state.dxCurse + ')' : ''));
  }
  function* releaseDoomed() {
    const m = doomed; doomed = null;
    const party = G.state.party, i = m ? party.indexOf(m) : -1;
    if (i < 0) return;
    if (party.length <= 1) { yield* G.say('The curse lingers... but ' + m.name + ' is your only POKéMON, so it stays with you.'); return; }
    party.splice(i, 1);
    G.state.dxCurse = Math.max(0, (G.state.dxCurse || 0) - 1);
    yield* G.say('The curse from your failed case falls on ' + m.name + '...\f' + m.name + ' was released. Bye, ' + m.name + '!' +
      (G.state.dxCurse ? '\f(Curses still waiting: ' + G.state.dxCurse + ')' : '\fThe heavy feeling is gone.'));
  }

  // ---------------- hooks used by G.trainerBattleFlow (src/game/battleflow.js) ----------------
  // ---------------- where a case comes from: OPTION > CASE SOURCE ----------------
  // Every case is played live with Claude. PREPARED (default) starts from a case plan written ahead of time
  // (src/data/dxplans.js): the patient, hidden facts, overlaps, clues, a probe question for each rule-out, any twist,
  // and the opening. That skips the opening call, the biggest one, so a case costs only the short turn replies.
  // FRESH: Claude plans the case too. MIX: about half and half. ADULT CASES are always FRESH (no plans for them).
  const SOURCES = ['PREPARED', 'FRESH', 'MIX'];
  const source = () => G.state.options.caseSource || 0;
  const liveOK = () => !!(G.claude && G.claude.available());
  // a plan fits an NPC when their age group and sex match the plan's patient, and a trainer only gets plans that can
  // happen right before a battle (trainer: false plans are for townsfolk only)
  const planFits = (b, a) => {
    const who = personOf(a);
    if (!who || !(b.ages || ['adult']).includes(who.age) || (b.sex && who.sex && b.sex !== who.sex)) return false;
    return !(a.obj.trainer && b.trainer === false) && !(!a.obj.trainer && b.trainer === true);
  };
  function planCase(a) {
    const plans = (G.DX_PLANS || []).filter(b => G.DX_TABLES.some(t => t.id === b.table) && planFits(b, a));
    if (!plans.length) return null;
    const level = caseLevel(), seen = G.state.dxPlanSeen = G.state.dxPlanSeen || {};
    const fits = plans.filter(b => (b.level || 1) <= level), pool = fits.length ? fits : plans;
    // plans you haven't played first, preferring your level; then the ones played least
    const fresh = pool.filter(b => !seen[b.id]), atLevel = fresh.filter(b => (b.level || 1) === level);
    const pickFrom = atLevel.length ? atLevel : fresh.length ? fresh : pool.filter(b => seen[b.id] === Math.min(...pool.map(x => seen[x.id])));
    const b = pickFrom[rnd(pickFrom.length)], t = G.DX_TABLES.find(x => x.id === b.table);
    const plan = { patient_name: b.name, age: b.age, collateral: b.collateral, core_facts: b.core,
      clue_facts: b.pathway.map((p, i) => ({ step: i + 1, overlap: p.overlap, fact: p.clue })),
      mimic_explanation: b.mimic ? b.mimic.why : '', neutral_facts: b.neutral || [], teaching_note: b.teaching, opening: b.opening, scene: b.scene || '', sceneAlways: !!b.sceneAlways,
      options: b.first.map(([text, kind, step]) => ({ text, kind, topic: '', step: step || 0 })) };
    return { source: 'prepared', planId: b.id, plan, system: SYSTEM, table: t, target: b.answer, lure: b.lure || null, twist: !!b.lure, twistWhy: b.twistWhy || '',
      pathway: b.pathway.map(p => ({ diff: p.diff, ruleOut: p.clue, probe: p.probe })), level: b.level || 1,
      comorbid: b.second ? { name: b.second, core: '' } : null, mimic: b.mimic ? { name: b.mimic.name, core: '' } : null, log: [] };
  }
  // with no prepared plan that fits this NPC, PREPARED falls back to a FRESH case (one opening call)
  function newCase(a, adult) {
    if (!liveOK()) return null;
    if (adult) return rollCase(true);
    const src = source(), who = personOf(a);
    if (src === 1 || (src === 2 && rnd(2))) return rollCase(false, who);
    return planCase(a) || rollCase(false, who);
  }
  const markPlan = c => { if (c.planId) { const seen = G.state.dxPlanSeen = G.state.dxPlanSeen || {}; seen[c.planId] = (seen[c.planId] || 0) + 1; } };
  // ---------------- the case log: OPTION > DOWNLOAD CASE LOG ----------------
  // kept in this browser's localStorage (not in the save), last 60 cases
  const LOG_KEY = 'claudered.caseLog';
  const store = { get() { try { return JSON.parse(window.localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; } },
    set(v) { try { window.localStorage.setItem(LOG_KEY, JSON.stringify(v)); } catch (e) {} } };
  function saveLog(c, where) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const all = store.get();
    all.push({ at: new Date().toISOString(), where, source: c.source + (c.planId ? ' ' + c.planId : ''), level: c.level, lines: c.log, notes: caseNotes(c).split('\f') });
    store.set(all.slice(-60));
  }
  function* downloadLog() {
    const all = typeof window !== 'undefined' && window.localStorage ? store.get() : [];
    if (!all.length) { yield* G.say('No cases in the log yet.\fPlay a STUDY CASE first.'); return; }
    const text = all.map((e, i) => ['==== CASE ' + (i + 1) + ' | ' + e.at + ' | ' + e.where + ' | ' + e.source + ' | LEVEL ' + e.level + ' ===='].concat(e.lines, ['', '-- CASE NOTES --'], e.notes, ['']).join('\n')).join('\n');
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'claude-red-case-log.txt'; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      yield* G.say('Downloaded the log of ' + all.length + ' case' + (all.length === 1 ? '' : 's') + '.');
    } catch (e) { yield* G.say('The download did not work in this browser.'); }
  }

  const keyOf = a => G.ow.map.name + ':' + a.obj.id;
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  let current = null;
  G.dxStudy = {
    before: function* (a) {
      const mode = G.state.options.study || 0;
      const why = m => { if (typeof console !== 'undefined') console.info('STUDY CASES (' + (a.obj && a.obj.id) + '): ' + m); return null; };
      if (!mode) return why('off. Turn it on with START > OPTION in the game.');
      if (!G.DX_TABLES || !a.obj || !a.obj.trainer) return why('not available here.');
      const key = keyOf(a), cases = G.state.dxCases = G.state.dxCases || {};
      const saved = cases[key];
      if (saved) { // a rematch after a loss: same PATIENCE and score, no second interview
        current = { key, rematch: true, name: saved.name, patience: saved.p, score: saved.s };
        return { battle: battleFor(saved.p), battleLine: saved.name + ': Back for a rematch?' };
      }
      if (mode === 1 && hash(key) % 3) return why('SOME skips this trainer (set ALL for every trainer).'); // the same third every time
      const c = newCase(a);
      if (!c) return why('Claude is not available here.');
      c.trainer = true;
      c.key = key;
      why('starting a ' + c.source + ' case.');
      if (!(yield* interview(c, a))) { yield* G.say('(The study case could not start: Claude did not answer.)'); return null; } // a normal battle
      yield* diagnose(c);
      cases[key] = { name: c.name, p: c.patience, s: c.score }; // kept, so a reload or a loss can't reroll the case
      markPlan(c);
      (G.state.dxLog = G.state.dxLog || []).push({ at: Date.now(), table: c.table.id, dx: c.target, said: c.said, score: c.score, patience: c.patience });
      current = c;
      return { battle: battleFor(c.patience), battleLine: battleLine(c.name, c.patience) };
    },
    after: function* (a, result) {
      const c = current; current = null;
      if (!c) return;
      if (!c.rematch) { yield* G.say(caseNotes(c)); note(c, 'BATTLE: ' + result); saveLog(c, G.ow.map.name + ' trainer'); yield* checkFail(c); }
      if (result !== 'win') { yield* G.say('Win the rematch to get ' + c.name + '\'s thanks.'); return; }
      delete G.state.dxCases[c.key].p; G.state.dxCases[c.key].done = true;
      if (!rewardFor(c.score).money) { yield* G.say(c.name + ': Good battle. Keep studying!'); return; }
      yield* G.say(c.name + ': ' + (c.score >= 0.65 ? 'You really understood me. Take this!' : 'Thanks for listening. Here!'));
      yield* giveReward(c, c.name);
    },
    // Townsfolk (G.talkTo, src/game/scripts.js): plain NPCs with no script, battle or item. Each one offers one case per
    // save. Returns true when the talk was handled here.
    talk: function* (a) {
      const mode = G.state.options.study || 0;
      if (!mode || !G.DX_TABLES || !a.obj || !a.obj.id) return false;
      if ((G.CAST[a.sprite] || {}).object) return false; // signs, fossils, papers: not people
      const key = keyOf(a), cases = G.state.dxCases = G.state.dxCases || {};
      if (cases[key]) return false; // their case is done: normal talk from now on
      if (mode === 1 && hash(key) % 3) return false;
      // ADULT CASES: about half of the adult-looking townsfolk (always the same ones) share a clinic case instead
      const adult = !!(G.state.options.adultCases && G.DX_ADULT_TABLES && CLINICIANS.has(a.sprite) && hash(key + ':adult') % 2 === 0);
      const offer = adult ? 'I work at a clinic. Want to go over a case from my files?\f(ADULT CASE: clinical language, no theme.)'
        : 'This person seems to have something on their mind.\fListen to them? (STUDY CASE)';
      const c = newCase(a, adult);
      if (!c) return false;
      if (!(yield* G.ask(offer))) return false;
      c.key = key;
      if (!(yield* interview(c, a))) { yield* G.say('(The study case could not start: Claude did not answer.)'); return true; }
      yield* diagnose(c);
      cases[key] = { name: c.name, s: c.score, done: true };
      markPlan(c);
      (G.state.dxLog = G.state.dxLog || []).push({ at: Date.now(), table: c.table.id, dx: c.target, said: c.said, score: c.score, patience: c.patience });
      yield* G.say(caseNotes(c));
      saveLog(c, G.ow.map.name + ' townsperson');
      yield* npcThanks(c);
      yield* checkFail(c);
      return true;
    },
    afterBattle: releaseDoomed,
    reward: (score, giver) => giveReward({ score }, giver || 'They'), // for tests: the reward for a case score
    _newCase: a => newCase(a), // for tests: the case an NPC would get
    _thanks: function* (c) { yield* npcThanks(c); yield* checkFail(c); }, // for tests: a townsperson's thanks, then the curse check
    // OPTION menu: OFF -> SOME -> ALL -> OFF
    toggle: function* () {
      const O = G.state.options, next = ((O.study || 0) + 1) % 3;
      if (next === 1 && !(yield* G.claude.ensureAccess('STUDY CASES'))) return;
      O.study = next;
    },
    label: () => 'STUDY CASES: ' + ['OFF', 'SOME', 'ALL'][G.state.options.study || 0],
    // OPTION menu: CASE SOURCE: PREPARED -> FRESH -> MIX -> PREPARED
    sourceToggle: function* () { const O = G.state.options; O.caseSource = ((O.caseSource || 0) + 1) % 3; },
    sourceLabel: () => 'CASE SOURCE: ' + SOURCES[source()],
    downloadLog,
    // OPTION menu: ADULT CASES, off by default; turning it on needs a YES
    adultToggle: function* () {
      const O = G.state.options;
      if (O.adultCases) { O.adultCases = false; return; }
      if (!(yield* G.ask('ADULT CASES add study cases on Sexual Dysfunctions and Paraphilic Disorders.\fSome adult townsfolk share them from their clinic files: adult patients, clinical language, no theme.\fTurn them on?'))) return;
      O.adultCases = true;
    },
    adultLabel: () => 'ADULT CASES: ' + (G.state.options.adultCases ? 'ON' : 'OFF'),
  };
})(window.G);
