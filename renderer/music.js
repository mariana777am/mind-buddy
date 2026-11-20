/* Buddy Music — YouTube (official embedded player) and internet radio, projected with synced lyrics. */
(() => {
'use strict';
const M = window.music || mockMusic();
const $ = id => document.getElementById(id);
const titleEl = $('title'), subEl = $('sub'), badge = $('badge'), linesEl = $('lines'), msgEl = $('msg'), nextUp = $('next-up');
let mode = null, results = [], idx = 0, stations = [], sIdx = 0, player = null, ytReady = false, pendingVideo = null, lyr = [], cur = -1, playing = false, vol = 70;
const audio = new Audio(); audio.preload = 'none';

// ---------- status + lyrics display ----------
function setNow(t, s, kind){ titleEl.textContent = t || ''; subEl.textContent = s || ''; badge.textContent = kind === 'radio' ? 'RADIO · LIVE' : kind === 'yt' ? 'YOUTUBE' : 'MUSIC'; badge.className = kind === 'radio' ? 'radio' : ''; }
function message(t){ linesEl.innerHTML = ''; lyr = []; cur = -1; msgEl.textContent = t; msgEl.style.display = 'flex'; }
function showLyrics(list){
  lyr = list; cur = -1; msgEl.style.display = list.length ? 'none' : 'flex';
  linesEl.innerHTML = list.map((l, i) => `<div class="ln" data-i="${i}">${esc(l.text || '♪')}</div>`).join(''); linesEl.style.transform = 'translateY(0)';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function syncLyrics(t){
  if (!lyr.length) return;
  let i = lyr.length - 1; while (i >= 0 && lyr[i].t > t + .25) i--;
  if (i === cur) return; cur = i;
  [...linesEl.children].forEach((el, k) => { el.classList.toggle('cur', k === i); el.classList.toggle('near', Math.abs(k - i) === 1); });
  const el = linesEl.children[Math.max(0, i)]; if (el) linesEl.style.transform = `translateY(${-(el.offsetTop + el.offsetHeight / 2)}px)`;
  beat = 1;
}
setInterval(() => { if (mode === 'yt' && player?.getCurrentTime && playing) syncLyrics(player.getCurrentTime()); }, 120);

// ---------- YouTube (official IFrame API) ----------
function loadYT(){ if (window.YT?.Player || document.getElementById('ytapi')) return; const s = document.createElement('script'); s.id = 'ytapi'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('yt', { width: 260, height: 200, playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
    events: { onReady: () => { ytReady = true; player.setVolume(vol); if (pendingVideo) { const v = pendingVideo; pendingVideo = null; player.loadVideoById(v); } },
      onStateChange: e => { if (e.data === 1) setPlaying(true); if (e.data === 2) setPlaying(false); if (e.data === 0) next(); },
      onError: e => { message('This video can\'t play here, trying the next one…'); setTimeout(next, 800); } } });
};
async function playYT(q){
  stopRadio(); mode = 'yt'; $('yt').style.display = 'block'; $('radioArt').style.display = 'none'; setNow('Searching YouTube…', q, 'yt'); message('🔎 ' + q);
  const r = await M.youtube(q).catch(e => ({ error: e.message }));
  if (r?.error) { if (r.error === 'NO_YT_KEY' || /quota|403/i.test(r.error)) { message(r.error === 'NO_YT_KEY' ? 'No YouTube key yet, so here\'s radio instead! 📻' : 'YouTube\'s daily limit is used up, so here\'s radio instead! 📻'); setTimeout(() => playRadio(q), 1200); return; }
    message('YouTube search failed: ' + r.error); setNow('YouTube', 'not available', 'yt'); state(); return; }
  results = r.items || []; if (!results.length) { message('Nothing found for "' + q + '"'); return; }
  idx = 0; loadVideo();
}
async function loadVideo(){
  const v = results[idx]; if (!v) return;
  setNow(v.track || v.title, v.artist || v.channel, 'yt'); nextUp.textContent = results[idx + 1] ? 'Up next: ' + (results[idx + 1].track || results[idx + 1].title) : '';
  loadYT(); if (ytReady) player.loadVideoById(v.id); else pendingVideo = v.id;
  message('Finding lyrics…');
  const l = await M.lyrics({ artist: v.artist, track: v.track, duration: v.duration }).catch(() => null);
  if (results[idx] !== v) return;
  if (l?.synced?.length) showLyrics(l.synced);
  else if (l?.instrumental) message('🎶 Instrumental. Enjoy!');
  else message('No synced lyrics for this one. Just vibe! 🎧');
  state();
}

// ---------- Internet radio ----------
async function playRadio(q){
  if (player?.stopVideo) player.stopVideo(); mode = 'radio'; $('yt').style.display = 'none'; $('radioArt').style.display = 'flex';
  setNow('Tuning in…', q, 'radio'); message('📻 Looking for "' + q + '" stations…');
  const r = await M.radio(q).catch(e => ({ error: e.message })); if (r?.error === 'RADIO_DIRECTORY_UNREACHABLE') { setNow('Radio unavailable', q, 'radio'); message('I can\'t reach the radio directory right now. Check your internet, or whether a firewall or VPN blocks radio-browser.info.'); M.log?.('radio directory unreachable'); state(); return; }
  if (r?.error || !r?.items?.length) { setNow('No stations found', q, 'radio'); message('I couldn\'t find "' + q + '" stations right now. Try a language or place, like "cantonese", "chinese pop", "radio hong kong", "kpop" or "japanese", or a genre like jazz or lofi.'); state(); return; }
  stations = r.items; sIdx = 0; tried = 0; tune();
}
let stallT = null, tried = 0, relayed = false;
// direct didn't work: try once more through the app's relay (it understands old Shoutcast-style stations)
function viaRelay(why){
  const s = stations[sIdx]; if (!s || relayed || location.protocol !== 'http:') return false;
  relayed = true; M.log?.(why + ', retrying through the relay: ' + s.name); clearTimeout(stallT);
  stallT = setTimeout(() => { M.log?.('silent through the relay too, skipping: ' + s.name + ' ' + s.url); message('That station is silent, trying another…'); next(); }, 13000);
  audio.src = '/radio?u=' + encodeURIComponent(s.url); audio.play().then(() => setPlaying(true)).catch(() => {}); return true;
}
function tune(){
  const s = stations[sIdx]; if (!s) return;
  clearTimeout(stallT); tried++;
  if (tried > stations.length) { stopRadio(); setPlaying(false); message('None of these ' + stations.length + ' stations would play right now 😕 Try another language, country or genre.'); M.log?.('no station would play for this search'); return; }
  stallT = setTimeout(() => { if (viaRelay('silent for 10 s')) return; M.log?.('silent, skipping: ' + s.name + ' ' + s.url); message('That station is silent, trying another…'); next(); }, 10000);
  setNow(s.name, [s.country, s.language, s.tags.join(' · ')].filter(Boolean).join(' — '), 'radio');
  nextUp.textContent = stations[sIdx + 1] ? 'Next station: ' + stations[sIdx + 1].name : '';
  const logo = $('logo'); logo.style.display = s.favicon ? 'block' : 'none'; logo.src = s.favicon || ''; logo.onerror = () => logo.style.display = 'none';
  message('📻 Live radio: ' + s.name + (s.bitrate ? ` · ${s.bitrate} kbps` : '')); msgEl.style.display = 'flex';
  relayed = false; audio.src = s.url; audio.volume = vol / 100; audio.play().then(() => setPlaying(true)).catch(e => { if (e?.name === 'AbortError') return; if (viaRelay('play() refused: ' + (e?.name || ''))) return; M.log?.('play() refused: ' + (e?.name || '') + ' ' + (e?.message || '') + ' — ' + s.name); message('That station didn\'t answer, trying another…'); setTimeout(next, 600); });
}
audio.onerror = () => { if (mode === 'radio' && audio.src) { if (viaRelay('direct play failed (error ' + (audio.error?.code || '?') + ')')) return; const s = stations[sIdx]; M.log?.('could not play: ' + (s?.name || '') + ' ' + (s?.url || '') + ' (error ' + (audio.error?.code || '?') + ')'); message('That station didn\'t answer, trying another…'); setTimeout(next, 600); } };
audio.onplaying = () => { clearTimeout(stallT); tried = 0; if (mode === 'radio') { const s = stations[sIdx]; message('📻 Live: ' + (s?.name || '')); M.log?.('playing: ' + (s?.name || '') + ' ' + (s?.url || '')); } };
function stopRadio(){ clearTimeout(stallT); audio.pause(); audio.removeAttribute('src'); audio.load(); }

// ---------- ducking: music goes quiet while you talk to the buddy (and while it answers), then fades back ----------
let ducked = false, fadeT = null, outVol = 70;
function setOut(v){ outVol = v; audio.volume = Math.max(0, Math.min(1, v / 100)); player?.setVolume?.(Math.round(v)); }
// on: 'mute' (you're talking: silent so the mic hears only you), true (the buddy is answering: soft), false (back to normal)
function duck(on){
  if (on === ducked) return; ducked = on; clearInterval(fadeT);
  const from = outVol, to = on === 'mute' ? 0 : on ? Math.min(vol, 10) : vol, steps = on === 'mute' ? 2 : on ? 6 : 14; let i = 0;   // quick dip, gentle return
  fadeT = setInterval(() => { i++; setOut(from + (to - from) * i / steps); if (i >= steps) clearInterval(fadeT); }, 40);
}

// ---------- controls ----------
function setPlaying(p){ playing = p; $('play').textContent = p ? '⏸' : '▶'; state(); }
function toggle(){ if (mode === 'yt' && player) (playing ? player.pauseVideo() : player.playVideo()); if (mode === 'radio') (playing ? (audio.pause(), setPlaying(false)) : audio.play().then(() => setPlaying(true))); }
function next(){ if (mode === 'yt' && results.length) { idx = (idx + 1) % results.length; loadVideo(); } if (mode === 'radio' && stations.length) { sIdx = (sIdx + 1) % stations.length; tune(); } }
function prev(){ if (mode === 'yt' && results.length) { idx = (idx - 1 + results.length) % results.length; loadVideo(); } if (mode === 'radio' && stations.length) { sIdx = (sIdx - 1 + stations.length) % stations.length; tune(); } }
function stop(){ if (player?.stopVideo) player.stopVideo(); stopRadio(); setPlaying(false); M.close(); }
function state(){ const t = mode === 'yt' ? results[idx] : stations[sIdx]; M.state?.({ playing, kind: mode, title: mode === 'yt' ? (t?.track || t?.title) : t?.name, artist: mode === 'yt' ? t?.artist : t?.country }); }
$('play').onclick = toggle; $('next').onclick = next; $('prev').onclick = prev; $('close').onclick = stop;
$('vol').oninput = e => { vol = Number(e.target.value); if (!ducked) setOut(vol); };
M.onCommand(cmd => {
  if (cmd.op === 'yt') playYT(cmd.arg); else if (cmd.op === 'radio') playRadio(cmd.arg);
  else if (cmd.op === 'pause') { if (playing) toggle(); } else if (cmd.op === 'resume') { if (!playing) toggle(); }
  else if (cmd.op === 'toggle') toggle(); else if (cmd.op === 'next') next(); else if (cmd.op === 'prev') prev(); else if (cmd.op === 'stop') stop();
  else if (cmd.op === 'duck') duck(true); else if (cmd.op === 'mute') duck('mute'); else if (cmd.op === 'unduck') duck(false);
  else if (cmd.op === 'volume') { vol = Math.max(0, Math.min(100, Number(cmd.arg))); $('vol').value = vol; audio.volume = vol / 100; player?.setVolume?.(vol); }
});

// ---------- projection background + radio visualizer ----------
const bg = $('bg'), g = bg.getContext('2d'), viz = $('viz'), vz = viz.getContext('2d');
let beat = 0, W = 0, H = 0;
function fit(){ const d = Math.max(1, devicePixelRatio || 1); W = innerWidth; H = innerHeight; bg.width = W * d; bg.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); viz.width = 262 * d; viz.height = 202 * d; vz.setTransform(d, 0, 0, d, 0, 0); }
fit(); addEventListener('resize', fit);
const motes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), v: .02 + Math.random() * .05, s: .6 + Math.random() * 1.8, c: ['#7ad7ff', '#c4a6ff', '#ff9be6'][Math.floor(Math.random() * 3)] }));
const bars = Array.from({ length: 40 }, () => 0);
function frame(){
  const t = performance.now() / 1000; beat *= .94; const pulse = playing ? (.5 + .5 * Math.sin(t * Math.PI * 2 * 1.9)) ** 6 : 0; beat = Math.max(beat, pulse * .6);
  g.clearRect(0, 0, W, H);
  g.save(); g.shadowColor = '#3fb5ff'; g.shadowBlur = 30; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#05082ae6'); gr.addColorStop(1, '#0b0630f0');
  g.fillStyle = gr; g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 26); g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 26); g.clip(); g.globalCompositeOperation = 'lighter';
  [['#5b3cff', .3, .2], ['#1fb8ff', .75, .7], ['#ff4fd8', .55, .35]].forEach(([col, x, y], i) => { const cx = W * (x + Math.sin(t * .2 + i) * .08), cy = H * (y + Math.cos(t * .17 + i) * .08), r = 180 + beat * 60;
    const b = g.createRadialGradient(cx, cy, 0, cx, cy, r); b.addColorStop(0, col + '30'); b.addColorStop(1, col + '00'); g.fillStyle = b; g.fillRect(0, 0, W, H); });
  motes.forEach(m => { m.y -= m.v * .016 * (1 + beat * 3); if (m.y < 0) { m.y = 1; m.x = Math.random(); } g.globalAlpha = .4 + beat * .5; g.fillStyle = m.c; g.beginPath(); g.arc(m.x * W, m.y * H, m.s, 0, 7); g.fill(); });
  g.restore();
  g.save(); g.strokeStyle = `rgba(159,230,255,${.35 + beat * .4})`; g.lineWidth = 1; g.beginPath(); g.roundRect(14.5, 14.5, W - 29, H - 29, 26); g.stroke(); g.restore();
  if (mode === 'radio') {                                                                   // a living, breathing ring of light around the station logo
    vz.clearRect(0, 0, 262, 202); vz.save(); vz.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bars.length; i++){ const target = playing ? .25 + Math.random() * .75 * (.6 + .4 * Math.sin(t * 3 + i * .5)) : .05; bars[i] += (target - bars[i]) * .18;
      const a = i / bars.length * Math.PI * 2 - Math.PI / 2, r1 = 48, r2 = 48 + bars[i] * 42;
      vz.strokeStyle = `hsla(${300 - i * 4},100%,72%,.85)`; vz.lineWidth = 3; vz.lineCap = 'round'; vz.beginPath(); vz.moveTo(131 + Math.cos(a) * r1, 101 + Math.sin(a) * r1); vz.lineTo(131 + Math.cos(a) * r2, 101 + Math.sin(a) * r2); vz.stroke(); }
    vz.restore();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__music = { playYT, playRadio, showLyrics, syncLyrics, setPlaying, get mode(){ return mode; } };

function mockMusic(){
  const h = []; return { youtube: async q => ({ items: [{ id: 'dQw4w9WgXcQ', title: 'Demo - Song', artist: 'Demo Artist', track: 'Demo Song', duration: 200 }] }),
    lyrics: async () => ({ synced: [{ t: 0, text: '♪' }, { t: 2, text: 'Lyric line one' }, { t: 4, text: 'Lyric line two' }, { t: 6, text: 'Lyric line three' }, { t: 8, text: 'Lyric line four' }] }),
    radio: async q => ({ items: [{ id: 'r1', name: 'Smooth Jazz Lounge', url: 'data:audio/mp3;base64,', favicon: '', country: 'Indonesia', tags: ['jazz', 'smooth'] }] }),
    state: s => (window.__states ||= []).push(s), close: () => { window.__closed = true; }, onCommand: fn => (window.__cmd = fn) };
}
})();
