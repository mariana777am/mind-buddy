/* Buddy Arcade — you vs the computer, with your Mind doing the trash talk.
   Rendered like an interactive light projection: additive light, bloom, soft projected edges,
   a beam from the buddy's side, and everything glowing. */
(() => {
'use strict';
const A = window.arcade || mockArcade();
const cv = document.getElementById('g'), out = cv.getContext('2d');
const menuEl = document.getElementById('menu'), overEl = document.getElementById('over');
const WW = 760, HH = 540, PAD = 20, W = 720, H = 500;            // window, and the projected surface inside it
const off = document.createElement('canvas'), g = off.getContext('2d');   // the game is drawn here, then projected
const bloomC = document.createElement('canvas'), bl = bloomC.getContext('2d'); bloomC.width = 180; bloomC.height = 125;
const maskC = document.createElement('canvas'), mk = maskC.getContext('2d');
let DPR = 1;
function fit(){
  DPR = Math.max(1, devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR); out.setTransform(cv.width / WW, 0, 0, cv.height / HH, 0, 0);
  off.width = Math.round(W * DPR); off.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  maskC.width = off.width; maskC.height = off.height; mk.setTransform(DPR, 0, 0, DPR, 0, 0);
  mk.clearRect(0, 0, W, H); mk.filter = 'blur(16px)'; mk.fillStyle = '#fff'; mk.beginPath(); mk.roundRect(22, 22, W - 44, H - 44, 40); mk.fill(); mk.filter = 'none';   // soft projected edges
}
addEventListener('resize', fit); fit();
const now = () => performance.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const Q = new URLSearchParams(location.search);
let NAME = 'Buddy';
A.info?.().then(i => { if (i?.name) NAME = i.name; }).catch(() => {});

// ---------- light helpers ----------
const sprites = {};
function sprite(col){                                            // soft round light, cached per colour
  if (sprites[col]) return sprites[col];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, col); gr.addColorStop(.25, col + 'aa'); gr.addColorStop(.6, col + '22'); gr.addColorStop(1, col + '00'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return (sprites[col] = c);
}
function glow(x, y, r, col, a = 1){ g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.drawImage(sprite(col), x - r, y - r, r * 2, r * 2); g.restore(); }
function neon(path, col, w = 3, a = 1){                          // a line that glows: wide faint halo, then a bright core
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = g.lineJoin = 'round';
  [[w * 4, .06], [w * 2, .18], [w, .85], [w * .35, .8]].forEach(([lw, al], i) => { g.globalAlpha = al * a; g.lineWidth = lw; g.strokeStyle = i === 3 ? '#ffffff' : col; g.beginPath(); path(); g.stroke(); });
  g.restore();
}
function nebula(pal, seed = 1){                                  // a painted background, made once per game
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, pal.top); gr.addColorStop(1, pal.bottom); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 16; i++){ const px = r() * W, py = r() * H, rr = 120 + r() * 260, col = pal.blobs[i % pal.blobs.length], b = x.createRadialGradient(px, py, 0, px, py, rr);
    b.addColorStop(0, col + '1a'); b.addColorStop(1, col + '00'); x.fillStyle = b; x.fillRect(0, 0, W, H); }
  for (let i = 0; i < 600; i++){ x.fillStyle = `rgba(255,255,255,${r() * .28})`; x.fillRect(r() * W, r() * H, r() < .9 ? 1 : 1.6, 1); }
  return c;
}
const twinkles = Array.from({ length: 140 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(.6, 2.2), ph: rnd(0, 6.28), sp: rnd(1, 3), c: pick(['#9fe6ff', '#e6b8ff', '#fff3b0', '#ffffff']) }));
function drawTwinkles(t, a = 1){ g.save(); g.globalCompositeOperation = 'lighter'; twinkles.forEach(p => { const k = (Math.sin(t * p.sp + p.ph) + 1) / 2; g.globalAlpha = a * (.15 + k * .85); g.drawImage(sprite(p.c), p.x - p.s * 3, p.y - p.s * 3, p.s * 6, p.s * 6); }); g.restore(); }

// ---------- input ----------
const keys = new Set(), mouse = { x: W / 2, y: H / 2, down: false, clicked: false };
addEventListener('keydown', e => { keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape') A.close(); if (e.code === 'KeyP' && game) paused = !paused; });
addEventListener('keyup', e => keys.delete(e.code));
const toLocal = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * WW - PAD, y: (e.clientY - r.top) / r.height * HH - PAD }; };
cv.addEventListener('mousemove', e => Object.assign(mouse, toLocal(e)));
cv.addEventListener('mousedown', e => { Object.assign(mouse, toLocal(e)); mouse.down = true; mouse.clicked = true; if (paused) paused = false; });
addEventListener('mouseup', () => mouse.down = false);
addEventListener('blur', () => { if (game && phase === 'play') paused = true; keys.clear(); });
document.getElementById('close').onclick = () => A.close();
const k = (...c) => c.some(x => keys.has(x));

// ---------- sound (soft, synthy) ----------
let ac = null;
function sfx(name, vol = 1){
  try {
    ac ||= new AudioContext(); const a = ac, t0 = a.currentTime, out2 = a.createGain(); out2.gain.value = .07 * vol; out2.connect(a.destination);
    const tone = (f1, f2, d, type = 'sine', at = 0, gn = 1) => { const o = a.createOscillator(), e = a.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t0 + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + at + d);
      e.gain.setValueAtTime(0, t0 + at); e.gain.linearRampToValueAtTime(gn, t0 + at + .01); e.gain.exponentialRampToValueAtTime(.001, t0 + at + d); o.connect(e); e.connect(out2); o.start(t0 + at); o.stop(t0 + at + d + .02); };
    const noise = (d, f, at = 0, gn = 1) => { const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
      const s = a.createBufferSource(), bp = a.createBiquadFilter(), e = a.createGain(); s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = f; e.gain.setValueAtTime(gn, t0 + at); e.gain.exponentialRampToValueAtTime(.001, t0 + at + d); s.connect(bp); bp.connect(e); e.connect(out2); s.start(t0 + at); };
    ({ pop: () => { tone(600, 1500, .09, 'sine'); tone(1800, 0, .15, 'sine', .02, .3); }, zap: () => tone(2200, 700, .12, 'sawtooth', 0, .25), gold: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0, .18, 'sine', i * .05, .7)),
       bomb: () => { noise(.45, 220, 0, 1.6); tone(110, 35, .4, 'sine', 0, 1); }, ice: () => { tone(2600, 1300, .35, 'sine', 0, .5); tone(3900, 0, .25, 'sine', .05, .25); },
       shoot: () => tone(1300, 400, .08, 'sine', 0, .6), eshoot: () => tone(700, 250, .09, 'triangle', 0, .5), hit: () => { noise(.18, 700, 0, 1.2); tone(160, 50, .2, 'sine', 0, .9); },
       power: () => [784, 1175, 1568].forEach((f, i) => tone(f, 0, .16, 'sine', i * .07, .7)), punch: () => { noise(.09, 500, 0, 1.4); tone(220, 90, .08, 'sine', 0, .8); }, kick: () => { noise(.14, 300, 0, 1.6); tone(130, 50, .14, 'sine', 0, 1); },
       block: () => tone(1700, 1100, .08, 'sine', 0, .6), whoosh: () => noise(.2, 1800, 0, .5), blast: () => { tone(200, 1600, .35, 'sawtooth', 0, .35); noise(.35, 2400, .05, .4); },
       count: () => tone(880, 0, .14, 'sine', 0, .6), go: () => { tone(1320, 0, .4, 'sine', 0, .7); tone(1980, 0, .4, 'sine', 0, .3); }, power_on: () => { tone(80, 900, .7, 'sawtooth', 0, .25); tone(2400, 0, .5, 'sine', .55, .3); },
       win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0, i === 5 ? .7 : .16, 'sine', i * .09, .7)), lose: () => [523, 440, 349, 262].forEach((f, i) => tone(f, 0, .3, 'sine', i * .16, .7)) })[name]?.();
  } catch (_) {}
}

// ---------- the buddy's face (solid, with a light aura) ----------
function drawBuddyHead(x, y, r, { mood = 'happy', look = 0, t = now(), headset = true, angry = false, aura = '#5fd4ff' } = {}){
  glow(x, y, r * 2.6, aura, .45);
  g.save(); g.translate(x, y);
  [[-.65, 1.0], [-.95, 1.2], [-1.25, .9]].forEach(([a, l], i) => { a += Math.sin(t * 2 + i) * .06; const x1 = Math.cos(a) * r * (1 + l * .55), y1 = Math.sin(a) * r * (1 + l * .55);
    g.strokeStyle = '#1d5ee8'; g.lineWidth = r * .1; g.beginPath(); g.moveTo(Math.cos(a) * r * .9, Math.sin(a) * r * .9); g.lineTo(x1, y1); g.stroke(); });
  g.restore();
  [[-.65, 1.0], [-.95, 1.2], [-1.25, .9]].forEach(([a, l], i) => { a += Math.sin(t * 2 + i) * .06; glow(x + Math.cos(a) * r * (1 + l * .55), y + Math.sin(a) * r * (1 + l * .55), r * .45, '#7ae3ff', .9); });
  g.save(); g.translate(x, y);
  const gr = g.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.05); gr.addColorStop(0, '#d4ecff'); gr.addColorStop(.3, '#5aa0ff'); gr.addColorStop(1, '#1240b8');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.fillStyle = '#ffffff70'; g.beginPath(); g.ellipse(-r * .38, -r * .55, r * .25, r * .12, -.55, 0, 7); g.fill();
  [-1, 1].forEach(s => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(s * r * .27, -r * .12, r * .22, r * .26, 0, 0, 7); g.fill();
    g.fillStyle = '#0d1033'; g.beginPath(); g.arc(s * r * .27 + look * r * .08, -r * .1, r * .11, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * r * .27 + look * r * .08 + r * .04, -r * .15, r * .04, 0, 7); g.fill(); });
  if (angry) { g.strokeStyle = '#0d1033'; g.lineWidth = r * .07; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * r * .1, -r * .42); g.lineTo(s * r * .42, -r * .5); g.stroke(); }); }
  g.fillStyle = '#0d1033'; g.beginPath();
  if (mood === 'happy') { g.moveTo(-r * .17, r * .26); g.quadraticCurveTo(0, r * .45, r * .17, r * .26); g.fill(); }
  else if (mood === 'sad') { g.strokeStyle = '#0d1033'; g.lineWidth = r * .06; g.arc(0, r * .45, r * .15, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  else { g.ellipse(0, r * .3, r * .08, r * .1, 0, 0, 7); g.fill(); }
  if (headset) { g.strokeStyle = '#2a2e3b'; g.lineWidth = r * .16; g.beginPath(); g.arc(0, r * .05, r * 1.05, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    [-1, 1].forEach(s => { g.fillStyle = '#2a2e3b'; g.beginPath(); g.ellipse(s * r * 1.02, r * .1, r * .22, r * .36, 0, 0, 7); g.fill(); g.strokeStyle = '#c9ced8'; g.lineWidth = r * .07; g.beginPath(); g.ellipse(s * r * 1.06, r * .1, r * .14, r * .26, 0, 0, 7); g.stroke(); });
    g.fillStyle = '#ff7a1a'; g.beginPath(); g.ellipse(-r * .4, r * .66, r * .17, r * .11, 0, 0, 7); g.fill(); }
  g.restore();
}

// ---------- effects: sparks, shockwave rings, floating numbers, taunts ----------
let parts = [], rings = [], floats = [], shakeT = 0, shakeA = 0, flashA = 0, slowmo = 0;
function burst(x, y, col, n = 18, sp = 220){ for (let i = 0; i < n; i++){ const a = rnd(0, 6.28), v = rnd(.25, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col, s: rnd(2, 5), drag: rnd(.9, .97) }); } }
function ring(x, y, col, max = 70, w = 3){ rings.push({ x, y, r: 4, max, col, life: 1, w }); }
function floatText(x, y, txt, col = '#ffffff'){ floats.push({ x, y, txt, col, life: 1 }); }
function shake(a = 6, t = .25){ shakeA = Math.max(shakeA, a); shakeT = Math.max(shakeT, t); }
function stepFx(dt){
  parts = parts.filter(p => (p.life -= dt * 1.4) > 0); parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.drag; p.vy *= p.drag; });
  rings = rings.filter(r => (r.life -= dt * 1.8) > 0); rings.forEach(r => r.r += (r.max - r.r) * Math.min(1, dt * 7));
  floats = floats.filter(f => (f.life -= dt * .8) > 0); floats.forEach(f => f.y -= 36 * dt);
  if (shakeT > 0) shakeT -= dt; else shakeA = 0; flashA = Math.max(0, flashA - dt * 3); slowmo = Math.max(0, slowmo - dt);
}
function drawFx(){
  g.save(); g.globalCompositeOperation = 'lighter';
  parts.forEach(p => { g.globalAlpha = p.life; g.drawImage(sprite(p.col), p.x - p.s * 3, p.y - p.s * 3, p.s * 6, p.s * 6); g.fillStyle = '#fff'; g.fillRect(p.x - .7, p.y - .7, 1.4, 1.4); });
  rings.forEach(r => { g.globalAlpha = r.life * .8; g.strokeStyle = r.col; g.lineWidth = r.w * r.life + .5; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); g.globalAlpha = r.life * .25; g.lineWidth = r.w * 4; g.stroke(); });
  g.restore();
  g.textAlign = 'center'; g.font = '600 17px "Segoe UI Variable Display","Segoe UI",system-ui';
  floats.forEach(f => { g.globalAlpha = Math.min(1, f.life * 1.6); g.shadowColor = f.col; g.shadowBlur = 12; g.fillStyle = f.col; g.fillText(f.txt, f.x, f.y); });
  g.shadowBlur = 0; g.globalAlpha = 1;
  if (flashA > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = flashA * .35; g.fillStyle = '#bfe6ff'; g.fillRect(0, 0, W, H); g.restore(); }
}
let taunt = null;
function say(text, secs = 2.8, x, y){ if (text) taunt = { text, until: now() + secs, x, y, t0: now() }; }
function drawTaunt(ax, ay){
  if (!taunt || now() > taunt.until) return;
  const x = taunt.x ?? ax, y = taunt.y ?? ay, a = Math.min(1, (now() - taunt.t0) * 6, (taunt.until - now()) * 3);
  g.font = '500 14px "Segoe UI Variable Display","Segoe UI",system-ui';
  const words = taunt.text.split(' '), lines = []; let cur = '';
  for (const w of words){ if (g.measureText(cur + ' ' + w).width > 220 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } lines.push(cur);
  const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 26, bh = lines.length * 19 + 16, bx = clamp(x - bw / 2, 30, W - bw - 30), by = clamp(y - bh - 16, 84, H - bh - 30);
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(12,24,80,.55)'; g.beginPath(); g.roundRect(bx, by, bw, bh, 14); g.fill();
  neon(() => g.roundRect(bx, by, bw, bh, 14), '#7ad7ff', 1.2, a * .8);
  g.fillStyle = '#eaf6ff'; g.textAlign = 'left'; g.shadowColor = '#7ad7ff'; g.shadowBlur = 8; lines.forEach((l, i) => g.fillText(l, bx + 13, by + 23 + i * 19)); g.restore();
}

// ---------- HUD in glass and light ----------
function pill(x, y, w, h, col){ g.save(); g.fillStyle = 'rgba(14,26,90,.45)'; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.restore(); neon(() => g.roundRect(x, y, w, h, h / 2), col, 1, .7); }
function hudText(txt, x, y, col, size = 16, align = 'left'){ g.save(); g.font = `600 ${size}px "Segoe UI Variable Display","Segoe UI",system-ui`; g.textAlign = align; g.fillStyle = '#fff'; g.shadowColor = col; g.shadowBlur = 14; g.fillText(txt, x, y); g.restore(); }
function scoreHud(you, bud, mid, frac){
  pill(36, 34, 150, 34, '#ff7ad9'); hudText('YOU', 52, 56, '#ff7ad9', 11); hudText(String(you), 172, 58, '#ff7ad9', 20, 'right');
  pill(W - 186, 34, 150, 34, '#5fd4ff'); hudText(NAME.toUpperCase().slice(0, 12), W - 170, 56, '#5fd4ff', 11); hudText(String(bud), W - 50, 58, '#5fd4ff', 20, 'right');
  if (frac !== undefined) { neon(() => g.arc(W / 2, 52, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac), frac > .2 ? '#bda6ff' : '#ff6b8b', 2); }
  hudText(mid, W / 2, 58, '#bda6ff', 15, 'center');
}

// ---------- your Mind: trash talk, play style, reaction ----------
const LABEL = { bubbles: 'Bubble Pop Battle', space: 'Space Duel', brawl: 'Desk Brawl' };
const LOCAL_TAUNTS = ['Prepare to lose, friend!', 'I\'ve been practising all day!', 'Don\'t cry when I win!', 'Let\'s gooo! Best buddy wins!', 'I\'ll go easy on you. Just kidding!'];
let mindLines = { brag: [], oops: [] };
const OOPS_RE = /ouch|oof|ow!|hey|lucky|rematch|hurt|okay|nice one|my |good|brrr|can't move/i;
function tl(local){ const pool = OOPS_RE.test(local.join(' ')) ? mindLines.oops : mindLines.brag; return pool.length && Math.random() < .55 ? pick(pool) : pick(local); }
function withTimeout(p, ms){ return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]); }
const AD = window.ArcadeDesign;
async function mindPre(gameName, summary){
  const r = await withTimeout(A.ask(`[game helper, not a chat] We're about to play "${LABEL[gameName]}". The computer plays your side; you are the trash-talking star AND the level designer.\n` +
    `Player diary:\n${summary}\n${AD.rules()}\n` +
    `Reply ONLY in this exact format on one line, nothing else: LINE: one playful trash-talk line, max 12 words | STYLE: aggressive or defensive or tricky | ` +
    `BRAG: 4 short brags for when you score, separated by ; | OOPS: 4 short funny excuses for when the user hits you, separated by ; | ${AD.promptPart(gameName)}. Keep every line kind and playful.`).catch(() => null), 15000);
  const t = r?.text || '', m = t.match(/LINE:\s*(.+?)\s*\|\s*STYLE:\s*(aggressive|defensive|tricky)/i);
  const list = key => ((t.match(new RegExp(key + ':\\s*([^|]+)', 'i')) || [])[1] || '').split(';').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(x => x && x.length < 60).slice(0, 6);
  mindLines = { brag: list('BRAG'), oops: list('OOPS') };
  const design = AD.parseMind(gameName, t);
  return m ? { line: m[1].replace(/^["']|["']$/g, ''), style: m[2].toLowerCase(), design } : { line: null, style: pick(['aggressive', 'defensive', 'tricky']), design };
}
function mindPost(gameName, res){
  return withTimeout(A.ask(`[game helper, not a chat] We just finished "${LABEL[gameName]}". ${res.won ? 'The user BEAT you' : res.tie ? 'It was a tie' : 'You BEAT the user'} (${res.score}). ` +
    `React in ONE short spoken line, max 16 words: ${res.won ? 'a good sport, maybe demand a rematch' : 'playful bragging but kind'}.`).then(r => r?.text || null).catch(() => null), 20000);
}
const lvKey = n => 'arcade.lv.' + n;
const getLv = n => { try { return clamp(Number(localStorage.getItem(lvKey(n))) || 2, 1, 5); } catch { return 2; } };
const setLv = (n, v) => { try { localStorage.setItem(lvKey(n), String(clamp(v, 1, 5))); } catch (_) {} };

// =====================================================================
// 🫧 BUBBLE POP BATTLE — a bioluminescent ocean
// =====================================================================
function Bubbles(lv, style, D){
  const bg = nebula({ top: '#010213', bottom: '#030b33', blobs: ['#1fb8ff', '#5b3cff', '#ff4fd8', '#22e0c8'] }, 7);
  const S = { time: 60, you: 0, bud: 0, bubbles: [], spawn: 0, ret: { x: W / 2, y: H / 2, tgt: null, think: 0, beam: 0, bx: 0, by: 0 }, frozen: { you: 0, bud: 0 } };
  const K = n => D?.knobs?.[n] || 0, TW = D?.twist || 'none', ST = { pops: 0, bombs: 0, gold: 0, misses: 0, reacts: [] };
  const speed = (260 + lv * 80 + (style === 'aggressive' ? 60 : 0)) * (1 + .12 * K('speed')), think = Math.max(.14, (.85 - lv * .13) * (1 - .12 * K('smarts')) * (1 - .08 * K('aggro'))), bombMiss = clamp((.32 - lv * .06) * (1 - .3 * K('smarts')), .02, .6);
  const TYPES = (() => { const t = [['gold', .08 * (1 + .4 * K('gold'))], ['bomb', .1 * (1 + .4 * K('bombs'))], ['ice', .07 * (1 + .4 * K('ice'))], ['rainbow', .05]]; return [['normal', Math.max(.3, 1 - t.reduce((a, x) => a + x[1], 0))], ...t]; })();
  const SIZE = TW === 'bigorbs' ? 1.3 : TW === 'tinyorbs' ? .72 : 1, RISE = TW === 'bigorbs' ? .85 : TW === 'tinyorbs' ? 1.15 : 1;
  const rb = () => 1 + clamp((S.bud - S.you) / 25, -.12, .3);           // in-round fairness: it slows down when it's far ahead
  const HUES = ['#5fd4ff', '#b48cff', '#ff7ad9', '#58f0c8', '#7aa8ff'];
  const plankton = Array.from({ length: 120 }, () => ({ x: rnd(0, W), y: rnd(0, H), v: rnd(4, 14), s: rnd(.8, 2.4), c: pick(['#7ae3ff', '#fff3b0', '#ff9be6', '#9dffcf']), ph: rnd(0, 6) }));
  const fish = Array.from({ length: 3 }, (_, i) => ({ x: rnd(80, W - 80), y: rnd(140, H - 80), a: rnd(0, 6.28), sp: rnd(40, 60), turn: 0, scare: 0, hue: ['#ff5fa2', '#ff9a3d', '#c77dff'][i], ph: rnd(0, 6) }));
  const trail = [];
  function spawn(){ let r = Math.random(), tp = 'normal'; for (const [n, p] of TYPES){ if ((r -= p) < 0) { tp = n; break; } }
    if (TW === 'goldrush' && S.time < 15 && tp === 'normal' && Math.random() < .18) tp = 'gold';
    S.bubbles.push({ x: rnd(50, W - 50), y: H + 40, r: (tp === 'gold' ? 19 : rnd(17, 31)) * SIZE, vy: rnd(55, 95) * (1 + (60 - S.time) / 90) * RISE, wob: rnd(0, 6), tp, col: pick(HUES), born: now() }); }
  function pop(b, who){
    S.bubbles.splice(S.bubbles.indexOf(b), 1);
    const mine = who === 'you', col = mine ? '#ff7ad9' : '#5fd4ff';
    let pts = 1;
    if (b.tp === 'gold') { pts = 5; sfx('gold'); if (!mine) say(tl(['Shiny! Mine!', 'Ooh gold!', 'Ka-ching!'])); }
    else if (b.tp === 'bomb') { pts = -3; sfx('bomb'); shake(8); flashA = .8; if (mine) say(tl(['Boom! Hehehe', 'Oopsie! That was a bomb!'])); else say('Ow! My antennae!'); }
    else if (b.tp === 'ice') { S.frozen[mine ? 'bud' : 'you'] = 2.5; sfx('ice'); if (mine) say('Brrr! Can\'t move!'); else floatText(W / 2, H / 2, 'FROZEN', '#bfe9ff'); }
    else if (b.tp === 'rainbow') { sfx('gold'); const near = S.bubbles.filter(o => Math.hypot(o.x - b.x, o.y - b.y) < 120 && o.tp !== 'bomb'); near.forEach(o => { S.bubbles.splice(S.bubbles.indexOf(o), 1); burst(o.x, o.y, o.col, 10); ring(o.x, o.y, o.col, 40, 2); }); pts = 1 + near.length; ring(b.x, b.y, '#ffffff', 130, 3); }
    else sfx(mine ? 'pop' : 'zap', .8);
    if (TW === 'tinyorbs' && pts > 0) pts *= 2; if (TW === 'doublefinale' && S.time < 10) pts *= 2;
    if (mine) { ST.pops++; if (b.tp === 'bomb') ST.bombs++; if (b.tp === 'gold') ST.gold++; ST.reacts.push(now() - b.born); }
    S[mine ? 'you' : 'bud'] += pts;
    const c = b.tp === 'gold' ? '#ffd86b' : b.tp === 'bomb' ? '#ff4f4f' : b.tp === 'ice' ? '#bfe9ff' : b.col;
    burst(b.x, b.y, c, 22, 240); ring(b.x, b.y, c, b.r * 3, 2.5); floatText(b.x, b.y - 12, (pts > 0 ? '+' : '') + pts, pts > 0 ? col : '#ff6b6b');
    fish.forEach(f => { if (Math.hypot(f.x - b.x, f.y - b.y) < 140) { f.scare = 1.2; f.a = Math.atan2(f.y - b.y, f.x - b.x); } });
  }
  function aiPick(){
    const cand = S.bubbles.filter(b => b.y < H - 20 && b.y > 60); if (!cand.length) return null;
    const score = b => { const d = Math.hypot(b.x - S.ret.x, b.y - S.ret.y); let v = { normal: 1, gold: 6, ice: 3.5, rainbow: 4, bomb: Math.random() < bombMiss ? 1 : -99 }[b.tp]; if (style === 'tricky' && b.tp === 'ice') v += 3; return v * 300 - d - (b.y < 90 ? 150 : 0); };
    return cand.sort((a, b) => score(b) - score(a))[0];
  }
  return {
    update(dt){
      S.time -= dt; S.spawn -= dt; if (S.spawn <= 0) { spawn(); S.spawn = Math.max(.24, (.65 - (60 - S.time) / 140) * (1 - .12 * K('pace'))); }
      S.bubbles.forEach(b => { b.y -= b.vy * dt; b.wob += dt * 2; b.x += Math.sin(b.wob) * 22 * dt; }); S.bubbles = S.bubbles.filter(b => b.y > -50);
      S.frozen.you = Math.max(0, S.frozen.you - dt); S.frozen.bud = Math.max(0, S.frozen.bud - dt);
      plankton.forEach(p => { p.y -= p.v * dt; p.x += Math.sin(now() + p.ph) * 4 * dt; if (p.y < -5) { p.y = H + 5; p.x = rnd(0, W); } });
      fish.forEach(f => { f.scare = Math.max(0, f.scare - dt); f.turn += rnd(-1, 1) * dt; f.turn *= .98; f.a += f.turn * dt * 1.5;
        const sp = f.sp * (1 + f.scare * 3); f.x += Math.cos(f.a) * sp * dt; f.y += Math.sin(f.a) * sp * dt;
        if (f.x < 40 || f.x > W - 40 || f.y < 110 || f.y > H - 40) { f.a = Math.atan2(H / 2 + 40 - f.y, W / 2 - f.x) + rnd(-.4, .4); } f.ph += dt * (6 + f.scare * 10); });
      trail.push({ x: mouse.x, y: mouse.y, life: 1 }); while (trail.length > 14) trail.shift(); trail.forEach(p => p.life -= dt * 3);
      if (mouse.clicked && !S.frozen.you) { const hit = [...S.bubbles].reverse().find(b => Math.hypot(b.x - mouse.x, b.y - mouse.y) < b.r + 6); if (hit) pop(hit, 'you'); else { ST.misses++; ring(mouse.x, mouse.y, '#ff7ad9', 26, 1.5); } }
      const R = S.ret; R.beam = Math.max(0, R.beam - dt * 6);
      if (!S.frozen.bud) {
        R.think -= dt;
        if (!R.tgt || !S.bubbles.includes(R.tgt)) { if (R.think <= 0) { R.tgt = aiPick(); R.think = think * rnd(.7, 1.3) * rb(); } }
        if (R.tgt) { const dx = R.tgt.x - R.x, dy = R.tgt.y - R.y, d = Math.hypot(dx, dy), st = speed * dt;
          if (d <= Math.max(8, st)) { R.bx = R.tgt.x; R.by = R.tgt.y; R.beam = 1; pop(R.tgt, 'bud'); R.tgt = null; R.think = think * rnd(.5, 1) * rb(); } else { R.x += dx / d * st; R.y += dy / d * st; } }
      }
      if (S.time <= 0) return { done: true, you: S.you, bud: S.bud, score: `${S.you} to ${S.bud}`,
        stats: { pops: ST.pops, bombs: ST.bombs, gold: ST.gold, misses: ST.misses, reaction: ST.reacts.length ? Math.round(ST.reacts.reduce((a, b) => a + b, 0) / ST.reacts.length * 10) / 10 : 0 } };
    },
    draw(t){
      g.drawImage(bg, 0, 0);
      g.save(); g.globalCompositeOperation = 'lighter';                       // caustic light rays drifting through the water
      for (let i = 0; i < 6; i++){ const x = ((t * 14 + i * 150) % (W + 300)) - 150; const gr = g.createLinearGradient(x, 0, x + 120, H); gr.addColorStop(0, '#7ad7ff0c'); gr.addColorStop(1, '#7ad7ff00');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x + 190, H); g.lineTo(x + 110, H); g.closePath(); g.fill(); }
      g.restore();
      plankton.forEach(p => glow(p.x, p.y, p.s * 4, p.c, .35 + .35 * Math.sin(t * 2 + p.ph)));
      drawTwinkles(t, .5);
      fish.forEach(f => {                                                        // glowing koi, a chain of lights that swims
        const segs = 9; let px = f.x, py = f.y;
        for (let i = 0; i < segs; i++){ const wav = Math.sin(f.ph - i * .7) * (i * 1.4), ang = f.a + Math.PI; const sx = px + Math.cos(ang) * 6 + Math.cos(ang + Math.PI / 2) * wav * .35, sy = py + Math.sin(ang) * 6 + Math.sin(ang + Math.PI / 2) * wav * .35;
          const r = i < 3 ? 9 - i : Math.max(2, 9 - i * 1.1); glow(sx, sy, r * 3.2, f.hue, .55); glow(sx, sy, r * 1.2, '#ffe1f0', .5); px = sx; py = sy; }
        const tail = f.a + Math.PI; neon(() => { g.moveTo(px, py); g.lineTo(px + Math.cos(tail + .5) * 18 + Math.sin(f.ph) * 4, py + Math.sin(tail + .5) * 18); g.moveTo(px, py); g.lineTo(px + Math.cos(tail - .5) * 18, py + Math.sin(tail - .5) * 18 + Math.sin(f.ph) * 4); }, f.hue, 2, .7);
        [-1, 1].forEach(s => neon(() => { g.moveTo(f.x, f.y); g.lineTo(f.x + Math.cos(f.a + Math.PI * .75 * s) * 14, f.y + Math.sin(f.a + Math.PI * .75 * s) * 14); }, f.hue, 1.5, .6));
      });
      S.bubbles.forEach(b => {                                                   // jelly-like light orbs
        const col = { normal: b.col, gold: '#ffd86b', bomb: '#ff4f4f', ice: '#bfe9ff', rainbow: `hsl(${(t * 220) % 360},100%,70%)` }[b.tp];
        const c = b.tp === 'rainbow' ? '#ffffff' : col, pulse = 1 + Math.sin(t * 4 + b.wob) * .05;
        if (b.tp !== 'bomb' && b.tp !== 'gold') for (let i = -1; i <= 1; i++) neon(() => { g.moveTo(b.x + i * b.r * .4, b.y + b.r * .7); for (let y = 0; y <= 1; y += .2) g.lineTo(b.x + i * b.r * .4 + Math.sin(t * 3 + y * 6 + i) * 4, b.y + b.r * .7 + y * b.r * 1.5); }, c, 1, .35);
        if (b.tp === 'bomb') { g.fillStyle = '#12020a'; g.beginPath(); g.arc(b.x, b.y, b.r * .8, 0, 7); g.fill(); glow(b.x, b.y, b.r * (2 + Math.sin(t * 9) * .4), '#ff3b3b', .7); if (Math.random() < .3) parts.push({ x: b.x + rnd(-6, 6), y: b.y - b.r * .8, vx: rnd(-30, 30), vy: rnd(-60, -20), life: .6, col: '#ffb84d', s: 1.5, drag: .95 }); }
        else glow(b.x, b.y, b.r * 2.2 * pulse, c, b.tp === 'gold' ? .7 : .45);
        neon(() => g.arc(b.x, b.y, b.r * pulse, 0, 7), c, 1.4, .9);
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .7; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.arc(b.x, b.y, b.r * .72, -2.6, -1.7); g.stroke(); g.restore();
        if (b.tp === 'gold') { for (let i = 0; i < 4; i++){ const a = t * 1.5 + i * Math.PI / 2; neon(() => { g.moveTo(b.x + Math.cos(a) * b.r * .25, b.y + Math.sin(a) * b.r * .25); g.lineTo(b.x + Math.cos(a) * b.r * 1.5, b.y + Math.sin(a) * b.r * 1.5); }, '#ffe9a8', 1, .6); } glow(b.x, b.y, b.r * .6, '#ffffff', .9); }
        if (b.tp === 'ice') for (let i = 0; i < 3; i++){ const a = i * Math.PI / 3 + t * .4; neon(() => { g.moveTo(b.x - Math.cos(a) * b.r * .6, b.y - Math.sin(a) * b.r * .6); g.lineTo(b.x + Math.cos(a) * b.r * .6, b.y + Math.sin(a) * b.r * .6); }, '#e6f8ff', 1.2, .8); }
      });
      const R = S.ret, emit = { x: W - 70, y: 132 };                              // the buddy's light beam and targeting ring
      if (R.beam > 0) neon(() => { g.moveTo(emit.x, emit.y); g.lineTo(R.bx, R.by); }, '#5fd4ff', 3, R.beam);
      const rc = S.frozen.bud ? '#bfe9ff' : '#5fd4ff', rr = 16 + Math.sin(t * 8) * 1.5;
      for (let i = 0; i < 4; i++){ const a = t * 2 + i * Math.PI / 2; neon(() => g.arc(R.x, R.y, rr, a, a + .9), rc, 1.6, .9); }
      glow(R.x, R.y, 10, rc, .6);
      trail.forEach((p, i) => glow(p.x, p.y, 3 + i * .5, '#ff7ad9', p.life * .25));     // your cursor: a ripple of light
      const cc = S.frozen.you ? '#bfe9ff' : '#ff7ad9'; neon(() => g.arc(mouse.x, mouse.y, 11 + Math.sin(t * 6) * 1.5, 0, 7), cc, 1.4, .9); glow(mouse.x, mouse.y, 8, cc, .5);
      if (S.frozen.you) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .12; g.fillStyle = '#bfe9ff'; g.fillRect(0, 0, W, H); g.restore(); }
      drawBuddyHead(emit.x, emit.y, 22, { mood: S.bud >= S.you ? 'happy' : 'o', look: (R.x - emit.x) / 300, t });
      scoreHud(S.you, S.bud, `${Math.max(0, Math.ceil(S.time))}`, Math.max(0, S.time) / 60);
      drawTaunt(emit.x - 90, emit.y + 70);
    },
    help: 'Pop the glowing orbs before your buddy\'s light beam does! Gold +5 · red bomb −3 · ice freezes your opponent · rainbow pops everything nearby.',
    keys: '<b>Mouse</b> aim · <b>Click</b> pop',
  };
}

// =====================================================================
// 🚀 SPACE DUEL — neon ships in a nebula
// =====================================================================
function Space(lv, style, D){
  const bg = nebula({ top: '#010110', bottom: '#060322', blobs: ['#6b4cff', '#ff4fd8', '#1fb8ff', '#2b1bcc'] }, 13);
  const K = n => D?.knobs?.[n] || 0, TW = D?.twist || 'none', ST = { shots: 0, hits: 0, hitsTaken: 0, powerups: 0, dsum: 0, dt: 0 }, X0 = TW === 'narrow' ? 150 : 40, X1 = W - X0;
  const me = { x: W / 2, y: H - 60, hp: 5, cd: 0, rapid: 0, shield: TW === 'shieldstart' ? 5 : 0, hit: 0 }, bud = { x: W / 2, y: 104, hp: 5, cd: 1, rapid: 0, shield: TW === 'shieldstart' ? 5 : 0, hit: 0, decide: 0, goal: W / 2 };
  let bullets = [], rocks = [], powers = [], time = 90, powerT = 9, comet = null, exhaust = [];
  const layers = [0, 1, 2].map(l => Array.from({ length: 40 + l * 25 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: .6 + l * .6, v: 8 + l * 22 })));
  for (let i = 0; i < 4 + K('rocks'); i++) rocks.push(mkRock(rnd(X0 + 30, X1 - 30)));
  function mkRock(x){ const n = 8, pts = Array.from({ length: n }, (_, i) => rnd(.75, 1.1)); return { x, y: rnd(220, 310), r: rnd(18, 28), vx: rnd(-40, 40) || 25, hp: 3, a: rnd(0, 6), va: rnd(-.6, .6), pts }; }
  const fireGap = ({ aggressive: .55, defensive: 1.05, tricky: .8 }[style] - lv * .07) * (1 - .1 * K('aggro')), dodge = .35 + lv * .11 + (style === 'defensive' ? .15 : 0) + .07 * K('smarts'), eSpeed = (300 + lv * 35) * (1 + .08 * K('speed'));
  function shoot(who){
    if (who === me) { bullets.push({ x: me.x, y: me.y - 24, vy: -600, vx: 0, me: true }); sfx('shoot', .7); me.cd = me.rapid > 0 ? .11 : .26; ST.shots++; }
    else { const spread = style === 'tricky' && Math.random() < .3, lead = clamp((me.x - bud.x) / 400, -.35, .35);
      (spread ? [-.35, 0, .35] : [lead]).forEach(a => bullets.push({ x: bud.x, y: bud.y + 22, vy: eSpeed, vx: a * eSpeed, me: false })); sfx('eshoot', .6);
      bud.cd = Math.max(.25, (bud.rapid > 0 ? .5 : 1) * fireGap * rnd(.7, 1.3) * (1 + clamp((bud.hp - me.hp) / 5, -.1, .35))); }   // eases off when far ahead
  }
  function damage(t){
    if (t.shield > 0) { sfx('block'); ring(t.x, t.y, '#9fe6ff', 50, 2); return; }
    if (t === me) ST.hitsTaken++; else ST.hits++;
    t.hp--; t.hit = .4; sfx('hit'); shake(8); flashA = .5; const c = t === me ? '#ff7ad9' : '#5fd4ff'; burst(t.x, t.y, c, 30, 280); ring(t.x, t.y, c, 90, 3);
    if (t === me) say(tl(['Pew pew! Got you!', 'Bullseye!', 'Hehe, too slow!'])); else say(tl(['Ouch! Lucky shot!', 'Hey! My paint job!', 'Okay okay, you\'re good.']));
  }
  const glyph = (tp, x, y, s) => { if (tp === 'rapid') neon(() => { g.moveTo(x + 2 * s, y - 8 * s); g.lineTo(x - 4 * s, y + 1 * s); g.lineTo(x + 1 * s, y + 1 * s); g.lineTo(x - 2 * s, y + 8 * s); }, '#ffe08a', 1.6);
    if (tp === 'shield') neon(() => { g.moveTo(x, y - 8 * s); g.lineTo(x + 7 * s, y - 5 * s); g.lineTo(x + 6 * s, y + 3 * s); g.lineTo(x, y + 8 * s); g.lineTo(x - 6 * s, y + 3 * s); g.lineTo(x - 7 * s, y - 5 * s); g.closePath(); }, '#9fe6ff', 1.6);
    if (tp === 'heal') neon(() => { g.moveTo(x, y + 7 * s); g.bezierCurveTo(x - 10 * s, y - 1 * s, x - 5 * s, y - 9 * s, x, y - 3 * s); g.bezierCurveTo(x + 5 * s, y - 9 * s, x + 10 * s, y - 1 * s, x, y + 7 * s); }, '#ff7ad9', 1.6); };
  const hexShield = (x, y, r, col, t) => { neon(() => g.arc(x, y, r, 0, 7), col, 1.4, .8); for (let i = 0; i < 6; i++){ const a = i * Math.PI / 3 + t * .5; neon(() => { g.moveTo(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55); g.lineTo(x + Math.cos(a + Math.PI / 3) * r * .55, y + Math.sin(a + Math.PI / 3) * r * .55); }, col, .8, .45); } };
  return {
    update(dt){
      time -= dt; powerT -= dt; ST.dsum += Math.abs(me.x - bud.x) * dt; ST.dt += dt;
      if (TW === 'rapidfinale' && time < 20) { me.rapid = Math.max(me.rapid, .3); bud.rapid = Math.max(bud.rapid, .3); }
      [me, bud].forEach(s => { s.cd -= dt; s.rapid -= dt; s.shield -= dt; s.hit -= dt; });
      layers.forEach(l => l.forEach(s => { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = rnd(0, W); } }));
      if (!comet && Math.random() < dt * .08) comet = { x: rnd(0, W), y: -10, vx: rnd(-200, 200), vy: rnd(200, 300), life: 1.5 }; if (comet) { comet.x += comet.vx * dt; comet.y += comet.vy * dt; if ((comet.life -= dt) <= 0) comet = null; }
      const kx = (k('ArrowRight', 'KeyD') ? 1 : 0) - (k('ArrowLeft', 'KeyA') ? 1 : 0);
      if (kx) me.x += kx * 430 * dt; else me.x += (mouse.x - me.x) * Math.min(1, dt * 9); me.x = clamp(me.x, X0, X1);
      if ((k('Space') || mouse.down) && me.cd <= 0) shoot(me);
      bud.decide -= dt;
      const danger = bullets.filter(b => b.me && b.y > bud.y && b.y < bud.y + 220 && Math.abs(b.x - bud.x) < 34);
      if (danger.length && Math.random() < dodge * dt * 8) bud.goal = clamp(bud.x + (danger[0].x < bud.x ? 1 : -1) * rnd(70, 130), X0 + 10, X1 - 10);
      else if (bud.decide <= 0) { bud.decide = rnd(.35, .9); bud.goal = clamp(me.x + rnd(-1, 1) * (style === 'tricky' ? 160 : 70), X0 + 10, X1 - 10); }
      bud.x += clamp(bud.goal - bud.x, -1, 1) * Math.min(Math.abs(bud.goal - bud.x), (240 + lv * 40) * (1 + .1 * K('speed')) * dt);
      if (bud.cd <= 0 && Math.abs(me.x - bud.x) < 140) shoot(bud);
      exhaust.push({ x: me.x + rnd(-3, 3), y: me.y + 16, life: 1 }); exhaust.forEach(e => { e.y += 90 * dt; e.life -= dt * 2.4; }); exhaust = exhaust.filter(e => e.life > 0);
      rocks.forEach(r => { r.x += r.vx * dt; r.a += r.va * dt; if (r.x < X0 || r.x > X1) r.vx *= -1; });
      if (powerT <= 0) { powerT = rnd(9, 14) * (1 - .2 * K('powerups')); powers.push({ x: -20, y: rnd(200, 320), vx: rnd(70, 110), t: pick(['rapid', 'shield', 'heal']) }); }
      powers.forEach(p => p.x += p.vx * dt); powers = powers.filter(p => p.x < W + 30);
      bullets.forEach(b => { b.y += b.vy * dt; b.x += b.vx * dt; });
      for (const b of bullets){
        const rock = rocks.find(r => Math.hypot(r.x - b.x, r.y - b.y) < r.r); if (rock) { b.dead = 1; rock.hp--; burst(b.x, b.y, '#8ea0ff', 8, 120); if (rock.hp <= 0) { rocks.splice(rocks.indexOf(rock), 1); burst(rock.x, rock.y, '#b8c4ff', 26, 200); ring(rock.x, rock.y, '#8ea0ff', 60, 2); sfx('hit', .6); } continue; }
        const pw = powers.find(p => Math.hypot(p.x - b.x, p.y - b.y) < 22); if (pw) { b.dead = 1; powers.splice(powers.indexOf(pw), 1); const who = b.me ? me : bud; if (b.me) ST.powerups++; sfx('power'); ring(pw.x, pw.y, b.me ? '#ff7ad9' : '#5fd4ff', 60, 2);
          if (pw.t === 'rapid') who.rapid = 6; if (pw.t === 'shield') who.shield = 6; if (pw.t === 'heal') who.hp = Math.min(5, who.hp + 1);
          floatText(pw.x, pw.y, { rapid: 'RAPID FIRE', shield: 'SHIELD', heal: '+1 LIFE' }[pw.t], b.me ? '#ff9bd0' : '#9fe6ff'); if (!b.me) say('Power-up! Mine now!'); continue; }
        const tgt = b.me ? bud : me; if (Math.abs(b.x - tgt.x) < 26 && Math.abs(b.y - tgt.y) < 20) { b.dead = 1; damage(tgt); }
      }
      bullets = bullets.filter(b => !b.dead && b.y > -20 && b.y < H + 20);
      if (rocks.length < (TW === 'meteor' ? 6 : 2) && Math.random() < dt * (TW === 'meteor' ? 1.2 : .3)) rocks.push(mkRock(pick([X0 + 10, X1 - 10])));
      if (me.hp <= 0 || bud.hp <= 0 || time <= 0) return { done: true, you: me.hp, bud: bud.hp, score: `${me.hp} lives to ${bud.hp}`,
        stats: { shots: ST.shots, hits: ST.hits, hitsTaken: ST.hitsTaken, powerups: ST.powerups, distance: ST.dt ? Math.round(ST.dsum / ST.dt) : 0 } };
    },
    draw(t){
      g.drawImage(bg, 0, 0);
      layers.forEach((l, i) => l.forEach(s => glow(s.x, s.y, s.s * 2.2, i === 2 ? '#e6f4ff' : '#9fb8ff', .35 + i * .2)));
      drawTwinkles(t, .4);
      if (comet) neon(() => { g.moveTo(comet.x, comet.y); g.lineTo(comet.x - comet.vx * .18, comet.y - comet.vy * .18); }, '#bfe9ff', 1.5, comet.life / 1.5);
      rocks.forEach(r => { const path = () => { for (let i = 0; i <= r.pts.length; i++){ const a = r.a + i / r.pts.length * 6.28, rr = r.r * r.pts[i % r.pts.length]; g.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr); } };
        g.fillStyle = '#060a22'; g.beginPath(); path(); g.fill(); neon(path, '#7f8cff', 1.2, .7);
        neon(() => { g.moveTo(r.x, r.y); g.lineTo(r.x + Math.cos(r.a + 1) * r.r * .8, r.y + Math.sin(r.a + 1) * r.r * .8); g.moveTo(r.x, r.y); g.lineTo(r.x + Math.cos(r.a + 3.5) * r.r * .7, r.y + Math.sin(r.a + 3.5) * r.r * .7); }, '#7f8cff', .7, .35); });
      powers.forEach(p => { const y = p.y + Math.sin(t * 4) * 3, c = { rapid: '#ffd86b', shield: '#9fe6ff', heal: '#ff7ad9' }[p.t]; glow(p.x, y, 30, c, .5); neon(() => g.arc(p.x, y, 15, t * 2, t * 2 + 4.5), c, 1.2, .8); glyph(p.t, p.x, y, 1); });
      bullets.forEach(b => { const c = b.me ? '#ff7ad9' : '#5fd4ff'; neon(() => { g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * .03, b.y - b.vy * .03); }, c, 3); glow(b.x, b.y, 12, c, .7); });
      exhaust.forEach(e => glow(e.x, e.y, 9 * e.life + 2, e.life > .6 ? '#fff0c2' : '#ff7ad9', e.life * .6));
      const blink = s => s.hit > 0 && Math.floor(t * 20) % 2;
      if (!blink(me)) { const x = me.x, y = me.y;                                 // your ship: neon outline
        const ship = () => { g.moveTo(x, y - 26); g.lineTo(x + 9, y - 4); g.lineTo(x + 24, y + 14); g.lineTo(x + 8, y + 10); g.lineTo(x, y + 16); g.lineTo(x - 8, y + 10); g.lineTo(x - 24, y + 14); g.lineTo(x - 9, y - 4); g.closePath(); };
        g.fillStyle = '#14062a'; g.beginPath(); ship(); g.fill(); neon(ship, '#ff7ad9', 2); glow(x, y - 4, 7, '#ffffff', .8);
        neon(() => { g.moveTo(x - 4, y + 16); g.lineTo(x, y + 26 + Math.sin(t * 40) * 4); g.lineTo(x + 4, y + 16); }, '#ffd86b', 1.5); }
      if (me.shield > 0) hexShield(me.x, me.y, 34, '#9fe6ff', t);
      if (!blink(bud)) { const x = bud.x, y = bud.y;                               // the buddy's saucer
        glow(x, y + 8, 60, '#5fd4ff', .25); g.fillStyle = '#04102e'; g.beginPath(); g.ellipse(x, y + 10, 44, 12, 0, 0, 7); g.fill();
        neon(() => g.ellipse(x, y + 10, 44, 12, 0, 0, 7), '#5fd4ff', 1.8);
        for (let i = 0; i < 6; i++){ const a = t * 3 + i * Math.PI / 3; glow(x + Math.cos(a) * 36, y + 12 + Math.sin(a) * 6, 6, i % 2 ? '#5fd4ff' : '#b48cff', Math.sin(a) > 0 ? .9 : .3); }
        drawBuddyHead(x, y - 6, 16, { mood: bud.hp >= me.hp ? 'happy' : 'sad', look: (me.x - x) / 200, headset: false, angry: style === 'aggressive', t }); }
      if (bud.shield > 0) hexShield(bud.x, bud.y, 50, '#9fe6ff', t);
      scoreHud('♥'.repeat(Math.max(0, me.hp)) || '0', '♥'.repeat(Math.max(0, bud.hp)) || '0', `${Math.max(0, Math.ceil(time))}`, Math.max(0, time) / 90);
      drawTaunt(bud.x, bud.y + 110);
    },
    help: 'Hit your buddy\'s saucer 5 times before it gets you! Hide behind asteroids, and shoot power-ups to grab them: rapid fire, shield, extra life.',
    keys: '<b>Mouse</b> or <b>← →</b> move · <b>Click</b> or <b>Space</b> shoot',
  };
}

// =====================================================================
// 🥊 DESK BRAWL — neon holograms on a light grid (original characters: Rookie vs your buddy)
// =====================================================================
function Brawl(lv, style, D){
  const bg = nebula({ top: '#01020a', bottom: '#050522', blobs: ['#5f3bff', '#ff4fd8', '#1fb8ff'] }, 21);
  const FLOOR = H - 76, GR = 1600, HOR = FLOOR - 120;
  const MOVES = { punch: { start: .07, act: .09, rec: .14, dmg: 6, range: 62, kb: 120 }, kick: { start: .14, act: .11, rec: .24, dmg: 10, range: 84, kb: 220 } };
  const mk = (x, face, you) => ({ x, y: FLOOR, vx: 0, vy: 0, face, hp: 100, shown: 100, meter: 0, st: 'idle', t: 0, mv: null, hitDone: false, stun: 0, you, wins: 0, flash: 0 });
  const K = n => D?.knobs?.[n] || 0, TW = D?.twist || 'none', RT = TW === 'shortrounds' ? 40 : 60, X0 = TW === 'narrow' ? 130 : 50, X1 = W - X0;
  const ST = { punches: 0, kicks: 0, blockSecs: 0, jumps: 0, specials: 0, landed: 0, taken: 0, dsum: 0, dt: 0 };
  const P = mk(Math.max(200, X0 + 60), 1, true), B = mk(Math.min(W - 200, X1 - 60), -1, false);
  if (TW === 'superstart') P.meter = B.meter = 100;
  let round = 1, time = RT, banner = { text: 'ROUND 1', until: now() + 1.4 }, between = 1.4, blasts = [], ai = { next: 0, plan: 'idle', holdBlock: 0 };
  const motes = Array.from({ length: 50 }, () => ({ x: rnd(0, W), y: rnd(0, FLOOR), v: rnd(6, 20), c: pick(['#7ad7ff', '#e6b8ff', '#ff9be6']) }));
  const aggr = { aggressive: 1.35, defensive: .7, tricky: 1 }[style] * (1 + .15 * K('aggro')), blockSkill = clamp(.18 + lv * .13 + (style === 'defensive' ? .15 : 0) + .08 * K('blocking') + .04 * K('smarts'), 0, .9), react = Math.max(.06, (.32 - lv * .045) * (1 - .1 * K('speed')));
  const ground = f => f.y >= FLOOR - .5;
  function start(f, mv){ if (f.stun > 0 || f.st === 'ko' || (f.mv && f.st !== 'block')) return; f.mv = mv; f.st = mv; f.t = 0; f.hitDone = false; sfx('whoosh', .5); if (f.you) ST[mv === 'punch' ? 'punches' : 'kicks']++; }
  function special(f){ if (f.meter < 100 || f.stun > 0 || f.mv) return; f.meter = 0; if (f.you) ST.specials++; f.st = 'special'; f.mv = 'special'; f.t = 0; blasts.push({ x: f.x + f.face * 40, y: f.y - 78, vx: f.face * 420, owner: f, trail: [] }); sfx('blast'); flashA = .4; if (!f.you) say('BRAIN BLAAAST!'); }
  function hurt(f, by, dmg, kb){
    if (TW === 'heavyhits') dmg = Math.round(dmg * 1.3);
    const blocking = f.st === 'block' && Math.sign(by.x - f.x) === f.face;
    if (blocking) { f.hp -= Math.ceil(dmg * .2); f.vx = -f.face * kb * .4; sfx('block'); ring(f.x + f.face * 24, f.y - 80, '#e2f3ff', 46, 2); f.meter = Math.min(100, f.meter + 6); return; }
    if (by.you) ST.landed++; else ST.taken++;
    f.hp -= dmg; f.stun = .28 + dmg / 60; f.st = 'hit'; f.mv = null; f.vx = by.face * kb; f.flash = .18; shake(dmg > 9 ? 10 : 6);
    const c = f.you ? '#ff7ad9' : '#5fd4ff', hx = f.x - by.face * 6, hy = f.y - 84;
    sfx(dmg > 9 ? 'kick' : 'punch'); burst(hx, hy, c, 26, 300); ring(hx, hy, '#ffffff', dmg > 9 ? 80 : 54, 3); floatText(f.x, f.y - 150, String(dmg), '#ffe08a');
    const mg = 1 + .25 * K('special'); by.meter = Math.min(100, by.meter + dmg * 1.6 * mg); f.meter = Math.min(100, f.meter + dmg * .8 * mg);
    if (f.you && Math.random() < .35) say(tl(['Boop!', 'Gotcha!', 'Hiyaa!', 'Too easy!'])); if (!f.you && Math.random() < .35) say(tl(['Oof!', 'Hey, my headset!', 'Nice one!', 'Okay that hurt.']));
  }
  function stepFighter(f, o, dt){
    f.flash -= dt; f.stun -= dt; f.shown += (f.hp - f.shown) * Math.min(1, dt * 4);
    if (f.st === 'ko') { f.vy += GR * dt; f.y = Math.min(FLOOR, f.y + f.vy * dt); return; }
    if (f.stun <= 0 && f.st === 'hit') f.st = 'idle';
    if (!f.mv && f.st !== 'hit') f.face = o.x > f.x ? 1 : -1;
    if (f.mv && f.mv !== 'special') { const m = MOVES[f.mv]; f.t += dt;
      if (!f.hitDone && f.t >= m.start && f.t <= m.start + m.act && Math.abs(o.x - f.x) < m.range && Math.abs(o.y - f.y) < 90 && Math.sign(o.x - f.x) === f.face) { f.hitDone = true; hurt(o, f, m.dmg, m.kb); }
      if (f.t > m.start + m.act + m.rec) { f.mv = null; f.st = 'idle'; } }
    else if (f.mv === 'special') { f.t += dt; if (f.t > .35) { f.mv = null; f.st = 'idle'; } }
    f.vy += GR * dt; f.y += f.vy * dt; if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; }
    f.x += f.vx * dt; f.vx *= Math.pow(.0005, dt); f.x = clamp(f.x, X0, X1);
    if (Math.abs(f.x - o.x) < 70 && Math.abs(f.y - o.y) < 60) f.x += (70 - Math.abs(f.x - o.x)) / 2 * Math.sign(f.x - o.x || 1);
  }
  function controls(dt){
    if (P.stun > 0 || P.st === 'ko') return;
    if (k('KeyL', 'KeyS', 'ArrowDown') && !P.mv && ground(P)) { P.st = 'block'; ST.blockSecs += dt; return; } else if (P.st === 'block') P.st = 'idle';
    const dir = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    if (!P.mv) { P.x += dir * 230 * dt; P.st = !ground(P) ? 'jump' : dir ? 'walk' : 'idle'; }
    if (k('KeyW', 'ArrowUp') && ground(P) && !P.mv) { P.vy = -620; ST.jumps++; sfx('whoosh', .4); }
    if (k('KeyJ')) start(P, 'punch'); else if (k('KeyK')) start(P, 'kick'); else if (k('KeyU', 'KeyI')) special(P);
  }
  function brain(dt){
    if (B.stun > 0 || B.st === 'ko') return;
    const dist = Math.abs(P.x - B.x), incoming = blasts.find(b => b.owner === P && Math.sign(B.x - b.x) === Math.sign(b.vx) && Math.abs(B.x - b.x) < 230);
    const threat = P.mv && P.mv !== 'special' && dist < MOVES[P.mv].range + 20 && P.t < MOVES[P.mv].start + .02;
    const ag = aggr * (B.hp - P.hp > 40 ? .75 : P.hp - B.hp > 40 ? 1.15 : 1);   // in-round fairness
    ai.next -= dt; ai.holdBlock -= dt;
    if (ai.holdBlock > 0) { B.st = 'block'; return; } else if (B.st === 'block') B.st = 'idle';
    if (ai.next > 0) { if (ai.plan === 'in') B.x += B.face * (190 + lv * 15) * (1 + .1 * K('speed')) * dt; if (ai.plan === 'out') B.x -= B.face * 170 * dt; B.st = !ground(B) ? 'jump' : (ai.plan === 'in' || ai.plan === 'out') ? 'walk' : B.st; return; }
    ai.next = react * rnd(.7, 1.4);
    if (incoming && ground(B)) { if (Math.random() < .5 + lv * .08) { B.vy = -620; ai.plan = 'idle'; } else ai.holdBlock = .5; return; }
    if (threat && Math.random() < blockSkill) { ai.holdBlock = .35; return; }
    if (B.meter >= 100 && dist > 150 && Math.random() < .6) { special(B); return; }
    if (dist <= 62 && Math.random() < .55 * ag) { start(B, 'punch'); ai.plan = 'idle'; return; }
    if (dist <= 86 && Math.random() < .45 * ag) { start(B, 'kick'); ai.plan = 'idle'; return; }
    if (style === 'tricky' && Math.random() < .12 && ground(B)) { B.vy = -620; B.vx = B.face * 160; return; }
    if (dist > 95) ai.plan = Math.random() < .55 * ag + .2 ? 'in' : 'idle'; else ai.plan = Math.random() < (style === 'defensive' ? .45 : .2) ? 'out' : 'idle';
  }
  function endRound(winner){
    if (winner) winner.wins++; between = 2.6; P.st = P.hp <= 0 ? 'ko' : P.st; B.st = B.hp <= 0 ? 'ko' : B.st;
    const ko = P.hp <= 0 || B.hp <= 0; banner = { text: !winner ? 'DRAW' : ko ? 'K.O.' : 'TIME', until: now() + 2.3 };
    if (ko) { slowmo = 1.1; flashA = 1; shake(12, .5); const l = P.hp <= 0 ? P : B; ring(l.x, l.y - 80, '#ffffff', 220, 4); burst(l.x, l.y - 80, l.you ? '#ff7ad9' : '#5fd4ff', 60, 420); }
    sfx(winner === P ? 'win' : 'lose'); if (winner === B) say(tl(['Hehe! Round to me!', 'Who\'s the champ? Me!'])); if (winner === P) say(tl(['Rematch! I mean… next round!', 'You got lucky!']));
  }
  function resetRound(){ if (TW === 'superstart') P.meter = B.meter = 100; Object.assign(P, { x: 200, y: FLOOR, vx: 0, vy: 0, hp: 100, shown: 100, st: 'idle', mv: null, stun: 0 }); Object.assign(B, { x: W - 200, y: FLOOR, vx: 0, vy: 0, hp: 100, shown: 100, st: 'idle', mv: null, stun: 0 }); blasts = []; time = RT; round++; banner = { text: round === 3 ? 'FINAL ROUND' : 'ROUND ' + round, until: now() + 1.4 }; between = 1.4; }
  function fighter(f, t){                                                         // a neon hologram figure
    const x = f.x, y = f.y, s = f.face, m = f.mv ? MOVES[f.mv] : null, act = m && f.t >= m.start && f.t <= m.start + m.act + .05;
    const col = f.you ? '#ff7ad9' : '#5fd4ff', col2 = f.you ? '#ffb86b' : '#b48cff', walk = f.st === 'walk' ? Math.sin(t * 14) * 10 : 0;
    const a = (f.flash > 0 ? .55 : 1) * (.9 + Math.random() * .1);
    g.save();
    if (f.st === 'ko') { g.translate(x, y - 20); g.rotate(-s * 1.3); g.translate(-x, -(y - 20)); }
    glow(x, y + 4, 70, col, .25);                                                   // light pool on the floor
    neon(() => { g.moveTo(x - 8, y - 44); g.lineTo(x - 12 - walk, y); }, col, 3.2, a);
    neon(() => { g.moveTo(x + 8, y - 44); if (f.mv === 'kick' && act) g.lineTo(x + s * 74, y - 50); else g.lineTo(x + 12 + walk, y); }, col, 3.2, a);
    if (f.mv === 'kick' && act) glow(x + s * 74, y - 50, 22, '#ffffff', .8);
    g.fillStyle = (f.you ? '#ff7ad9' : '#5fd4ff') + '22'; g.beginPath(); g.roundRect(x - 20, y - 92, 40, 52, 14); g.fill();
    neon(() => g.roundRect(x - 20, y - 92, 40, 52, 14), col, 2.4, a);
    neon(() => { g.moveTo(x - 12, y - 66); g.lineTo(x + 12, y - 66); }, col2, 1, a * .7);
    const reach = f.mv === 'punch' && act ? 60 : f.st === 'block' ? 20 : 22, gy = f.st === 'block' ? y - 110 : y - 80, bx2 = x - s * 2 + (f.st === 'block' ? s * 16 : -s * 4), by2 = f.st === 'block' ? y - 102 : y - 70;
    neon(() => { g.moveTo(x + s * 12, y - 82); g.lineTo(x + s * reach, gy); }, col, 3, a);
    neon(() => { g.moveTo(x - s * 6, y - 82); g.lineTo(bx2, by2); }, col, 3, a);
    glow(x + s * reach, gy, f.mv === 'punch' && act ? 26 : 16, col2, .9); glow(bx2, by2, 14, col2, .8);
    if (f.st === 'block') neon(() => g.arc(x + s * 26, y - 92, 34, s > 0 ? -1.2 : Math.PI - 1.2 + 2.4 - 2.4, s > 0 ? 1.2 : Math.PI + 1.2), '#e2f3ff', 1.6, .7);
    if (f.you) {                                                                   // Rookie: a visor-headed hologram
      g.fillStyle = '#ff7ad922'; g.beginPath(); g.arc(x, y - 120, 26, 0, 7); g.fill();
      neon(() => g.arc(x, y - 120, 26, 0, 7), col, 2.4, a);
      neon(() => { g.moveTo(x - 14 + s * 4, y - 124); g.lineTo(x + 14 + s * 4, y - 124); }, '#7af7e6', 3.5, a);
      neon(() => { g.moveTo(x, y - 146); g.lineTo(x - s * 8, y - 160); }, col2, 1.6, a); glow(x - s * 8, y - 160, 8, col2, .9);
    } else { g.save(); g.globalAlpha = a; drawBuddyHead(x, y - 122, 26, { mood: f.st === 'hit' || f.st === 'ko' ? 'sad' : f.hp >= P.hp ? 'happy' : 'o', look: s * .8, t, angry: !!f.mv || style === 'aggressive' }); g.restore(); }
    // hologram scanlines across the figure
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = .07; g.fillStyle = col; for (let yy = y - 150; yy < y; yy += 4) g.fillRect(x - 36, yy + (t * 30 % 4), 72, 1);
    g.restore();
  }
  function bar(x, f, right, t){                                                   // angled light bars
    const w = 270, h = 14, sk = 12, path = () => { g.moveTo(x + (right ? 0 : sk), 40); g.lineTo(x + w + (right ? -sk : 0), 40); g.lineTo(x + w - (right ? 0 : sk), 40 + h); g.lineTo(x + (right ? sk : 0), 40 + h); g.closePath(); };
    g.fillStyle = 'rgba(14,26,90,.5)'; g.beginPath(); path(); g.fill();
    const col = f.you ? '#ff7ad9' : '#5fd4ff', fr = Math.max(0, f.shown) / 100, segs = 20;
    g.save(); g.beginPath(); path(); g.clip(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segs; i++){ const on = (i + 1) / segs <= fr + .001, sx = right ? x + w - (i + 1) * (w / segs) : x + i * (w / segs);
      g.fillStyle = on ? (f.hp > 50 ? col : f.hp > 25 ? '#ffd86b' : '#ff5f6b') : '#ffffff10'; g.globalAlpha = on ? .9 : 1; g.fillRect(sx + 1, 40, w / segs - 2, h); }
    g.restore(); neon(path, col, 1, .8);
    const mw = 150 * f.meter / 100, full = f.meter >= 100; neon(() => { g.moveTo(right ? x + w - mw : x, 62); g.lineTo(right ? x + w : x + mw, 62); }, full ? (Math.floor(t * 8) % 2 ? '#ffe08a' : '#ffffff') : '#7af7e6', 2);
    for (let i = 0; i < 2; i++){ const cx2 = right ? x + w - 8 - i * 16 : x + 8 + i * 16; if (i < f.wins) glow(cx2, 78, 9, '#ffe08a', 1); neon(() => g.arc(cx2, 78, 4, 0, 7), '#ffe08a', 1, i < f.wins ? 1 : .35); }
  }
  return {
    update(dt){
      motes.forEach(m => { m.y -= m.v * dt; if (m.y < 0) { m.y = FLOOR; m.x = rnd(0, W); } });
      if (slowmo > 0) dt *= .3;
      if (between > 0) { between -= dt; if (between <= 0 && (P.st === 'ko' || B.st === 'ko' || time <= 0)) {
          if (P.wins >= 2 || B.wins >= 2 || round >= 3) return { done: true, you: P.wins, bud: B.wins, score: `${P.wins} rounds to ${B.wins}`,
            stats: { punches: ST.punches, kicks: ST.kicks, blockSecs: Math.round(ST.blockSecs * 10) / 10, jumps: ST.jumps, specials: ST.specials, landed: ST.landed, taken: ST.taken, distance: ST.dt ? Math.round(ST.dsum / ST.dt) : 0 } };
          resetRound(); } stepFighter(P, B, dt); stepFighter(B, P, dt); return; }
      time -= dt; ST.dsum += Math.abs(P.x - B.x) * dt; ST.dt += dt; controls(dt); brain(dt); stepFighter(P, B, dt); stepFighter(B, P, dt);
      blasts.forEach(b => { b.x += b.vx * dt; b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 14) b.trail.shift(); const tgt = b.owner === P ? B : P;
        if (!b.dead && Math.abs(tgt.x - b.x) < 30 && Math.abs(tgt.y - 80 - b.y) < 60) { b.dead = 1; hurt(tgt, b.owner, 14, 260); ring(b.x, b.y, '#ffffff', 120, 4); } });
      blasts = blasts.filter(b => !b.dead && b.x > -40 && b.x < W + 40);
      if (P.hp <= 0 || B.hp <= 0) endRound(P.hp <= 0 && B.hp <= 0 ? null : P.hp <= 0 ? B : P);
      else if (time <= 0) endRound(P.hp === B.hp ? null : P.hp > B.hp ? P : B);
    },
    draw(t){
      g.drawImage(bg, 0, 0); drawTwinkles(t, .35);
      g.save(); g.globalCompositeOperation = 'lighter';                          // horizon glow + light pillars
      const hz = g.createLinearGradient(0, HOR - 60, 0, FLOOR); hz.addColorStop(0, '#7b5cff00'); hz.addColorStop(1, '#7b5cff22'); g.fillStyle = hz; g.fillRect(0, HOR - 60, W, FLOOR - HOR + 60);
      [70, W - 70].forEach(px => { const pg = g.createLinearGradient(px - 30, 0, px + 30, 0); pg.addColorStop(0, '#5fd4ff00'); pg.addColorStop(.5, '#5fd4ff14'); pg.addColorStop(1, '#5fd4ff00'); g.fillStyle = pg; g.fillRect(px - 30, 0, 60, FLOOR); });
      g.restore();
      motes.forEach(m => glow(m.x, m.y, 4, m.c, .5));
      const vx = W / 2, vy = HOR;                                                  // perspective light grid
      g.fillStyle = '#05061c'; g.fillRect(0, FLOOR, W, H - FLOOR);
      for (let i = -12; i <= 12; i++) neon(() => { g.moveTo(vx + i * 30, FLOOR); g.lineTo(vx + i * 150, H); }, '#7b5cff', .8, .35);
      for (let j = 0; j < 7; j++){ const p = ((j + (t * .6) % 1) / 7), yy = FLOOR + (H - FLOOR) * p * p; neon(() => { g.moveTo(0, yy); g.lineTo(W, yy); }, '#5fd4ff', .8, .15 + p * .35); }
      neon(() => { g.moveTo(0, FLOOR); g.lineTo(W, FLOOR); }, '#9fe6ff', 1.6, .9);
      blasts.forEach(b => { b.trail.forEach((p, i) => glow(p.x, p.y, 6 + i * 1.2, b.owner.you ? '#ff7ad9' : '#5fd4ff', i / b.trail.length * .5));
        glow(b.x, b.y, 40, b.owner.you ? '#ff7ad9' : '#5fd4ff', .8); glow(b.x, b.y, 14, '#ffffff', 1); neon(() => g.arc(b.x, b.y, 16, t * 10, t * 10 + 4), '#ffffff', 1.4, .8); });
      fighter(P, t); fighter(B, t);
      bar(30, P, false, t); bar(W - 300, B, true, t);
      hudText('YOU · ROOKIE', 30, 32, '#ff7ad9', 11); hudText(NAME.toUpperCase(), W - 30, 32, '#5fd4ff', 11, 'right');
      neon(() => { for (let i = 0; i <= 6; i++){ const a = i / 6 * 6.28 + Math.PI / 6; g.lineTo(W / 2 + Math.cos(a) * 24, 54 + Math.sin(a) * 24); } }, '#bda6ff', 1.2, .9);
      hudText(String(Math.max(0, Math.ceil(time))), W / 2, 61, '#bda6ff', 19, 'center');
      if (now() < banner.until) { const p = 1 - (banner.until - now()) / 2.3, sc = 1 + Math.max(0, .3 - p) * 1.5;
        g.save(); g.translate(W / 2, H / 2 - 40); g.scale(sc, sc); g.font = '200 56px "Segoe UI Variable Display","Segoe UI",system-ui'; g.textAlign = 'center';
        g.fillStyle = '#fff'; g.shadowColor = '#b48cff'; g.shadowBlur = 30; g.fillText(banner.text, 0, 0); g.shadowColor = '#5fd4ff'; g.shadowBlur = 60; g.fillText(banner.text, 0, 0); g.restore(); }
      drawTaunt(B.x, B.y - 160);
    },
    help: 'Best of 3 rounds against your buddy\'s hologram. Hits charge your energy line; when it flashes, fire a Brain Blast. Block to take almost no damage.',
    keys: '<b>A D</b>/<b>← →</b> move · <b>W</b> jump · <b>J</b> punch · <b>K</b> kick · <b>L</b> block · <b>U</b> Brain Blast',
  };
}

// ---------- the projector: power-on beam, soft edges, light dust ----------
const fromX = clamp(Number(Q.get('bx')) || .8, -1, 1), fromY = clamp(Number(Q.get('by')) || .6, -1, 1);     // where the buddy is, relative to this window
const beamOrigin = { x: WW / 2 + fromX * WW * .55, y: HH / 2 + fromY * HH * .55 };
const dust = Array.from({ length: 50 }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-6, 6), vy: rnd(-4, 4), s: rnd(.5, 1.5) }));
let powerOn = 0, powerStart = now();
function project(t, dt){
  powerOn = Math.min(1, (t - powerStart) / .9);
  out.clearRect(0, 0, WW, HH);
  // the beam, from the buddy's side of the screen
  out.save(); out.globalCompositeOperation = 'lighter';
  const ba = (1 - powerOn) * .55 + .06, corners = [[PAD, PAD], [PAD + W, PAD], [PAD + W, PAD + H], [PAD, PAD + H]];
  const far = corners.map(c => Math.atan2(c[1] - beamOrigin.y, c[0] - beamOrigin.x)).sort((a, b) => a - b);
  const gr = out.createRadialGradient(beamOrigin.x, beamOrigin.y, 0, beamOrigin.x, beamOrigin.y, 900); gr.addColorStop(0, `rgba(170,220,255,${ba})`); gr.addColorStop(.6, `rgba(120,160,255,${ba * .25})`); gr.addColorStop(1, 'rgba(120,160,255,0)');
  out.fillStyle = gr; out.beginPath(); out.moveTo(beamOrigin.x, beamOrigin.y); corners.forEach(c => out.lineTo(c[0], c[1])); out.closePath(); out.fill();
  out.restore();
  // the projected surface (soft edges), revealed by a scan line while powering on
  g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(maskC, 0, 0, W, H); g.restore();
  bl.clearRect(0, 0, 180, 125); bl.drawImage(off, 0, 0, 180, 125);
  out.save();
  if (powerOn < 1) { const h = H * powerOn; out.beginPath(); out.rect(PAD, PAD + H / 2 - h / 2, W, h); out.clip(); }
  out.drawImage(off, PAD, PAD, W, H);
  out.globalCompositeOperation = 'lighter'; out.globalAlpha = .32; out.drawImage(bloomC, PAD - 6, PAD - 6, W + 12, H + 12); out.globalAlpha = .12; out.drawImage(bloomC, PAD - 30, PAD - 30, W + 60, H + 60);
  const hs = out.createRadialGradient(WW / 2, HH / 2, 0, WW / 2, HH / 2, 420); hs.addColorStop(0, 'rgba(180,210,255,.035)'); hs.addColorStop(1, 'rgba(180,210,255,0)'); out.globalAlpha = 1; out.fillStyle = hs; out.fillRect(PAD, PAD, W, H);
  dust.forEach(d => { d.x += d.vx * dt; d.y += d.vy * dt; if (d.x < 0) d.x = W; if (d.x > W) d.x = 0; if (d.y < 0) d.y = H; if (d.y > H) d.y = 0;
    out.globalAlpha = .25 + .2 * Math.sin(t * 2 + d.x); out.fillStyle = '#dbeaff'; out.fillRect(PAD + d.x, PAD + d.y, d.s, d.s); });
  out.restore();
  if (powerOn < 1) { out.save(); out.globalCompositeOperation = 'lighter'; const y = PAD + H / 2 - H * powerOn / 2; out.fillStyle = `rgba(200,235,255,${1 - powerOn})`; out.fillRect(PAD, y - 1, W, 2); out.fillRect(PAD, PAD + H - (y - PAD) - 1, W, 2); out.restore(); }
}

// ---------- flow: menu → intro (trash talk) → countdown → play → result ----------
const GAMES = { bubbles: Bubbles, space: Space, brawl: Brawl };
let design = null, startedAt = 0, game = null, gameName = null, phase = 'menu', paused = false, countdown = 0, style = 'tricky', lv = 2, lastT = now(), idleBg = nebula({ top: '#020312', bottom: '#070628', blobs: ['#7b5cff', '#1fb8ff', '#ff4fd8'] }, 3);
function showMenu(){
  phase = 'menu'; game = null; overEl.classList.add('hidden'); menuEl.classList.remove('hidden');
  menuEl.innerHTML = `<div class="card"><div class="sub">projected by ${esc(NAME)}</div><h1>Buddy Arcade</h1><p>You vs ${esc(NAME)}. Pick your game.</p>
    <div class="games"><button data-g="bubbles"><i>🫧</i>Bubble Pop</button><button data-g="space"><i>🚀</i>Space Duel</button><button data-g="brawl"><i>🥊</i>Desk Brawl</button></div></div>`;
}
// the "Level designed by …" panel on the intro card
const ARROWS = v => v > 0 ? '▲'.repeat(v) : '▼'.repeat(-v);
function designHTML(d, waiting, note = ''){
  const by = d.by === 'mind' ? `🧠 Level designed by ${esc(NAME)}` : waiting ? `🧠 ${esc(NAME)} is designing your level…` : `⚙️ Auto-tuned level${note ? ' · ' + esc(note) : ''}`;
  const chips = Object.entries(d.knobs).filter(([, v]) => v).map(([k, v]) => `<span class="${v > 0 ? 'up' : 'down'}">${esc(k)} ${ARROWS(v)}</span>`).join('');
  return `<div class="dz-by">${by}</div><div class="dz-name">${esc(d.name)}</div><div class="dz-twist">✨ ${esc(d.twistText)}</div>` +
    (d.habit ? `<div class="dz-habit">“${esc(d.habit)}”</div>` : '') + (d.why ? `<div class="dz-why">${esc(d.why)}</div>` : '') + (chips ? `<div class="dz-knobs">${chips}</div>` : '');
}
async function startGame(name){
  gameName = name; lv = getLv(name); overEl.classList.add('hidden'); menuEl.classList.remove('hidden'); phase = 'intro'; game = null;
  const diary = AD.load(localStorage), summary = AD.summarize(name, diary, { lv });
  design = AD.autoDesign(name, diary);
  const info = GAMES[name](lv, 'tricky', design);
  menuEl.innerHTML = `<div class="card"><div class="sub">level ${lv} · you vs ${esc(NAME)}</div><h1>${LABEL[name]}</h1><div class="design" id="design">${designHTML(design, true)}</div><p class="help">${info.help}</p><p class="keys">${info.keys}</p>
    <p class="taunt" id="taunt">${esc(NAME)} is warming up…</p><p class="style" id="style"></p><div class="row"><button class="go" id="go">Start</button></div><p class="keys">Esc closes · P pauses</p></div>`;
  A.event?.({ type: 'start', game: name });
  const pre = mindPre(name, summary);
  let ready = false; const go = () => { if (ready) return; ready = true; removeEventListener('keydown', kd); begin(); };
  const kd = e => { if (e.code === 'Enter' || e.code === 'Space') go(); };
  document.getElementById('go').onclick = go; addEventListener('keydown', kd);
  pre.then(p => { style = p.style; const dz = document.getElementById('design');
    if (!ready) { if (p.design) design = p.design; if (dz) dz.innerHTML = designHTML(design, false, p.design ? '' : 'your Mind was busy'); }
    const el = document.getElementById('taunt'); if (el && !ready) { el.textContent = `“${p.line || pick(LOCAL_TAUNTS)}”`; document.getElementById('style').textContent = `${p.style} mode`; } if (ready && p.line) say(p.line, 3, W / 2, 150); });
  async function begin(){
    menuEl.classList.add('hidden'); game = GAMES[name](lv, style, design); phase = 'count'; countdown = 3.999; sfx('count'); startedAt = now();
    if (design.twist !== 'none') setTimeout(() => floatText(W / 2, H / 2 + 70, design.name.toUpperCase(), '#e6b8ff'), 3600);
    const p = await withTimeout(pre, 300); say(p?.line || pick(LOCAL_TAUNTS), 3, W / 2, 150);
  }
}
async function finish(res){
  phase = 'over'; const won = res.you > res.bud, tie = res.you === res.bud;
  sfx(won ? 'win' : tie ? 'go' : 'lose');
  if (won) for (let i = 0; i < 7; i++) setTimeout(() => { const x = rnd(120, W - 120), y = rnd(100, 300), c = pick(['#ffe08a', '#ff7ad9', '#5fd4ff', '#9dffcf']); burst(x, y, c, 40, 320); ring(x, y, c, 120, 3); }, i * 200);
  setLv(gameName, lv + (won ? 1 : tie ? 0 : -1));
  const result = { game: gameName, won, tie, score: res.score, level: lv, design: design?.name };
  AD.save(localStorage, AD.record(AD.load(localStorage), { game: gameName, won, tie, you: res.you, bud: res.bud, lv, dur: now() - startedAt, stats: res.stats, design }));
  A.result?.(result);
  overEl.classList.remove('hidden');
  overEl.innerHTML = `<div class="card"><div class="sub">${LABEL[gameName]} · ${esc(design?.name || 'level ' + lv)}</div><h1>${won ? 'You win' : tie ? 'Tie' : esc(NAME) + ' wins'}</h1><p>${esc(res.score)}</p><p class="taunt" id="react">…</p>
    <div class="row"><button class="go" id="again">Rematch</button><button id="other">Other games</button><button id="bye">Close</button></div><p class="keys">Next match: level ${getLv(gameName)}</p></div>`;
  document.getElementById('again').onclick = () => startGame(gameName); document.getElementById('other').onclick = showMenu; document.getElementById('bye').onclick = () => A.close();
  const line = await mindPost(gameName, result); const el = document.getElementById('react');
  if (el) el.textContent = `“${line ? line.replace(/^["']|["']$/g, '') : won ? 'No fair! Rematch, right now!' : tie ? 'Evenly matched, huh?' : 'Hehe, better luck next time!'}”`;
}
menuEl.addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (b) startGame(b.dataset.g); });
A.onGame?.(name => GAMES[name] ? startGame(name) : showMenu());

function frame(){
  const t = now(); let dt = Math.min(.05, t - lastT); lastT = t;
  g.save(); g.clearRect(0, 0, W, H);
  if (shakeA) g.translate(rnd(-shakeA, shakeA), rnd(-shakeA, shakeA));
  if (game && !paused) {
    if (phase === 'count') { const before = Math.ceil(countdown); countdown -= dt; const after = Math.ceil(countdown); if (after !== before) sfx(after > 0 ? 'count' : 'go'); if (countdown <= 0) phase = 'play'; }
    else if (phase === 'play') { const r = game.update(dt); if (r?.done) finish(r); }
    stepFx(dt);
  } else if (!game) stepFx(dt);
  if (game) { game.draw(t); drawFx();
    if (phase === 'count') { const n = countdown > 1 ? String(Math.ceil(countdown - 1)) : 'GO', p = countdown % 1;
      g.save(); g.translate(W / 2, H / 2 + 10); g.scale(1 + p * .4, 1 + p * .4); g.globalAlpha = Math.min(1, p * 2 + .2); g.font = '200 96px "Segoe UI Variable Display","Segoe UI",system-ui'; g.textAlign = 'center';
      g.fillStyle = '#fff'; g.shadowColor = '#5fd4ff'; g.shadowBlur = 40; g.fillText(n, 0, 30); g.restore(); }
    if (paused) { g.fillStyle = 'rgba(3,6,24,.6)'; g.fillRect(0, 0, W, H); hudText('PAUSED', W / 2, H / 2, '#9fe6ff', 30, 'center'); hudText('click or press P', W / 2, H / 2 + 30, '#9fe6ff', 13, 'center'); }
  } else { g.drawImage(idleBg, 0, 0); drawTwinkles(t, .9); for (let i = 0; i < 3; i++){ const a = t * .3 + i * 2.1; glow(W / 2 + Math.cos(a) * 200, H / 2 + Math.sin(a * 1.3) * 120, 120, ['#7b5cff', '#1fb8ff', '#ff4fd8'][i], .25); } drawFx(); }
  g.restore();
  project(t, dt); mouse.clicked = false;
  requestAnimationFrame(frame);
}
sfx('power_on');
requestAnimationFrame(frame);
showMenu();
const qg = Q.get('game'); if (qg && GAMES[qg]) startGame(qg);
window.__arcade = { forceEnd: r => finish(r), start: startGame, get game(){ return game; }, get phase(){ return phase; }, keys, mouse, setPaused: v => paused = v };

function mockArcade(){
  return { info: async () => ({ name: 'Buddy' }), ask: async t => ({ text: /LINE:/.test(t) ? 'LINE: Prepare to be popped, human! | STYLE: aggressive | BRAG: Too easy; Mine!; Hehe; Boom | OOPS: Lag!; My antenna slipped; Lucky; Glitch | LEVEL: Bomb Alley | TWIST: goldrush | TUNE: speed=1 bombs=2 gold=-1 | WHY: You keep popping bombs, so practice! | HABIT: Two bombs a round? Bold strategy!' : 'Rematch? I demand a rematch!' }),
    result: r => (window.__results ||= []).push(r), close: () => { window.__closed = true; }, event: () => {}, onGame: null };
}
})();
