// node test/unit.test.mjs — checks the brain loop, Minds adapter, Google client and local memory with fakes.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBrain, parseTags, parseLocal, appNote } from '../lib/brain.js';
import { _setClientFactory, askMind, cleanReply } from '../lib/minds.js';
import { createGoogle, joinLink } from '../lib/google.js';
import { createTimeline, createReminders } from '../lib/store.js';

let n = 0; const ok = (name) => console.log(`  ✓ ${++n}. ${name}`);
const tmp = mkdtempSync(path.join(os.tmpdir(), 'buddy-'));

// ---- tags ----
{ const p = parseTags('[mood:excited][action:jump][remind:2026-11-18T16:00|Call Budi] Got it! I will remind you.');
  assert.equal(p.mood, 'excited'); assert.equal(p.action, 'jump'); assert.equal(p.text, 'Got it! I will remind you.'); assert.equal(p.tags.length, 3);
  assert.equal(parseLocal('2026-11-18T16:05').getHours(), 16); assert.equal(parseLocal('tomorrow'), null);
  assert.equal(parseTags('[mood:grumpy] hi').mood, null);
  ok('mood/action/remind tags parsed and stripped'); }

// ---- brain: reminder action ----
const fakeGoogle = (over = {}) => ({ connected: () => true, events: async () => [{ title: 'Design review', start: new Date(2026, 10, 18, 15), attendees: ['Sari'], files: [], description: '', allDay: false }],
  formatEvents: (l, label) => `Calendar (${label}):\n` + l.map(e => '- 3 PM: ' + e.title).join('\n'), search: async q => [{ id: 'f1', name: 'Budget Q4', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-11-10T00:00:00Z' }],
  formatFiles: (l, q) => `Drive search "${q}":\n- Budget Q4 (id f1)`, readText: async id => 'File "Budget Q4": total 100', createEvent: async () => ({}), saveNote: async () => ({}), ...over });
{ const rem = createReminders(tmp); const sent = [];
  const brain = createBrain({ ask: async (a, m) => { sent.push(m); return '[mood:happy][action:nod][remind:2026-11-18T16:00|Call Budi] Done, I will ping you at 4!'; },
    google: fakeGoogle({ connected: () => false }), reminders: rem, confirm: async () => true, name: () => 'Arkzept15m216', now: () => new Date(2026, 10, 18, 15, 40) });
  const r = await brain.talk('remind me at 4 to call Budi');
  assert.equal(r.text, 'Done, I will ping you at 4!'); assert.equal(r.done[0].type, 'remind'); assert.equal(rem.pending()[0].text, 'Call Budi');
  assert.match(sent[0], /you are Arkzept15m216/i); assert.match(sent[0], /2026-11-18T15:40/); assert.doesNotMatch(sent[0], /Google tags/); assert.doesNotMatch(sent[0], /MIND·01/); assert.ok(sent[0].split(/\s+/).length < 90, 'note stays short');
  ok('reminder tag → local reminder; note carries the Mind\'s name, local time, no Google tags when not connected'); }

// ---- brain: calendar look-up round trip ----
{ const sent = []; let round = 0;
  const brain = createBrain({ ask: async (a, m) => { sent.push(m); return ++round === 1 ? '[mood:curious][action:think][calendar:today] Let me check!' : '[mood:happy] You have the design review at 3 with Sari.'; },
    google: fakeGoogle(), reminders: createReminders(tmp), confirm: async () => true });
  const interim = []; const r = await brain.talk('what meetings do I have today?', { onThinking: t => interim.push(t) });
  assert.equal(r.text, 'You have the design review at 3 with Sari.'); assert.deepEqual(interim, ['Let me check!']);
  assert.match(sent[1], /App results/); assert.match(sent[1], /Design review/); assert.match(sent[0], /Google tags are available/);
  ok('calendar tag → events sent back to the Mind → final answer'); }

// ---- brain: drive search + read, note needs confirmation ----
{ let round = 0; const saved = []; let asked = null;
  const brain = createBrain({ ask: async () => [
      '[mood:curious][drive:search|budget] One sec…', '[mood:curious][drive:read|f1] Found it, reading…',
      '[mood:proud][action:nod][note:Budget summary|Total is 100] The total is 100. Want me to save that?'][round++],
    google: fakeGoogle({ saveNote: async (t, b) => saved.push([t, b]) }), reminders: createReminders(tmp), confirm: async q => { asked = q; return true; } });
  const r = await brain.talk('summarise my budget sheet');
  assert.equal(round, 3); assert.equal(r.text, 'The total is 100. Want me to save that?'); assert.match(asked, /Save the note "Budget summary"/); assert.deepEqual(saved, [['Budget summary', 'Total is 100']]);
  ok('drive search → read → note saved only after the confirm'); }
{ const brain = createBrain({ ask: async () => '[mood:happy][event:2026-11-19T09:00|120|Report focus time] Blocked it!', google: fakeGoogle({ createEvent: async () => { throw new Error('should not create'); } }),
    reminders: createReminders(tmp), confirm: async () => false });
  const r = await brain.talk('block 2 hours tomorrow at 9'); assert.equal(r.done.length, 0);
  ok('calendar event is NOT created when you say no'); }

// ---- typing fix ----
{ const brain = createBrain({ ask: async (a, m) => { assert.equal(a, 'buddy-typing'); assert.match(m, /<<<teh report is done>>>/); return '<<<The report is done.>>>'; }, google: fakeGoogle(), reminders: createReminders(tmp), confirm: async () => true });
  assert.equal(await brain.fixText('teh report is done'), 'The report is done.');
  ok('fix-typing returns only the corrected text'); }

// ---- Minds adapter with a fake official client ----
{ const calls = []; let hist = [{ messageId: 'u0', messageText: 'old', senderType: 1, createdAt: '2026-11-18T07:00:00Z' }];
  _setClientFactory(async key => ({
    listMinds: async () => [{ mindId: '11111111-2222-3333-4444-555555555555', name: 'Arkzept15m216' }],
    ensureConversation: async (alias, id) => calls.push(['ensure', alias, id]),
    getHistory: async () => hist,
    sendMessage: async ({ alias, messageText }) => { calls.push(['send', alias]); setTimeout(() => hist = [...hist, { messageId: 'm1', messageText: '<p>[mood:happy] Hi&nbsp;there!</p>', senderType: 0, createdAt: '2026-11-18T07:01:00Z' }], 50); },
    waitForReply: () => new Promise(() => {}),
  }));
  process.env.MINDS_BUILDER_API_KEY = 'k'; process.env.MIND_ID = 'Arkzept15m216';
  const r = await askMind('minds-buddy-buddy', 'hello');
  assert.equal(r, '[mood:happy] Hi there!'); assert.deepEqual(calls[0], ['ensure', 'minds-buddy-buddy', '11111111-2222-3333-4444-555555555555']);
  assert.equal(cleanReply('<p>[mood:calm] Plain answer, still as myself: ok</p>'), '[mood:calm] ok');
  ok('Minds adapter: resolves Mind by name, ensureConversation, reply via history, HTML + preface cleaned'); }
{ let hist = [];
  _setClientFactory(async () => ({ listMinds: async () => [{ mindId: '11111111-2222-3333-4444-555555555555', name: 'Arkzept15m216' }], ensureConversation: async () => {}, getHistory: async () => hist,
    sendMessage: async () => { setTimeout(() => hist = [...hist, { messageId: 'a', messageText: '[mood:sorry? no - moods allowed: happy, excited, curious. Use', senderType: 0, createdAt: '2026-11-18T08:00:00Z' }], 30);
      setTimeout(() => hist = [...hist, { messageId: 'b', messageText: '[mood:happy] It is 26°C and cloudy in KL!', senderType: 0, createdAt: '2026-11-18T08:00:05Z' }], 1800); },
    waitForReply: () => new Promise(() => {}) }));
  const r = await askMind('minds-buddy-buddy', 'weather?');
  assert.equal(r, '[mood:happy] It is 26°C and cloudy in KL!');
  ok('a reply that only talks about the rules is skipped; the real answer is used'); }

// ---- Google client with fake fetch ----
{ const reqs = []; let saved = null;
  const fetchImpl = async (url, o = {}) => { reqs.push([url, o]);
    const J = (j, s = 200) => ({ ok: s < 300, status: s, json: async () => j, text: async () => typeof j === 'string' ? j : JSON.stringify(j) });
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'AT2', expires_in: 3600 });
    if (url.includes('/calendar/v3/') && (o.method || 'GET') === 'GET') return J({ items: [
      { id: 'e1', summary: 'Standup', start: { dateTime: '2026-11-18T09:00:00+08:00' }, end: { dateTime: '2026-11-18T09:15:00+08:00' }, hangoutLink: 'https://meet.google.com/abc-defg-hij', attendees: [{ email: 'me@x', self: true }, { displayName: 'Tom', email: 't@x' }] },
      { id: 'e2', summary: 'Declined thing', start: { dateTime: '2026-11-18T10:00:00+08:00' }, attendees: [{ self: true, responseStatus: 'declined' }] }] });
    if (url.includes('/drive/v3/files?') && url.includes('fullText')) return J({ files: [{ id: 'a', name: 'Old', mimeType: 'text/plain', modifiedTime: '2026-01-01T00:00:00Z' }, { id: 'b', name: 'New budget', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-11-01T00:00:00Z' }] });
    if (url.includes('/drive/v3/files/b?')) return J({ id: 'b', name: 'New budget', mimeType: 'application/vnd.google-apps.spreadsheet' });
    if (url.includes('/files/b/export')) return J('a,b\n1,2');
    if (url.includes("name+%3D+%27Minds+Buddy%27") || url.includes('Minds+Buddy')) return J({ files: [] });
    if (url.endsWith('/drive/v3/files') && o.method === 'POST') return J({ id: 'folder1' });
    if (url.includes('upload/drive')) return J({ id: 'n1', name: 'x' });
    return J({ error: 'unexpected ' + url }, 404); };
  const g = createGoogle({ clientId: 'cid', clientSecret: 'sec', saveTokens: t => saved = t, loadTokens: () => ({ refresh_token: 'RT', access_token: 'old', expires_at: 0 }), fetchImpl });
  assert.equal(g.connected(), true);
  const ev = await g.events('today');
  assert.equal(ev.length, 1); assert.equal(ev[0].join, 'https://meet.google.com/abc-defg-hij'); assert.deepEqual(ev[0].attendees, ['Tom']);
  assert.equal(saved.access_token, 'AT2'); assert.equal(reqs[1][1].headers.authorization, 'Bearer AT2');
  assert.match(g.formatEvents(ev, 'today'), /Standup \| with Tom \| has video link/);
  const files = await g.search("budget's"); assert.equal(files[0].name, 'New budget'); assert.doesNotMatch(decodeURIComponent(reqs.at(-1)[0]), /budget's/);
  assert.match(await g.readText('b'), /File "New budget" \(Sheet\):\na,b\n1,2/);
  await g.saveNote('Hello', 'note body');
  const up = reqs.find(r => r[0].includes('upload/drive')); const body = up[1].body.toString();
  assert.match(body, /"mimeType":"application\/vnd.google-apps.document"/); assert.match(body, /"parents":\["folder1"\]/); assert.match(body, /note body/);
  assert.equal(joinLink({ location: 'Zoom: https://us02web.zoom.us/j/123?pwd=x' }), 'https://us02web.zoom.us/j/123?pwd=x');
  ok('Google: token refresh, events (declined hidden, Meet link), Drive search (quote-safe), read Sheet, note → Doc in "Minds Buddy" folder'); }

// ---- timeline + privacy ignore list ----
{ const tl = createTimeline(tmp, {}); const t0 = Date.now() - 3600_000;
  tl.record({ app: 'OUTLOOK', title: 'RE: delivery - Outlook' }, t0); tl.record({ app: 'OUTLOOK', title: 'RE: delivery - Outlook' }, t0 + 60_000);
  tl.record({ app: 'chrome', title: 'My Bank - Login' }, t0 + 70_000); tl.record({ app: 'KeePassXC', title: 'vault' }, t0 + 80_000);
  tl.record({ app: 'chrome', title: 'New Tab - InPrivate' }, t0 + 85_000);
  tl.record({ app: 'EXCEL', title: 'budget.xlsx' }, t0 + 120_000);
  tl.pause(true); tl.record({ app: 'WINWORD', title: 'secret.docx' }, t0 + 130_000); tl.pause(false);
  const s = tl.summary(t0 - 1, t0 + 200_000);
  assert.match(s, /OUTLOOK: "RE: delivery - Outlook"/); assert.match(s, /EXCEL/); assert.doesNotMatch(s, /Bank|vault|InPrivate|secret/);
  assert.equal(tl.rows().length, 2);
  ok('timeline merges repeats, skips banking / password manager / private windows, honours off-the-record'); }
{ const rem = createReminders(tmp); const r = rem.add(new Date(Date.now() - 1000), 'Stretch');
  assert.ok(rem.due().some(x => x.id === r.id)); rem.snooze(r.id, 600_000); assert.ok(!rem.due().some(x => x.id === r.id)); rem.done(r.id);
  ok('reminders: due, snooze, done'); }
assert.match(appNote({ name: 'X', google: true }), /\[drive:read\|fileId\]/);
console.log(`\nAll ${n} checks passed.`);
process.exit(0);
