// node check-key.mjs  — tests your Minds key and MIND_ID, and shows which key is really used.
import { readFileSync } from 'node:fs';
const fp = k => k ? `…${k.slice(-6)} (${k.length} chars)` : '(none)';
let env = {};
try { for (const l of readFileSync(new URL('.env', import.meta.url), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, ''); } }
catch { console.log('No .env file in this folder!'); process.exit(1); }
console.log('.env key          ', fp(env.MINDS_BUILDER_API_KEY));
console.log('Windows variable  ', fp(process.env.MINDS_BUILDER_API_KEY), process.env.MINDS_BUILDER_API_KEY && process.env.MINDS_BUILDER_API_KEY !== env.MINDS_BUILDER_API_KEY ? '  <-- DIFFERENT from .env (old key?)' : '');
console.log('MINDS_ACCESS_KEY  ', fp(process.env.MINDS_ACCESS_KEY));
try { const p = JSON.parse(Buffer.from(env.MINDS_BUILDER_API_KEY.split('.')[1], 'base64url')); console.log('key expires       ', new Date(p.exp * 1000).toISOString().slice(0, 10)); } catch { console.log('key format         not a Minds Builder key (should start with eyJ)'); }
const { createMindsClient } = await import('@animocabrands/minds-client-lib');
for (const [label, key] of [['.env key', env.MINDS_BUILDER_API_KEY], ['Windows variable', process.env.MINDS_BUILDER_API_KEY]]) {
  if (!key || (label !== '.env key' && key === env.MINDS_BUILDER_API_KEY)) continue;
  try { const c = await createMindsClient({ builderApiKey: key }); const minds = await c.listMinds();
    console.log(`\n${label}: ACCEPTED ✓  ${minds.length} Minds:`, minds.map(m => m.name).join(', '));
    if (label === '.env key') { const want = (env.MIND_ID || '').toLowerCase(); const hit = minds.find(m => m.mindId === env.MIND_ID || (m.name || '').toLowerCase() === want);
      console.log(hit ? `MIND_ID "${env.MIND_ID}" found ✓ (enabled: ${hit.isEnabled})` : `MIND_ID "${env.MIND_ID}" NOT found ✗ — use one of the names above`); } }
  catch (e) { console.log(`\n${label}: REJECTED ✗  status ${e.status ?? '?'} ${e.code ?? ''} — ${e.message}${e.requestId ? ' (request ' + e.requestId + ')' : ''}`); }
}
