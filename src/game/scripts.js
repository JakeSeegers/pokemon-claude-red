// Interaction glue: talking to NPCs, reading signs, picking up items.
(function (G) {
  'use strict';
  G.TEXT = G.TEXT || {};
  G.textFor = function (label) {
    if (!label) return '...';
    return G.TEXT[label] || G.TEXT[label.replace(/^_/, '')] || '...';
  };
  G.talkTo = function* (a) {
    const ow = G.ow, p = ow.player;
    if (a.obj && a.obj.item) { yield* G.pickupItem(a); return; }
    if (!(G.CAST[a.sprite] || {}).object) a.dir = G.OPP[p.dir];
    const custom = G.scripts && G.scripts.talk && G.scripts.talk(ow.map, a);
    if (custom) { yield* custom; return; }
    if (a.trainer && a.obj.th && G.trainerTalk) { yield* G.trainerTalk(a); return; }
    if (G.npcAI && G.npcAI.active()) { yield* G.npcAI.talk(a); return; } // OPTION > NPC TALK: CLAUDE (src/game/claudenpc.js)
    yield* G.say(G.textFor(a.obj && a.obj.textLabel));
  };
  G.readSign = function* (sign) {
    const custom = G.scripts && G.scripts.sign && G.scripts.sign(G.ow.map, sign);
    if (custom) { yield* custom; return; }
    yield* G.say(G.textFor(sign.textLabel));
  };
  G.pickupItem = function* (a) {
    const item = a.obj.item, found = G.state.name + ' found ' + (G.itemName ? G.itemName(item) : item) + '!';
    // bag full: the ball stays where it is, as in Red
    if (G.bag && !G.bag.add(item, 1)) { yield* G.say(found + '\f' + G.fmt(G.textFor('NoMoreRoomForItemText'))); return; }
    G.state.flags['GOT_' + a.key] = true;
    a.hidden = true;
    G.ow.actors.splice(G.ow.actors.indexOf(a), 1);
    if (G.sfx) G.sfx('item');
    yield* G.say(found);
  };
})(window.G);
