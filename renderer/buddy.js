/* Minds Buddy — the talking head. Glossy blue Minds head, big eyes, headset with an orange mic,
   three-node antenna. All drawn on a canvas so it can bounce, wink, nap and lip-sync. */
const B = window.buddy || mockBridge();          // mockBridge = for trying the page in a normal browser
const cv = document.getElementById('cv'), cx = cv.getContext('2d');
const bubble = document.getElementById('bubble'), tail = document.getElementById('tail'), chip = document.getElementById('chip');
const askBox = document.getElementById('ask'), askIn = document.getElementById('askIn');
function fitCanvas(){ const d = Math.max(1, window.devicePixelRatio || 1); cv.width = Math.round(280 * d); cv.height = Math.round(230 * d); cx.setTransform(d, 0, 0, d, 0, 0); }
fitCanvas(); addEventListener('resize', fitCanvas);
const HX = 140, HY = 130, R = 64;               // head centre + radius (CSS px)
let INFO = { name: 'Buddy', quiet: false };

// ---------- state ----------
const S = {
  mood: 'happy', action: null, actionT: 0, asleep: false, thinking: false, listening: false, level: 0,
  look: { x: 0, y: 0 }, lookT: { x: 0, y: 0 }, mouth: 0, talking: false, blinkAt: 0, nextBlink: performance.now() + 2500,
  bob: 0, slip: 0, slipT: 0, ring: 0, wobble: 0, antV: 0, antA: 0, fx: [], hand: 0, handT: 0, poke: 0, idleFidget: performance.now() + 40000,
};
const now = () => performance.now();
// which hand gesture goes with which action (the 3D hand stickers in renderer/hands)
const GESTURE = { wave: 'five', hi: 'five', cheer: 'fist', jump: 'fist', nod: 'ok', ok: 'ok', yes: 'ok', agree: 'ok', love: 'shaka', giggle: 'shaka', cool: 'shaka',
  point: 'point', show: 'point', offer: 'offer', welcome: 'offer', dance: 'spread', shrug: 'spread', ta_da: 'spread' };
function act(a, ms = 1100){ if (!a) return; window.PET?.onAct?.(a); S.action = a; S.actionT = now() + ms; if (GESTURE[a]) { S.gesture = GESTURE[a]; S.handT = 1; }
  if (a === 'cheer') burst(['🎉', '✨', '⭐'], 14); if (a === 'jump' || a === 'dance') S.antV += 0.5; }
function burst(chars, n, opts = {}){ for (let i = 0; i < n; i++) S.fx.push({ ch: chars[i % chars.length], x: HX + (Math.random() - .5) * 90, y: HY - 20 + (Math.random() - .5) * 30,
  vx: (Math.random() - .5) * 2.4, vy: -1.5 - Math.random() * 2.5, g: opts.g ?? .07, life: 1, size: opts.size || 15 + Math.random() * 6, rot: (Math.random() - .5) * .6 }); }
function floaty(ch, x, y){ S.fx.push({ ch, x, y, vx: .25, vy: -.45, g: 0, life: 1, size: 15, rot: 0, slow: true }); }

// ---------- drawing ----------
const C = { blue: '#2f7dff', blue2: '#0d47c9', blueHi: '#9cd0ff', ink: '#0d1033', band: '#3a3f4f', band2: '#202431', cup: '#2a2e3b', ring: '#c9ced8', foam: '#ff7a1a' };
window.BUDDY_COLORS = C;
function draw(){
  const t = now();
  cx.clearRect(0, 0, 280, 230);
  // springy antenna + breathing
  S.antV += (-S.antA * .08) - S.antV * .08; S.antA += S.antV;
  S.bob = Math.sin(t / (S.asleep ? 1300 : 700)) * (S.asleep ? 2.2 : 1.6);
  S.slip += (S.slipT - S.slip) * .06;
  S.look.x += (S.lookT.x - S.look.x) * .15; S.look.y += (S.lookT.y - S.look.y) * .15;
  S.hand += (S.handT - S.hand) * .2; if (S.handT && t > S.actionT) S.handT = 0;
  S.poke *= .9;
  let x = HX, y = HY + S.bob, sx = 1, sy = 1, rot = 0;
  const a = t < S.actionT ? S.action : null, p = a ? 1 - (S.actionT - t) / 1100 : 0;
  if (a === 'jump' || a === 'cheer') y -= Math.sin(Math.min(1, p * 1.2) * Math.PI) * 26;
  if (a === 'dance') { x += Math.sin(t / 110) * 9; rot = Math.sin(t / 110) * .12; }
  if (a === 'spin') rot = p * Math.PI * 2;
  if (a === 'nod') y += Math.sin(p * Math.PI * 4) * 4;
  if (a === 'shrug') rot = Math.sin(p * Math.PI * 2) * .1;
  if (S.ring > 0) { rot += Math.sin(t / 28) * .07 * S.ring; S.ring = Math.max(0, S.ring - .004); }
  if (S.asleep) rot = -.16;
  if (S.poke > .05) { sx += S.poke * .12; sy -= S.poke * .12; }
  if (S.mood === 'curious' && !a) rot += .08;
  if (S.walking) { y -= Math.abs(Math.sin(t / 95)) * 6; rot += S.walking * .09 + Math.sin(t / 95) * .05; }
  if (a === 'flip') rot = -p * Math.PI * 2, y -= Math.sin(p * Math.PI) * 34;
  if (a === 'love' || a === 'giggle') { x += Math.sin(t / 45) * 2.5; sy += Math.sin(t / 80) * .04; }
  if (S.dizzy > now()) rot += Math.sin(t / 120) * .18;
  // floor shadow
  cx.fillStyle = '#0005'; cx.beginPath(); cx.ellipse(HX, 222, 52 - (HY - y) * .4, 7, 0, 0, 7); cx.fill();
  cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(sx, sy);
  window.PET?.drawBack(cx, t, R);
  if (ART.ready()) { drawArt(t); drawRealFace(t); }       // the 3D-rendered buddy, with live eyes and mouth
  else { drawAntenna(t); drawHead(); drawFace(t); drawHeadset(t); }   // simple drawing until the artwork loads
  drawLit(lx => window.PET?.drawFront(lx, t, R));          // outfits get light, shading and a soft shadow
  cx.restore();
  window.PET?.drawProps(cx, t, x, y, R);
  window.SCENES?.drawOnBuddy(cx, t, x, y, R);
  if (S.hand > .02) drawHand(x, y, t);
  if (S.walking) drawWalkHand(x, y, t);
  drawFX(t);
  if (S.asleep && Math.random() < .012) floaty(Math.random() < .5 ? 'z' : 'Z', HX + 52, HY - 48);
  // idle fidgets so it feels alive
  if (!S.asleep && !S.talking && !S.thinking && t > S.idleFidget){ S.idleFidget = t + 30000 + Math.random() * 40000;
    const f = ['hum', 'look', 'wobble', 'adjust'][Math.floor(Math.random() * 4)];
    if (f === 'hum') { floaty('♪', HX + 50, HY - 40); setTimeout(() => floaty('♫', HX + 60, HY - 50), 500); }
    if (f === 'look') { S.lookT = { x: (Math.random() - .5) * 2, y: -.4 }; }
    if (f === 'wobble') S.antV += .6;
    if (f === 'adjust') { S.slipT = .25; setTimeout(() => S.slipT = 0, 700); } }
  requestAnimationFrame(draw);
}
// ---------- the realistic buddy: a 3D render (eyes and mouth painted out) + live face ----------
// Geometry measured on the 800 px render: head centre (372, 398), radius 248 → scaled so the head radius is R.
const ART = { img: new Image(), hs: new Image(), mic: new Image(), n: 0, ready(){ return this.n >= 3; } };
[['img', 'buddy-base.png'], ['hs', 'buddy-mask-headset.png'], ['mic', 'buddy-mask-mic.png']].forEach(([k, f]) => { ART[k].onload = () => { ART.n++; tintKey = ''; }; ART[k].src = f; });
const AK = R / 248, P8 = (x, y) => [(x - 372) * AK, (y - 398) * AK];   // 800-px render coords → head coords
const FACE = window.FACE = {
  L: { c: P8(225, 401), rx: 52 * AK, ry: 67 * AK, pupil: [1 * AK, 9 * AK], pr: 36 * AK },
  R: { c: P8(379, 392), rx: 65 * AK, ry: 67 * AK, pupil: [-1 * AK, 12 * AK], pr: 41 * AK },
  mouth: P8(295, 511), mic: P8(290, 628), tips: [P8(640, 178), P8(748, 257), P8(728, 398)],
};
let tinted = null, tintKey = '';
const CLASSIC_BAND = '#3a3f4f', CLASSIC_FOAM = '#2a2e3b';
function artCanvas(){
  const key = C.band + C.cup; if (tinted && tintKey === key) return tinted;
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.drawImage(ART.img, 0, 0, N, N);
  const recolour = (mask, col, lift) => { const l = document.createElement('canvas'); l.width = l.height = N; const q = l.getContext('2d');
    q.drawImage(ART.img, 0, 0, N, N); q.globalCompositeOperation = 'destination-in'; q.drawImage(mask, 0, 0, N, N);
    q.globalCompositeOperation = 'color'; q.fillStyle = col; q.fillRect(0, 0, N, N);
    q.globalCompositeOperation = 'screen'; q.globalAlpha = lift; q.fillStyle = col; q.fillRect(0, 0, N, N);
    q.globalCompositeOperation = 'destination-in'; q.globalAlpha = 1; q.drawImage(mask, 0, 0, N, N); g.drawImage(l, 0, 0); };
  if (C.band !== CLASSIC_BAND) recolour(ART.hs, C.band, .38);
  if (C.cup !== CLASSIC_FOAM) recolour(ART.mic, C.band, .15);
  tinted = c; tintKey = key; return c;
}
function drawArt(t){
  const s = 248 / 160 * AK * (800 / 512) * (160 / 248);       // 512-px image → head coords
  const k = 800 / 512 * AK, img = artCanvas();
  cx.drawImage(img, -372 * AK, -398 * AK, 512 * k, 512 * k);
  // antenna tips light up while thinking or listening; the mic glows while it hears you
  const glow = S.thinking ? .5 + .5 * Math.sin(t / 130) : S.listening ? Math.min(1, .3 + S.level * 1.5) : 0;
  cx.save(); cx.globalCompositeOperation = 'lighter';
  if (glow) FACE.tips.forEach(([x, y], i) => { const a = S.thinking ? .5 + .5 * Math.sin(t / 130 + i * 1.3) : glow;
    const gg = cx.createRadialGradient(x, y, 0, x, y, 14); gg.addColorStop(0, `rgba(170,240,255,${.75 * a})`); gg.addColorStop(1, 'rgba(90,200,255,0)'); cx.fillStyle = gg; cx.beginPath(); cx.arc(x, y, 14, 0, 7); cx.fill(); });
  if (S.listening) { const [x, y] = FACE.mic, a = .35 + S.level * 1.2; const gg = cx.createRadialGradient(x, y, 0, x, y, 22); gg.addColorStop(0, `rgba(255,190,110,${Math.min(.8, a)})`); gg.addColorStop(1, 'rgba(255,140,60,0)'); cx.fillStyle = gg; cx.beginPath(); cx.arc(x, y, 22, 0, 7); cx.fill(); }
  cx.restore();
}
function realEye(e, ex, ey, big, t){
  const [x, y] = e.c, rx = e.rx * big, ry = e.ry * big;
  cx.save();                                                      // a soft inset shadow where the eye meets the head
  cx.fillStyle = 'rgba(6,30,110,.38)'; cx.filter = 'blur(1.6px)'; cx.beginPath(); cx.ellipse(x + .8, y + 1.6, rx + 1.4, ry + 1.6, 0, 0, 7); cx.fill(); cx.filter = 'none';
  const w = cx.createRadialGradient(x - rx * .35, y - ry * .45, ry * .1, x, y, ry * 1.05);  // glossy white
  w.addColorStop(0, '#ffffff'); w.addColorStop(.55, '#f3f6fb'); w.addColorStop(.85, '#d9e1ef'); w.addColorStop(1, '#b8c5dc');
  cx.fillStyle = w; cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, 7); cx.fill();
  cx.save(); cx.clip();
  const px = x + e.pupil[0] * big + ex, py = y + e.pupil[1] * big + ey, pr = e.pr * (S.mood === 'excited' ? 1.05 : 1) * big;
  cx.fillStyle = 'rgba(20,30,60,.25)'; cx.beginPath(); cx.arc(px + .6, py + 1.2, pr + .8, 0, 7); cx.fill();
  const pg = cx.createRadialGradient(px - pr * .35, py - pr * .4, pr * .05, px, py, pr);  // glossy black pupil
  pg.addColorStop(0, '#5a5f70'); pg.addColorStop(.35, '#1a1c25'); pg.addColorStop(1, '#030306');
  cx.fillStyle = pg; cx.beginPath(); cx.arc(px, py, pr, 0, 7); cx.fill();
  cx.fillStyle = 'rgba(255,255,255,.95)'; cx.beginPath(); cx.ellipse(px + pr * .32, py - pr * .42, pr * .26, pr * .18, -.5, 0, 7); cx.fill();
  cx.fillStyle = 'rgba(255,255,255,.5)'; cx.beginPath(); cx.arc(px - pr * .38, py + pr * .38, pr * .09, 0, 7); cx.fill();
  if (S.mood === 'excited') { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(px - pr * .3, py - pr * .1, pr * .12, 0, 7); cx.fill(); }
  const sh = cx.createLinearGradient(x, y - ry, x, y - ry * .2); sh.addColorStop(0, 'rgba(10,40,120,.22)'); sh.addColorStop(1, 'rgba(10,40,120,0)');   // upper-lid shade
  cx.fillStyle = sh; cx.fillRect(x - rx, y - ry, rx * 2, ry);
  cx.restore(); cx.restore();
}
function shutEye(e, happy){
  const [x, y] = e.c, w = e.rx * .9;
  cx.save(); cx.strokeStyle = '#0a1d5c'; cx.lineWidth = 3.4; cx.lineCap = 'round'; cx.shadowColor = 'rgba(255,255,255,.35)'; cx.shadowOffsetY = 1;
  cx.beginPath(); if (happy) { cx.moveTo(x - w, y + 4); cx.quadraticCurveTo(x, y - 10, x + w, y + 4); } else { cx.moveTo(x - w, y + 1); cx.quadraticCurveTo(x, y + 8, x + w, y + 1); }
  cx.stroke(); cx.restore();
}
function glossyBlob(x, y, rx, ry, fill){                            // the mouth: dark, glossy, slightly inset
  cx.save(); cx.fillStyle = 'rgba(255,255,255,.25)'; cx.beginPath(); cx.ellipse(x, y + 1.2, rx + .8, ry + .8, 0, 0, 7); cx.fill();
  const g = cx.createRadialGradient(x - rx * .3, y - ry * .4, 0, x, y, Math.max(rx, ry)); g.addColorStop(0, fill ? '#3a1622' : '#2b2f3d'); g.addColorStop(1, '#050409');
  cx.fillStyle = g; cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, 7); cx.fill();
  cx.fillStyle = 'rgba(255,255,255,.55)'; cx.beginPath(); cx.ellipse(x - rx * .3, y - ry * .45, rx * .28, ry * .16, -.3, 0, 7); cx.fill(); cx.restore();
}
function drawRealFace(t){
  if (t > S.nextBlink) { S.blinkAt = t; S.nextBlink = t + 2200 + Math.random() * 3500; }
  const blink = t - S.blinkAt < 130, m = S.mood, a = t < S.actionT ? S.action : null;
  const ex = Math.max(-1, Math.min(1, S.look.x)) * 4.5, ey = Math.max(-1, Math.min(1, S.look.y)) * 4 + (S.thinking ? -4 : 0);
  const special = S.dizzy > t ? 'swirl' : S.eyeStyle && S.eyeUntil > t ? S.eyeStyle : null;
  [['L', -1], ['R', 1]].forEach(([k, side]) => {
    const e = FACE[k], big = m === 'excited' ? 1.08 : m === 'curious' && side === 1 ? 1.07 : 1;
    if (special && !S.asleep) { realEye(e, 0, 0, 1, t); return window.PET?.drawEye(cx, special, e.c[0], e.c[1], t); }
    const shut = S.asleep || blink || (a === 'wink' && side === 1);
    if (shut) return shutEye(e, false);
    if (m === 'happy' && (a === 'wave' || a === 'cheer') || m === 'proud' && side === 1) return shutEye(e, true);
    realEye(e, ex, ey, big, t);
  });
  if (m === 'worried' || m === 'focused' || m === 'confused') {
    cx.save(); cx.strokeStyle = '#0a1d5c'; cx.lineWidth = 3.4; cx.lineCap = 'round';
    [['L', -1], ['R', 1]].forEach(([k, s2]) => { const [x, y] = FACE[k].c, top = y - FACE[k].ry - 5, tilt = m === 'worried' ? -s2 * 3.5 : m === 'focused' ? s2 * 3.5 : (s2 === 1 ? -4 : 2);
      cx.beginPath(); cx.moveTo(x - 9, top + tilt); cx.lineTo(x + 9, top - tilt); cx.stroke(); }); cx.restore();
  }
  if (m === 'happy' || m === 'proud' || m === 'excited') { cx.save(); cx.filter = 'blur(2.5px)'; cx.fillStyle = 'rgba(255,120,170,.45)';
    [[FACE.L.c[0] - 6, 20], [FACE.R.c[0] + 10, 18]].forEach(([x, y]) => { cx.beginPath(); cx.ellipse(x, y, 8, 4.5, 0, 0, 7); cx.fill(); }); cx.restore(); }
  const [mx, my] = FACE.mouth, open = S.talking ? .25 + S.mouth * .9 : 0;
  if (S.asleep) { const z = 2.6 + Math.sin(t / 650) * 1.2; glossyBlob(mx, my, z, z * .85); }
  else if (S.talking) { glossyBlob(mx, my, 5.5 + open * 3, 2.5 + open * 7.5, true);
    if (open > .45) { cx.save(); cx.fillStyle = '#ff6b8b'; cx.beginPath(); cx.ellipse(mx, my + open * 4.5, 3.8, 2.4, 0, 0, 7); cx.fill(); cx.restore(); } }
  else if (m === 'happy' || m === 'excited' || m === 'proud' || a === 'wave' || a === 'cheer') {
    cx.save(); const g = cx.createLinearGradient(mx, my - 4, mx, my + 8); g.addColorStop(0, '#2a1220'); g.addColorStop(1, '#050409');
    cx.fillStyle = 'rgba(255,255,255,.25)'; cx.beginPath(); cx.moveTo(mx - 9, my - 2); cx.quadraticCurveTo(mx, my + 11, mx + 9, my - 2); cx.closePath(); cx.fill();
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(mx - 9, my - 3); cx.quadraticCurveTo(mx, my + 10, mx + 9, my - 3); cx.quadraticCurveTo(mx, my + 1, mx - 9, my - 3); cx.fill();
    cx.fillStyle = '#ff6b8b'; cx.beginPath(); cx.ellipse(mx, my + 4.5, 3, 1.6, 0, 0, 7); cx.fill(); cx.restore(); }
  else if (m === 'worried' || m === 'confused') { cx.save(); cx.strokeStyle = '#0a0612'; cx.lineWidth = 3; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(mx - 7, my + 2); cx.quadraticCurveTo(mx - 3, my - 3, mx, my + 1); cx.quadraticCurveTo(mx + 4, my + 4, mx + 7, my - 1); cx.stroke(); cx.restore(); }
  else glossyBlob(mx, my, 4.6, 5.7);                                // the signature little "o"
  if (m === 'confused' && !S.talking) { cx.font = 'bold 22px system-ui'; cx.fillStyle = '#ffd84d'; cx.fillText('?', R * .7, -R * .75); }
}
const EDGE = document.createElement('canvas'), EX = EDGE.getContext('2d');
function bevel(){
  if (!window.PET?.isWearing?.()) return;
  if (EDGE.width !== LAY.width || EDGE.height !== LAY.height) { EDGE.width = LAY.width; EDGE.height = LAY.height; }
  const d = Math.max(1, window.devicePixelRatio || 1), W = LAY.width, H = LAY.height;
  const pass = (col, dx, dy, blur) => {
    EX.setTransform(1, 0, 0, 1, 0, 0); EX.globalCompositeOperation = 'source-over'; EX.clearRect(0, 0, W, H);
    EX.fillStyle = col; EX.fillRect(0, 0, W, H);
    EX.globalCompositeOperation = 'destination-out'; EX.filter = `blur(${blur * d}px)`; EX.drawImage(LAY, dx * d, dy * d); EX.filter = 'none';
    LX.save(); LX.setTransform(1, 0, 0, 1, 0, 0); LX.globalCompositeOperation = 'source-atop'; LX.drawImage(EDGE, 0, 0); LX.restore(); };
  pass('rgba(0,12,45,.55)', -2.2, -2.6, 2.4);                       // shade where the light can't reach
  pass('rgba(255,255,255,.55)', 1.6, 2, 1.6);                       // a glossy rim on the lit side
}
// outfits drawn on a layer, then lit like the 3D render: light from the top left, shade bottom right, a soft contact shadow
const LAY = document.createElement('canvas'), LX = LAY.getContext('2d');
function drawLit(fn){
  if (LAY.width !== cv.width || LAY.height !== cv.height) { LAY.width = cv.width; LAY.height = cv.height; }
  LX.setTransform(1, 0, 0, 1, 0, 0); LX.clearRect(0, 0, LAY.width, LAY.height);
  const T = cx.getTransform(); LX.setTransform(T); fn(LX);
  LX.globalCompositeOperation = 'source-atop';
  const g = LX.createRadialGradient(-R * .55, -R * 1.25, R * .05, -R * .1, -R * .3, R * 2);
  g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.3, 'rgba(255,255,255,.12)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,10,40,.4)');
  LX.fillStyle = g; LX.fillRect(-R * 3, -R * 3, R * 6, R * 6); LX.globalCompositeOperation = 'source-over';
  bevel();                                                        // rounded edges: light on the top left, shade on the bottom right
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); const d = Math.max(1, window.devicePixelRatio || 1);
  cx.shadowColor = 'rgba(0,15,60,.45)'; cx.shadowBlur = 5 * d; cx.shadowOffsetX = 1.5 * d; cx.shadowOffsetY = 3 * d; cx.drawImage(LAY, 0, 0); cx.restore();
}
function drawAntenna(t){
  const sway = S.antA * .5 + Math.sin(t / 900) * .04, droop = S.asleep ? .35 : 0;
  const nodes = [[-.62, 34], [-.98, 42], [-1.32, 30]];          // angles (radians, up-right side) and lengths
  nodes.forEach(([ang, len], i) => {
    const a2 = ang + sway * (1 + i * .3) + droop;
    const x0 = Math.cos(a2) * (R - 6), y0 = Math.sin(a2) * (R - 6), x1 = Math.cos(a2) * (R + len), y1 = Math.sin(a2) * (R + len);
    const nx = -Math.sin(a2), ny = Math.cos(a2);
    cx.fillStyle = C.blue2; cx.beginPath(); cx.moveTo(x0 + nx * 6, y0 + ny * 6); cx.lineTo(x1 + nx * 1.5, y1 + ny * 1.5); cx.lineTo(x1 - nx * 1.5, y1 - ny * 1.5); cx.lineTo(x0 - nx * 6, y0 - ny * 6); cx.fill();
    const glow = S.thinking ? .5 + .5 * Math.sin(t / 130 + i * 1.3) : S.listening ? S.level : 0;
    const g = cx.createRadialGradient(x1 - 2, y1 - 2, 1, x1, y1, 8); g.addColorStop(0, glow ? '#e8fbff' : '#bfe3ff'); g.addColorStop(1, glow ? '#5fd4ff' : C.blue);
    if (glow) { cx.shadowColor = '#7ae3ff'; cx.shadowBlur = 14 * glow; }
    cx.fillStyle = g; cx.beginPath(); cx.arc(x1, y1, 7, 0, 7); cx.fill(); cx.shadowBlur = 0;
  });
}
function drawHead(){
  const g = cx.createRadialGradient(-R * .35, -R * .42, R * .08, 0, 0, R * 1.05);
  g.addColorStop(0, '#bfe2ff'); g.addColorStop(.28, '#4f95ff'); g.addColorStop(.75, C.blue); g.addColorStop(1, C.blue2);
  cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.fill();
  cx.fillStyle = '#ffffff70'; cx.beginPath(); cx.ellipse(-R * .38, -R * .55, R * .26, R * .13, -.55, 0, 7); cx.fill();
  cx.fillStyle = '#ffffff30'; cx.beginPath(); cx.ellipse(R * .5, R * .5, R * .2, R * .08, -.8, 0, 7); cx.fill();
}
function drawFace(t){
  if (t > S.nextBlink) { S.blinkAt = t; S.nextBlink = t + 2200 + Math.random() * 3500; }
  const blink = t - S.blinkAt < 130, m = S.mood, a = t < S.actionT ? S.action : null;
  const ex = Math.max(-1, Math.min(1, S.look.x)) * 7, ey = Math.max(-1, Math.min(1, S.look.y)) * 6 + (S.thinking ? -6 : 0);
  const eyeY = -R * .12, gap = R * .27;
  const special = S.dizzy > t ? 'swirl' : S.eyeStyle && S.eyeUntil > t ? S.eyeStyle : null;
  if (special && !S.asleep) [-1, 1].forEach(s => window.PET?.drawEye(cx, special, s * gap, eyeY, t));
  else [-1, 1].forEach(s => {
    const x = s * gap, big = m === 'excited' ? 1.12 : m === 'curious' && s === 1 ? 1.1 : 1;
    const shut = S.asleep || blink || (a === 'wink' && s === 1);
    if (shut || m === 'happy' && (a === 'wave' || a === 'cheer') || m === 'proud' && s === 1){
      cx.strokeStyle = C.ink; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath();
      if (S.asleep || blink) { cx.moveTo(x - 11, eyeY + 2); cx.quadraticCurveTo(x, eyeY + 8, x + 11, eyeY + 2); }
      else { cx.moveTo(x - 11, eyeY + 4); cx.quadraticCurveTo(x, eyeY - 9, x + 11, eyeY + 4); }
      cx.stroke(); return;
    }
    cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(x, eyeY, 15 * big, 17 * big, 0, 0, 7); cx.fill();
    cx.strokeStyle = '#0d47c955'; cx.lineWidth = 1.5; cx.stroke();
    const pr = m === 'excited' ? 8.5 : 7.5;
    cx.fillStyle = C.ink; cx.beginPath(); cx.arc(x + ex, eyeY + ey + 2, pr, 0, 7); cx.fill();
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x + ex + 2.8, eyeY + ey - 1.5, 2.6, 0, 7); cx.fill();
    if (m === 'excited') { cx.beginPath(); cx.arc(x + ex - 2.5, eyeY + ey + 4, 1.2, 0, 7); cx.fill(); }
  });
  // brows for worried / focused / confused
  if (m === 'worried' || m === 'focused' || m === 'confused'){
    cx.strokeStyle = C.ink; cx.lineWidth = 3.5; cx.lineCap = 'round';
    [-1, 1].forEach(s => { cx.beginPath(); const tilt = m === 'worried' ? -s * 4 : m === 'focused' ? s * 4 : (s === 1 ? -5 : 2);
      cx.moveTo(s * gap - 10, eyeY - 24 + tilt); cx.lineTo(s * gap + 10, eyeY - 24 - tilt); cx.stroke(); });
  }
  // cheeks
  if (m === 'happy' || m === 'proud' || m === 'excited') { cx.fillStyle = '#ff7fb455'; [-1, 1].forEach(s => { cx.beginPath(); cx.ellipse(s * R * .5, R * .2, 9, 5, 0, 0, 7); cx.fill(); }); }
  // mouth
  const my = R * .3, open = S.talking ? .25 + S.mouth * .9 : 0;
  cx.fillStyle = C.ink; cx.strokeStyle = C.ink; cx.lineWidth = 3.5; cx.lineCap = 'round';
  if (S.asleep) { const s = 3 + Math.sin(t / 650) * 1.5; cx.beginPath(); cx.ellipse(0, my, s, s * .8, 0, 0, 7); cx.fill(); }
  else if (S.talking) { cx.beginPath(); cx.ellipse(0, my, 7 + open * 4, 2 + open * 9, 0, 0, 7); cx.fill();
    if (open > .45) { cx.fillStyle = '#ff6b8b'; cx.beginPath(); cx.ellipse(0, my + open * 5, 5, 3, 0, 0, 7); cx.fill(); } }
  else if (m === 'happy' || m === 'excited' || m === 'proud' || (a === 'wave' || a === 'cheer')) { cx.beginPath(); cx.moveTo(-11, my - 3); cx.quadraticCurveTo(0, my + 11, 11, my - 3); cx.closePath(); cx.fill(); }
  else if (m === 'worried' || m === 'confused') { cx.beginPath(); cx.moveTo(-8, my + 2); cx.quadraticCurveTo(-3, my - 3, 0, my + 1); cx.quadraticCurveTo(4, my + 4, 8, my - 1); cx.stroke(); }
  else { cx.beginPath(); cx.ellipse(0, my, 5.5, 6.5, 0, 0, 7); cx.fill(); }   // the signature little "o"
  if (m === 'confused' && !S.talking) { cx.font = 'bold 22px system-ui'; cx.fillStyle = '#ffd84d'; cx.fillText('?', R * .7, -R * .75); }
}
function drawHeadset(t){
  const slip = S.asleep ? 1 : S.slip;                 // when napping the headset slides down around the neck
  cx.save(); cx.translate(0, slip * 34); cx.rotate(slip * .18);
  // band
  cx.lineCap = 'round';
  cx.strokeStyle = C.band2; cx.lineWidth = 13; cx.beginPath(); cx.arc(0, 4, R + 4, Math.PI * 1.04, Math.PI * 1.96); cx.stroke();
  cx.strokeStyle = C.band; cx.lineWidth = 8; cx.beginPath(); cx.arc(0, 4, R + 4, Math.PI * 1.06, Math.PI * 1.94); cx.stroke();
  cx.strokeStyle = '#ffffff22'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 1, R + 5, Math.PI * 1.25, Math.PI * 1.6); cx.stroke();
  // ear cups
  [-1, 1].forEach(s => {
    const x = s * (R + 2), y = 6;
    cx.fillStyle = C.cup; cx.beginPath(); cx.ellipse(x, y, 15, 24, 0, 0, 7); cx.fill();
    const rg = cx.createLinearGradient(x - 10, y - 20, x + 10, y + 20); rg.addColorStop(0, '#f2f4f8'); rg.addColorStop(.5, C.ring); rg.addColorStop(1, '#8e94a3');
    cx.strokeStyle = rg; cx.lineWidth = 4.5; cx.beginPath(); cx.ellipse(x + s * 3, y, 10, 18, 0, 0, 7); cx.stroke();
    cx.fillStyle = '#3c4152'; cx.beginPath(); cx.ellipse(x + s * 3, y, 6, 12, 0, 0, 7); cx.fill();
  });
  // mic boom from the left cup to the front, orange foam tip
  const lv = S.listening ? S.level : 0;
  cx.strokeStyle = C.band2; cx.lineWidth = 4.5; cx.beginPath(); cx.moveTo(-R - 4, 22); cx.quadraticCurveTo(-R + 2, R * .72, -R * .42, R * .62); cx.stroke();
  if (lv || S.listening) { cx.shadowColor = '#ffb36b'; cx.shadowBlur = 8 + lv * 22; }
  const fg = cx.createRadialGradient(-R * .42, R * .6, 1, -R * .38, R * .62, 11); fg.addColorStop(0, '#ffb066'); fg.addColorStop(1, C.foam);
  cx.fillStyle = fg; cx.beginPath(); cx.ellipse(-R * .36, R * .62, 11 + lv * 2, 7.5 + lv * 2, -.15, 0, 7); cx.fill(); cx.shadowBlur = 0;
  cx.restore();
}
const HANDS = {}; ['five', 'fist', 'ok', 'shaka', 'point', 'offer', 'spread', 'walk'].forEach(n => { const i = new Image(); i.src = `hands/${n}.png`; HANDS[n] = i; });
window.HANDPOS = { x: HX + R + 16, y: HY + 4 };
function drawHand(x, y, t){
  const g = S.gesture || 'five', img = HANDS[g];
  if (!img?.complete || !img.naturalWidth) return drawHandSimple(x, y, t);
  const k = Math.min(1, S.hand * 1.3), h = 56 * (g === 'offer' || g === 'walk' || g === 'point' || g === 'fist' ? .82 : 1), w = h * img.naturalWidth / img.naturalHeight;
  let hx = x + R + 24, hy = y + 4 - k * 14, rot = 0;
  if (g === 'five') rot = Math.sin(t / 110) * .45;                                 // waving
  if (g === 'fist') hy -= Math.abs(Math.sin(t / 120)) * 9;                         // fist pump
  if (g === 'ok' || g === 'shaka') rot = Math.sin(t / 260) * .12;
  if (g === 'point') { rot = -.5 + Math.sin(t / 200) * .05; hx += 2; hy -= 10; }   // points up at the bubble
  if (g === 'spread') { rot = Math.sin(t / 90) * .25; }                            // jazz hands
  if (g === 'offer') { hx += 4; rot = Math.sin(t / 300) * .06; }
  window.HANDPOS = { x: hx, y: hy };
  cx.save(); cx.globalAlpha = k; cx.translate(hx, hy); cx.rotate(rot); cx.scale(.6 + .4 * k, .6 + .4 * k);
  cx.shadowColor = 'rgba(0,15,60,.35)'; cx.shadowBlur = 6; cx.shadowOffsetY = 3;
  cx.drawImage(img, -w / 2, -h / 2, w, h); cx.restore();
}
function drawWalkHand(x, y, t){                                                  // little finger-walk under it while it strolls
  const img = HANDS.walk; if (!img?.complete || !img.naturalWidth) return;
  const h = 30, w = h * img.naturalWidth / img.naturalHeight;
  cx.save(); cx.translate(x + 6, y + R + 4); cx.rotate(Math.sin(t / 95) * .18); cx.scale(S.walking < 0 ? -1 : 1, 1);
  cx.shadowColor = 'rgba(0,15,60,.35)'; cx.shadowBlur = 5; cx.shadowOffsetY = 2; cx.drawImage(img, -w / 2, -h / 2, w, h); cx.restore();
}
function drawHandSimple(x, y, t){
  cx.save(); cx.globalAlpha = Math.min(1, S.hand * 1.4);
  const hx = x + R + 14, hy = y - 8 - S.hand * 18 + Math.sin(t / 90) * 2, r = Math.sin(t / 110) * .5;
  cx.translate(hx, hy); cx.rotate(r);
  const g = cx.createRadialGradient(-4, -5, 1, 0, 0, 15); g.addColorStop(0, '#bfe2ff'); g.addColorStop(1, C.blue);
  cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, 13, 0, 7); cx.fill();
  [-1.2, -.5, .2, .9].forEach(a => { cx.beginPath(); cx.ellipse(Math.cos(a - 1.6) * 14, Math.sin(a - 1.6) * 14, 4.5, 7, a, 0, 7); cx.fill(); });
  cx.restore();
}
function drawFX(t){
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (let i = S.fx.length - 1; i >= 0; i--){ const f = S.fx[i];
    f.x += f.vx; f.y += f.vy; f.vy += f.g; f.life -= f.slow ? .006 : .014;
    cx.save(); cx.globalAlpha = Math.max(0, f.life); cx.translate(f.x, f.y); cx.rotate(f.rot);
    cx.font = `${f.slow ? 'bold ' : ''}${f.size}px "Segoe UI Emoji",system-ui`; cx.fillStyle = '#d6e7ff'; cx.fillText(f.ch, 0, 0); cx.restore();
    if (f.life <= 0 || f.y > 240) S.fx.splice(i, 1); }
}

// ---------- bubble ----------
let hideT = null, typeT = null, sticky = false;
// While a question is with your Mind, play reactions don't wipe the "thinking" bubble:
// they appear as an extra line under it, and the bubble goes back to "thinking" until the answer arrives.
let pending = 0, thinkingHTML = '', noteT = null;
const THINKING = '<span class="tag q">🧠 thinking about your question</span><br><span class="dots"><span>.</span><span>.</span><span>.</span></span>';
function show(html, { ms, stick = false, force = false } = {}){
  if (pending > 0 && !force){
    clearTimeout(hideT); clearTimeout(noteT); clearInterval(typeT); sticky = true;
    bubble.innerHTML = thinkingHTML + `<div style="margin-top:6px;padding-top:6px;border-top:1.5px dashed #1d224033;font-size:13.5px">${html}</div>`;
    bubble.classList.add('show'); tail.classList.add('show');
    if (!stick) noteT = setTimeout(() => { if (pending > 0) bubble.innerHTML = thinkingHTML; }, ms ? Math.min(ms, 4000) : 2800);
    return;
  }
  clearTimeout(hideT); clearTimeout(noteT); clearInterval(typeT); sticky = stick;
  document.getElementById('needs')?.classList.remove('show');
  bubble.innerHTML = html; bubble.classList.add('show'); tail.classList.add('show'); bubble.scrollTop = 0;
  if (!stick) hideT = setTimeout(hide, ms || 6000);
}
function hide(){ if (sticky) return; bubble.classList.remove('show'); tail.classList.remove('show'); }
function forceHide(){ if (pending > 0) { clearTimeout(noteT); bubble.innerHTML = thinkingHTML; bubble.classList.add('show'); tail.classList.add('show'); sticky = true; return; } sticky = false; hide(); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function typewrite(text, prefix = '', ms, force = false){
  show(prefix + '<span id="tw"></span>', { ms: ms || Math.max(5500, text.length * 75 + 2500), force });
  const el = document.getElementById('tw'); let i = 0;
  typeT = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeT); }, 22);
}

// ---------- voice out ----------
let audio = null, ac = null, an = null, data = null;
// Voice rule: ElevenLabs speaks what matters (answers to you, reminders, meeting alerts, its own conversation starters,
// welcome back, evolution day). Everything else (pet chatter, game lines, status) is a bubble only. No robot voice.
async function speak(text, mood, { silent = false, answer = false, important = false, kind = '' } = {}){
  const voiced = !silent && text && !INFO.quiet && !window.PET?.muted() && (answer || important);
  if (voiced) duck();
  stopSpeaking();
  if (!voiced) { if (!silent && text) setTimeout(afterSpeaking, Math.min(6000, 1500 + text.length * 45)); return; }
  if ((kind === 'meeting' || kind === 'reminder') && window.ANN) await ANN.chime(ANN.cfg.chime === 'none' ? 'dingdong' : ANN.cfg.chime, 'open', .2);   // a little ding first
  const bytes = await B.tts(text, mood).catch(() => null);
  if (bytes && bytes.byteLength){
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    audio = new Audio(url);
    try { ac ||= new AudioContext(); const src = ac.createMediaElementSource(audio); an = ac.createAnalyser(); an.fftSize = 512; data = new Uint8Array(an.fftSize); src.connect(an); an.connect(ac.destination); } catch (_) { an = null; }
    S.talking = true; audio.onended = audio.onerror = () => { S.talking = false; S.mouth = 0; URL.revokeObjectURL(url); afterSpeaking(); };
    audio.play().catch(() => { S.talking = false; });
    return;
  }
  setTimeout(afterSpeaking, Math.min(6000, 1500 + text.length * 45));   // ElevenLabs unavailable: the bubble carries it
}
function stopSpeaking(){ try { audio?.pause(); } catch (_) {} audio = null; window.ANN?.stop(); S.talking = false; }
setInterval(() => {                                     // mouth follows the real loudness
  if (!S.talking) return;
  if (an && audio){ an.getByteTimeDomainData(data); let s = 0; for (const v of data) s += (v - 128) ** 2; S.mouth = Math.min(1, Math.sqrt(s / data.length) / 28); }
  else S.mouth = Math.max(0, S.mouth * .7 + (Math.random() < .3 ? .5 : 0));
}, 50);

// ---------- what the buddy says ----------
function say({ text, mood, action, silent, interim, welcome, answer, choices, proactive, scene, show: showList, fx }){
  if (!text) return;
  if (!interim) S.busyUntil = Math.max(S.busyUntil || 0, now() + Math.max(4000, text.length * 65) + (silent ? 0 : 3000));
  S.thinking = interim ? true : pending > 0;
  if (mood) S.mood = mood; if (action) act(action); else if (showList?.length) act('point');   // points at what it shows you
  let extra = '';
  if (welcome?.recent) extra = `<div><span class="more" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden">📋 where you left off</span><pre class="recent" hidden>${esc(welcome.recent)}</pre></div>`;
  if (interim) { const h = esc(text) + ' <span class="dots"><span>.</span><span>.</span><span>.</span></span>'; if (pending > 0) thinkingHTML = h; show(h, { stick: true, force: true }); speak(text, mood, { silent: true }); return; }   // "let me check…" while the Mind works: shown, not spoken
  typewrite(text, '', welcome ? 14000 : undefined, !!answer);
  if (proactive) {
    window.SCENES?.react({ text, scene, show: showList, fx }, '');
    const list = (choices && choices.length ? choices : ['Sure!', 'Not now']).slice(0, 3);
    setTimeout(() => { if (!bubble.querySelector('#tw')) return;
      bubble.insertAdjacentHTML('beforeend', `<div class="btns">${list.map((c, i) => `<button ${i === list.length - 1 && /not now|later|nope|no thanks|nanti|skip/i.test(c) ? 'class="alt" ' : ''}data-reply="${esc(c)}">${esc(c)}</button>`).join('')}</div>`);
      sticky = true; clearTimeout(hideT); hideT = setTimeout(() => { sticky = false; hide(); }, 45000); }, 400);
    if (now() - lastVoiceUse < 30 * 60000) convo = true;                 // you've been talking by voice: just answer out loud
  }
  if (extra) setTimeout(() => bubble.insertAdjacentHTML('beforeend', extra), 30);
  speak(text, mood, { silent, answer: !!answer, important: !!(proactive || welcome) });
  setTimeout(() => { if (!S.talking && S.mood !== 'sleepy') S.mood = 'happy'; }, 9000);
}
async function askMind(text, { spoken = false } = {}){
  if (S.asleep) { B.wakeMe?.(); undim(); S.asleep = false; S.slipT = 0; }
  if (!spoken) { followups = 0; convo = false; }
  if (window.PET && await PET.local(text, { spoken })) return;
  convo = spoken; S.thinking = true; S.mood = 'curious'; stopSpeaking();
  pending++; thinkingHTML = THINKING;
  show(THINKING, { stick: true, force: true });
  const slow1 = setTimeout(() => { if (pending > 0) { thinkingHTML = '<span class="tag q">🧠 still working on it</span><br>Looking things up takes a moment <span class="dots"><span>.</span><span>.</span><span>.</span></span>'; if (!bubble.querySelector('button')) bubble.innerHTML = thinkingHTML; } }, 20000);
  const slow2 = setTimeout(() => { if (pending > 0) { thinkingHTML = '<span class="tag q">🧠 almost…</span><br>Your Mind is digging deep on this one <span class="dots"><span>.</span><span>.</span><span>.</span></span>'; if (!bubble.querySelector('button')) bubble.innerHTML = thinkingHTML; } }, 70000);
  const r = await B.ask(text).catch(e => ({ text: 'Oops: ' + e.message, mood: 'confused' }));
  clearTimeout(slow1); clearTimeout(slow2);
  pending = Math.max(0, pending - 1); clearTimeout(noteT);
  S.thinking = pending > 0; sticky = false;
  if (!r) return hide();
  say({ ...r, answer: !(r.late || r.error) }); window.PET?.chatted(r);   // only a real reply uses ElevenLabs; "still working" / errors use the free voice window.SCENES?.react(r, text);
  for (const d of r.done || []){
    if (d.type === 'remind') { burst(['⏰'], 3); chipFlash('⏰ reminder set'); }
    if (d.type === 'event') { burst(['📅'], 3); chipFlash('📅 added to calendar'); }
    if (d.type === 'note') { burst(['📝'], 3); chipFlash('📝 saved to Drive'); }
  }
}
function chipFlash(t){ chip.textContent = t; chip.classList.add('show'); setTimeout(() => chip.classList.remove('show'), 3500); }

// ---------- events from the app ----------
B.on.info(i => { INFO = i; window.ANN?.set(i.announce); if (i.handsfree !== undefined && i.handsfree !== HF.on) setHandsFree(i.handsfree); });
B.on.announce?.(c => { INFO.announce = c; window.ANN?.set(c); });
B.on.say(say);
B.on.cursor(({ x, y }) => { if (!S.asleep) S.lookT = { x: x / 500, y: y / 400 }; });
B.on.thinking(() => { S.thinking = true; });
B.on.thinkingDone?.(() => { if (pending === 0) S.thinking = false; });
B.on.sleep(() => { S.asleep = true; convo = false; dimLater(); window.DREAMS?.start(); S.mood = 'sleepy'; stopSpeaking(); if (!sticky) hide(); floaty('z', HX + 50, HY - 46); });
B.on.wake(() => { undim(); if (!S.asleep) return; S.asleep = false; S.mood = 'excited'; S.slipT = 0; act('jump'); S.antV += .9; floaty('!', HX + 40, HY - 70); });
B.on.working(({ mode }) => { S.thinking = true; S.mood = 'focused'; show(`<span class="tag fix">✏️ ${mode === 'improve' ? 'polishing' : 'fixing'}</span><br>On it <span class="dots"><span>.</span><span>.</span><span>.</span></span>`, { stick: true }); });
B.on.fixed(({ changes, mode }) => { S.thinking = false; sticky = false;
  if (!changes) { S.mood = 'proud'; act('nod'); typewrite('Looks perfect already! 👌', '<span class="tag fix">✏️ checked</span><br>', 3500); return; }
  S.mood = 'proud'; act('cheer'); burst(['✨', '✏️'], 10);
  typewrite(mode === 'improve' ? 'Polished and pasted back! ✨' : `Fixed ${changes} ${changes === 1 ? 'thing' : 'things'} and pasted it back!`, '<span class="tag fix">✏️ done</span><br>', 4000); });
B.on.alert(al => {
  undim(); S.asleep = false; S.slipT = 0; S.ring = 1; S.mood = al.mood || 'excited'; act('jump'); burst([al.kind === 'meeting' ? '🔔' : '⏰'], 6);
  const tag = al.kind === 'meeting' ? '<span class="tag meet">📅 meeting</span>' : '<span class="tag rem">⏰ reminder</span>';
  const btns = al.kind === 'meeting'
    ? (al.join ? `<button data-join="${esc(al.join)}">🎥 Join</button>` : al.link ? `<button data-join="${esc(al.link)}" class="alt">Open</button>` : '') + '<button class="alt" data-ok>Got it</button>'
    : `<button data-ok>✅ Done</button><button class="alt" data-snooze="${esc(al.id)}">😴 10 min</button>`;
  const hfBtn = al.kind === 'meeting' && al.startingNow && HF.on ? `<div class="btns"><button data-hf="meeting" data-until="${al.endsAt || ''}">🔇 Hands-free off till it ends</button></div>` : '';
  if (hfBtn) HF.asked.meeting = now();
  show(`${tag}<br><b>${esc(al.text)}</b><div class="btns">${btns}</div>${hfBtn}`, { stick: true });
  speak(al.say, S.mood, { kind: al.kind, important: true });
});
B.on.confirm(({ id, question }) => {
  undim(); S.asleep = false; S.slipT = 0; S.mood = 'curious'; act('think');
  show(`<span class="tag q">🤔 quick check</span><br>${esc(question)}<div class="btns"><button data-yes="${id}">👍 Yes</button><button class="alt" data-no="${id}">Nope</button></div>`, { stick: true });
  speak(question, 'curious', { answer: true });
});
B.on.type(openAsk);
B.on.listenToggle(micPressed);
B.on.handsfree(on => setHandsFree(on));
B.on.scale?.(() => setTimeout(fitCanvas, 60));
B.on.lateAnswer?.(r => { if (S.asleep) { B.wakeMe?.(); undim(); } S.asleep = false; S.slipT = 0; burst(['💡', '✨'], 8); say({ ...r, text: 'Got it! ' + r.text, answer: true }); window.SCENES?.react(r, 'weather food'); });
B.on.help(() => show(`<span class="tag q">⌨️ hotkeys</span><br>🎤 click my orange mic, <b>Ctrl+Alt+M</b> or <b>Ctrl+Alt+Space</b> talk<br><b>Ctrl+Alt+H</b> hands-free ("Hey ${esc(INFO.name || 'Buddy')}") · <b>Ctrl+Alt+T</b> type<br><b>Ctrl+Alt+F</b> fix selected text<br><b>Ctrl+Alt+I</b> improve selected text<br><b>Ctrl+Alt+Q</b> quiet · <b>Ctrl+Alt+P</b> off the record<br><b>Ctrl+Alt+B</b> hide/show<br>Drag me around · double-click to type · right-click for the menu · drop a file on me to save it to Drive`, { ms: 15000 }));

bubble.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.hf) { sticky = false; hide(); const v = b.dataset.hf;
    if (v === 'keep') { HF.keepUntil = now() + 10 * 60000; hfResume('👂 listening again'); return; }
    hfOff();                                                                   // off / hour / meeting
    if (v === 'hour') { HF.backAt = now() + 3600000; chipFlash('👂 hands-free off for 1 hour'); }
    else if (v === 'meeting') { HF.backAt = Number(b.dataset.until) || 0; HF.afterCall = true; chipFlash('👂 hands-free off until the meeting ends'); }
    else chipFlash('👂 hands-free off');
    return; }
  if (b.dataset.reply) { const c = b.dataset.reply; convo = false; sticky = false;
    if (/^(not now|later|maybe later|nope|no thanks|nah|nanti|nanti aja|skip|no)\b/i.test(c)) { B.initiativeFeedback?.('no'); hide(); S.mood = 'happy'; act('nod'); show('No worries! I\'ll be right here. 👍', { ms: 2200 }); }
    else { B.initiativeFeedback?.('yes'); askMind(c); }
    return; }
  if (b.dataset.rps || b.dataset.quiz || b.dataset.wyr || (b.dataset.pet && b.dataset.pet !== 'later')) return;   // game buttons: pet.js handles them
  if (b.dataset.join) B.open(b.dataset.join);
  if (b.dataset.yes) B.answer(b.dataset.yes, true);
  if (b.dataset.no) B.answer(b.dataset.no, false);
  if (b.dataset.snooze) { B.snooze(b.dataset.snooze, 10); chipFlash('😴 snoozed 10 min'); }
  S.ring = 0; forceHide();
  if (b.dataset.yes) { S.mood = 'happy'; act('nod'); }
});

// ---------- typing box ----------
function openAsk(){ if (S.asleep) { B.wakeMe?.(); undim(); S.asleep = false; S.slipT = 0; } askBox.style.display = 'block'; askIn.value = ''; askIn.focus(); B.hover(true); }
function closeAsk(){ askBox.style.display = 'none'; askIn.blur(); }
askIn.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAsk();
  if (e.key === 'Enter' && askIn.value.trim()) { const t = askIn.value.trim(); closeAsk(); askMind(t); }
});

// ---------- listening ----------
// 1) push to talk: Ctrl+Alt+Space / Ctrl+Alt+M, or click the orange mic
// 2) follow-up: after it answers a spoken question it listens a few seconds for your reply (just keep talking)
// 3) hands-free (menu / Ctrl+Alt+H): it hears "Hey <name>" or "Hey Buddy" and answers, no keys needed
let rec = null, stream = null, chunks = [], vad = null, stopTimer = null, discard = false, lastSpokeEnd = 0, followupNow = false, followups = 0;
const FOLLOWUP_WAIT = 6000;
async function micStream(){
  if (stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  return stream;
}
function releaseMic(){ if (!HF.on && stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
// while music plays: quiet it while you talk to the buddy and while it answers, then bring it back
let ducked = false, unduckT = null;
let muted = false;
function duck(){ if (!window.PET?.musicPlaying?.()) return; clearTimeout(unduckT); if (!ducked || muted) { ducked = true; muted = false; B.music?.({ op: 'duck' }); } }
// while you speak: music fully silent, so the microphone only hears you
function muteForMic(){ if (!window.PET?.musicPlaying?.()) return false; clearTimeout(unduckT); ducked = true; muted = true; B.music?.({ op: 'mute' }); return true; }
function unduckSoon(ms = 1200){ if (!ducked) return; clearTimeout(unduckT);
  unduckT = setTimeout(() => { if (S.listening || S.talking || S.thinking || pending > 0) return unduckSoon(800); ducked = false; B.music?.({ op: 'unduck' }); }, ms); }
async function startListening({ followup = false } = {}){
  if (S.listening || S.thinking) { duck(); if (!S.listening) unduckSoon(); return; }
  const hadMusic = muteForMic();
  stopSpeaking(); if (!followup) forceHide();
  let st; try { st = await micStream(); }
  catch (e) { unduckSoon(300); say({ text: 'Hmm, I can\'t reach the microphone. Check Windows Settings → Privacy → Microphone.', mood: 'worried', silent: true }); return; }
  S.listening = true; S.mood = 'curious'; chunks = []; discard = false; followupNow = followup;
  show(followup ? '<span class="tag q">🎧 still listening</span><br>Your turn! <span class="dots"><span>.</span><span>.</span><span>.</span></span>'
                : '<span class="tag q">🎧 listening</span><br>Go ahead, I\'m all ears! <span class="dots"><span>.</span><span>.</span><span>.</span></span>', { stick: true });
  rec = new MediaRecorder(st, { mimeType: 'audio/webm' });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    S.listening = false; S.level = 0; clearInterval(vad); clearTimeout(stopTimer); releaseMic(); if (muted) duck(); unduckSoon(2500);
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (discard || blob.size < 2500) { sticky = false; hide(); return; }
    show('<span class="tag q">🎧 got it</span><br><span class="dots"><span>.</span><span>.</span><span>.</span></span>', { stick: true });
    const r = await B.stt(new Uint8Array(await blob.arrayBuffer()));
    if (r?.error) { sticky = false; convo = false; return say({ text: r.error, mood: 'confused', silent: true }); }
    if (!r?.text || r.text.replace(/[^\p{L}\p{N}]/gu, '').length < 2) { sticky = false; const wasFollow = followupNow; convo = false; if (wasFollow) { hide(); return; } return say({ text: 'Hmm, I didn\'t catch that. Click my mic to try again!', mood: 'confused', silent: true }); }
    if (/^(bye|stop|that'?s all|thanks?,? (that'?s|bye)|sudah|udah|makasih)\W*$/i.test(r.text.trim())) { sticky = false; convo = false; return say({ text: 'Okie dokie! I\'ll be right here.', mood: 'happy', action: 'wave' }); }
    askMind(r.text, { spoken: true });
  };
  if (hadMusic) await new Promise(r => setTimeout(r, 180));            // let the music fade out first
  rec.start(250);
  const ctx = new AudioContext(), src = ctx.createMediaStreamSource(st), a = ctx.createAnalyser(); a.fftSize = 512; src.connect(a);
  const buf = new Uint8Array(512), t0 = now(); let spoke = false, quietSince = now(), floor = 0, floorN = 0;
  // the room's own background level (other apps, fans, a TV): "quiet" means quieter than you, not total silence
  vad = setInterval(() => { a.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) ** 2; const lv = Math.min(1, Math.sqrt(s / 512) / 20); S.level = lv;
    if (now() - t0 < 350) { floor = (floor * floorN + lv) / ++floorN; return; }
    const talkLv = Math.max(followup ? .28 : .18, Math.min(.4, floor * 1.8 + .06));
    if (lv > talkLv) { spoke = true; quietSince = now(); }
    else if (spoke && now() - quietSince > (followup ? 1800 : 2200)) stopListening();   // you can pause to think
    else if (!spoke && followup && now() - t0 > FOLLOWUP_WAIT) { discard = true; convo = false; stopListening(); }
    if (!S.listening) { clearInterval(vad); ctx.close(); } }, 60);
  stopTimer = setTimeout(stopListening, 25000);
}
function stopListening(){ if (rec && rec.state !== 'inactive') rec.stop(); }
function cancelListening(){ discard = true; convo = false; stopListening(); }
let lastVoiceUse = -1e9, lastTouchUI = now();
function micPressed(){ lastVoiceUse = now(); lastTouchUI = now();
  if (S.listening) (followupNow ? cancelListening() : stopListening()); else { followups = 0; startListening(); } }

// follow-up: after a spoken question gets a spoken answer, listen again for a few seconds
let convo = false;
function afterSpeaking(){
  unduckSoon(1500);
  lastSpokeEnd = now();
  S.busyUntil = Math.max(now() + 1800, Math.min(S.busyUntil || 0, now() + 2500));
  if (convo && !S.asleep && followups < 3) { followups++; setTimeout(() => { if (!S.talking && !S.listening && !S.thinking && convo) startListening({ followup: true }); }, 450); }
  else convo = false;
}

// hands-free: always-on mic with a wake phrase. Only short clips that start after you speak are sent to be transcribed.
const HF = { on: false, timer: null, recording: false, paused: false, noise: 0, quietFor: 0, sent: [], keepUntil: 0, secs: [], secT: 0, secLoud: false, asked: {}, backAt: 0, afterCall: false, byMusic: false, offAt: 0 };
// Credit guard: when it's been loud for about a minute (music, TV, people talking), or too many clips went out,
// hands-free pauses itself and asks whether to switch it off.
// why: noise | many | meeting | media
function hfPause(why, extra = ''){
  if (HF.paused) return; HF.paused = true; HF.quietFor = 0; HF.asked[why] = now();
  chip.textContent = '👂 hands-free paused'; chip.classList.add('show');
  S.mood = 'curious'; act('think');
  const msg = { noise: 'It\'s been noisy for a minute, so I paused hands-free to save credits.', many: 'Lots of sounds lately, so I paused hands-free to save credits.',
    meeting: 'Meeting time! Want hands-free off so I don\'t listen in?', media: `Looks like ${esc(extra || 'something')} is playing. Hands-free off while it plays?` }[why];
  const btns = why === 'meeting'
    ? '<button data-hf="meeting">🔇 Off till the meeting ends</button><button data-hf="off">Turn off</button><button class="alt" data-hf="keep">Keep listening</button>'
    : '<button data-hf="off">Turn off</button><button data-hf="hour">Off for 1 hour</button><button class="alt" data-hf="keep">Keep listening</button>';
  show(`<span class="tag q">👂 hands-free</span><br>${msg}<div class="btns">${btns}</div>`, { stick: true, force: true });
  if (why !== 'meeting') window.PET?.sfx?.('boop');
}
function hfOff(){ HF.backAt = 0; HF.afterCall = false; HF.byMusic = false; HF.offAt = now(); setHandsFree(false, { quiet: true }); B.setHandsFree?.(false); hfResume(); }
function hfOn(note){ HF.backAt = 0; HF.afterCall = false; setHandsFree(true, { quiet: true }); B.setHandsFree?.(true); if (note) chipFlash(note); }
// the buddy's own music: hands-free steps aside while it plays, and comes back after
function hfMusic(playing){
  if (playing && HF.on) { HF.byMusic = true; HF.on && (setHandsFree(false, { quiet: true }), B.setHandsFree?.(false)); hfResume(); chipFlash('🎵 hands-free off during music · Ctrl+Alt+Space to talk'); }
  else if (!playing && HF.byMusic) setTimeout(() => { if (HF.byMusic && !window.PET?.musicPlaying?.()) { HF.byMusic = false; if (!HF.on) hfOn('👂 music stopped, hands-free back on'); } }, 5000);
}
// a call app or a meeting that's starting
function hfMeeting(){ if (HF.on && !HF.paused && now() - (HF.asked.meeting || 0) > 20 * 60000) hfPause('meeting'); }
// Spotify, YouTube, Netflix… in front
function hfMedia(app){ if (HF.on && !HF.paused && now() - (HF.asked.media || 0) > 30 * 60000) hfPause('media', app); }
setInterval(() => {                                                          // timed / after-meeting comeback
  if (HF.on || HF.byMusic) return;
  if (HF.backAt && now() > HF.backAt) return hfOn('👂 hands-free back on');
  if (HF.afterCall && !HF.backAt && !window.PET?.muted?.() && now() - (HF.offAt || 0) > 3 * 60000) hfOn('👂 meeting over, hands-free back on');
}, 20000);
function hfResume(note){ HF.paused = false; HF.noise = 0; HF.sent = []; HF.secs = []; chip.classList.remove('show'); if (note) chipFlash(note); }
const wakeRe = () => { const n = (INFO.name || 'buddy').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '');
  return new RegExp(`^\\s*(?:(?:hey|hi|hai|halo|hello|ok|okay|yo)[\\s,]+)?(?:${n.replace(/\s+/g, '\\s*')}|buddy)\\b[\\s,.!?]*`, 'i'); };
async function setHandsFree(on, { quiet = false } = {}){
  if (!on) { HF.paused = false; chip.classList.remove('show'); }
  if (!quiet) { HF.backAt = 0; HF.afterCall = false; HF.byMusic = false; }          // you switched it yourself
  if (on && !quiet && window.PET?.musicPlaying?.()) {                              // music on: wait for it to stop
    HF.byMusic = true; B.setHandsFree?.(false); chipFlash('🎵 hands-free will start when the music stops'); return; }
  if (on === HF.on) return;
  HF.on = on; clearInterval(HF.timer);
  if (!on) { releaseMic(); if (!quiet) chipFlash('👂 hands-free off'); return; }
  try { await micStream(); } catch { HF.on = false; return say({ text: 'I can\'t reach the microphone for hands-free mode.', mood: 'worried', silent: true }); }
  if (quiet) chipFlash('👂 hands-free on');
  else { chipFlash('👂 hands-free on'); say({ text: `Hands-free on! Just say "Hey ${INFO.name || 'Buddy'}" and I'm all yours.`, mood: 'excited', action: 'jump' }); }
  const ctx = new AudioContext(), a = ctx.createAnalyser(); a.fftSize = 512; ctx.createMediaStreamSource(stream).connect(a);
  const buf = new Uint8Array(512); let loud = 0, clip = null, clipChunks = [], quietSince = 0, startT = 0;
  HF.timer = setInterval(() => {
    if (!HF.on || !stream) { clearInterval(HF.timer); ctx.close(); return; }
    const busy = HF.paused || !!window.PET?.musicPlaying?.() || !!window.PET?.muted?.() || S.listening || S.thinking || S.talking || now() - lastSpokeEnd < 800 || askBox.style.display === 'block';
    a.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) ** 2; const lv = Math.min(1, Math.sqrt(s / 512) / 20);
    // how much of the last minute was loud (rolling average over ~60 s)
    // how many of the last 60 seconds had sound in them (music, TV and conversation all count)
    HF.secLoud ||= lv > .15;
    if (now() - HF.secT > 1000) { HF.secT = now(); HF.secs.push(HF.secLoud); HF.secLoud = false; if (HF.secs.length > 60) HF.secs.shift(); HF.noise = HF.secs.length >= 55 ? HF.secs.filter(Boolean).length / HF.secs.length : 0; }
    if (HF.paused) { HF.quietFor = lv > .12 ? 0 : HF.quietFor + .06; if (!sticky && HF.quietFor > 180) hfResume('👂 quiet again, hands-free back on'); }
    else if (HF.noise > .75 && now() > HF.keepUntil) { if (clip) { clip.discard = true; clip.stop(); } hfPause('noise'); }
    if (busy && !clip) { loud = 0; return; }
    if (!clip){
      loud = lv > .2 ? loud + 1 : 0;
      if (loud >= 2) { clipChunks = []; clip = new MediaRecorder(stream, { mimeType: 'audio/webm' }); clip.ondataavailable = e => e.data.size && clipChunks.push(e.data);
        clip.onstop = async () => { const c = clip; clip = null; const dur = now() - startT; const blob = new Blob(clipChunks, { type: 'audio/webm' });
          if (c.discard || dur < 700 || blob.size < 3000 || S.listening || S.thinking) return;   // long sounds (music, chatter) are never sent
          HF.sent = HF.sent.filter(x => now() - x < 600000); HF.sent.push(now()); if (HF.sent.length > 15 && now() > HF.keepUntil) hfPause('many');
          const r = await B.stt(new Uint8Array(await blob.arrayBuffer())); const text = (r?.text || '').trim(); if (!text) return;
          const m = text.match(wakeRe()); if (!m) return;                       // not for me: ignore quietly
          const rest = text.slice(m[0].length).trim();
          S.antV += .8; act('jump');
          if (rest.replace(/[^\p{L}\p{N}]/gu, '').length < 3) { say({ text: ['Yes? I\'m here!', 'Heyyy! What\'s up?', 'You called?'][Math.floor(Math.random() * 3)], mood: 'excited', answer: true }); followups = 0; convo = true; return; }
          followups = 0; askMind(rest, { spoken: true }); };
        clip.start(250); startT = now(); quietSince = now(); S.mood = 'curious'; }
    } else {
      if (lv > .15) quietSince = now();
      if (now() - startT > 15000) { clip.discard = true; clip.stop(); }           // longer than 15 s without a pause: music or chatter, not a question for me
      else if (now() - quietSince > 1600) clip.stop();
    }
  }, 60);
}

// ---------- mouse: hover, drag, poke, menu, drop ----------
const TOP = () => cv.getBoundingClientRect().top;      // canvas sits at the bottom of the window
const overHead = (x, y) => { y -= TOP(); return (x - HX) ** 2 + (y - HY) ** 2 < (R + 22) ** 2 || (x > HX + 20 && x < HX + 125 && y > 20 && y < 110); };
let hovering = false;
addEventListener('mousemove', e => {
  const over = overHead(e.clientX, e.clientY) || (bubble.classList.contains('show') && hit(bubble, e)) || askBox.style.display === 'block';
  if (over !== hovering) { hovering = over; B.hover(over); }
});
const hit = (el, e) => { const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
let drag = null;
addEventListener('mousedown', e => { if (e.button !== 0 || !overHead(e.clientX, e.clientY)) return; lastTouchUI = now(); drag = { x: e.screenX, y: e.screenY, moved: 0, hist: [], turns: 0, lastDir: null }; });
addEventListener('mousemove', e => { if (!drag) { window.PET?.hoverMove(e, overHead(e.clientX, e.clientY)); return; }
  const dx = e.screenX - drag.x, dy = e.screenY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 4) { B.drag(dx, dy); drag.x = e.screenX; drag.y = e.screenY;
    drag.hist.push({ t: now(), x: e.screenX, y: e.screenY }); if (drag.hist.length > 8) drag.hist.shift();
    const dir = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 2 * Math.sign(dy); if (drag.lastDir !== null && dir !== drag.lastDir && Math.abs(dx) + Math.abs(dy) > 6) drag.turns++; drag.lastDir = dir;
    S.antV += (dx + dy) * .004; } });
const overMic = (x, y) => { y -= TOP(); return (x - (HX - R * .36)) ** 2 + (y - (HY + R * .62)) ** 2 < 17 ** 2; };
addEventListener('mouseup', e => {
  if (drag && drag.moved <= 4) { if (overMic(e.clientX, e.clientY) && !S.asleep) micPressed(); else if (window.PET?.overHand(e.clientX, e.clientY - TOP())) PET.highFive(); else poke(); }
  else if (drag) { const h = drag.hist, a = h[0], b = h[h.length - 1]; const dt = b && a ? (b.t - a.t) / 16 : 0;
    const vx = dt > 0 ? (b.x - a.x) / dt : 0, vy = dt > 0 ? (b.y - a.y) / dt : 0;
    if (drag.turns >= 6) window.PET?.dizzy();
    else if (Math.hypot(vx, vy) > 14 && b && now() - b.t < 90) { B.fling?.(vx, vy); window.PET?.flung(); } }
  drag = null; });
addEventListener('dblclick', e => { if (overHead(e.clientX, e.clientY)) openAsk(); });
addEventListener('contextmenu', e => { e.preventDefault(); if (overHead(e.clientX, e.clientY) || hit(bubble, e)) B.menu(window.PET?.menuState()); });
addEventListener('wheel', e => { if (e.ctrlKey && overHead(e.clientX, e.clientY)) { e.preventDefault(); B.scaleBy?.(-e.deltaY); } }, { passive: false });
function poke(){
  if (S.asleep) { undim(); B.wakeMe?.(); S.asleep = false; S.mood = 'confused'; S.slipT = 0; act('jump'); show('Huh?! I was having the best dream about… keyboards. 😴', { ms: 3500 }); return; }
  S.poke = 1; S.antV += .7; window.PET?.poked();
  const r = [['Hehe, that tickles!', 'happy', 'wink'], ['Boop! 👉', 'excited', 'jump'], ['Need something? Double-click me to type!', 'curious', 'wave'],
    ['I\'m watching your back. And your typos. 👀', 'proud', 'nod'], ['Wheee!', 'excited', 'spin'], ['*adjusts headset* Ready!', 'focused', 'nod']][Math.floor(Math.random() * 6)];
  S.mood = r[1]; act(r[2]); show(esc(r[0]), { ms: 2600 });
}
addEventListener('dragover', e => { e.preventDefault(); B.hover(true); S.mood = 'excited'; });
addEventListener('drop', async e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; act('jump'); burst(['📄'], 3);
  const r = await B.dropFile(f); if (r) say(r); });

// ---------- dim while napping: after DIM_AFTER_MINUTES of sleep it fades to DIM_OPACITY ----------
let dimT = null;
document.body.style.transition = 'opacity 2.5s ease';
const dimTo = () => String(INFO.dreams !== false ? Math.max(.6, INFO.dimOpacity ?? .35) : (INFO.dimOpacity ?? .35));   // dreams stay visible
function dimLater(){ clearTimeout(dimT); dimT = setTimeout(() => { if (S.asleep) document.body.style.opacity = dimTo(); }, (INFO.dimAfterMin ?? 2) * 60000); }
function undim(){ clearTimeout(dimT); document.body.style.opacity = '1'; }
addEventListener('mouseenter', () => { if (S.asleep) document.body.style.opacity = '.8'; });   // peek when you hover
addEventListener('mouseleave', () => { if (S.asleep && document.body.style.opacity === '.8') document.body.style.opacity = dimTo(); });

// tell the app when you're busy with the buddy, so it doesn't pop in at a bad moment
setInterval(() => {
  const lt = Math.max(lastTouchUI, window.PET?.lastTouch?.() || 0);
  B.status?.({ busy: pending > 0 || S.listening || S.talking || sticky || askBox.style.display === 'block' || !!document.querySelector('#bubble .btns'),
    focus: !!window.PET?._state?.focus, inCall: !!window.PET?.muted?.(), touched: Date.now() - (now() - lt) });
}, 3000);

// ---------- start ----------
B.info().then(i => { INFO = i;
  const first = !i.hadEnv ? 'Hi! I need a .env file before my brain works. Copy .env.example to .env and fill it in!'
    : i.provider === 'mock' ? `Hi, I'm ${i.name}! I'm on my practice brain for now. Right-click me for the menu.`
    : `Heyyy, it's me, ${i.name}! Click my orange mic or press Ctrl+Alt+M to chat. Let's crush today!`;
  setTimeout(() => { act('wave'); say({ text: first, mood: 'happy', silent: !i.hadEnv }); }, 700);
});
requestAnimationFrame(draw);

// Lets you open renderer/index.html in a normal browser to preview the character.
function mockBridge(){
  const noop = () => {}, h = {};
  const on = new Proxy({}, { get: (_, k) => fn => (h[k] ||= []).push(fn) });
  window.__buddy = new Proxy({}, { get: (_, k) => d => (h[k] || []).forEach(f => f(d)) });
  return { info: async () => ({ name: 'Buddy', provider: 'mock', hadEnv: true, quiet: true }), ask: async t => ({ text: 'Preview mode: ' + t, mood: 'happy', action: 'wave', done: [] }),
    tts: async () => null, stt: async () => ({ error: 'preview' }), dropFile: async () => null, hover: noop, drag: noop, menu: noop, open: noop, answer: noop, snooze: noop,
    storeGet: async () => null, storeSet: noop, petNote: noop, fling: noop, walk: noop, scaleBy: noop, on };
}
