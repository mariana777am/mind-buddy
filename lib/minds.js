// Your Mind as the buddy's brain. Same official library and approach as Puppy v2 / trio-chat:
// send, then race the library's waitForReply event against a history poll.
const E = process.env;
export const provider = () => (E.PROVIDER || (E.MINDS_BUILDER_API_KEY ? 'minds' : 'mock')).toLowerCase();
const MIND_REF = () => (E.MIND_ID || '').trim();
const TIMEOUT = () => Number(E.MINDS_TIMEOUT_MS || 150000);   // look-ups (weather, web) can take a while
let lateHandler = null;
export function onLateReply(fn){ lateHandler = fn; }   // answers that arrive after the time limit are still delivered

let clientPromise = null, mindsCache = null, resolvedMind = null;
let factory = async (key) => (await import('@animocabrands/minds-client-lib')).createMindsClient({ builderApiKey: key });
export function _setClientFactory(fn){ factory = fn; clientPromise = null; mindsCache = null; resolvedMind = null; ready.clear(); } // tests

function client(){
  if (!E.MINDS_BUILDER_API_KEY) throw new Error('MINDS_BUILDER_API_KEY is not set in .env');
  return (clientPromise ||= factory(E.MINDS_BUILDER_API_KEY));
}
export async function resolveMind(){
  if (resolvedMind) return resolvedMind;
  const ref = MIND_REF(), c = await client();
  const all = mindsCache ||= await c.listMinds();
  const m = /^[0-9a-f-]{36}$/i.test(ref) ? (all.find(x => x.mindId === ref) || { mindId: ref, name: null })
    : ref ? all.find(x => (x.name || '').toLowerCase() === ref.toLowerCase()) : all[0];
  if (!m) throw new Error(ref ? `No Mind named "${ref}" on this account` : 'No Minds on this account');
  return (resolvedMind = { mindId: m.mindId, name: m.name || null });
}

const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }, { once: true }); });
const keyOf = r => String(r?.fingerprint || r?.messageId || r?.id || '');
const isMindRow = r => r?.senderType === 0 || r?.senderType === 2 || !!r?.mindId;
function newestMindReply(rows, beforeKeys, sent){
  return rows.filter(r => { const t = String(r?.messageText || '').trim(), k = keyOf(r); return t && t !== sent && isMindRow(r) && (!k || !beforeKeys.has(k)); })
    .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))[0];
}
const META = /moods? allowed|allowed moods|app note|buddy (app )?instructions|tag rules|start every reply|my wires crossed|ignore that (first )?line|format rules/i;
const isMeta = t => { const x = String(t || '').replace(/\[[^\]]*\]/g, ' ').trim(); return META.test(String(t || '').slice(0, 200)) && x.length < 260; };
const ready = new Set();
const queue = new Map();   // one request at a time per conversation
export function askMind(alias, text){
  const prev = queue.get(alias) || Promise.resolve();
  const p = prev.catch(() => {}).then(() => askNow(alias, text));
  queue.set(alias, p); return p;
}
async function askNow(alias, messageText){
  const c = await client(), mind = await resolveMind();
  if (!ready.has(alias)){ await c.ensureConversation(alias, mind.mindId); ready.add(alias); }
  const before = await c.getHistory(alias, { limit: 40 });
  const beforeKeys = new Set(before.map(keyOf).filter(Boolean));
  const afterFingerprint = before.map(keyOf).filter(Boolean).sort().at(-1);
  await c.sendMessage({ alias, messageText });
  const stop = new AbortController(), never = () => new Promise(() => {});
  const byEvent = c.waitForReply({ alias, timeoutMs: TIMEOUT(), afterFingerprint, sentMessageText: messageText, signal: stop.signal })
    .then(o => (!o.timedOut && o.reply?.messageText) ? o.reply : never()).catch(() => never());
  const byHistory = (async () => {
    await sleep(1000, stop.signal);
    while (!stop.signal.aborted){
      try { const r = newestMindReply(await c.getHistory(alias, { limit: 40, signal: stop.signal }), beforeKeys, messageText); if (r) return r; } catch (_) {}
      await sleep(1600, stop.signal);
    }
    return never();
  })().catch(() => never());
  const timeout = sleep(TIMEOUT(), stop.signal).then(() => null, () => null);
  try {
    const r = await Promise.race([byEvent, byHistory, timeout]);
    if (r && isMeta(r.messageText)) {                       // a "thinking about the rules" message: wait for the real answer
      beforeKeys.add(keyOf(r)); stop.abort();
      const again = await waitMore(c, alias, beforeKeys, messageText, 45_000);
      if (again) return cleanReply(again.messageText);
      if (lateHandler) watchLate(c, alias, beforeKeys, messageText);
      return null;
    }
    if (!r && lateHandler) watchLate(c, alias, beforeKeys, messageText);
    return r ? cleanReply(r.messageText) : null;
  }
  finally { stop.abort(); }
}
async function waitMore(c, alias, beforeKeys, sent, ms){
  const until = Date.now() + ms;
  while (Date.now() < until){ await new Promise(r => setTimeout(r, 1600));
    try { const r = newestMindReply(await c.getHistory(alias, { limit: 40 }), beforeKeys, sent); if (r) { if (isMeta(r.messageText)) { beforeKeys.add(keyOf(r)); continue; } return r; } } catch (_) {} }
  return null;
}
// keep looking for a late answer for up to 5 more minutes
async function watchLate(c, alias, beforeKeys, sent){
  const until = Date.now() + 5 * 60_000;
  while (Date.now() < until){
    await new Promise(r => setTimeout(r, 5000));
    try { const r = newestMindReply(await c.getHistory(alias, { limit: 40 }), beforeKeys, sent); if (r) { if (isMeta(r.messageText)) { beforeKeys.add(keyOf(r)); continue; } lateHandler?.(alias, cleanReply(r.messageText)); return; } } catch (_) {}
  }
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function cleanReply(raw){
  let t = String(raw || '');
  t = t.replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ');
  t = t.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
  t = t.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return t.replace(/^((?:\s*\[[^\]]+\])*)\s*(plain answer|answer|reply|response|in character)\b[^:\n]{0,40}:\s*/i, '$1 ').trim();
}

// ---------- practice brain (PROVIDER=mock) ----------
export async function mockReply(text){
  await new Promise(r => setTimeout(r, 500));
  const l = text.toLowerCase();
  if (l.includes('[fix-typing]')) { const m = text.match(/<<<([\s\S]*)>>>/); return m ? m[1].replace(/\bteh\b/g, 'the').replace(/\bi\b/g, 'I').replace(/\s{2,}/g, ' ') : ''; }
  if (l.includes('[welcome-back]')) return '[mood:happy][action:wave] Welcome back! Your last few windows are in the list. Ready when you are!';
  if (/\b(hi|hello|hey)\b/.test(l)) return '[mood:happy][action:wave] Hey hey! I\'m on my practice brain. Put your Mind\'s key in .env and I get smart!';
  if (/remind/.test(l)) { const t = new Date(Date.now() + 60_000); return `[mood:happy][action:nod][remind:${localIso(t)}|Practice reminder] Okay! I'll remind you in a minute (practice mode).`; }
  if (/meeting|calendar/.test(l)) return '[mood:curious][action:think][calendar:today] Let me peek at your calendar.';
  return '[mood:curious][action:think] Hmm! I\'m on my practice brain, so I can only do tricks. Set PROVIDER=minds in .env.';
}
export function localIso(d){ const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
