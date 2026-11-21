import assert from 'node:assert/strict';
import { parseEvolution, evolutionPrompt, createEvolution, ideasMarkdown, KINDS } from '../lib/evolution.js';
import { parseDream, dreamFormatPart } from '../lib/dreamspec.js';
await import('../renderer/arcade-design.js'); const TWISTS = globalThis.ArcadeDesign.TWISTS;
const ok = (n, m) => console.log(`  ✓ ${n}. ${m}`);
const reply = 'TITLE: Mandarin Melody Week | OUTFIT: Lantern Cap | KIND: baseball cap | COLOR: Cherry red | BADGE: 🏮 | QUEST: Lantern Rush | GAME: Bubble Pop | TWIST: gold rush | ' +
  'DREAM: Taipei rooftop karaoke | PLACE: rooftop | PROPS: lanterns, notes, microphone, skyline | HER: sing | DOG: play | SKY: night | WEATHER: fireflies | PALETTE: lantern | SIGN: 唱歌 | WHY: so much Mandopop | ' +
  'IDEA: Sing-along mode that shows pinyin under Mandarin lyrics | IDEA_WHY: she played Mandarin songs 12 times | NOTE: I grew a little this week! New outfit, new dream, new idea!';
// 1. the Mind's plan is read and kept to what the app can do
const ev = parseEvolution(reply, { twists: TWISTS });
assert.equal(ev.title, 'Mandarin Melody Week'); assert.deepEqual(ev.outfit, { name: 'Lantern Cap', kind: 'cap', color: 'cherry', badge: '🏮', id: 'evo:lantern-cap' });
assert.equal(ev.quest.game, 'bubbles'); assert.equal(ev.quest.twist, 'goldrush'); assert.match(ev.quest.twistText, /Gold rush/);
assert.equal(ev.idea.text, 'Sing-along mode that shows pinyin under Mandarin lyrics'); assert.match(ev.idea.why, /12 times/);
const d = parseDream(reply); assert.equal(d.title, 'Taipei rooftop karaoke'); assert.equal(d.her, 'sing'); assert.equal(d.why, 'so much Mandopop');
const weird = parseEvolution('TITLE: x | OUTFIT: Laser Wings | KIND: jetpack | COLOR: plaid | BADGE: 🚀 | GAME: chess | TWIST: lava', { twists: TWISTS });
assert.equal(weird.outfit.kind, 'cap'); assert.equal(weird.outfit.color, 'pink'); assert.equal(weird.outfit.badge, ''); assert.equal(weird.quest.game, 'bubbles'); assert.notEqual(weird.quest.twist, 'lava');
assert.equal(parseEvolution('Here is my evolution plan!', { twists: TWISTS }), null);
ok(1, 'evolution plan parsed (outfit, quest, dream, idea); unknown shapes, colours, games and twists fall back safely');

// 2. weekly timing, quest and ideas
let now = Date.parse('2026-11-20T12:00:00Z'), saved = null; const E = createEvolution({ read: () => null, write: v => saved = v, now: () => now });
assert.equal(E.due(), false); now += 86400000 + 1; assert.equal(E.due(), true);
const id = E.add(ev); assert.equal(E.due(), false); assert.equal(E.quest().name, 'Lantern Rush');
assert.equal(E.completeQuest().outfit.id, 'evo:lantern-cap'); assert.equal(E.quest(), null); assert.equal(E.completeQuest(), null);
assert.equal(E.answerIdea(id, true).status, 'approved'); assert.equal(E.answerIdea(id, false), null);
now += 7 * 86400000; assert.equal(E.due(), true);
const md = ideasMarkdown(E.data.ideas); assert.match(md, /## Approved\n- \[ \] \*\*Sing-along mode/);
ok(2, 'first evolution a day after install, then weekly; quest wins once; approved ideas go to IDEAS.md');

// 3. the prompt carries her week, the past, and the allowed choices
const p = evolutionPrompt({ lately: 'Music this week: 12 plays (titles in Chinese ×9)', petLevel: 4, outfits: ['Lantern Cap'], dreams: ['Sakura lake'], history: E.historyText(), ideas: E.ideasText(), twists: TWISTS, dreamFormat: dreamFormatPart() });
assert.match(p, /Chinese ×9/); assert.match(p, /Lantern Cap/); assert.match(p, /approved/); assert.ok(KINDS.every(k => p.includes(k))); assert.match(p, /goldrush/); assert.match(p, /PALETTE:/);
ok(3, 'the weekly message includes her week, past evolutions and her answers to past ideas');
// 4. blind boxes
{ const { parseBlindbox, localBlindbox, rollRarity, blindboxPrompt } = await import('../lib/evolution.js');
  const bb = parseBlindbox('SERIES: Night Market | OUTFIT: Lantern Cap | KIND: baseball cap | COLOR: cherry | BADGE: 🏮 | LINE: Mandopop week, lantern cap! | WHY: Mandarin songs', 'super');
  assert.equal(bb.outfit.kind, 'cap'); assert.equal(bb.outfit.series, 'Night Market'); assert.equal(bb.outfit.rarity, 'super'); assert.match(bb.outfit.id, /^evo:lantern-cap-/);
  assert.equal(parseBlindbox('a surprise!', 'rare'), null);
  const lb = localBlindbox('rare', 'Music this week: titles in Chinese ×4'); assert.equal(lb.outfit.badge, '🏮'); assert.equal(lb.outfit.rarity, 'rare');
  assert.equal(rollRarity(.01), 'secret'); assert.equal(rollRarity(.1), 'super'); assert.equal(rollRarity(.3), 'rare'); assert.equal(rollRarity(.9), 'common');
  assert.match(blindboxPrompt({ lately: 'x', rarity: 'secret', owned: ['Lantern Cap'] }), /rarest/);
  ok(4, 'blind boxes: Mind design parsed with series and rarity; a built-in surprise when the Mind is busy'); }
console.log('\nAll 4 evolution checks passed.');
