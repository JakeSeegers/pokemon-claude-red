// TRAINER AI: how enemy trainers pick moves, items, switches and their next POKéMON (G.Battle, src/game/battle.js).
//
//   level 1  CLASSIC: the original weighted-random picks (battle.js enemyAction), first POKéMON left goes out next
//   level 2  SMART:   thinks about damage: takes a knockout when it sees one, prefers strong and accurate moves,
//                     uses status and set-up moves when they make sense, heals at low HP, and sends out the
//                     POKéMON that matches up best. Still a little random.
//   level 3  EXPERT:  as SMART, almost always the best pick, and it switches out of a bad matchup (at most twice
//                     a battle), uses X items when it is safe, and saves EXPLOSION for the end.
//
// OPTION > TRAINER AI: CLASSIC (everyone level 1), SMART (default: trainers 2, gym leaders, rivals, the Elite Four and
// GIOVANNI 3), HARD (everyone 3). A failed STUDY CASE (src/game/dxcases.js) adds 1 for that trainer.
// The AI sees your POKéMON's moves and stats, as the Game Boy AI does. Estimates use average damage, no random rolls,
// so the battle's own random numbers are never touched.
(function (G) {
  'use strict';
  const D = () => G.DATA;
  const PHYSICAL = new Set(['NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'BIRD']);
  const STAGE = [25, 28, 33, 40, 50, 66, 100, 150, 200, 250, 300, 350, 400];
  const ACC = [33, 36, 43, 50, 60, 75, 100, 133, 166, 200, 250, 266, 300];
  const BOSSES = new Set(['BROCK', 'MISTY', 'LT_SURGE', 'ERIKA', 'KOGA', 'SABRINA', 'BLAINE', 'GIOVANNI', 'LORELEI', 'BRUNO', 'AGATHA', 'LANCE', 'RIVAL1', 'RIVAL2', 'RIVAL3']);
  const MODES = ['CLASSIC', 'SMART', 'HARD'];
  const mode = () => { const m = G.state && G.state.options && G.state.options.trainerAI; return m == null ? 1 : m; };

  function level(cls, opts) {
    const m = mode(), base = m === 0 ? 1 : m === 2 ? 3 : BOSSES.has(cls) ? 3 : 2;
    return Math.max(1, Math.min(3, base + ((opts && opts.aiBonus) || 0)));
  }

  // ---------------- what a POKéMON can do: stats, types, moves (the active one with its stages, or one on the bench)
  function view(b, side, mon) {
    const active = mon === b.mon(side);
    return {
      mon, side, active, hp: mon.hp, maxhp: mon.maxhp, level: mon.level, status: mon.status,
      types: active ? b.types(side) : mon.types,
      moves: (active ? b.moveList(side) : mon.moves).filter(x => x.pp > 0),
      stat: k => {
        if (active) return b.stat(side, k);
        let v = mon[k];
        if (k === 'spd' && mon.status === 'PAR') v = Math.floor(v / 4);
        if (k === 'atk' && mon.status === 'BRN') v = Math.floor(v / 2);
        return Math.max(1, v);
      },
      v: active ? side.v : G.newVol(),
    };
  }
  // the average damage of one use of a move, before accuracy (0 for status moves)
  function damage(A, T, md) {
    if (!md || !md.power) return 0;
    const mult = G.typeMult(md.type, T.types);
    if (mult === 0) return 0;
    if (md.effect === 'SPECIAL_DAMAGE') return md.id === 'SONICBOOM' ? 20 : md.id === 'DRAGON_RAGE' ? 40 : A.level;
    if (md.effect === 'SUPER_FANG') return Math.max(1, T.hp >> 1);
    if (md.effect === 'OHKO') return A.stat('spd') >= T.stat('spd') && A.level >= T.level ? T.hp : 0;
    const phys = PHYSICAL.has(md.type);
    let atk = A.stat(phys ? 'atk' : 'spc'), def = T.stat(phys ? 'def' : 'spc');
    if (phys && T.v.reflect) def *= 2;
    if (!phys && T.v.lightScreen) def *= 2;
    if (md.effect === 'EXPLODE') def = Math.max(1, def >> 1);
    if (atk > 255 || def > 255) { atk = Math.max(1, atk >> 2); def = Math.max(1, def >> 2); }
    let dmg = Math.min(997, Math.floor(Math.floor(Math.floor(2 * A.level / 5 + 2) * md.power * atk / def) / 50)) + 2;
    if (A.types.includes(md.type)) dmg = Math.floor(dmg * 1.5);
    dmg = Math.floor(dmg * mult * 0.925);
    if (md.effect === 'TWO_TO_FIVE_ATTACKS') dmg *= 3;
    if (md.effect === 'ATTACK_TWICE' || md.effect === 'TWINEEDLE') dmg *= 2;
    return dmg;
  }
  const hitChance = (A, T, md) => {
    if (md.effect === 'SWIFT') return 1;
    if (md.effect === 'OHKO') return 0.3;
    const s = Math.max(-6, Math.min(6, (A.v.st.acc || 0) - (T.v.st.eva || 0)));
    return Math.min(1, (md.acc || 100) / 100 * ACC[s + 6] / 100);
  };
  // the most damage A's strongest move does to T (average roll, before accuracy)
  function bestDamage(A, T) {
    let best = 0;
    for (const x of A.moves) {
      const md = D().moves[x.id];
      if (!md || !md.power || md.effect === 'DREAM_EATER' && T.status !== 'SLP') continue;
      best = Math.max(best, damage(A, T, md));
    }
    return best;
  }
  // the best expected damage A can do to T this turn, as a share of T's HP
  function bestHit(A, T) {
    let best = 0;
    for (const x of A.moves) {
      const md = D().moves[x.id];
      if (!md || !md.power || md.effect === 'DREAM_EATER' && T.status !== 'SLP') continue;
      best = Math.max(best, Math.min(T.hp, damage(A, T, md)) * hitChance(A, T, md) / Math.max(1, T.hp));
    }
    return best;
  }
  // how good it is to have E in against P: what E can do minus what it takes (bigger is better)
  const matchup = (E, P) => bestHit(E, P) - bestHit(P, E) + (E.stat('spd') > P.stat('spd') ? 0.1 : 0);

  // ---------------- choosing a move
  function scoreMove(b, x, E, P, lv) {
    const md = D().moves[x.id];
    if (!md) return 1;
    const sub = P.v.sub > 0, faster = E.stat('spd') > P.stat('spd'), foeBest = bestHit(P, E);
    const safe = E.hp / E.maxhp > 0.6 && foeBest < 0.35; // the foe can't hurt us much right now
    if (md.power) {
      if (md.effect === 'DREAM_EATER' && P.status !== 'SLP') return 1;
      const dmg = damage(E, P, md), acc = hitChance(E, P, md);
      if (!dmg) return 1;
      const kills = dmg >= P.hp;
      let s = kills ? 100 * acc : 60 * Math.min(1, dmg / P.hp) * acc;
      if (kills && md.id === 'QUICK_ATTACK' && !faster) s += 30; // strikes first to finish it
      if (md.effect === 'CHARGE' || md.effect === 'FLY') s *= kills && faster ? 0.7 : 0.5; // two turns
      if (md.effect === 'HYPER_BEAM' && !kills) s *= 0.6; // the recharge turn
      if (md.effect === 'EXPLODE') s *= E.hp / E.maxhp < 0.3 || (lv < 3 && kills) ? 1 : 0.15;
      if (md.effect === 'RECOIL' && !kills && E.hp / E.maxhp < 0.25) s *= 0.7;
      if (md.effect === 'JUMP_KICK') s *= 0.9;
      if (md.effect === 'DRAIN_HP' && E.hp < E.maxhp) s *= 1.15;
      return s;
    }
    const e = md.effect, statused = !!P.status, stage = k => E.v.st[k] || 0;
    switch (e) {
      case 'SLEEP': return statused || sub ? 1 : 60 * hitChance(E, P, md);
      case 'PARALYZE':
        if (statused || sub || (md.id === 'THUNDER_WAVE' && G.typeMult('ELECTRIC', P.types) === 0)) return 1;
        return (faster ? 22 : 45) * hitChance(E, P, md);
      case 'POISON': return statused || sub || P.types.includes('POISON') ? 1 : (md.id === 'TOXIC' ? 38 : 24) * hitChance(E, P, md);
      case 'CONFUSION': return P.v.confused || sub ? 1 : 26 * hitChance(E, P, md);
      case 'LEECH_SEED': return P.v.seeded || sub || P.types.includes('GRASS') ? 1 : 30 * hitChance(E, P, md);
      case 'HEAL': return E.hp / E.maxhp < 0.45 && foeBest < 0.5 ? 75 : E.hp / E.maxhp < 0.6 ? 20 : 1;
      case 'ATTACK_UP2': case 'SPECIAL_UP2': case 'SPEED_UP2': case 'DEFENSE_UP2':
      case 'ATTACK_UP1': case 'SPECIAL_UP1': case 'DEFENSE_UP1': case 'EVASION_UP1': {
        const k = /ATTACK/.test(e) ? 'atk' : /SPECIAL/.test(e) ? 'spc' : /SPEED/.test(e) ? 'spd' : /DEFENSE/.test(e) ? 'def' : 'eva';
        if (stage(k) >= 2) return 1;
        // a boost only counts when it helps: SPEED when we are slower, ATTACK / SPECIAL when we have moves that use it
        const uses = cat => E.moves.some(m => { const d = D().moves[m.id]; return d && d.power > 1 && PHYSICAL.has(d.type) === (cat === 'atk'); });
        if (k === 'spd' && faster) return 1;
        if ((k === 'atk' || k === 'spc') && !uses(k)) return 1;
        return safe ? (/2$/.test(e) ? 45 : 28) - stage(k) * 10 : 4;
      }
      case 'REFLECT': return !E.v.reflect && safe ? 25 : 3;
      case 'LIGHT_SCREEN': return !E.v.lightScreen && safe ? 25 : 3;
      case 'SUBSTITUTE': return !E.v.sub && E.hp / E.maxhp > 0.5 && safe ? 22 : 1;
      case 'HAZE': { const up = Object.values(P.v.st).reduce((a, n) => a + Math.max(0, n), 0); return up >= 2 ? 15 + up * 8 : 1; }
      case 'MIST': return E.v.mist ? 1 : 6;
      case 'ATTACK_DOWN1': case 'DEFENSE_DOWN1': case 'DEFENSE_DOWN2': case 'SPEED_DOWN1': case 'ACCURACY_DOWN1':
        return P.v.mist || sub ? 1 : safe ? 14 : 6;
      default: return 5; // DISABLE, MIMIC, METRONOME, MIRROR MOVE, TRANSFORM, BIDE, ROAR, SPLASH, FOCUS ENERGY, ...
    }
  }

  // ---------------- items: heal when low, cure a bad status, X items when it is safe (EXPERT)
  function pickItem(b, E, P, lv) {
    const items = b.trainerItems;
    if (!items.length) return null;
    const take = id => { const i = items.indexOf(id); if (i < 0) return null; items.splice(i, 1); return { type: 'item', item: id }; };
    const frac = E.hp / E.maxhp, foeBest = bestHit(P, E), hit = bestDamage(P, E);
    const HEAL = { FULL_RESTORE: 9999, HYPER_POTION: 200, SUPER_POTION: 50, POTION: 20 };
    if (frac < 0.33) { // worth healing only if the healed POKéMON survives the next hit
      for (const id of Object.keys(HEAL)) if (items.includes(id) && Math.min(E.maxhp, E.hp + HEAL[id]) > hit) return take(id);
    }
    if (E.status === 'SLP' || E.status === 'FRZ' || (E.status === 'PAR' && lv >= 3)) { const r = take('FULL_HEAL') || (E.status !== 'PAR' && frac < 0.6 ? take('FULL_RESTORE') : null); if (r) return r; }
    if (lv >= 3 && frac > 0.7 && foeBest < 0.3 && !b._aiXUsed) {
      for (const id of ['X_ATTACK', 'X_SPECIAL', 'X_SPEED', 'X_DEFEND', 'DIRE_HIT', 'GUARD_SPEC']) { const r = take(id); if (r) { b._aiXUsed = true; return r; } }
    }
    return null;
  }

  // ---------------- switching out of a bad matchup (EXPERT, at most twice a battle, never two turns in a row)
  function pickSwitch(b, E, P) {
    if ((b._aiSwitches || 0) >= 2 || b._aiLastSwitch === b.turn - 1) return null;
    if (E.v.trapped > 0 || P.v.trapping) return null;
    const now = matchup(E, P);
    if (now > -0.25 || bestHit(P, E) < 0.45) return null; // only when we are clearly losing this exchange
    let best = null, bestScore = now + 0.35; // a switch costs a free hit, so the newcomer must be much better
    b.e.party.forEach((m, i) => {
      if (i === b.e.idx || m.hp <= 0) return;
      const C = view(b, b.e, m), sc = matchup(C, P) - bestHit(P, C) * 0.5;
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    if (best == null) return null;
    b._aiSwitches = (b._aiSwitches || 0) + 1; b._aiLastSwitch = b.turn;
    return { type: 'switch', index: best };
  }

  // the enemy's whole action for this turn (levels 2 and 3); battle.js handles locked-in moves first
  function act(b, lv, fightOnly) {
    const E = view(b, b.e, b.mon(b.e)), P = view(b, b.p, b.mon(b.p));
    const item = fightOnly ? null : pickItem(b, E, P, lv);
    if (item) return item;
    if (lv >= 3 && !fightOnly) { const sw = pickSwitch(b, E, P); if (sw) return sw; }
    const v = b.e.v;
    const moves = b.moveList(b.e).filter(x => x.pp > 0 && !(v.disabled && v.disabled.move === x.id));
    if (!moves.length) return { type: 'fight', move: 'STRUGGLE' };
    const scored = moves.map(x => ({ x, s: Math.max(1, scoreMove(b, x, E, P, lv)) })).sort((a, c) => c.s - a.s);
    // a knockout that will almost surely land (score 90+: it kills and is 90%+ accurate) is always taken
    if (scored[0].s >= 90) return { type: 'fight', move: scored[0].x.id };
    // EXPERT: the best move 85% of the time, else the runner-up; SMART: weighted by score squared
    if (lv >= 3) return { type: 'fight', move: (scored.length > 1 && Math.random() < 0.15 && scored[1].s > scored[0].s * 0.6 ? scored[1] : scored[0]).x.id };
    const w = scored.map(c => c.s * c.s), tot = w.reduce((a, n) => a + n, 0);
    let r = Math.random() * tot;
    for (let i = 0; i < scored.length; i++) { r -= w[i]; if (r <= 0) return { type: 'fight', move: scored[i].x.id }; }
    return { type: 'fight', move: scored[0].x.id };
  }

  // the POKéMON to send out after a faint (levels 2 and 3): the best matchup against yours
  function next(b) {
    const P = view(b, b.p, b.mon(b.p));
    let best = -1, bestScore = -Infinity;
    b.e.party.forEach((m, i) => {
      if (m.hp <= 0) return;
      const sc = matchup(view(b, b.e, m), P);
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    return best;
  }

  G.trainerAI = {
    level, act, next,
    // OPTION menu: CLASSIC -> SMART -> HARD -> CLASSIC
    toggle: function* () { const O = G.state.options; O.trainerAI = (mode() + 1) % 3; },
    label: () => 'TRAINER AI: ' + MODES[mode()],
  };
})(window.G);
