// Announcement voice: the free Windows voice, dressed up like a mall / airport announcement.
// Used for everything the buddy says on its own (pet chatter, reminders, initiative, level-ups).
// Answers to your questions still use the ElevenLabs voice. Costs nothing: no internet, no credits.
(() => {
  const STYLES = {
    mall:     { label: '🛍️ Mall',           rate: .96,  pitch: 1.08 },
    airport:  { label: '✈️ Airport (calm)', rate: .88,  pitch: .96 },
    cheerful: { label: '🎉 Cheerful',       rate: 1.06, pitch: 1.28 },
  };
  // chimes: [frequency Hz, start s] for the opening; the mall one also closes with a falling chime
  const N = { A4: 440, C5: 523.25, Cs5: 554.37, E5: 659.25, G5: 783.99, A5: 880 };
  const CHIMES = {
    mall:     { label: '🛍️ Mall 4-tone',      open: [[N.A4, 0], [N.Cs5, .3], [N.E5, .6], [N.A5, .9]], close: [[N.A5, 0], [N.E5, .3], [N.Cs5, .6], [N.A4, .9]], gap: 1.9 },
    dingdong: { label: '🔔 Ding-dong',         open: [[N.E5, 0], [N.C5, .55]], close: null, gap: 1.6 },
    airport:  { label: '✈️ Airport 3-tone',    open: [[N.C5, 0], [N.E5, .45], [N.G5, .9]], close: [[N.G5, 0], [N.E5, .45], [N.C5, .9]], gap: 2.0 },
    none:     { label: '🔇 No chime',          open: [], close: null, gap: 0 },
  };
  const OPENERS = {
    meeting:  ['Attention please. '],
    reminder: ['Attention please. A friendly reminder: ', 'May I have your attention please. Reminder: '],
    any:      ['Attention please. ', 'May I have your attention please. ', 'Hello hello! ', 'Announcement! '],
  };
  const DEFAULT = { voice: '', style: 'mall', chime: 'mall', opener: true, picked: false };
  let cfg = { ...DEFAULT }, ctx = null, live = [], gen = 0, lastAnn = 0;

  const voices = () => { try { return speechSynthesis.getVoices(); } catch { return []; } };
  const findVoice = () => { const v = voices();
    return v.find(x => x.name === cfg.voice) || v.find(x => /aria|jenny|natural/i.test(x.name)) || v.find(x => /zira|female/i.test(x.name)) || v.find(x => /^en/i.test(x.lang)) || null; };
  const shortName = v => v.name.replace(/^Microsoft\s+/i, '').replace(/\s+Desktop/i, '').replace(/\s*-\s*/, ' · ').replace(/\(United States\)/, '(US)').replace(/\(United Kingdom\)/, '(UK)');
  const clean = t => String(t || '').replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/[*_#~`]/g, '').replace(/\s+/g, ' ').trim();
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function bell(t, f, vol){
    const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
    for (const [m, a, d] of [[1, 1, 1.8], [2, .3, 1.1], [3, .1, .7], [4.2, .05, .45]]){
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + .05); live.push(o);
    }
  }
  // plays a chime; resolves when it's time to start talking
  function chime(name = cfg.chime, part = 'open', vol = .22){
    const c = CHIMES[name] || CHIMES.none, notes = part === 'open' ? c.open : c.close;
    if (!notes?.length) return Promise.resolve();
    try { ctx ||= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); } catch { return Promise.resolve(); }
    const t0 = ctx.currentTime + .03; for (const [f, s] of notes) bell(t0 + s, f, vol);
    const my = gen; return new Promise(r => setTimeout(() => r(my === gen), (part === 'open' ? c.gap : 1.6) * 1000));
  }
  function stop(){ gen++; live.forEach(o => { try { o.stop(); } catch {} }); live = []; try { speechSynthesis.cancel(); } catch {} }

  // say(text, mood, { announce, kind, onstart, onend, onboundary, force })
  async function say(text, mood, o = {}){
    stop(); const my = gen; text = clean(text);
    if (!text || !window.speechSynthesis) { o.onend?.(); return; }
    o.onstart?.();
    // chime + opening line, but not again if the last announcement was under 45 s ago
    const full = o.announce && (o.force || Date.now() - lastAnn > 45000);
    if (o.announce) lastAnn = Date.now();
    if (full && cfg.chime !== 'none') { const ok = await chime(cfg.chime, 'open'); if (!ok || my !== gen) return; }
    if (full && cfg.opener) {
      if (o.kind === 'reminder') text = text.replace(/^(hey!?\s*)?reminder:\s*/i, '');
      text = pick(OPENERS[o.kind] || OPENERS.any) + text;
    }
    const st = STYLES[cfg.style] || STYLES.mall, u = new SpeechSynthesisUtterance(text);
    u.voice = findVoice(); if (u.voice) u.lang = u.voice.lang;
    const m = { excited: [.04, .08], happy: [0, .04], sleepy: [-.1, -.08], worried: [-.03, -.05], calm: [-.04, -.02] }[mood] || [0, 0];
    u.rate = (o.answer ? 1.05 : st.rate) + m[0]; u.pitch = (o.answer ? 1.2 : st.pitch) + m[1];
    u.onboundary = () => o.onboundary?.();
    u.onend = u.onerror = async () => { if (my !== gen) return;
      if (full && CHIMES[cfg.chime]?.close) await chime(cfg.chime, 'close', .16);
      if (my === gen) o.onend?.(); };
    speechSynthesis.speak(u);
  }
  function set(c){ cfg = { ...DEFAULT, ...(c || {}) }; }
  try { speechSynthesis.onvoiceschanged = () => window.dispatchEvent(new Event('ann-voices')); } catch {}
  window.ANN = { say, stop, chime, set, get cfg(){ return cfg; }, voices, shortName, findVoice, STYLES, CHIMES, DEFAULT };
})();
