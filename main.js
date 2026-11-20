// Minds Buddy — a fun talking-head desk buddy for Windows, powered by your Mind.
import { app, BrowserWindow, ipcMain, globalShortcut, powerMonitor, screen, clipboard, Menu, shell, session, safeStorage, dialog } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, statSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askMind, mockReply, provider, resolveMind, onLateReply } from './lib/minds.js';
import { createBrain, fmtTime, parseTags } from './lib/brain.js';
import { createGoogle } from './lib/google.js';
import { createWinWatch } from './lib/winwatch.js';
import { createTimeline, createReminders } from './lib/store.js';
import { createInitiative, LEVELS } from './lib/initiative.js';
import { createMusic } from './lib/music.js';
import { relayStream } from './lib/streamproxy.js';
import http from 'node:http';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// ---------- settings (.env next to the app) ----------
function loadEnv(file){
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)){
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (!m) continue;
    let v = m[2].trim(); if (/^["']/.test(v)) v = v.slice(1, v.lastIndexOf(v[0]) > 0 ? v.lastIndexOf(v[0]) : undefined); else v = v.replace(/\s+#.*$/, '').trim();
    if (process.env[m[1]] && process.env[m[1]] !== v && v) console.log(`[buddy] note: ${m[1]} is also set in Windows; using the one from .env`);
    if (v || !(m[1] in process.env)) process.env[m[1]] = v;   // .env wins over old Windows variables
  }
  return true;
}
const hadEnv = loadEnv(path.join(DIR, '.env'));
const E = process.env;
const IDLE_MIN = Number(E.IDLE_MINUTES || 5), DOZE_MIN = Number(E.DOZE_MINUTES ?? 5), ALERT_MIN = Number(E.MEETING_ALERT_MINUTES || 10);
let LOGFILE = null;
const log = (...a) => { const line = `${new Date().toLocaleString()} [buddy] ${a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')}`; console.log(line);
  if (LOGFILE) try { if (existsSync(LOGFILE) && statSync(LOGFILE).size > 1_000_000) renameSync(LOGFILE, LOGFILE + '.old'); appendFileSync(LOGFILE, line + '\n'); } catch (_) {} };

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('ai.minds.buddy');
const DATA = app.getPath('userData'); mkdirSync(DATA, { recursive: true }); LOGFILE = path.join(DATA, 'buddy.log'); log('--- Minds Buddy started ---');

// ---------- parts ----------
const timeline = createTimeline(DATA, { days: Number(E.TIMELINE_DAYS || 3), ignoreApps: E.IGNORE_APPS, ignoreTitles: E.IGNORE_TITLES });
const reminders = createReminders(DATA);
const winwatch = createWinWatch({ log });
const TOKENS = path.join(DATA, 'google.bin');
const google = createGoogle({
  clientId: E.GOOGLE_CLIENT_ID, clientSecret: E.GOOGLE_CLIENT_SECRET, log,
  saveTokens: t => { if (!t) { try { writeFileSync(TOKENS, ''); } catch (_) {} return; }
    const s = JSON.stringify(t); writeFileSync(TOKENS, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s)); },
  loadTokens: () => { if (!existsSync(TOKENS)) return null; const b = readFileSync(TOKENS); if (!b.length) return null;
    return JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString()); },
});
let mindName = null, current = null, quiet = false, handsfree = (E.HANDS_FREE || '').toLowerCase() === 'on';
// small JSON stores in %APPDATA%\minds-buddy: settings (size, position, sounds), pet (needs, level, wardrobe), profile (facts it remembers)
const jsonPath = n => path.join(DATA, n + '.json');
const readJson = (n, d) => { try { return JSON.parse(readFileSync(jsonPath(n), 'utf8')); } catch { return d; } };
const writeJson = (n, v) => { try { writeFileSync(jsonPath(n), JSON.stringify(v)); } catch (_) {} };
const settings = readJson('settings', { scale: 1, sounds: true });
const profile = readJson('profile', { facts: [] });
let petNote = '';
// what you told me you love: your Mind can bring it up, and the dreams are about it
if (!settings.likesSeeded) { const f = 'Loves travelling, adventures, walking her white Maltese, sitting in cafés and hiking mountains';
  if (!profile.facts.includes(f)) { profile.facts.push(f); writeJson('profile', profile); } settings.likesSeeded = true; writeJson('settings', settings); }
// friendly app names for the note to your Mind ("WINWORD" → "Word")
const APP_NAMES = { winword: 'Word', excel: 'Excel', powerpnt: 'PowerPoint', outlook: 'Outlook', olk: 'Outlook', chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', code: 'VS Code', cursor: 'Cursor',
  teams: 'Teams', 'ms-teams': 'Teams', zoom: 'Zoom', spotify: 'Spotify', notepad: 'Notepad', explorer: 'File Explorer', slack: 'Slack', discord: 'Discord', whatsapp: 'WhatsApp', telegram: 'Telegram', acrobat: 'Acrobat', notion: 'Notion', figma: 'Figma' };
const appName = a => APP_NAMES[String(a || '').toLowerCase()] || String(a || '');
const ask = (alias, text) => provider() === 'mock' ? mockReply(text) : askMind('minds-buddy-' + alias, text);
const brain = createBrain({ ask, google, reminders, log, name: () => mindName,
  activity: () => current && !timeline.paused() ? (/^(on|1|true|yes)$/i.test(E.SHARE_TITLES || '') ? `${current.app} — "${current.title.slice(0, 80)}"` : appName(current.app)) : '',
  extra: () => [petNote, profile.facts.length ? 'Things you remember about the user: ' + profile.facts.slice(-25).join('; ') + '.' : ''].filter(Boolean).join(' '),
  remember: f => { f = f.trim(); if (f && !profile.facts.some(x => x.toLowerCase() === f.toLowerCase())) { profile.facts.push(f); profile.facts = profile.facts.slice(-40); writeJson('profile', profile); log('remembered:', f); } },
  confirm: q => confirmAsk(q) });

// ---------- window ----------
let win;
const W = 280, H = 360;
const SIZES = { Small: .7, Medium: 1, Large: 1.35, 'Extra large': 1.75 };
let scale = Math.min(2, Math.max(.55, Number(settings.scale) || 1));
function createWindow(){
  const wa = screen.getPrimaryDisplay().workArea, w = Math.round(W * scale), h = Math.round(H * scale);
  const saved = settings.pos && screen.getAllDisplays().some(d => { const a = d.workArea; return settings.pos.x > a.x - w / 2 && settings.pos.x < a.x + a.width - w / 2 && settings.pos.y > a.y - h && settings.pos.y < a.y + a.height - h / 3; });
  win = new BrowserWindow({ width: w, height: h, x: saved ? settings.pos.x : wa.x + wa.width - w - 16, y: saved ? settings.pos.y : wa.y + wa.height - h - 8,
    transparent: true, frame: false, resizable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, focusable: true, show: false,
    webPreferences: { preload: path.join(DIR, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(DIR, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(scale));
  win.on('resize', () => { const b = win.getBounds(), w = Math.round(W * scale), h = Math.round(H * scale); if (b.width !== w || b.height !== h) win.setBounds({ x: b.x, y: b.y, width: w, height: h }); });
  let posT = null; win.on('move', () => { clearTimeout(posT); posT = setTimeout(() => { if (!flinging && !walking) { const [x, y] = win.getPosition(); settings.pos = { x, y }; writeJson('settings', settings); } }, 600); });
}
// Move without letting Windows grow the window: at 125%/150% display scaling, setPosition() adds a pixel each move,
// so the bubble kept getting wider while dragging. setBounds with the size locked fixes that.
function moveTo(x, y){ if (!alive()) return; win.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(W * scale), height: Math.round(H * scale) }); }
function setScale(k){
  k = Math.min(2, Math.max(.55, Math.round(k * 100) / 100)); if (k === scale) return;
  const b = win.getBounds(), w = Math.round(W * k), h = Math.round(H * k), wa = workAreaFor(b);
  // keep the buddy's feet where they were (anchor bottom-centre), but always inside the screen
  const x = Math.max(wa.x - w * .15, Math.min(wa.x + wa.width - w * .85, Math.round(b.x + b.width / 2 - w / 2)));
  const y = Math.max(wa.y - h * .3, Math.min(wa.y + wa.height - h + 8, b.y + b.height - h));
  scale = k;                                    // set first, so the size guard doesn't snap it back
  win.setResizable(true); win.setBounds({ x, y, width: w, height: h }); win.setResizable(false);
  win.webContents.setZoomFactor(k); settings.scale = k; settings.pos = { x, y }; writeJson('settings', settings);
  setTimeout(() => { if (!win.isVisible()) win.showInactive(); win.webContents.invalidate(); toUI('scale', k); }, 60);
}
ipcMain.on('scale-by', (e, d) => setScale(scale * (d > 0 ? 1.08 : 1 / 1.08)));

// ---------- flick physics: throw it and it bounces off the screen edges ----------
let flinging = false, walking = false;
function workAreaFor(b){ return screen.getDisplayMatching(b).workArea; }
ipcMain.on('fling', (e, { vx, vy }) => {
  if (flinging) return; flinging = true;
  let [x, y] = win.getPosition(); const b0 = win.getBounds(), wa = workAreaFor(b0), w = b0.width, h = b0.height;
  const top = wa.y - Math.round(130 * scale), floor = wa.y + wa.height - h + Math.round(8 * scale);   // head can touch the top edge; feet stand on the taskbar
  vx = Math.max(-60, Math.min(60, vx)); vy = Math.max(-60, Math.min(60, vy));
  let frames = 0, bumps = 0;
  const t = setInterval(() => {
    frames++; vy += 1.1; x += vx; y += vy; let hit = null;
    if (x < wa.x - w * .18) { x = wa.x - w * .18; vx = -vx * .65; hit = 'left'; }
    if (x > wa.x + wa.width - w * .82) { x = wa.x + wa.width - w * .82; vx = -vx * .65; hit = 'right'; }
    if (y < top) { y = top; vy = -vy * .6; hit = 'top'; }
    if (y > floor) { y = floor; vy = Math.abs(vy) > 4 ? -vy * .5 : 0; vx *= .82; if (Math.abs(vy) > 4) hit = 'floor'; }
    if (hit && bumps++ < 12) toUI('bump', { side: hit, speed: Math.hypot(vx, vy) });
    moveTo(x, y);
    if ((y >= floor && Math.abs(vx) < .6 && vy === 0) || frames > 420){ clearInterval(t); flinging = false; toUI('landed', { bumps });
      settings.pos = { x: Math.round(x), y: Math.round(y) }; writeJson('settings', settings); }
  }, 16);
});
// ---------- strolls: walk along the taskbar (and peek in from the edge) ----------
ipcMain.on('walk', (e, { dx, peek }) => {
  if (flinging || walking) return; walking = true;
  const b = win.getBounds(), wa = workAreaFor(b), home = { x: b.x, y: b.y };
  let target = peek ? (b.x + b.width / 2 > wa.x + wa.width / 2 ? wa.x + wa.width - b.width * .45 : wa.x - b.width * .55) : Math.max(wa.x, Math.min(wa.x + wa.width - b.width, b.x + dx));
  const steps = Math.max(20, Math.round(Math.abs(target - b.x) / 3)); let i = 0, back = false;
  toUI('walking', { dir: Math.sign(target - b.x) || 1, peek });
  const t = setInterval(() => {
    i++; const from = back ? target : home.x, to = back ? home.x : target, p = Math.min(1, i / steps);
    moveTo(from + (to - from) * p, home.y);
    if (p >= 1){
      if (!back) { back = true; i = 0; const [tx] = win.getPosition(); target = tx; clearInterval(t);
        setTimeout(() => { toUI('walking', { dir: Math.sign(home.x - target) || -1, back: true, peek }); const t2 = setInterval(() => { i++; const q = Math.min(1, i / steps);
          moveTo(target + (home.x - target) * q, home.y); if (q >= 1) { clearInterval(t2); walking = false; toUI('walked'); } }, 16); }, peek ? 2600 : 1800); }
    }
  }, 16);
});
onLateReply((alias, text) => {
  if (!/minds-buddy-buddy$/.test(alias)) return;
  const p = parseTags(text); log('late answer:', p.text.slice(0, 100));
  toUI('late-answer', { text: p.text, mood: p.mood || 'excited', action: p.action || 'jump', scene: p.scene, show: p.show, fx: p.fx });
});
let lastSaid = Date.now();
const toUI = (ch, data) => { if (ch === 'say' || ch === 'alert') lastSaid = Date.now(); return toUIraw(ch, data); };
const alive = () => !!win && !win.isDestroyed() && !quitting;
let quitting = false;
const toUIraw = (ch, data) => alive() && win.webContents.send(ch, data);

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === 'media');
  createWindow();
  registerHotkeys();
  timers.push(setInterval(() => alive() && tick().catch(e => log('tick failed:', e.message)), 5000));
  if (!settings.announce?.picked && !settings.announceAsked) { settings.announceAsked = true; writeJson('settings', settings);   // first time: let her choose the announcement voice
    setTimeout(() => { if (!alive()) return; toUI('say', { text: 'New trick! I now make free announcements with a Windows voice. Pick the one you like!', mood: 'excited', action: 'jump', silent: true }); openVoicePicker(); }, 12000); }
  timers.push(setInterval(() => alive() && meetingCheck(), 60_000)); setTimeout(() => alive() && meetingCheck(), 8000);
  timers.push(setInterval(() => alive() && eyes(), 90));
  if (provider() !== 'mock') resolveMind().then(m => { mindName = m.name; toUI('info', info()); log('Mind:', m.name || m.mindId); })
    .catch(e => { log('Mind not ready:', e.message); toUI('say', { text: friendlyError(e), mood: 'confused', silent: true }); });
});
const timers = [];
app.on('before-quit', () => { quitting = true; timers.forEach(clearInterval); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); winwatch.stop(); });
app.on('second-instance', () => win?.showInactive());

function info(){
  return { name: mindName || 'Buddy', provider: provider(), voice: VOICE() || null, ears: !!VOICE(), google: google.connected(), googleReady: google.configured(),
    quiet, handsfree, scale, announce: settings.announce || null, sounds: settings.sounds !== false, dreams: settings.dreams !== false, dogName: E.DOG_NAME || settings.dogName || '', offRecord: timeline.paused(), dimAfterMin: Number(E.DIM_AFTER_MINUTES ?? 2), dimOpacity: Number(E.DIM_OPACITY ?? .35), idleMin: IDLE_MIN, hadEnv, windows: winwatch.available };
}

// ---------- mouse: click-through except on the buddy ----------
ipcMain.on('hover', (e, over) => alive() && win.setIgnoreMouseEvents(!over, { forward: true }));
ipcMain.on('drag', (e, { dx, dy }) => { if (!alive() || flinging || walking) return; const [x, y] = win.getPosition(); moveTo(x + dx, y + dy); });
let lastCursor = '';
function eyes(){
  if (!alive() || sleeping) return;
  const c = screen.getCursorScreenPoint(), b = win.getBounds(), k = `${c.x},${c.y}`;
  if (k === lastCursor) return; lastCursor = k;
  toUI('cursor', { x: c.x - (b.x + b.width / 2), y: c.y - (b.y + b.height * 0.45) });
}

// ---------- talking ----------
ipcMain.handle('info', () => info());
ipcMain.handle('store-get', (e, k) => ['pet'].includes(k) ? readJson(k, null) : null);
ipcMain.on('store-set', (e, { k, v }) => { if (['pet'].includes(k)) writeJson(k, v); });
ipcMain.on('pet-note', (e, note) => { petNote = String(note || '').slice(0, 600); });
ipcMain.handle('facts', () => profile.facts.slice(-40));
ipcMain.handle('ask', async (e, text) => {
  text = String(text || '').trim().slice(0, 2000); if (!text) return null;
  uiStatus.touched = Date.now(); if (!/^\[game helper/.test(text)) initiative.feedback('yes');
  log('you:', text.slice(0, 100));
  try {
    const r = await brain.talk(text, { onThinking: (t, mood) => toUI('say', { text: t, mood, interim: true }) });
    if (r.music) musicCommand(r.music);
    log('buddy:', r.text.slice(0, 100), r.done.length ? JSON.stringify(r.done) : '');
    return r;
  } catch (err){ log('ask failed:', err.message); return { text: friendlyError(err), mood: 'confused', action: 'shrug', done: [] }; }
});
function friendlyError(e){
  const m = e.message || String(e);
  if (/Cannot find package/i.test(m)) return 'My brain library is missing. Run npm install in my folder.';
  if (/is not set in \.env/i.test(m)) return 'My Minds key is missing. Put MINDS_BUILDER_API_KEY in the .env file.';
  if (/invalid|expired|401|403|unauthori[sz]ed|forbidden/i.test(m)) return 'The Minds server says my key is not accepted (' + m.slice(0, 70) + '). Run node check-key.mjs in my folder.';
  if (/No Mind/i.test(m)) return 'I can\'t find your Mind. Check MIND_ID in the .env file.';
  return 'Oops, my brain hiccuped: ' + m.slice(0, 90);
}

const VOICE_STYLE = 'Playful, upbeat cartoon sidekick who sits on the user\'s desk: warm, bright and smiley, quick and a little bouncy, ' +
  'natural human intonation with a grin you can hear, an occasional tiny laugh when something is funny. Friendly adult voice, not a child, never robotic, never shouty.';
const MOOD = { happy: 'Sound happy.', excited: 'Sound excited, a bit faster.', curious: 'Sound curious.', calm: 'Sound calm and gentle.', focused: 'Sound focused and crisp.',
  sleepy: 'Sound sleepy and cozy, slow, with a small yawn.', confused: 'Sound puzzled.', proud: 'Sound proud and cheerful.', worried: 'Sound a bit worried but kind.' };
// Voice + hearing: OpenAI or ElevenLabs. VOICE_PROVIDER=openai|elevenlabs picks one when both keys are set.
const VOICE = () => (E.VOICE_PROVIDER || (E.OPENAI_API_KEY ? 'openai' : E.ELEVENLABS_API_KEY ? 'elevenlabs' : '')).toLowerCase();
const ELEVEN_VOICE = () => E.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';   // default: a premade ElevenLabs voice ("Sarah")
const ELEVEN_MOOD = { excited: { stability: .28, style: .75, speed: 1.08 }, happy: { stability: .33, style: .65 }, proud: { stability: .33, style: .65 }, curious: { stability: .38, style: .55 },
  sleepy: { stability: .7, style: .25, speed: .9 }, calm: { stability: .55, style: .35 }, worried: { stability: .45, style: .45 }, confused: { stability: .4, style: .5 } };
let elevenFallback = false;
ipcMain.handle('tts', (e, { text, mood }) => ipcTts(text, mood));
async function ipcTts(text, mood){
  if (!VOICE() || quiet) return null;
  try {
    if (VOICE() === 'elevenlabs'){
      const m = ELEVEN_MOOD[mood] || { stability: .35, style: .6 };   // lively by default
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVEN_VOICE())}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': E.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: String(text).slice(0, 1200), model_id: E.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
          voice_settings: { stability: m.stability, similarity_boost: .8, style: m.style, use_speaker_boost: true, ...(m.speed ? { speed: m.speed } : {}) } }) });
      if (r.status === 404 && E.ELEVENLABS_VOICE_ID && !elevenFallback){ elevenFallback = true; log(`voice id ${E.ELEVENLABS_VOICE_ID} not found in your ElevenLabs account, using the default voice`); E.ELEVENLABS_VOICE_ID = ''; return ipcTts(text, mood); }
      if (!r.ok) throw new Error('ElevenLabs ' + r.status + ' ' + (await r.text()).slice(0, 160));
      return new Uint8Array(await r.arrayBuffer());
    }
    const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { authorization: 'Bearer ' + E.OPENAI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ model: E.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: E.BUDDY_VOICE || 'coral', input: String(text).slice(0, 1200), response_format: 'mp3', instructions: VOICE_STYLE + ' ' + (MOOD[mood] || '') }) });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 120));
    return new Uint8Array(await r.arrayBuffer());
  } catch (err){ log('voice failed:', err.message); return null; }
}
ipcMain.handle('stt', async (e, bytes) => {
  if (!VOICE()) return { error: 'Add ELEVENLABS_API_KEY or OPENAI_API_KEY to .env so I can hear you. You can type to me meanwhile (Ctrl+Alt+T).' };
  try {
    if (VOICE() === 'elevenlabs'){
      const t0 = Date.now(), fd = new FormData();
      fd.append('file', new Blob([bytes], { type: 'audio/webm' }), 'speech.webm');
      fd.append('model_id', E.ELEVENLABS_STT_MODEL || 'scribe_v1');
      fd.append('tag_audio_events', 'false');
      const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': E.ELEVENLABS_API_KEY }, body: fd });
      const j = await r.json(); if (!r.ok) throw new Error(j.detail?.message || j.detail || r.status);
      log(`heard (${Math.round(bytes.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s):`, String(j.text || '').trim() || '(nothing)');
      return { text: String(j.text || '').trim() };
    }
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type: 'audio/webm' }), 'speech.webm');
    fd.append('model', E.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: 'Bearer ' + E.OPENAI_API_KEY }, body: fd });
    const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
    return { text: String(j.text || '').trim() };
  } catch (err){ log('hearing failed:', err.message); return { error: 'I couldn\'t hear that properly (' + err.message.slice(0, 60) + ').' }; }
});

// ---------- confirm questions (shown as Yes / No in the bubble) ----------
const pendingConfirm = new Map();
function confirmAsk(question){
  return new Promise(res => { const id = Math.random().toString(36).slice(2);
    pendingConfirm.set(id, res); toUI('confirm', { id, question });
    setTimeout(() => { if (pendingConfirm.delete(id)) res(false); }, 90_000); });
}
ipcMain.on('confirm-answer', (e, { id, yes }) => { const r = pendingConfirm.get(id); if (r){ pendingConfirm.delete(id); r(!!yes); } });

// ---------- typing help: select text anywhere, press the hotkey ----------
let fixing = false;
async function fixSelection(mode){
  if (fixing) return; fixing = true;
  const saved = { text: clipboard.readText(), html: clipboard.readHTML(), image: clipboard.readImage() };
  try {
    if (!winwatch.available) return toUI('say', { text: 'Typing help only works on Windows for now.', mood: 'confused' });
    clipboard.clear();
    await winwatch.copy();
    let sel = ''; for (let i = 0; i < 12 && !sel; i++){ await wait(60); sel = clipboard.readText(); }
    if (!sel.trim()) { restore(saved); return toUI('say', { text: 'Select some text first, then press the hotkey again!', mood: 'curious', action: 'shrug' }); }
    if (sel.length > 6000) { restore(saved); return toUI('say', { text: 'Whoa, that\'s a lot! Select up to about a page at a time.', mood: 'worried' }); }
    toUI('working', { mode });
    const fixed = await brain.fixText(sel, mode);
    if (!fixed) { restore(saved); return toUI('say', { text: 'My brain didn\'t answer in time. Try once more?', mood: 'confused' }); }
    if (fixed === sel.trim()) { restore(saved); return toUI('fixed', { changes: 0, mode }); }
    clipboard.writeText(sel.endsWith('\n') && !fixed.endsWith('\n') ? fixed + '\n' : fixed);
    await winwatch.paste(); await wait(350);
    restore(saved);
    toUI('fixed', { changes: countChanges(sel, fixed), mode });
  } catch (e){ log('fix failed:', e.message); restore(saved); toUI('say', { text: friendlyError(e), mood: 'confused' }); }
  finally { fixing = false; }
}
function restore(s){ try { if (s.html) clipboard.write({ text: s.text, html: s.html }); else if (s.text) clipboard.writeText(s.text); else if (!s.image.isEmpty()) clipboard.writeImage(s.image); else clipboard.clear(); } catch (_) {} }
export function countChanges(a, b){ const A = a.split(/\s+/), B = new Set(b.split(/\s+/)); return Math.max(1, A.filter(w => w && !B.has(w)).length); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- hotkeys ----------
function registerHotkeys(){
  const keys = {
    'Control+Alt+F': () => fixSelection('fix'),
    'Control+Alt+I': () => fixSelection('improve'),
    'Control+Alt+Space': () => { wakeUp(false); toUI('listen-toggle'); },
    'Control+Alt+M': () => { wakeUp(false); toUI('listen-toggle'); },   // same, in case another app owns Ctrl+Alt+Space
    'Control+Alt+T': () => { wakeUp(false); win.focus(); toUI('type'); },
    'Control+Alt+H': () => setHandsFree(!handsfree),
    'Control+Alt+Q': () => setQuiet(!quiet),
    'Control+Alt+P': () => setOffRecord(!timeline.paused()),
    'Control+Alt+B': () => toggleHide(),
    'Control+Alt+=': () => setScale(scale * 1.15),
    'Control+Alt+-': () => setScale(scale / 1.15),
  };
  const failed = Object.entries(keys).filter(([k, f]) => !globalShortcut.register(k, f)).map(([k]) => k);
  if (failed.length) log('hotkeys already used by another app:', failed.join(', '));
}
function setHandsFree(v){ handsfree = v; toUI('handsfree', v); }
ipcMain.on('handsfree-set', (e, v) => { handsfree = !!v; });
let hiddenAt = 0;
function toggleHide(){ if (win.isVisible()) { win.hide(); hiddenAt = Date.now(); } else { win.showInactive(); if (Date.now() - hiddenAt > 3000) toUI('peekaboo'); } }
function setQuiet(v){ quiet = v; toUI('info', info()); toUI('say', { text: v ? 'Quiet mode: I\'ll only pop up for meetings and reminders. Shh!' : 'I\'m back to chatty mode!', mood: v ? 'calm' : 'happy', silent: true }); }
function setOffRecord(v){ timeline.pause(v); toUI('info', info()); toUI('say', { text: v ? 'Off the record! I\'m not noting which windows you use.' : 'Okay, I\'m keeping track again so I can tell you where you left off.', mood: v ? 'calm' : 'happy', action: v ? 'wink' : 'nod', silent: true }); }

// ---------- right-click menu ----------
const cmd = (type, arg) => () => toUI('cmd', { type, arg });
ipcMain.on('menu', (e, pet = {}) => {
  const pend = reminders.pending().slice(0, 6);
  const wardrobe = (pet.unlocked || []).map(a => ({ label: a.label, type: 'radio', checked: pet.wearing === a.id, click: cmd('wear', a.id) }));
  const colors = (pet.colors || []).map(c => ({ label: c.label, type: 'radio', checked: pet.color === c.id, click: cmd('color', c.id) }));
  Menu.buildFromTemplate([
    { label: '🎤 Talk  (Ctrl+Alt+M)', click: () => toUI('listen-toggle') },
    { label: '⌨️ Type to me  (Ctrl+Alt+T)', click: () => { win.focus(); toUI('type'); } },
    { type: 'separator' },
    { label: '🍪 Feed', submenu: [['🍪 Cookie', 'cookie'], ['🍎 Apple', 'apple'], ['🍜 Noodles', 'noodles'], ['☕ Coffee (energy!)', 'coffee'], ['🧋 Boba (party!)', 'boba']].map(([l, id]) => ({ label: l, click: cmd('feed', id) })) },
    { label: '🎵 Music', submenu: [['📻 Lofi radio', 'radio|lofi'], ['📻 Jazz radio', 'radio|jazz'], ['📻 Indonesian pop radio', 'radio|indonesia pop'], ['📻 Chill radio', 'radio|chillout']].map(([l, c]) => ({ label: l, click: () => musicCommand(c) }))
      .concat([{ type: 'separator' }, { label: '⏯ Pause / play', enabled: !!musicWin, click: () => musicCommand('toggle') }, { label: '⏭ Next', enabled: !!musicWin, click: () => musicCommand('next') }, { label: '⏹ Stop music', enabled: !!musicWin, click: () => musicCommand('stop') }, { type: 'separator' }, { label: 'Tip: say "play <song>" or "jazz radio"', enabled: false }]) },
    { label: '🕹️ Arcade (you vs me!)', submenu: [{ label: '🫧 Bubble Pop Battle', click: () => openArcade('bubbles') }, { label: '🚀 Space Duel', click: () => openArcade('space') }, { label: '🥊 Desk Brawl', click: () => openArcade('brawl') }] },
    { label: '🎮 Play', submenu: [['✊ Rock paper scissors', 'rps'], ['🔢 Guess the number', 'guess'], ['❓ Quick quiz', 'quiz'], ['🤔 Would you rather', 'wyr'], ['🙌 High five', 'highfive'], ['💃 Dance', 'dance']].map(([l, id]) => ({ label: l, click: cmd('play', id) })) },
    { label: '🎯 Focus timer', submenu: [...[15, 25, 45, 60].map(m => ({ label: `${m} minutes`, click: cmd('focus', m) })), { type: 'separator' }, { label: 'Stop focus', enabled: !!pet.focusing, click: cmd('focus', 0) }] },
    { label: `📊 My stats  (Lv ${pet.level || 1})`, click: cmd('stats') },
    { label: '👒 Wardrobe', submenu: [{ label: 'Nothing', type: 'radio', checked: !pet.wearing, click: cmd('wear', null) }, ...wardrobe, ...(colors.length ? [{ type: 'separator' }, { label: 'Headset colour', enabled: false }, ...colors] : []), { type: 'separator' }, { label: pet.nextUnlock || 'Keep caring for me to unlock more!', enabled: false }] },
    { label: '📏 Size', submenu: [...Object.entries(SIZES).map(([l, k]) => ({ label: l, type: 'radio', checked: Math.abs(scale - k) < .04, click: () => setScale(k) })), { type: 'separator' }, { label: 'Tip: Ctrl + mouse wheel on me', enabled: false }] },
    { label: '💬 Chattiness', submenu: [...Object.entries(CHATTY).map(([k, l]) => ({ label: l, type: 'radio', checked: (settings.chattiness || 'normal') === k, click: () => setChattiness(k) })),
      { type: 'separator' }, { label: '✨ Say something now!', click: () => initiative.tick({ idle: 30, win: current, force: ['fun', 'followup', 'stuck'][Math.floor(Math.random() * (profile.facts.length ? 2 : 1))] }) }] },
    { label: '💤 Doze when there\'s nothing to do', type: 'checkbox', checked: settings.doze !== false, click: () => { settings.doze = settings.doze === false; writeJson('settings', settings); } },
    { label: '💭 Dreams while sleeping', type: 'checkbox', checked: settings.dreams !== false, click: () => { settings.dreams = settings.dreams === false; writeJson('settings', settings); toUI('info', info()); } },
    { label: '📢 Announcement voice…', click: () => openVoicePicker() },
    { label: '🔊 Sound effects', type: 'checkbox', checked: settings.sounds !== false, click: () => { settings.sounds = settings.sounds === false; writeJson('settings', settings); toUI('info', info()); } },
    { type: 'separator' },
    { label: google.connected() ? '✅ Google connected — disconnect' : '🔗 Connect Google Calendar + Drive', click: () => google.connected() ? (google.disconnect(), toUI('info', info())) : connectGoogle() },
    { label: '⏰ Reminders', submenu: pend.length ? pend.map(r => ({ label: `${fmtTime(new Date(r.at))} — ${r.text.slice(0, 40)}`, submenu: [{ label: 'Done / delete', click: () => reminders.done(r.id) }] })) : [{ label: 'No reminders yet — just ask me!', enabled: false }] },
    { type: 'separator' },
    { label: '👂 Hands-free: "Hey ' + (mindName || 'Buddy') + '"  (Ctrl+Alt+H)', type: 'checkbox', checked: handsfree, click: () => setHandsFree(!handsfree) },
    { label: '🤫 Quiet mode  (Ctrl+Alt+Q)', type: 'checkbox', checked: quiet, click: () => setQuiet(!quiet) },
    { label: '🙈 Off the record  (Ctrl+Alt+P)', type: 'checkbox', checked: timeline.paused(), click: () => setOffRecord(!timeline.paused()) },
    { label: '🧽 Forget my activity timeline', click: () => { timeline.clear(); toUI('say', { text: 'Poof! Timeline forgotten.', mood: 'happy', action: 'spin', silent: true }); } },
    { label: `🧠 Forget what I remember about you (${profile.facts.length})`, enabled: profile.facts.length > 0, click: () => { profile.facts = []; writeJson('profile', profile); toUI('say', { text: 'Memory wiped! Who are you again? Kidding. Mostly.', mood: 'confused', action: 'spin', silent: true }); } },
    { label: sleeping ? '☀️ Wake up' : '😴 Nap now', click: () => sleeping ? wakeUp(false) : goSleep(Date.now(), true) },
    { label: '🚀 Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings({ path: process.execPath, args: [DIR] }).openAtLogin,
      click: m => app.setLoginItemSettings({ openAtLogin: m.checked, path: process.execPath, args: [DIR] }) },
    { label: '🙈 Hide  (Ctrl+Alt+B)', click: () => toggleHide() },
    { type: 'separator' },
    { label: '❓ Hotkeys', click: () => toUI('help') },
    { label: '📄 Open log file', click: () => shell.openPath(LOGFILE) },
    { label: '👋 Quit', click: () => app.quit() },
  ]).popup({ window: win });
});
async function connectGoogle(){
  if (!google.configured()) return toUI('say', { text: 'First add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the .env file. The README shows how!', mood: 'curious', action: 'think' });
  toUI('say', { text: 'Opening Google sign-in in your browser…', mood: 'excited', silent: true });
  try { await google.connect(url => shell.openExternal(url)); toUI('info', info()); toUI('say', { text: 'Yay, I can see your calendar and Drive now! Try asking: what\'s on today?', mood: 'excited', action: 'cheer' }); meetingCheck(); }
  catch (e){ toUI('say', { text: 'Google sign-in didn\'t work: ' + e.message.slice(0, 80), mood: 'confused' }); }
}
ipcMain.on('open', (e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('drop-file', async (e, file) => {
  if (!google.connected()) return { text: 'Connect Google first (right-click me) and I\'ll keep files in your Drive.', mood: 'curious' };
  if (!(await confirmAsk(`Upload "${path.basename(file)}" to your Drive (Minds Buddy folder)?`))) return { text: 'Okay, not uploading it.', mood: 'calm' };
  try { await google.uploadFile(file); return { text: 'Stored it in your Drive, in the Minds Buddy folder!', mood: 'proud', action: 'cheer' }; }
  catch (err){ return { text: 'Upload failed: ' + err.message.slice(0, 80), mood: 'worried' }; }
});

// ---------- music: YouTube + internet radio, projected with synced lyrics ----------
// The music page is served from 127.0.0.1 (only this PC can reach it) because YouTube's embedded player needs a real web origin.
const music = createMusic({ youtubeKey: E.YOUTUBE_API_KEY, log });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
let pagePort = null;
const allowedStreams = new Set();   // only streams the radio search returned can be relayed
const pageServer = http.createServer((req, res) => {
  if (req.url.startsWith('/radio?')) { const s = new URL(req.url, 'http://127.0.0.1').searchParams.get('u');
    if (!s || !allowedStreams.has(s)) { res.writeHead(403); return res.end(); } return relayStream(s, res, { log }); }
  const u = new URL(req.url, 'http://127.0.0.1'), f = path.normalize(path.join(DIR, 'renderer', decodeURIComponent(u.pathname)));
  if (!f.startsWith(path.join(DIR, 'renderer')) || !/^\/(music\.html|music\.js)$/.test(u.pathname)) { res.writeHead(404); return res.end(); }
  try { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(readFileSync(f)); } catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1', () => { pagePort = pageServer.address().port; });
let musicWin = null, musicQueue = [];
function openMusic(cmd){
  if (musicWin && !musicWin.isDestroyed()) { musicWin.showInactive(); if (cmd) musicWin.webContents.send('music-cmd', cmd); return; }
  if (!pagePort) { setTimeout(() => openMusic(cmd), 200); return; }
  const b = win.getBounds(), d = screen.getDisplayMatching(b).workArea, w = 640, h = 420;
  const x = Math.max(d.x + 8, Math.min(d.x + d.width - w - 8, b.x + b.width / 2 - w - 10)), y = Math.max(d.y + 8, Math.min(d.y + d.height - h - 8, b.y + b.height - h - 20));
  musicWin = new BrowserWindow({ width: w, height: h, x: Math.round(x), y: Math.round(y), frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: false, show: false, title: 'Buddy Music',
    webPreferences: { preload: path.join(DIR, 'music-preload.cjs'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' } });
  musicWin.loadURL(`http://127.0.0.1:${pagePort}/music.html`);
  musicWin.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  musicWin.once('ready-to-show', () => musicWin.showInactive());
  musicWin.webContents.once('did-finish-load', () => { if (cmd) musicWin.webContents.send('music-cmd', cmd); });
  musicWin.on('closed', () => { musicWin = null; uiStatus.music = false; toUI('music', { playing: false, closed: true }); });
}
function musicCommand(raw){                                   // "[music:play|Tulus Hati-Hati di Jalan]", "[music:radio|jazz]", "[music:stop]" …
  const [op, ...rest] = String(raw || '').split('|'), arg = rest.join('|').trim(), o = op.trim().toLowerCase();
  if (o === 'play' || o === 'youtube' || o === 'yt') return openMusic({ op: 'yt', arg });
  if (o === 'radio') return openMusic({ op: 'radio', arg: arg || 'pop' });
  if (['pause', 'resume', 'next', 'prev', 'stop', 'toggle', 'volume', 'duck', 'unduck', 'mute'].includes(o) && musicWin) return musicWin.webContents.send('music-cmd', { op: o, arg });
}
ipcMain.handle('music-youtube', async (e, q) => { try { return { items: await music.youtube(q) }; } catch (err) { log('youtube:', err.message); return { error: err.message }; } });
ipcMain.handle('music-lyrics', async (e, m) => { try { return await music.lyrics(m); } catch (err) { log('lyrics:', err.message); return null; } });
ipcMain.handle('music-radio', async (e, q) => { try { const items = await music.radio(q); items.forEach(s => allowedStreams.add(s.url)); return { items }; } catch (err) { log('radio:', err.message); return { error: err.message }; } });
ipcMain.on('music-state', (e, st) => { uiStatus.music = !!st.playing; toUI('music', st); if (st.playing) log('♪', st.kind, st.title || ''); });
ipcMain.on('music-close', () => musicWin?.close());
ipcMain.on('music-log', (e, m) => log('music:', String(m).slice(0, 300)));
ipcMain.on('music', (e, cmd) => cmd?.op === 'raw' ? musicCommand(cmd.arg) : cmd?.op && ['yt', 'radio'].includes(cmd.op) ? openMusic(cmd) : musicCommand(cmd?.op));
app.on('will-quit', () => { try { pageServer.close(); } catch (_) {} });

// ---------- arcade: the buddy projects a game window ----------
let arcade = null;
// ---------- announcement voice picker ----------
let picker = null;
function openVoicePicker(){
  if (picker && !picker.isDestroyed()) { picker.show(); picker.focus(); return; }
  picker = new BrowserWindow({ width: 460, height: 640, title: 'Announcement voice', autoHideMenuBar: true, backgroundColor: '#0a1328', alwaysOnTop: true,
    webPreferences: { preload: path.join(DIR, 'picker-preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  picker.loadFile(path.join(DIR, 'renderer', 'voice-picker.html'));
  picker.on('closed', () => { picker = null; });
}
ipcMain.handle('announce-get', () => settings.announce || null);
ipcMain.on('announce-set', (e, c) => {
  const ok = v => String(v || '').slice(0, 120);
  settings.announce = { voice: ok(c?.voice), style: ok(c?.style) || 'mall', chime: ok(c?.chime) || 'mall', opener: c?.opener !== false, picked: true };
  writeJson('settings', settings); toUI('announce', settings.announce); log('announcement voice:', settings.announce.voice, settings.announce.style, settings.announce.chime);
});
ipcMain.on('picker-close', () => picker?.close());

function openArcade(name){
  if (arcade && !arcade.isDestroyed()) { arcade.show(); arcade.focus(); if (name) arcade.webContents.send('arcade-game', name); return; }
  const d = screen.getDisplayMatching(win.getBounds()).workArea, w = 760, h = 540;
  arcade = new BrowserWindow({ width: w, height: h, x: Math.round(d.x + (d.width - w) / 2), y: Math.round(d.y + (d.height - h) / 2), frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: false, show: false, title: 'Buddy Arcade', webPreferences: { preload: path.join(DIR, 'arcade-preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  const bb = win.getBounds(), bx = (bb.x + bb.width / 2 - (d.x + d.width / 2)) / (w / 2), by = (bb.y + bb.height / 2 - (d.y + d.height / 2)) / (h / 2);   // beam comes from the buddy's side
  arcade.loadFile(path.join(DIR, 'renderer', 'arcade.html'), { query: { ...(name ? { game: name } : {}), bx: String(Math.max(-1, Math.min(1, bx)).toFixed(2)), by: String(Math.max(-1, Math.min(1, by)).toFixed(2)) } });
  arcade.once('ready-to-show', () => { arcade.show(); arcade.focus(); });
  arcade.on('closed', () => { arcade = null; uiStatus.game = false; toUI('arcade', { type: 'closed' }); });
  uiStatus.game = true; toUI('arcade', { type: 'open', game: name });
}
ipcMain.on('arcade-close', () => arcade?.close());
ipcMain.on('arcade-event', (e, ev) => toUI('arcade', ev));
ipcMain.on('arcade-result', (e, r) => { log('arcade:', r.game, r.won ? 'you won' : r.tie ? 'tie' : 'buddy won', r.score); toUI('arcade', { type: 'result', ...r }); });
ipcMain.on('open-arcade', (e, name) => openArcade(name));

// ---------- initiative: it starts conversations at natural pauses ----------
const uiStatus = { busy: false, focus: false, inCall: false, touched: Date.now(), hidden: false, game: false, music: false };
ipcMain.on('status', (e, st) => Object.assign(uiStatus, st));
ipcMain.on('initiative-feedback', (e, v) => initiative.feedback(v));
const CHATTY = { quiet: '🤐 Quiet (only when asked)', normal: '🙂 Normal (every ~40 min)', chatty: '🤩 Chatty (every ~20 min)' };
const initiative = createInitiative({
  level: () => settings.chattiness || 'normal',
  flags: () => (settings.initiative ||= {}), saveFlags: () => writeJson('settings', settings),
  blocked: () => !alive() || (sleeping && !dozing) || quiet || !win.isVisible() || uiStatus.busy || uiStatus.focus || uiStatus.inCall || uiStatus.game || uiStatus.music || fixing,
  lastTouchAgo: () => Date.now() - (uiStatus.touched || 0),
  timeline, google, reminders, facts: () => profile.facts, log,
  speak: async (kind, ctx) => {
    if (sleeping && dozing) { await wakeUp(false); await wait(1200); }   // *yawn*… oh! I just thought of something
    toUI('thinking');
    const r = await brain.proactive(kind, ctx);
    if (r?.text) { log('buddy (initiative):', r.text.slice(0, 100)); toUI('say', { text: r.text, mood: r.mood || 'happy', action: r.action || 'wave', scene: r.scene, show: r.show, fx: r.fx, choices: r.choices, proactive: kind }); }
    else toUI('thinking-done');
    return r;
  },
});
function setChattiness(v){ settings.chattiness = v; writeJson('settings', settings); toUI('say', { text: { quiet: 'Okay, I\'ll zip it unless you need me. 🤐', normal: 'Normal chat mode! I\'ll pop in now and then.', chatty: 'Chatty mode! You won\'t get rid of me now. 😄' }[v], mood: 'happy', action: 'wink', silent: true }); }

// ---------- sleep / wake / welcome back ----------
let sleeping = false, sleptAt = 0, focusSince = Date.now(), lastStretch = Date.now();
let manualNap = false, dozing = false;   // dozing = it nodded off because nothing was happening, while you're still working   // "Nap now": stays asleep until you poke it, talk to it or an alert comes (the click itself must not wake it)
function goSleep(at, manual = false, doze = false){ if (sleeping) return; sleeping = true; manualNap = manual || doze; dozing = doze; sleptAt = at; toUI('sleep', { doze }); log(doze ? 'dozing (nothing to do)' : manual ? 'napping (you asked)' : 'napping'); }
async function wakeUp(welcome = true){
  if (!sleeping) return; sleeping = false; manualNap = false; dozing = false; uiStatus.touched = Date.now();
  const away = (Date.now() - sleptAt) / 60000; focusSince = Date.now(); lastStretch = Date.now();
  toUI('wake'); log(`awake after ${away.toFixed(1)} min`);
  if (!welcome || away < IDLE_MIN) return;
  const recent = timeline.summary(sleptAt - 3 * 3600_000, sleptAt);
  let upcoming = '';
  if (google.connected()) { try { upcoming = google.formatEvents(await google.upcoming(240), 'next 4 hours'); } catch (_) {} }
  const due = reminders.soon(2 * 3600_000).map(r => `- ${fmtTime(new Date(r.at))}: ${r.text}`).join('\n');
  toUI('thinking');
  let r = null;
  try { r = await brain.welcomeBack({ awayMinutes: away, recent, upcoming, dueReminders: due }); } catch (e){ log('welcome failed:', e.message); }
  const last = timeline.summary(sleptAt - 3600_000, sleptAt, 1).replace(/^- /, '').replace(/ \(.*$/, '');
  toUI('say', r?.text ? { text: r.text, mood: r.mood || 'happy', action: r.action || 'wave', welcome: { recent } }
    : { text: `Welcome back! ${last ? 'You were in ' + last + '.' : 'Ready when you are!'}`, mood: 'happy', action: 'wave', welcome: { recent } });
}
powerMonitor.on('lock-screen', () => goSleep(Date.now()));
powerMonitor.on('suspend', () => goSleep(Date.now()));
powerMonitor.on('unlock-screen', () => wakeUp(true));
ipcMain.on('wake-me', () => wakeUp(false));

async function tick(){
  const idle = powerMonitor.getSystemIdleTime();
  if (!sleeping && idle >= IDLE_MIN * 60) goSleep(Date.now() - idle * 1000);
  else if (sleeping && manualNap && idle >= IDLE_MIN * 60) { manualNap = false; if (dozing) { dozing = false; sleptAt = Date.now() - idle * 1000; } }   // you really went away: wake normally (with a welcome back) when you return
  else if (!sleeping && DOZE_MIN > 0 && settings.doze !== false && idle < 60 && Date.now() - (uiStatus.touched || 0) > DOZE_MIN * 60_000 &&
    !uiStatus.busy && !uiStatus.game && !uiStatus.inCall && !fixing && Date.now() - lastSaid > DOZE_MIN * 60_000) goSleep(Date.now(), false, true);
  else if (sleeping && !manualNap && idle < 3 && powerMonitor.getSystemIdleState(60) === 'active') wakeUp(true);
  if (!sleeping){
    const w = await winwatch.win();
    if (w?.title) { const changed = !current || current.app !== w.app || current.title !== w.title; current = w; timeline.record(w);
      if (changed && !timeline.paused()) toUI('activity', { app: w.app, title: w.title.slice(0, 160), activeMin: Math.round((Date.now() - focusSince) / 60000) }); }
    // fun nudge after a long focus stretch (not in quiet mode)
    if (!quiet && Date.now() - lastStretch > 100 * 60_000 && idle < 60){ lastStretch = Date.now();
      toUI('say', { text: ['You\'ve been at it for over an hour and a half! Stretch break? I\'ll stretch with you.', 'Hydration check! When did you last drink some water?', 'Shoulders down, deep breath… okay, back to being awesome.'][Math.floor(Math.random() * 3)], mood: 'happy', action: 'dance' }); }
    initiative.tick({ idle, win: timeline.paused() ? null : current }).catch(e => log('initiative tick failed:', e.message));
  }
  for (const r of reminders.due()){
    reminders.done(r.id); if (sleeping) { sleeping = false; manualNap = false; dozing = false; uiStatus.touched = Date.now(); toUI('wake'); }
    toUI('alert', { kind: 'reminder', id: r.id, text: r.text, say: `Hey! Reminder: ${r.text}` });
  }
}
ipcMain.on('snooze', (e, { id, minutes }) => reminders.snooze(id, minutes * 60_000));

// ---------- meeting alerts ----------
const alerted = new Set();
async function meetingCheck(){
  if (!google.connected()) return;
  try {
    const list = await google.upcoming(ALERT_MIN + 1);
    for (const ev of list){
      if (ev.allDay) continue;
      const mins = (ev.start - Date.now()) / 60000, k1 = ev.id + ev.start.getTime(), k2 = k1 + ':1';
      const who = ev.attendees.length ? ` with ${ev.attendees.slice(0, 3).join(', ')}${ev.attendees.length > 3 ? ' and others' : ''}` : '';
      if (mins <= 1.5 && mins > -2 && !alerted.has(k2)){ alerted.add(k2); alerted.add(k1);
        if (sleeping) { sleeping = false; manualNap = false; dozing = false; uiStatus.touched = Date.now(); toUI('wake'); }
        toUI('alert', { kind: 'meeting', text: ev.title, join: ev.join, link: ev.link, say: `${ev.title} is starting now! Go go go!`, mood: 'excited', startingNow: true, endsAt: ev.end ? ev.end.getTime() : null }); }
      else if (mins <= ALERT_MIN && mins > 1.5 && !alerted.has(k1)){ alerted.add(k1);
        if (sleeping) { sleeping = false; manualNap = false; dozing = false; uiStatus.touched = Date.now(); toUI('wake'); }
        toUI('alert', { kind: 'meeting', text: ev.title, join: ev.join, link: ev.link, say: `Heads up! ${ev.title} in ${Math.round(mins)} minutes${who}.` }); }
    }
  } catch (e){ log('calendar check failed:', e.message); if (/expired/.test(e.message)) toUI('say', { text: 'My Google sign-in expired. Right-click me to connect again.', mood: 'worried', silent: true }); }
}
