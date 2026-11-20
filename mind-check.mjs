// node mind-check.mjs  — is my Mind awake, does it have credits and skills, and did it answer late?
import { readFileSync } from 'node:fs';
const env = {};
for (const l of readFileSync(new URL('.env', import.meta.url), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, ''); }
const { createMindsClient } = await import('@animocabrands/minds-client-lib');
const c = await createMindsClient({ builderApiKey: env.MINDS_BUILDER_API_KEY });
const all = await c.listMinds(), ref = (env.MIND_ID || '').toLowerCase();
const mind = all.find(m => m.mindId === env.MIND_ID || (m.name || '').toLowerCase() === ref) || all[0];
if (!mind) { console.log('No Mind found for MIND_ID', env.MIND_ID); process.exit(1); }
console.log(`Mind: ${mind.name}  (enabled: ${mind.isEnabled !== false ? 'yes' : 'NO ✗'})`);
try { const b = await c.getCognitionBalance(mind.mindId); console.log(`Cognition (credits): ${b.cognition}${b.cognition < 20 ? '   ✗ almost empty: it can\'t think much more' : ''}`); } catch (e) { console.log('Cognition: could not read (' + e.message + ')'); }
try { const s = await c.listEquippedSkills(mind.mindId); console.log(`Skills (${s.length}): ${s.map(x => x.name || x.skillId).join(', ') || 'none'}`); } catch (e) { console.log('Skills: could not read (' + e.message + ')'); }
try { const a = await c.listEquippedApps(mind.mindId); console.log(`Apps (${a.length}): ${a.map(x => x.appName || x.appId).join(', ') || 'none'}`); } catch (e) { console.log('Apps: could not read (' + e.message + ')'); }
try {
  const h = await c.getHistory('minds-buddy-buddy', { limit: 12 });
  console.log('\nLast messages with the buddy (oldest first):');
  for (const r of [...h].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(-8)) {
    const who = r.senderType === 0 || r.senderType === 2 || r.mindId ? 'MIND' : 'you ';
    const txt = String(r.messageText || '').replace(/<[^>]+>/g, ' ').replace(/^\[Minds Buddy[\s\S]*?\]\s*(?:User says:\s*)?/, '').replace(/^[\s\S]*?User says:\s*/, '').replace(/\s+/g, ' ').trim();
    console.log(`  ${new Date(r.createdAt).toLocaleTimeString()}  ${who}  ${txt.slice(0, 110)}`);
  }
} catch (e) { console.log('History: could not read (' + e.message + ')'); }
