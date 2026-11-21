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

// ---------- dreams your Mind designs: a recipe (place + props + what you and the pup do + sky + weather + palette) drawn in light ----------
const PAL = { neon: ['#7ae3ff', '#c4a6ff', '#ff7ad9', '#ffe08a'], sakura: ['#ffb3d9', '#ff7ad9', '#fff0f6', '#c4a6ff'], ocean: ['#5fd4ff', '#7ae3ff', '#9dffcf', '#ffffff'],
  sunset: ['#ffb86b', '#ff7ad9', '#ffe08a', '#c4a6ff'], jade: ['#58f0c8', '#9dffcf', '#ffe08a', '#7ae3ff'], lantern: ['#ff6b6b', '#ffb86b', '#ffe08a', '#ff7ad9'],
  night: ['#7f8cff', '#c4a6ff', '#7ae3ff', '#ffffff'], gold: ['#ffe08a', '#ffd6a8', '#ffb86b', '#ffffff'], frost: ['#bfe9ff', '#e6f4ff', '#9fd8ff', '#ffffff'] };
const Y0 = -40;
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const seeded = seed => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
function box(x, y, z, w, h, d, col, al = .6){ const X = [x - w / 2, x + w / 2], Z = [z - d / 2, z + d / 2];
  const b = [[X[0], y, Z[0]], [X[1], y, Z[0]], [X[1], y, Z[1]], [X[0], y, Z[1]]], t = b.map(([a, , c2]) => [a, y + h, c2]);
  poly(b, col, al * .6, .9, true); poly(t, col, al, 1, true); for (let i = 0; i < 4; i++) line(b[i], t[i], col, al * .8, .9); }
function note(x, y, z, col, al){ dot([x, y, z], 2.2, col, al); line([x + 2, y, z], [x + 2, y + 10, z], col, al, 1); line([x + 2, y + 10, z], [x + 6, y + 7, z], col, al, 1); }
function textAt(p3, txt, col, size, al){ const p = P(...p3); c.save(); c.globalAlpha = al * FLICK * depthA(p); c.font = `700 ${Math.max(6, size * p.k)}px "Segoe UI","Microsoft YaHei","Yu Gothic",system-ui`;
  c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.shadowColor = col; c.shadowBlur = 10; c.fillText(txt, p.x, p.y); c.shadowBlur = 20; c.fillText(txt, p.x, p.y); c.restore(); }

const MH = (x, z) => Y0 + 60 * Math.exp(-(x * x + z * z) / (2 * 36 * 36));
const GROUND = {
  park(t, C){ ring(0, Y0, 0, 66, C[0], .35, 48); for (let i = 0; i < 48; i++){ const a = i / 48 * 6.283; dot([Math.cos(a) * 66, Y0, Math.sin(a) * 66], .8, C[0], .45); } ring(0, Y0, 0, 96, C[0], .18, 48); },
  city(t, C){ for (let i = -3; i <= 3; i++){ line([i * 28, Y0, -90], [i * 28, Y0, 90], C[0], .2); line([-90, Y0, i * 28], [90, Y0, i * 28], C[0], .2); }
    for (let i = 0; i < 9; i++){ const a = i / 9 * 6.283 + .2, h = 30 + (i * 37 % 50); box(Math.cos(a) * 92, Y0, Math.sin(a) * 92, 16, h, 16, C[1], .45);
      for (let w = 8; w < h; w += 9) dot([Math.cos(a) * 84, Y0 + w, Math.sin(a) * 84], .9, C[3], .5 + .5 * Math.sin(t * 2 + i + w)); } },
  beach(t, C){ for (let k = 0; k < 6; k++){ const pts = []; for (let i = 0; i <= 30; i++){ const x = -95 + i * 6.3; pts.push([x, Y0 + Math.sin(t * 1.6 + i * .5 + k) * 1.6, -10 - k * 14 + Math.sin(t + i * .3) * 3]); } poly(pts, C[0], .55 - k * .07, 1); }
    for (let i = 0; i < 40; i++) dot([-90 + (i * 47 % 180), Y0, 8 + (i * 29 % 70)], .7, C[3], .35); },
  mountain(t, C){ const H = MH; for (let i = -6; i <= 6; i++){ const p1 = [], p2 = [];
    for (let j = -6; j <= 6; j++){ const x = i * 15, z = j * 15; if (x * x + z * z < 8100) { p1.push([x, H(x, z), z]); p2.push([z, H(z, x), x]); } } poly(p1, C[0], .4, .8); poly(p2, C[0], .4, .8); } },
  lake(t, C){ for (let k = 0; k < 5; k++) ring(0, Y0, 0, ((t * 10 + k * 18) % 90) + 6, C[0], .5 * (1 - ((t * 10 + k * 18) % 90) / 90), 40); ring(0, Y0, 0, 96, C[1], .3, 48); },
  rooftop(t, C){ const s = 70; poly([[-s, Y0, -s], [s, Y0, -s], [s, Y0, s], [-s, Y0, s]], C[0], .6, 1.2, true); poly([[-s, Y0 + 10, -s], [s, Y0 + 10, -s], [s, Y0 + 10, s], [-s, Y0 + 10, s]], C[0], .35, .8, true);
    for (let i = 0; i < 6; i++){ const x = -70 + i * 28; box(x, Y0 - 20, -92, 16, 40 + (i * 23 % 34), 12, C[1], .35); } },
  stage(t, C){ ring(0, Y0, 0, 60, C[0], .8, 48, 1.4); ring(0, Y0 + 4, 0, 60, C[0], .4, 48); for (let i = 0; i < 4; i++){ const a = i / 4 * 6.283 + t * .5, x = Math.cos(a) * 90, z = Math.sin(a) * 90;
      line([x, Y0 + 90, z], [Math.cos(a) * 20, Y0, Math.sin(a) * 20], [C[1], C[2], C[3], C[0]][i], .35, 2.5); } },
  market(t, C){ for (let i = 0; i < 6; i++){ const z = -70 + i * 28; [-46, 46].forEach(x => { box(x, Y0, z, 26, 18, 18, C[1], .5); poly([[x - 15, Y0 + 22, z - 10], [x, Y0 + 30, z - 10], [x + 15, Y0 + 22, z - 10]], C[2], .7, 1);
      dot([x, Y0 + 12, z], 4, C[3], .35); }); } line([-30, Y0, -90], [-30, Y0, 90], C[0], .25); line([30, Y0, -90], [30, Y0, 90], C[0], .25); },
  space(t, C){ for (let i = 0; i < 50; i++){ const a = i * 2.4, r = 40 + (i * 13 % 70); dot([Math.cos(a) * r, -60 + (i * 31 % 150), Math.sin(a) * r], .8, C[3], .3 + .4 * Math.sin(t * 3 + i)); }
    ring(-60, 50, -40, 14, C[1], .8, 30); ring(-60, 50, -40, 24, C[2], .5, 40, 1, 'y'); ring(0, Y0, 0, 40, C[0], .7, 40, 1.4); },
  clouds(t, C){ for (let i = 0; i < 6; i++){ const cx = Math.cos(t * .2 + i) * 70, cz = Math.sin(t * .2 + i) * 70; for (let j = 0; j < 10; j++) dot([cx + Math.cos(j * 2.4) * 12, Y0 + Math.sin(j * 1.7) * 3, cz + Math.sin(j * 2.4) * 9], 2.4, C[3], .3); } },
  cafe(t, C){ ring(0, Y0, 0, 70, C[1], .3, 40); poly([[-60, Y0, -50], [-60, Y0 + 70, -50], [0, Y0 + 70, -50], [0, Y0, -50]], C[0], .6, 1, true); ring(10, Y0 + 22, 6, 20, C[3], .8, 30, 1.2); line([10, Y0 + 22, 6], [10, Y0, 6], C[3], .6); },
};
// big props stand at the back, small ones near you, sky ones float above
const BIG = new Set(['tree', 'sakura', 'bamboo', 'pagoda', 'torii', 'skyline', 'bridge', 'ferriswheel', 'lighthouse', 'tent', 'snowman', 'xmastree', 'campfire', 'speaker', 'piano', 'guitar']);
const SKYP = new Set(['moon', 'sun', 'stars', 'fireworks', 'plane', 'balloon', 'birds', 'butterflies', 'notes', 'lanterns', 'headphones']);
const PROP = {
  tree(x, z, t, C){ line([x, Y0, z], [x, Y0 + 16, z], C[1], .7, 1.2); ring(x, Y0 + 26, z, 9, C[0], .7, 16, 1, 'z'); ring(x, Y0 + 26, z, 9, C[0], .5, 16, 1, 'x'); dot([x, Y0 + 26, z], 5, C[0], .3); },
  sakura(x, z, t, C){ line([x, Y0, z], [x, Y0 + 18, z], '#d9a6ff', .7, 1.4); for (let i = 0; i < 18; i++){ const a = i * 2.4; dot([x + Math.cos(a) * 10 * Math.sin(i), Y0 + 26 + Math.sin(a * 1.3) * 7, z + Math.sin(a) * 10], 1.6, '#ffb3d9', .7); } },
  bamboo(x, z, t, C){ for (let k = 0; k < 4; k++){ const bx = x + (k - 1.5) * 5, sw = Math.sin(t + k) * 2; line([bx, Y0, z], [bx + sw, Y0 + 50, z], '#9dffcf', .7, 1.1); for (let y = 10; y < 50; y += 10) dot([bx + sw * y / 50, Y0 + y, z], .9, '#58f0c8', .8); } },
  pagoda(x, z, t, C){ for (let k = 0; k < 4; k++){ const y = Y0 + k * 14, w = 26 - k * 5; box(x, y, z, w, 10, w, C[1], .6); poly([[x - w / 2 - 5, y + 12, z], [x, y + 16, z], [x + w / 2 + 5, y + 12, z]], C[2], .8, 1.2); } line([x, Y0 + 56, z], [x, Y0 + 66, z], C[3], .9); dot([x, Y0 + 66, z], 2, C[3], .9); },
  torii(x, z, t, C){ line([x - 12, Y0, z], [x - 12, Y0 + 32, z], '#ff6b6b', .9, 1.6); line([x + 12, Y0, z], [x + 12, Y0 + 32, z], '#ff6b6b', .9, 1.6); line([x - 18, Y0 + 36, z], [x + 18, Y0 + 36, z], '#ff6b6b', .9, 2); line([x - 14, Y0 + 28, z], [x + 14, Y0 + 28, z], '#ff6b6b', .8, 1.2); },
  skyline(x, z, t, C){ for (let k = 0; k < 4; k++) box(x + (k - 1.5) * 12, Y0, z, 10, 26 + (k * 17 % 30), 10, C[1], .45); },
  bridge(x, z, t, C){ const pts = []; for (let i = 0; i <= 16; i++){ const u = i / 16; pts.push([x - 30 + u * 60, Y0 + 14 * Math.sin(u * Math.PI), z]); } poly(pts, C[0], .8, 1.3); for (let i = 1; i < 16; i += 3) line(pts[i], [pts[i][0], Y0, z], C[0], .4); },
  ferriswheel(x, z, t, C){ const cy = Y0 + 34; ring(x, cy, z, 26, C[0], .7, 36, 1.2, 'z'); for (let i = 0; i < 8; i++){ const a = i / 8 * 6.283 + t * .4; const px = x + Math.cos(a) * 26, py = cy + Math.sin(a) * 26;
      line([x, cy, z], [px, py, z], C[1], .4); dot([px, py - 3, z], 2.4, [C[2], C[3]][i % 2], .9); } line([x, cy, z], [x - 12, Y0, z], C[1], .6); line([x, cy, z], [x + 12, Y0, z], C[1], .6); },
  lighthouse(x, z, t, C){ line([x - 6, Y0, z], [x - 3, Y0 + 44, z], C[3], .8, 1.2); line([x + 6, Y0, z], [x + 3, Y0 + 44, z], C[3], .8, 1.2); for (let y = 8; y < 44; y += 10) line([x - 5.5 + y * .06, Y0 + y, z], [x + 5.5 - y * .06, Y0 + y, z], '#ff6b6b', .7);
    dot([x, Y0 + 48, z], 5, '#ffe08a', 1); const a = t * 1.5; line([x, Y0 + 48, z], [x + Math.cos(a) * 70, Y0 + 44, z + Math.sin(a) * 70], '#ffe08a', .25, 3); },
  tent(x, z, t, C){ poly([[x - 14, Y0, z - 8], [x, Y0 + 18, z - 8], [x + 14, Y0, z - 8]], C[2], .8, 1.2); poly([[x - 14, Y0, z + 8], [x, Y0 + 18, z + 8], [x + 14, Y0, z + 8]], C[2], .6, 1); line([x, Y0 + 18, z - 8], [x, Y0 + 18, z + 8], C[2], .8); },
  campfire(x, z, t, C){ for (let i = 0; i < 12; i++){ const k = (t * 1.4 + i / 12) % 1; dot([x + Math.sin(t * 5 + i) * 3 * k, Y0 + 2 + k * 20, z], 2.4 * (1 - k) + .5, k < .4 ? '#ffe08a' : '#ff8a3d', (1 - k)); } line([x - 7, Y0, z - 3], [x + 7, Y0, z + 3], '#ffb86b', .6, 1.4); line([x - 7, Y0, z + 3], [x + 7, Y0, z - 3], '#ffb86b', .6, 1.4); },
  notes(x, z, t, C){ for (let i = 0; i < 7; i++){ const k = (t * .12 + i / 7) % 1, a = i * 2.1 + t * .3; note(Math.cos(a) * (30 + k * 40), Y0 + 10 + k * 90, Math.sin(a) * (30 + k * 40), [C[2], C[3], C[0]][i % 3], Math.sin(k * Math.PI) * .9); } },
  headphones(x, z, t, C){ const y = 40 + Math.sin(t * 1.4) * 4; const arc = []; for (let i = 0; i <= 12; i++){ const a = Math.PI * i / 12; arc.push([x + Math.cos(a) * 14, y + Math.sin(a) * 14, z]); } poly(arc, C[2], .9, 1.6); ring(x - 14, y - 3, z, 5, C[2], .9, 14, 1.4, 'x'); ring(x + 14, y - 3, z, 5, C[2], .9, 14, 1.4, 'x'); },
  speaker(x, z, t, C){ box(x, Y0, z, 16, 28, 12, C[1], .6); const pulse = 1 + Math.abs(Math.sin(t * 8)) * .25; ring(x, Y0 + 9, z + 6.5, 5 * pulse, C[2], .9, 16, 1.2, 'z'); ring(x, Y0 + 21, z + 6.5, 3, C[2], .8, 12, 1, 'z'); },
  microphone(x, z, t, C){ line([x, Y0, z], [x, Y0 + 30, z], C[1], .7, 1.1); dot([x, Y0 + 33, z], 3.4, C[3], .9); ring(x, Y0, z, 6, C[1], .6, 14); },
  guitar(x, z, t, C){ ring(x, Y0 + 10, z, 7, C[2], .8, 18, 1.2, 'z'); ring(x, Y0 + 20, z, 5, C[2], .8, 16, 1.2, 'z'); line([x, Y0 + 24, z], [x, Y0 + 46, z], C[1], .8, 1.4); for (let i = -1; i <= 1; i++) line([x + i, Y0 + 6, z + .1], [x + i * .5, Y0 + 46, z + .1], C[3], .4, .5); },
  piano(x, z, t, C){ box(x, Y0, z, 40, 14, 16, C[1], .5); for (let i = 0; i < 10; i++){ const press = Math.sin(t * 6 + i * 1.3) > .8 ? -1.5 : 0; line([x - 18 + i * 4, Y0 + 14 + press, z + 8], [x - 18 + i * 4, Y0 + 14 + press, z + 2], i % 3 === 1 ? C[0] : C[3], .8); } },
  coffee(x, z, t, C){ ring(x, Y0 + 8, z, 4, '#ffffff', .8, 14); line([x - 4, Y0, z], [x - 4, Y0 + 8, z], '#ffffff', .6); line([x + 4, Y0, z], [x + 4, Y0 + 8, z], '#ffffff', .6); for (let i = 0; i < 6; i++){ const k = (t * .5 + i / 6) % 1; dot([x + Math.sin(t * 2 + i) * 2 * k, Y0 + 10 + k * 18, z], 1, '#ffffff', (1 - k) * .7); } },
  bubbletea(x, z, t, C){ line([x - 4, Y0, z], [x - 5, Y0 + 14, z], C[3], .8); line([x + 4, Y0, z], [x + 5, Y0 + 14, z], C[3], .8); ring(x, Y0 + 14, z, 5, C[3], .8, 14); line([x + 1, Y0 + 14, z], [x + 3, Y0 + 22, z], C[2], .9, 1.2); for (let i = 0; i < 6; i++) dot([x - 3 + (i % 3) * 3, Y0 + 2 + Math.floor(i / 3) * 2, z], 1.1, '#ffd6a8', .7); },
  noodles(x, z, t, C){ const prof = [[0, 0], [5, 1], [9, 7]]; for (let i = 0; i < 8; i++){ const a = i / 8 * 6.283; poly(prof.map(([r, y]) => [x + Math.cos(a) * r, Y0 + y, z + Math.sin(a) * r]), C[3], .6, .9); } ring(x, Y0 + 7, z, 9, C[3], .8, 20);
    for (let i = 0; i < 6; i++){ const k = (t * .5 + i / 6) % 1; dot([x + Math.sin(t * 2 + i) * 3, Y0 + 9 + k * 18, z], 1, '#ffffff', (1 - k) * .6); } line([x + 4, Y0 + 8, z], [x + 12, Y0 + 20, z - 2], '#ffd6a8', .9); line([x + 6, Y0 + 8, z], [x + 13, Y0 + 19, z - 1], '#ffd6a8', .9); },
  cake(x, z, t, C){ ring(x, Y0, z, 9, C[0], .7, 20); ring(x, Y0 + 8, z, 9, C[0], .7, 20); ring(x, Y0 + 8, z, 6, C[1], .6, 16); ring(x, Y0 + 14, z, 6, C[1], .7, 16); line([x, Y0 + 14, z], [x, Y0 + 20, z], '#ffffff', .8); dot([x, Y0 + 22, z], 1.8 + Math.random() * .6, '#ffe08a', 1); },
  book(x, z, t, C){ const o = .5 + Math.sin(t) * .3; poly([[x, Y0 + 2, z - 6], [x - 10, Y0 + 2 + o * 6, z - 6], [x - 10, Y0 + 2 + o * 6, z + 6], [x, Y0 + 2, z + 6]], C[3], .8, 1, true); poly([[x, Y0 + 2, z - 6], [x + 10, Y0 + 2 + o * 6, z - 6], [x + 10, Y0 + 2 + o * 6, z + 6], [x, Y0 + 2, z + 6]], C[3], .8, 1, true); },
  laptop(x, z, t, C){ poly([[x - 9, Y0, z], [x + 9, Y0, z], [x + 9, Y0, z + 10], [x - 9, Y0, z + 10]], C[1], .7, 1, true); poly([[x - 9, Y0, z], [x + 9, Y0, z], [x + 9, Y0 + 12, z - 3], [x - 9, Y0 + 12, z - 3]], C[0], .8, 1, true); dot([x, Y0 + 6, z - 1.5], 4, C[0], .4); },
  gamepad(x, z, t, C){ const y = Y0 + 6 + Math.sin(t * 2) * 2; ring(x - 6, y, z, 5, C[2], .8, 14, 1, 'z'); ring(x + 6, y, z, 5, C[2], .8, 14, 1, 'z'); line([x - 6, y + 5, z], [x + 6, y + 5, z], C[2], .8); dot([x + 6, y, z], 1.4, C[3], 1); line([x - 8, y, z], [x - 4, y, z], C[3], .9); line([x - 6, y - 2, z], [x - 6, y + 2, z], C[3], .9); },
  moon(x, z, t, C){ dot([x, 74, z], 10, '#e6f4ff', .6); ring(x, 74, z, 8, '#ffffff', .8, 24, 1, 'z'); },
  sun(x, z, t, C){ dot([x, 70, z], 10, '#ffe08a', .9); for (let i = 0; i < 10; i++){ const a = i / 10 * 6.283 + t; line([x + Math.cos(a) * 13, 70 + Math.sin(a) * 13, z], [x + Math.cos(a) * 19, 70 + Math.sin(a) * 19, z], '#ffe08a', .7); } },
  stars(x, z, t, C){ for (let i = 0; i < 28; i++){ const a = i * 2.4, r = 30 + (i * 17 % 70); dot([Math.cos(a) * r, 40 + (i * 23 % 50), Math.sin(a) * r], .9, '#ffffff', .3 + .5 * Math.abs(Math.sin(t * 2 + i))); } },
  fireworks(x, z, t, C){ for (let k = 0; k < 3; k++){ const ph = (t * .5 + k / 3) % 1, cx = Math.cos(k * 2.1) * 50, cz = Math.sin(k * 2.1) * 50, cy = 50 + k * 10, col = [C[2], C[3], C[0]][k];
      if (ph < .25) dot([cx, Y0 + ph / .25 * (cy - Y0), cz], 1.4, col, 1); else for (let i = 0; i < 12; i++){ const a = i / 12 * 6.283, r = (ph - .25) * 40; dot([cx + Math.cos(a) * r, cy + Math.sin(a) * r - (ph - .25) * 10, cz], 1.2, col, 1 - ph); } } },
  plane(x, z, t, C){ const a = t * .7, r = 80, p = [Math.cos(a) * r, 60, Math.sin(a) * r]; for (let k = 1; k < 18; k++) dot([Math.cos(a - k * .05) * r, 60, Math.sin(a - k * .05) * r], 1, '#ffffff', (1 - k / 18) * .6);
    const d = [-Math.sin(a) * 7, 0, Math.cos(a) * 7]; poly([[p[0] + d[0], p[1], p[2] + d[2]], [p[0] - d[2] * .8, p[1], p[2] + d[0] * .8], [p[0] - d[0] * .5, p[1], p[2] - d[2] * .5], [p[0] + d[2] * .8, p[1], p[2] - d[0] * .8]], '#ffffff', 1, 1.1, true); },
  balloon(x, z, t, C){ const by = 30 + Math.sin(t * .8) * 6; for (let i = 0; i < 8; i++){ const a = i / 8 * 6.283; poly([[0, 22], [9, 20], [13, 12], [11, 4], [5, -2]].map(([r, y]) => [x + Math.cos(a) * r, by + y, z + Math.sin(a) * r]), [C[0], C[2], C[3], C[1]][i % 4], .7, 1); } box(x, by - 10, z, 6, 5, 6, '#ffd6a8', .8); },
  boat(x, z, t, C){ const bob = Math.sin(t * 1.5) * 1.5; poly([[x - 14, Y0 + 4 + bob, z], [x + 14, Y0 + 4 + bob, z], [x + 9, Y0 - 2 + bob, z], [x - 9, Y0 - 2 + bob, z]], C[3], .8, 1.2, true); line([x, Y0 + 4 + bob, z], [x, Y0 + 26 + bob, z], C[3], .8); poly([[x, Y0 + 26 + bob, z], [x + 11, Y0 + 8 + bob, z], [x, Y0 + 8 + bob, z]], C[0], .8, 1, true); },
  birds(x, z, t, C){ for (let i = 0; i < 4; i++){ const a = t * .6 + i * 1.6, bx = Math.cos(a) * 70, bz = Math.sin(a) * 70, by = 40 + i * 6, f = Math.sin(t * 10 + i) * 3; line([bx - 5, by + f, bz], [bx, by, bz], '#ffffff', .7); line([bx, by, bz], [bx + 5, by + f, bz], '#ffffff', .7); } },
  butterflies(x, z, t, C){ for (let i = 0; i < 3; i++){ const bx = Math.cos(t * .8 + i * 2) * 45, bz = Math.sin(t * .8 + i * 2) * 45, by = Y0 + 25 + Math.sin(t * 3 + i) * 8, fl = Math.sin(t * 14) * 4; line([bx, by, bz], [bx - 4, by + fl, bz - 2], C[2], .9); line([bx, by, bz], [bx + 4, by + fl, bz - 2], C[3], .9); } },
  koi(x, z, t, C){ for (let k = 0; k < 2; k++){ const a = t * .7 + k * Math.PI, pts = []; for (let i = 0; i < 7; i++){ const b = a - i * .12; pts.push([Math.cos(b) * 34, Y0 + 1, Math.sin(b) * 34 + Math.sin(t * 4 - i) * 1.5]); } poly(pts, k ? '#ff8a3d' : '#ffffff', .9, 2); dot(pts[0], 2.2, k ? '#ff8a3d' : '#ffffff', .9); } },
  snowman(x, z, t, C){ ring(x, Y0 + 7, z, 7, '#ffffff', .8, 18, 1, 'z'); ring(x, Y0 + 19, z, 5, '#ffffff', .8, 16, 1, 'z'); dot([x, Y0 + 19, z + 5], 1, '#ff8a3d', 1); line([x - 5, Y0 + 12, z], [x - 12, Y0 + 17, z], '#ffd6a8', .7); },
  xmastree(x, z, t, C){ for (let k = 0; k < 3; k++){ const y = Y0 + 6 + k * 12, w = 18 - k * 5; poly([[x - w, y, z], [x, y + 16, z], [x + w, y, z]], '#58f0c8', .8, 1.2, true); }
    dot([x, Y0 + 46, z], 3, '#ffe08a', 1); for (let i = 0; i < 8; i++) dot([x + Math.cos(i * 2.4) * (12 - i), Y0 + 10 + i * 4.5, z + Math.sin(i * 2.4) * 3], 1.4, [C[2], '#ffe08a', '#7ae3ff'][i % 3], .5 + .5 * Math.sin(t * 4 + i)); },
  gift(x, z, t, C){ box(x, Y0, z, 10, 9, 10, C[2], .8); line([x, Y0 + 9, z - 5], [x, Y0 + 9, z + 5], C[3], .9, 1.2); line([x - 5, Y0 + 9, z], [x + 5, Y0 + 9, z], C[3], .9, 1.2); dot([x, Y0 + 11, z], 1.8, C[3], .9); },
  lanterns(x, z, t, C){ for (let i = 0; i < 9; i++){ const a = i / 9 * 6.283 + t * .08, r = 50 + (i % 3) * 18, y = 30 + Math.sin(t * .8 + i) * 6 + (i % 4) * 8, lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      dot([lx, y, lz], 5.5, '#ff6b6b', .45); ring(lx, y, lz, 3.2, '#ffb86b', .9, 12, 1, 'y'); line([lx, y + 3.5, lz], [lx, y + 6, lz], '#ffe08a', .7); dot([lx, y - 4, lz], 1, '#ffe08a', .9); } },
};
const ACT = {   // what you do in the dream
  walk: (t, R) => { const a = t * .45; return { at: [Math.cos(a) * R, Math.sin(a) * R], face: a + Math.PI, opt: { walk: 1 } }; },
  hike: (t, R) => { const a = t * .35; return { at: [Math.cos(a) * R * .7, Math.sin(a) * R * .7], face: a + Math.PI, opt: { walk: 1 }, up: 8 + Math.sin(t * .35) * 4 }; },
  sit: () => ({ at: [-12, 6], face: -Math.PI / 2 + .3, opt: { sit: true }, down: 4 }),
  stargaze: () => ({ at: [-10, 4], face: -Math.PI / 2, opt: { sit: true }, down: 4 }),
  wave: t => ({ at: [0, 0], face: t * .2, opt: { wave: true } }),
  sing: t => ({ at: [0, 0], face: Math.sin(t * .6) * .6, opt: { wave: true } }),
  dance: t => ({ at: [Math.sin(t * 1.6) * 6, 0], face: t * 1.8, opt: { walk: .6, wave: Math.sin(t * 3) > 0 }, up: Math.abs(Math.sin(t * 4)) * 3 }),
};
function weather(kind, t, C){
  if (kind === 'none') return;
  const n = kind === 'confetti' ? 30 : 36;
  for (let i = 0; i < n; i++){ const x = -90 + (i * 53 % 180), z = -70 + (i * 37 % 140), k = ((t * (kind === 'rain' ? .9 : .18)) + i / n) % 1, y = 90 - k * 130;
    if (kind === 'rain') line([x, y, z], [x - 1, y - 6, z], '#9fd8ff', .5, .8);
    if (kind === 'snow') dot([x + Math.sin(t + i) * 4, y, z], 1.2, '#ffffff', .8);
    if (kind === 'petals') dot([x + Math.sin(t * 1.5 + i) * 8, y, z + Math.cos(t + i) * 4], 1.3, '#ffb3d9', .85);
    if (kind === 'fireflies') dot([x * .8 + Math.sin(t * .7 + i) * 10, Y0 + 10 + (i * 13 % 60) + Math.sin(t * 1.3 + i) * 6, z * .8], 1.4, '#ffe08a', .3 + .7 * Math.abs(Math.sin(t * 2 + i * 1.7)));
    if (kind === 'confetti') dot([x + Math.sin(t * 2 + i) * 6, y, z], 1.3, [C[0], C[2], C[3]][i % 3], .9); }
}
function compose(d){
  const C = PAL[d.palette] || PAL.neon, rnd = seeded(hash(d.title + d.place)), props = d.props || [];
  const big = props.filter(p => BIG.has(p) && !SKYP.has(p)), small = props.filter(p => !BIG.has(p) && !SKYP.has(p)), sky = props.filter(p => SKYP.has(p));
  const spotsBig = big.map((p, i) => { const a = (i + .5) / Math.max(1, big.length) * Math.PI * 1.6 + Math.PI * .7 + rnd() * .3, r = 74 + rnd() * 14; return [p, Math.cos(a) * r, Math.sin(a) * r]; });
  const spotsSmall = small.map((p, i) => { const a = i * 2.2 + 1 + rnd() * .4, r = 22 + rnd() * 14; return [p, Math.cos(a) * r, Math.sin(a) * r]; });
  const spotsSky = sky.map(p => [p, -30 + rnd() * 60, -40 - rnd() * 30]);
  return { title: () => d.title, mind: true, draw(t){
    if (d.sky === 'sunset') { for (let i = 0; i < 4; i++) ring(0, Y0 + 20 + i * 18, -100, 80 - i * 14, ['#ffb86b', '#ff7ad9', '#c4a6ff', '#7f8cff'][i], .12, 36, 3, 'z'); }
    if (d.sky === 'night' && !props.includes('stars')) PROP.stars(0, 0, t, C);
    (GROUND[d.place] || GROUND.park)(t, C);
    spotsBig.forEach(([p, x, z]) => PROP[p]?.(x, z, t, C));
    spotsSky.forEach(([p, x, z]) => PROP[p]?.(x, z, t, C));
    spotsSmall.forEach(([p, x, z]) => PROP[p]?.(x, z, t, C));
    const R = d.place === 'stage' ? 30 : d.place === 'market' ? 40 : 62, A = (ACT[d.her] || ACT.walk)(t, R), hy = Y0 + (A.up || 0) - (A.down || 0) + (d.place === 'clouds' || d.place === 'space' ? 4 : 0);
    const onHill = d.place === 'mountain', gy = (x, z) => onHill ? MH(x, z) : Y0;
    const h = her(A.at[0], hy + (onHill ? MH(A.at[0], A.at[1]) - Y0 : 0), A.at[1], A.face, t, A.opt);
    if (d.her === 'sing') { line(h.hand, [h.hand[0], h.hand[1] + 4, h.hand[2]], C[1], .8); dot([h.hand[0], h.hand[1] + 6, h.hand[2]], 2.4, C[3], .9); for (let i = 0; i < 3; i++){ const k = (t * .4 + i / 3) % 1; note(A.at[0] + 6 + k * 20, hy + 50 + k * 30, A.at[1], C[2], 1 - k); } }
    const dogWalk = d.dog === 'walk' || d.dog === 'run', da = d.dog === 'run' ? t * 1.4 : d.her === 'walk' || d.her === 'hike' ? t * .45 + .32 : 0;
    if (d.dog === 'run') { const x = A.at[0] + Math.cos(da) * 22, z = A.at[1] + Math.sin(da) * 22; maltese(x, gy(x, z), z, da + Math.PI, t, { walk: 1.4 }); }
    else if (dogWalk && (d.her === 'walk' || d.her === 'hike')) { const dx = Math.cos(da) * R * (d.her === 'hike' ? .7 : 1), dz = Math.sin(da) * R * (d.her === 'hike' ? .7 : 1); maltese(dx, gy(dx, dz) + (onHill ? 0 : A.up || 0), dz, da + Math.PI, t, { walk: 1 }); line(h.hand, [dx, Y0 + 12, dz], BOW, .8, .9); }
    else if (d.dog === 'play') maltese(A.at[0] + 16, gy(A.at[0] + 16, A.at[1] + 8) + Math.abs(Math.sin(t * 5)) * 8, A.at[1] + 8, Math.sin(t * 2), t, { walk: .6 });
    else maltese(A.at[0] + 16, gy(A.at[0] + 16, A.at[1] + 10) - (d.dog === 'sleep' ? 2 : 0), A.at[1] + 10, Math.PI * .85, t, { sit: true, s: d.dog === 'sleep' ? .9 : 1 });
    if (d.dog === 'sleep') for (let i = 0; i < 3; i++){ const k = (t * .3 + i / 3) % 1; textAt([A.at[0] + 16 + k * 8, Y0 + 20 + k * 20, A.at[1] + 10], 'z', C[3], 7, 1 - k); }
    weather(d.weather, t, C);
    if (d.sign) textAt([0, 62 + Math.sin(t) * 2, -70], d.sign, C[2], 15, .95);
  } };
}
let MIND = [];
const loadMind = list => { const before = MIND.length; MIND = (Array.isArray(list) ? list : []).filter(d => d && d.title && d.place).slice(-12);
  if (on && MIND.length > before && order.length) order.splice(idx + 1, 0, compose(MIND[MIND.length - 1])); };   // a fresh dream plays next
try { window.buddy?.dreamsGet?.().then(loadMind); window.buddy?.on?.dreams?.(loadMind); } catch (_) {}

const ORDER = Object.keys(SCENES);

// ---------- projector: beam, disc, scanlines, glitches, caption ----------
let on = false, startAt = 0, order = [], idx = 0, sceneT = 0, fade = 0, glitchT = 0, previewUntil = 0;
const SCENE_LEN = 14;
const motes = Array.from({ length: 26 }, () => ({ y: Math.random(), x: Math.random() - .5, v: .08 + Math.random() * .15 }));
// newest Mind dream first, then a mix: up to 3 more of its dreams among the classics
function shuffle(){
  const mine = MIND.slice().reverse().map(compose), classics = ORDER.map(k => SCENES[k]).sort(() => Math.random() - .5);
  const extra = mine.slice(1).sort(() => Math.random() - .5).slice(0, 3), mix = [...classics, ...extra].sort(() => Math.random() - .5);
  order = mine.length ? [mine[0], ...mix] : mix; idx = 0;
}
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
  const full = ((name.mind ? '✦ DREAM · ' : 'DREAM · ') + name.title()).toUpperCase(), n = Math.min(full.length, Math.floor((t - sceneT) * 24));
  c.save(); c.globalAlpha = a; c.font = '600 9.5px "Segoe UI",system-ui'; c.textAlign = 'center'; c.fillStyle = '#bfefff'; c.shadowColor = '#5fd4ff'; c.shadowBlur = 8;
  c.fillText(full.slice(0, n) + (Math.floor(t * 3) % 2 ? '▍' : ' '), CX, 18);
  c.globalAlpha = a * .5; c.strokeStyle = '#7ae3ff'; c.lineWidth = .8; c.beginPath(); c.moveTo(CX - 90, 24); c.lineTo(CX + 90, 24); c.stroke(); c.restore();
}
const layer = document.createElement('canvas'), lc = layer.getContext('2d');
function frame(){
  const t = T(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); const d = cv.width / FW; c.setTransform(d, 0, 0, d, 0, 0);
  if (on && typeof S !== 'undefined' && !S.asleep && t > previewUntil) stop();
  const want = on && info().dreams !== false && t > startAt;
  fade = Math.max(0, Math.min(1, fade + (want ? .012 : -.04)));
  if (fade > 0 && order.length){
    if (t - sceneT > SCENE_LEN) { sceneT = t; idx++; if (idx >= order.length) { if (t < previewUntil) idx = 0; else shuffle(); } glitchT = t; }
    const name = order[idx], local = t - sceneT, sceneA = Math.min(1, local / .9, (SCENE_LEN - local) / .9);
    yaw = t * .32; pitch = .36 + Math.sin(t * .2) * .06;
    FLICK = (.86 + Math.random() * .14) * (Math.random() < .015 ? .4 : 1);
    projector(t, fade);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.globalAlpha = 1;
    const a0 = fade * Math.max(0, sceneA);
    c.save(); c.globalAlpha = 1; const prevA = c.globalAlpha;
    // draw the scene with its fade (each primitive multiplies FLICK, so scale it here)
    const f0 = FLICK; FLICK = f0 * a0; try { name.draw(t); } catch (e) { console.warn('dream draw', e); } FLICK = f0;
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
function preview(d, secs = 28){ if (!d) return; on = true; startAt = 0; order = [d.place ? compose(d) : SCENES[d] || SCENES.walk]; idx = 0; sceneT = T(); previewUntil = T() + secs; }
try { window.buddy?.on?.dreamPreview?.(d => preview(d)); } catch (_) {}
window.DREAMS = { start, stop, preview, compose, _show: name => preview(name, 600) };
})();
