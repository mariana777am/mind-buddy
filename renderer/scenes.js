/* Minds Buddy — scenes and show-and-tell.
   Your Mind adds [scene:rain] or [show:🍜🍢] to a reply, and the buddy plays it: rain falls and it opens an umbrella,
   or it holds up the food it's suggesting. If the Mind forgets the tags, words in the reply are used instead. */
(() => {
'use strict';
const fx = document.getElementById('fx'), fc = fx.getContext('2d');
const FW = 280, FH = 360, CX = 140, CY = 260;                 // overlay size and head centre (CSS px)
function fit(){ const d = Math.max(1, devicePixelRatio || 1); fx.width = Math.round(FW * d); fx.height = Math.round(FH * d); fc.setTransform(d, 0, 0, d, 0, 0); }
fit(); addEventListener('resize', fit);

let scene = null;          // { name, t0, until }
let items = [];            // show-and-tell cards
const parts = [];
const rnd = (a, b) => a + Math.random() * (b - a);
const alpha = () => { if (!scene) return 0; const t = now(); return Math.max(0, Math.min(1, (t - scene.t0) / 600, (scene.until - t) / 900)); };

let seqT = [];
function play(name, ms = 9000){
  if (!name) return;
  const list = String(name).split(/[,>|\s]+/).filter(Boolean);
  if (list.length > 1){ seqT.forEach(clearTimeout); const each = Math.max(5000, ms / list.length);
    list.forEach((n, i) => seqT.push(setTimeout(() => play(n, each + (i < list.length - 1 ? 700 : 0)), i * each))); return; }
  scene = { name, t0: now(), until: now() + ms }; parts.length = 0;
  ({ storm: () => { S.mood = 'worried'; }, cold: () => { S.mood = 'worried'; }, sun: () => { S.mood = 'happy'; }, party: () => { act('dance', 2500); }, music: () => act('dance', 2500),
     love: () => { S.eyeStyle = 'heart'; S.eyeUntil = now() + 3000; }, rainbow: () => { S.eyeStyle = 'stars'; S.eyeUntil = now() + 2000; } })[name]?.();
  window.PET?.sfx?.(name === 'storm' ? 'whoosh' : 'pop');
}
// The Mind's own animation recipe: [fx:🌋🔥|rise|fast|#ff6a00]. Only emoji, a motion name, a speed and a colour:
// your Mind invents the look, but never runs code on your PC.
let custom = null;
function playFx(recipe, ms = 9000){
  const [chars, motion = 'float', speed = 'normal', tint = ''] = String(recipe).split('|').map(x => x.trim());
  const em = toEmoji(chars).slice(0, 4); if (!em.length) return;
  const sp = { slow: .6, normal: 1, fast: 1.8 }[speed.toLowerCase()] || 1;
  const col = /^#[0-9a-f]{3,8}$/i.test(tint) ? tint : null;
  custom = { em, motion: ['fall', 'rise', 'float', 'fly', 'swirl', 'burst', 'rain'].includes(motion.toLowerCase()) ? motion.toLowerCase() : 'float', sp, col, t0: now(), until: now() + ms, ps: [] };
  if (custom.motion === 'burst') for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, v = rnd(.8, 2.2) * Math.min(1.3, sp); custom.ps.push({ x: CX, y: CY - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, ch: em[i % em.length], s: rnd(14, 24), r: rnd(0, 6), born: now() }); }
  window.PET?.sfx?.('pop'); S.antV += .5;
}
function drawCustom(t){
  const c = custom; if (!c) return; if (t > c.until + 900) { custom = null; return; }
  const a = Math.max(0, Math.min(1, (t - c.t0) / 600, (c.until + 900 - t) / 900));
  fc.save(); fc.globalAlpha = a;
  if (c.col) { const g = fc.createRadialGradient(CX, CY - 40, 20, CX, CY - 40, 260); g.addColorStop(0, c.col + '00'); g.addColorStop(1, (c.col.length === 7 ? c.col + '55' : c.col)); fc.fillStyle = g; fc.fillRect(0, 0, FW, FH); }
  const want = { rain: 45, fall: 22, rise: 22, float: 14, fly: 12, swirl: 10, burst: 0 }[c.motion];
  if (t < c.until && c.ps.length < want) {
    const ch = c.em[Math.floor(Math.random() * c.em.length)], s = c.motion === 'rain' ? rnd(10, 14) : rnd(14, 24);
    const p = { fall: { x: rnd(0, FW), y: -20, vx: 0, vy: rnd(1, 2) }, rain: { x: rnd(0, FW), y: -20, vx: -.5, vy: rnd(4, 6) }, rise: { x: rnd(0, FW), y: FH + 20, vx: 0, vy: -rnd(1, 2.2) },
      float: { x: rnd(0, FW), y: rnd(20, FH - 20), vx: rnd(-.4, .4), vy: rnd(-.4, .4) }, fly: { x: -20, y: rnd(30, FH - 40), vx: rnd(1.5, 3), vy: 0 }, swirl: { a: rnd(0, 6.28), d: rnd(80, 120), x: 0, y: 0, vx: 0, vy: 0 } }[c.motion];
    c.ps.push({ ...p, ch, s, r: rnd(0, 6), born: t });
  }
  fc.textAlign = 'center'; fc.textBaseline = 'middle';
  for (let i = c.ps.length - 1; i >= 0; i--) {
    const p = c.ps[i]; p.r += .03;
    if (c.motion === 'swirl') { p.a += .02 * c.sp; p.x = CX + Math.cos(p.a) * p.d; p.y = CY - 20 + Math.sin(p.a) * p.d * .6; }
    else { p.x += (p.vx + (c.motion === 'fall' || c.motion === 'rise' ? Math.sin(p.r) * .6 : 0)) * c.sp; p.y += (p.vy + (c.motion === 'fly' ? Math.sin(p.r * 2) * .8 : 0)) * c.sp; if (c.motion === 'burst') { p.vy += .03; p.vx *= .995; } }
    if (p.x < -30 || p.x > FW + 30 || p.y < -30 || p.y > FH + 30 || (c.motion === 'float' && t - p.born > 6000)) { c.ps.splice(i, 1); continue; }
    fc.font = `${p.s}px "Segoe UI Emoji",system-ui`; fc.save(); fc.translate(p.x, p.y); fc.rotate(Math.sin(p.r) * .3); fc.fillText(p.ch, 0, 0); fc.restore();
  }
  fc.restore();
}
function show(list, ms = 9000){
  const em = toEmoji(list).slice(0, 3); if (!em.length) return;
  const t = now(); items = em.map((ch, i) => ({ ch, t0: t + i * 260, until: t + ms + i * 200 }));
  S.lookT = { x: -1, y: .1 }; window.PET?.sfx?.('pop');
}
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;
function toEmoji(v){
  if (Array.isArray(v)) return v;
  const s = String(v || ''), found = s.match(EMOJI);
  if (found?.length) return found;
  return foodsIn(s);                                          // [show:nasi goreng] written as words
}

// ---------- word fallbacks ----------
const FOOD = Object.entries({ 'nasi goreng': '🍛', 'fried rice': '🍛', rendang: '🍛', curry: '🍛', kari: '🍛', 'nasi padang': '🍛', nasi: '🍚', rice: '🍚', sate: '🍢', satay: '🍢', bakso: '🍲',
  soto: '🍲', soup: '🍲', sup: '🍲', 'mie ayam': '🍜', mie: '🍜', mi: '🍜', noodles: '🍜', noodle: '🍜', ramen: '🍜', pho: '🍜', laksa: '🍜', spaghetti: '🍝', pasta: '🍝', pizza: '🍕', burger: '🍔',
  sandwich: '🥪', sushi: '🍣', dumplings: '🥟', dumpling: '🥟', 'dim sum': '🥟', dimsum: '🥟', siomay: '🥟', pangsit: '🥟', taco: '🌮', tacos: '🌮', salad: '🥗', 'gado-gado': '🥗', 'gado gado': '🥗',
  steak: '🥩', 'ayam goreng': '🍗', ayam: '🍗', chicken: '🍗', fish: '🐟', ikan: '🐟', shrimp: '🍤', udang: '🍤', egg: '🍳', eggs: '🍳', telur: '🍳', martabak: '🥞', pancake: '🥞', pancakes: '🥞',
  bread: '🍞', roti: '🍞', toast: '🍞', croissant: '🥐', cake: '🍰', kue: '🍰', donut: '🍩', donat: '🍩', cookie: '🍪', cookies: '🍪', 'ice cream': '🍨', 'es krim': '🍨', chocolate: '🍫', cokelat: '🍫',
  coklat: '🍫', banana: '🍌', pisang: '🍌', 'pisang goreng': '🍌', mango: '🥭', mangga: '🥭', apple: '🍎', apel: '🍎', watermelon: '🍉', semangka: '🍉', strawberry: '🍓', grapes: '🍇', coffee: '☕', kopi: '☕',
  latte: '☕', tea: '🍵', teh: '🍵', 'es teh': '🧋', boba: '🧋', 'bubble tea': '🧋', juice: '🧃', jus: '🧃', smoothie: '🥤', fries: '🍟', 'french fries': '🍟', bubur: '🥣', porridge: '🥣', oatmeal: '🥣',
  yogurt: '🥣', popcorn: '🍿', 'hot dog': '🌭', hotdog: '🌭', kebab: '🥙', burrito: '🌯', cheese: '🧀', keju: '🧀', avocado: '🥑', alpukat: '🥑', corn: '🌽', jagung: '🌽', 'dim-sum': '🥟', bento: '🍱',
  onigiri: '🍙', garlic: '🧄', bawang: '🧅', onion: '🧅', butter: '🧈', mentega: '🧈', chili: '🌶️', cabai: '🌶️', sambal: '🌶️', tomato: '🍅', tomat: '🍅', potato: '🥔', kentang: '🥔', carrot: '🥕', wortel: '🥕', mushroom: '🍄', jamur: '🍄', broccoli: '🥦', lemon: '🍋', jeruk: '🍊', orange: '🍊', honey: '🍯', madu: '🍯', milk: '🥛', susu: '🥛', 'omelette': '🍳', omelet: '🍳', 'indomie': '🍜', 'nasi uduk': '🍚', 'nasi kuning': '🍚', 'coto makassar': '🍲', coto: '🍲', konro: '🍖', 'pisang epe': '🍌', pallubasa: '🍲', ribs: '🍖', bbq: '🍖', grill: '🍖', 'hot chocolate': '☕', wedang: '🍵', 'teh tarik': '🧋', 'fried chicken': '🍗', wings: '🍗', pie: '🥧', waffle: '🧇', bagel: '🥯', 'pad thai': '🍜', kimchi: '🥬', 'bibimbap': '🍲', tempura: '🍤', gyoza: '🥟' }).sort((a, b) => b[0].length - a[0].length);
function foodsIn(text){
  let t = ' ' + String(text).toLowerCase() + ' '; const out = [];
  for (const [k, e] of FOOD){ const re = new RegExp(`[^\\p{L}]${k.replace(/[-\s]/g, '[-\\s]?')}s?[^\\p{L}]`, 'u'); if (re.test(t)) { if (!out.includes(e)) out.push(e); t = t.replace(re, ' '); } if (out.length >= 3) break; }
  return out;
}
const WEATHER = [['storm', /thunder|storm|lightning|badai|petir|guntur|hujan deras|heavy rain/], ['rain', /rain|drizzle|shower|hujan|gerimis/], ['snow', /snow|salju|sleet/],
  ['fog', /fog|mist|haze|kabut/], ['wind', /windy|wind|gusty|berangin|angin kencang/], ['hot', /\bhot\b|scorching|heatwave|panas|gerah|humid|lembap/],
  ['cold', /freezing|very cold|chilly|dingin/], ['sun', /sunny|clear sky|clear skies|sunshine|cerah/], ['cloudy', /cloudy|overcast|clouds|berawan|mendung/]];
function react(r, userText = ''){
  if (!r) return;
  const reply = String(r.text || '').toLowerCase(), asked = String(userText).toLowerCase();
  let sc = r.scene, sh = r.show;
  if (!sc && /weather|cuaca|forecast|prakiraan|rain|hujan|umbrella|payung|outside|di luar|temperature|suhu/.test(asked + ' ' + reply) && /°|degrees|derajat|weather|cuaca|forecast|rain|hujan|sunny|cerah|cloud|mendung|berawan/.test(reply))
    { const hits = WEATHER.map(([n, re]) => { const m = reply.match(re); return m ? [n, m.index] : null; }).filter(Boolean).sort((a, b) => a[1] - b[1]);
      const order = []; for (const [n] of hits) if (!order.includes(n) && !(n === 'sun' && order.includes('hot'))) order.push(n);
      sc = order.slice(0, 2).join(',') || null; }
  if (!sc && /congrat|selamat|happy birthday|ulang tahun|hooray|we did it|you won/.test(reply)) sc = 'party';
  if (sh && !toEmoji(sh).length) sh = foodsIn(sh + ' ' + reply);
  const foodTalk = /eat|food|lunch|dinner|breakfast|hungry|snack|drink|recipe|cook|menu|meal|makan|lapar|sarapan|minum|resep|masak|kuliner|jajan|ngemil/.test(asked) ||
    /how about|try (?:a|some|the)|you could (?:make|have|eat)|recipe|ready in|bagaimana kalau|gimana kalau|coba (?:makan|bikin|masak)/.test(reply);
  if ((!sh || !toEmoji(sh).length) && foodTalk) { const f = foodsIn(reply); sh = f.length ? f : (/eat|food|lunch|dinner|breakfast|hungry|recipe|cook|meal|makan|lapar|resep|masak/.test(asked + ' ' + reply) ? ['🍽️'] : null); }
  if (r.fx) playFx(r.fx, Math.max(8000, Math.min(16000, reply.length * 70)));
  if (sc) play(sc, Math.max(8000, Math.min(16000, reply.length * 70)));
  if (sh) show(sh, Math.max(8000, Math.min(15000, reply.length * 70)));
}

// ---------- overlay (behind the bubble, around the whole buddy) ----------
function cloud(x, y, k, col){ fc.fillStyle = col; fc.beginPath(); [[0, 0, 22], [20, -10, 20], [42, 0, 22], [22, 8, 20], [-16, 6, 14], [58, 8, 14]].forEach(([dx, dy, r]) => { fc.moveTo(x + dx * k + r * k, y + dy * k); fc.arc(x + dx * k, y + dy * k, r * k, 0, 7); }); fc.fill(); }
function frame(){
  const t = now(); fc.clearRect(0, 0, FW, FH);
  if (scene && t > scene.until) scene = null;
  if (scene){
    const a = alpha(), n = scene.name; fc.save(); fc.globalAlpha = a;
    if (n === 'rain' || n === 'storm'){
      const dark = n === 'storm';
      for (let i = 0; i < 3; i++) cloud(30 + i * 85 + Math.sin(t / 2000 + i) * 8, 40 + (i % 2) * 14, .9, dark ? '#5b6378' : '#b9c3d6');
      if (parts.length < (dark ? 90 : 55)) parts.push({ x: rnd(0, FW), y: rnd(40, 70), v: rnd(5, 8) * (dark ? 1.3 : 1), l: rnd(8, 14) });
      fc.strokeStyle = '#9ecbff'; fc.lineWidth = 1.6; fc.lineCap = 'round';
      for (let i = parts.length - 1; i >= 0; i--){ const p = parts[i]; p.y += p.v; p.x -= dark ? 1.6 : .6;
        const onUmbrella = buddyAt && !S.asleep && Math.abs(p.x - (buddyAt.x + 4)) < 72 && Math.abs(p.y - (buddyAt.y + CANVAS_TOP - buddyAt.R * 1.5)) < 9;
        if (p.y > FH - 12 || onUmbrella){ fc.beginPath(); fc.arc(p.x, p.y, 3, Math.PI, 0); fc.stroke(); parts.splice(i, 1); continue; }
        fc.beginPath(); fc.moveTo(p.x, p.y); fc.lineTo(p.x + (dark ? 2.5 : 1), p.y - p.l); fc.stroke(); }
      if (dark && Math.random() < .012) scene.flash = t;
      if (dark && t - (scene.flash || 0) < 180){ fc.fillStyle = '#ffffffaa'; fc.fillRect(0, 0, FW, FH); fc.strokeStyle = '#fff59d'; fc.lineWidth = 3; fc.beginPath();
        let x = rnd(40, 240), y = 60; fc.moveTo(x, y); for (let k = 0; k < 5; k++){ x += rnd(-18, 18); y += 24; fc.lineTo(x, y); } fc.stroke(); if (t - scene.flash < 20) window.PET?.sfx?.('bounce'); }
    }
    if (n === 'snow' || n === 'sakura' || n === 'money' || n === 'love' || n === 'party' || n === 'music'){
      const ch = { snow: null, sakura: '🌸', money: '💸', love: '💗', party: null, music: null }[n];
      if (parts.length < (n === 'snow' ? 60 : n === 'party' ? 70 : 22)) parts.push({ x: rnd(0, FW), y: n === 'love' || n === 'music' ? FH + 10 : -10, v: rnd(.6, 1.6), w: rnd(0, 6.28), s: rnd(2, 4.5),
        c: ['#ff5fa2', '#ffd84d', '#4ade80', '#60a5fa', '#c084fc'][Math.floor(rnd(0, 5))], ch: n === 'music' ? (Math.random() < .5 ? '♪' : '♫') : ch });
      for (let i = parts.length - 1; i >= 0; i--){ const p = parts[i]; const up = n === 'love' || n === 'music';
        p.y += up ? -p.v * 1.2 : p.v * (n === 'party' ? 2 : 1); p.w += .04; p.x += Math.sin(p.w) * .7;
        if (p.y > FH + 12 || p.y < -14){ parts.splice(i, 1); continue; }
        if (n === 'snow'){ fc.fillStyle = '#ffffff'; fc.beginPath(); fc.arc(p.x, p.y, p.s, 0, 7); fc.fill(); }
        else if (n === 'party'){ fc.save(); fc.translate(p.x, p.y); fc.rotate(p.w * 2); fc.fillStyle = p.c; fc.fillRect(-3, -1.5, 6, 3); fc.restore(); }
        else { fc.font = `${n === 'music' ? 'bold 16px system-ui' : '15px "Segoe UI Emoji",system-ui'}`; fc.fillStyle = '#cfe3ff'; fc.fillText(p.ch, p.x, p.y); } }
      if (n === 'party'){ for (let i = 0; i < 4; i++){ const g = fc.createRadialGradient(40 + i * 66, 30, 2, 40 + i * 66, 30, 60); g.addColorStop(0, ['#ff5fa255', '#ffd84d55', '#4ade8055', '#60a5fa55'][(i + Math.floor(t / 400)) % 4]); g.addColorStop(1, '#0000'); fc.fillStyle = g; fc.fillRect(0, 0, FW, 140); } }
    }
    if (n === 'sun' || n === 'hot'){
      const sx = 232, sy = 52; fc.save(); fc.translate(sx, sy); fc.rotate(t / 3000); fc.strokeStyle = '#ffd84d'; fc.lineWidth = 3.5; fc.lineCap = 'round';
      for (let i = 0; i < 10; i++){ fc.rotate(Math.PI / 5); fc.beginPath(); fc.moveTo(30, 0); fc.lineTo(40 + Math.sin(t / 200 + i) * 4, 0); fc.stroke(); } fc.restore();
      const g = fc.createRadialGradient(sx - 6, sy - 6, 4, sx, sy, 25); g.addColorStop(0, '#fff6b0'); g.addColorStop(1, '#ffb703'); fc.fillStyle = g; fc.beginPath(); fc.arc(sx, sy, 24, 0, 7); fc.fill();
      if (n === 'hot'){ fc.strokeStyle = '#ffb70366'; fc.lineWidth = 2; for (let i = 0; i < 4; i++){ fc.beginPath(); for (let y = 330; y > 180; y -= 6) fc.lineTo(50 + i * 60 + Math.sin(y / 12 + t / 250) * 4, y); fc.stroke(); } }
    }
    if (n === 'cloudy') for (let i = 0; i < 4; i++) cloud(((t / 40 + i * 90) % (FW + 120)) - 60, 34 + (i % 2) * 22, .8, i % 2 ? '#c9d2e3' : '#aeb9cf');
    if (n === 'wind'){
      fc.strokeStyle = '#e6f0ffaa'; fc.lineWidth = 2; fc.lineCap = 'round';
      for (let i = 0; i < 6; i++){ const y = 60 + i * 45, x = ((t / 3 + i * 97) % (FW + 140)) - 70; fc.beginPath(); fc.moveTo(x, y); fc.quadraticCurveTo(x + 30, y - 8, x + 60, y); fc.stroke(); }
      if (parts.length < 6) parts.push({ x: -10, y: rnd(80, 330), v: rnd(2, 4), w: 0 });
      fc.font = '16px "Segoe UI Emoji",system-ui'; for (let i = parts.length - 1; i >= 0; i--){ const p = parts[i]; p.x += p.v; p.w += .2; p.y += Math.sin(p.w) * 1.2; if (p.x > FW + 10){ parts.splice(i, 1); continue; } fc.fillText('🍃', p.x, p.y); }
      S.antV += Math.sin(t / 150) * .02;
    }
    if (n === 'fog'){ for (let i = 0; i < 4; i++){ fc.fillStyle = '#e8eef8' + ['30', '40', '28', '38'][i]; const x = Math.sin(t / 2500 + i) * 30; fc.beginPath(); fc.ellipse(CX + x + (i - 1.5) * 50, 150 + i * 50, 170, 22, 0, 0, 7); fc.fill(); } }
    if (n === 'cold'){ fc.fillStyle = '#bfe3ff22'; fc.fillRect(0, 0, FW, FH); if (Math.random() < .2) S.antV += (Math.random() - .5) * .3; }
    if (n === 'night'){ const g = fc.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#0b1033cc'); g.addColorStop(1, '#0b103300'); fc.fillStyle = g; fc.fillRect(0, 0, FW, FH);
      fc.fillStyle = '#fff7c2'; fc.beginPath(); fc.arc(228, 50, 20, 0, 7); fc.fill(); fc.fillStyle = '#0b1033'; fc.beginPath(); fc.arc(238, 44, 18, 0, 7); fc.fill();
      for (let i = 0; i < 18; i++){ fc.fillStyle = `rgba(255,255,255,${.4 + .6 * Math.abs(Math.sin(t / 500 + i * 7))})`; fc.fillRect((i * 67) % FW, (i * 37) % 170, 2, 2); } }
    if (n === 'rainbow'){ ['#ff5f5f', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].forEach((c, i) => { fc.strokeStyle = c; fc.lineWidth = 7; fc.beginPath(); fc.arc(CX, CY + 10, 125 - i * 7, Math.PI * 1.05, Math.PI * 1.95); fc.stroke(); }); }
    fc.restore();
  }
  drawCustom(t);
  drawUmbrella(t);
  // show-and-tell cards on the left of the buddy
  items = items.filter(it => t < it.until + 400);
  items.forEach((it, i) => {
    if (t < it.t0) return;
    const p = Math.min(1, (t - it.t0) / 350), out = Math.max(0, Math.min(1, (it.until - t) / 400)), k = (p < 1 ? 1 + Math.sin(p * Math.PI) * .25 : 1) * p * out;
    const x = 40, y = 205 + i * 52 + Math.sin(t / 400 + i) * 3;
    fc.save(); fc.translate(x, y); fc.scale(k, k); fc.rotate(Math.sin(t / 600 + i) * .06);
    fc.fillStyle = '#fffdf5'; fc.strokeStyle = '#1d2240'; fc.lineWidth = 2.5; fc.beginPath(); fc.roundRect(-23, -23, 46, 46, 12); fc.fill(); fc.stroke();
    fc.font = '28px "Segoe UI Emoji",system-ui'; fc.textAlign = 'center'; fc.textBaseline = 'middle'; fc.fillText(it.ch, 0, 2);
    if (Math.sin(t / 300 + i * 2) > .95) { fc.font = '11px system-ui'; fc.fillText('✨', 20, -20); }
    fc.restore();
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- things worn on the buddy during a scene (drawn on the main canvas) ----------
let buddyAt = null;
const CANVAS_TOP = 130;      // the buddy's canvas starts 130px down the window
function drawUmbrella(t){
  if (!scene || S.asleep || !buddyAt || !(scene.name === 'rain' || scene.name === 'storm')) return;
  const a = alpha(); if (!a) return;
  const { x, y, R } = buddyAt, r = R + 14, storm = scene.name === 'storm';
  fc.save(); fc.globalAlpha = a;
  fc.translate(x + 30, y + CANVAS_TOP + R * .55);                 // hand position, lower right of the head
  fc.rotate(-.32 + (storm ? Math.sin(t / 50) * .07 : Math.sin(t / 800) * .03));
  const top = -(R * 1.55 + 10);                                   // canopy centre, above the head
  fc.strokeStyle = '#3a3f4f'; fc.lineWidth = 3; fc.lineCap = 'round';
  fc.beginPath(); fc.moveTo(0, top); fc.lineTo(0, 0); fc.arc(7, 0, 7, Math.PI, 0, true); fc.stroke();   // shaft + hook
  const cols = ['#ff5f5f', '#ffd84d'];
  for (let i = 0; i < 6; i++){ fc.fillStyle = cols[i % 2]; fc.beginPath(); fc.moveTo(0, top); fc.arc(0, top, r, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); fc.closePath(); fc.fill(); }
  fc.strokeStyle = '#1d2240'; fc.lineWidth = 2; fc.beginPath(); fc.arc(0, top, r, Math.PI, 0); fc.stroke();
  fc.fillStyle = '#ffffff40'; fc.beginPath(); fc.ellipse(-r * .45, top - r * .55, r * .25, 6, -.5, 0, 7); fc.fill();
  fc.strokeStyle = '#3a3f4f'; fc.lineWidth = 3; fc.beginPath(); fc.moveTo(0, top - r); fc.lineTo(0, top - r - 7); fc.stroke();
  fc.restore();
}
function drawOnBuddy(cx, t, x, y, R){
  if (!scene || S.asleep) return;
  const a = alpha(), n = scene.name; if (!a) return;
  cx.save(); cx.globalAlpha = a;
  buddyAt = { x, y, R };   // the umbrella is drawn on the full-window layer (see drawUmbrella) so it never gets cut off
  if (n === 'snow' || n === 'cold'){                          // scarf
    cx.translate(x, y + R * .86); cx.fillStyle = '#ef4444'; cx.beginPath(); cx.ellipse(0, 0, R * .62, 9, 0, 0, 7); cx.fill();
    cx.fillStyle = '#ffffff'; for (let i = -3; i <= 3; i++) cx.fillRect(i * 10 - 2, -8, 4, 16);
    cx.fillStyle = '#ef4444'; cx.save(); cx.rotate(.25 + Math.sin(t / 300) * .1); cx.fillRect(R * .3, 0, 12, 30); cx.restore();
    if (n === 'cold' && Math.random() < .03) S.antV += .3;
  }
  if (n === 'snow'){ cx.restore(); cx.save(); cx.globalAlpha = a; cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(x - 6, y - R + 4, 26, 9, -.1, Math.PI, 0); cx.fill(); }
  if (n === 'hot'){ const d = (t / 900) % 1; cx.fillStyle = '#9ad1ff'; cx.beginPath(); const sx = x + R * .62, sy = y - R * .35 + d * 18; cx.moveTo(sx, sy - 8); cx.quadraticCurveTo(sx + 6, sy, sx, sy + 5); cx.quadraticCurveTo(sx - 6, sy, sx, sy - 8); cx.fill(); }
  if (n === 'sun' && !window.PET?._state?.focus){             // sunny = sunglasses
    const ey = y - R * .12, gap = R * .27; cx.fillStyle = '#111827cc'; [-1, 1].forEach(s => { cx.beginPath(); cx.roundRect(x + s * gap - 17, ey - 11, 34, 22, 9); cx.fill(); }); cx.fillRect(x - 6, ey - 6, 12, 4);
  }
  cx.restore();
}

window.SCENES = { play, show, playFx, react, drawOnBuddy, foodsIn };
})();
