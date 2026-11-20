// Arcade level design: a play diary (kept on this PC) + a level plan from your Mind, kept within safe limits.
// Pure logic so it can be tested in Node; the arcade window loads it before arcade.js.
(function (root){
  const KNOBS = {
    bubbles: ['speed', 'aggro', 'smarts', 'bombs', 'gold', 'ice', 'pace'],
    space:   ['speed', 'aggro', 'smarts', 'rocks', 'powerups'],
    brawl:   ['speed', 'aggro', 'smarts', 'blocking', 'special'],
  };
  const KNOB_HELP = {
    speed: 'opponent movement speed', aggro: 'how often the opponent attacks', smarts: 'how cleverly it aims, dodges and avoids bombs',
    bombs: 'how many bomb orbs', gold: 'how many gold orbs', ice: 'how many freeze orbs', pace: 'how fast orbs keep coming',
    rocks: 'how many asteroids to hide behind', powerups: 'how often power-ups fly by', blocking: 'how often the opponent blocks', special: 'how fast Brain Blast charges',
  };
  const TWISTS = {
    bubbles: { goldrush: 'Gold rush: triple gold in the last 15 seconds', bigorbs: 'Big orbs: everything is bigger and slower', tinyorbs: 'Tiny orbs: small, fast and worth double',
               doublefinale: 'Double points in the last 10 seconds', none: 'No twist, pure skill' },
    space:   { meteor: 'Meteor storm: asteroids keep coming', shieldstart: 'Both ships start with a shield', rapidfinale: 'Rapid fire for both in the last 20 seconds',
               narrow: 'Narrow corridor: less room to dodge', none: 'No twist, pure skill' },
    brawl:   { shortrounds: 'Short rounds: 40 seconds each', superstart: 'Both start every round with a full Brain Blast', heavyhits: 'Heavy hits: every hit does 30% more',
               narrow: 'Small ring: the walls close in', none: 'No twist, pure skill' },
  };
  const LABEL = { bubbles: 'Bubble Pop Battle', space: 'Space Duel', brawl: 'Desk Brawl' };
  const clampK = v => Math.max(-2, Math.min(2, Math.round(Number(v) || 0)));
  const short = (s, n) => String(s || '').replace(/^["'“”\s]+|["'“”\s]+$/g, '').replace(/\s+/g, ' ').slice(0, n);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const r1 = v => Math.round(v * 10) / 10;

  // ---------- the diary ----------
  const KEY = 'arcade.diary';
  function load(store){ try { const d = JSON.parse(store?.getItem(KEY) || '[]'); return Array.isArray(d) ? d : []; } catch { return []; } }
  function save(store, diary){ try { store?.setItem(KEY, JSON.stringify(diary.slice(-60))); } catch {} }
  function record(diary, e){ diary.push({ g: e.game, t: e.t || Date.now(), won: !!e.won, tie: !!e.tie, you: e.you, bud: e.bud, lv: e.lv, dur: Math.round(e.dur || 0), stats: e.stats || {},
    design: e.design ? { name: e.design.name, twist: e.design.twist, by: e.design.by, knobs: e.design.knobs } : null }); return diary.slice(-60); }

  function streakOf(rounds){
    if (!rounds.length) return { kind: null, n: 0 };
    const res = e => e.won ? 'won' : e.tie ? 'tied' : 'lost', last = res(rounds[rounds.length - 1]); let n = 0;
    for (let i = rounds.length - 1; i >= 0 && res(rounds[i]) === last; i--) n++;
    return { kind: last, n };
  }
  function habits(game, rounds){
    const S = k => avg(rounds.map(e => Number(e.stats?.[k]) || 0));
    if (game === 'bubbles') return { pops: S('pops'), bombs: S('bombs'), gold: S('gold'), misses: S('misses'), reaction: S('reaction') };
    if (game === 'space') { const shots = S('shots'); return { accuracy: shots ? S('hits') / shots : 0, hitsTaken: S('hitsTaken'), powerups: S('powerups'), distance: S('distance') }; }
    return { punches: S('punches'), kicks: S('kicks'), blockSecs: S('blockSecs'), jumps: S('jumps'), specials: S('specials'), landed: S('landed'), taken: S('taken'), distance: S('distance') };
  }
  const knobText = k => Object.entries(k || {}).filter(([, v]) => v).map(([n, v]) => `${n}${v > 0 ? '+' : ''}${v}`).join(' ') || 'all normal';

  // a short, plain summary for the Mind (only this leaves the PC)
  function summarize(game, diary, { now = new Date(), lv = 2 } = {}){
    const mine = diary.filter(e => e.g === game), rounds = mine.slice(-8), today = new Date(now).toDateString();
    const lines = [];
    const hh = new Date(now).getHours(), late = hh >= 23 || hh < 6;
    lines.push(`Local time ${new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${late ? ' (late night)' : ''}. Rounds played today (all games): ${diary.filter(e => new Date(e.t).toDateString() === today).length}. Current base difficulty ${lv}/5.`);
    if (!rounds.length) { lines.push(`First time playing ${LABEL[game]}: make a friendly warm-up level.`); return lines.join('\n'); }
    const w = rounds.filter(e => e.won).length, t = rounds.filter(e => e.tie).length, st = streakOf(rounds);
    lines.push(`Last ${rounds.length} rounds of ${LABEL[game]}: player won ${w}, tied ${t}, lost ${rounds.length - w - t}. Streak: ${st.kind} ${st.n} in a row. Average round ${Math.round(avg(rounds.map(e => e.dur)))} s.`);
    const h = habits(game, rounds);
    if (game === 'bubbles') lines.push(`Player habits per round: ${r1(h.pops)} orbs popped, ${r1(h.bombs)} bombs hit by mistake, ${r1(h.gold)} gold grabbed, ${r1(h.misses)} missed clicks, reaction ${r1(h.reaction)} s.`);
    if (game === 'space') lines.push(`Player habits per round: ${Math.round(h.accuracy * 100)}% shot accuracy, hit ${r1(h.hitsTaken)} times, ${r1(h.powerups)} power-ups grabbed, usually ${h.distance < 120 ? 'right under the opponent (close range)' : 'far to the side (long range)'}.`);
    if (game === 'brawl') lines.push(`Player habits per round: ${r1(h.punches)} punches, ${r1(h.kicks)} kicks, blocks ${r1(h.blockSecs)} s, ${r1(h.jumps)} jumps, ${r1(h.specials)} Brain Blasts, lands ${r1(h.landed)} hits, takes ${r1(h.taken)}, fights ${h.distance < 110 ? 'up close' : 'from a distance'}.`);
    const past = mine.filter(e => e.design).slice(-3).map(e => `"${e.design.name}" (${knobText(e.design.knobs)}, twist ${e.design.twist}) → player ${e.won ? 'won' : e.tie ? 'tied' : 'lost'}`);
    if (past.length) lines.push('Your last level designs: ' + past.join('; ') + '.');
    const counts = {}; diary.slice(-40).forEach(e => counts[e.g] = (counts[e.g] || 0) + 1);
    const fav = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (fav && fav[1] >= 6 && fav[0] === game) lines.push(`This is the player's favourite game lately (${fav[1]} of the last ${Math.min(40, diary.length)} rounds).`);
    return lines.join('\n');
  }

  // the part of the pre-game message that asks for a level
  function promptPart(game){
    const k = KNOBS[game], tw = Object.keys(TWISTS[game]);
    return `LEVEL: a fun level name, max 4 words | TWIST: one of ${tw.join(', ')} | TUNE: ${k.map(n => n + '=0').join(' ')} (each a whole number from -2 to 2: ${k.map(n => n + ' = ' + KNOB_HELP[n]).join('; ')}) | ` +
      `WHY: your design reason, max 12 words | HABIT: one cheeky, kind line about the player's habits from the diary, max 14 words`;
  }
  function rules(){ return 'Design the level to keep it fun: aim for the player winning about 55 to 60 percent. After losses or late at night make it easier and calmer; after a winning streak make it harder and target a weak spot; if they keep making the same mistake, build the level around practising it. Never make it impossible.'; }

  function sanitize(game, d, by){
    const knobs = {}; for (const n of KNOBS[game]) knobs[n] = clampK(d?.knobs?.[n]);
    const twist = Object.prototype.hasOwnProperty.call(TWISTS[game], d?.twist) ? d.twist : 'none';
    return { name: short(d?.name, 32) || 'Classic Match', twist, twistText: TWISTS[game][twist], knobs, why: short(d?.why, 110), habit: short(d?.habit, 120), by };
  }
  function parseMind(game, text){
    const t = String(text || ''), get = key => (t.match(new RegExp(key + ':\\s*([^|\\n]+)', 'i')) || [])[1];
    const name = get('LEVEL'); if (!name) return null;
    const twist = (get('TWIST') || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const knobs = {}; (get('TUNE') || '').replace(/\(.*$/, '').replace(/([a-z]+)\s*=\s*([+-]?\d+)/gi, (m, k, v) => { knobs[k.toLowerCase()] = Number(v); return m; });
    return sanitize(game, { name, twist, knobs, why: get('WHY'), habit: get('HABIT') }, 'mind');
  }

  // built-in designer: used until (or instead of) the Mind's plan
  function autoDesign(game, diary, { now = new Date() } = {}){
    const rounds = diary.filter(e => e.g === game).slice(-6), st = streakOf(rounds), h = rounds.length ? habits(game, rounds) : null;
    const hh = new Date(now).getHours(), late = hh >= 23 || hh < 6, k = {}; let name = 'Warm-up Round', why = 'A friendly first look at your skills.', habit = '', twist = 'none';
    const add = (n, v) => { if (KNOBS[game].includes(n)) k[n] = (k[n] || 0) + v; };
    if (rounds.length){ name = 'Classic Match'; why = 'Evenly matched, let\'s see what you\'ve got.'; }
    if (st.kind === 'lost' && st.n >= 2) { add('speed', -1); add('aggro', -1); add('smarts', -1); name = 'Comeback Course'; why = `You lost ${st.n} in a row, so I eased off a little.`; }
    else if (st.kind === 'won' && st.n >= 3) { add('smarts', 1); add('aggro', 1); name = 'Boss Mode'; why = `${st.n} wins in a row? Time for a real challenge.`; }
    if (h && !(st.kind === 'lost' && st.n >= 2)){
      if (game === 'bubbles' && h.bombs >= 1.5) { add('bombs', 1); name = 'Bomb Alley'; habit = `You hit ${r1(h.bombs)} bombs a round. Practice time!`; }
      else if (game === 'bubbles' && h.reaction > 1.2) { add('pace', -1); habit = 'Take your time, the orbs are slower today.'; }
      if (game === 'space' && h.accuracy < .3) { add('powerups', 1); name = 'Sharpshooter Training'; habit = `Only ${Math.round(h.accuracy * 100)}% of your shots land. More power-ups for you!`; }
      if (game === 'space' && h.hitsTaken >= 4) { add('rocks', 1); habit ||= 'You get hit a lot. Extra asteroids to hide behind!'; }
      if (game === 'brawl' && h.blockSecs < 1.5) { add('aggro', 1); name = 'Learn to Block'; habit = 'You almost never block. Let\'s change that!'; }
      if (game === 'brawl' && h.taken > h.landed * 1.5) { add('speed', -1); habit ||= 'Ouch, you take more hits than you land.'; }
    }
    if (late) { add('speed', -1); add('pace', -1); name = 'Night Owl Chill'; why = 'It\'s late, so here\'s a calmer level.';
      twist = { bubbles: 'bigorbs', space: 'shieldstart', brawl: 'shortrounds' }[game]; }
    else if (rounds.length && Math.random() < .5) { const opts = Object.keys(TWISTS[game]).filter(x => x !== 'none'); twist = opts[Math.floor(Math.random() * opts.length)]; }
    return sanitize(game, { name, twist, knobs: k, why, habit }, 'auto');
  }

  root.ArcadeDesign = { KNOBS, TWISTS, load, save, record, summarize, promptPart, rules, parseMind, autoDesign, sanitize, streakOf, habits };
})(typeof window !== 'undefined' ? window : globalThis);
