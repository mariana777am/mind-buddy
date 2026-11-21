// What you've been into lately, kept on this PC: music you asked for, the kinds of apps you use, games you play.
// No window titles are kept here, only categories (and the songs / stations you played). Used to inspire dreams.
const CATS = [
  ['ai chats', /claude|chatgpt|gemini|copilot|perplexity|hellominds/],
  ['team chat', /slack|teams|discord|whatsapp|telegram|line|wechat|zoom|meet\.google/],
  ['email', /outlook|gmail|thunderbird|\bmail\b/],
  ['coding', /visual studio|vs ?code|\bcode\b|cursor|intellij|pycharm|webstorm|terminal|powershell|cmd\.exe/],
  ['spreadsheets', /excel|google sheets|\.xlsx/],
  ['slides & docs', /powerpoint|google slides|keynote|word|google docs|notion|obsidian/],
  ['design', /figma|canva|photoshop|illustrator|lightroom|capcut|premiere/],
  ['videos', /youtube(?!.*music)|netflix|prime video|disney\+|vlc|twitch|vidio|viu|iqiyi|wetv|bilibili/],
  ['music apps', /spotify|youtube music|apple music|soundcloud|joox|deezer|kkbox|qq music/],
  ['travel planning', /booking\.com|airbnb|agoda|traveloka|skyscanner|tripadvisor|google maps|klook|trip\.com/],
  ['food delivery', /grabfood|\bgrab\b|foodpanda|gofood|gojek|shopeefood|ubereats/],
  ['shopping', /shopee|tokopedia|lazada|amazon|taobao|zalora/],
  ['social media', /instagram|facebook|tiktok|twitter|x\.com|reddit|threads|xiaohongshu|rednote/],
  ['games', /steam|epic games|minecraft|roblox|valorant|genshin|mobile legends|league of legends/],
  ['fitness', /strava|garmin|fitbit|nike run|alltrails|komoot/],
];
export function categorize(app, title){ const s = `${app || ''} ${title || ''}`.toLowerCase(); return (CATS.find(([, re]) => re.test(s)) || [])[0] || null; }

// scripts in a title → a hint for the Mind ("Chinese characters" etc.)
export function scriptOf(t){
  const s = String(t || '');
  if (/[぀-ヿ]/.test(s)) return 'Japanese';
  if (/[가-힯]/.test(s)) return 'Korean';
  if (/[一-鿿]/.test(s)) return 'Chinese';
  if (/[฀-๿]/.test(s)) return 'Thai';
  return null;
}

export function createHabits({ read, write, now = () => Date.now() }){
  const H = Object.assign({ music: [], apps: {}, games: {}, dreams: [] }, read() || {});
  let saveT = null; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => write(H), 3000); };
  const day = (t = now()) => new Date(t).toLocaleDateString('en-CA');
  const trimApps = () => { const keep = new Set(Array.from({ length: 7 }, (_, i) => day(now() - i * 86400000))); for (const d of Object.keys(H.apps)) if (!keep.has(d)) delete H.apps[d]; };

  return {
    data: H,
    // called every few seconds with the window in front (skip when off the record)
    app(appName, title, seconds = 5){ const c = categorize(appName, title); if (!c) return; const d = day(); (H.apps[d] ||= {})[c] = Math.round(((H.apps[d][c] || 0) + seconds / 60) * 10) / 10; trimApps(); save(); },
    // a song or station you asked for / that played
    music({ kind, query, title }){
      const text = String(title || query || '').slice(0, 90); if (!text) return;
      const last = H.music[H.music.length - 1]; if (last && last.text === text) return;
      H.music.push({ t: now(), kind: kind || '', text, query: String(query || '').slice(0, 60), script: scriptOf(text) || scriptOf(query) }); H.music = H.music.slice(-60); save();
    },
    game(name){ if (!name) return; H.games[name] = (H.games[name] || 0) + 1; save(); },
    addDream(d){ H.dreams.push({ ...d, t: now() }); H.dreams = H.dreams.slice(-16); save(); },
    dreams(){ return H.dreams.slice(); },
    lastDreamAt(){ return H.dreams.length ? H.dreams[H.dreams.length - 1].t : 0; },
    dreamsToday(){ return H.dreams.filter(d => day(d.t) === day()).length; },
    // a short "lately" summary for the Mind
    summary({ facts = [], dogName = '' } = {}){
      const L = [], since = now() - 7 * 86400000, mus = H.music.filter(m => m.t > since);
      if (mus.length){
        const scripts = {}; mus.forEach(m => m.script && (scripts[m.script] = (scripts[m.script] || 0) + 1));
        const words = {}; mus.forEach(m => String(m.query || '').toLowerCase().split(/\s+/).filter(w => w.length > 3 && !/^(play|some|radio|music|songs?|from|with)$/.test(w)).forEach(w => words[w] = (words[w] || 0) + 1));
        const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, n]) => `${w} ×${n}`).join(', ');
        L.push(`Music this week: ${mus.length} plays${Object.keys(scripts).length ? ' (titles in ' + Object.entries(scripts).map(([s, n]) => `${s} ×${n}`).join(', ') + ')' : ''}${top ? '. Most asked: ' + top : ''}. Recent: ${[...new Set(mus.slice(-6).map(m => m.text))].join(' · ')}.`);
      }
      const tot = {}; Object.values(H.apps).forEach(d => Object.entries(d).forEach(([c, m]) => tot[c] = (tot[c] || 0) + m));
      const topApps = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (topApps.length) L.push(`Time on the PC this week: ${topApps.map(([c, m]) => `${c} ${m >= 60 ? Math.round(m / 60) + ' h' : Math.round(m) + ' min'}`).join(', ')}.`);
      const g = Object.entries(H.games).sort((a, b) => b[1] - a[1]); if (g.length) L.push(`Arcade favourite: ${g[0][0]} (${g[0][1]} games).`);
      if (facts.length) L.push(`Things she told you: ${facts.slice(-10).join('; ')}.`);
      const d = new Date(now()); L.push(`It's ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.${dogName ? ` Her dog is called ${dogName}.` : ''}`);
      return L.join('\n');
    },
  };
}
