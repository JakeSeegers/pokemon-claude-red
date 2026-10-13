<p align="center">
  <img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/title.png" width="760" alt="Pokémon Claude Red title screen">
</p>

<h1 align="center">Pokémon Claude Red</h1>

<p align="center">
  <b>Pokémon Red, rebuilt from raw pixels by Claude Opus 5.5.</b><br>
  Every sprite, tile, building, battle effect and song is drawn or played by code.<br>
  There is not a single image file in the game.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/image_files-0-e08a5f?style=flat-square" alt="0 image files">
  <img src="https://img.shields.io/badge/built_with-Claude_Opus_5.5-d97757?style=flat-square" alt="Built with Claude Opus 5.5">
  <img src="https://img.shields.io/badge/dependencies-none-5fd3b0?style=flat-square" alt="No dependencies">
  <img src="https://img.shields.io/badge/runs_in-any_browser-4a90d8?style=flat-square" alt="Runs in any browser">
  <img src="https://img.shields.io/badge/phones-Game_Boy_controls-8a83a8?style=flat-square" alt="Phone controls">
</p>

<p align="center"><a href="https://claudered.dev"><b>▶ Play it now at claudered.dev</b></a></p>

---

## The prompt

The whole project started from one message typed into [Claude Code](https://claude.com/claude-code):

> using only pixels directly remake a beautiful pokemon red remake but with better graphics, environments and vfx. visualise everything perfectly as pixel art using raw pixels. absolute pixel art perfection. keep the story exactly as pokemon red (research on web for all dialogue etc)

Everything in this repository grew from that sentence, followed by a few days of playing it and asking for fixes.

## Screenshots

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/pallet.png" alt="Pallet Town"></td>
    <td><img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/battle-flamethrower.png" alt="Charizard uses Flamethrower"></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/cerulean.png" alt="Cerulean City"></td>
    <td><img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/battle-thunderbolt.png" alt="Pikachu uses Thunderbolt"></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/celadon-night.png" alt="Celadon City at night"></td>
    <td><img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/missingno.png" alt="A wild MISSINGNO. appeared"></td>
  </tr>
</table>

<p align="center">
  <img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/pokemon-151.png" width="760" alt="All 151 Pokémon, drawn from shapes">
  <br><sub>All 151 Pokémon. Each one is a list of ellipses, polygons and curves that the game rasterises, shades and outlines at runtime.</sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/phone-portrait.png" height="420" alt="Game Boy controls on a phone">
  &nbsp;
  <img src="https://raw.githubusercontent.com/levy-street/pokemon-claude-red/media/screens/phone-landscape.png" height="195" alt="GBA-style controls in landscape">
  <br><sub>On phones: Game Boy layout when held upright, GBA layout when turned sideways.</sub>
</p>

<sub>Screenshots are rendered by the game itself and live on the <a href="https://github.com/levy-street/pokemon-claude-red/tree/media"><code>media</code></a> branch, so <code>main</code> stays 100% code.</sub>

## Play

Play it in your browser at **[claudered.dev](https://claudered.dev)**, on a computer or a phone.

To run it yourself, there's no install and no build step. Clone the repo and open `index.html` in a browser.

```sh
git clone https://github.com/levy-street/pokemon-claude-red.git
cd pokemon-claude-red
open index.html            # or double-click it
```

To run the full site (email sign-up, accounts with cloud saves, the hit counter), serve it with the bundled
server. It needs only Python 3:

```sh
node tools/build_dist.js      # bundles index.html + src/ into dist/
python3 tools/serve.py        # http://localhost:8784
```

### Controls

| | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move / navigate | Arrow keys or WASD | D-pad, or tap a tile to walk there | D-pad / left stick |
| A: talk, confirm | Z, J or Space | A, or tap a person, sign or menu item | A |
| B: cancel, hold to run | X, K, Backspace or Esc | B | B |
| START: menu | Enter | START | Start |
| SELECT | Shift or C | SELECT | Select |

On a computer, the mouse also works: click to walk or pick menu entries, right-click for B or the START menu, and scroll lists with the wheel.
Progress saves to the browser. An optional free account keeps a copy on the server, so the game survives in-app browsers that wipe storage and can move between devices.

## What's in it

- **The complete Kanto story**: all 224 maps, every trainer, the eight gyms, Team Rocket, Silph Co., the Elite Four, the
  Champion and Cerulean Cave, with Red's event order and gating. All ~2,500 lines of dialogue follow the original
  beat for beat, rewritten in new words.
- **Every pixel is code.**
  - The game draws into a 320×180 framebuffer (`Uint32Array`), then scales it up with crisp nearest-neighbour pixels.
  - Each map cell has a semantic label ("tall grass", "roof", "bookshelf"), and a procedural painter draws it with shading and texture.
  - Buildings are painted as whole objects with roofs, windows, doors and shadows.
  - There's a day/night cycle with lit windows, fireflies and flickering torches.
  - Every one of the 165 moves has its own animation.
- **151 Pokémon from shapes.** A small drawing language (ellipses, polygons, spots, stripes, eyes) is rasterised into
  outlined, shaded pixel art, and back sprites and party icons are derived from the same description.
- **The original music, re-voiced.** The note data of all 52 songs is converted from the disassembly. A sequencer that
  keeps the Game Boy's exact frame timing plays it through new Web Audio instruments: chorused pulse leads, a wave
  bass with a sub layer, and noise drums with body.
- **A character customiser**: hair, hats, skin, clothes and bag colours, carried through every sprite and portrait.
- **Social Zone**, entered through any Pokémon Center's Cable Club:
  - a live lounge: everyone online walks around the same room, with name tags, chat bubbles and a list of who's in;
  - real-time link battles and trades: talk to anyone to challenge them, or join the random-match queue;
  - a level-50 Battle Tower;
  - battles and trades with friends through shareable links, and a two-player versus mode on one screen.
- **Who's That Pokémon?** A daily and endless silhouette quiz.
- **Share cards**: every badge, capture, evolution and Hall of Fame entry can become a pixel-art card or a link.
- **Classic glitches, recreated from how the original code works:**
  - [MissingNo.](#missingno) with its +128 item quantity and Hall of Fame corruption;
  - the [Mew trick](#the-mew-trick).
- **Easter eggs**: the world has opinions about AI. Talk to everyone.

### Link battles

A live link battle runs in both players' browsers at once. Each game shows its own team at the bottom and sends only
its picks (a move, a switch, a replacement) through the server. Both games roll from the same random seed, so they
work out identical turns. Each turn the host also sends a checksum and a snapshot of the battle, and if the other game
ever drifts it takes the host's numbers. `node tools/pvpfuzz.js` battles two copies of the game against each other
to check they stay in step.

### Claude NPC talk

Townsfolk can speak with lines that Claude writes live. Open START > OPTION and set **NPC TALK: CLAUDE**.

- Only plain NPCs change: people with no story script, no trainer battle and no item. Story scenes, gyms, marts,
  nurses and trainers keep their original scripts, so the story and its gates work as before.
- Claude gets the NPC's original line, the place, the time of day, your badges and your lead POKéMON. The NPC keeps
  every hint from the original line and remembers the last few things it said to you.
- If the request fails, the NPC says its classic line.

There are two ways to connect:

1. **Server key.** Run the site with `ANTHROPIC_API_KEY=<key> python3 tools/serve.py`. The server sends the requests
   for all players, so your key pays for them. `CLAUDE_NPC_MODEL` sets the model (default `claude-haiku-5-5`).
   `NPC_PER_HOUR` sets the limit for each address (default 120).
2. **Player key.** If the server has no key (or you opened `index.html` directly), the game asks for your own
   Anthropic API key when you turn the option on. The key stays in your browser's local storage. It is not put in
   your save file.

**Cost.** With your own key, **OPTION > CLAUDE MODEL** picks HAIKU (the default, about 40 times cheaper per token)
or OPUS (richer patients and replies). The line shows while NPC TALK or STUDY CASES is on. The choice stays in this
browser, not in the save. Every request also uses prompt caching: the fixed instructions and the conversation so far
are cached, so each new study-case turn pays full price only for the newest message.

The code is in `src/game/claudenpc.js` and the `/api/npc` handler in `tools/serve.py`.

### Psych facts

Kanto also teaches some intro psychology. There are 52 short facts in `src/data/psychfacts.js`, written in our own
words with a light POKéMON spin. They cover research methods, the brain, sleep, perception, learning, memory,
thinking, emotion, development, personality, social psychology, stress and mental health. They show up in three
places:
- About 1 in 3 plain townsfolk (always the same ones) add a fact after their usual line. With NPC TALK: CLAUDE,
  Claude works the fact into what they say.
- TRAINER TIPS and notice signs have a PSYCH TIP note under them.
- Bookshelves let you pull out a psychology book.

The facts come in a shuffled order saved with your game, so you see every one before any repeats. Turn them off
with START > OPTION > PSYCH FACTS.

### Study cases

(POKéMON CENTERs now charge ¥1000 a heal: Kanto has adopted Western medicine. Mom still heals for free, and so do
the townsfolk you help. A blackout still halves your money, then bills ¥1000 for the emergency
care. If you can't pay, your POKéMON come back at half HP and you get one curse.)

Trainers and townsfolk can give you a practice case in differential diagnosis. In these cases your character is an adult
psychology student traveling Kanto as a trainer. People open up because they've heard you study psychology, and
children talk with a parent or caregiver nearby. Open START > OPTION and set
**STUDY CASES** to SOME (about one trainer in three, always the same ones) or ALL. It uses the same Claude connection
as NPC talk.

1. The game picks a target diagnosis and a rule-out pathway of 3 to 5 differentials. It picks from 92 tables
   (142 target diagnoses): the study tables in `src/data/dxcases.js`, plus the rest of the DSM-5-TR in
   `src/data/dxcases_more.js`. The tables in the second file are drafts until they are checked against the book:
   see `docs/dxcases-review.md`.
   A fresh case picks a DSM chapter first, then a disorder in it, so chapters with many tables (Sleep-Wake,
   Personality) come up no more often than the others.
2. Claude plays the trainer as a fictional patient. The patient has real symptoms that each differential shares
   with the target, so every rule-out looks possible at first. Each turn you pick one of four questions:
   Only one of the four is a good question, and the others are traps that sound just as kind and clinical. The
   difference is in what each question would find out, not in how it sounds, and the order changes every turn.
   - The good question gives new facts, and often a "yes".
   - One trap is always a **twin** of the good question: the same topic and wording, but it asks for something you
     already know or that can't decide anything ("Any change in your sleep?" when the patient already said they
     can't sleep, next to "Any change in your weight or heartbeat?"). You can't pick by topic alone.
   - **Low-yield** traps check something you already know, an area already ruled out, a detail that can't change
     the diagnosis, or a disorder that isn't on this case. They cost no PATIENCE, only one of your 8 turns.
   - **Leading** traps suggest the answer or a cause ("Has work been piling up on you lately?"). **Judgmental**
     traps give advice or reassurance too early. Both use up **PATIENCE** (3 points), as do the funny POKéMON question and hostile questions.
   - The funny POKéMON question shows up only some turns: about 1 in 2 at CASE LEVEL 1, 1 in 3 at LEVEL 2 and
     1 in 4 at LEVEL 3.
   - Questions that build rapport after a hard moment give a point back, but only up to 2: lost PATIENCE is hard
     to win back.
   - There is no "ready to diagnose" line. Press B to stop asking (the game asks you to confirm), or the
     interview ends after 8 turns or when PATIENCE runs out.
   - **Timing matters.** Questions on sensitive topics (substances, self-harm, trauma, money, family conflict) only
     work once the patient trusts you: after a rapport question, or after two good questions. Asked too early, they
     get a guarded answer and cost PATIENCE. Asked at the right time, they are free and can find a clue.

   Cases get harder with your badges:

   | CASE LEVEL | Badges | What changes |
   |---|---|---|
   | 1 | 0–2 | 3 rule-outs |
   | 2 | 3–5 | 3–4 rule-outs, plus a red herring: symptoms of another disorder that something else explains. **No verdicts during the interview** (no "Good question", no "New clue noted"): you judge each answer yourself, and the case notes grade every question. One possibility is **held back**: the first question about it gets a vague answer, and you need a follow-up. |
   | 3 | 6–8 | 4–5 rule-outs, a red herring, and in about half the cases a second (comorbid) diagnosis. You are always asked whether there is one. Also one possibility is **played down** by the patient: only a question to the family member or friend ("Ask her mom: ...") gets the truth. |
3. You name the diagnosis. Then you fill in a **differential sheet**: one screen for each possibility on the case.
   For each one you pick what the evidence says:
   - *Ruled out:* the real deciding evidence (shown only if you found it), or a tempting wrong reading of the case;
   - *Still possible*;
   - *Can't decide yet (recheck later)*, for example dementia during a delirium, or anxiety while the thyroid is untreated;
   - *I didn't check this*, which earns half credit as an honest answer.
4. Your results change the encounter. Each change is on a scale, not just pass or fail:

A case **fails** when your diagnosis is wrong or your score is under 50%.

| Result | What it changes |
|---|---|
| PATIENCE 3 to 0 | The battle gets harder: up to +3 levels (never more than 2 above your strongest POKéMON) and up to 2 extra healing items |
| A failed case | The trainer's team gets 2 more levels (up to 4 above your strongest) and one more healing item. No reward, even if you win. |
| Case score 0 to 100% | The reward after a win: 20% for the interview (the share of clues you found), 40% for the diagnosis (at LEVEL 3: 30% diagnosis, 10% second diagnosis), and 40% for the differential sheet. Money grows with the square of the score, so 100% pays about twice as much as 70%. At 50%, 70% and 90% you also get one random boon from that tier (see below) |

| Score | Boon tier: one of these, at random |
|---|---|
| 50% or more | One POTION or status heal, 2 POKé BALLs, a REPEL, FRESH WATER, or the person shows you quiet paths (no weak wild POKéMON for 50 steps) |
| 70% or more | SUPER POTIONs, GREAT BALLs, REVIVE, FULL HEALs, X items, DIRE HIT, ETHERs, an ESCAPE ROPE, or quiet paths for 150 steps. **This tier also lifts one waiting curse.** |
| 90% or more | RARE CANDY, PP UP, a vitamin (HP UP, PROTEIN, IRON, CARBOS, CALCIUM), MAX REVIVE, ULTRA BALLs, ELIXER, a NUGGET, an evolution stone, or a random TM |
| 100% | **JACKPOT**, on top of the 90% boon: a random POKéMON (1 in 3; 5 levels under your strongest), a random TM, or a rare item (RARE CANDY x3, PP UPs, FULL RESTOREs, even a MASTER BALL). In a randomized game the POKéMON comes from your randomizer seed. |

After 5 badges the basic items upgrade (POTION to SUPER POTION, POKé BALL to GREAT BALL, and so on).

Plain townsfolk (people with no story script, battle or item) can also start a case. When you talk to one, they
ask if you want to listen. Each person offers one case per save. If the case goes well, they thank you: the heal
depends on both PATIENCE and the score (a full heal needs PATIENCE 3 and 90% or more), and the score gives the same
money and boon as a trainer's reward.

If the case fails, or their PATIENCE runs out, there is no thanks. Instead they **challenge you to a battle**, when
they look like a trainer (a hiker, a youngster, a scientist, a sailor and so on; children, elders, nurses and clerks
don't battle). Their team is one of that trainer class's teams near your level, made stronger the same way as above,
and the win pays no prize money. A failed case also curses you first, so the curse can strike in that very battle.

**ADULT CASES** (off by default) adds the two tables the themed cases leave out: Sexual Dysfunctions and
Paraphilic Disorders. Turn it on in OPTION while STUDY CASES is on, and say YES to confirm. Then about half of the
adult-looking townsfolk (scientists, gentlemen, middle-aged people, Silph workers) offer "a case from my clinic
files" instead. These cases follow the study skill's rules:
- adult patients only;
- a plain outpatient clinic, with no POKéMON theme in the case, the options or the feedback;
- clinical, non-explicit language;
- for Paraphilic Disorders, only the seven members the skill lists.

The clinician who shared the case gives the heal and the reward. Trainers never use these tables.

**Fail a case and you are cursed.** Each failed case adds one curse, and a wrong diagnosis with a score under 50% adds two.
The next POKéMON of yours that faints in a normal battle is released after that battle, and that uses up one curse.
Your last POKéMON is never released. Link battles and the Battle Tower don't count.

After the battle, the case notes show the answer key: the diagnosis, each rule-out with its clue, the clues you
missed and a teaching note. If you lose, a rematch uses the same result, so reloading cannot give you a new case.
Each case is added to a study log in the save (`dxLog`).

**Twists.** About 1 case in 4 looks like the table's disorder, but the real answer is one of its rule-outs: a
medical problem (a heart attack that looks like panic, an overactive thyroid that looks like anxiety), a substance,
a sleep-timing problem, or no disorder at all (normal grief, normal shyness, a harmless ritual). The diagnosis menu
always includes that kind of answer.

**Prepared cases (CASE SOURCE).** Claude always plays the conversation live. With **PREPARED** (the default), a case
starts from a plan in `src/data/dxplans.js`, written ahead of time. A plan has:
- the patient and their hidden facts;
- for each rule-out: an overlap symptom, the clue, and a probe question that checks it;
- any twist or red herring;
- the opening and the first four questions.

That skips the opening call, the most expensive one, so a case costs only the short turn replies. Plans you haven't
played come first, and the ones at your level are preferred. **FRESH** has Claude plan each case. **MIX** does both.
ADULT CASES are always FRESH.

**Cases fit the person.** The NPC's sprite gives an age group (young child, kid, teen, adult, older adult) and a
sex:
- A plan is used only for NPCs that match its patient.
- Plans marked for townsfolk only, such as a heart attack or delirium, never come up right before a trainer battle.
- If no plan fits, a FRESH case is made instead. It only uses diagnoses that suit the person's age (no personality
  disorder for a little girl) and the NPC's own line from the game.

The 27 plans cover every age group.

**Less narration.** Openings are the person's own words. A short Pokémon-style scene line ("You see a man sitting on
the bench, pale and sweaty.") shows only about 1 time in 3. The full STUDY CASE explanation shows for your first two
cases; after that, a single line.

**Case log.** OPTION > DOWNLOAD CASE LOG saves a text file of your last 60 cases: each question with its kind and
PATIENCE, the answers, your diagnosis and rule-out choices with the right answers, and the case notes. The log is
kept in your browser, not in the save.

The tables come from the diagnosis-practice-case study summary. `node tools/convert_dx.js <SKILL.md>` rebuilds
them. The code is in `src/game/dxcases.js`.

### MissingNo.

The old man's catching demo in Viridian City backs your name up into the memory that holds the area's wild Pokémon
list. Only maps that have grass encounters overwrite that list. The shore squares just east of Cinnabar Island take
their encounter rate from the water, but their Pokémon list from that leftover memory.

1. Watch the old man's demo.
2. Fly to Cinnabar without walking through any grass or caves.
3. Surf up and down the east coast.

The letters of your name, read as level/species bytes, decide what appears: MISSINGNO., 'M, and sometimes a
Lv 132 Mewtwo. Meeting MissingNo. adds 128 to the sixth item in your bag.

### The Mew trick

1. Press START mid-step as a far-off trainer spots you, then Fly away. That route's script is left waiting to start
   the battle, and START won't open until you finish a trainer battle.
2. The next battle overwrites the trainer bytes that script will read. Let the Route 25 Youngster's Slowpoke be that
   battle: its Special stat is 21, which is Mew's internal ID.
3. Walk back onto the route. The START menu opens by itself; close it and a wild Lv 7 Mew appears.

### Trainer AI

Enemy trainers can battle more cleverly (`src/game/trainerai.js`). Set it with **OPTION > TRAINER AI**:

| Setting | Who gets which AI |
|---|---|
| CLASSIC | Everyone uses the original AI: random moves, weighted by type, and the next POKéMON in order |
| SMART (default) | Normal trainers use SMART. Gym leaders, rivals, the Elite Four and GIOVANNI use EXPERT. |
| HARD | Everyone uses EXPERT |

- **SMART** works out the average damage of each move. It takes a knockout when it sees one and prefers strong,
  accurate moves. It uses sleep, paralysis and set-up moves when they make sense, and heals at low HP only when the
  heal would survive your next hit. After a faint, it sends out the POKéMON that matches up best against yours. It
  is still a little random.
- **EXPERT** does all of that, almost always picks the best move, and switches out of a bad matchup (at most twice
  a battle, never two turns in a row). It uses X items when it is safe and saves EXPLOSION for the end.
- A failed STUDY CASE, or one where PATIENCE ran out, makes that trainer one level smarter.

The AI sees your POKéMON's moves and stats, as the Game Boy AI does. Link battles are not changed.

### Randomizer

Choose NEW GAME, then RANDOMIZER. The ideas come from the
[Universal Pokemon Randomizer FVX](https://github.com/upr-fvx/universal-pokemon-randomizer-fvx). The code is new
(`src/game/randomizer.js`).

- **Wild Pokémon.** BY AREA: each Pokémon in an area becomes one other Pokémon of similar strength. BY FAMILY: each
  evolution family becomes another family everywhere, so Pidgey, Pidgeotto and Pidgeot change together. WILD TYPE:
  KEEP gives a replacement that shares the first type. CATCH 'EM ALL puts every non-legendary Pokémon in the wild.
- **Starters.** RANDOM, or TRIANGLE: three single-type Pokémon whose types beat each other in a circle. The rival
  still takes the one that beats yours and keeps it all game. You can limit starters to basic forms and set a maximum
  base stat total.
- **Trainers.** RANDOM gives Pokémon of similar strength. THEMES keeps a type for gym leaders, gym trainers, the Elite
  Four and any trainer whose team shares one type. LOCAL uses only Pokémon from the wild and their evolutions.
  TRAINER EVOS evolves a trainer's Pokémon when its level is high enough.

The seed and the settings are kept in the save. The same seed with the same settings always gives the same game. To
share a run, give a friend the seed (OPTION > RANDOMIZER INFO) and they type it in with TYPE SEED.

### Save files

The game normally saves in your browser. To keep a save outside the browser, use **START > SAVE > SAVE TO FILE**.
The game saves in the browser too (when it can), then downloads a file such as `claude-red-save-red-2026-10-13.json`.

To play from the file, open the title screen and choose **SAVE TRANSFER > LOAD BACKUP FILE**. Pick the file, say YES,
then choose CONTINUE. This works on any site or computer, and also in a private window that can't store saves (the
save then lasts until you close the page, so save to a file again before you stop).

The file holds everything that matters for the game:
- your trainer, POKéMON, items, flags and position;
- the randomizer settings and seed, so the same wild POKéMON, starters and trainer teams come back;
- study-case results: which townsfolk and trainers have given their case, a lost trainer case's result for the
  rematch, waiting curses, and the plans you have played;
- the WHO'S THAT POKéMON? record and the study-case log (OPTION > DOWNLOAD CASE LOG).

Your Claude API key is never put in the file.

## How it's built

```
index.html          the page: canvas, phone controller, account box, script list
src/core/           framebuffer + drawing primitives, pixel font, input, main loop, audio synth + GB sequencer
src/art/            procedural renderers: terrain, buildings, interiors, characters, Pokémon, battle scenes, VFX
src/data/           maps, species, moves, trainers, music (converted from pokered), dialogue, Pokémon shape files
src/game/           overworld, battles, menus, PC, bag, Pokédex, Social Zone, sharing, cloud saves, glitches
src/scripts/        the story, map by map, following Red's event scripts
tools/              data converters, headless runner, fuzzers, map/sprite/VFX sheet renderers, the site server
docs/               how maps, sprites, dialogue and story scripts are authored
```

It's plain JavaScript loaded with classic `<script>` tags. There are no frameworks and no bundler, and it runs from `file://`.

### Rebuilding the data

Map layouts, collision, warps, trainers, wild encounters, species, moves and the music's note data are converted from
the [pret/pokered](https://github.com/pret/pokered) disassembly. No graphics or original text are taken from it.

```sh
git clone https://github.com/pret/pokered ../pokered
node tools/convert_maps.js  ../pokered
node tools/convert_data.js  ../pokered
node tools/convert_music.js ../pokered
```

### Testing

`tools/headless.js` runs the entire game inside Node's `vm` with no browser, and can save any frame as a PNG. Test
drivers are built on top of it:

| Tool | What it does |
| --- | --- |
| `node tools/talkfuzz.js` | Visits all 224 maps, talks to every NPC and reads every sign (1,000+ conversations), playing out any battles. |
| `node tools/fuzzbattle.js` | Random battles with random species, levels and movesets; reports exceptions and stuck battles. |
| `node tools/pvpfuzz.js` | Two copies of the game fight random link battles through their picks alone; every turn must match in both. |
| `node -r ./tools/pathaudit.js tools/stepfuzz.js` | Fires every step/enter script on every walkable cell under random story states; flags anyone walking through a wall. |
| `node tools/warpcheck.js` | Walks the warp graph and checks every exit leads back where it came from. |
| `node tools/rendermap.js <Map> out.png` | Renders a whole map. `monsheet.js`, `vfxsheet.js` and `charsheet.js` do the same for Pokémon, move animations and characters. |

### Hosting

`node tools/build_dist.js https://your.site/` writes a static `dist/` (plus a `preview.png` for link previews) that any
web host can serve. Set `CF_BEACON_TOKEN=<site token>` to include Cloudflare Web Analytics, which is cookieless.

`tools/serve.py` adds the small site API: email sign-ups, accounts, cloud saves and the hit counter. It stores
everything in one SQLite file under `data/`. It also runs the live Social Zone (`tools/lounge.py`): presence, chat,
offers and the link battle relay, kept in memory and sent over WebSockets, with long polling as a fallback. Passwords are stored only as salted scrypt hashes, and session tokens only
as SHA-256 hashes.

The game also sends a small, anonymous gameplay log (`src/game/analytics.js`): every shareable moment (badges, catches,
evolutions, the Hall of Fame, Tower streaks, link battles, trades), first visits to towns and dungeons, blackouts,
saves, quiz scores, shares and a heartbeat. Each save and each browser gets a random id; there are no emails, and the
server keeps a visitor's country but never their IP address. Browsers that send Do Not Track or Global Privacy Control
send nothing. `python3 tools/serve.py stats [days]` prints the report: where visitors come from, how far players get
(a funnel from starter to Champion), where they stop and black out, what they catch and share, and a leaderboard.

Newsletter sign-ups are kept locally, then forwarded to the Levy Street list. If the page is hosted without the
server, it signs up with the list directly. `python3 tools/serve.py export` prints the email list as CSV, and
`python3 tools/serve.py sync-newsletter` retries any sign-up the list hasn't accepted yet.

## Credits

- Built by **Claude Opus 5.5** in [Claude Code](https://claude.com/claude-code), directed by
  [Levy Street](https://levystreet.com), from September 24 to 27, 2026.
- Maps, trainers, encounters, game data and the music's note data are converted from
  [pret/pokered](https://github.com/pret/pokered). Huge thanks to everyone who worked on it.

## Legal

Pokémon © 1996 Nintendo / Creatures Inc. / GAME FREAK inc. This is a free, non-commercial fan project. It is not
affiliated with or endorsed by Nintendo, The Pokémon Company, GAME FREAK, Creatures Inc., Anthropic or OpenAI.

## Levy Street

Levy Street works at the frontier of **AI × gaming × consumer**. Sign up for updates from the bar at the top of the
game, or say hello at [hello@levystreet.com](mailto:hello@levystreet.com).
