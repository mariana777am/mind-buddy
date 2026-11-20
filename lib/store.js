// Local memory: the activity timeline ("what was I doing?") and reminders. Plain JSON files in the
// app's own folder (%APPDATA%\minds-buddy). Nothing here leaves your PC unless the buddy summarises it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function jsonFile(file, fallback){
  let data; try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { data = fallback; }
  let t = null;
  const save = () => { clearTimeout(t); t = setTimeout(() => { try { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data)); } catch (_) {} }, 300); };
  return { get: () => data, set: d => { data = d; save(); }, save };
}

const list = s => String(s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

export function createTimeline(dir, { days = 3, ignoreApps = '', ignoreTitles = '' } = {}){
  const f = jsonFile(path.join(dir, 'timeline.json'), []);
  const apps = list(ignoreApps || 'keepass,keepassxc,1password,bitwarden,lastpass,dashlane,credentialuibroker');
  const titles = [...list('bank,banking,inprivate,incognito,password,private browsing,sign in,sign-in,signin,sign up,log in,login,log-in,logon,masuk,' +
    'verify,verification,verifikasi,otp,2fa,two-factor,2-step,authenticat,one-time,security code,kode verifikasi,kode otp,reset password,password reset,credential,seed phrase,pin code,enter pin,masukkan pin'), ...list(ignoreTitles)];
  let paused = false;
  const skip = w => !w || !w.title || apps.some(a => (w.app || '').toLowerCase().includes(a)) || titles.some(t => w.title.toLowerCase().includes(t)) || /minds-buddy|electron/i.test(w.app || '');
  function record(w, at = Date.now()){
    if (paused || skip(w)) return;
    const rows = f.get(), last = rows.at(-1);
    if (last && last.app === w.app && last.title === w.title && at - last.end < 90_000) last.end = at;
    else rows.push({ app: w.app, title: w.title.slice(0, 160), start: at, end: at });
    const cutoff = at - days * 864e5;
    while (rows.length && rows[0].end < cutoff) rows.shift();
    f.set(rows);
  }
  // A short, readable summary of what happened between two times (longest first, then most recent last).
  function summary(from, to = Date.now(), max = 8){
    const rows = f.get().filter(r => r.end >= from && r.start <= to);
    const by = new Map();
    for (const r of rows){ const k = r.app + '|' + r.title; const e = by.get(k) || { app: r.app, title: r.title, ms: 0, last: 0 }; e.ms += Math.max(30_000, r.end - r.start); e.last = Math.max(e.last, r.end); by.set(k, e); }
    const top = [...by.values()].sort((a, b) => b.ms - a.ms).slice(0, max).sort((a, b) => a.last - b.last);
    return top.map(e => `- ${e.app}: "${e.title}" (${Math.round(e.ms / 60000)} min, last at ${new Date(e.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`).join('\n');
  }
  return { record, summary, pause: v => { paused = v; }, paused: () => paused, clear: () => f.set([]), rows: () => f.get() };
}

export function createReminders(dir){
  const f = jsonFile(path.join(dir, 'reminders.json'), []);
  return {
    add(at, text){ const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: at.getTime(), text, done: false }; f.get().push(r); f.save(); return r; },
    due(now = Date.now()){ return f.get().filter(r => !r.done && r.at <= now); },
    soon(ms, now = Date.now()){ return f.get().filter(r => !r.done && r.at > now && r.at <= now + ms); },
    done(id){ const r = f.get().find(x => x.id === id); if (r) { r.done = true; f.save(); } },
    snooze(id, ms){ const r = f.get().find(x => x.id === id); if (r) { r.at = Date.now() + ms; r.done = false; f.save(); } },
    pending(){ return f.get().filter(r => !r.done).sort((a, b) => a.at - b.at); },
    prune(){ f.set(f.get().filter(r => !r.done || r.at > Date.now() - 864e5)); },
  };
}
