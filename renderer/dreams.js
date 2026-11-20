/* Minds Buddy — dreams as a 3D hologram.
   While it dozes or sleeps, a beam rises from its head to a floating projector disc, and slowly rotating
   3D scenes are drawn in light above it: you (short bob, sporty) and your white Maltese, walking in a park,
   in a rainy café, climbing a mountain, flying around the world, and riding a balloon over the clouds.
   A tiny 3D engine: points and lines are rotated, put in perspective, and drawn as additive light. */
(() => {
'use strict';
const cv = document.getElementById('dream'), c = cv.getContext('2d');
const FW = 280, FH = 360;
function fit(){ const d = Math.max(1, devicePixelRatio || 1); cv.width = Math.round(FW * d); cv.height = Math.round(FH * d); c.setTransform(d, 0, 0, d, 0, 0); }
fit(); addEventListener('resize', fit);
const T = () => performance.now() / 1000;
const info = () => (typeof INFO !== 'undefined' ? INFO : {});
const dogName = () => (info().dogName || '').trim();

// ---------- tiny 3D ----------
const CX = 140, CY = 112, D = 330, F = 318;             // hologram centre on screen, camera distance, focal length
let yaw = 0, pitch = .38;
function P(x, y, z){
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y;
  const Y2 = Y * cp - Z * sp; Z = Y * sp + Z * cp;
  const k = F / (Z + D); return { x: CX + X * k, y: CY - Y2 * k, k, z: Z };
}
const depthA = p => Math.max(.25, Math.min(1, 1.25 - (p.z + 90) / 260));
let FLICK = 1;
function line(a, b, col = '#7ae3ff', al = 1, w = 1){
  const p = P(...a), q = P(...b), A = al * FLICK * Math.min(depthA(p), depthA(q));
  c.strokeStyle = col; c.globalAlpha = A * .22; c.lineWidth = w * 3.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
  c.globalAlpha = A; c.lineWidth = w; c.stroke();
}
function poly(pts, col, al, w, close){ for (let i = 0; i < pts.length - (close ? 0 : 1); i++) line(pts[i], pts[(i + 1) % pts.length], col, al, w); }
const sprites = {};
function sprite(col){ if (sprites[col]) return sprites[col]; const s = document.createElement('canvas'); s.width = s.height = 32; const x = s.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.25, col); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (sprites[col] = s); }
function dot(p3, r = 1.6, col = '#7ae3ff', al = 1){ const p = P(...p3), rr = r * p.k * 2.4; c.globalAlpha = al * FLICK * depthA(p); c.drawImage(sprite(col), p.x - rr, p.y - rr, rr * 2, rr * 2); }
function ring(cx, cy, cz, r, col, al = .8, n = 40, w = 1, axis = 'y'){
  const pts = []; for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; pts.push(axis === 'y' ? [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r] : axis === 'z' ? [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz] : [cx, cy + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  poly(pts, col, al, w, true);
}
const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];

// ---------- hologram people: you and your Maltese ----------
const HER = '#7ae3ff', HAIR = '#c4a6ff', DOG = '#eaf7ff', BOW = '#ff7ad9';
function her(px, py, pz, face, t, { walk = 0, sit = false, wave = false, s = 1 } = {}){
  const L = (x, y, z) => { const [rx, rz] = rot(x * s, z * s, face); return [px + rx, py + y * s, pz + rz]; };
  const sw = Math.sin(t * 6) * walk;
  if (sit) { line(L(-3, 18, 0), L(-3, 18, 10), HER, .9); line(L(-3, 18, 10), L(-3, 4, 10), HER, .9); line(L(3, 18, 0), L(3, 18, 10), HER, .9); line(L(3, 18, 10), L(3, 4, 10), HER, .9); }
  else { line(L(-3, 18, 0), L(-3, 9, sw * 5), HER, .9); line(L(-3, 9, sw * 5), L(-3, 0, sw * 8), HER, .9); line(L(3, 18, 0), L(3, 9, -sw * 5), HER, .9); line(L(3, 9, -sw * 5), L(3, 0, -sw * 8), HER, .9);
    dot(L(-3, 0, sw * 8), 1.4, '#ffffff', .8); dot(L(3, 0, -sw * 8), 1.4, '#ffffff', .8); }
  poly([L(-4.5, 18, 0), L(-6, 38, 0), L(6, 38, 0), L(4.5, 18, 0)], HER, .95, 1.1, true);           // sporty top
  line(L(-5.4, 30, 0), L(5.4, 30, 0), '#5fd4ff', .9, 1.4);                                            // the stripe
  line(L(-6, 37, 0), L(-9, 27, -sw * 6), HER, .9); line(L(-9, 27, -sw * 6), L(-9, 19, -sw * 7), HER, .9);
  if (wave) { line(L(6, 37, 0), L(11, 44, 0), HER, .9); line(L(11, 44, 0), L(11 + Math.sin(t * 8) * 3, 52, 0), HER, .9); }
  else { line(L(6, 37, 0), L(9, 27, sw * 6), HER, .9); line(L(9, 27, sw * 6), L(9, 19, sw * 7), HER, .9); }
  const hc = [0, 47, 0];                                                                                 // head
  const head = []; for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; head.push(L(Math.cos(a) * 6, 47 + Math.sin(a) * 6.5, 0)); } poly(head, HER, .8, 1, true);
  for (let m = 0; m < 7; m++){ const a = (m / 7) * Math.PI * 2, arc = [];                               // the short bob: a soft helmet of hair arcs
    for (let j = 0; j <= 6; j++){ const v = j / 6 * Math.PI * .62; arc.push(L(Math.cos(a) * Math.sin(v) * 7.4, 47 + 1.5 + Math.cos(v) * 7.2 - (j === 6 ? 2.5 : 0), Math.sin(a) * Math.sin(v) * 7.4)); }
    poly(arc, HAIR, .75, 1); }
  ring(...L(0, 43.5, 0), 7.4 * s, HAIR, .7, 18, 1.1);                                                    // the bob's straight bottom edge
  line(L(-4, 52, 6), L(4, 52, 6), HAIR, .8, 1.2);                                                       // bangs
  dot(L(-2, 47, 6), 1, '#ffffff', .9); dot(L(2.4, 47, 6), 1, '#ffffff', .9);
  return { hand: wave ? L(11, 52, 0) : L(9, 19, sw * 7) };
}
const DOGPTS = Array.from({ length: 70 }, () => { const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1); return [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u), Math.random()]; });
function maltese(px, py, pz, face, t, { walk = 0, sit = false, s = 1 } = {}){
  const L = (x, y, z) => { const [rx, rz] = rot(x * s, z * s, face); return [px + rx, py + y * s, pz + rz]; };
  const b = Math.abs(Math.sin(t * 8)) * walk * 1.2;
  DOGPTS.forEach(([x, y, z, r]) => dot(L(x * 9 + Math.sin(t * 3 + r * 9) * .4, 7 + b + y * (sit ? 6 : 4.5), z * 5), .9 + r * .6, DOG, .75));   // fluffy body
  DOGPTS.slice(0, 34).forEach(([x, y, z, r]) => dot(L(11 + x * 4, 13 + b + (sit ? 3 : 0) + y * 4, z * 4), .8 + r * .5, DOG, .85));           // head
  dot(L(15, 13 + b + (sit ? 3 : 0), 0), 1.2, '#ffffff', 1); dot(L(13.5, 15 + b + (sit ? 3 : 0), 2.5), .9, '#ffffff', 1);
  dot(L(10, 18.5 + b + (sit ? 3 : 0), 0), 2, BOW, 1);                                                   // her pink bow
  if (!sit) for (let i = 0; i < 4; i++){ const lx = -6 + (i % 2) * 12, lz = i < 2 ? -2.5 : 2.5, ph = Math.sin(t * 8 + i * 1.7) * walk * 3; line(L(lx, 4 + b, lz), L(lx + ph, 0, lz), DOG, .7); }
  const tail = []; for (let j = 0; j < 6; j++){ const a = j / 5; tail.push(L(-9 - a * 4, 9 + b + a * 7, Math.sin(t * 12 + a * 2) * 3 * a)); } poly(tail, DOG, .8, 1.2);
}

// ---------- the dreams ----------
const SCENES = {
  walk: { title: () => `walking ${dogName() || 'my favourite pup'} in the park`, draw(t){
    const R = 66, y0 = -40;
    for (let i = 0; i < 60; i++){ const a = i / 60 * Math.PI * 2; dot([Math.cos(a) * R, y0, Math.sin(a) * R], .9, '#9dffcf', .5); }   // dotted path
    ring(0, y0, 0, R + 10, '#58f0c8', .25, 48); ring(0, y0, 0, R - 10, '#58f0c8', .25, 48);
    for (let i = 0; i < 7; i++){ const a = i / 7 * Math.PI * 2 + .3, x = Math.cos(a) * 92, z = Math.sin(a) * 92;      // trees: trunk + glowing crown
      line([x, y0, z], [x, y0 + 16, z], '#9dffcf', .7, 1.2); ring(x, y0 + 26, z, 9, '#58f0c8', .7, 16, 1, 'z'); ring(x, y0 + 26, z, 9, '#58f0c8', .5, 16, 1, 'x'); dot([x, y0 + 26, z], 5, '#58f0c8', .35); }
    const sun = [0, 62, -40]; dot(sun, 9, '#ffe08a', .9); for (let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2 + t; line([sun[0] + Math.cos(a) * 12, sun[1] + Math.sin(a) * 12, sun[2]], [sun[0] + Math.cos(a) * 19, sun[1] + Math.sin(a) * 19, sun[2]], '#ffe08a', .6); }
    const a = t * .45, hx = Math.cos(a) * R, hz = Math.sin(a) * R, face = -a - Math.PI / 2 + Math.PI;        // walking around the loop
    const h = her(hx, y0, hz, a + Math.PI, t, { walk: 1 });
    const da = a + .32, dx = Math.cos(da) * R, dz = Math.sin(da) * R; maltese(dx, y0, dz, da + Math.PI, t, { walk: 1 });
    line(h.hand, [dx + Math.cos(da + Math.PI / 2) * 0, y0 + 12, dz], BOW, .8, .9);                         // leash
    for (let i = 0; i < 2; i++){ const bx = Math.cos(t * .8 + i * 3) * 50, bz = Math.sin(t * .8 + i * 3) * 50, by = y0 + 30 + Math.sin(t * 3 + i) * 8, fl = Math.sin(t * 14) * 4;   // butterflies
      line([bx, by, bz], [bx - 4, by + fl, bz - 2], i ? BOW : '#ffe08a', .9); line([bx, by, bz], [bx + 4, by + fl, bz - 2], i ? BOW : '#ffe08a', .9); }
  } },
  cafe: { title: () => 'a rainy café afternoon', draw(t){
    const y0 = -40;
    ring(0, y0, 0, 70, '#c4a6ff', .25, 40);
    poly([[-60, y0, -50], [-60, y0 + 70, -50], [0, y0 + 70, -50], [0, y0, -50]], '#7ae3ff', .7, 1, true);       // window
    line([-30, y0, -50], [-30, y0 + 70, -50], '#7ae3ff', .5); line([-60, y0 + 35, -50], [0, y0 + 35, -50], '#7ae3ff', .5);
    for (let i = 0; i < 14; i++){ const rx = -58 + (i * 37 % 56), ry = y0 + 68 - ((t * 70 + i * 23) % 66); line([rx, ry, -50], [rx - 1, ry - 5, -50], '#9fd8ff', .6, .8); }   // rain on the glass
    for (let i = 0; i < 4; i++) line([-55 + i * 14, y0, -52], [-55 + i * 14, y0 + 14 + (i * 9 % 20), -52], '#5fd4ff', .35);       // city skyline
    ring(10, y0 + 22, 6, 20, '#ffd6a8', .9, 30, 1.2); line([10, y0 + 22, 6], [10, y0, 6], '#ffd6a8', .7, 1.2); ring(10, y0, 6, 8, '#ffd6a8', .5, 16);   // round table
    const cup = [[0, 0], [3.2, 0], [3.8, 4], [4.2, 8]]; for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; poly(cup.map(([r, y]) => [18 + Math.cos(a) * r, y0 + 22 + y, 10 + Math.sin(a) * r]), '#ffffff', .7, .9); }
    ring(18, y0 + 30, 10, 4.2, '#ffffff', .9, 14);
    for (let i = 0; i < 10; i++){ const k = ((t * .5 + i / 10) % 1); dot([18 + Math.sin(t * 2 + i) * 2.5 * k, y0 + 32 + k * 26, 10], 1.2, '#ffffff', (1 - k) * .7); }   // steam
    line([10, y0 + 82, 6], [10, y0 + 62, 6], '#ffe08a', .6); ring(10, y0 + 60, 6, 8, '#ffe08a', .8, 18); dot([10, y0 + 56, 6], 6, '#ffe08a', .5);      // hanging lamp
    poly([[-22, y0 + 14, 2], [-22, y0, 2], [-10, y0, 2]], '#c4a6ff', .5, 1); poly([[-30, y0 + 14, 2], [-30, y0, 2]], '#c4a6ff', .5, 1);              // chair
    her(-14, y0 - 4, 4, -Math.PI / 2 + .3, t, { sit: true });
    maltese(30, y0, 22, Math.PI * .85, t, { sit: true });
  } },
  hike: { title: () => 'summit day', draw(t){
    const y0 = -40, H = (x, z) => y0 + 74 * Math.exp(-(x * x + z * z) / (2 * 34 * 34)) + 5 * Math.sin(x * .08) * Math.cos(z * .07);
    const N = 12, S = 92;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++){ const x = -S + i * 2 * S / N, z = -S + j * 2 * S / N; if (x * x + z * z > S * S) continue;
      const h = H(x, z), col = h > y0 + 50 ? '#ffffff' : h > y0 + 20 ? '#c4a6ff' : '#7ae3ff';
      if (i < N) { const x2 = x + 2 * S / N; if (x2 * x2 + z * z <= S * S) line([x, h, z], [x2, H(x2, z), z], col, .45, .8); }
      if (j < N) { const z2 = z + 2 * S / N; if (x * x + z2 * z2 <= S * S) line([x, h, z], [x, H(x, z2), z2], col, .45, .8); } }
    const path = []; for (let k = 0; k <= 60; k++){ const p = k / 60, a = p * Math.PI * 3.2, r = 80 * (1 - p) + 2; path.push([Math.cos(a) * r, H(Math.cos(a) * r, Math.sin(a) * r) + 1, Math.sin(a) * r]); }
    path.forEach((q, k) => k % 2 || dot(q, 1, '#ffe08a', .7));
    const peak = [0, H(0, 0), 0]; line(peak, [peak[0], peak[1] + 16, peak[2]], '#ffffff', .9); poly([[0, peak[1] + 16, 0], [8 + Math.sin(t * 6), peak[1] + 13, 0], [0, peak[1] + 10, 0]], '#ff7ad9', .9, 1.2, true);   // flag
    const p = (t * .045) % .9, k = Math.floor(p * 60), q = path[k], q2 = path[Math.min(60, k + 1)], face = Math.atan2(q2[2] - q[2], q2[0] - q[0]);
    her(q[0], q[1], q[2], -face + Math.PI / 2, t, { walk: 1, s: .8 });
    const d = path[Math.max(0, k - 3)]; maltese(d[0], d[1], d[2], -face + Math.PI / 2, t, { walk: 1, s: .75 });
    for (let i = 0; i < 3; i++){ const a = t * .6 + i * 2.1, bx = Math.cos(a) * 70, bz = Math.sin(a) * 70, by = 40 + i * 6, f = Math.sin(t * 10 + i) * 3;   // birds
      line([bx - 5, by + f, bz], [bx, by, bz], '#ffffff', .7); line([bx, by, bz], [bx + 5, by + f, bz], '#ffffff', .7); }
  } },
  travel: { title: () => 'around the world', draw(t){
    const R = 46, cy = 0;
    for (let i = 1; i < 7; i++){ const la = -Math.PI / 2 + i * Math.PI / 7; ring(0, cy + Math.sin(la) * R, 0, Math.cos(la) * R, '#7ae3ff', .45, 36); }      // latitude lines
    for (let i = 0; i < 10; i++){ const lo = i / 10 * Math.PI, pts = []; for (let j = 0; j <= 24; j++){ const la = -Math.PI / 2 + j / 24 * Math.PI; pts.push([Math.cos(la) * Math.cos(lo) * R, cy + Math.sin(la) * R, Math.cos(la) * Math.sin(lo) * R]); } poly(pts, '#7ae3ff', .35, .9); }
    [[.5, 1.2], [-.2, 2.6], [.9, 4.4], [-.6, 5.3]].forEach(([la, lo], i) => { const p = [Math.cos(la) * Math.cos(lo) * R, cy + Math.sin(la) * R, Math.cos(la) * Math.sin(lo) * R];   // destinations pulsing
      dot(p, 2.4 + Math.sin(t * 4 + i) * .8, i % 2 ? BOW : '#ffe08a', 1); line(p, [p[0] * 1.18, p[1] * 1.18, p[2] * 1.18], i % 2 ? BOW : '#ffe08a', .8); });
    const orbit = a => { const r = R + 20, x = Math.cos(a) * r, z = Math.sin(a) * r; return [x, cy + Math.sin(a * 2) * 12 + z * .25, z * .97]; };
    for (let k = 0; k < 26; k++) dot(orbit(t * .9 - k * .045), 1.2, '#ffffff', (1 - k / 26) * .8);       // plane's light trail
    const pa = orbit(t * .9), pb = orbit(t * .9 + .05), dir = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const n = Math.hypot(...dir), u = dir.map(v => v / n * 7), side = [-u[2] * .7, 0, u[0] * .7];
    poly([[pa[0] + u[0], pa[1] + u[1], pa[2] + u[2]], [pa[0] + side[0], pa[1], pa[2] + side[2]], [pa[0] - u[0] * .6, pa[1], pa[2] - u[2] * .6], [pa[0] - side[0], pa[1], pa[2] - side[2]]], '#ffffff', 1, 1.2, true);
    her(-5, cy + R - 1, 0, t * .2, t, { wave: true, s: .7 }); maltese(8, cy + R - 1, 2, t * .2 + .4, t, { s: .6 });
    ring(0, -40, 0, 60, '#c4a6ff', .25, 40);
  } },
  balloon: { title: () => 'above the clouds', draw(t){
    const y0 = -40, by = -6 + Math.sin(t * .9) * 6;
    for (let i = 0; i < 5; i++){ const cx = Math.cos(t * .25 + i * 1.3) * 70, cz = Math.sin(t * .25 + i * 1.3) * 70;     // clouds of light below
      for (let j = 0; j < 12; j++) dot([cx + Math.cos(j * 2.4) * 12 * (j % 3 + 1) / 3, y0 + 4 + Math.sin(j * 1.7) * 3, cz + Math.sin(j * 2.4) * 9], 2.4, '#e6f4ff', .35); }
    poly([[-90, y0 - 4, 30], [-55, y0 + 30, 10], [-20, y0 - 4, -20]], '#c4a6ff', .4, 1); poly([[20, y0 - 4, 40], [60, y0 + 40, 20], [95, y0 - 4, 0]], '#c4a6ff', .4, 1);   // peaks poking through
    const prof = [[0, 74], [10, 72], [20, 66], [26, 56], [27, 46], [24, 36], [17, 26], [8, 18]];        // the balloon, as a lathe of light
    const cols = ['#ff7ad9', '#ffe08a', '#7ae3ff', '#9dffcf'];
    for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2 + t * .2; poly(prof.map(([r, y]) => [Math.cos(a) * r, by + y, Math.sin(a) * r]), cols[i % 4], .8, 1.1); }
    [46, 60].forEach(y => { const r = prof.reduce((m, [rr, yy]) => Math.abs(yy - y) < Math.abs(m[1] - y) ? [rr, yy] : m)[0]; ring(0, by + y, 0, r, '#ffffff', .4, 30); });
    dot([0, by + 22, 0], 6, '#ffb86b', .5 + Math.random() * .3);                                         // burner glow
    const bk = [[-7, by, -7], [7, by, -7], [7, by, 7], [-7, by, 7]]; poly(bk, '#ffd6a8', .9, 1.2, true); poly(bk.map(([x, y, z]) => [x, y - 8, z]), '#ffd6a8', .9, 1.2, true);
    bk.forEach(([x, y, z]) => { line([x, y, z], [x, y - 8, z], '#ffd6a8', .7); line([x, y, z], [x * 1.4, by + 18, z * 1.4], '#ffd6a8', .5, .8); });
    her(-2, by - 6, 0, t * .2, t, { wave: true, s: .5 }); maltese(4, by - 2, 2, t * .2 + .6, t, { s: .4 });
    for (let i = 0; i < 2; i++){ const a = t * .7 + i * 3, bx = Math.cos(a) * 60, bz = Math.sin(a) * 60, b2 = by + 50 + i * 10, f = Math.sin(t * 10 + i) * 3;
      line([bx - 4, b2 + f, bz], [bx, b2, bz], '#ffffff', .6); line([bx, b2, bz], [bx + 4, b2 + f, bz], '#ffffff', .6); }
  } },
};
const ORDER = Object.keys(SCENES);

// ---------- projector: beam, disc, scanlines, glitches, caption ----------
let on = false, startAt = 0, order = [], idx = 0, sceneT = 0, fade = 0, glitchT = 0;
const SCENE_LEN = 14;
const motes = Array.from({ length: 26 }, () => ({ y: Math.random(), x: Math.random() - .5, v: .08 + Math.random() * .15 }));
function shuffle(){ order = [...ORDER].sort(() => Math.random() - .5); idx = 0; }
function start(){ if (on) return; on = true; startAt = T() + 10; shuffle(); sceneT = startAt; }
function stop(){ on = false; }
function projector(t, a){
  const base = { x: CX, y: 166 }, emit = { x: 140, y: 192 };
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, emit.y, 0, 30); g.addColorStop(0, `rgba(122,227,255,${.35 * a})`); g.addColorStop(.35, `rgba(122,227,255,${.12 * a})`); g.addColorStop(1, 'rgba(122,227,255,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(emit.x - 6, emit.y); c.lineTo(base.x - 100, 30); c.lineTo(base.x + 100, 30); c.lineTo(emit.x + 6, emit.y); c.closePath(); c.fill();
  motes.forEach(m => { m.y = (m.y + m.v * .016) % 1; const yy = emit.y - m.y * (emit.y - 40), ww = 6 + m.y * 94; c.globalAlpha = a * (1 - m.y) * .9; c.drawImage(sprite('#9fe6ff'), emit.x + m.x * ww * 2 - 2, yy - 2, 4, 4); });
  [[26, 5, .9], [44, 8, .55], [62, 11, .35]].forEach(([rx, ry, al], i) => { c.globalAlpha = a * al; c.strokeStyle = '#7ae3ff'; c.lineWidth = 1.2;     // floating projector disc rings
    c.beginPath(); c.ellipse(emit.x, emit.y - 8 - i * 3, rx, ry, 0, t * (i % 2 ? -1 : 1), t * (i % 2 ? -1 : 1) + Math.PI * 1.6); c.stroke(); });
  c.globalAlpha = a * .8; c.drawImage(sprite('#7ae3ff'), emit.x - 14, emit.y - 22, 28, 28);
  c.globalAlpha = a * .35; c.strokeStyle = '#c4a6ff'; c.beginPath(); c.ellipse(CX, 158, 104, 18, 0, 0, Math.PI * 2); c.stroke();                         // hologram stage edge
  c.restore();
}
function caption(t, a, name){
  const full = ('DREAM · ' + SCENES[name].title()).toUpperCase(), n = Math.min(full.length, Math.floor((t - sceneT) * 24));
  c.save(); c.globalAlpha = a; c.font = '600 9.5px "Segoe UI",system-ui'; c.textAlign = 'center'; c.fillStyle = '#bfefff'; c.shadowColor = '#5fd4ff'; c.shadowBlur = 8;
  c.fillText(full.slice(0, n) + (Math.floor(t * 3) % 2 ? '▍' : ' '), CX, 18);
  c.globalAlpha = a * .5; c.strokeStyle = '#7ae3ff'; c.lineWidth = .8; c.beginPath(); c.moveTo(CX - 90, 24); c.lineTo(CX + 90, 24); c.stroke(); c.restore();
}
const layer = document.createElement('canvas'), lc = layer.getContext('2d');
function frame(){
  const t = T(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); const d = cv.width / FW; c.setTransform(d, 0, 0, d, 0, 0);
  if (on && typeof S !== 'undefined' && !S.asleep) stop();
  const want = on && info().dreams !== false && t > startAt;
  fade = Math.max(0, Math.min(1, fade + (want ? .012 : -.04)));
  if (fade > 0 && order.length){
    if (t - sceneT > SCENE_LEN) { sceneT = t; idx++; if (idx >= order.length) shuffle(); glitchT = t; }
    const name = order[idx], local = t - sceneT, sceneA = Math.min(1, local / .9, (SCENE_LEN - local) / .9);
    yaw = t * .32; pitch = .36 + Math.sin(t * .2) * .06;
    FLICK = (.86 + Math.random() * .14) * (Math.random() < .015 ? .4 : 1);
    projector(t, fade);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.globalAlpha = 1;
    const a0 = fade * Math.max(0, sceneA);
    c.save(); c.globalAlpha = 1; const prevA = c.globalAlpha;
    // draw the scene with its fade (each primitive multiplies FLICK, so scale it here)
    const f0 = FLICK; FLICK = f0 * a0; SCENES[name].draw(t); FLICK = f0;
    c.restore(); c.restore();
    // hologram finish: moving scanlines, an occasional glitch slice
    c.save(); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = .28 * fade; c.fillStyle = '#000';
    for (let y = 28 + (t * 22) % 3; y < 175; y += 3) c.fillRect(30, y, 220, 1); c.restore();
    if (t - glitchT < .25 || Math.random() < .006) { const y = 40 + Math.random() * 110, h = 4 + Math.random() * 10, dx = (Math.random() - .5) * 14, k = cv.width / FW;
      layer.width = cv.width; layer.height = Math.ceil(h * k); lc.drawImage(cv, 0, y * k, cv.width, h * k, 0, 0, cv.width, h * k);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .7; c.drawImage(layer, 0, 0, cv.width, h * k, dx, y, FW, h); c.restore(); }
    caption(t, fade * Math.max(0, sceneA), name);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.DREAMS = { start, stop, _show: name => { on = true; startAt = 0; order = [name]; idx = 0; sceneT = T(); fade = 1; } };
})();
