// Google Calendar + Drive with plain fetch (no extra packages).
// Sign-in: OAuth "Desktop app" client, loopback redirect on 127.0.0.1 + PKCE. Tokens are stored
// encrypted (Electron safeStorage → Windows DPAPI) through the save/load functions passed in.
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',   // read events, add events you confirm
  'https://www.googleapis.com/auth/drive.readonly',    // search + read your files
  'https://www.googleapis.com/auth/drive.file',        // create notes / uploads (only files this app makes)
];
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createGoogle({ clientId, clientSecret, saveTokens, loadTokens, fetchImpl = fetch, log = () => {} }){
  let tok = null; try { tok = loadTokens(); } catch (_) {}
  const configured = () => !!(clientId && clientSecret);
  const connected = () => !!(configured() && tok?.refresh_token);

  async function connect(openUrl){
    if (!configured()) throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first (see README)');
    const verifier = b64url(crypto.randomBytes(32)), challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));
    const { code, redirect } = await new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/') { res.end(); return; }
        const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<body style="font-family:system-ui;background:#0e1430;color:#fff;display:grid;place-items:center;height:90vh"><h2>${ok ? '🎧 Connected! You can close this tab.' : '😕 Sign-in was cancelled.'}</h2></body>`);
        srv.close(); clearTimeout(timer);
        ok ? resolve({ code: u.searchParams.get('code'), redirect: `http://127.0.0.1:${srv.address()?.port || port}` }) : reject(new Error(u.searchParams.get('error') || 'cancelled'));
      });
      let port; const timer = setTimeout(() => { srv.close(); reject(new Error('sign-in timed out')); }, 5 * 60_000);
      srv.listen(0, '127.0.0.1', () => {
        port = srv.address().port;
        const p = new URLSearchParams({ client_id: clientId, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: SCOPES.join(' '),
          code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state });
        openUrl('https://accounts.google.com/o/oauth2/v2/auth?' + p);
      });
    });
    const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'token exchange failed');
    tok = { ...j, expires_at: Date.now() + (j.expires_in - 60) * 1000 }; saveTokens(tok);
  }
  function disconnect(){ tok = null; saveTokens(null); }

  async function token(){
    if (!connected()) throw new Error('Google is not connected');
    if (tok.access_token && Date.now() < tok.expires_at) return tok.access_token;
    const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: tok.refresh_token, grant_type: 'refresh_token' }) });
    const j = await r.json();
    if (!r.ok){ if (j.error === 'invalid_grant') { disconnect(); throw new Error('Google sign-in expired, please connect again'); } throw new Error(j.error_description || j.error); }
    tok = { ...tok, ...j, expires_at: Date.now() + (j.expires_in - 60) * 1000 }; saveTokens(tok);
    return tok.access_token;
  }
  async function api(url, opts = {}){
    const r = await fetchImpl(url, { ...opts, headers: { authorization: 'Bearer ' + await token(), ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`);
    return opts.raw ? r : r.json();
  }

  // ---------- Calendar ----------
  function range(spec, now = new Date()){
    const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const s = String(spec || 'today').toLowerCase().trim();
    if (s === 'tomorrow') return [add(day(now), 1), add(day(now), 2)];
    if (s === 'week') return [day(now), add(day(now), 7)];
    if (s === 'next') return [now, add(day(now), 2)];
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return [d, add(d, 1)]; }
    return [day(now), add(day(now), 1)];
  }
  async function eventsBetween(a, b){
    const p = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: a.toISOString(), timeMax: b.toISOString(), maxResults: '50' });
    const j = await api('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + p);
    return (j.items || []).filter(e => e.status !== 'cancelled' && !(e.attendees || []).some(x => x.self && x.responseStatus === 'declined')).map(slim);
  }
  const events = spec => { const [a, b] = range(spec); return eventsBetween(a, b); };
  const upcoming = minutes => eventsBetween(new Date(), new Date(Date.now() + minutes * 60_000));
  function slim(e){
    const start = e.start?.dateTime ? new Date(e.start.dateTime) : e.start?.date ? new Date(e.start.date + 'T00:00') : null;
    return { id: e.id, title: e.summary || '(no title)', start, end: e.end?.dateTime ? new Date(e.end.dateTime) : null, allDay: !e.start?.dateTime,
      attendees: (e.attendees || []).filter(a => !a.self && !a.resource).map(a => a.displayName || a.email).slice(0, 12),
      description: String(e.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600),
      files: (e.attachments || []).map(a => ({ id: a.fileId, name: a.title })), join: joinLink(e), link: e.htmlLink };
  }
  function formatEvents(list, label){
    if (!list.length) return `Calendar (${label}): no events.`;
    return `Calendar (${label}):\n` + list.map(e => `- ${e.allDay ? 'all day' : e.start.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}: ${e.title}` +
      (e.attendees.length ? ` | with ${e.attendees.join(', ')}` : '') + (e.join ? ' | has video link' : '') +
      (e.files.length ? ` | attached files: ${e.files.map(f => `${f.name} (id ${f.id})`).join(', ')}` : '') + (e.description ? ` | notes: ${e.description}` : '')).join('\n');
  }
  async function createEvent(title, start, minutes){
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone, end = new Date(start.getTime() + minutes * 60_000);
    const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
    return api('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: title, start: { dateTime: local(start), timeZone: tz }, end: { dateTime: local(end), timeZone: tz } }) });
  }

  // ---------- Drive ----------
  async function search(words){
    const w = String(words || '').replace(/['\\]/g, ' ').trim(); if (!w) return [];
    const q = `(name contains '${w}' or fullText contains '${w}') and trashed = false`;
    const p = new URLSearchParams({ q, pageSize: '10', fields: 'files(id,name,mimeType,modifiedTime,webViewLink)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
    const j = await api('https://www.googleapis.com/drive/v3/files?' + p);
    return (j.files || []).sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime));
  }
  const kind = m => m.includes('document') ? 'Doc' : m.includes('spreadsheet') ? 'Sheet' : m.includes('presentation') ? 'Slides' : m.includes('pdf') ? 'PDF' : m.includes('folder') ? 'Folder' : 'File';
  function formatFiles(list, words){
    if (!list.length) return `Drive search "${words}": nothing found.`;
    return `Drive search "${words}":\n` + list.map(f => `- ${f.name} (${kind(f.mimeType)}, edited ${new Date(f.modifiedTime).toLocaleDateString()}, id ${f.id})`).join('\n');
  }
  async function readText(id){
    id = String(id || '').trim();
    const f = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`);
    const exp = { 'application/vnd.google-apps.document': 'text/plain', 'application/vnd.google-apps.presentation': 'text/plain', 'application/vnd.google-apps.spreadsheet': 'text/csv' }[f.mimeType];
    let text;
    if (exp) text = await (await api(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exp)}`, { raw: true })).text();
    else if (/^text\/|json|xml|csv|markdown/.test(f.mimeType)) text = await (await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { raw: true })).text();
    else return `File "${f.name}" (${kind(f.mimeType)}): I can't read this type yet (Docs, Sheets, Slides and text files work). Tell the user to open it.`;
    return `File "${f.name}" (${kind(f.mimeType)}):\n` + text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').slice(0, 15000);
  }
  let folderId = null;
  async function folder(){
    if (folderId) return folderId;
    const p = new URLSearchParams({ q: "name = 'Minds Buddy' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", fields: 'files(id)' });
    const j = await api('https://www.googleapis.com/drive/v3/files?' + p);
    if (j.files?.[0]) return (folderId = j.files[0].id);
    const c = await api('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Minds Buddy', mimeType: 'application/vnd.google-apps.folder' }) });
    return (folderId = c.id);
  }
  async function upload(meta, body, contentType){
    const boundary = 'buddy' + crypto.randomBytes(8).toString('hex');
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\ncontent-type: ${contentType}\r\n\r\n`),
      Buffer.isBuffer(body) ? body : Buffer.from(body), Buffer.from(`\r\n--${boundary}--`)]);
    return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body: payload });
  }
  const saveNote = async (title, text) => upload({ name: title, mimeType: 'application/vnd.google-apps.document', parents: [await folder()] }, text, 'text/plain; charset=UTF-8');
  const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  async function uploadFile(file){
    const buf = await readFile(file);
    if (buf.length > 25 * 1024 * 1024) throw new Error('file is over 25 MB');
    return upload({ name: path.basename(file), parents: [await folder()] }, buf, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  }

  return { configured, connected, connect, disconnect, events, upcoming, formatEvents, createEvent, search, formatFiles, readText, saveNote, uploadFile, _range: range };
}

export function joinLink(e){
  if (e.hangoutLink) return e.hangoutLink;
  const ep = (e.conferenceData?.entryPoints || []).find(x => x.entryPointType === 'video'); if (ep?.uri) return ep.uri;
  const m = `${e.location || ''} ${e.description || ''}`.match(/https:\/\/[^\s"<>]*(zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|webex\.com)[^\s"<>]*/i);
  return m ? m[0] : null;
}
