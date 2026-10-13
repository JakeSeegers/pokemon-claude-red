// RANDOMIZER: a new game can shuffle the wild POKéMON, the three starters and the trainers' teams.
// Ideas taken from the Universal Pokemon Randomizer FVX (no code from it): area 1-to-1 and family-to-family wild
// POKéMON, "catch 'em all", starters on a type triangle, trainers that keep their type themes, local POKéMON only and
// forced evolutions by level.
//
// The settings and a seed live in the save (G.state.rando). G.startGame calls G.rando.apply, which rebuilds the
// wild, fishing and trainer tables from the untouched copies below, so the same seed always gives the same game and a
// classic game always gets the original tables back.
(function (G) {
  'use strict';
  const D = G.DATA;
  const clone = o => JSON.parse(JSON.stringify(o));
  const ORIG = clone({ wild: D.wild, superRod: D.superRod, goodRod: D.goodRod, parties: D.parties });

  // ---------------- species facts ----------------
  const SP = D.species, ALL = D.dexOrder.filter(s => s && SP[s]); // the 151, not the glitch entries (src/game/glitches.js)
  const LEGEND = new Set(['ARTICUNO', 'ZAPDOS', 'MOLTRES', 'MEWTWO', 'MEW']);
  const bst = s => { const x = SP[s]; return x.hp + x.atk + x.def + x.spd + x.spc; };
  const prev = {};
  for (const s of ALL) for (const e of SP[s].evos) prev[e.to] = s;
  const baseOf = s => { while (prev[s]) s = prev[s]; return s; };
  const stageOf = s => { let n = 0; while (prev[s]) { s = prev[s]; n++; } return n; };
  // family: stages[i] = the species i evolutions away from the base
  const FAMILY = {};
  for (const s of ALL) {
    if (prev[s]) continue;
    const stages = [];
    let row = [s];
    while (row.length) { stages.push(row); row = row.flatMap(x => SP[x].evos.map(e => e.to)); }
    FAMILY[s] = stages;
  }
  const relatives = s => FAMILY[baseOf(s)].flat();
  const hasType = (s, t) => SP[s].types.includes(t);
  const SE = new Set(D.typeChart.filter(r => r[2] === 2).map(r => r[0] + '>' + r[1]));
  const beats = (a, b) => SE.has(a + '>' + b);

  // ---------------- seeded random ----------------
  function rng(seed) {
    let h = 1779033703;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353), h = h << 13 | h >>> 19;
    let a = h >>> 0;
    const next = () => { a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    return { next, int: n => Math.floor(next() * n), pick: arr => arr[Math.floor(next() * arr.length)] };
  }
  // the candidates nearest in base stat total to `like`, then one of those at random ("similar strength")
  function pickNear(R, cands, like) {
    if (!cands.length) return null;
    const b = bst(like);
    const sorted = cands.slice().sort((x, y) => Math.abs(bst(x) - b) - Math.abs(bst(y) - b) || (x < y ? -1 : 1));
    return R.pick(sorted.slice(0, Math.min(sorted.length, 5)));
  }
  // walk one evolution line from a species, so the same branch is used for every stage
  function evoLine(R, s) {
    const line = [s];
    while (SP[s].evos.length) { s = R.pick(SP[s].evos).to; line.push(s); }
    return line;
  }
  // map every member of family `from` to the member of the line `to` at the same stage (or its last stage)
  function mapFamily(map, from, line) {
    FAMILY[from].forEach((row, i) => { for (const s of row) map[s] = line[Math.min(i, line.length - 1)]; });
  }

  // ---------------- settings ----------------
  const DEFAULT = { wild: 'area', wildType: 'any', catchAll: true, starters: 'random', starterStage: 'basic', starterMax: 0, trainers: 'themes', trainerMons: 'any', trainerEvos: true };
  const newSeed = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

  // ---------------- starters ----------------
  const SLOTS = ['CHARMANDER', 'SQUIRTLE', 'BULBASAUR'];
  const STARTER_FAM = new Set(SLOTS.flatMap(relatives));
  function rollStarters(R, cfg) {
    let pool = ALL.filter(s => !LEGEND.has(s) && (cfg.starterStage !== 'basic' || !prev[s]) && (!cfg.starterMax || bst(s) <= cfg.starterMax));
    if (pool.length < 3) pool = ALL.filter(s => !LEGEND.has(s) && !prev[s]);
    if (cfg.starters === 'triangle') {
      // one single-type POKéMON per slot; WATER beats FIRE, FIRE beats GRASS, GRASS beats WATER, so the slot the
      // rival takes always beats yours, as in the original
      const single = pool.filter(s => SP[s].types.length === 1);
      const byType = {};
      for (const s of single) (byType[SP[s].types[0]] = byType[SP[s].types[0]] || []).push(s);
      const types = Object.keys(byType).sort(), tri = [];
      for (const f of types) for (const w of types) for (const g of types)
        if (f !== w && w !== g && f !== g && beats(w, f) && beats(f, g) && beats(g, w)) tri.push([f, w, g]);
      if (tri.length) {
        const t = R.pick(tri);
        return { CHARMANDER: R.pick(byType[t[0]]), SQUIRTLE: R.pick(byType[t[1]]), BULBASAUR: R.pick(byType[t[2]]) };
      }
    }
    const out = {}, used = new Set();
    for (const slot of SLOTS) {
      const left = pool.filter(s => !used.has(baseOf(s)));
      const s = R.pick(left.length ? left : pool);
      used.add(baseOf(s)); out[slot] = s;
    }
    return out;
  }

  // ---------------- wild ----------------
  // every encounter table, grouped by area: [area, table] where table is a list of [level, species]
  function wildTables() {
    const areas = {};
    const add = (k, t) => { if (t && t.length) (areas[k] = areas[k] || []).push(t); };
    for (const k in D.wild) { add(k, D.wild[k].grass.mons); add(k, D.wild[k].water.mons); }
    for (const k in D.superRod) add(k, D.superRod[k]);
    add('GOOD_ROD', D.goodRod);
    return areas;
  }
  const speciesIn = tables => [...new Set(tables.flatMap(t => t.map(m => m[1])))];
  function randomizeWild(R, cfg) {
    const areas = wildTables();
    const okType = (orig, s) => cfg.wildType !== 'keep' || hasType(s, SP[orig].types[0]);
    const pool = ALL.filter(s => !LEGEND.has(s));
    if (cfg.wild === 'family') {
      // global family-to-family: each family found in the wild becomes one other family, everywhere
      const fams = [...new Set(speciesIn(Object.values(areas).flat()).map(baseOf))];
      const free = new Set(Object.keys(FAMILY).filter(b => !LEGEND.has(b)));
      const map = {};
      for (const b of fams) {
        const size = FAMILY[b].length;
        const ok = [...free].filter(c => c !== b && okType(b, c));
        const same = ok.filter(c => FAMILY[c].length >= size);
        const to = pickNear(R, same.length ? same : ok.length ? ok : [...free], b) || b;
        free.delete(to);
        mapFamily(map, b, evoLine(R, to));
      }
      for (const area of Object.values(areas)) for (const t of area) for (const m of t) m[1] = map[m[1]] || m[1];
      return;
    }
    // area 1-to-1: each species in an area becomes one other species there, close in strength.
    // CATCH 'EM ALL hands out species nobody has placed yet first, so every POKéMON can be caught somewhere.
    let unplaced = new Set(pool);
    for (const k in areas) {
      const map = {}, used = new Set();
      for (const s of speciesIn(areas[k])) {
        const ok = pool.filter(c => !used.has(c) && okType(s, c));
        const fresh = cfg.catchAll ? ok.filter(c => unplaced.has(c)) : [];
        const to = pickNear(R, fresh.length ? fresh : ok.length ? ok : pool, s);
        map[s] = to; used.add(to); unplaced.delete(to);
      }
      for (const t of areas[k]) for (const m of t) m[1] = map[m[1]];
    }
  }

  // ---------------- trainers ----------------
  const GYM_TYPE = { PewterGym: 'ROCK', CeruleanGym: 'WATER', VermilionGym: 'ELECTRIC', CeladonGym: 'GRASS', FuchsiaGym: 'POISON', SaffronGym: 'PSYCHIC_TYPE', CinnabarGym: 'FIRE', ViridianGym: 'GROUND' };
  const CLASS_TYPE = { LORELEI: 'ICE', BRUNO: 'FIGHTING', AGATHA: 'GHOST', LANCE: 'DRAGON' };
  // gym trainers take their gym's type: [cls + ':' + set] -> type, read off the gym maps' trainer objects
  const PARTY_TYPE = {};
  for (const name in GYM_TYPE) {
    const m = G.MAPDATA && G.MAPDATA.maps[name];
    for (const o of (m && m.objs) || []) if (o.trainer) PARTY_TYPE[o.trainer.cls + ':' + o.trainer.n] = GYM_TYPE[name];
  }
  // a type that every POKéMON in the party shares; NORMAL only when nothing else fits (BIRD KEEPERs stay FLYING)
  function sharedType(party) {
    const shared = SP[party[0][1]].types.filter(t => party.every(m => hasType(m[1], t)));
    return shared.find(t => t !== 'NORMAL') || shared[0] || null;
  }
  // evolve a trainer's POKéMON as far as its level allows: level evolutions at their level, stone and trade
  // evolutions from level 35. Keeps the party's type when it has one.
  function evolveFor(R, s, lv, theme) {
    for (;;) {
      const evs = SP[s].evos.filter(e => (e.type === 'level' ? lv >= e.level : lv >= 35) && (!theme || hasType(e.to, theme)));
      if (!evs.length) return s;
      s = R.pick(evs).to;
    }
  }
  function randomizeTrainers(R, cfg, starterMap) {
    const isRival = cls => /^RIVAL/.test(cls);
    const on = cfg.trainers === 'random' || cfg.trainers === 'themes';
    let pool = ALL.filter(s => !LEGEND.has(s));
    if (on && cfg.trainerMons === 'local') {
      // what can be caught before the ELITE FOUR (not CERULEAN CAVE), plus anything in the same families
      const local = new Set();
      const areas = wildTables();
      for (const k in areas) if (!/^CERULEAN_CAVE/.test(k)) for (const t of areas[k]) for (const m of t) relatives(m[1]).forEach(x => local.add(x));
      pool = pool.filter(s => local.has(s));
    }
    const rivalMap = {}; // the rival's team stays the same species from battle to battle
    for (const cls in D.parties) {
      D.parties[cls].forEach((party, i) => {
        if (!party.length) return;
        const theme = cfg.trainers === 'themes' && !isRival(cls) ? (CLASS_TYPE[cls] || PARTY_TYPE[cls + ':' + (i + 1)] || sharedType(party)) : null;
        const used = new Set();
        for (const m of party) {
          const [lv, orig] = m;
          let s = orig;
          if (isRival(cls) && STARTER_FAM.has(orig)) s = starterMap[orig] || orig; // the rival keeps his starter
          else if (on) {
            if (isRival(cls) && rivalMap[orig]) s = rivalMap[orig];
            else {
              const typed = theme ? pool.filter(c => hasType(c, theme)) : pool;
              const fallback = theme ? ALL.filter(c => !LEGEND.has(c) && hasType(c, theme)) : pool;
              const cands = typed.length ? typed : fallback;
              const fresh = cands.filter(c => !used.has(c));
              s = pickNear(R, fresh.length ? fresh : cands, orig) || orig;
              if (isRival(cls)) rivalMap[orig] = s;
            }
          }
          if (cfg.trainerEvos) s = evolveFor(R, s, lv, theme);
          used.add(s); m[1] = s;
        }
      });
    }
  }

  // ---------------- apply ----------------
  G.rando = {
    DEFAULT,
    newSeed,
    starters: null, // slot species -> the POKéMON in that ball, while a randomized game runs
    starter: slot => (G.rando.starters && G.rando.starters[slot]) || slot,
    apply(cfg) {
      D.wild = clone(ORIG.wild); D.superRod = clone(ORIG.superRod); D.goodRod = clone(ORIG.goodRod); D.parties = clone(ORIG.parties);
      G.rando.starters = null;
      if (!cfg) return;
      cfg = Object.assign({}, DEFAULT, cfg);
      // each part gets its own stream, so changing one setting does not reshuffle the others
      const starterMap = {};
      if (cfg.starters !== 'off') {
        const R = rng(cfg.seed + ':starters');
        G.rando.starters = rollStarters(R, cfg);
        for (const slot of SLOTS) mapFamily(starterMap, slot, evoLine(R, G.rando.starters[slot]));
      }
      if (cfg.wild !== 'off') randomizeWild(rng(cfg.seed + ':wild'), cfg);
      randomizeTrainers(rng(cfg.seed + ':trainers'), cfg, starterMap);
    },
  };

  // ---------------- menus ----------------
  const CYCLE = {
    wild: [['off', 'OFF'], ['area', 'BY AREA'], ['family', 'BY FAMILY']],
    wildType: [['any', 'ANY'], ['keep', 'KEEP']],
    catchAll: [[true, 'ON'], [false, 'OFF']],
    starters: [['off', 'OFF'], ['random', 'RANDOM'], ['triangle', 'TRIANGLE']],
    starterStage: [['basic', 'BASIC'], ['any', 'ANY']],
    starterMax: [[0, 'ANY'], [300, 'MAX 300'], [350, 'MAX 350'], [400, 'MAX 400']],
    trainers: [['off', 'OFF'], ['random', 'RANDOM'], ['themes', 'THEMES']],
    trainerMons: [['any', 'ANY'], ['local', 'LOCAL']],
    trainerEvos: [[true, 'BY LEVEL'], [false, 'OFF']],
  };
  const LABEL = { wild: 'WILD', wildType: 'WILD TYPE', catchAll: "CATCH 'EM ALL", starters: 'STARTERS', starterStage: 'STARTER STAGE', starterMax: 'STARTER STATS', trainers: 'TRAINERS', trainerMons: 'TRAINER MONS', trainerEvos: 'TRAINER EVOS' };
  const HELP = {
    wild: 'BY AREA: each POKéMON in an area becomes one other POKéMON.\fBY FAMILY: each evolution family becomes another family everywhere.',
    wildType: 'KEEP: a wild POKéMON is replaced by one that shares its first type.',
    catchAll: "ON: every POKéMON is found somewhere in the wild. (BY AREA only.)",
    starters: 'RANDOM: three random starters.\fTRIANGLE: the three types beat each other in a circle, like FIRE, WATER and GRASS.',
    starterStage: 'BASIC: starters are never evolved forms.',
    starterMax: 'A limit on the starters\' total base stats.',
    trainers: 'RANDOM: trainers get random POKéMON of similar strength.\fTHEMES: gym leaders, gym trainers, the ELITE FOUR and trainers with one type keep that type.',
    trainerMons: 'LOCAL: trainers only use POKéMON you can find in the wild, and their evolutions.',
    trainerEvos: 'BY LEVEL: a trainer\'s POKéMON evolves when its level is high enough. Stone and trade evolutions happen from level 35.',
  };
  const valueName = (k, v) => (CYCLE[k].find(c => c[0] === v) || CYCLE[k][0])[1];

  // NEW GAME: CLASSIC or RANDOMIZER. Returns null (classic), a settings object, or false (back to the title).
  G.rando.newGameMenu = function* () {
    const r = yield* G.choose(['CLASSIC', 'RANDOMIZER'], { x: 6, y: 6, w: 130 });
    if (r < 0) return false;
    if (r === 0) return null;
    const cfg = Object.assign({}, DEFAULT, G.rando.last || {}, { seed: newSeed() });
    let sel = 0;
    for (;;) {
      const keys = Object.keys(CYCLE).filter(k => k !== 'catchAll' || cfg.wild === 'area');
      const items = keys.map(k => LABEL[k] + ': ' + valueName(k, cfg[k])).concat(['SEED: ' + cfg.seed, 'HELP', 'START', 'CANCEL']);
      const r2 = yield* G.choose(items, { x: 6, y: 4, w: 250, sel });
      if (r2 < 0 || items[r2] === 'CANCEL') return false;
      sel = r2;
      if (items[r2] === 'START') { G.rando.last = Object.assign({}, cfg); return cfg; }
      if (items[r2] === 'HELP') { for (const k of keys) yield* G.say(LABEL[k] + ': ' + HELP[k]); continue; }
      if (r2 === keys.length) { // SEED: roll a new one, or type one a friend shared
        const c = yield* G.choose(['NEW SEED', 'TYPE SEED'], { x: 120, y: 60, w: 140 });
        if (c === 0) cfg.seed = newSeed();
        if (c === 1) { const s = yield* G.namingScreen('SEED?', cfg.seed, 10); if (s) cfg.seed = s; }
        continue;
      }
      const k = keys[r2], opts = CYCLE[k], i = opts.findIndex(c => c[0] === cfg[k]);
      cfg[k] = opts[(i + 1) % opts.length][0];
    }
  };

  // OPTION > RANDOMIZER (in a randomized game): what this game uses, and its seed to share
  G.rando.summary = function () {
    const c = Object.assign({}, DEFAULT, G.state.rando);
    const lines = ['SEED: ' + c.seed];
    for (const k of Object.keys(CYCLE)) if (k !== 'catchAll' || c.wild === 'area') lines.push(LABEL[k] + ': ' + valueName(k, c[k]));
    return lines;
  };
  G.rando.showSummary = function* () {
    const L = G.rando.summary();
    for (let i = 0; i < L.length; i += 2) yield* G.say(L.slice(i, i + 2).join('\n'));
  };
})(window.G);
