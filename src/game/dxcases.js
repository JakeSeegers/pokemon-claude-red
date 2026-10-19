// STUDY CASES: trainers who stop you on the road can first talk with you as a fictional practice case for
// differential diagnosis (data: src/data/dxcases.js, built from the diagnosis-practice-case study tables).
//
//   1. The game rolls a target diagnosis and a rule-out pathway (3 to 5 differentials) from the tables.
//   2. Claude plays the trainer as the patient. Each turn you pick one of four questions. Every option carries a kind
//      (good, sensitive, rapport, leading, judgmental, off-topic, hostile), and the kind, not Claude, moves PATIENCE.
//   3. You name the diagnosis, then say what each clue you found rules out.
//   4. PATIENCE (0-3) sets the battle on a spectrum: 3 is the normal battle, each lost point adds levels (capped near
//      your strongest POKéMON) and healing items, and a failed case (wrong diagnosis or under 50%) adds more. Your case
//      score sets the reward: nothing when failed, then money by the square of the score, an item by tier, and a
//      JACKPOT at 100%. The case notes (the answer key) come after the battle. Townsfolk whose case fails, or whose
//      PATIENCE runs out, challenge you to a battle.
//
// OPTION > STUDY CASES: OFF, SOME (about 1 person in 3: fixed within a game, different in each new game) or ALL. Needs Claude (src/game/claudenpc.js).
(function (G) {
  'use strict';
  const MAX_TURNS = 8, OPEN_TIMEOUT = 90000, TURN_TIMEOUT = 60000;
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
  // PATIENCE starts at PMAX (3). A rapport question gives back 1, but only up to RAPPORT_CAP (2): lost PATIENCE is hard
  // to win back
  const PMAX = 3, RAPPORT_CAP = 2;
  // a plain-text version of what Claude wrote: our font has no fancy quotes or markdown
  const plain = t => String(t || '').replace(/[*_`#]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

  // ---------------- the case roll (done by the game, as the skill does with python) ----------------
  // CASE LEVEL grows with badges: 1 (0-2) overlaps only, 2 (3-5) + a mimic, 3 (6-8) + mimic and maybe a comorbidity
  const caseLevel = () => { const b = G.state.badges.length; return b >= 6 ? 3 : b >= 3 ? 2 : 1; };
  const targetOf = t => t.members ? memberName(t, t.members[rnd(t.members.length)]) : t.name;
  // second diagnoses and red herrings come from another chapter, and never from a childhood-only diagnosis (Reactive
  // Attachment needs signs before age 5, so it can't sit on top of an adult's case)
  const CHILD_ONLY = new Set(['3.1.1', '3.1.2', '3.1.5', '3.1.6', '3.4.4', '3.5.2', 'x.1.1', 'x.1.2', 'x.1.3', 'x.7.1', 'x.7.2', 'x.19.1', 'x.19.2']);
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
  const KID_OK = new Set(['3.1.1', '3.1.2', '3.1.3', '3.1.4', '3.1.5', '3.1.6', 'x.1.1', 'x.1.2', '3.4.1', '3.4.4', '3.5.1', '3.5.2', '3.5.3', '3.5.4', '3.5.7',
    '3.6.1', '3.6.4', '3.7.1', '3.7.2', 'x.7.1', 'x.7.2', '3.10.1', 'x.10.1', 'x.19.1', 'x.19.2', '3.11.1', 'x.11.4', 'x.11.5', '3.14.1', '3.14.2', '3.14.3']);
  function tableFits(t, who) {
    if (!who) return true;
    if (t.aboutChild) return who.age === 'adult'; // a parent talks about their child under 5 (Global Developmental Delay)
    if (who.age === 'child' || who.age === 'kid') return KID_OK.has(t.id) && (t.id !== 'x.7.1' || who.age === 'child');
    if (who.age === 'teen') return !ADULT_ONLY.has(t.id) && t.id !== 'x.7.1';
    return !CHILD_ONLY.has(t.id);
  }
  // ---------------- the dice tree: chapter -> subgroup -> table -> member ----------------
  // Every case rolls its way down the DSM-5-TR (src/game/dice.js, seeded by the save): a die over the chapters that fit
  // the person, then over the chapter's subgroups (as the DSM groups them: Cluster A/B/C, Parasomnias, Motor
  // Disorders...), then over the tables in it, then over the table's members. So a chapter with many tables comes up
  // no more often than a small one, and the case notes list every roll. A chapter not listed here has one subgroup.
  const SUBGROUPS = {
    'Neurodevelopmental Disorders': { 'Intellectual Developmental Disorders': ['3.1.1', 'x.1.3'], 'Communication Disorders': ['3.1.2'],
      'Autism Spectrum Disorder': ['3.1.3'], 'ADHD': ['3.1.4'], 'Specific Learning Disorder': ['3.1.5'], 'Motor Disorders': ['3.1.6', 'x.1.1', 'x.1.2'] },
    'Schizophrenia Spectrum and Other Psychotic Disorders': { 'Psychotic disorders': ['3.2.1', '3.2.2', '3.2.3', '3.2.4', 'x.2.1'], 'Catatonia': ['3.2.5'] },
    'Sleep-Wake Disorders': { 'Insomnia, hypersomnolence, narcolepsy, circadian, restless legs': ['3.11.1', '3.11.2', 'x.11.1', 'x.11.3', 'x.11.7'],
      'Breathing-Related Sleep Disorders': ['x.11.2'], 'Parasomnias': ['x.11.4', 'x.11.5', 'x.11.6'] },
    'Substance-Related and Addictive Disorders': { 'Substance-related disorders': ['3.15.1', 'x.15.1', 'x.15.2'], 'Non-substance-related (gambling)': ['3.15.2'] },
    'Neurocognitive Disorders': { 'Delirium': ['3.16.1'], 'Major and Mild Neurocognitive Disorders': ['3.16.2', 'x.16.1'] },
    'Personality Disorders': { 'Cluster A': ['3.17.1', '3.17.2', '3.17.3'], 'Cluster B': ['3.17.4', '3.17.5', '3.17.6', '3.17.7'],
      'Cluster C': ['3.17.8', '3.17.9', '3.17.10'], 'Other personality disorders': ['3.17.11'] },
  };
  const short = g => g.replace(/ Disorders and Other Adverse Effects of Medication/, '').replace(/ and Other Psychotic Disorders| and Related Disorders|-Related Disorders| Disorders$/, '').replace(/ That May Be a Focus of Clinical Attention/, '');
  function rollTree(list, log, why) {
    const tag = why ? why + ' ' : '';
    const chapter = G.dice.pick([...new Set(list.map(t => t.group))], tag + 'chapter', log, short);
    const inCh = list.filter(t => t.group === chapter), subs = SUBGROUPS[chapter];
    let pool = inCh;
    if (subs) {
      const names = Object.keys(subs).filter(k => inCh.some(t => subs[k].includes(t.id)));
      const extra = inCh.filter(t => !Object.values(subs).some(ids => ids.includes(t.id))); // a table not in any subgroup
      const sub = G.dice.pick(names.concat(extra.length ? ['Other'] : []), tag + 'subgroup', log);
      pool = sub === 'Other' ? extra : inCh.filter(t => subs[sub].includes(t.id));
    }
    return G.dice.pick(pool, tag + 'table', log, t => t.name);
  }
  // ---------------- symptoms by dice (src/data/dxcriteria.js) ----------------
  // For a diagnosis with countable criteria, roll each symptom group: how many (the lower of two dice, from the group's
  // threshold up to all of them, so most people sit near the threshold) and which (a die per pick; a required symptom
  // first). The case always meets criteria; the brief tells Claude exactly which symptoms are present and absent, and
  // the case notes show each count against its threshold. ADHD also rolls its presentation.
  function rollSymptoms(c, who, rolls) {
    const name = c.twist ? null : c.target, crit = name && G.DX_CRITERIA && G.DX_CRITERIA[name];
    if (!crit) return;
    const young = who && (who.age === 'child' || who.age === 'kid'), adultish = who && (who.age === 'adult' || who.age === 'elder');
    const groups = (young && crit.child ? crit.child.groups : crit.groups).map(g => ({ name: g.name, items: g.items, must: g.must,
      need: young && g.minChild != null ? g.minChild : adultish && g.minAdult != null ? g.minAdult : g.min }));
    // ADHD: d3 for the presentation; the groups it names reach their threshold, the others stay below it
    let meets = groups.map(() => true);
    const specs = []; // { name, options, answer }: what the SPECIFIER question can ask
    if (crit.presentations) {
      const opts = ['combined', 'predominantly inattentive', 'predominantly hyperactive-impulsive'];
      const p = G.dice.pick(opts, 'presentation', rolls);
      meets = [p !== 'predominantly hyperactive-impulsive', p !== 'predominantly inattentive'];
      specs.push({ name: 'Presentation', options: opts, answer: p });
    }
    groups.forEach((g, gi) => {
      const len = g.items.length, lo = meets[gi] ? g.need : 0, hi = meets[gi] ? len : g.need - 1;
      const span = hi - lo + 1;
      const a1 = G.dice.roll(span, '', null).n, a2 = G.dice.roll(span, '', null).n, n = lo + Math.min(a1, a2) - 1;
      const pool = g.items.map((x, i) => i), has = [];
      if (g.must && n > 0) { const m = g.must[G.dice.roll(g.must.length, '', null).n - 1]; has.push(m); pool.splice(pool.indexOf(m), 1); }
      while (has.length < n) has.push(pool.splice(G.dice.roll(pool.length, '', null).n - 1, 1)[0]);
      g.has = has.sort((x, y) => x - y);
      rolls.push({ text: 'd' + span + ' x2 (lower) = ' + Math.min(a1, a2) + '  ' + g.name + ': ' + n + ' of ' + len + (meets[gi] ? ' (needs ' + g.need + ')' : ' (below ' + g.need + ')') });
    });
    // all groups together need a total (PMDD: 5): add symptoms from any group until it is reached
    let sum = groups.reduce((t, g) => t + g.has.length, 0);
    while (crit.total && sum < crit.total) {
      const open = groups.flatMap((g, gi) => g.items.map((x, i) => [gi, i]).filter(([, i]) => !g.has.includes(i)));
      const [gi, i] = open[G.dice.roll(open.length, '', null).n - 1];
      groups[gi].has.push(i); groups[gi].has.sort((x, y) => x - y); sum++;
    }
    if (crit.severity) { const n0 = groups[0].has.length; specs.push({ name: 'Severity', options: crit.severity.map(x => x[1]), answer: crit.severity.filter(([k]) => n0 >= k).pop()[1] }); }
    (crit.specifiers || []).forEach(sp => specs.push({ name: sp.name, options: sp.options, answer: G.dice.pick(sp.options, sp.name.toLowerCase(), rolls) }));
    const spec = specs.map(x => x.name + ': ' + x.answer).join('; ');
    c.symptoms = { duration: crit.duration, groups, total: crit.total || 0, spec, specs };
  }
  const symptomBrief = c => !c.symptoms ? '' : (!c.symptoms.groups.length ? 'ROLLED WITH DICE.' : 'SYMPTOMS (rolled with dice; these are fixed). The patient has exactly these symptoms of ' + c.target + ' and none of the other listed ones. Put them in core_facts and let the interview bring them out one by one; when asked about an absent symptom, the honest answer is no. ') +
    c.symptoms.groups.map(g => g.name + ' (' + g.has.length + ' of ' + g.items.length + ', the criteria need ' + g.need + '): HAS ' + (g.has.map(i => g.items[i]).join('; ') || 'none') +
      '. DOES NOT HAVE ' + (g.items.filter((x, i) => !g.has.includes(i)).join('; ') || 'none') + '.').join(' ') +
    ' Duration: ' + c.symptoms.duration + '.' + (c.symptoms.spec ? ' Specifiers (fixed; the interview must give clear evidence for each): ' + c.symptoms.spec + '.' : '');
  // a table's member (a table can hold several related diagnoses), by die
  const rollTarget = (t, log, why) => t.members ? memberName(t, G.dice.pick(t.members, (why ? why + ' ' : '') + 'diagnosis', log, m => memberName(t, m))) : t.name;
  const otherTable = (t, log, why) => rollTree(G.DX_TABLES.filter(x => x.group !== t.group && !CHILD_ONLY.has(x.id)), log, why);
  // some differentials only apply to one member of a table: "Tourette's Disorder (only vs. Fluency Disorder)" belongs
  // in a Childhood-Onset Fluency Disorder case only
  const squash = x => String(x).toLowerCase().replace(/[^a-z]/g, '');
  const applies = (target, diff) => { const m = /\(only vs\. ([^)]+)\)/.exec(diff); return !m || squash(target).includes(squash(m[1])); };
  const diffsFor = (t, target) => t.diffs.filter(d => applies(target, d[0]));
  // the tables that fit this person (adult cases: the adult tables)
  function tablesFor(adult, who) {
    const all = adult ? G.DX_ADULT_TABLES : G.DX_TABLES, fit = all.filter(t => tableFits(t, who));
    return fit.length ? fit : all;
  }
  // a FRESH case from a table already rolled (rollTree): its member, rule-outs, twist, red herring and second diagnosis
  function rollCase(adult, who, t, rolls) {
    rolls = rolls || [];
    t = t || rollTree(tablesFor(adult, who), rolls);
    const level = caseLevel(), target = rollTarget(t, rolls);
    const D = diffsFor(t, target), n = D.length;
    const kr = level === 1 ? null : G.dice.roll(2, 'rule-outs', rolls), k = Math.min(n, level === 1 ? 3 : (level === 2 ? 2 : 3) + kr.n);
    if (kr) kr.result = k + ' possibilities';
    const pathway = sample(D.map((d, i) => i), k).map(i => ({ diff: D[i][0], ruleOut: D[i][1] }));
    const c = { source: 'live', table: t, target, pathway, level, adult: !!adult, system: adult ? SYSTEM_ADULT : SYSTEM, log: [], rolls };
    // a TWIST (about 1 case in 4): the symptoms look like the table's disorder, but the real answer is one of its
    // rule-outs that needs no (or another) mental diagnosis: a medical cause, a substance, a normal reaction
    const twistIdx = D.map((d, i) => i).filter(i => TWIST.test(D[i][0]));
    const tw = !adult && twistIdx.length ? G.dice.roll(4, 'twist (1 = yes)', rolls) : null;
    if (tw && tw.n === 1) {
      const i = G.dice.pick(twistIdx, 'twist answer', rolls, j => D[j][0]);
      tw.result = 'yes';
      c.twist = true; c.lure = target; c.target = D[i][0]; c.twistWhy = D[i][1];
      c.pathway = [{ diff: target, ruleOut: 'the real cause (' + D[i][1] + ') explains the symptoms better' }]
        .concat(pathway.filter(p => p.diff !== c.target)).slice(0, Math.max(3, k));
    }
    else if (tw) tw.result = 'no';
    rollSymptoms(c, who, rolls);
    addExtras(c, t, level, rolls);
    return c;
  }
  // LEVEL 2+: a red herring from another chapter; LEVEL 3: d2 for a second (comorbid) diagnosis, also from another chapter
  function addExtras(c, t, level, rolls) {
    if (level >= 2 && !c.mimic) { const m = otherTable(t, rolls, 'red herring'); c.mimic = { name: rollTarget(m, rolls, 'red herring'), core: m.core }; }
    if (level >= 3 && !c.twist && c.comorbid === undefined) {
      const d = G.dice.roll(2, 'second diagnosis (2 = yes)', rolls);
      d.result = d.n === 2 ? 'yes' : 'no';
      if (d.n === 2) { const m = otherTable(t, rolls, 'second'); c.comorbid = { name: rollTarget(m, rolls, 'second'), core: m.core }; }
    }
  }
  // rule-outs that can be the real answer of a TWIST case: medical, substance, normal or not-a-disorder explanations
  const TWIST = /medical|substance|medication|normal|bereavement|nonpathological|isolated panic|extreme danger|realistic|proportionate|appropriate for age|short sleeper|long sleeper|insufficient sleep|sleep deprivation/i;

  // ---------------- the prompt ----------------
  const SYSTEM = [
    'You run a study game for differential diagnosis inside a pixel-art POKéMON RED remake (Kanto). The player is an adult psychology student who travels Kanto as a POKéMON TRAINER. People who hear that they study psychology sometimes open up to them; the player interviews one fictional patient, then diagnoses. Patients talk to the player as a grown-up student, not a child. A child patient talks with a parent or caregiver nearby, who can join in. The patient is someone the player meets in Kanto: a trainer before a battle, or a townsperson (the first message says who).',
    'The first message gives the clinical content: the target diagnosis, its core features, and the rule-out pathway (each step is a differential and the finding that rules it out). Keep every criterion, duration, count and clue correct.',
    '',
    'Theme rules. Change names, places, objects and jobs to fit the POKéMON world (the clinic is the POKéMON CENTER, the school is the Trainer School, a phone can be a POKé BALL when the clinical meaning stays the same). The patient is a person, never a POKéMON. Keep the language respectful: never joke about the disorder or the patient. Do not copy text or dialogue from the franchise; write everything in your own words.',
    '',
    'Make the case feel real, not a list of denials. For each pathway step there is an overlap: a true symptom the patient has that the target shares with that differential, so the differential looks possible at first. Write each clue as a concrete, positive finding where you can (a timeline, a context, what a family member saw, a test result), not a bare "no". About half of the good questions should get a "yes" with detail.',
    '',
    'Interview rules. Answer only what the question asks. Reveal a pathway clue only when a question points toward it, and never all clues at once. A low-yield question gets a short, true answer with little new detail. A collateral source (a family member, a friend, a gym mate) can add facts the patient hides or forgets. Never name the target diagnosis or any differential in the patient\'s words or in the feedback.',
    'The patient is a real person, not a textbook. They do not know the diagnoses, never argue for or against one, and never explain why something does or does not apply ("but it isn\'t perfectionism"). They tell their story in everyday words: what happens, when, how it feels, what others say. A clue comes out as a plain fact in their answer, and the player has to work out what it means.',
    '',
    'Options. Each turn, write exactly four questions the player can ask next, and make the choice hard. A student who knows how to interview, but has not yet worked out this case, must not be able to spot the good option by its wording. All four sound like something a careful, kind interviewer might ask: the same polite tone, about the same length, and a mix of open and closed forms (the good one is not always the only open question). The difference is in WHAT each question would find out, not in how it sounds. The mix: exactly one good option, never two (it reaches a pathway step not found yet, a core feature, the onset, duration, impairment or a specifier). The other options are traps. Lowyield: sounds just as clinical, but checks something already known, an area already ruled out, a detail that cannot change the diagnosis, or a disorder that is not on this case. Leading: a kind tone, but it suggests the answer or a cause ("Has the stress at work been behind this?"). Judgmental: a warm tone, but it gives advice or reassurance too early, or plays the problem down ("Have you tried cutting back on coffee?"). Sensitive: appropriate, but on a sensitive topic before there is trust (give it a short topic word). A trap must never ask the same thing as a pathway step\'s probe question: those questions are good. One trap is always a TWIN of the good option: the same topic and the same kind of wording, but it asks for something the player already knows or that cannot decide anything (the wrong time frame, the wrong person, a detail already told). So the player can\'t pick by topic alone. Vary the topics of traps and twins across turns, and don\'t build them around sleep unless the case is about sleep: many disorders share a sleep symptom, and a sleep question on every menu teaches nothing. Vary the form: the good option is sometimes a short, specific closed question ("Any change in your weight?"), and traps are sometimes open questions. Never start a trap with "Have you tried" or "Have you thought about": players learn to spot that. Never write a rude, mocking or silly trap, and keep giveaway words out of traps: just, right?, huh, silly, get over it, why can\'t you, you know. The game says each turn whether to include one offtopic option, a light, funny question about the POKéMON world (a favorite POKéMON, a gym, a snack); without that, there is no offtopic option. When PATIENCE has dropped, one trap can be replaced by a rapport option (it builds trust and may also ask something). The game shuffles the options, so their order does not matter. Label every option with its true kind: good, lowyield, leading, judgmental, sensitive, rapport, offtopic, or hostile (threatening or shaming; do not use it). A question that could bring out a core feature, a subtype or specifier, a duration, impairment, or any clue not found yet is good, never a trap, and its answer must bring that out. The game uses the kinds to score the player, so label them honestly.',
    '',
    'What the player knows. The player knows only the scene line, the opening, and what has been said aloud since. Every option must make sense to someone who heard only that: never mention or assume a hidden fact (a name, a relation, a place, an event, a symptom, a job) that nobody has said yet. A twin or low-yield trap about "something already known" must point to something actually said in this conversation. For each option, set uses to the exact words, copied from the scene line, the opening or an answer, that the question builds on; use an empty string only for a fully open question that assumes nothing ("What brings you here today?", "How long has this been going on?"). The game removes any option whose uses words the player has not seen. The first four options may build only on the scene line and the opening: never on a topic that exists only in the hidden facts (a habit, a job, a person, a substance, a symptom nobody has mentioned).',
    '',
    'Timing and trust. Clues about substances, self-harm, trauma, sex, money, the law or family conflict come out best through a sensitive option (kind sensitive, with its step set). The game tracks trust and says each turn whether it is built. Before trust, a sensitive question gets a short, guarded answer that does not reveal the clue; after trust, it is answered openly. Offer a rapport option now and then so trust can be built. A GUARDED step (the first message names it, if any) is held back: the first question that reaches it gets only a vague answer (its overlap, never the clue), and the next options must include a good follow-up for that step. An UNRELIABLE step is played down by the patient: a question to the patient gets a minimizing answer that hides the clue, and only the collateral source tells the truth, so offer a good option addressed to them ("Ask <name>: ...") for that step.',
    '',
    'Writing. Plain text only: no markdown, no emoji. Each option is a question of at most 48 characters. The patient\'s answer is 1 to 3 short sentences, at most 220 characters, like a line of POKéMON dialogue. If someone else speaks (the collateral source), put their part in its own paragraph after a blank line, starting with their name in CAPS and a colon, for example: MOM: She talks all day at home. Feedback is one short coaching note about interviewing skill only, at most 60 characters. For a trap it says what the question missed or did wrong, never praise (for a low-yield question: "We already knew that; ask what you don\'t know yet."). Topics to coach on: open or closed, timeline, rapport, collateral, pacing (for example: Asking about a typical day opens things up.). It must never say which disorder, step or category the question checks or rules out, never reveal what the answer means, and never start with a verdict word like Good or Bad, because the game already shows one. Write POKéMON words in CAPS (POKéMON, POKé BALL, POKéMON CENTER).',
    '',
    'Safety. All cases are fictional and for study. For eating disorders, give weight only as a clinical finding (for example BMI) and never describe restriction, purging or weight-loss methods. For Factitious Disorder Imposed on Another, keep any harm general and non-graphic. Keep elimination disorders (enuresis, encopresis) clinical and non-graphic, and never make them a joke.',
  ].join('\n');
  // OPTION > ADULT CASES (Sexual Dysfunctions, Paraphilic Disorders): the skill allows these only for adult patients, in
  // a plain clinical setting with no theme, in clinical, non-explicit language. Same game rules otherwise.
  const SYSTEM_ADULT = SYSTEM.split('\n').map(line => {
    if (line.startsWith('You run a study game')) return 'You run a study game for differential diagnosis. The player is an adult psychology student. They interview one fictional adult patient in a plain outpatient clinic, then diagnose. A clinician in the game shares this case from their files.';
    if (line.startsWith('Theme rules.')) return 'Setting rules. No theme at all: a plain, present-day outpatient clinic, ordinary names and jobs, and no POKéMON words, places or creatures anywhere in the case, the options or the feedback. The patient is an adult. Keep the language respectful and professional: never joke about the disorder or the patient.';
    if (line.startsWith('Options.')) return line.replace('a light, funny question about the POKéMON world (a favorite POKéMON, a gym, a snack)', 'light small talk (the weather, traffic or a hobby)');
    if (line.startsWith('Interview rules.')) return line.replace('(a family member, a friend, a gym mate)', '(a partner, a family member, a friend)');
    if (line.startsWith('Writing.')) return line.replace(' Write POKéMON words in CAPS (POKéMON, POKé BALL, POKéMON CENTER).', '');
    if (line.startsWith('Safety.')) return line + ' This case is about sexual function or sexual interest: use clinical, non-explicit language only, never describe sexual acts in detail, and keep the patient and everyone involved an adult. For Paraphilic Disorders, focus on criteria (duration, distress, impairment, consent), and describe any nonconsenting act only in general, non-graphic terms.';
    return line;
  }).join('\n');

  // step: the pathway step a good option checks (its answer must reveal that step's overlap or clue), 0 = none
  // uses: the words (copied from what the player has seen) the question builds on, or '' for a fully open question;
  // the game drops an option whose words the player never saw (see grounded())
  const OPTION = { type: 'object', additionalProperties: false, required: ['text', 'kind', 'topic', 'step', 'uses'], properties: {
    text: { type: 'string' }, kind: { type: 'string', enum: Object.keys(KIND_PATIENCE) }, topic: { type: 'string' }, step: { type: 'integer' }, uses: { type: 'string' } } };
  const OPEN_SCHEMA = { type: 'object', additionalProperties: false,
    required: ['patient_name', 'age', 'collateral', 'core_facts', 'clue_facts', 'mimic_explanation', 'neutral_facts', 'teaching_note', 'opening', 'scene', 'options'],
    properties: {
      patient_name: { type: 'string' }, age: { type: 'integer' }, collateral: { type: 'string' },
      core_facts: { type: 'array', items: { type: 'string' } },
      clue_facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['step', 'overlap', 'fact', 'short', 'wrong', 'status'], properties: {
        step: { type: 'integer' }, overlap: { type: 'string' }, fact: { type: 'string' }, short: { type: 'string' }, wrong: { type: 'string' }, status: { type: 'string', enum: ['out', 'later', 'still'] } } } },
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
      c.table.aboutChild ? 'This NPC is a parent. The patient is their child, aged 2 to 4: the parent tells the story (the child may be with them), and every question goes to the parent.' :
      !c.adult && personOf(a) ? 'The patient is ' + AGE_TEXT[personOf(a).age] + (personOf(a).sex ? ', ' + (personOf(a).sex === 'f' ? 'female' : 'male') : '') + '. Their age, sex and life must fit this.' : '',
      !c.adult && a.obj.textLabel && G.textFor(a.obj.textLabel) !== '...' ? 'What this person says in the original game (their personality and life): ' + G.fmt(G.textFor(a.obj.textLabel)).replace(/\f/g, ' ') : '',
      c.comorbid ? 'Comorbidity: the patient ALSO meets criteria for ' + c.comorbid.name + ' (' + c.comorbid.core + '). Put its core features in core_facts too, so a careful interview can find both. Never name it.' : '',
      c.mimic ? 'Mimic (a red herring): give the patient one or two symptoms that look like ' + c.mimic.name + ' (' + c.mimic.core + '), but that something else fully explains (a medicine, a recent stressor, a normal reaction, a medical condition). The explanation must come out only if the player asks about it. Put the explanation in mimic_explanation and never name the mimic.' : 'mimic_explanation: an empty string (this case has no mimic).',
      c.twist ? 'TWIST: the patient does NOT have ' + c.lure + '. The real explanation is step 1\'s opposite: "' + c.target + '" (' + c.twistWhy + '). Give them symptoms that look like ' + c.lure + ' at first, but make the evidence for the real explanation clear and positive (a test, a timeline, a cause, a normal context) once the player asks. Step 1 is ruled out by that evidence. Do not hint at the twist in the opening.' : '',
      symptomBrief(c),
      c.guarded ? 'GUARDED step: ' + c.guarded + ' (the patient holds it back the first time; see Timing and trust).' : '',
      c.unreliable ? 'UNRELIABLE step: ' + c.unreliable + ' (the patient plays it down; only the collateral source tells the truth).' : '',
      c.clinical ? 'PREPARED CLINICAL DETAIL. These facts are fixed: keep every duration, count, test result and criterion exactly as written. Core facts: ' + c.clinical.core.join(' ') +
        ' Overlap to build in for each step: ' + c.clinical.steps.map((x, i) => (i + 1) + '. ' + x.overlap).join(' ') +
        (c.clinical.mimicWhy ? ' The red herring is explained by: ' + c.clinical.mimicWhy : '') : '',
      c.clinical ? 'INVENT THE PERSON FRESH. Write a new name, life, family, job, setting, scene and opening that fit this NPC (below). The facts above may name people, places or objects as examples: change who and where freely (a husband can be a wife, crates can be boxes, a gym can be a shop), but never the clinical meaning, and do not reuse names from them.' : '',
      'Every good option must check one specific thing: a pathway step (set step to its number, and the answer must reveal that step\'s overlap or clue) or a core feature (step 0). Never offer a good option that leads nowhere.',
      'Plan the hidden facts first: the core features with durations and counts (core_facts); for each pathway step (clue_facts, step = its number above) an overlap (a true symptom shared with that differential) and the clue that rules it out; one or two neutral facts; and a collateral source (who they are).',
      'For each clue_facts entry also write, for the differential sheet at the end: short (the deciding evidence in at most 40 characters: a few words, not a sentence), wrong (a tempting but wrong reason to rule that possibility out, at most 40 characters, a few words, based on something true in the case), and status: out (the evidence rules it out), later (it can only be judged after the real cause is treated, for example dementia during a delirium), or still (it stays possible, for example a disorder that can be present at the same time).',
      'teaching_note: one short teaching point for the answer key, for example: comorbidity is the default; Adjustment Disorder and Other Specified categories are used only when no specific disorder fits; a trait is not a diagnosis; give the subtype or specifier; history, course and tests can change the decision.',
      'opening: only the patient\'s own words, 2 to 4 sentences, no quotation marks: who they are in a few words (their role or job, who they live with), why they want to talk now, and the chief complaint. No further history and no narration.',
      'scene: one short narration line in the style of the game that sets up who this is ("You see a young man in a work uniform sitting on the bench, pale and sweaty."). The game always shows it before the opening.',
      'Then four options for the first question.' + offtopicRule(c),
    ].join('\n');
  }

  // one request; returns the parsed JSON or null
  function* call(c, schema, timeout, effort) {
    const text = yield* G.claude.request({ system: c.system || SYSTEM, messages: c.messages, format: schema, effort }, timeout);
    if (!text) return null;
    try { const j = JSON.parse(text); c.messages.push({ role: 'assistant', content: text }); return j; } catch (e) { console.warn('study case: bad JSON', e); return null; }
  }
  // the funny off-topic question shows up only some turns, less often at higher CASE LEVELs (1 in 2, 1 in 3, 1 in 4)
  const funnyTurn = c => rnd([2, 3, 4][Math.min(3, c.level || 1) - 1]) === 0;
  const offtopicRule = c => funnyTurn(c) ? ' This turn: include exactly one offtopic option.' : ' This turn: no offtopic option; all four are interview questions.';
  const goodOptions = opts => (Array.isArray(opts) ? opts : []).filter(o => o && o.text && KIND_PATIENCE[o.kind] !== undefined).slice(0, 4);

  // ---------------- the interview ----------------
  // every case keeps a log for OPTION > DOWNLOAD CASE LOG: what was said, asked, chosen, and the case notes
  const note = (c, line) => c.log.push(line);
  function* sayLog(c, text) { note(c, text.replace(/\f/g, ' ')); yield* G.say(text); }
  // no explainer: a trainer's case just starts with one line, so you know the battle waits (townsfolk asked you first)
  function* intro(c, a) {
    if (a.obj.trainer) yield* G.say(((G.DATA.trainerClasses[a.obj.trainer.cls] || {}).name || 'The trainer') + ' wants to talk before the battle.');
  }
  // the opening: the person's own words, with a short scene line now and then (about 1 time in 3)
  function* opening(c, open) {
    const scene = plain(open.scene || '');
    if (scene) yield* sayLog(c, scene); // always: it tells you who this person is before they speak
    // an opening can start with someone else speaking ("MOM: ..."); otherwise it is the patient
    yield* sayLog(c, speech(c, open.opening));
    c.seen = [scene, plain(open.opening)]; // everything the player has seen or heard, for grounded()
  }
  // what someone says, as text boxes: paragraphs become boxes; the first box gets the patient's name unless it starts
  // with another speaker's tag ("MOM: ..."); a later paragraph without a tag is still the same speaker
  const TAG = /^[A-Z][A-Z .']{1,14}:/;
  function speech(c, text) {
    const parts = String(text || '').split(/\n\s*\n/).map(x => plain(x).replace(/^"|"$/g, '')).filter(Boolean);
    return parts.map((x, i) => i === 0 && !TAG.test(x) ? c.name + ': ' + x : x).join('\f');
  }
  // when you are ready to diagnose, the patient says goodbye (by PATIENCE, no API call)
  const goodbye = c => c.name + ': ' + (c.patience >= 3 ? 'Thanks for listening. It helped to talk.' : c.patience >= 2 ? 'Okay... is that everything?' : 'Are we done now?');
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
    if (o.kind === 'sensitive') { const tp = String(o.topic || o.text).toLowerCase(); if (c.topics[tp] || c.trust) d = 0; c.topics[tp] = true; } // well timed: free
    if (d > 0) d = Math.max(0, Math.min(d, RAPPORT_CAP - c.patience)); // rapport only brings it back up to RAPPORT_CAP
    c.patience = Math.max(0, Math.min(PMAX, c.patience + d));
    note(c, '> ' + o.text + '   [' + o.kind + (d ? ', PATIENCE ' + (d > 0 ? '+' : '') + d : '') + ' -> ' + c.patience + '/' + PMAX + ']');
    return KIND_LABEL[o.kind] + (d ? ' (PATIENCE ' + (d > 0 ? '+' : '') + d + ')' : '') + '.';
  }
  function* endCheck(c, turn) {
    if (c.patience <= 0) { yield* sayLog(c, c.name + ' has had enough and stops talking.\fYou have to diagnose with what you know.'); return true; }
    if (turn >= MAX_TURNS) { yield* sayLog(c, c.name + ': I think I\'ve said all I can for now.'); return true; }
    return false;
  }
  // no PATIENCE meter and no "you know a lot" hint: how the patient answers is the only sign of how it is going
  const askHead = () => 'What do you ask?';

  // LIVE: Claude plays the patient
  // harder interviews from CASE LEVEL 2: the verdicts wait for the case notes, and one step is GUARDED (needs a follow-up);
  // from LEVEL 3 another step is UNRELIABLE (only the collateral source tells the truth). At every level a sensitive
  // question counts only once trust is built (after a rapport question, or two good ones); too early, it costs PATIENCE.
  function setupDepth(c) {
    // by your badges (a prepared plan's own level only sets its content), or the case's level if that is higher
    const steps = c.pathway.map((p, i) => i + 1), lv = Math.max(c.level || 1, caseLevel()), log = c.rolls = c.rolls || [];
    c.hideVerdict = true; // no verdicts at any level: the case notes grade every question afterwards
    const name = s => c.pathway[s - 1].diff;
    c.guarded = lv >= 2 ? G.dice.pick(steps, 'held back', log, name) : 0;
    const rest = steps.filter(s => s !== c.guarded);
    c.unreliable = lv >= 3 && rest.length ? G.dice.pick(rest, 'played down', log, name) : 0;
    c.trust = false; c.goodCount = 0; c.guardHit = false; c.qlog = []; c.offered = new Set();
  }
  // a menu never repeats an option you have already seen (the same leading or off-topic question kept coming back),
  // and holds at most one good question; if that would leave fewer than 3 options, the repeats stay
  // An option may only build on what the player has seen: its uses words must appear there (most of them, to allow for
  // small changes). Options that fail are dropped, and safe open questions fill the menu back up to four.
  const words = t => String(t || '').toLowerCase().replace(/[^a-z0-9é' ]+/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const SAFE = [['What brings you here today?', 'good'], ['When did this start?', 'good'], ['How is this affecting your daily life?', 'good'],
    ['Can you tell me more about that?', 'good'], ['How are you feeling right now?', 'rapport'], ['Has anything like this happened before?', 'lowyield']];
  function grounded(c, opts) {
    const seen = new Set(words((c.seen || []).join(' ')));
    const ok = opts.filter(o => {
      const w = words(o.uses);
      if (!w.length) return true; // a fully open question
      const hit = w.filter(x => seen.has(x)).length / w.length;
      if (hit < 0.7) { note(c, '(dropped, not grounded: "' + plain(o.text) + '" uses "' + plain(o.uses) + '")'); return false; }
      return true;
    });
    for (const [text, kind] of SAFE) {
      if (ok.length >= 4) break;
      const key = text.toLowerCase();
      if (!ok.some(o => plain(o.text).toLowerCase() === key) && !(c.offered && c.offered.has(key)) && !c.asked.includes(text)) ok.push({ text, kind, topic: '', step: 0, uses: '' });
    }
    return ok;
  }
  function tidyMenu(c, opts) {
    let goods = 0;
    const one = opts.filter(o => o.kind !== 'good' || ++goods === 1);
    const fresh = one.filter(o => !c.offered.has(plain(o.text).toLowerCase()));
    const menu = fresh.length >= 3 ? fresh : one.length >= 3 ? one : opts;
    menu.forEach(o => c.offered.add(plain(o.text).toLowerCase()));
    return menu;
  }
  const asksCollateral = o => /^ask\b/i.test(plain(o.text));
  function* liveInterview(c, a) {
    setupDepth(c);
    c.messages = [{ role: 'user', content: brief(c, a) }];
    const open = yield* call(c, OPEN_SCHEMA, OPEN_TIMEOUT, 'medium'); // every case: Claude writes the person and the opening
    if (!open || goodOptions(open.options).length < 2) return false;
    // first name only, as the game shows names ("DANIEL MORRIS" -> "DANIEL")
    c.name = (plain(open.patient_name).split(' ')[0] || '').toUpperCase().slice(0, 10) || 'TRAINER';
    c.clues = {}; c.overlaps = {};
    c.sheet = {};
    (open.clue_facts || []).forEach(f => { if (f.step >= 1 && f.step <= c.pathway.length) {
      c.clues[f.step] = plain(f.fact); c.overlaps[f.step] = plain(f.overlap);
      c.sheet[f.step] = { short: plain(f.short || ''), wrong: plain(f.wrong || ''), status: f.status === 'later' || f.status === 'still' ? f.status : 'out' };
    } });
    c.mimicWhy = plain(open.mimic_explanation);
    c.teaching = plain(open.teaching_note);
    if (c.clinical) { // a prepared diagnosis: its sheet statuses and teaching note are the checked ones
      c.clinical.steps.forEach((x, i) => { if (c.sheet[i + 1]) c.sheet[i + 1].status = x.status; });
      if (c.clinical.teaching) c.teaching = c.clinical.teaching;
    }
    c.found = {}; c.foundBy = {}; c.foundOrder = []; c.patience = PMAX; c.topics = {}; c.asked = [];
    yield* intro(c, a);
    yield* opening(c, open);
    let options = shuffle(tidyMenu(c, grounded(c, goodOptions(open.options)))), turn = 0;
    for (;;) {
      if (yield* endCheck(c, turn)) break;
      note(c, 'OPTIONS: ' + options.map((o, i) => 'ABCD'[i] + ') ' + plain(o.text) + ' [' + o.kind + (o.step ? ', step ' + o.step : '') + ']').join('  '));
      // no "ready to diagnose" line: B stops the interview (after a YES), or it ends by itself (turns, PATIENCE)
      // "Make your diagnosis" is always the last line; B asks first, so a slip doesn't end the case
      const r = yield* choose(askHead(), options.map(o => plain(o.text)).concat(['(Make your diagnosis)']), 0, true);
      if (r === options.length) { yield* sayLog(c, goodbye(c)); break; }
      if (r < 0) { if (!(yield* G.ask('Stop asking and make your diagnosis?'))) continue; yield* sayLog(c, goodbye(c)); break; }
      const o = options[r], trusted = c.trust, kindNote = applyKind(c, o);
      c.asked.push(plain(o.text));
      turn++;
      // a good question about a step finds that step's clue, whatever the reply says; so does a sensitive one once trust
      // is built. A GUARDED step needs a second question, and an UNRELIABLE one a question to the collateral source.
      let probe = (o.kind === 'good' || o.kind === 'rapport' || (o.kind === 'sensitive' && trusted)) && o.step >= 1 ? o.step : 0;
      let extra = '';
      if (o.kind === 'sensitive' && o.step >= 1 && !trusted) extra += ' Trust is NOT built yet: the patient gives a short, guarded answer that does not reveal step ' + o.step + '\'s clue.';
      if (probe && probe === c.unreliable && !asksCollateral(o)) { extra += ' Step ' + probe + ' is UNRELIABLE: the patient plays it down and the answer must not reveal its clue. Offer a good option addressed to the collateral source for it next.'; probe = 0; }
      else if (probe && probe === c.guarded && !c.guardHit) { c.guardHit = true; extra += ' Step ' + probe + ' is GUARDED: this first time the answer is vague (only its overlap, not the clue). Offer a good follow-up option for step ' + probe + ' next.'; probe = 0; }
      if (o.kind === 'rapport' || (o.kind === 'good' && ++c.goodCount >= 2)) c.trust = true;
      extra += c.trust ? ' Trust is built: sensitive questions now get open answers.' : ' Trust is not built yet.';
      // only the question's own words: the menu is shuffled, so a letter would point at a different option in your list
      c.messages.push({ role: 'user', content: 'The player asked this question (and only this one; answer it, not any other option): "' + o.text + '" (' + o.kind + (o.step ? ', step ' + o.step : '') + '). PATIENCE is now ' + c.patience + '/' + PMAX + '.' +
        (o.step >= 1 && o.kind === 'good' ? ' This question reaches step ' + o.step + ': the answer must contain the facts behind its clue, told plainly in the patient\'s everyday words, without explaining what they mean.' : '') +
        (c.patience <= 0 ? ' PATIENCE is zero: the patient answers in one sentence that they want to stop talking.' :
          c.patience < PMAX ? ' The player never sees PATIENCE: show it only in the patient\'s tone, subtly (a little shorter, cooler or more guarded as it drops; warmer again after rapport). Never say it outright.' : '') +
        ' Steps found so far: ' + (Object.keys(c.found).filter(k => c.found[k]).join(', ') || 'none') + ' (do not offer a good option for those; good options now go to steps not found yet, or follow up on what the patient just said).' +
        ' Already asked: ' + c.asked.map(q => '"' + q + '"').join(', ') + ' (never offer these again).' +
        ' Offered before (write new questions, never reuse or reword these): ' + [...c.offered].slice(-12).map(q => '"' + q + '"').join(', ') + '.' +
        (c.pathway.every((p, i) => c.found[i + 1]) ? ' Every pathway step is found: the good option now asks about a core feature not covered yet (onset, duration, frequency, impairment, a specifier).' : '') +
        extra + offtopicRule(c) });
      const t = yield* call(c, TURN_SCHEMA, TURN_TIMEOUT, 'low');
      if (!t) { markFound(c, probe, o.text, ''); yield* sayLog(c, kindNote + '\f' + c.name + ' goes quiet. Time to diagnose.'); break; }
      const before = c.foundOrder.length;
      // Claude's own revealed_steps can't open a step the rules above kept closed this turn
      const closed = s => (s === c.guarded && !(probe === s)) && !c.found[s] || (s === c.unreliable && !asksCollateral(o));
      [probe].concat((t.revealed_steps || []).filter(s => !closed(s))).forEach(s => markFound(c, s, plain(o.text), String(t.answer || '')));
      // the patient answers first; then a short coach note, and a note when you learned something for the case file
      const fb = trimVerdict(t.feedback || '');
      const gotClue = c.foundOrder.length > before;
      c.qlog.push({ q: plain(o.text), kind: o.kind, early: o.kind === 'sensitive' && !trusted, clue: gotClue, fb });
      yield* sayLog(c, speech(c, t.answer || '...'));
      c.seen.push(plain(t.answer || ''));
      // from CASE LEVEL 2 the verdict waits for the case notes ("Your questions"), so you judge each answer yourself
      if (c.hideVerdict) note(c, '(hidden: ' + kindNote + (fb ? ' ' + fb : '') + (gotClue ? ' New clue noted.' : '') + ')');
      else yield* sayLog(c, '(' + kindNote + (fb ? ' ' + fb : '') + (gotClue ? ' New clue noted.' : '') + ')');
      const next = tidyMenu(c, grounded(c, goodOptions((t.options || []).filter(x => x && !c.asked.includes(plain(x.text))))));
      if (next.length < 2) break;
      options = shuffle(next);
    }
    return true;
  }

  const interview = liveInterview;

  // a question that stays on screen above its menu (like G.ask); the menu spans the screen for long questions
  // items are the full texts: the menu shows them shortened (label), and while the cursor is on one that had to be
  // cut, the box below shows it in full (moving to a short one brings the question back)
  function* choose(question, items, sel, canCancel) {
    const full = items.map(x => String(x).replace(/\s*\((for example|only vs\.)[^)]*\)/g, '').trim()), shown = full.map(label);
    yield* G.say(question, { noWait: true });
    const bg = new G.ui.StaticBox(question), qtb = bg.tb;
    G.engine.push(bg);
    let last = -1;
    const onMove = i => {
      if (i === last) return;
      last = i;
      if (shown[i] === full[i]) { bg.tb = qtb; return; }
      const tb = new G.ui.StaticBox(full[i]).tb; tb.page = 0; bg.tb = tb; // the start of the text, if it needs two boxes
    };
    const r = yield* G.choose(shown, { x: 6, w: 308, y: Math.max(4, G.ui.BOX.y - 2 - (items.length * 15 + 12)), noCancel: !canCancel, sel: sel || 0, onMove });
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
    const names = [c.target].concat(c.lure ? [c.lure] : [], c.pathway.map(p => p.diff), diffsFor(t, c.lure || c.target).map(d => d[0]))
      .filter((n, i, all) => all.indexOf(n) === i);
    const others = names.filter(n => n !== c.target).slice(0, 4);
    const choices = shuffle([c.target].concat(others, padNames(t, [c.target].concat(others), 4 - others.length)));
    note(c, 'DIAGNOSIS OPTIONS: ' + choices.join(' | '));
    const r = yield* choose('What is your diagnosis?', choices);
    c.said = choices[r];
    c.dxRight = c.said === c.target;
    note(c, 'DIAGNOSIS: you said ' + c.said + ' (' + (c.dxRight ? 'right' : 'answer: ' + c.target) + ')');
    yield* G.say(c.trainer ? 'Noted. The case notes come after the battle.' : 'Noted.');
    c.ruleRight = 0;
    // THE DIFFERENTIAL SHEET: one screen per possibility on this case, in order. You decide what the evidence says:
    //   "Ruled out: <the deciding evidence>" (only if you found it), "Ruled out: <a tempting wrong reading>",
    //   "Still possible", "Can't decide yet (recheck later)", or "I didn't check this".
    // Right: a found clue -> its status (out / later / still; "ruled out" on a "later" one earns half);
    //        a clue you never found -> "I didn't check this" or "Still possible" earn half (honest, not checked)
    yield* G.say('Your differential.\fFor each possibility on this case, what does the evidence say?');
    c.sheetNotes = {};
    for (let i = 0; i < c.pathway.length; i++) {
      const step = i + 1, p = c.pathway[i], found = !!c.found[step];
      const sh = (c.sheet && c.sheet[step]) || { short: '', wrong: '', status: 'out' };
      const reasons = [];
      if (found) reasons.push({ text: 'Ruled out: ' + (sh.short || c.clues[step] || 'what you found'), val: 'out' });
      if (sh.wrong) reasons.push({ text: 'Ruled out: ' + sh.wrong, val: 'wrong' });
      const opts = shuffle(reasons).concat([{ text: 'Still possible', val: 'still' }, { text: 'Can\'t decide yet (recheck later)', val: 'later' }, { text: 'I didn\'t check this', val: 'unchecked' }]);
      const k = yield* choose('POSSIBILITY ' + step + ' OF ' + c.pathway.length + ':\n' + label(p.diff), opts.map(o => o.text));
      const pick = opts[k].val;
      let pts = 0;
      if (!found) pts = pick === 'unchecked' || pick === 'still' ? 0.5 : 0; // honest, but finding the evidence is worth more
      else if (sh.status === 'later') pts = pick === 'later' ? 1 : pick === 'out' ? 0.5 : 0;
      else pts = pick === sh.status ? 1 : 0;
      c.ruleRight += pts;
      const best = !found ? 'I didn\'t check this' : sh.status === 'later' ? 'Can\'t decide yet (recheck later)' : sh.status === 'still' ? 'Still possible' : 'Ruled out: ' + (sh.short || c.clues[step]);
      c.sheetNotes[step] = { pick: opts[k].text, pts, best };
      note(c, 'SHEET ' + p.diff + ': options ' + opts.map(o => o.text).join(' | ') + ' -> you said ' + opts[k].text + (pts === 1 ? ' (right)' : pts ? ' (half: best is ' + best + ')' : ' (best: ' + best + ')'));
    }
    // LEVEL 3 always asks about a second diagnosis, so a comorbid case is not given away ("None" is right without one)
    if (c.level >= 3) {
      const right = c.comorbid ? c.comorbid.name : 'None';
      const decoys = shuffle(G.DX_TABLES.filter(x => x !== c.table && (!c.comorbid || targetOf(x) !== c.comorbid.name))).slice(0, c.comorbid ? 3 : 4).map(targetOf);
      const opts = ['None'].concat(shuffle((c.comorbid ? [c.comorbid.name] : []).concat(decoys)));
      const k = yield* choose('Is there a second diagnosis?', opts);
      c.saidSecond = opts[k]; c.secondRight = opts[k] === right;
      note(c, 'SECOND DIAGNOSIS: you said ' + c.saidSecond + ' (' + (c.secondRight ? 'right' : 'answer: ' + right) + ')');
    }
    // the SPECIFIER question: 1 case in 4 (d4 = 1), for a diagnosis with a rolled specifier (presentation, severity,
    // type, insight...), and only when you named the diagnosis
    const specs = c.symptoms && c.symptoms.specs || [];
    if (specs.length && c.dxRight) {
      const d = G.dice.roll(4, 'specifier question (1 = yes)', c.rolls);
      if (G.dxStudy._specAlways) d.n = 1; // tests only
      d.result = d.n === 1 ? 'yes' : 'no';
      if (d.n === 1) {
        const sp = G.dice.pick(specs, 'specifier', c.rolls, x => x.name);
        const opts = shuffle(sp.options.slice());
        const k = yield* choose('SPECIFIER: ' + label(c.target) + '\n' + sp.name + '?', opts);
        c.spec = { name: sp.name, said: opts[k], answer: sp.answer, right: opts[k] === sp.answer };
        note(c, 'SPECIFIER ' + sp.name + ': you said ' + opts[k] + ' (' + (c.spec.right ? 'right' : 'answer: ' + sp.answer) + ')');
      }
    }
    // the score: interview 20% (share of clues found), diagnosis 40% (at LEVEL 3: 30% + 10% for the second one), and
    // the differential sheet 40% (see above)
    const found = c.pathway.filter((p, i) => c.found[i + 1]).length;
    c.score = 0.2 * found / c.pathway.length + (c.level >= 3 ? (c.dxRight ? 0.3 : 0) + (c.secondRight ? 0.1 : 0) : (c.dxRight ? 0.4 : 0)) + 0.4 * c.ruleRight / c.pathway.length;
    // a specifier, when asked: before late game (6 badges) a right answer is a BONUS on top of the score; from then on it
    // is part of the 100% (10% of it), so a perfect case needs it
    c.bonus = 0;
    if (c.spec) {
      if (caseLevel() >= 3) c.score = 0.9 * c.score + (c.spec.right ? 0.1 : 0);
      else if (c.spec.right) c.bonus = 0.1;
    }
  }

  // ---------------- spectrum: PATIENCE -> battle, score -> reward ----------------
  // A failed case (a wrong diagnosis, or a score under FAIL_SCORE) makes a trainer's team 2 levels stronger again
  const failed = c => !c.dxRight || c.score < FAIL_SCORE;
  function battleFor(p, fail) {
    const lead = Math.max(1, ...G.state.party.map(m => m.level));
    p = Math.max(0, Math.min(PMAX, p));
    const levels = [3, 2, 1, 0][p] + (fail ? 2 : 0), heals = [2, 1, 1, 0][p] + (fail ? 1 : 0);
    const heal = G.state.badges.length < 4 ? 'POTION' : G.state.badges.length < 7 ? 'SUPER_POTION' : 'HYPER_POTION';
    // a failed case or no PATIENCE left also makes the trainer battle one TRAINER AI level smarter (src/game/trainerai.js)
    return { boost: { levels, cap: lead + (fail ? 4 : 2) }, extraItems: Array(heals).fill(heal), aiBonus: fail || p <= 0 ? 1 : 0 };
  }
  function battleLine(name, p, fail) {
    if (fail && p >= 2) return name + ': You weren\'t really hearing me. Let\'s see how you battle!';
    if (p >= 3) return name + ': Thanks for really listening. Now, a fair match!';
    if (p >= 2) return name + ': OK... let\'s just battle.';
    if (p >= 1) return name + ': I\'m done talking. I won\'t hold back!';
    return name + ' says nothing and gets ready to battle hard.';
  }
  // ---------------- boons: the reward for a good case ----------------
  // Nothing for a failed case. Money grows with the square of the score, so 100% pays about twice 70%. On top of that,
  // one boon from the score's tier (50% / 70% / 90%): [item, count], or a special boon ({ repel: steps }, { tm: true }).
  // After 5 badges the basic items upgrade. A perfect 100% also gives a JACKPOT: a random POKéMON (1 in 3), a random
  // TM, or a rare item.
  const BOONS = {
    1: [['POTION', 1], ['ANTIDOTE', 1], ['PARLYZ_HEAL', 1], ['AWAKENING', 1], ['BURN_HEAL', 1], ['REPEL', 1], ['POKE_BALL', 2], ['FRESH_WATER', 1], { repel: 50 }],
    2: [['SUPER_POTION', 2], ['GREAT_BALL', 2], ['REVIVE', 1], ['FULL_HEAL', 2], ['SUPER_REPEL', 1], ['X_ATTACK', 2], ['X_SPEED', 2], ['X_SPECIAL', 2], ['DIRE_HIT', 1], ['ETHER', 2], ['ESCAPE_ROPE', 1], { repel: 150 }],
    3: [['RARE_CANDY', 1], ['PP_UP', 1], ['HP_UP', 1], ['PROTEIN', 1], ['IRON', 1], ['CARBOS', 1], ['CALCIUM', 1], ['MAX_REVIVE', 1], ['ULTRA_BALL', 3], ['ELIXER', 1], ['NUGGET', 1],
      ['MOON_STONE', 1], ['FIRE_STONE', 1], ['WATER_STONE', 1], ['THUNDER_STONE', 1], ['LEAF_STONE', 1], { tm: true }],
  };
  const UPGRADE = { POTION: 'SUPER_POTION', SUPER_POTION: 'HYPER_POTION', POKE_BALL: 'GREAT_BALL', GREAT_BALL: 'ULTRA_BALL', REPEL: 'SUPER_REPEL', SUPER_REPEL: 'MAX_REPEL', ETHER: 'MAX_ETHER', FRESH_WATER: 'LEMONADE' };
  const JACKPOT_ITEMS = [['RARE_CANDY', 3], ['PP_UP', 2], ['MAX_REVIVE', 2], ['FULL_RESTORE', 2], ['MAX_ELIXER', 1], ['NUGGET', 2], ['ULTRA_BALL', 5], ['MASTER_BALL', 1],
    ['HP_UP', 2], ['PROTEIN', 2], ['IRON', 2], ['CARBOS', 2], ['CALCIUM', 2]];
  const TMS = () => Object.keys(G.DATA.items).filter(k => /^TM_/.test(k));
  function rewardFor(s, dxRight) {
    const b = G.state.badges.length;
    if (dxRight === false || s < FAIL_SCORE) return { money: 0, boon: null, tier: 0, jackpot: false };
    const money = Math.round(s * s * (150 + 150 * b));
    const tier = s >= 0.9 ? 3 : s >= 0.7 ? 2 : 1;
    let boon = BOONS[tier][rnd(BOONS[tier].length)];
    if (Array.isArray(boon) && b >= 5 && UPGRADE[boon[0]]) boon = [UPGRADE[boon[0]], boon[1]];
    return { money, boon, tier, jackpot: s >= 0.995 };
  }
  // a random POKéMON for a perfect case. In a randomized game it comes from the randomizer's seed (src/game/randomizer.js);
  // otherwise from any of the 150 that aren't legendary.
  function giftSpecies(c) {
    if (G.rando && G.rando.giftSpecies) return G.rando.giftSpecies(G.state.rando && G.state.rando.seed ? G.state.rando.seed + ':' + (c.key || '') : null);
    const pool = G.DATA.dexOrder.filter(sp => sp && G.DATA.species[sp] && !['ARTICUNO', 'ZAPDOS', 'MOLTRES', 'MEWTWO', 'MEW'].includes(sp));
    return pool[rnd(pool.length)];
  }
  function* giveBoon(boon, giver) {
    if (Array.isArray(boon)) { yield* G.S.give(boon[0], boon[1]); return; }
    if (boon.repel) {
      G.state.repel = Math.max(G.state.repel || 0, boon.repel);
      yield* G.say(giver + ' tells you the quiet paths around here.\fWeak wild POKéMON will keep away for ' + boon.repel + ' steps!');
      return;
    }
    if (boon.tm) { const tms = TMS(); yield* G.S.give(tms[rnd(tms.length)], 1); }
  }
  // hand out the reward: money, then the boon, then the JACKPOT at 100%; a score of 70% or more also lifts one curse
  function* giveReward(c, giver) {
    const { money, boon, tier, jackpot } = rewardFor(c.score, c.dxRight);
    if (money) { G.state.money += money; if (G.sfx) G.sfx('item'); yield* G.say(G.state.name + ' got ¥' + money + ' for the case work!'); }
    if (tier >= 2 && (G.state.dxCurse || 0) > 0) {
      G.state.dxCurse--;
      yield* G.say(giver + ' sees that something heavy follows you...\fThey help you let it go. One curse is lifted!' + (G.state.dxCurse ? '\f(Curses still waiting: ' + G.state.dxCurse + ')' : ''));
    }
    if (boon) yield* giveBoon(boon, giver);
    if (c.bonus && money) { // a right specifier before late game
      const extra = Math.round(money * 0.25), b2 = BOONS[2][rnd(BOONS[2].length)];
      G.state.money += extra;
      yield* G.say('SPECIFIER BONUS! You named the ' + c.spec.name.toLowerCase() + ' too.\f' + G.state.name + ' got ¥' + extra + ' more!');
      yield* giveBoon(b2, giver);
    }
    if (!jackpot) return;
    yield* G.say('A PERFECT CASE!\f' + giver + ' has one more thing for you...');
    const roll = rnd(3);
    if (roll === 0) {
      const lead = Math.max(5, ...G.state.party.map(m => m.level)), sp = giftSpecies(c);
      yield* G.say(giver + ': I raised this one, but it wants to see the world.\fPlease take it with you!');
      if (!(yield* G.S.giftMon(sp, Math.max(5, lead - 5)))) yield* G.S.give('RARE_CANDY', 2); // no room: RARE CANDY instead
    } else if (roll === 1) yield* giveBoon({ tm: true }, giver);
    else yield* giveBoon(JACKPOT_ITEMS[rnd(JACKPOT_ITEMS.length)], giver);
  }
  function caseNotes(c) {
    const found = c.pathway.filter((p, i) => c.found && c.found[i + 1]).length;
    const pages = ['CASE NOTES: ' + c.name + '\nScore ' + pct(c.score) + (c.bonus ? ' +' + pct(c.bonus) + ' bonus' : '') + ', PATIENCE ' + c.patience + '/' + PMAX +
      '\nClues found ' + found + '/' + c.pathway.length + ', diagnosis ' + (c.dxRight ? 'right' : 'missed') + ', sheet ' + (c.ruleRight || 0) + '/' + c.pathway.length,
      (c.twist ? 'TWIST! It looked like ' + c.lure + ', but it was not.\n' : '') + 'Answer: ' + c.target + (c.dxRight ? ' (you got it!)' : '\nYou said: ' + c.said),
      'Entry: ' + c.table.group + (c.table.draft ? '\n(Draft table: check it against the book.)' : '')];
    if (c.spec) pages.push('Specifier (' + c.spec.name + '): ' + c.spec.answer + (c.spec.right ? ' (you got it!' + (c.bonus ? ' Bonus +10%' : '') + ')' : '\nYou said: ' + c.spec.said));
    if (c.level >= 3) pages.push('Second diagnosis: ' + (c.comorbid ? c.comorbid.name : 'none') + (c.secondRight ? ' (you got it!)' : '\nYou said: ' + c.saidSecond));
    c.pathway.forEach((p, i) => {
      const step = i + 1, st = (c.sheet && c.sheet[step] && c.sheet[step].status) || 'out', sn = c.sheetNotes && c.sheetNotes[step];
      pages.push(step + '. ' + p.diff +
        (c.overlaps && c.overlaps[step] ? '\nWhy it could fit: ' + c.overlaps[step] : '') +
        '\nWhat decides it: ' + (c.clues[step] || p.ruleOut) +
        (st === 'later' ? '\nCan\'t decide yet: recheck it after the real cause is treated.' : st === 'still' ? '\nStill possible: it can be present too.' : '\nRuled out.') +
        (c.foundBy && c.foundBy[step] ? '\nFound by: "' + c.foundBy[step].q + '"' : '\nNot checked. To check it, ask: "' + (p.probe || 'a question about this') + '"') +
        (sn ? '\nYou said: ' + sn.pick + (sn.pts === 1 ? ' (right)' : sn.pts ? ' (half: ' + sn.best + ')' : ' (best: ' + sn.best + ')') : ''));
    });
    if (c.qlog && c.qlog.length) { // every question, its kind and whether it found a clue (the only place you see this from LEVEL 2)
      const lines = c.qlog.map((x, i) => (i + 1) + '. ' + x.q + '\n   ' + KIND_LABEL[x.kind] + (x.early ? ' (too early: no trust yet)' : '') + (x.clue ? ', found a clue' : ''));
      for (let i = 0; i < lines.length; i += 2) pages.push((i ? '' : 'YOUR QUESTIONS\n') + lines.slice(i, i + 2).join('\n'));
    }
    if (c.guarded || c.unreliable) pages.push((c.guarded ? 'Held back: ' + c.pathway[c.guarded - 1].diff + ' (it needed a follow-up question).' : '') + (c.unreliable ? (c.guarded ? '\n' : '') + 'Played down: ' + c.pathway[c.unreliable - 1].diff + ' (only the family member or friend told the truth).' : ''));
    if (c.symptoms) { // the rolled symptoms against the criteria
      const S = c.symptoms;
      pages.push('CRITERIA: ' + c.target + (S.spec ? '\nSpecifier: ' + S.spec : '') + '\nDuration: ' + S.duration + (S.total ? '\nAll groups together need ' + S.total + '.' : ''));
      S.groups.forEach(g => pages.push(g.name + ': ' + g.has.length + ' of ' + g.items.length + ' (needs ' + g.need + ')\nHas: ' + (g.has.map(i => g.items[i]).join(', ') || 'none') +
        (g.has.length < g.items.length ? '\nNot present: ' + g.items.filter((x, i) => !g.has.includes(i)).join(', ') : '')));
    }
    if (c.rolls && c.rolls.length) { // every die the case rolled, in order (src/game/dice.js)
      const lines = c.rolls.map(G.dice.line);
      for (let i = 0; i < lines.length; i += 4) pages.push((i ? '' : 'DICE\n') + lines.slice(i, i + 4).join('\n'));
    }
    if (c.mimic) pages.push('Red herring: it looked like ' + c.mimic.name + (c.mimicWhy ? ', but ' + c.mimicWhy : '.'));
    if (c.teaching) pages.push('Note: ' + c.teaching);
    return pages.join('\f');
  }

  // A townsperson's case that went well ends in their thanks:
  //   heal  = PATIENCE/PMAX x min(1, score/90%) of every POKéMON's lost HP: a full heal needs full PATIENCE and 90%+
  //   score -> the same money and boon as a trainer's reward (giveReward)
  // A case that went badly (failed, or PATIENCE ran out) gets no thanks; see upset() below.
  function* npcThanks(c) {
    const p = c.patience;
    // in an ADULT CASE the patient is in the clinic file, so the townsperson who shared it does the thanking
    const who = c.adult ? 'The clinician' : c.name;
    if (failed(c) || p <= 0) {
      yield* G.say(c.adult ? 'The clinician: ' + (failed(c) ? 'That diagnosis would not help the patient. Study the notes.' : 'Right answer, but that patient walked out. Study the notes.')
        : failed(c) ? who + ': I don\'t think you understood me at all.' : who + ': You got it right, but you didn\'t listen to me.');
      return;
    }
    yield* G.say(c.adult ? 'The clinician: ' + (p >= 3 ? 'You handled that interview well.' : p >= 2 ? 'Not bad. Keep practicing.' : 'Right answer, but that patient would not come back...')
      : who + ': ' + (p >= 3 ? 'Thank you for really listening.' : p >= 2 ? 'Thanks for hearing me out.' : 'Well... thanks, I guess.'));
    const share = (p / PMAX) * Math.min(1, c.score / 0.9), full = share >= 0.999;
    const party = G.state.party.filter(m => m.hp > 0 || full);
    if (share > 0 && party.length) {
      if (full) party.forEach(m => m.healFull());
      else party.forEach(m => { m.hp = Math.min(m.maxhp, m.hp + Math.ceil((m.maxhp - m.hp) * share)); });
      if (G.sfx) G.sfx('heal');
      yield* G.say(who + (full ? ' looked after your team. Your POKéMON are fully healed!' : ' helped your POKéMON rest a little. They got back some HP.'));
    }
    yield* giveReward(c, who);
  }
  // ---------------- an upset townsperson battles you ----------------
  // When a townsperson's case fails or their PATIENCE runs out, they challenge you, if their sprite fits a trainer
  // class (children, elders, nurses and clerks don't battle). Their team is one of that class's teams near your level,
  // made stronger by battleFor(), and the win pays no prize money. A loss is a normal blackout.
  const BATTLE_CLASS = { youngster: 'YOUNGSTER', girl: 'LASS', brunette_girl: 'JR_TRAINER_F', swimmer: 'SWIMMER', cooltrainer_m: 'COOLTRAINER_M',
    cooltrainer_f: 'COOLTRAINER_F', beauty: 'BEAUTY', super_nerd: 'SUPER_NERD', scientist: 'SCIENTIST', hiker: 'HIKER', biker: 'BIKER', gambler: 'GAMBLER',
    rocker: 'ROCKER', sailor: 'SAILOR', fisher: 'FISHER', gentleman: 'GENTLEMAN', channeler: 'CHANNELER', middle_aged_man: 'POKEMANIAC',
    balding_guy: 'ENGINEER', silph_worker_m: 'SCIENTIST', rocket: 'ROCKET', cook: 'JR_TRAINER_M' };
  function upsetTeam(sprite) {
    const cls = BATTLE_CLASS[sprite], parties = cls && G.DATA.parties[cls];
    if (!parties || !parties.length) return null;
    const lead = Math.max(1, ...G.state.party.map(m => m.level)), top = t => Math.max(...t.map(m => m[0]));
    // the team whose strongest POKéMON is nearest your strongest, not above it
    const under = parties.map((t, i) => [top(t), i + 1]).filter(x => x[0] <= lead);
    const pick = under.length ? under.sort((x, y) => y[0] - x[0])[0] : parties.map((t, i) => [top(t), i + 1]).sort((x, y) => x[0] - y[0])[0];
    return { cls, n: pick[1] };
  }
  function* upset(c, a) {
    if (!failed(c) && c.patience > 0) return;
    const team = upsetTeam(a.sprite);
    if (!team || !G.state.party.some(m => m.hp > 0) || !G.startTrainerBattle) return;
    const who = c.adult ? 'The clinician' : c.name;
    yield* G.say(who + ': ' + (c.adult ? 'You need more practice. Let\'s see if you battle better than you diagnose!' : c.patience <= 0 ? 'I\'m done talking. Let\'s battle!' : 'That\'s not it at all! You want a fight? Fine!'));
    const r = yield* G.startTrainerBattle(team.cls, team.n, Object.assign({ noPrize: true, winText: who + ': ...Fine. Maybe study harder.' }, battleFor(c.patience, failed(c))));
    note(c, 'UPSET BATTLE (' + team.cls + ' ' + team.n + '): ' + r);
  }

  // ---------------- the curse: a failed case costs the next POKéMON that faints ----------------
  // A case fails with a wrong diagnosis or a score under FAIL_SCORE. Each failure adds one curse (G.state.dxCurse), and a
  // wrong diagnosis with a low score adds two. The next of your POKéMON to faint in a normal battle is released after
  // that battle. Your last POKéMON is never released, and link battles and the Battle Tower don't count.
  const FAIL_SCORE = 0.5;
  let doomed = null;
  G.onPlayerFaint = m => { if ((G.state.dxCurse || 0) > 0 && !doomed) doomed = m; };
  function* checkFail(c) {
    if (!failed(c)) return;
    const n = !c.dxRight && c.score < FAIL_SCORE ? 2 : 1;
    G.state.dxCurse = (G.state.dxCurse || 0) + n;
    yield* G.say('The case went badly. A heavy feeling follows you...\fCURSE' + (n > 1 ? ' x2' : '') + ': the next POKéMON of yours that faints will be released.' +
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
  // Every case is played live with Claude, and Claude always invents the person (name, life, scene, opening, first
  // questions) to fit the NPC. PREPARED (default) takes the clinical side from a checked plan (src/data/dxplans.js):
  // the diagnosis, core facts with exact durations and tests, each rule-out's overlap, clue, probe and sheet status,
  // any twist, red herring or second diagnosis, and the teaching note. FRESH: the clinical side is rolled from the
  // study tables. MIX: about half and half. ADULT CASES are always FRESH (no plans for them).
  const SOURCES = ['PREPARED', 'FRESH', 'MIX'];
  const source = () => G.state.options.caseSource || 0;
  const liveOK = () => !!(G.claude && G.claude.available());
  // a plan fits an NPC when their age group and sex match the plan's patient, and a trainer only gets plans that can
  // happen right before a battle (trainer: false plans are for townsfolk only)
  const planFits = (b, a) => {
    const who = personOf(a);
    if (!who || !(b.ages || ['adult']).includes(who.age)) return false; // sex no longer matters: the person is invented
    return !(a.obj.trainer && b.trainer === false) && !(!a.obj.trainer && b.trainer === true);
  };
  // a checked plan for the table the dice picked, if one fits this NPC and your level (unplayed plans first)
  function planCase(a, tRolled, rolls) {
    const level = caseLevel(), seen = G.state.dxPlanSeen = G.state.dxPlanSeen || {};
    const pool = (G.DX_PLANS || []).filter(b => b.table === tRolled.id && planFits(b, a) && (b.level || 1) <= level);
    if (!pool.length) return null;
    const fresh = pool.filter(b => !seen[b.id]), least = pool.filter(b => seen[b.id] === Math.min(...pool.map(x => seen[x.id] || 0)));
    const b = G.dice.pick(fresh.length ? fresh : least, 'prepared plan', rolls, x => x.answer), t = tRolled;
    // only the clinical side of the plan is used: the diagnosis, the core facts, each rule-out's overlap, clue, probe
    // and sheet status, the twist, mimic and teaching note. The person (name, life, scene, opening, first questions)
    // is written fresh by Claude for this NPC every time, so no two cases share a story.
    const clinical = { core: b.core || [], steps: b.pathway.map(p => ({ overlap: p.overlap, status: p.status || 'out' })), mimicWhy: b.mimic ? b.mimic.why : '', teaching: b.teaching || '' };
    const c = { source: 'prepared', planId: b.id, clinical, system: SYSTEM, table: t, target: b.answer, lure: b.lure || null, twist: !!b.lure, twistWhy: b.twistWhy || '',
      pathway: b.pathway.map(p => ({ diff: p.diff, ruleOut: p.clue, probe: p.probe })), level: Math.max(b.level || 1, level),
      comorbid: b.second ? { name: b.second, core: '' } : (b.level || 1) >= 3 ? null : undefined, mimic: b.mimic ? { name: b.mimic.name, core: b.mimic.why || '' } : null, log: [], rolls };
    addExtras(c, t, level, rolls); // a plan below your level still gets your level's red herring and second-diagnosis roll
    return c;
  }
  // with no prepared plan that fits this NPC, PREPARED falls back to a FRESH case (one opening call)
  // The dice pick the diagnosis area first (rollTree). PREPARED then uses a checked plan for that table when one fits
  // this NPC and your level; otherwise, and always with FRESH, the clinical side comes from the table. MIX: d2.
  function newCase(a, adult) {
    if (!liveOK()) return null;
    const rolls = [], who = adult ? null : personOf(a);
    const t = rollTree(tablesFor(adult, who), rolls);
    if (adult) return rollCase(true, null, t, rolls);
    const src = source();
    let usePlan = src === 0;
    if (src === 2) { const d = G.dice.roll(2, 'case source (1 = prepared)', rolls); usePlan = d.n === 1; d.result = usePlan ? 'prepared' : 'fresh'; }
    return (usePlan && planCase(a, t, rolls)) || rollCase(false, who, t, rolls);
  }
  const markPlan = c => { if (c.planId) { const seen = G.state.dxPlanSeen = G.state.dxPlanSeen || {}; seen[c.planId] = (seen[c.planId] || 0) + 1; } };
  // ---------------- the case log: OPTION > DOWNLOAD CASE LOG ----------------
  // kept in this browser's localStorage (not in the save), last 60 cases
  const LOG_KEY = 'claudered.caseLog';
  const store = { get() { try { return JSON.parse(window.localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; } },
    set(v) { try { window.localStorage.setItem(LOG_KEY, JSON.stringify(v)); } catch (e) {} } };
  const LOG_MAX = 200; // across all games in this browser
  // each game gets its own id (kept in the save), so a NEW GAME starts a fresh log and DOWNLOAD CASE LOG shows only
  // this game's cases
  const gameId = () => G.state.dxGameId || (G.state.dxGameId = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36));
  function saveLog(c, where) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const all = store.get();
    all.push({ game: gameId(), at: new Date().toISOString(), where, source: c.source + (c.planId ? ' ' + c.planId : ''), level: c.level, lines: c.log, notes: caseNotes(c).split('\f') });
    store.set(all.slice(-LOG_MAX));
  }
  function* downloadLog() {
    const all = (typeof window !== 'undefined' && window.localStorage ? store.get() : []).filter(e => e.game === gameId());
    if (!all.length) { yield* G.say('No cases in this game\'s log yet.\fPlay a STUDY CASE first.'); return; }
    const text = all.map((e, i) => ['==== CASE ' + (i + 1) + ' | ' + e.at + ' | ' + e.where + ' | ' + e.source + ' | LEVEL ' + e.level + ' ===='].concat(e.lines, ['', '-- CASE NOTES --'], e.notes, ['']).join('\n')).join('\n');
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'claude-red-case-log.txt'; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      yield* G.say('Downloaded the log of ' + all.length + ' case' + (all.length === 1 ? '' : 's') + '.');
    } catch (e) { yield* G.say('The download did not work in this browser.'); }
  }

  // ---------------- the CASEBOOK: a POKéDEX for diagnoses (START > CASEBOOK) ----------------
  // Every diagnosis you meet gets an entry (G.state.dxDex, kept in the save): meeting it shows its name, chapter and your
  // record; solving a case of it (naming it right) unlocks the full entry: core features, the criteria counts, the
  // specifiers and how to rule out each differential. Numbered down the DSM tree like a POKéDEX.
  const where = () => String(G.ow.map.name).replace(/([a-z])([A-Z0-9])/g, '$1 $2');
  function record(c) {
    const dex = G.state.dxDex = G.state.dxDex || {};
    const add = (name, solved, score) => {
      const e = dex[name] = dex[name] || { seen: 0, solved: 0, best: 0, first: { who: c.name, where: where() } };
      e.seen++; if (solved) e.solved++;
      if (score != null) e.best = Math.max(e.best, Math.round(score * 100));
      e.last = { who: c.name, where: where() };
    };
    add(c.target, c.dxRight, c.score + (c.bonus || 0));
    if (c.twist && c.lure) add(c.lure, false, null); // what it looked like counts as met
    if (c.comorbid && c.comorbid.name) add(c.comorbid.name, !!c.secondRight, null);
  }
  const chapterNo = t => +String(t.id).split('.')[1];
  // every diagnosis in DSM order: [{ no, name, table }]
  function dexList() {
    const out = [], seen = new Set();
    const tables = G.DX_TABLES.concat(G.state.options.adultCases && G.DX_ADULT_TABLES ? G.DX_ADULT_TABLES : []);
    tables.slice().sort((x, y) => chapterNo(x) - chapterNo(y) || (x.id < y.id ? -1 : 1)).forEach(t => {
      (t.members ? t.members.map(m => memberName(t, m)) : [t.name]).forEach(name => { if (!seen.has(name)) { seen.add(name); out.push({ no: out.length + 1, name, table: t }); } });
    });
    return out;
  }
  const no3 = n => 'No.' + String(n).padStart(3, '0');
  function entryPages(d, e) {
    const t = d.table, pages = [no3(d.no) + ' ' + d.name + '\n' + t.group + '\nSeen ' + e.seen + '   Solved ' + e.solved + '   Best ' + e.best + '%',
      'First met: ' + e.first.who + ', ' + e.first.where + (e.last ? '\nLast met: ' + e.last.who + ', ' + e.last.where : '')];
    if (!e.solved) return pages.concat(['Solve a case of ' + d.name + ' to unlock its full entry.']);
    pages.push('Core features: ' + t.core);
    const cr = G.DX_CRITERIA && G.DX_CRITERIA[d.name];
    if (cr) {
      cr.groups.forEach(g => pages.push(g.name + ': needs ' + g.min + ' of ' + g.items.length + (g.minChild != null ? ' (' + g.minChild + ' for children)' : '') +
        (g.minAdult != null ? ' (' + g.minAdult + ' for adults)' : '') + (g.must ? ', including ' + g.must.map(i => g.items[i]).join(' or ') : '') + '\n' + g.items.join(', ')));
      if (cr.total) pages.push('All groups together: ' + cr.total + ' or more.');
      pages.push('Duration: ' + cr.duration);
      const sp = (cr.presentations ? ['Presentation: combined, predominantly inattentive, predominantly hyperactive-impulsive'] : [])
        .concat(cr.severity ? ['Severity: ' + cr.severity.map(([k, l]) => l + ' (' + k + '+)').join(', ')] : [])
        .concat((cr.specifiers || []).map(x => x.name + ': ' + x.options.join(', ')));
      if (sp.length) pages.push('Specifiers\n' + sp.join('\n'));
    }
    diffsFor(t, d.name).forEach(([dn, clue]) => pages.push('Rule out ' + dn + ':\n' + clue));
    return pages;
  }
  function* casebook() {
    const dex = G.state.dxDex || {}, all = dexList();
    const groups = [...new Set(all.map(d => d.table.group))];
    const seenIn = g => all.filter(d => d.table.group === g && dex[d.name]).length;
    let gi = 0;
    for (;;) {
      const met = Object.keys(dex).length, solved = Object.values(dex).filter(e => e.solved).length;
      const r = yield* choose('CASEBOOK   MET ' + met + '   SOLVED ' + solved + ' / ' + all.length,
        groups.map(g => short(g) + '  ' + seenIn(g) + '/' + all.filter(d => d.table.group === g).length), gi, true);
      if (r < 0) return;
      gi = r;
      const list = all.filter(d => d.table.group === groups[r]);
      let li = 0;
      for (;;) {
        const k = yield* choose(groups[r], list.map(d => no3(d.no) + ' ' + (dex[d.name] ? d.name + (dex[d.name].solved ? '' : ' (met)') : '?????')), li, true);
        if (k < 0) break;
        li = k;
        const d = list[k];
        if (!dex[d.name]) yield* G.say(no3(d.no) + ' ?????\fYou haven\'t met this diagnosis yet.');
        else yield* G.say(entryPages(d, dex[d.name]).join('\f'));
      }
    }
  }
  const keyOf = a => G.ow.map.name + ':' + a.obj.id;
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  // who offers a case (SOME, ADULT CASES): fixed within a game, so a reload can't change it, but salted with the game's
  // own id, so each new game picks different people
  const pickHash = key => { // FNV-1a with a final mix: every character changes the result
    let h = 2166136261;
    for (const ch of gameId() + ':' + key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    return h >>> 0;
  };
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
        current = { key, rematch: true, name: saved.name, patience: saved.p, score: saved.s, dxRight: saved.d !== false };
        return { battle: battleFor(saved.p, failed(current)), battleLine: saved.name + ': Back for a rematch?' };
      }
      if (mode === 1 && pickHash(key) % 3) return why('SOME skips this trainer in this game (set ALL for every trainer).'); // the same third all game
      const c = newCase(a);
      if (!c) return why('Claude is not available here.');
      c.trainer = true;
      c.key = key;
      why('starting a ' + c.source + ' case.');
      if (!(yield* interview(c, a))) { yield* G.say('(The study case could not start: Claude did not answer.)'); return null; } // a normal battle
      yield* diagnose(c);
      cases[key] = { name: c.name, p: c.patience, s: c.score, d: !!c.dxRight }; // kept, so a reload or a loss can't reroll the case
      record(c);
      markPlan(c);
      (G.state.dxLog = G.state.dxLog || []).push({ at: Date.now(), table: c.table.id, dx: c.target, said: c.said, score: c.score, patience: c.patience });
      current = c;
      return { battle: battleFor(c.patience, failed(c)), battleLine: battleLine(c.name, c.patience, failed(c)) };
    },
    after: function* (a, result) {
      const c = current; current = null;
      if (!c) return;
      if (!c.rematch) { yield* G.say(caseNotes(c)); note(c, 'BATTLE: ' + result); saveLog(c, G.ow.map.name + ' trainer'); yield* checkFail(c); }
      if (result !== 'win') { yield* G.say('Win the rematch to get ' + c.name + '\'s thanks.'); return; }
      delete G.state.dxCases[c.key].p; G.state.dxCases[c.key].done = true;
      if (!rewardFor(c.score, c.dxRight).money) { yield* G.say(c.name + ': Good battle. Keep studying!'); return; }
      yield* G.say(c.name + ': ' + (c.score >= 0.9 ? 'You really understood me. Take this!' : 'Thanks for listening. Here!'));
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
      if (mode === 1 && pickHash(key) % 3) return false;
      // ADULT CASES: about half of the adult-looking townsfolk (fixed within a game) share a clinic case instead
      const adult = !!(G.state.options.adultCases && G.DX_ADULT_TABLES && CLINICIANS.has(a.sprite) && pickHash(key + ':adult') % 2 === 0);
      const offer = adult ? 'I hear you study psychology. I work at a clinic. Want to go over a case from my files?\f(ADULT CASE: clinical language, no theme.)'
        : 'You study psychology, right? Could I talk to you about something?\f(STUDY CASE: listen?)';
      const c = newCase(a, adult);
      if (!c) return false;
      if (!(yield* G.ask(offer))) return false;
      c.key = key;
      if (!(yield* interview(c, a))) { yield* G.say('(The study case could not start: Claude did not answer.)'); return true; }
      yield* diagnose(c);
      cases[key] = { name: c.name, s: c.score, done: true };
      record(c);
      markPlan(c);
      (G.state.dxLog = G.state.dxLog || []).push({ at: Date.now(), table: c.table.id, dx: c.target, said: c.said, score: c.score, patience: c.patience });
      yield* G.say(caseNotes(c));
      saveLog(c, G.ow.map.name + ' townsperson');
      yield* npcThanks(c);
      yield* checkFail(c);
      yield* upset(c, a); // failed, or PATIENCE ran out: they challenge you
      return true;
    },
    afterBattle: releaseDoomed,
    reward: (score, giver, dxRight) => giveReward({ score, dxRight: dxRight !== false }, giver || 'They'), // for tests: the reward for a case score
    _newCase: a => newCase(a), // for tests: the case an NPC would get
    _thanks: function* (c, a) { yield* npcThanks(c); yield* checkFail(c); if (a) yield* upset(c, a); }, // for tests: a townsperson's thanks, the curse check, the upset battle
    _upsetTeam: upsetTeam,
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
    // START menu: CASEBOOK, once STUDY CASES is on or a diagnosis has been met
    casebook, hasCasebook: () => !!(G.state.options.study || (G.state.dxDex && Object.keys(G.state.dxDex).length)),
    _record: record, _dexList: dexList, _entryPages: entryPages, // for tests
  };
})(window.G);
