// Claude-driven NPC dialogue. With OPTION > NPC TALK: CLAUDE, townsfolk who have no story script (no trainer, no
// item, no gym leader, no scripted event) answer with lines written live by Claude instead of their fixed text.
// Their original line goes into the prompt, so hints, directions and prices still come through. Story NPCs keep
// their scripts, so gating and flags work exactly as before.
//
// Two ways to reach the Claude API:
//   1. the site server (tools/serve.py) proxies POST /api/npc when it runs with ANTHROPIC_API_KEY set;
//   2. otherwise the player pastes their own API key; it stays in this browser's localStorage (never in the save).
// Any failure (offline, no key, a refusal, a timeout) falls back to the NPC's classic line.
(function (G) {
  'use strict';
  const browser = typeof window !== 'undefined' && typeof fetch === 'function' && typeof location !== 'undefined' && !window.HEADLESS;
  const KEY_STORE = 'claudered.anthropicKey', MODEL_STORE = 'claudered.npcModel';
  const MODEL = 'claude-opus-5-5';
  const TIMEOUT_MS = 20000, HISTORY_TURNS = 3, MAX_CHARS = 220;

  const SYSTEM = [
    'You write the lines of one non-player character in a pixel-art remake of POKéMON RED (Kanto, 1996).',
    'Reply with only the words this character says out loud: no name tag, no quotes, no stage directions, no markdown, no emoji.',
    'Keep it short: 1 to 3 sentences, at most ' + MAX_CHARS + ' characters. If you need a second text box, put a blank line between the two.',
    'Write in the game\'s style: friendly, simple, plain ASCII except the word POKéMON. Write names and key nouns in CAPS: POKéMON, POKéDEX, POKé BALL, OAK, BROCK, potions and moves.',
    'Stay inside the world of Pokémon Red: no modern technology, no later generations, no talk about being an AI or a game.',
    'Each turn you get the scene and the line this character says in the original game. Keep every useful fact from that line (directions, hints, prices, names, who they are), but say it in fresh words and react to the scene: the time of day, the player\'s badges, their lead POKéMON, and what you said before.',
    'If you talked with the player before, do not repeat yourself: continue the conversation or add a small new detail about your life in this town.',
  ].join('\n');

  const local = {
    get(k) { try { return browser ? window.localStorage.getItem(k) : null; } catch (e) { return null; } },
    set(k, v) { try { if (browser) { if (v) window.localStorage.setItem(k, v); else window.localStorage.removeItem(k); } } catch (e) {} },
  };
  let serverOK = null; // null = not asked yet, then true/false
  const history = {}; // per NPC: [{role, content}], this play session only

  function apiURL(path) {
    const base = ((document.querySelector('meta[name="subscribe-endpoint"]') || {}).content || 'api/subscribe').replace(/subscribe$/, '');
    return new URL(base + path, location.href);
  }
  async function probeServer() {
    if (serverOK !== null) return serverOK;
    if (!browser || location.protocol === 'file:') return (serverOK = false);
    try { const r = await fetch(apiURL('npc'), { cache: 'no-store' }); const j = await r.json(); serverOK = !!(j && j.ok && j.enabled); }
    catch (e) { serverOK = false; }
    return serverOK;
  }

  // ---------------- the request ----------------
  const words = name => String(name || '').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/_/g, ' ');
  function scene(a) {
    const st = G.state, lead = st.party && st.party[0];
    const td = G.timeOfDay ? G.timeOfDay() : null;
    const time = !td || G.state.options.dayNight === false ? 'day' : td.night > 0.5 ? 'night' : td.dusk > 0.3 ? 'evening' : 'day';
    const original = G.fmt(G.textFor(a.obj && a.obj.textLabel)).replace(/\f/g, ' ');
    const fact = G.psych ? G.psych.factFor(a) : null; // OPTION > PSYCH FACTS (src/game/psychfacts.js)
    return [
      'Place: ' + words(G.ow.map.name),
      'You look like: ' + words(a.sprite || (a.obj && a.obj.sprite) || 'townsperson').toLowerCase(),
      'Time: ' + time,
      'Player: ' + st.name + ', ' + st.badges.length + ' badge' + (st.badges.length === 1 ? '' : 's') + (st.badges.length ? ' (' + st.badges.join(', ') + ')' : '') +
        (lead ? ', lead POKéMON ' + lead.name + (lead.nick ? ' (a ' + lead.sp.name + ')' : '') + ' at level ' + lead.level : ', no POKéMON yet'),
      'Player\'s rival: ' + st.rival,
      'Your line in the original game: ' + (original === '...' ? '(none)' : original),
    ].concat(fact ? ['You like psychology. After your usual point, share this fact in your own words, in a second text box (a blank line first), in one or two short sentences: ' + fact[1].replace(/\f/g, ' ')] : [],
      ['The player talks to you. What do you say?']).join('\n');
  }
  // req = { system, messages, format?: JSON schema for structured output, effort?: 'low' | 'medium' }
  async function ask(req, signal) {
    const body = { system: req.system, messages: req.messages };
    if (req.format) body.format = req.format;
    if (req.effort) body.effort = req.effort;
    if (await probeServer()) {
      const r = await fetch(apiURL('npc'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'server error');
      return j.text;
    }
    const key = local.get(KEY_STORE);
    if (!key) throw new Error('no API key');
    const output_config = { effort: req.effort === 'medium' ? 'medium' : 'low' };
    if (req.format) output_config.format = { type: 'json_schema', schema: req.format };
    // Raw HTTP: the game has no build step or npm dependencies, so it calls the Messages API with fetch
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: {
        'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: local.get(MODEL_STORE) || MODEL, max_tokens: 8192, system: req.system, messages: req.messages,
        output_config, fallbacks: 'default',
      }),
    });
    const j = await r.json();
    if (r.status === 401) local.set(KEY_STORE, null); // a bad key: ask again next time a Claude option is turned on
    if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
    return replyText(j);
  }
  // only the text blocks, and nothing at all on a refusal (check stop_reason before reading content)
  function replyText(msg) {
    if (!msg || msg.stop_reason === 'refusal') throw new Error('refused');
    if (msg.stop_reason === 'max_tokens') throw new Error('cut off');
    const t = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!t) throw new Error('empty reply');
    return t;
  }
  // turn Claude's reply into game text: blank lines become new text boxes, odd characters go, long replies are cut
  function clean(t) {
    t = String(t).replace(/\r/g, '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/[*_`#]/g, '')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
    t = t.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 3).join('\f');
    const cap = MAX_CHARS * 2; // room for a second box (a PSYCH FACT)
    if (t.length > cap) t = t.slice(0, cap).replace(/[^.!?]*$/, '') || t.slice(0, cap);
    return t;
  }

  // ---------------- shared by the Claude features ----------------
  // Run one request from a script, with a "..." box on screen while it is on its way. Returns the reply text or null.
  function* request(req, timeoutMs) {
    const job = { done: false, text: null };
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), timeoutMs || TIMEOUT_MS);
    ask(req, ctl && ctl.signal).then(t => { job.text = t; }, e => { console.warn('Claude:', e.message || e); })
      .finally(() => { clearTimeout(timer); job.done = true; });
    const box = new G.ui.StaticBox('...');
    G.engine.push(box);
    while (!job.done) yield;
    G.engine.pop(box);
    return job.text;
  }
  // Before an option that needs Claude is turned on: check the server, or ask for the player's own key
  function* ensureAccess(feature) {
    if (!browser) { yield* G.say(feature + ' needs the game running in a browser.'); return false; }
    const job = { done: false, ok: false };
    probeServer().then(ok => { job.ok = ok; job.done = true; });
    while (!job.done) yield;
    if (!job.ok && !local.get(KEY_STORE)) {
      yield* G.say('This server has no Claude API key.\fPaste your own Anthropic API key to use ' + feature + '.\fIt stays in this browser only and is not saved with your game.');
      const k = (window.prompt('Anthropic API key (starts with sk-ant-):') || '').trim();
      if (!/^sk-ant-/.test(k)) { yield* G.say('No key entered. ' + feature + ' stays off.'); return false; }
      local.set(KEY_STORE, k);
    }
    return true;
  }
  G.claude = { available: () => browser, request, ensureAccess };

  // ---------------- in game ----------------
  const npcKey = a => G.ow.map.name + ':' + (a.obj && a.obj.id);
  G.npcAI = {
    // only plain townsfolk: the caller (G.talkTo) has already handled scripts, trainers and items
    active: () => browser && !!(G.state && G.state.options && G.state.options.npcClaude),
    talk: function* (a) {
      const k = npcKey(a), past = history[k] || [];
      const messages = past.concat([{ role: 'user', content: scene(a) }]);
      const reply = yield* request({ system: SYSTEM, messages });
      const text = reply && clean(reply);
      if (!text) { yield* G.say(G.textFor(a.obj && a.obj.textLabel)); return; }
      history[k] = messages.concat([{ role: 'assistant', content: text.replace(/\f/g, '\n\n') }]).slice(-HISTORY_TURNS * 2);
      yield* G.say(text);
    },
    // OPTION menu toggle
    toggle: function* () {
      const O = G.state.options;
      if (O.npcClaude) { O.npcClaude = false; return; }
      if (yield* ensureAccess('Claude NPC talk')) O.npcClaude = true;
    },
  };
})(window.G);
