// Music: YouTube search (official Data API, your key), synced lyrics (LRCLIB, free) and internet radio (Radio Browser, free).
// Playback itself happens in the music window: the official YouTube embedded player, or an <audio> stream for radio.
const UA = { 'user-agent': 'MindsBuddy/1.0 (personal desktop buddy)' };

export function createMusic({ youtubeKey, fetchImpl = fetch, log = () => {} }){
  async function json(url, opts = {}){ const r = await fetchImpl(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) } }); if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`); return r.json(); }

  // ---------- YouTube ----------
  async function youtube(q){
    if (!youtubeKey) throw new Error('NO_YT_KEY');
    const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: '8', q, key: youtubeKey });
    const s = await json('https://www.googleapis.com/youtube/v3/search?' + p);
    const ids = (s.items || []).map(i => i.id?.videoId).filter(Boolean); if (!ids.length) return [];
    const v = await json('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({ part: 'contentDetails,snippet,status', id: ids.join(','), key: youtubeKey }));
    return (v.items || []).filter(i => i.status?.embeddable !== false && (i.snippet?.liveBroadcastContent || 'none') === 'none')
      .map(i => { const { artist, track } = parseTitle(decode(i.snippet.title), decode(i.snippet.channelTitle));
        return { id: i.id, title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle), thumb: i.snippet.thumbnails?.medium?.url, duration: isoSeconds(i.contentDetails?.duration), artist, track }; });
  }

  // ---------- lyrics (LRCLIB) ----------
  async function lyrics({ artist, track, duration }){
    const base = 'https://lrclib.net/api/';
    const tryGet = async () => { try { return await json(base + 'get?' + new URLSearchParams({ artist_name: artist, track_name: track, ...(duration ? { duration: String(Math.round(duration)) } : {}) })); } catch { return null; } };
    const trySearch = async q => { try { const r = await json(base + 'search?' + new URLSearchParams(q)); return (r || []).sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || Math.abs((a.duration || 0) - (duration || 0)) - Math.abs((b.duration || 0) - (duration || 0)))[0] || null; } catch { return null; } };
    let hit = artist && track ? await tryGet() : null;
    if (!hit?.syncedLyrics && artist && track) hit = (await trySearch({ track_name: track, artist_name: artist })) || hit;
    if (!hit?.syncedLyrics && track) hit = (await trySearch({ q: `${artist || ''} ${track}`.trim() })) || hit;
    if (!hit) return { synced: [], plain: '' };
    return { synced: parseLrc(hit.syncedLyrics || ''), plain: hit.plainLyrics || '', artist: hit.artistName, track: hit.trackName, instrumental: !!hit.instrumental };
  }

  // ---------- radio (Radio Browser): understands languages, countries, regions and genres ----------
  let servers = null, goodHost = null;
  async function radioServers(){                 // the directory runs on several mirrors; ask which are up, keep a fallback list
    if (servers) return [...servers];
    const fallback = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info'];
    try { const list = await json('https://all.api.radio-browser.info/json/servers', { signal: AbortSignal.timeout(5000) });
      servers = [...new Set([...(Array.isArray(list) ? list : []).map(s => String(s?.name || '').toLowerCase()).filter(n => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(n)), ...fallback])]; }
    catch (e) { log('radio server list failed:', e.message); servers = fallback; }
    return [...servers];
  }
  async function radio(q){
    const asked = q; q = tidyRadioRequest(q) || String(q || '').trim();
    if (q !== String(asked || '').toLowerCase().trim()) log(`radio: "${asked}" → searching "${q}"`);
    const want = parseRadioQuery(q);
    // station names: "RTHK Radio 4", "BBC Radio 1", "Prambors FM"
    const phrase = q.toLowerCase().replace(/\b(play|putar|setel|please|dong|yuk|the|stasiun)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const placeish = w => PLACES[w] || LANGS[w] || LANG_ALIAS[w];        // "malaysia" narrows the country; it isn't part of the name
    const nameWords = phrase.replace(new RegExp(`\\b(${Object.keys(PLACES).filter(k => k.includes(' ')).join('|')})\\b`, 'g'), ' ')
      .split(' ').filter(w => (w.length > 1 || /\d/.test(w)) && !/^(radio|fm|am|station|music|musik|lagu|online|live)$/.test(w) && !placeish(w));
    const distinctive = [...nameWords].sort((a, b) => (/\d/.test(b) - /\d/.test(a)) || b.length - a.length)[0];   // "988" beats "malaysia"
    // a frequency like "988" / "98.8" is enough on its own to identify the station; otherwise every name word must be there
    const strong = nameWords.filter(w => /\d/.test(w) && w.replace('.', '').length >= 3);
    const isNamed = name => nameWords.length > 0 && (strong.length ? strong.every(w => nameHas(name, w)) : nameWords.every(w => nameHas(name, w)));
    let failures = 0, calls = 0;
    const hosts = (await radioServers()).map(h => `https://${h}/json/stations/search?`);
    const get = async params => {
      for (const h of [...hosts]){                  // a copy: a failing mirror moves to the back for next time
        calls++;
        try { const r = await json(h + new URLSearchParams({ hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: '40', ...params }), { signal: AbortSignal.timeout(7000) }); goodHost = h; return r; }
        catch (e) { log('radio directory', new URL(h).hostname, 'failed:', e.message); hosts.push(hosts.splice(hosts.indexOf(h), 1)[0]); }
      }
      failures++; return [];
    };
    const tag = want.tags[0], reqs = [];
    want.langs.slice(0, 3).forEach(l => { reqs.push({ language: l, ...(tag ? { tag } : {}) }); if (tag) reqs.push({ language: l }); });
    want.ccs.slice(0, 5).forEach(cc => { reqs.push({ countrycode: cc, ...(tag ? { tag } : {}) }); if (tag && !want.langs.length) reqs.push({ countrycode: cc }); });
    if (!want.langs.length && !want.ccs.length && want.tags.length) { reqs.push({ tag: want.tags.join(' ') }, { tagList: want.tags.join(',') }, { name: want.tags.join(' ') }); if (want.tags.length > 1) reqs.push({ tag }); }
    if (phrase) reqs.push({ name: phrase }); if (nameWords.length) reqs.push({ name: nameWords.join(' ') }); if (distinctive) { reqs.push({ name: distinctive }); want.ccs.slice(0, 2).forEach(cc => reqs.push({ name: distinctive, countrycode: cc })); }
    strong.forEach(w => { const alt = /^\d{3,4}$/.test(w) ? w.slice(0, -1) + '.' + w.slice(-1) : /^\d+\.\d$/.test(w) ? w.replace('.', '') : '';
      if (alt) { reqs.push({ name: alt }); want.ccs.slice(0, 1).forEach(cc => reqs.push({ name: alt, countrycode: cc })); } });
    if (!reqs.length) reqs.push({});
    const all = (await Promise.all(reqs.map(get))).flat(), seen = new Set();
    if (failures === reqs.length) { const e = new Error('RADIO_DIRECTORY_UNREACHABLE'); throw e; }
    const ok = all.filter(st => st.lastcheckok === 1 && !st.hls && !/m3u8|\.pls$|\.m3u$|\.asx$/i.test(st.url_resolved || st.url || '') && (!st.codec || /mp3|aac|ogg|unknown/i.test(st.codec)) && (st.url_resolved || st.url) && !seen.has(st.stationuuid) && seen.add(st.stationuuid));
    log(`radio "${q}": ${all.length} found, ${ok.length} playable`);
    const score = st => { const lang = (st.language || '').toLowerCase(), tg = (st.tags || '').toLowerCase(), cc = (st.countrycode || '').toUpperCase(), name = (st.name || '').toLowerCase();
      let v = Math.log10((st.clickcount || 0) + 1) + Math.log10((st.votes || 0) + 1) * .5 + (/^https:/i.test(st.url_resolved || '') ? .6 : 0) - (/unknown/i.test(st.codec || '') ? 1 : 0);
      if (want.langs.some(l => lang.includes(l))) v += 4; if (want.ccs.includes(cc)) v += want.langs.length ? 1.5 : 3;
      want.tags.forEach(t => { if (tg.includes(t)) v += 2; if (name.includes(t)) v += 1; });
      const nameHits = nameWords.filter(w => nameHas(name, w)).length; if (nameWords.length && nameHits === nameWords.length) v += 8; else v += nameHits * 1.5; if (phrase.length > 3 && name.includes(phrase)) v += 4;
      return v; };
    const relevant = ok.filter(st => { const lang = (st.language || '').toLowerCase(), tg = (st.tags || '').toLowerCase(), cc = (st.countrycode || '').toUpperCase(), name = (st.name || '').toLowerCase();
      const byPlace = !want.langs.length && !want.ccs.length || want.langs.some(l => lang.includes(l) || tg.includes(l) || name.includes(l)) || want.ccs.includes(cc);
      const byGenre = !want.tags.length || want.tags.some(t => tg.includes(t) || name.includes(t)) || (want.langs.length || want.ccs.length);   // with a place, genre is a preference
      const byName = isNamed(name);
      return byName || (byPlace && byGenre); });
    // a station asked for by name always comes first; the rest are only a fallback
    const named = st => isNamed((st.name || '').toLowerCase()) && (!want.ccs.length || want.ccs.includes((st.countrycode || '').toUpperCase()) || !relevant.some(o => isNamed((o.name || '').toLowerCase()) && want.ccs.includes((o.countrycode || '').toUpperCase())));
    const exact = relevant.filter(named).sort((a, b) => score(b) - score(a)), others = relevant.filter(st => !named(st)).sort((a, b) => score(b) - score(a));
    if (exact.length) log(`radio "${q}": ${exact.length} station(s) named like that, playing those first`);
    return [...exact, ...(exact.length ? others.filter(st => !nameWords.length || nameWords.some(w => nameHas((st.name || '').toLowerCase(), w))).slice(0, 4) : others)].slice(0, 15).map(st => ({ id: st.stationuuid, name: (st.name || '').trim(), url: (st.url_resolved || st.url).trim(), favicon: st.favicon || '',
      country: st.country || '', language: st.language || '', tags: (st.tags || '').split(',').filter(Boolean).slice(0, 4), codec: st.codec, bitrate: st.bitrate }));
  }

  return { youtube, lyrics, radio };
}

// "cantonese pop", "chinese oldies radio", "radio hong kong", "east asia", "kpop" → languages, countries and genre tags
const LANGS = { cantonese: [['cantonese'], ['HK', 'MO']], chinese: [['chinese', 'mandarin'], ['CN', 'TW', 'HK', 'SG', 'MY']], mandarin: [['mandarin', 'chinese'], ['TW', 'CN', 'SG']],
  hokkien: [['hokkien', 'taiwanese'], ['TW', 'SG', 'MY']], japanese: [['japanese'], ['JP']], korean: [['korean'], ['KR']], tagalog: [['tagalog', 'filipino'], ['PH']], filipino: [['filipino', 'tagalog'], ['PH']],
  thai: [['thai'], ['TH']], vietnamese: [['vietnamese'], ['VN']], hindi: [['hindi'], ['IN']], tamil: [['tamil'], ['IN', 'LK', 'SG', 'MY']], malay: [['malay'], ['MY', 'BN', 'SG']], indonesian: [['indonesian'], ['ID']],
  arabic: [['arabic'], ['AE', 'SA', 'EG', 'LB']], spanish: [['spanish'], ['ES', 'MX', 'AR', 'CO']], french: [['french'], ['FR']], german: [['german'], ['DE', 'AT']], portuguese: [['portuguese'], ['BR', 'PT']],
  italian: [['italian'], ['IT']], russian: [['russian'], ['RU']], turkish: [['turkish'], ['TR']], english: [['english'], []], dutch: [['dutch'], ['NL']], persian: [['persian', 'farsi'], ['IR']] };
const LANG_ALIAS = { canto: 'cantonese', 'hong kong': 'cantonese', mandopop: 'mandarin', cpop: 'chinese', 'c-pop': 'chinese', kpop: 'korean', 'k-pop': 'korean', jpop: 'japanese', 'j-pop': 'japanese', opm: 'filipino',
  pinoy: 'filipino', bollywood: 'hindi', latin: 'spanish', 'bahasa': 'indonesian', mandarin: 'mandarin', taiwanese: 'hokkien', japan: 'japanese', korea: 'korean', china: 'chinese', thailand: 'thai', vietnam: 'vietnamese' };
const PLACES = { 'hong kong': ['HK'], hongkong: ['HK'], macau: ['MO'], taiwan: ['TW'], china: ['CN'], singapore: ['SG'], malaysia: ['MY'], indonesia: ['ID'], japan: ['JP'], korea: ['KR'], 'south korea': ['KR'],
  philippines: ['PH'], thailand: ['TH'], vietnam: ['VN'], india: ['IN'], australia: ['AU'], 'new zealand': ['NZ'], uk: ['GB'], england: ['GB'], britain: ['GB'], usa: ['US'], america: ['US'], canada: ['CA'],
  france: ['FR'], germany: ['DE'], italy: ['IT'], spain: ['ES'], netherlands: ['NL'], brazil: ['BR'], mexico: ['MX'], argentina: ['AR'], turkey: ['TR'], egypt: ['EG'], 'south africa': ['ZA'], nigeria: ['NG'],
  'east asia': ['CN', 'HK', 'TW', 'JP', 'KR', 'MO'], 'southeast asia': ['ID', 'MY', 'SG', 'PH', 'TH', 'VN'], asia: ['CN', 'HK', 'TW', 'JP', 'KR', 'ID', 'MY', 'SG', 'PH', 'TH', 'IN'],
  europe: ['GB', 'FR', 'DE', 'IT', 'ES', 'NL'], 'latin america': ['MX', 'BR', 'AR', 'CO', 'CL'], 'middle east': ['AE', 'SA', 'EG', 'TR', 'LB'], africa: ['NG', 'ZA', 'KE', 'GH'] };
const GENRE_ALIAS = { cantopop: ['pop'], mandopop: ['pop'], kpop: ['pop'], 'k-pop': ['pop'], jpop: ['pop'], 'j-pop': ['pop'], cpop: ['pop'], 'c-pop': ['pop'], opm: ['pop'], lagu: [], musik: [], lofi: ['lofi'], 'lo-fi': ['lofi'],
  'old songs': ['oldies'], oldies: ['oldies'], classic: ['classic hits'], 'love songs': ['love songs'], ballads: ['ballad'] };
// "nine eight eight" → "988", "ninety eight point eight" → "98.8", "sembilan puluh lapan" → "98"
const NUM1 = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, nol: 0, kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, lapan: 8, sembilan: 9 };
const NUM10 = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, sepuluh: 10, sebelas: 11 };
const NUMT = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMRE = new RegExp(`\\b(?:(?:${[...Object.keys(NUM1), ...Object.keys(NUM10), ...Object.keys(NUMT), 'hundred', 'ratus', 'seratus', 'puluh', 'point', 'dot', 'titik', 'koma'].join('|')})\\b[\\s-]*)+`, 'gi');
export function spokenNumbers(text){
  return String(text || '').replace(NUMRE, (m, off, all) => {
    const tk = m.toLowerCase().split(/[\s-]+/).filter(Boolean), after = all.slice(off + m.length);
    const nums = tk.filter(w => !/^(point|dot|titik|koma)$/.test(w));
    if (nums.length < 2 && !/^\s*(fm|am)\b/i.test(after)) return m;          // a lone "one" in a sentence stays a word
    let out = '', i = 0;
    const small = () => {                                                    // 0–99 starting at tk[i]
      const w = tk[i];
      if (w in NUMT) { let v = NUMT[w]; i++; if (tk[i] in NUM1 && NUM1[tk[i]] > 0) v += NUM1[tk[i++]]; return v; }
      if (w in NUM10) { i++; return NUM10[w]; }
      if (w in NUM1) { let v = NUM1[w]; i++; if (tk[i] === 'puluh') { i++; v *= 10; if (tk[i] in NUM1) v += NUM1[tk[i++]]; } return v; }
      return null; };
    while (i < tk.length){
      const w = tk[i];
      if (/^(point|dot|titik|koma)$/.test(w)) { if (out) out += '.'; i++; continue; }
      if (w === 'seratus') { i++; const r = small(); out += String(100 + (r ?? 0)); continue; }
      const start = i, v = small(); if (v === null) { i++; continue; }
      if (tk[i] === 'hundred' || tk[i] === 'ratus') { i++; const r = tk[i] && !/^(point|dot|titik|koma)$/.test(tk[i]) ? small() : null; out += String(v * 100 + (r ?? 0)); continue; }
      out += String(v);
    }
    return out + (/\s$/.test(m) ? ' ' : '');
  });
}

// "find channel 988 fm country malaysia" → "988 fm malaysia": drop the request words around the station
export function tidyRadioRequest(q){
  const isPlace = w => PLACES[w] || LANGS[w] || LANG_ALIAS[w];
  let t = ' ' + spokenNumbers(q).toLowerCase().replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/[-_]+/g, ' ').replace(/[?!,;:"“”]/g, ' ').replace(/\s+/g, ' ') + ' ';
  t = t.replace(/\b(country|negara|region|kawasan|wilayah|area)(\s+of)?\s+(\S+)/g, (m, a, o, w) => isPlace(w) ? ' ' + w : m);   // keeps "country music"
  t = t.replace(/\b(can|could|would) you\b|\b(i|aku|saya) (want|wanna|would like|mau|ingin|nak)( to)?\b|\b(please|pls|tolong|coba|cuba)\b/g, ' ')
       .replace(/\b(find|search( for)?|look( for| up)?|looking for|cari(kan)?|tune( in)?( to| into)?|listen( to)?|dengar(kan)?|put on|switch( to)?|change( to)?|ganti( ke)?|pasang|buka|open|get|now|some|thanks?|thank you|okay|ok)\b/g, ' ')
       .replace(/\b(channels?|saluran|frequency|frekuensi|for me|me|untuk aku|for)\b/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}
// "988" also matches "98.8", and "98.8" matches "988"
export const nameHas = (name, w) => name.includes(w) || (/^\d{3,4}$/.test(w) && name.includes(w.slice(0, -1) + '.' + w.slice(-1))) || (/^\d+\.\d$/.test(w) && name.includes(w.replace('.', '')));

export function parseRadioQuery(q){
  let t = ' ' + String(q || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ') + ' ';
  t = t.replace(/\b(play|playing|some|any|a|the|radio|radios|station|stations|music|songs?|please|from|in|of|putar|setel|stasiun|lagu|musik|dong|yuk|fm|am|online|live)\b/g, ' ');
  if (/\bcantopop\b/.test(t)) t += ' cantonese ';
  const langs = [], ccs = [], tags = [];
  for (const [k, v] of Object.entries(PLACES).sort((a, b) => b[0].length - a[0].length)) if (t.includes(' ' + k + ' ')) { v.forEach(c => ccs.includes(c) || ccs.push(c)); t = t.replace(' ' + k + ' ', ' '); }
  for (const w of t.split(/\s+/).filter(Boolean)){
    const lk = LANGS[w] ? w : LANG_ALIAS[w];
    if (lk && LANGS[lk]) { LANGS[lk][0].forEach(l => langs.includes(l) || langs.push(l)); if (!ccs.length) LANGS[lk][1].forEach(c => ccs.includes(c) || ccs.push(c)); if (!GENRE_ALIAS[w]) continue; }
    const g = GENRE_ALIAS[w]; if (g) { g.forEach(x => tags.includes(x) || tags.push(x)); continue; }
    if (w.length > 1 && !tags.includes(w)) tags.push(w);
  }
  return { langs, ccs, tags };
}

// "Artist - Song (Official Video) [4K]" → { artist, track }
export function parseTitle(title, channel = ''){
  let t = String(title || '').replace(/\[[^\]]*\]/g, ' ').replace(/\((?:[^)]*\b(?:official|video|audio|lyrics?|mv|m\/v|visuali[sz]er|hd|4k|remaster(?:ed)?|live|color coded|eng|sub)\b[^)]*)\)/gi, ' ')
    .replace(/\b(official\s+(music\s+)?video|official\s+audio|lyric\s+video|lyrics?|music\s+video|\bmv\b|\bhd\b)\b/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  const m = t.match(/^(.+?)\s+[-–—|]\s+(.+)$/);
  let artist, track;
  if (m) { artist = m[1]; track = m[2]; } else { artist = String(channel).replace(/\s*-\s*Topic$|VEVO$|\bofficial\b/gi, '').trim(); track = t; }
  track = track.replace(/\s*[([]?\b(?:ft|feat|featuring)\.?\s.+$/i, '').replace(/["“”]/g, '').trim();
  artist = artist.replace(/\s*[([]?\b(?:ft|feat|featuring)\.?\s.+$/i, '').trim();
  return { artist, track };
}
export function parseLrc(lrc){
  const out = [];
  for (const line of String(lrc).split(/\r?\n/)){
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)], text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) out.push({ t: Number(m[1]) * 60 + Number(m[2]), text });
  }
  return out.sort((a, b) => a.t - b.t);
}
export function isoSeconds(d){ const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0; }
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
