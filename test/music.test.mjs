// node test/music.test.mjs — radio search picks the right language/country, and says when nothing matches
import assert from 'node:assert/strict';
import { createMusic, parseTitle, tidyRadioRequest, spokenNumbers } from '../lib/music.js';
const ST = [
  { stationuuid: 'hk1', name: 'RTHK Radio 2', url_resolved: 'https://hk/2.mp3', codec: 'MP3', lastcheckok: 1, hls: 0, language: 'cantonese', countrycode: 'HK', tags: 'pop,cantopop', clickcount: 500 },
  { stationuuid: 'hk2', name: 'Metro Info', url_resolved: 'https://hk/m.aac', codec: 'AAC', lastcheckok: 1, hls: 0, language: 'cantonese', countrycode: 'HK', tags: 'news,talk', clickcount: 300 },
  { stationuuid: 'tw1', name: 'Hit FM Taiwan', url_resolved: 'https://tw/hit.mp3', codec: 'MP3', lastcheckok: 1, hls: 0, language: 'chinese,mandarin', countrycode: 'TW', tags: 'pop,mandopop', clickcount: 800 },
  { stationuuid: 'hk4', name: 'RTHK Radio 4', url_resolved: 'https://hk/4.mp3', codec: 'MP3', lastcheckok: 1, hls: 0, language: 'cantonese,english', countrycode: 'HK', tags: 'classical', clickcount: 200 },
  { stationuuid: 'my988', name: '988 FM', url_resolved: 'https://my/988.aac', codec: 'AAC', lastcheckok: 1, hls: 0, language: 'chinese', countrycode: 'MY', tags: 'chinese,pop', clickcount: 50 },
  { stationuuid: 'myera', name: 'ERA FM', url_resolved: 'https://my/era.mp3', codec: 'MP3', lastcheckok: 1, hls: 0, language: 'malay', countrycode: 'MY', tags: 'pop,fm', clickcount: 5000 },
  { stationuuid: 'myfly', name: 'Fly FM', url_resolved: 'https://my/fly.mp3', codec: 'MP3', lastcheckok: 1, hls: 0, language: 'english', countrycode: 'MY', tags: 'pop,hits,fm', clickcount: 4000 },
  { stationuuid: 'us1', name: 'Smooth Jazz 24/7', url_resolved: 'https://us/jazz.mp3', codec: 'MP3', lastcheckok: 1, hls: 0, language: 'english', countrycode: 'US', tags: 'jazz,smooth jazz', clickcount: 9000 },
  { stationuuid: 'bad', name: 'Broken HLS', url_resolved: 'https://x/a.m3u8', codec: 'AAC', lastcheckok: 1, hls: 1, language: 'cantonese', countrycode: 'HK', tags: 'pop', clickcount: 9999 },
];
let hosts = [];
const fetchImpl = async url => { const u = new URL(url), p = u.searchParams; let r = ST; hosts.push(u.hostname);
  if (u.pathname.endsWith('/servers')) return { ok: true, status: 200, json: async () => [{ name: 'de2.api.radio-browser.info' }, { name: 'not a host!' }] };
  if (u.hostname === 'de2.api.radio-browser.info') return { ok: false, status: 503, json: async () => ({}) };
  if (p.get('language')) r = r.filter(s => s.language.includes(p.get('language'))); if (p.get('countrycode')) r = r.filter(s => s.countrycode === p.get('countrycode'));
  if (p.get('tag')) r = r.filter(s => s.tags.includes(p.get('tag'))); if (p.get('name')) r = r.filter(s => s.name.toLowerCase().includes(p.get('name')));
  return { ok: true, status: 200, json: async () => r }; };
const m = createMusic({ youtubeKey: 'k', fetchImpl });
let n = 0; const ok = s => console.log(`  ✓ ${++n}. ${s}`);
let r = await m.radio('cantonese music'); assert.deepEqual(r.map(s => s.id).filter(id => id !== 'hk4'), ['hk1', 'hk2']); assert.ok(!r.some(s => s.id === 'bad')); ok('"cantonese music" → Hong Kong Cantonese stations only (HLS stream skipped)');
r = await m.radio('cantopop'); assert.equal(r[0].id, 'hk1'); ok('"cantopop" → the Cantonese pop station first');
r = await m.radio('chinese pop radio'); assert.ok(r.some(s => s.id === 'tw1') && !r.some(s => s.id === 'us1')); ok('"chinese pop radio" → Mandarin/Chinese stations, no unrelated ones');
r = await m.radio('jazz'); assert.deepEqual(r.map(s => s.id), ['us1']); ok('"jazz" → jazz station');
r = await m.radio('swahili reggae'); assert.equal(r.length, 0); ok('nothing that fits → empty (it says so instead of playing something random)');
assert.deepEqual(parseTitle('陳奕迅 Eason Chan - 富士山下 (Official MV)'), { artist: '陳奕迅 Eason Chan', track: '富士山下' }); ok('Chinese song titles parse for lyrics');
r = await m.radio('rthk-radio-4'); assert.equal(r[0].id, 'hk4'); ok('a station by name, even written "rthk-radio-4"');
r = await m.radio('play RTHK Radio 4'); assert.equal(r[0].id, 'hk4'); ok('"play RTHK Radio 4" → that exact station first');
for (const q of ['988 fm malaysia', 'play 988 FM', '988 malaysia radio', 'malaysia 988 fm']) { r = await m.radio(q); assert.equal(r[0].id, 'my988', q); }
ok('"988 FM Malaysia" (any word order) → 988 FM first, not the more popular Malaysian stations');
for (const q of ['find channel 988 fm country malaysia', 'can you find 988 channel in malaysia', 'tune in to 98.8 malaysia', 'cari saluran 988 fm negara malaysia', 'search for 988 radio country malaysia']) { r = await m.radio(q); assert.equal(r[0].id, 'my988', q); }
assert.equal(tidyRadioRequest('find channel 988 fm country malaysia'), '988 fm malaysia');
assert.equal(tidyRadioRequest('country music'), 'country music');
ok('"find channel 988 fm country malaysia" (and other ways of asking) → 988 FM first');
for (const q of ['find find channel nine eight eight FM Country Malaysia', 'ninety eight point eight fm malaysia', 'putar sembilan delapan delapan fm', 'Thanks. Now I want to listen to some music. Find, find channel nine eight eight FM Country Malaysia.']) { r = await m.radio(q); assert.equal(r[0].id, 'my988', q); }
assert.equal(spokenNumbers('one oh one point five fm'), '101.5 fm'); assert.equal(spokenNumbers('I want one coffee'), 'I want one coffee');
ok('spoken numbers: "nine eight eight", "ninety eight point eight", "sembilan delapan delapan" → 988 / 98.8');
assert.ok(hosts.includes('de2.api.radio-browser.info') && hosts.includes('de1.api.radio-browser.info')); ok('a mirror that is down is skipped, the next one answers');
{ const dm = createMusic({ fetchImpl: async () => { throw new Error('ENOTFOUND'); } }); await assert.rejects(dm.radio('jazz'), /RADIO_DIRECTORY_UNREACHABLE/); ok('no internet → "can\'t reach the radio directory", not "no stations"'); }
console.log(`\nAll ${n} music checks passed.`);
