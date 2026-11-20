// node mind.mjs <command>  — the official Minds CLI (@animocabrands/minds-cli), set up for this buddy.
// Reads MINDS_BUILDER_API_KEY and MIND_ID from .env, so you never type the key or the Mind's id.
//
//   doctor              is the key / setup OK?
//   status              your Mind, its cognition balance, and today's usage by tool
//   usage [day|week|month]   which tools used the most cognition
//   skills | apps       what the Mind has equipped
//   bazaar "<search>"   find skills and apps to add (e.g. bazaar "weather")
//   equip-skill <id>    / equip-app <id>   add one to your Mind
//   history [n]         the last n messages between the buddy and your Mind (default 10)
//   ask "<message>"     send one message on a separate test chat and print the reply
//   selftest            3 quick checks that your Mind follows the buddy's rules (uses 3 messages)
//   raw <cli args…>     run any other CLI command, e.g.  raw circle list
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BUDDY_ALIAS = 'minds-buddy-buddy', TEST_ALIAS = 'minds-buddy-cli-test';
const env = {};
try { for (const l of readFileSync(path.join(DIR, '.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, ''); } } catch {}
const out = (...a) => console.log(...a), bad = s => console.log('  ✗ ' + s), good = s => console.log('  ✓ ' + s);

// ---------- run the CLI ----------
function cliPath(){
  const pj = path.join(DIR, 'node_modules', '@animocabrands', 'minds-cli', 'package.json');
  if (!existsSync(pj)) return null;
  const p = JSON.parse(readFileSync(pj, 'utf8')), bin = typeof p.bin === 'string' ? p.bin : p.bin?.minds || Object.values(p.bin || {})[0];
  return bin ? path.join(path.dirname(pj), bin) : null;
}
function minds(args, { quiet = false, timeout = 200000 } = {}){
  const bin = cliPath();
  if (!bin) { out('The Minds CLI isn\'t installed yet. In this folder run:  npm install'); process.exit(1); }
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: DIR, encoding: 'utf8', timeout, maxBuffer: 20e6,
    env: { ...process.env, ...(env.MINDS_BUILDER_API_KEY ? { MINDS_BUILDER_API_KEY: env.MINDS_BUILDER_API_KEY } : {}) } });
  const text = (r.stdout || '').trim();
  let json = null; try { json = JSON.parse(text); } catch { try { json = JSON.parse(text.split('\n').filter(Boolean).pop()); } catch {} }
  if (!quiet && r.stderr?.trim() && (r.status || !json?.ok)) console.error(r.stderr.trim().split('\n').slice(-6).join('\n'));
  if (r.error) { out('Could not run the CLI: ' + r.error.message); process.exit(1); }
  return { ok: r.status === 0 && json?.ok !== false, json, text, stderr: r.stderr || '' };
}
const show = j => out(JSON.stringify(j, null, 2));
const items = j => Array.isArray(j) ? j : j?.items || j?.data || j?.minds || j?.skills || j?.apps || j?.results || [];

let mindIdCache = null;
function mindId(){
  if (mindIdCache) return mindIdCache;
  const ref = (env.MIND_ID || '').trim();
  if (/^[0-9a-f-]{30,}$/i.test(ref)) return (mindIdCache = ref);
  const r = minds(['list'], { quiet: true }), list = items(r.json);
  const m = list.find(x => (x.name || '').toLowerCase() === ref.toLowerCase()) || list[0];
  if (!m) { out('No Mind found. Check MINDS_BUILDER_API_KEY and MIND_ID in .env (try: node mind.mjs doctor).'); process.exit(1); }
  return (mindIdCache = m.mindId || m.id);
}
// the Mind's reply text, wherever the CLI puts it
function replyText(j){
  if (!j || typeof j !== 'object') return '';
  for (const k of ['reply', 'outcome', 'message', 'result', 'response']) if (j[k]) { const t = typeof j[k] === 'string' ? j[k] : replyText(j[k]); if (t) return t; }
  if (typeof j.messageText === 'string' && j.senderType !== 1) return j.messageText;
  if (typeof j.text === 'string') return j.text;
  for (const v of Object.values(j)) if (v && typeof v === 'object') { const t = replyText(v); if (t) return t; }
  return '';
}
const clean = t => String(t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- commands ----------
const [cmd = 'help', ...rest] = process.argv.slice(2);
const C = {
  doctor(){ const r = minds(['doctor', '--pretty']); out(r.text || r.stderr); },
  status(){
    const id = mindId(), m = minds(['mind', 'show', '--mind', id]).json, b = minds(['cognition', 'balance', '--mind', id]).json, u = minds(['usage', 'by-tool', '--mind', id, '--interval', 'day']).json;
    const mind = m?.mind || m?.item || m || {};
    out(`Mind: ${mind.name || id}${mind.isEnabled === false ? '   ✗ DISABLED (run: node mind.mjs raw mind enable --mind ' + id + ')' : ''}`);
    const bal = b?.cognition ?? b?.balance ?? b?.item?.cognition;
    out(`Cognition balance: ${bal ?? JSON.stringify(b)}${typeof bal === 'number' && bal < 20 ? '   ✗ almost empty' : ''}`);
    const tools = items(u); out(`Today by tool: ${tools.length ? tools.map(t => `${t.tool || t.toolName || t.name}: ${t.cognition ?? t.total ?? t.usage ?? t.amount}`).join(', ') : JSON.stringify(u)}`);
  },
  usage(){ const iv = { day: 'day', week: 'week', month: 'month', hour: 'hour' }[rest[0]] || 'day'; show(minds(['usage', 'by-tool', '--mind', mindId(), '--interval', iv]).json); },
  skills(){ const l = items(minds(['mind', 'skills', 'list', '--mind', mindId()]).json); out(`Skills (${l.length}):`); l.forEach(s => out(`  ${s.name || ''}  [${s.skillId || s.id}]`)); },
  apps(){ const l = items(minds(['mind', 'apps', 'list', '--mind', mindId()]).json); out(`Apps (${l.length}):`); l.forEach(a => out(`  ${a.appName || a.name || ''}  [${a.appId || a.id}]`)); },
  bazaar(){ const q = rest.join(' ') || 'weather'; const l = items(minds(['bazaar', 'search', q, '--max', '15']).json);
    out(`Bazaar results for "${q}":`); l.forEach(x => out(`  ${x.skillId ? 'skill' : 'app  '}  ${x.name || x.appName}  [${x.skillId || x.appId}]  ${clean(x.description || '').slice(0, 70)}`));
    out('\nAdd one with:  node mind.mjs equip-skill <id>   or   node mind.mjs equip-app <id>'); },
  'equip-skill'(){ if (!rest[0]) return out('Which skill? node mind.mjs equip-skill <skillId>'); const r = minds(['mind', 'skills', 'equip', '--mind', mindId(), ...rest.flatMap(id => ['--id', id])]); out(r.ok ? 'Equipped ✓' : 'Failed'); },
  'equip-app'(){ if (!rest[0]) return out('Which app? node mind.mjs equip-app <appId>'); const r = minds(['mind', 'apps', 'equip', '--mind', mindId(), ...rest.flatMap(id => ['--id', id])]); out(r.ok ? 'Equipped ✓' : 'Failed'); },
  history(){
    const n = Math.min(50, Number(rest[0]) || 10), l = items(minds(['history', BUDDY_ALIAS, '--limit', String(n)]).json).reverse();
    out(`Last ${l.length} messages with the buddy (oldest first):`);
    for (const r of l) { const who = r.senderType === 1 ? 'you ' : 'MIND';
      const t = clean(r.messageText).replace(/^\[Minds Buddy[\s\S]*?\]\s*(?:User says:\s*)?/, '').replace(/^[\s\S]*?User says:\s*/, '');
      out(`  ${r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : ''}  ${who}  ${t.slice(0, 120)}`); }
  },
  ask(){ const msg = rest.join(' '); if (!msg) return out('What should I send? node mind.mjs ask "Hello!"');
    minds(['chat', 'create', '--mind', mindId(), '--alias', TEST_ALIAS], { quiet: true });
    const r = minds(['send', TEST_ALIAS, msg, '--wait', '--timeout', '180000']); out(replyText(r.json) || r.text || '(no reply in time)'); },
  async selftest(){
    const { noteFor, parseTags } = await import(pathToFileURL(path.join(DIR, 'lib', 'brain.js')).href);
    await import(pathToFileURL(path.join(DIR, 'renderer', 'arcade-design.js')).href); const AD = globalThis.ArcadeDesign;
    minds(['chat', 'create', '--mind', mindId(), '--alias', TEST_ALIAS], { quiet: true });
    const send = msg => { const r = minds(['send', TEST_ALIAS, msg, '--wait', '--timeout', '180000'], { quiet: true }); return replyText(r.json); };
    const note = noteFor({ name: 'Buddy', now: new Date() });
    let pass = 0;
    out('Selftest: 3 messages on a separate test chat (your buddy\'s chat is untouched)…\n');
    out('1) A normal question: does it answer short, cheerful, with mood tags?');
    let t = send(note + 'User says: I\'m hungry, what should I eat for lunch?'), p = parseTags(t || '');
    if (!t) bad('no reply (slow, out of cognition, or disabled: try  node mind.mjs status)');
    else { out('   reply: ' + clean(t).slice(0, 160));
      if (/\[mood:/.test(t)) { good('uses [mood:…] tags'); pass++; } else bad('no [mood:…] tag → paste mind-instructions.md into your Mind\'s instructions');
      if (p.text.split(/\s+/).length > 70) bad('answer is long (' + p.text.split(/\s+/).length + ' words): the instructions ask for 1–4 short sentences'); }
    out('\n2) A reminder: does it use the [remind:…] tag?');
    t = send(note + 'User says: remind me in 10 minutes to stretch');
    if (!t) bad('no reply'); else { out('   reply: ' + clean(t).slice(0, 160)); if (/\[remind:\d{4}-\d\d-\d\dT\d\d:\d\d\|/.test(t)) { good('reminder tag in the right format'); pass++; } else bad('no [remind:YYYY-MM-DDTHH:MM|…] tag → reminders won\'t be set'); }
    out('\n3) The arcade level designer: does it return a level plan?');
    t = send(`[game helper, not a chat] We're about to play "Bubble Pop Battle". You are the trash-talking star AND the level designer.\nPlayer diary:\n${AD.summarize('bubbles', [])}\n${AD.rules()}\n` +
      `Reply ONLY in this exact format on one line, nothing else: LINE: trash talk | STYLE: aggressive or defensive or tricky | BRAG: 4 brags separated by ; | OOPS: 4 excuses separated by ; | ${AD.promptPart('bubbles')}.`);
    const d = AD.parseMind('bubbles', t || '');
    if (!t) bad('no reply'); else if (d) { good(`level "${d.name}", twist ${d.twist}, tuning ${JSON.stringify(d.knobs)}`); pass++; } else { out('   reply: ' + clean(t).slice(0, 160)); bad('no LEVEL: … in the reply → the arcade will use its built-in designer'); }
    out(`\n${pass}/3 checks passed.${pass < 3 ? ' Most fixes: paste the latest mind-instructions.md into PuppetMind\'s instructions on hellominds.ai.' : ' Your Mind is set up for the buddy. 🎉'}`);
  },
  raw(){ const r = minds(rest); out(r.text || r.stderr); },
  help(){ out(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 15).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); },
};
if (!C[cmd]) { out(`Unknown command "${cmd}".`); C.help(); } else await C[cmd]();
