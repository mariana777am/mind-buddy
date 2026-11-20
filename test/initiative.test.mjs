// node test/initiative.test.mjs — when does the buddy start a conversation by itself?
import assert from 'node:assert/strict';
import { createInitiative } from '../lib/initiative.js';
let n = 0; const ok = s => console.log(`  ✓ ${++n}. ${s}`);
function make(o = {}){
  const said = []; let clock = o.clock || new Date(2026, 10, 19, 9, 30); const flags = {};
  const ini = createInitiative({ level: () => o.level || 'normal', flags: () => flags, saveFlags: () => {}, blocked: () => !!o.blocked, lastTouchAgo: () => o.touched ?? 60 * 60_000,
    timeline: { summary: () => '- EXCEL: "budget.xlsx" (90 min)' }, google: o.google || null, reminders: { pending: () => [] }, facts: () => o.facts || [],
    speak: async (kind, ctx) => { said.push([kind, ctx]); return { text: 'hi' }; }, now: () => clock, rand: () => o.rand ?? .1 });
  return { ini, said, setClock: c => clock = c, flags };
}
const win = { app: 'WINWORD', title: 'Quarterly report.docx' };
{ const { ini, said } = make();
  await ini.tick({ idle: 2, win }); assert.equal(said.length, 0, 'not while you are busy typing');
  await ini.tick({ idle: 30, win }); assert.equal(said[0][0], 'morning');
  await ini.tick({ idle: 30, win }); assert.equal(said.length, 1, 'gap respected');
  ok('morning hello at the first pause of the day, only once; never mid-typing'); }
{ const { ini, said } = make({ blocked: true }); await ini.tick({ idle: 30, win }); assert.equal(said.length, 0);
  const b = make({ touched: 60_000 }); await b.ini.tick({ idle: 30, win }); assert.equal(b.said.length, 0);
  const q = make({ level: 'quiet' }); await q.ini.tick({ idle: 30, win }); assert.equal(q.said.length, 0);
  ok('stays silent when asleep/quiet/focus/call (blocked), right after you talked to it, or in Quiet mode'); }
{ const { ini, said, setClock, flags } = make({ clock: new Date(2026, 10, 19, 14, 0) }); flags.day = '2026-11-19'; flags.morning = 1;
  await ini.tick({ idle: 2, win });                                  // starts watching this window
  const t0 = Date.now(); const real = Date.now; Date.now = () => t0 + 41 * 60_000;
  await ini.tick({ idle: 30, win }); Date.now = real;
  assert.equal(said[0][0], 'stuck'); assert.equal(said[0][1].minutes, 41);
  ok('offers help after 40+ minutes on the same document'); }
{ const { ini, said, flags } = make({ clock: new Date(2026, 10, 19, 15, 0), facts: ['has a big presentation on Friday'], rand: .1 }); flags.day = '2026-11-19'; flags.morning = 1;
  const real = Date.now, t0 = real(); Date.now = () => t0 + 50 * 60_000;
  await ini.tick({ idle: 40, win: null }); Date.now = real;
  assert.equal(said[0][0], 'followup'); assert.deepEqual(said[0][1].facts, ['has a big presentation on Friday']);
  ok('follows up on something it remembers'); }
{ const { ini, said, flags } = make({ clock: new Date(2026, 10, 19, 17, 30) }); flags.day = '2026-11-19'; flags.morning = 1; flags.activeMin = 300;
  const real = Date.now, t0 = real(); Date.now = () => t0 + 50 * 60_000;
  await ini.tick({ idle: 40, win: null }); Date.now = real;
  assert.equal(said[0][0], 'wrap'); assert.match(said[0][1].today, /budget/);
  ok('end-of-day wrap-up after 5 PM with today\'s timeline'); }
{ const { ini, said, flags } = make({ clock: new Date(2026, 10, 19, 15, 0) }); flags.day = '2026-11-19'; flags.morning = 1;
  const real = Date.now, t0 = real();
  Date.now = () => t0 + 45 * 60_000; await ini.tick({ idle: 40, win: null }); assert.equal(said.at(-1)[0], 'fun');
  ini.feedback('no');
  Date.now = () => t0 + 45 * 60_000 + 50 * 60_000; await ini.tick({ idle: 40, win: null }); assert.equal(said.length, 1, '"not now" doubles the wait');
  Date.now = () => t0 + 45 * 60_000 + 81 * 60_000; await ini.tick({ idle: 40, win: null }); assert.equal(said.length, 2);
  Date.now = real;
  ok('fun pop-in at a pause; "Not now" makes it wait twice as long'); }
{ const ev = { id: 'e1', title: 'Design review', start: new Date(Date.now() + 15 * 60_000), attendees: ['Sari'], allDay: false };
  const { ini, said, flags } = make({ clock: new Date(2026, 10, 19, 14, 0), google: { connected: () => true, upcoming: async () => [ev] } }); flags.day = '2026-11-19'; flags.morning = 1;
  await ini.tick({ idle: 30, win }); assert.equal(said[0][0], 'prep'); assert.equal(said[0][1].event.title, 'Design review');
  await ini.tick({ idle: 30, win }); assert.equal(said.length, 1);
  ok('offers a meeting brief ~15 minutes before, once'); }
console.log(`\nAll ${n} initiative checks passed.`);
