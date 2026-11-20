import assert from 'node:assert/strict';
import { cleanWhisper, createLocalStt } from '../lib/localstt.js';
assert.equal(cleanWhisper(' Thank you. '), '');
assert.equal(cleanWhisper('[BLANK_AUDIO]'), '');
assert.equal(cleanWhisper('♪ ♪'), '');
assert.equal(cleanWhisper('Hey Buddy, play 988 FM'), 'Hey Buddy, play 988 FM');
console.log('  ✓ 1. Whisper noise ghosts ("Thank you.", [BLANK_AUDIO], ♪) count as nothing');
const stt = createLocalStt({ dir: '/tmp/x' });
let installed = true; try { await import('@huggingface/transformers'); } catch { installed = false; }
if (!installed) { await assert.rejects(stt.transcribe(new Float32Array(16000)), /LOCAL_STT_NOT_INSTALLED/); console.log('  ✓ 2. not installed yet → clear "run npm install" error (falls back to the paid ears)'); }
else console.log('  ✓ 2. Transformers.js is installed');
console.log('\nAll free-ears checks passed.');
