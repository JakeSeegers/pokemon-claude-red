// PSYCH FACTS: intro-psychology flavor in the world (facts: src/data/psychfacts.js).
//   - About 1 in 3 plain townsfolk (always the same ones) add a fact after their usual line. With NPC TALK: CLAUDE,
//     Claude works the fact into what they say instead (src/game/claudenpc.js).
//   - TRAINER TIPS and notice signs carry a PSYCH TIP under their own text.
//   - Bookshelves ("Crammed full of POKéMON books!") let you pull out a psychology book.
// Facts come in a shuffled order kept in the save, so you see every one before any repeats.
// OPTION > PSYCH FACTS: ON (default) or OFF.
(function (G) {
  'use strict';
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const on = () => !!(G.PSYCH_FACTS && G.state && G.state.options && G.state.options.psychFacts !== false);
  // the next fact in this save's shuffled order: [topic, text]
  function next() {
    const F = G.PSYCH_FACTS, st = G.state;
    if (!Array.isArray(st.psychOrder) || st.psychOrder.length !== F.length) {
      st.psychOrder = F.map((f, i) => i);
      for (let i = F.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [st.psychOrder[i], st.psychOrder[j]] = [st.psychOrder[j], st.psychOrder[i]]; }
      st.psychNext = 0;
    }
    const f = F[st.psychOrder[(st.psychNext || 0) % F.length]];
    st.psychNext = ((st.psychNext || 0) + 1) % F.length;
    return f;
  }
  // a third of the plain townsfolk are the ones who like to share psychology
  const sharer = a => !!(a && a.obj && a.obj.id && !(G.CAST[a.sprite] || {}).object && hash(G.ow.map.name + ':' + a.obj.id + ':psych') % 3 === 0);
  const TIP_SIGN = /TrainerTips|Notice/;

  G.psych = {
    // after a plain townsperson's classic line (G.talkTo, src/game/scripts.js)
    afterTalk: function* (a) {
      if (!on() || !sharer(a)) return;
      yield* G.say('By the way... did you know this?\f' + next()[1]);
    },
    // for NPC TALK: CLAUDE: a fact for Claude to work into the line, or null
    factFor: a => (on() && sharer(a) ? next() : null),
    // under a TRAINER TIPS or notice sign (G.readSign)
    afterSign: function* (sign) {
      if (!on() || !TIP_SIGN.test(sign.textLabel || '')) return;
      const f = next();
      yield* G.say('Someone added a note below it.\fPSYCH TIP (' + f[0].toUpperCase() + ')\f' + f[1]);
    },
    // a bookshelf (hidden event PrintBookcaseText, src/game/story.js)
    book: function* () {
      if (!on()) return;
      const f = next();
      yield* G.say('One book is about people, not POKéMON: PSYCHOLOGY, chapter "' + f[0].toUpperCase() + '".\f' + f[1]);
    },
    toggle: function* () { const O = G.state.options; O.psychFacts = O.psychFacts === false; },
    label: () => 'PSYCH FACTS: ' + (G.state.options.psychFacts === false ? 'OFF' : 'ON'),
  };
})(window.G);
