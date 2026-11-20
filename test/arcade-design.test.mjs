import assert from 'node:assert/strict';
await import('../renderer/arcade-design.js');
const AD = globalThis.ArcadeDesign;
const ok = (n, m) => console.log(`  ✓ ${n}. ${m}`);
const store = new Map(); const ls = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };

// 1. the Mind's plan is read and kept within safe limits
let d = AD.parseMind('bubbles', 'LINE: hi | STYLE: tricky | BRAG: a;b | OOPS: c;d | LEVEL: Bomb Alley | TWIST: Gold-Rush | TUNE: speed=5 bombs=2 gold=-9 lasers=2 | WHY: practice those bombs | HABIT: Two bombs a round? Bold!');
assert.equal(d.name, 'Bomb Alley'); assert.equal(d.twist, 'goldrush'); assert.equal(d.by, 'mind');
assert.deepEqual(d.knobs, { speed: 2, aggro: 0, smarts: 0, bombs: 2, gold: -2, ice: 0, pace: 0 });
assert.equal(d.habit, 'Two bombs a round? Bold!');
ok(1, 'Mind plan parsed; numbers clamped to −2…+2, unknown knobs and twists ignored');

// 2. junk → no Mind design (the built-in one is used)
assert.equal(AD.parseMind('space', 'Sure! Here is a level for you.'), null);
assert.equal(AD.parseMind('space', 'LEVEL: X | TWIST: lava | TUNE: rocks=1').twist, 'none');
ok(2, 'a reply without a level, or an unknown twist, falls back safely');

// 3. the diary records rounds and the summary describes habits
let diary = [];
for (let i = 0; i < 5; i++) diary = AD.record(diary, { game: 'bubbles', won: i < 2, tie: false, you: 10, bud: 12, lv: 2, dur: 60, stats: { pops: 18, bombs: 3, gold: 2, misses: 7, reaction: 1.1 }, design: d, t: Date.now() });
AD.save(ls, diary); diary = AD.load(ls);
const sum = AD.summarize('bubbles', diary, { now: new Date('2026-11-20T15:00:00'), lv: 2 });
assert.match(sum, /won 2, tied 0, lost 3/); assert.match(sum, /lost 3 in a row/); assert.match(sum, /3 bombs hit/); assert.match(sum, /"Bomb Alley"/);
assert.ok(!/stationuuid|password|title/i.test(sum));
ok(3, 'diary saved on the PC; the Mind only gets a short summary (wins, streak, habits, past designs)');

// 4. built-in designer: eases off after a losing streak, calmer late at night
const easy = AD.autoDesign('bubbles', diary, { now: new Date('2026-11-20T15:00:00') });
assert.equal(easy.name, 'Comeback Course'); assert.ok(easy.knobs.speed < 0 && easy.knobs.smarts < 0);
const night = AD.autoDesign('brawl', [], { now: new Date('2026-11-20T23:40:00') });
assert.equal(night.name, 'Night Owl Chill'); assert.equal(night.twist, 'shortrounds');
ok(4, 'without the Mind: easier after 3 losses, calmer "Night Owl Chill" late at night');

// 5. after a win streak it targets a weak spot
let wins = [];
for (let i = 0; i < 4; i++) wins = AD.record(wins, { game: 'space', won: true, you: 3, bud: 0, lv: 3, dur: 70, stats: { shots: 40, hits: 6, hitsTaken: 1, powerups: 0, distance: 200 } });
const hard = AD.autoDesign('space', wins);
assert.ok(hard.knobs.smarts > 0 && hard.knobs.powerups > 0, JSON.stringify(hard));
assert.match(AD.summarize('space', wins), /15% shot accuracy/);
ok(5, 'after a winning streak: smarter opponent, and extra power-ups for a 15% shooter');

// 6. the prompt lists exactly this game's knobs and twists
const pp = AD.promptPart('brawl'); assert.match(pp, /blocking=0/); assert.match(pp, /heavyhits/); assert.ok(!/bombs=0/.test(pp));
ok(6, 'each game asks the Mind only for its own knobs and twists');
console.log('\nAll 6 arcade design checks passed.');
