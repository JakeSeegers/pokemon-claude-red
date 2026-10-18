// Dice: d4, d6, d20 and the like, seeded from the save, as in a tabletop game (or Python's random.randint(1, n)).
// Each save gets its own seed (G.state.diceSeed) and counts the rolls it has made (G.state.diceN), so the next roll
// is fixed by the save: reloading cannot reroll a case. STUDY CASES (src/game/dxcases.js) use it to pick the
// diagnosis down the DSM tree and its twists, and the case notes list every roll.
(function (G) {
  'use strict';
  // a small, well-mixed generator: a hash of seed + roll number, then one mulberry32 step
  function unit(seed, n) {
    let h = 1779033703 ^ n;
    for (const ch of String(seed) + ':' + n) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353), h = h << 13 | h >>> 19;
    let t = (h >>> 0) + 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const S = () => {
    const st = G.state || (G.state = {});
    if (!st.diceSeed) st.diceSeed = Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
    st.diceN = st.diceN || 0;
    return st;
  };
  // roll(sides, label, log): 1..sides. With a log array, the roll is recorded as { sides, n, label, result }; set
  // .result afterwards to say what the roll picked.
  function roll(sides, label, log) {
    sides = Math.max(1, sides | 0);
    const st = S(), n = 1 + Math.floor(unit(st.diceSeed, st.diceN++) * sides);
    const r = { sides, n, label: label || '', result: '' };
    if (log && sides > 1) log.push(r); // a 1-sided die decides nothing, so it isn't listed
    return r;
  }
  // pick(list, label, log, name): one item from a list with a die the size of the list
  function pick(list, label, log, name) {
    const r = roll(list.length, label, log), item = list[r.n - 1];
    r.result = name ? name(item) : String(item);
    return item;
  }
  // "2d6" style: the sum of several dice
  function sum(spec, label, log) {
    const m = /^(\d*)d(\d+)$/.exec(String(spec).trim());
    if (!m) return 0;
    let t = 0;
    for (let i = 0; i < (+m[1] || 1); i++) t += roll(+m[2], label, null).n;
    if (log) log.push({ sides: spec, n: t, label: label || '', result: '' });
    return t;
  }
  // one line per roll for the case notes, such as "d19 = 14  Chapter: Sleep-Wake Disorders"
  const line = r => (typeof r.sides === 'number' ? 'd' + r.sides : r.sides) + ' = ' + r.n + '  ' + r.label + (r.result ? ': ' + r.result : '');
  G.dice = { roll, pick, sum, line };
})(window.G);
