// Initiative: the buddy starts conversations itself, at natural pauses, without nagging.
// Pure logic (no Electron) so it can be tested. main.js feeds it ticks; brain.proactive writes the words.
export const LEVELS = { quiet: null, normal: { gap: 40, fun: .5 }, chatty: { gap: 18, fun: .8 } };   // gap = minutes between pop-ins

export function createInitiative({ level, flags, saveFlags, blocked, lastTouchAgo, timeline, google, reminders, facts, speak, log = () => {}, now = () => new Date(), rand = Math.random }){
  let lastPop = 0, backoff = 1, busy = false, lastFollowup = 0, lastWin = null, winSince = Date.now(), lastSwitch = 0;
  const offeredStuck = new Set(), prepped = new Set();
  const day = () => now().toLocaleDateString('en-CA');
  const F = () => { const f = flags(); if (f.day !== day()) { f.day = day(); f.morning = 0; f.wrap = 0; f.activeMin = 0; saveFlags(f); } return f; };

  async function pop(kind, ctx){
    if (busy) return false; busy = true;
    try {
      log('initiative:', kind);
      const r = await speak(kind, ctx);
      if (r?.text) { lastPop = Date.now(); return true; }
      return false;
    } catch (e) { log('initiative failed:', e.message); return false; }
    finally { busy = false; }
  }

  // called every few seconds with how long you've been idle and the window you're in
  async function tick({ idle, win, force = null }){
    const t = now(), f = F(), cfg = LEVELS[level()] || null;
    if (win?.title) {
      const key = win.app + '|' + win.title;
      if (key !== lastWin) { if (lastWin !== null) lastSwitch = Date.now(); lastWin = key; winSince = Date.now(); }   // the first window seen is not a switch
      if (idle < 60) { f.activeMin = (f.activeMin || 0) + 5 / 60; if (Math.round(f.activeMin * 12) % 12 === 0) saveFlags(f); }
    }
    if (force) return pop(force, await context(force, win));
    if (!cfg || busy || blocked()) return false;
    if (lastTouchAgo() < 8 * 60_000) return false;                         // you were just talking with it
    const pause = idle >= 15 && idle <= 180;                                // you stopped typing / mousing for a moment
    const justSwitched = Date.now() - lastSwitch < 12_000 && idle < 10;     // you just moved to another window
    if (!pause && !justSwitched) return false;
    const h = t.getHours(), sinceLast = (Date.now() - lastPop) / 60_000, gapOk = sinceLast >= cfg.gap * backoff;

    if (!f.morning && h >= 6 && h < 12) { f.morning = 1; saveFlags(f); return pop('morning', await context('morning', win)); }
    if (google?.connected() && sinceLast >= 10) {
      try {
        const soon = (await google.upcoming(26)).filter(e => !e.allDay && (e.start - Date.now()) / 60_000 >= 11 && !prepped.has(e.id));
        if (soon[0]) { prepped.add(soon[0].id); return pop('prep', { event: soon[0], minutes: Math.round((soon[0].start - Date.now()) / 60_000) }); }
      } catch (_) {}
    }
    if (!gapOk) return false;
    if (!f.wrap && h >= 17 && h < 22 && (f.activeMin || 0) >= 120) { f.wrap = 1; saveFlags(f); return pop('wrap', await context('wrap', win)); }
    const onSame = (Date.now() - winSince) / 60_000;
    if (win?.title && onSame >= 40 && !offeredStuck.has(lastWin) && pause) { offeredStuck.add(lastWin); return pop('stuck', { win, minutes: Math.round(onSame) }); }
    if (facts().length && Date.now() - lastFollowup > 3 * 3600_000 && rand() < .5) { lastFollowup = Date.now(); return pop('followup', { facts: facts() }); }
    if (pause && rand() < cfg.fun) return pop('fun', { win, facts: facts() });
    lastPop = Date.now() - (cfg.gap * backoff - 10) * 60_000;               // nothing this time: look again in ~10 min
    return false;
  }

  async function context(kind, win){
    const c = { win, facts: facts() };
    if (kind === 'morning' || kind === 'wrap') {
      c.reminders = reminders.pending().filter(r => r.at < Date.now() + 36 * 3600_000).slice(0, 5).map(r => `${new Date(r.at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}: ${r.text}`).join('\n');
      if (google?.connected()) { try { c.calendar = google.formatEvents(await google.events(kind === 'wrap' ? 'tomorrow' : 'today'), kind === 'wrap' ? 'tomorrow' : 'today'); } catch (_) {} }
      if (kind === 'wrap') c.today = timeline.summary(Date.now() - 12 * 3600_000, Date.now(), 6);
    }
    return c;
  }

  return {
    tick,
    feedback(v){ if (v === 'no') { backoff = Math.min(4, backoff * 2); lastPop = Date.now(); } else backoff = 1; },
    _state: () => ({ lastPop, backoff, busy }),
  };
}
