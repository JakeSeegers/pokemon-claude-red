// Title screen, new game (Oak's speech) and continue.
(function (G) {
  'use strict';
  const { Surface, hex, mix, shade, bayer } = G.gfx;
  const P = G.PAL, F = G.font;
  const T = (l, f) => G.TEXT[l] || f;
  const TITLE_MONS = ['CHARMANDER', 'SQUIRTLE', 'BULBASAUR', 'WEEDLE', 'NIDORAN_M', 'SCYTHER', 'PIKACHU', 'CLEFAIRY', 'RHYDON', 'ABRA', 'GASTLY', 'DITTO', 'PIDGEOTTO', 'ONIX', 'PONYTA', 'MAGIKARP'];

  // Big logo text: 5x7 glyphs scaled 3x with gradient fill and double outline
  function logo(s, str, cx, y, scale, fillTop, fillBot, out1, out2) {
    const w = F.measure(str) * scale, x0 = Math.round(cx - w / 2);
    const tmp = new Surface(w + 8, 10 * scale + 8);
    F.draw(tmp, str, 0, 0, 0xffffffff);
    const big = new Surface(tmp.w * scale, tmp.h * scale);
    for (let yy = 0; yy < big.h; yy++) for (let xx = 0; xx < big.w; xx++) {
      const c = tmp.data[Math.floor(yy / scale) * tmp.w + Math.floor(xx / scale)];
      if (c >>> 24) big.data[yy * big.w + xx] = mix(hex(fillTop), hex(fillBot), Math.min(1, (yy % (8 * scale)) / (7 * scale)));
    }
    const o1 = big.clone(); o1.outline(hex(out1), true); o1.outline(hex(out1), true);
    const o2 = o1.clone(); o2.outline(hex(out2), true);
    s.blit(o2, x0 - 2, y + 2);
    s.blit(o2, x0, y);
    s.blit(o1, x0, y);
    s.blit(big, x0, y);
  }
  G.logoText = logo;

  class Title {
    constructor() { this.opaque = true; this.t = 0; this.done = false; this.mon = 0; this.monX = 0; }
    update(f) { this.t++; if (f && this.t > 30 && (G.input.pressed.start || G.input.pressed.a)) this.done = true; }
    draw(s) {
      const t = this.t;
      // sky
      for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
        const k = y / 180;
        const c = mix(hex('#1a2a6a'), hex('#e87858'), Math.min(1, Math.max(0, (k - 0.2) * 1.3)));
        s.data[y * 320 + x] = (bayer(x, y) < ((k * 12) % 1)) ? mix(c, hex('#f8b068'), 0.08) : c;
      }
      // stars
      for (let i = 0; i < 40; i++) { const x = (i * 97) % 320, y = (i * 53) % 70; if ((t + i * 7) % 90 > 10) s.pset(x, y, hex('#f0f0ff')); }
      // mountains
      for (let x = 0; x < 320; x++) {
        const h1 = 120 - 30 * Math.abs(Math.sin(x * 0.012 + 1)) - 10 * Math.sin(x * 0.05);
        const h2 = 138 - 18 * Math.abs(Math.sin(x * 0.02 + 3)) - 6 * Math.sin(x * 0.09);
        for (let y = Math.floor(h1); y < 180; y++) s.pset(x, y, y < h1 + 2 ? hex('#6a4a8a') : hex('#3a2a5a'));
        for (let y = Math.floor(h2); y < 180; y++) s.pset(x, y, y < h2 + 2 ? hex('#4a6a5a') : hex('#1e3a34'));
      }
      // ground glow
      for (let y = 150; y < 180; y++) for (let x = 0; x < 320; x++) s.pset(x, y, (x + y) % 7 === 0 ? hex('#2a4a3a') : hex('#1a2e28'));
      // logo
      const bob = Math.round(Math.sin(t / 30) * 2);
      const L = G.titleLogo();
      s.blit(L.big, 160 - (L.big.w >> 1), 12 + bob);
      s.blit(L.red, 160 - (L.red.w >> 1), 44 + bob);
      // Charizard
      const cz = G.pokeSprite('CHARIZARD', 'front', 128);
      s.blit(cz, 188, 60 + Math.round(Math.sin(t / 25) * 2));
      // Red + cycling pokemon
      const red = G.castPortrait('red'); // native 64x64 portrait (bottom-centre anchored)
      s.blit(red, 54 - (red.w >> 1), 168 - red.h);
      const cyc = Math.floor(t / 180) % TITLE_MONS.length, phase = t % 180;
      const slide = phase < 16 ? 1 - phase / 16 : phase > 164 ? (phase - 164) / 16 : 0;
      const mon = G.pokeSprite(TITLE_MONS[cyc], 'front');
      s.blit(mon, 86 + Math.round(slide * -120), 108);
      if (!G.hideHints && Math.floor(t / 30) % 2 === 0) { const tx = 'PRESS START'; F.drawOutlined(s, tx, 160 - F.measure(tx) / 2, 164, hex('#fff8e0'), hex('#301818')); }
      F.drawSmall(s, 'VIBE CODED WITH CLAUDE OPUS 5.5', 4, 174, hex('#e8a080'), hex('#101a18'));
      const help = G.touchUI ? 'TAP THE SCREEN OR USE THE BUTTONS' : 'ARROWS OR CLICK  Z:A  X:B  ENTER:START';
      if (!G.hideHints) F.drawSmall(s, help, 316 - F.measureSmall(help), 174, hex('#8090a8'), hex('#101a18')); // no control hints on camera
    }
  }

  class OakIntro {
    constructor() { this.opaque = true; this.t = 0; this.who = 'oak'; this.x = 160; this.alpha = 1; this.shrink = 1; }
    update() { this.t++; }
    draw(s) {
      for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
        const d = Math.hypot(x - 160, (y - 70) * 1.4);
        s.data[y * 320 + x] = mix(hex('#f8f4e8'), hex('#c8d8e8'), Math.min(1, d / 220));
      }
      s.ellipse(160, 118, 56, 10, hex('#b8c8d8')); s.ellipse(160, 117, 52, 8, hex('#d0dce8'));
      let pic;
      if (this.who === 'oak') pic = G.trainerPic('PROF_OAK');
      else if (this.who === 'red') pic = G.castPortrait('red');
      else if (this.who === 'blue') pic = G.trainerPic('RIVAL1');
      else if (this.who === 'mon') pic = G.pokeSprite('NIDORINO', 'front');
      if (pic && this.alpha > 0) {
        const w = Math.round(pic.w * this.shrink), h = Math.round(pic.h * this.shrink);
        s.blitScaled(pic, Math.round(this.x - w / 2), 120 - h, w, h, { alpha: this.alpha });
      }
    }
  }

  G.titleScreen = function () {
    G.spawnScript((function* () {
      // the title shows the saved trainer's look
      const saved = G.hasSave() && G.loadSave();
      if (G.applyLook) G.applyLook(saved && saved.look);
      const title = new Title();
      G.music && G.music('title');
      yield* G.engine.run(title);
      G.sfx && G.sfx('select');
      let opts = [], r;
      G.engine.push(title); title.done = false;
      for (;;) {
        opts = (G.hasSave() ? ['CONTINUE'] : []).concat(['NEW GAME', "WHO'S THAT POKéMON?"], G.cloudMenu ? ['CLOUD SAVE'] : [], ['SAVE TRANSFER', 'OPTION']);
        r = yield* G.choose(opts, { x: 6, y: 6, w: 150, noCancel: true });
        if (opts[r] === 'CLOUD SAVE') { yield* G.cloudMenu(); continue; }
        if (opts[r] === 'SAVE TRANSFER') { yield* G.saveTransferMenu(); continue; }
        if (opts[r] === 'OPTION') { G.state = G.state || G.newState(); yield* G.optionsMenu(); G.titleOptions = Object.assign({}, G.state.options); continue; }
        if (opts[r] === "WHO'S THAT POKéMON?") { yield* G.whosThatPokemon(); G.music && G.music('title'); continue; }
        break;
      }
      yield* G.fadeOut(20);
      G.engine.pop(title);
      if (opts[r] === 'CONTINUE') {
        const st = G.loadSave();
        if (G.titleOptions) Object.assign(st.options, G.titleOptions); // what was just set on the title screen wins
        G.startGame(st);
        G.textSpeed = st.options.textSpeed;
        yield* G.fadeIn(20);
        return;
      }
      yield* G.newGameIntro();
    })(), 'title');
  };

  G.newGameIntro = function* () {
    G.state = G.newState();
    if (G.titleOptions) Object.assign(G.state.options, G.titleOptions); // keep what was set with OPTION on the title screen
    if (G.applyLook) G.applyLook(G.state.look);
    G.state.trainerId = Math.floor(Math.random() * 65536);
    const sc = new OakIntro();
    G.engine.push(sc);
    G.music && G.music('oak_intro');
    yield* G.fadeIn(20);
    yield* G.say(T('OakSpeechText1', 'Hello there! Welcome to the world of POKéMON!\fMy name is OAK! People call me the POKéMON PROF!'));
    // Nidorino appears
    for (let i = 10; i >= 0; i--) { sc.alpha = i / 10; yield; }
    sc.who = 'mon'; sc.x = 160;
    for (let i = 0; i <= 10; i++) { sc.alpha = i / 10; yield; }
    G.cry && G.cry('NIDORINO');
    yield* G.say(T('OakSpeechText2A', 'This world is inhabited by creatures called POKéMON!'));
    yield* G.say(T('OakSpeechText2B', 'For some people, POKéMON are pets. Others use them for fights.\fMyself...\fI study POKéMON as a profession.'));
    for (let i = 10; i >= 0; i--) { sc.alpha = i / 10; yield; }
    sc.who = 'red'; sc.x = 200;
    for (let i = 0; i <= 10; i++) { sc.alpha = i / 10; sc.x = 200 - i * 4; yield; }
    yield* G.say(T('IntroducePlayerText', 'First, what is your name?'), { noWait: true });
    let r = yield* G.choose(['NEW NAME', 'RED', 'ASH', 'JACK'], { x: 6, y: 6, w: 100, noCancel: true });
    G.state.name = r === 0 ? (yield* G.namingScreen('YOUR NAME?', 'RED', 7)) : ['', 'RED', 'ASH', 'JACK'][r];
    // typed names keep the naming screen's byte buffer; list picks are rebuilt from the ROM list (src/game/glitches.js)
    if (r === 0 && G.lastNameBuf) { G.state.nameBuf = G.lastNameBuf; G.state.nameBufFor = G.state.name; }
    yield* G.say(T('YourNameIsText', 'Right! So your name is {PLAYER}!'));
    // character customizer: the player picks their look before the adventure starts
    G.state.look = yield* G.customizeLook(G.state.look);
    for (let i = 10; i >= 0; i--) { sc.alpha = i / 10; yield; }
    sc.who = 'blue'; sc.x = 160;
    for (let i = 0; i <= 10; i++) { sc.alpha = i / 10; yield; }
    yield* G.say(T('IntroduceRivalText', "This is my grandson. He's been your rival since you were a baby.\f...Erm, what is his name again?"), { noWait: true });
    r = yield* G.choose(['NEW NAME', 'BLUE', 'GARY', 'JOHN'], { x: 6, y: 6, w: 100, noCancel: true });
    G.state.rival = r === 0 ? (yield* G.namingScreen("RIVAL's NAME?", 'BLUE', 7)) : ['', 'BLUE', 'GARY', 'JOHN'][r];
    yield* G.say(T('HisNameIsText', "That's right! I remember now! His name is {RIVAL}!"));
    for (let i = 10; i >= 0; i--) { sc.alpha = i / 10; yield; }
    sc.who = 'red'; sc.x = 160;
    for (let i = 0; i <= 10; i++) { sc.alpha = i / 10; yield; }
    yield* G.say(T('OakSpeechText3', "{PLAYER}!\fYour very own POKéMON legend is about to unfold!\fA world of dreams and adventures with POKéMON awaits! Let's go!"));
    G.sfx && G.sfx('shrink');
    for (let i = 0; i < 30; i++) { sc.shrink = 1 - i / 34; yield; }
    yield* G.fadeOut(30, P.white);
    G.engine.pop(sc);
    Object.assign(G.state, { map: 'RedsHouse2F', x: 3, y: 6, dir: 'up' });
    G.startGame(G.state);
    yield* G.fadeIn(30);
  };
})(window.G);
