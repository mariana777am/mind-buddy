// Free, offline speech-to-text: OpenAI's Whisper model running on this PC (Transformers.js + ONNX).
// No API key, no credits. The model downloads once (about 80 MB for "base") into %APPDATA%\minds-buddy\models.
import path from 'node:path';

export function createLocalStt({ dir, log = () => {}, model, language } = {}){
  const MODEL = model || 'onnx-community/whisper-base';
  let asr = null, loading = null, failed = null;

  async function load(){
    if (asr) return asr; if (failed) throw failed;
    loading ||= (async () => {
      let T;
      try { T = await import('@huggingface/transformers'); }
      catch { throw Object.assign(new Error('LOCAL_STT_NOT_INSTALLED'), { hint: 'Run "npm install" in the minds-buddy folder once.' }); }
      T.env.cacheDir = path.join(dir, 'models'); T.env.allowLocalModels = false;
      const t0 = Date.now(); log('free voice input: loading', MODEL, '(first time downloads it, ~80 MB)…');
      let p;
      try { p = await T.pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8' }); }
      catch (e) { log('q8 model failed (' + e.message + '), trying the full-size one'); p = await T.pipeline('automatic-speech-recognition', MODEL, { dtype: 'fp32' }); }
      log('free voice input ready in', ((Date.now() - t0) / 1000).toFixed(1), 's'); return p;
    })();
    try { asr = await loading; return asr; }
    catch (e) { loading = null; if (e.message === 'LOCAL_STT_NOT_INSTALLED') failed = e; throw e; }
  }

  // pcm: Float32Array, mono, 16 kHz
  async function transcribe(pcm){
    const p = await load(), t0 = Date.now();
    const out = await p(pcm, { task: 'transcribe', ...(language ? { language } : {}), chunk_length_s: 30 });
    const text = cleanWhisper(out?.text);
    log(`heard (free, ${((Date.now() - t0) / 1000).toFixed(1)} s):`, text || '(nothing)');
    return text;
  }
  return { transcribe, warm: () => load().catch(e => log('free voice input not ready:', e.message)), model: MODEL };
}

// Whisper "hears" these in silence or noise; treat them as nothing
const GHOSTS = /^(thank you\.?|thanks for watching!?|you|bye\.?|\.+|\[.*\]|\(.*\)|♪+|terima kasih\.?|subtitles by .*)$/i;
export function cleanWhisper(t){
  t = String(t || '').replace(/\[(?:BLANK_AUDIO|MUSIC|NOISE|SILENCE)\]|\((?:music|applause|laughs?)\)|♪/gi, ' ').replace(/\s+/g, ' ').trim();
  return GHOSTS.test(t) ? '' : t;
}
