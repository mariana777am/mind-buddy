import assert from 'node:assert/strict';
import { createHabits, categorize, scriptOf } from '../lib/habits.js';
import { parseDream, dreamPrompt, PROPS } from '../lib/dreamspec.js';
const ok = (n, m) => console.log(`  ✓ ${n}. ${m}`);
let saved = null, t = Date.parse('2026-11-20T17:00:00+08:00');
const h = createHabits({ read: () => null, write: v => saved = v, now: () => t });

// 1. habits: categories only (no titles), music with scripts
assert.equal(categorize('slack.exe', 'Kelvin Sin (DM) - Slack'), 'team chat'); assert.equal(categorize('chrome', 'Traveloka - flights'), 'travel planning'); assert.equal(categorize('notepad', 'secret plan'), null);
for (let i = 0; i < 24; i++) h.app('slack.exe', 'DM - Slack', 5);
h.music({ kind: 'radio', query: 'mandarin pop radio' }); h.music({ kind: 'radio', title: '台北之音 Hit FM' }); h.music({ kind: 'yt', query: 'jay chou 晴天', title: '周杰倫 Jay Chou【晴天】' });
h.music({ kind: 'yt', title: '周杰倫 Jay Chou【晴天】' }); h.game('bubbles'); h.game('bubbles');
const s = h.summary({ facts: ['Loves hiking'], dogName: 'Mochi' });
assert.match(s, /team chat 2 min/); assert.match(s, /Chinese ×2/); assert.match(s, /mandarin ×1/); assert.match(s, /Arcade favourite: bubbles/); assert.match(s, /Mochi/);
assert.ok(!/Kelvin|DM - Slack/.test(s) && !JSON.stringify(h.data.apps).includes('Kelvin'));
assert.equal(h.data.music.length, 3, 'same song twice in a row counts once');
assert.equal(scriptOf('夜に駆ける'), 'Japanese');
ok(1, 'habits: app categories (never window titles), music with language hints, favourite game');

// 2. a Mind recipe is read and kept to what the hologram can draw
const d = parseDream('DREAM: Taipei night market melodies | PLACE: Night Market | PROPS: lanterns, notes, bubble tea, laser cannon, noodles | HER: walking | DOG: walk | SKY: night | WEATHER: fireflies | PALETTE: lantern | SIGN: 夜市<script> | WHY: lots of Mandarin music');
assert.equal(d.place, 'market'); assert.deepEqual(d.props, ['lanterns', 'notes', 'bubbletea', 'noodles']); assert.equal(d.her, 'walk'); assert.equal(d.sign, '夜市script'); assert.equal(d.palette, 'lantern');
assert.equal(parseDream('Sure! I dreamt of cake.'), null);
const bad = parseDream('DREAM: x | PLACE: volcano | PROPS: dragons | HER: fly | SKY: purple | PALETTE: rainbow'); assert.equal(bad.place, 'park'); assert.deepEqual(bad.props, ['stars']); assert.equal(bad.her, 'walk');
ok(2, 'Mind recipes: fuzzy names fixed (bubble tea → bubbletea), unknown things dropped, junk ignored');

// 3. the prompt carries the lately-summary and past dreams, and lists the drawable things
const p = dreamPrompt({ lately: s, past: ['Sakura lake picnic'], dogName: 'Mochi' });
assert.match(p, /Chinese ×2/); assert.match(p, /Sakura lake picnic/); assert.match(p, /Mochi/); assert.ok(PROPS.every(x => p.includes(x)));
h.addDream(d); assert.equal(h.dreamsToday(), 1); assert.equal(h.lastDreamAt(), t);
ok(3, 'the dream request includes what she\'s into lately and avoids repeating recent dreams');
console.log('\nAll 3 dream checks passed.');
