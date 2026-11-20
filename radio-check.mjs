// node radio-check.mjs cantonese   — checks the radio directory and a few streams from YOUR internet connection
import { createMusic } from './lib/music.js';
const q = process.argv.slice(2).join(' ') || 'jazz';
const m = createMusic({ log: (...a) => console.log('  ·', ...a) });
console.log(`Searching radio for "${q}"…`);
const list = await m.radio(q);
console.log(`\nFound ${list.length} playable stations:`);
list.slice(0, 6).forEach((s, i) => console.log(`  ${i + 1}. ${s.name}  [${s.country}${s.language ? ', ' + s.language : ''}]  ${s.codec || '?'} ${s.bitrate || ''}kbps\n     ${s.url}`));
console.log('\nTesting the first 3 streams…');
for (const s of list.slice(0, 3)) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
  try { const r = await fetch(s.url, { signal: ac.signal, headers: { 'user-agent': 'MindsBuddy/1.0' } }); const rd = r.body.getReader(); const { value } = await rd.read(); ac.abort();
    console.log(`  ✓ ${s.name}: HTTP ${r.status}, ${r.headers.get('content-type') || 'no type'}, got ${value?.length || 0} bytes`); }
  catch (e) { console.log(`  ✗ ${s.name}: ${e.name === 'AbortError' ? 'no data within 8 s' : e.cause?.code || e.message}`); }
  finally { clearTimeout(t); }
}
process.exit(0);
