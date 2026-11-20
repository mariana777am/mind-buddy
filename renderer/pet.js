/* Minds Buddy — the light Tamagotchi layer.
   Needs that drift slowly (and never punish), snacks, levels + outfits, petting / tickles / flicks,
   app-aware reactions, instant tricks, a focus timer, little games and synth sound effects.
   Everything here runs on your PC; only quiz / would-you-rather questions ask your Mind. */
(() => {
'use strict';
const NEEDS = [['snack', '🍪'], ['fun', '🎈'], ['love', '💙'], ['energy', '⚡']];
const DECAY_AWAKE = { snack: 6, fun: 7, love: 4, energy: 5 };     // points per hour while you work
const DECAY_AWAY = { snack: 2, fun: 1, love: 3, energy: -25 };    // while napping energy refills
const FOODS = { cookie: ['🍪', { snack: 28 }, 'Nom nom nom! Cookie power!'], apple: ['🍎', { snack: 22, energy: 5 }, 'Crunchy! Healthy me!'],
  noodles: ['🍜', { snack: 40 }, 'Slurrrp! Best. Noodles. Ever.'], coffee: ['☕', { energy: 32, snack: 4 }, 'COFFEE! I can hear colours now!'],
  boba: ['🧋', { snack: 15, fun: 20 }, 'Boba! The chewy bits are my favourite!'] };
const UNLOCKS = [
  { level: 2, id: 'bowtie', label: '🎀 Bow tie' }, { level: 3, id: 'shades', label: '😎 Sunglasses' }, { level: 3, color: 'pink', label: '💗 Pink headset' },
  { level: 4, id: 'party', label: '🥳 Party hat' }, { level: 5, id: 'beanie', label: '🧶 Beanie' }, { level: 5, color: 'mint', label: '🌿 Mint headset' },
  { level: 6, id: 'flower', label: '🌸 Flower' }, { level: 7, color: 'gold', label: '✨ Gold headset' }, { level: 8, id: 'crown', label: '👑 Crown' },
  { level: 9, color: 'galaxy', label: '🌌 Galaxy headset' }, { level: 10, id: 'wizard', label: '🧙 Wizard hat' } ];
const COLORS = { classic: ['#3a3f4f', '#202431', '#2a2e3b'], pink: ['#ef6aa7', '#a8326a', '#c8477f'], mint: ['#3fd1ab', '#1d8a6e', '#25a383'],
  gold: ['#f2bd3a', '#a87412', '#c99320'], galaxy: ['#7457ff', '#2a1a7a', '#4a33c4'] };
const xpFor = L => 40 * L * L;                                     // XP needed to reach level L+1

const P = Object.assign({ snack: 80, fun: 80, love: 80, energy: 80, xp: 0, level: 1, streak: 0, lastDay: '', wearing: null, color: 'classic',
  focusDone: 0, focus: null, last: Date.now(), born: Date.now(), wins: 0, flags: {} }, {});
let loaded = false, saveT = null, lastTouch = now(), lastNag = 0, muteUntil = 0, inCall = false, callSeen = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { P.last = Date.now(); B.storeSet?.('pet', P); sendNote(); }, 400); };
const clamp = v => Math.max(5, Math.min(100, v));
const today = () => new Date().toLocaleDateString('en-CA');
const quietNow = () => INFO.quiet || P.focus || inCall || S.asleep;
const silentSay = (text, mood = 'happy', action = null) => say({ text, mood, action, silent: true });
const queue = [];
const idle = () => !S.asleep && !S.talking && !S.thinking && !S.listening && !sticky && !(typeof rec !== 'undefined' && rec && rec.state === 'recording') &&
  now() > (S.busyUntil || 0);
function later(fn){ queue.push(fn); }
setInterval(() => { if (queue.length && idle()) queue.shift()(); }, 400);

// ---------- load + catch up on the time you were away ----------
(async () => {
  const saved = await B.storeGet?.('pet').catch(() => null);
  const first = !saved;
  if (saved) Object.assign(P, saved);
  const awayH = Math.min(12, (Date.now() - (P.last || Date.now())) / 36e5);
  for (const [k] of NEEDS) P[k] = clamp(P[k] - DECAY_AWAY[k] * awayH);
  P.flags ||= {};
  if (P.flags.day !== today()) P.flags = { day: today() };          // daily one-time lines reset
  loaded = true; applyColor(); touchDay(); save();
  if (P.focus && P.focus.end > Date.now()) startFocusTicker(); else P.focus = null;
  if (first) setTimeout(() => later(() => say({ text: 'Psst! I\'m a little bit of a pet now. Feed me, play with me, pet me, and I level up and unlock outfits!', mood: 'excited', action: 'jump' })), 7000);
})();
function touchDay(){
  const d = today(); if (P.lastDay === d) return;
  const y = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
  P.streak = P.lastDay === y ? (P.streak || 0) + 1 : 1; P.lastDay = d;
  if (P.streak > 1) { gainXp(10, false); setTimeout(() => later(() => silentSay(`🔥 ${P.streak}-day streak! You keep coming back to me!`, 'proud', 'cheer')), 12000); }
}

// ---------- needs over time ----------
setInterval(() => {
  if (!loaded) return;
  const h = 30 / 3600, rate = S.asleep ? DECAY_AWAY : DECAY_AWAKE;
  for (const [k] of NEEDS) P[k] = clamp(P[k] - rate[k] * h * (k === 'energy' && P.focus ? 1.4 : 1));
  touchDay(); save(); moodFromNeeds();
}, 30000);
function lowest(){ return NEEDS.map(([k]) => [k, P[k]]).sort((a, b) => a[1] - b[1])[0]; }
function moodFromNeeds(){
  if (S.asleep || S.talking || S.thinking) return;
  const [k, v] = lowest();
  if (v < 22 && Math.random() < .5) {
    if (k === 'snack') floaty('🍪?', HX + 55, HY - 40);
    if (k === 'energy') { act('shrug'); floaty('🥱', HX + 55, HY - 40); }
    if (k === 'fun') floaty('😐', HX + 55, HY - 40);
    if (k === 'love') { S.eyeStyle = 'puppy'; S.eyeUntil = now() + 8000; }
  }
  if (v < 25 && !quietNow() && Date.now() - lastNag > 50 * 60000 && idle()) {
    lastNag = Date.now();
    const L = { snack: ['My tummy is rumbling… cookie? 🥺', 'feed', 'cookie', '🍪 Feed me'], fun: ['I\'m sooo bored… play a game with me?', 'play', 'rps', '🎮 Play'],
      love: ['Psst… I could use a little head pat. Just saying.', 'pat', null, '💙 Pat'], energy: ['So… sleepy… coffee? ☕', 'feed', 'coffee', '☕ Coffee'] }[k];
    S.mood = k === 'energy' ? 'sleepy' : 'worried';
    show(`${esc(L[0])}<div class="btns"><button data-pet="${L[1]}" data-arg="${L[2] || ''}">${L[3]}</button><button class="alt" data-pet="later">Later</button></div>`, { stick: true });
    speak(L[0], S.mood);
  }
}
function bump(changes, xp = 0){ for (const k in changes) P[k] = clamp(P[k] + changes[k]); if (xp) gainXp(xp); save(); renderNeeds(); }
function gainXp(n, announce = true){
  P.xp += n;
  while (P.xp >= xpFor(P.level)) {
    P.xp -= xpFor(P.level); P.level++;
    const un = UNLOCKS.filter(u => u.level === P.level);
    if (announce) later(() => { sfx('fanfare'); act('cheer'); burst(['🎉', '⭐', '✨', '🎊'], 22);
      say({ text: `LEVEL UP! I'm level ${P.level}!` + (un.length ? ` I unlocked ${un.map(u => u.label.replace(/^\S+\s/, '')).join(' and ')}! Check my Wardrobe.` : ' Woohoo!'), mood: 'excited', action: 'cheer' }); });
  }
  save();
}
function sendNote(){
  B.petNote?.(`Light Tamagotchi state (just for fun, never serious): snack ${Math.round(P.snack)}%, fun ${Math.round(P.fun)}%, love ${Math.round(P.love)}%, energy ${Math.round(P.energy)}%; ` +
    `level ${P.level}, ${P.streak}-day streak${P.focus ? ', the user is in a FOCUS session: keep replies extra short and cheer them on' : ''}. ` +
    `If a need is low you may hint at it playfully once in a while (e.g. "I could go for a cookie…"), never guilt-trip. You can use [action:flip], [action:love], [action:giggle] too.`);
}

// ---------- needs panel (hover the head) ----------
const needsEl = document.getElementById('needs');
function renderNeeds(){
  const col = v => v > 55 ? '#4ade80' : v > 25 ? '#fbbf24' : '#f87171';
  needsEl.innerHTML = `<span class="lv">Lv ${P.level}</span>` + NEEDS.map(([k, ic]) => `<span class="n">${ic}<span class="bar"><i style="width:${P[k]}%;background:${col(P[k])}"></i></span></span>`).join('') +
    (P.streak > 1 ? `<span>🔥${P.streak}</span>` : '') + (P.focus ? `<span>🎯</span>` : '');
}
let hoverT = null, overNow = false;
function showNeeds(on){ if (on && !bubble.classList.contains('show') && !S.asleep) { renderNeeds(); needsEl.classList.add('show'); } else needsEl.classList.remove('show'); }

// ---------- petting + tickles (mouse over the head, no clicking) ----------
let hv = { x: 0, y: 0, t: 0, petMs: 0, flips: [], lastDx: 0, petting: false, lastPetXp: 0, lastTickle: 0 };
function hoverMove(e, over){
  const t = now(), dt = Math.max(1, t - hv.t), dx = e.screenX - hv.x, dy = e.screenY - hv.y, speed = Math.hypot(dx, dy) / dt * 1000;
  hv.x = e.screenX; hv.y = e.screenY; hv.t = t;
  if (over !== overNow) { overNow = over; clearTimeout(hoverT); if (over) hoverT = setTimeout(() => showNeeds(true), 450); else { showNeeds(false); hv.petMs = 0; if (hv.petting) stopPetting(); } }
  if (!over || S.asleep || dt > 200) return;
  if (speed > 1500) {                                        // fast wiggle = tickle
    if (Math.sign(dx) && Math.sign(dx) !== Math.sign(hv.lastDx)) hv.flips.push(t);
    hv.lastDx = dx; hv.flips = hv.flips.filter(f => t - f < 1200);
    if (hv.flips.length >= 6 && t - hv.lastTickle > 4000) { hv.lastTickle = t; hv.flips = []; tickle(); }
  } else if (speed > 30 && speed < 700) {                    // slow rub = petting
    hv.petMs += dt;
    if (hv.petMs > 1100 && !hv.petting) startPetting();
    if (hv.petting) { S.eyeUntil = t + 900; if (Math.random() < .05) floaty('💙', HX + (Math.random() - .5) * 60, HY - 50);
      if (t - hv.lastPetXp > 1500) { hv.lastPetXp = t; bump({ love: 3 }, 1); } }
  }
  lastTouch = t;
}
function startPetting(){ hv.petting = true; S.eyeStyle = 'heart'; S.eyeUntil = now() + 900; S.mood = 'happy'; act('love', 1500); sfx('purr');
  if (!bubble.classList.contains('show')) show(['Mmmm… right there… 😌', 'Aww, head pats! Best day ever!', 'Purrrr… wait, I\'m not a cat. Purrrr anyway.'][Math.floor(Math.random() * 3)], { ms: 2500 }); }
function stopPetting(){ hv.petting = false; }
function tickle(){ S.eyeStyle = 'happy'; S.eyeUntil = now() + 1600; act('giggle', 1600); sfx('giggle'); burst(['😆', '✨'], 6);
  show(['Hahaha stop! …don\'t stop!', 'Eeek! That tickles! 🤭', 'Hehehe no fair!'][Math.floor(Math.random() * 3)], { ms: 2600 }); bump({ fun: 6 }, 2); }

// ---------- drag, flick, bounce, high five, peekaboo ----------
function dizzy(){ S.dizzy = now() + 2800; sfx('whoosh'); setTimeout(() => show('Whoaaa… the room is spinning… 😵‍💫', { ms: 2600 }), 300); bump({ fun: 3 }); }
let flying = false;
function flung(){ flying = true; sfx('whoosh'); S.mood = 'excited'; }
B.on.bump?.(({ side, speed }) => { sfx('bounce', Math.min(1, speed / 30)); S.poke = 1; S.antV += .6; if (Math.random() < .3) floaty(['💫', '⭐', '💥'][Math.floor(Math.random() * 3)], HX + (side === 'left' ? -60 : side === 'right' ? 60 : 0), HY - 30); });
B.on.landed?.(({ bumps }) => { if (!flying) return; flying = false; act('jump'); sfx('pop');
  show(bumps > 2 ? ['Wheee! AGAIN! AGAIN!', 'That was AMAZING! Do it again!', 'I\'m a bouncy ball! Boing boing!'][Math.floor(Math.random() * 3)] : 'Whee! Hehe.', { ms: 2800 });
  bump({ fun: 8 }, 3); if (bumps > 3) { S.dizzy = now() + 1800; } });
function overHand(x, y){ return S.hand > .3 && (x - (HX + R + 14)) ** 2 + (y - (HY - 26)) ** 2 < 24 ** 2; }
function highFive(){ sfx('clap'); burst(['🙌', '💥', '✨'], 10); S.handT = 0; act('cheer'); show(['Boom! 🙌', 'Up top! Yesss!', 'High five! We\'re unstoppable!'][Math.floor(Math.random() * 3)], { ms: 2400 }); bump({ love: 5, fun: 4 }, 3); }
function offerHighFive(){ act('wave', 3800); S.handT = 1; show('Up top! ✋ Click my hand!', { ms: 3800 }); }
B.on.peekaboo?.(() => { act('jump'); sfx('pop'); S.eyeStyle = 'stars'; S.eyeUntil = now() + 1500; show(['Boo! 👻 Did you miss me?', 'Peekaboo! I see you!', 'I\'m baaack!'][Math.floor(Math.random() * 3)], { ms: 3000 }); });
function poked(){ sfx('boop'); lastTouch = now(); bump({ love: 1, fun: 1 }); }

// ---------- strolls along the taskbar ----------
B.on.walking?.(({ dir }) => { S.walking = dir; stepSounds(true); });
B.on.walked?.(() => { S.walking = 0; stepSounds(false); });
let stepT = null; function stepSounds(on){ clearInterval(stepT); if (on) stepT = setInterval(() => sfx('step'), 260); }
let lastStroll = Date.now();
setInterval(() => {
  if (quietNow() || S.listening || S.thinking || bubble.classList.contains('show')) return;
  const bored = now() - lastTouch > (P.fun < 40 ? 12 : 25) * 60000;
  if (bored && Date.now() - lastStroll > 20 * 60000 && Math.random() < .35) {
    lastStroll = Date.now(); const peek = Math.random() < .3;
    B.walk?.((Math.random() < .5 ? -1 : 1) * (150 + Math.random() * 300), peek);
    setTimeout(() => show(peek ? 'Just peeking… 👀' : ['Just stretching my legs!', 'La la la… taking a little walk.', 'Patrolling the taskbar! All clear.'][Math.floor(Math.random() * 3)], { ms: 2500 }), 400);
  }
}, 60000);

// ---------- feeding ----------
let food = null;
function feed(id){
  const f = FOODS[id] || FOODS.cookie;
  if (P.snack > 94 && id !== 'coffee') { act('shrug'); S.eyeStyle = 'happy'; S.eyeUntil = now() + 1200; show('I\'m stuffed! 😵 Maybe later?', { ms: 2600 }); return; }
  if (id === 'coffee' && P.energy > 95) { show('Any more coffee and I\'ll vibrate off the screen! ☕⚡', { ms: 2600 }); return; }
  food = { ch: f[0], t0: now() }; sfx('pop');
  setTimeout(() => { food = null; let n = 0; const m = setInterval(() => { sfx('munch'); S.mouth = n % 2 ? .2 : .9; S.talking = true; if (++n > 5) { clearInterval(m); S.talking = false; S.mouth = 0; } }, 150);
    S.eyeStyle = 'happy'; S.eyeUntil = now() + 1600; act(id === 'coffee' ? 'jump' : 'giggle', 1200); burst([f[0], '✨'], 5);
    bump(f[1], 4); setTimeout(() => say({ text: f[2], mood: id === 'coffee' ? 'excited' : 'happy' }), 700);
    if (id === 'coffee') S.jitter = now() + 6000; }, 750);
}

// ---------- focus timer (pomodoro) ----------
let focusTick = null;
function startFocus(min){
  if (!min) return stopFocus(true);
  P.focus = { end: Date.now() + min * 60000, minutes: min }; save(); startFocusTicker();
  sfx('ding'); act('nod'); say({ text: `Focus mode! ${min} minutes, shades on. I'll guard your focus like a tiny blue bodyguard.`, mood: 'focused', action: 'nod' });
}
function startFocusTicker(){
  clearInterval(focusTick);
  focusTick = setInterval(() => {
    if (!P.focus) return clearInterval(focusTick);
    const left = P.focus.end - Date.now();
    chip.textContent = `🎯 ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; chip.classList.add('show');
    if (left <= 0) finishFocus();
  }, 1000);
}
function stopFocus(byUser){ clearInterval(focusTick); chip.classList.remove('show'); if (P.focus && byUser) silentSay('Focus stopped. No worries, we\'ll get \'em next time!', 'calm', 'nod'); P.focus = null; save(); }
function finishFocus(){
  const m = P.focus.minutes; stopFocus(false); P.focusDone++;
  sfx('fanfare'); act('cheer'); burst(['🎉', '🎯', '⭐', '✨', '🎊'], 26); bump({ fun: 10, energy: -5 }, Math.round(m));
  say({ text: `WE DID IT! ${m} minutes of pure focus! You're a legend.`, mood: 'excited', action: 'cheer' });
  setTimeout(() => show(`<span class="tag fix">🎯 focus done</span><br>Session #${P.focusDone}! What now?<div class="btns"><button data-pet="break">🧘 5-min break</button><button class="alt" data-pet="focus" data-arg="${m}">🔁 Again</button></div>`, { stick: true }), 5000);
}
function stretchBreak(){
  const steps = [['Arms up high! Reach for the ceiling! 🙆', 'jump'], ['Roll your shoulders back… and forward… 🔄', 'dance'], ['Look at something far away for 20 seconds 👀', 'think'],
    ['Big sip of water! 💧', 'nod'], ['Break\'s over! Let\'s gooo!', 'cheer']];
  steps.forEach(([t, a], i) => setTimeout(() => { if (i === steps.length - 1) sfx('ding'); say({ text: t, mood: 'happy', action: a }); }, i * 60000));
  bump({ energy: 12, fun: 5 }, 3);
}

// ---------- games ----------
let game = null;
const pick = a => a[Math.floor(Math.random() * a.length)];
function gamePicker(){ show(`<span class="tag q">🎮 let's play!</span><br>Pick a game!<div class="btns"><button data-pet="arcade" data-arg="bubbles">🫧 Bubbles</button><button data-pet="arcade" data-arg="space">🚀 Space</button><button data-pet="arcade" data-arg="brawl">🥊 Fight!</button><button data-pet="play" data-arg="rps">✊ Rock paper scissors</button><button data-pet="play" data-arg="guess">🔢 Guess</button><button data-pet="play" data-arg="quiz">❓ Quiz</button><button data-pet="play" data-arg="wyr">🤔 Would you rather</button></div>`, { stick: true }); speak('Ooh, game time! Pick one!', 'excited'); }
function play(id){
  if (id === 'rps') { game = { id, round: 1, me: 0, you: 0 }; rpsAsk(); }
  else if (id === 'guess') { game = { id, n: 1 + Math.floor(Math.random() * 20), tries: 0 }; act('think'); say({ text: 'I\'m thinking of a number from 1 to 20. Say or type your guess! You get 5 tries.', mood: 'excited' }); }
  else if (id === 'quiz') quiz();
  else if (id === 'wyr') wyr();
  else if (id === 'highfive') offerHighFive();
  else if (id === 'dance') dance();
}
function rpsAsk(){ show(`<span class="tag q">✊ round ${game.round} of 3</span><br>Rock, paper or scissors?<div class="choices"><button data-rps="rock">✊</button><button data-rps="paper">✋</button><button data-rps="scissors">✌️</button></div>`, { stick: true }); }
function rpsPlay(you){
  const E = { rock: '✊', paper: '✋', scissors: '✌️' }, me = pick(Object.keys(E));
  let i = 0; const words = ['Rock…', 'paper…', 'scissors…', 'SHOOT!'];
  sticky = false; const tick = setInterval(() => { show(`<b style="font-size:18px">${words[i]}</b>`, { stick: true }); sfx('step'); act('nod', 300); if (++i >= words.length) { clearInterval(tick); reveal(); } }, 420);
  function reveal(){
    const win = (you === 'rock' && me === 'scissors') || (you === 'paper' && me === 'rock') || (you === 'scissors' && me === 'paper');
    if (win) game.you++; else if (you !== me) game.me++;
    const line = you === me ? pick(['Tie! Great minds!', 'Jinx! Same same!']) : win ? pick(['Nooo! You got me!', 'Argh! Rematch!', 'You win this one…']) : pick(['Ha! Gotcha!', 'Victory is mine! 😎', 'Too easy! Kidding, kidding.']);
    sfx(win ? 'ding' : you === me ? 'boop' : 'pop'); if (!win && you !== me) act('dance'); else if (win) act('shrug');
    const last = game.round >= 3;
    sticky = false;
    show(`<span style="font-size:26px">${E[you]} vs ${E[me]}</span><br>${esc(line)} <b>${game.you}–${game.me}</b>` + (last ? '' : `<div class="choices"><button data-rps="rock">✊</button><button data-rps="paper">✋</button><button data-rps="scissors">✌️</button></div>`), { stick: !last, ms: 5000 });
    speak(line, 'excited');
    if (last) { const g = game; game = null; setTimeout(() => {
      if (g.you > g.me) { sfx('fanfare'); burst(['🏆', '🎉'], 14); P.wins++; say({ text: `You won ${g.you} to ${g.me}! Champion of the desk!`, mood: 'proud', action: 'cheer' }); bump({ fun: 18 }, 12); }
      else if (g.me > g.you) { say({ text: `I win ${g.me} to ${g.you}! Rematch anytime, if you dare. 😏`, mood: 'excited', action: 'dance' }); bump({ fun: 15 }, 8); }
      else { say({ text: 'A tie! We\'re both winners. Aww.', mood: 'happy', action: 'love' }); bump({ fun: 15 }, 8); } }, 2200); }
    else game.round++;
  }
}
function guessPlay(n){
  game.tries++;
  if (n === game.n) { sfx('fanfare'); burst(['🎉', '🔢', '⭐'], 16); say({ text: `YES! It was ${n}! Got it in ${game.tries} ${game.tries === 1 ? 'try. Are you psychic?!' : 'tries!'}`, mood: 'excited', action: 'cheer' }); bump({ fun: 16 }, 12); game = null; return; }
  if (game.tries >= 5) { say({ text: `Out of tries! It was ${game.n}. So close! Again?`, mood: 'happy', action: 'shrug' }); bump({ fun: 10 }, 5); game = null; return; }
  sfx('boop'); act(n < game.n ? 'jump' : 'nod');
  say({ text: (n < game.n ? 'Higher! ⬆️' : 'Lower! ⬇️') + ` ${5 - game.tries} ${5 - game.tries === 1 ? 'try' : 'tries'} left.`, mood: 'curious' });
}
const QUIZ = [['How many hearts does an octopus have?', '1', '3', '8', 'B'], ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'A'], ['What do bees make?', 'Milk', 'Honey', 'Silk', 'B'],
  ['How many legs does a spider have?', '6', '8', '10', 'B'], ['What is the largest ocean on Earth?', 'Atlantic', 'Indian', 'Pacific', 'C'], ['Which animal is the tallest?', 'Elephant', 'Giraffe', 'Camel', 'B'],
  ['What colour do you get mixing blue and yellow?', 'Green', 'Purple', 'Orange', 'A'], ['Komodo dragons live in which country?', 'Indonesia', 'Brazil', 'Kenya', 'A']];
const WYR = [['have a pet dragon the size of a cat', 'have a cat the size of a dragon'], ['only whisper forever', 'only shout forever'], ['never need sleep', 'never need food'],
  ['live in a treehouse', 'live in a submarine'], ['have spaghetti hair', 'sweat maple syrup'], ['be able to fly but only 1 metre high', 'teleport but only 10 metres']];
async function fromMind(prompt){
  try { const r = await B.ask(`[game helper, not a chat] ${prompt}`); return r?.text || ''; } catch { return ''; }
}
async function quiz(){
  show('<span class="tag q">❓ quiz</span><br>Thinking of a good one… <span class="dots"><span>.</span><span>.</span><span>.</span></span>', { stick: true }); S.thinking = true;
  const t = await fromMind('Give ONE fun, easy-to-medium trivia question with three short options. Reply ONLY in this exact format, nothing else: Q: question | A: option | B: option | C: option | ANSWER: A or B or C');
  S.thinking = false;
  const m = t.match(/Q:\s*(.+?)\s*\|\s*A:\s*(.+?)\s*\|\s*B:\s*(.+?)\s*\|\s*C:\s*(.+?)\s*\|\s*ANSWER:\s*([ABC])/i);
  const q = m ? [m[1], m[2], m[3], m[4], m[5].toUpperCase()] : pick(QUIZ);
  game = { id: 'quiz', answer: q[4], opts: { A: q[1], B: q[2], C: q[3] } };
  sticky = false; show(`<span class="tag q">❓ quiz</span><br><b>${esc(q[0])}</b><div class="btns">${['A', 'B', 'C'].map(k => `<button data-quiz="${k}">${k}: ${esc(q[k === 'A' ? 1 : k === 'B' ? 2 : 3])}</button>`).join('')}</div>`, { stick: true });
  speak(q[0], 'curious');
}
function quizAnswer(k){
  const g = game; game = null; sticky = false;
  if (k === g.answer) { sfx('ding'); burst(['🎉', '🧠'], 12); say({ text: pick(['Correct! Big brain energy! 🧠', 'Yes! You\'re on fire!', 'Nailed it!']), mood: 'excited', action: 'cheer' }); bump({ fun: 14 }, 10); }
  else { sfx('boop'); say({ text: `Ooh, so close! It was ${g.answer}: ${g.opts[g.answer]}. Another one?`, mood: 'happy', action: 'shrug' }); bump({ fun: 10 }, 5); }
  setTimeout(() => { if (!bubble.classList.contains('show')) show('<div class="btns"><button data-pet="play" data-arg="quiz">❓ Another!</button><button class="alt" data-pet="later">Done</button></div>', { ms: 6000 }); }, 4500);
}
async function wyr(){
  show('<span class="tag q">🤔 would you rather</span><br>Hmm, let me think of a weird one… <span class="dots"><span>.</span><span>.</span><span>.</span></span>', { stick: true }); S.thinking = true;
  const t = await fromMind('Give ONE funny, light-hearted "would you rather" with two short options. Reply ONLY in this exact format, nothing else: A: option | B: option');
  S.thinking = false;
  const m = t.match(/A:\s*(.+?)\s*\|\s*B:\s*(.+)/i); const q = m ? [m[1].replace(/[.?!]+$/, ''), m[2].replace(/[.?!]+$/, '')] : pick(WYR);
  game = { id: 'wyr', q }; sticky = false;
  show(`<span class="tag q">🤔 would you rather…</span><div class="btns"><button data-wyr="0">${esc(q[0])}</button><button data-wyr="1">${esc(q[1])}</button></div>`, { stick: true });
  speak(`Would you rather ${q[0]}, or ${q[1]}?`, 'curious');
}
function wyrAnswer(i){
  const mine = Math.random() < .5 ? i : 1 - i; game = null; sticky = false;
  say({ text: mine === i ? pick(['Same!! Great minds think alike!', 'YES. Exactly what I\'d pick!']) : pick(['Ooh, bold choice! I\'d go the other way.', 'Really?! Okay okay, I respect it.']), mood: mine === i ? 'excited' : 'curious', action: mine === i ? 'cheer' : 'shrug' });
  bump({ fun: 10 }, 5);
}
function dance(){ act('dance', 3500); hum(); burst(['🎵', '🎶', '✨'], 8); bump({ fun: 8 }, 2); show(pick(['💃 Watch these moves!', 'Dance party! 🪩', 'Boogie time!']), { ms: 3500 }); }
function celebrate(){ sfx('fanfare'); act('cheer'); burst(['🎉', '✅', '⭐', '🎊'], 22); say({ text: pick(['Yesss! Another one done! 🎉', 'Look at you go! Crushed it!', 'DONE! You\'re a productivity machine!']), mood: 'excited', action: 'cheer' }); bump({ fun: 6, love: 3 }, 5); }
function stats(){
  const next = UNLOCKS.find(u => u.level > P.level);
  const bar = (v, c) => `<span style="display:inline-block;width:60px;height:7px;border-radius:9px;background:#1d224022;vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:${v}%;background:${c}"></i></span>`;
  show(`<span class="tag q">📊 me!</span><br><b>Level ${P.level}</b> ${bar(P.xp / xpFor(P.level) * 100, '#ffd84d')} ${P.xp}/${xpFor(P.level)} XP<br>` +
    NEEDS.map(([k, ic]) => `${ic} ${bar(P[k], P[k] > 55 ? '#4ade80' : P[k] > 25 ? '#fbbf24' : '#f87171')}`).join(' ') +
    `<br>🔥 ${P.streak}-day streak · 🎯 ${P.focusDone} focus sessions` + (next ? `<br><span style="color:#666">Next unlock at Lv ${next.level}: ${next.label}</span>` : ''), { ms: 12000 });
  sfx('boop');
}

// ---------- instant tricks (typed or spoken), before anything goes to your Mind ----------
const W = (re) => new RegExp(`^(?:please |pls |can you |could you |ayo |coba |tolong )?(?:${re})(?: please| pls| dong| yuk| ya)?$`, 'i');
const TRICKS = [
  [W('dance|joget|goyang|do a dance|let\'?s dance|dance for me'), dance],
  [W('(?:do a )?(?:back)?flip|salto|jungkir balik'), () => { act('flip', 1100); sfx('whoosh'); setTimeout(() => show('Ta-da! 🤸', { ms: 2200 }), 900); bump({ fun: 4 }, 1); }],
  [W('spin|putar|muter'), () => { act('spin'); sfx('whoosh'); bump({ fun: 3 }, 1); }],
  [W('jump|lompat|loncat'), () => { act('jump'); sfx('boop'); bump({ fun: 2 }, 1); }],
  [W('wave|dadah|say hi|melambai'), () => { act('wave', 2000); show('👋 Hiii!', { ms: 2000 }); }],
  [W('high five|give me (?:a )?(?:high )?five|tos|tos dulu|hi5'), offerHighFive],
  [W('sing|sing a song|sing for me|nyanyi|bernyanyi'), () => { act('dance', 4000); hum(); show('🎵 La la laaa~ (I hum better than I sing!)', { ms: 4200 }); bump({ fun: 6 }, 2); }],
  [W('(?:i\'?m |i am )?(?:done|finished)(?: with it)?|i did it|selesai|beres|udah selesai|sudah selesai|kelar'), celebrate],
  [W('feed|snack|eat|have a snack|makan|here(?:\'s| is) a (?:cookie|snack)|cookie|kue'), () => feed('cookie')],
  [W('coffee|kopi|have (?:a )?coffee|here(?:\'s| is) (?:a )?coffee'), () => feed('coffee')],
  [W('noodles?|mie|ramen'), () => feed('noodles')], [W('apple|apel'), () => feed('apple')], [W('boba|bubble tea'), () => feed('boba')],
  [W('stats|status|my stats|your stats|level|show stats'), stats],
  [W('(?:let\'?s )?play(?: a game)?|game|games|main|main yuk|ayo main|main game'), gamePicker],
  [W('rock paper scissors|rps|suit|suwit|batu gunting kertas'), () => play('rps')],
  [W('arcade|open (?:the )?arcade|game arcade|play arcade'), () => arcade(null)],
  [W('(?:play )?(?:the )?bubble(?: pop)?(?: game| battle)?|pop (?:the )?bubbles|main (?:gelembung|balon)'), () => arcade('bubbles')],
  [W('(?:play )?(?:the )?(?:space|spaceship|shooter|shooting)(?: game| duel| shooter)?|tembak(?:-|an )?(?:pesawat)?'), () => arcade('space')],
  [W('fight(?: me)?|let\'?s fight|(?:play )?(?:the )?(?:fighting|street ?fighter|brawl|desk brawl)(?: game)?|berantem|tinju|duel'), () => arcade('brawl')],
  [W('guess the number|guessing game|tebak angka'), () => play('guess')],
  [W('quiz|trivia|kuis'), () => play('quiz')],
  [W('would you rather|pilih mana'), () => play('wyr')],
  [W('stop focus|end focus|cancel focus|berhenti fokus|stop fokus'), () => stopFocus(true)],
];
const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };
// "nine eight eight" → "988", "ninety eight point eight" → "98.8", "sembilan puluh lapan" → "98"
const NUM1 = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, nol: 0, kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, lapan: 8, sembilan: 9 };
const NUM10 = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, sepuluh: 10, sebelas: 11 };
const NUMT = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMRE = new RegExp(`\\b(?:(?:${[...Object.keys(NUM1), ...Object.keys(NUM10), ...Object.keys(NUMT), 'hundred', 'ratus', 'seratus', 'puluh', 'point', 'dot', 'titik', 'koma'].join('|')})\\b[\\s-]*)+`, 'gi');
function spokenNumbers(text){
  return String(text || '').replace(NUMRE, (m, off, all) => {
    const tk = m.toLowerCase().split(/[\s-]+/).filter(Boolean), after = all.slice(off + m.length);
    const nums = tk.filter(w => !/^(point|dot|titik|koma)$/.test(w));
    if (nums.length < 2 && !/^\s*(fm|am)\b/i.test(after)) return m;          // a lone "one" in a sentence stays a word
    let out = '', i = 0;
    const small = () => {                                                    // 0–99 starting at tk[i]
      const w = tk[i];
      if (w in NUMT) { let v = NUMT[w]; i++; if (tk[i] in NUM1 && NUM1[tk[i]] > 0) v += NUM1[tk[i++]]; return v; }
      if (w in NUM10) { i++; return NUM10[w]; }
      if (w in NUM1) { let v = NUM1[w]; i++; if (tk[i] === 'puluh') { i++; v *= 10; if (tk[i] in NUM1) v += NUM1[tk[i++]]; } return v; }
      return null; };
    while (i < tk.length){
      const w = tk[i];
      if (/^(point|dot|titik|koma)$/.test(w)) { if (out) out += '.'; i++; continue; }
      if (w === 'seratus') { i++; const r = small(); out += String(100 + (r ?? 0)); continue; }
      const start = i, v = small(); if (v === null) { i++; continue; }
      if (tk[i] === 'hundred' || tk[i] === 'ratus') { i++; const r = tk[i] && !/^(point|dot|titik|koma)$/.test(tk[i]) ? small() : null; out += String(v * 100 + (r ?? 0)); continue; }
      out += String(v);
    }
    return out + (/\s$/.test(m) ? ' ' : '');
  });
}

// a radio request anywhere in what you said: "Thanks. Now I want some music. Find channel nine eight eight FM country Malaysia."
function radioAsk(text){
  const parts = spokenNumbers(text).toLowerCase().split(/(?<!\d)[.!?]+|[.!?]+(?!\d)/).map(x => x.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const RADIO = /\b(fm|am|radio|channel|station|stasiun|saluran|frekuensi|frequency)\b|\b(?:8[7-9]|9\d|10[0-8])\.\d\b|\b(?:8[7-9]\d|9\d\d|10[0-8]\d)\b/,   // words, or an FM-band number like 98.8 / 988
  DO = /\b(play|find|search|look for|listen|tune|put on|switch to|change to|cari|carikan|putar|setel|dengar|dengarkan|pasang|nyalakan)\b/;
  for (let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    if (!RADIO.test(p) || p.split(' ').length > 14 || /\b(who|why|when|how|what is|what's|siapa|kenapa|bagaimana|youtube|game|arcade)\b/.test(p)) continue;
    if (DO.test(p) || DO.test(parts[i - 1] || '')) return p;
  }
  return null;
}
async function local(text){
  const t = text.toLowerCase().replace(/^(?:hey|hi|hai|ok|okay)[\s,]+/, '').replace(/^(?:buddy|puppetmind)[\s,]+/, '').replace(/[.!?,]+/g, ' ').replace(/\s+/g, ' ').trim();
  lastTouch = now();
  if (game?.id === 'guess') { const m = t.match(new RegExp(`^(?:is it |maybe |i guess |i think |my guess is |coba |mungkin |angka )?(\\d{1,2}|${Object.keys(NUMW).join('|')})$`)); if (m) { guessPlay(Number(m[1]) || NUMW[m[1]]); return true; } }
  if (game?.id === 'rps') { const m = t.match(/\b(rock|paper|scissors?|batu|kertas|gunting)\b/); if (m) { rpsPlay({ batu: 'rock', kertas: 'paper', gunting: 'scissors', scissor: 'scissors' }[m[1]] || m[1]); return true; } }
  if (game?.id === 'quiz') { const m = t.match(/^(?:answer |jawab )?([abc])$/); if (m) { quizAnswer(m[1].toUpperCase()); return true; } }
  const f = t.match(/^(?:start (?:a )?)?(?:focus|fokus|pomodoro)(?: (?:for |selama )?(\d{1,3})(?: ?(?:min(?:ute)?s?|menit))?)?(?: timer| mode)?$/) || t.match(/^(?:start )?(?:a )?(\d{1,3})[- ]?(?:min(?:ute)?s?|menit) (?:focus|fokus)$/);
  if (f) { startFocus(Math.min(180, Math.max(1, Number(f[1]) || 25))); return true; }
  // music: "play <song>", "jazz radio", "radio indonesia", "pause/stop/next music"
  const GAMEY = /\b(game|rock paper|bubble|space|shooter|fight|brawl|quiz|guess|would you rather|arcade|rps|suit)\b/;
  let mm;
  if ((mm = t.match(/^(?:stop|matikan|hentikan)(?: the)? (?:music|song|radio|lagu|musik)$/))) { B.music?.({ op: 'stop' }); show('Music off! 🤫', { ms: 1800 }); return true; }
  if (/^(?:pause|jeda)(?: (?:the )?(?:music|song|radio|lagu|musik))?$/.test(t)) { B.music?.({ op: 'pause' }); return true; }
  if (/^(?:resume|continue|lanjut(?:kan)?)(?: (?:the )?(?:music|song|radio|lagu|musik))?$/.test(t)) { B.music?.({ op: 'resume' }); return true; }
  if (/^(?:next|skip)(?: (?:song|track|station|lagu))?$|^lagu (?:berikutnya|selanjutnya)$/.test(t)) { B.music?.({ op: 'next' }); return true; }
  if ((mm = t.match(/^(?:play |putar |setel |puterin )?(?:some |a |the )?(.*?)\s*(?:radio|station|stasiun radio)$/)) || (mm = t.match(/^(?:play |putar |setel )?(?:radio|stasiun radio)\s+(.+)$/))) {
    const q = (mm[1] || 'pop').trim() || 'pop'; startMusic('radio', q); return true; }
  { const rq = radioAsk(text); if (rq) { startMusic('radio', rq); return true; } }
  // "find channel 988 fm country malaysia", "tune in to 98.8", "cari radio malaysia": a radio request, handled here (no Mind needed)
  if ((mm = t.match(/^(?:(?:can you|could you|please|tolong|coba)\s+)?(?:find|search(?: for)?|look for|cari(?:kan)?|tune(?: in)?(?: to| into)?|listen to|dengar(?:kan)?|put on|switch to|change to|ganti ke|pasang|open|buka)\s+(.+)$/))
      && /\b(radio|fm|am|channel|station|stasiun|saluran|frequency|frekuensi)\b|\b\d{2,3}(?:\.\d)?\b/.test(mm[1]) && !GAMEY.test(mm[1])) { startMusic('radio', mm[1]); return true; }
  if ((mm = t.match(/^(?:play|putar|setel|puterin|mainkan|nyanyikan)\s+(.+?)(?:\s+(?:on|di)\s+youtube)?$/)) && !GAMEY.test(mm[1])) {
    if (/\b(fm|am|channel|station|stasiun|saluran)\b|\b\d{2,3}(?:\.\d)?\b|\bradio\b/.test(mm[1]) && !/youtube/.test(t)) { startMusic('radio', mm[1]); return true; }   // "play 988 fm" is a radio station
    startMusic('yt', mm[1]); return true; }
  if (t.split(' ').length > 6) return false;
  for (const [re, fn] of TRICKS) if (re.test(t)) { forceHide(); fn(); return true; }
  return false;
}

// ---------- app-aware reactions (from the window you're in; nothing extra leaves your PC) ----------
const APPS = [
  ['call', /\bzoom\b|teams|meet\.google|google meet|webex|skype/, null],
  ['video', /youtube(?!.*music)|netflix|prime video|disney\+|vlc|twitch|vidio|viu|iqiyi|wetv/, ['Ooh, break time? I\'ll keep watch 👀', 'Popcorn? 🍿 Save me some!', 'Is it a good one? No spoilers!']],
  ['music', /spotify|youtube music|apple music|soundcloud|joox|deezer/, ['♪ Ooh, I like this one!', 'Music on! *bops head*', 'DJ, turn it up! 🎧']],
  ['code', /visual studio|vs ?code|\bcode\b|cursor|intellij|pycharm|webstorm|android studio|sublime|notepad\+\+/, ['Code mode! May your bugs be tiny 🐛', 'Let\'s ship it! 🚀', 'Semicolons ready? Let\'s go!']],
  ['sheets', /excel|google sheets|\.xlsx|numbers/, ['Number-crunching mode, go! 🔢', 'Spreadsheet wizard spotted! 🧙']],
  ['email', /outlook|gmail|thunderbird|\bmail\b/, ['Inbox time! Ctrl+Alt+F fixes your typos ✏️', 'Email ninja mode! 🥷']],
  ['slides', /powerpoint|google slides|keynote|canva/, ['Ooh, slides! Make \'em pretty! 🎨', 'Presentation time? You\'ll rock it!']],
  ['docs', /word|google docs|notion|obsidian/, ['Writing time! I\'m your typo bodyguard 🛡️', 'Words, assemble! ✍️']],
  ['social', /instagram|facebook|tiktok|twitter|x\.com|reddit|threads/, ['Scroll patrol! 👮 Five more minutes?', 'Ooh, what\'s trending? Don\'t get lost in there!']],
  ['games', /steam|epic games|minecraft|roblox|valorant|genshin|mobile legends|league of legends/, ['GAME TIME?! I\'m cheering for you! 🎮', 'Go go go! Win one for me!']],
];
const cool = {}; let lastReact = 0, bopUntil = 0; const seen = new Map();
B.on.activity?.(({ app, title, activeMin }) => {
  const s = `${app} ${title}`.toLowerCase(), cat = APPS.find(([, re]) => re.test(s));
  if (cat?.[0] === 'call') { if (!inCall) { inCall = true; if (typeof HF !== 'undefined' && HF.on) hfMeeting(); else silentSay('Call time! I\'ll stay quiet 🤫', 'calm', 'nod'); } callSeen = Date.now(); return; }
  if ((cat?.[0] === 'music' || cat?.[0] === 'video') && typeof hfMedia === 'function') hfMedia((s.match(cat[1])?.[0] || app || 'something').replace(/\.exe$/i, '').replace(/^./, c => c.toUpperCase()));
  if (inCall && Date.now() - callSeen > 60000) { inCall = false; }
  if (cat?.[0] === 'music') bopUntil = now() + 90000;
  // back to an unfinished email / draft after a while
  const key = title.slice(0, 80), prev = seen.get(key); seen.set(key, Date.now());
  if (prev && Date.now() - prev > 20 * 60000 && /draft|untitled|re:|reply|compose|new message|pesan baru/i.test(title) && !quietNow() && Date.now() - lastReact > 4 * 60000) {
    lastReact = Date.now(); silentSay(pick(['Back to that one? You got this! 💪', 'Ooh, round two! Let\'s finish it!']), 'happy', 'nod'); return; }
  if (activeMin >= 45 && activeMin % 45 < 1 && !quietNow() && Date.now() - lastReact > 30 * 60000) { lastReact = Date.now(); silentSay(`${activeMin} minutes straight! You're on fire 🔥`, 'proud', 'cheer'); return; }
  if (!cat || !cat[2] || quietNow() || !idle()) return;
  if (Date.now() - lastReact < 6 * 60000 || Date.now() - (cool[cat[0]] || 0) < 40 * 60000 || Math.random() < .4) return;
  lastReact = cool[cat[0]] = Date.now();
  sfx('boop'); if (cat[0] === 'video') { S.eyeStyle = 'stars'; S.eyeUntil = now() + 2500; }
  silentSay(pick(cat[2]), 'excited', cat[0] === 'games' ? 'cheer' : 'wink'); bump({ fun: 2 });
});
setInterval(() => { if (bopUntil > now() && !S.talking && !S.asleep && now() > S.actionT) { S.bob = 0; act('nod', 600); } }, 1300);

// ---------- time of day ----------
function timeOfDay(){
  if (!loaded || S.asleep) return;
  const d = new Date(), h = d.getHours(), day = d.getDay(), F = P.flags;
  const once = (k, fn) => { if (!F[k]) { F[k] = 1; save(); later(fn); } };
  if (quietNow()) return;
  if (h >= 6 && h < 11) once('morning', () => say({ text: day === 1 ? 'Good morning! New week, new wins! ☕' : pick(['Good morning, sunshine! Coffee time? ☕', 'Morning! Ready to crush today?']), mood: 'happy', action: 'wave' }));
  if (h === 12) once('lunch', () => say({ text: 'Lunch o\'clock! 🍜 Go eat something yummy. Bring me a noodle?', mood: 'excited', action: 'jump' }));
  if (day === 5 && h >= 15) once('friday', () => { burst(['🎉', '🥳'], 14); say({ text: 'It\'s almost the WEEKEND! 🎉 Party hat on!', mood: 'excited', action: 'dance' }); });
  if (h >= 22 || h < 4) once('late', () => say({ text: 'It\'s getting late… don\'t stay up too long, okay? 🌙', mood: 'sleepy' }));
}
setInterval(timeOfDay, 5 * 60000); setTimeout(timeOfDay, 20000);

// ---------- music: it projects a player and dances along ----------
function startMusic(op, q){ forceHide(); act('dance', 2000); sfx('pop'); burst(['🎵', '🎶'], 8);
  show(op === 'radio' ? `📻 Tuning into some ${esc(q)} radio…` : `🎵 Looking for “${esc(q)}”…`, { ms: 2600 }); B.music?.({ op, arg: q }); }
let musicPlaying = false;
B.on.music?.(st => {
  if (!!st.playing !== musicPlaying) { musicPlaying = !!st.playing; if (typeof hfMusic === 'function') hfMusic(musicPlaying); }
  if (st.playing) { bopUntil = now() + 1e9; if (st.title) { chip.textContent = '🎵 ' + String(st.title).slice(0, 28); chip.classList.add('show'); } }
  else { bopUntil = 0; chip.classList.remove('show'); }
});

// ---------- arcade: the buddy projects a game and plays against you ----------
function arcade(name){ forceHide(); act('jump'); S.eyeStyle = 'stars'; S.eyeUntil = now() + 1600; sfx('pop'); burst(['🎮', '✨'], 8);
  show(name ? pick(['Projecting the game… GAME ON! 🎮', 'Hologram ready! Prepare to lose! 😎', 'Ooh, a challenger! Let\'s gooo!']) : 'Welcome to my arcade! Pick a game! 🕹️', { ms: 3000 }); B.openArcade?.(name); }
B.on.arcade?.(ev => {
  if (ev.type === 'start') { S.mood = 'focused'; act('nod'); }
  if (ev.type === 'result') {
    later(() => {
      if (ev.won) { S.mood = 'worried'; act('shrug'); say({ text: pick(['You beat me! Okay okay, respect. Rematch?', 'Nooo! I demand a rematch!', 'How?! You\'re too good at this!']), mood: 'worried', action: 'shrug' }); bump({ fun: 18, love: 4 }, 14); }
      else if (ev.tie) { say({ text: 'A tie! Best buddies, equally awesome.', mood: 'happy', action: 'love' }); bump({ fun: 15 }, 10); }
      else { burst(['🏆', '😎'], 10); say({ text: pick(['Victory is MINE! Hehe. Good game though!', 'Undefeated champion of the desk! 🏆', 'GG! Want another round to get revenge?']), mood: 'excited', action: 'dance' }); bump({ fun: 14 }, 8); }
      P.wins += ev.won ? 1 : 0;
    });
  }
});

// ---------- menu + buttons ----------
B.on.cmd?.(({ type, arg }) => {
  lastTouch = now();
  if (S.asleep && type !== 'stats' && type !== 'wear' && type !== 'color') { B.wakeMe?.(); S.asleep = false; S.slipT = 0; document.body.style.opacity = '1'; }
  if (type === 'feed') feed(arg); if (type === 'play') play(arg); if (type === 'focus') startFocus(arg); if (type === 'stats') stats();
  if (type === 'wear') { P.wearing = arg; save(); sfx('pop'); burst(['✨'], 6); show(arg ? 'Ooh, how do I look? 😎' : 'Back to basics!', { ms: 2200 }); }
  if (type === 'color') { P.color = arg; applyColor(); save(); sfx('pop'); burst(['✨'], 6); show('Fresh new headset! 🎧', { ms: 2200 }); }
});
bubble.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.rps) rpsPlay(b.dataset.rps);
  if (b.dataset.quiz) quizAnswer(b.dataset.quiz);
  if (b.dataset.wyr) wyrAnswer(Number(b.dataset.wyr));
  const p = b.dataset.pet;
  if (p === 'feed') feed(b.dataset.arg || 'cookie'); if (p === 'play') play(b.dataset.arg); if (p === 'focus') startFocus(Number(b.dataset.arg) || 25);
  if (p === 'arcade') arcade(b.dataset.arg);
  if (p === 'later') forceHide();
  if (p === 'break') stretchBreak(); if (p === 'pat') { startPetting(); bump({ love: 15 }, 2); setTimeout(stopPetting, 1500); }
}, true);
function menuState(){
  const un = UNLOCKS.filter(u => u.level <= P.level), next = UNLOCKS.find(u => u.level > P.level);
  return { level: P.level, focusing: !!P.focus, wearing: P.wearing, color: P.color,
    unlocked: un.filter(u => u.id).map(u => ({ id: u.id, label: u.label })),
    colors: [{ id: 'classic', label: '🎧 Classic' }, ...un.filter(u => u.color).map(u => ({ id: u.color, label: u.label }))],
    nextUnlock: next ? `Next: ${next.label} at level ${next.level}` : 'Everything unlocked! 🏆' };
}
function chatted(r){ lastTouch = now(); bump({ love: 2, fun: 1 }, 2); }
function onAct(a){ if (a === 'jump' || a === 'cheer') sfx('boop', .6); }
function applyColor(){ const c = COLORS[P.color] || COLORS.classic; Object.assign(BUDDY_COLORS, { band: c[0], band2: c[1], cup: c[2] }); }

// ---------- drawing: accessories, props, special eyes ----------
const hourNow = () => new Date().getHours();
function wearing(){
  if (P.focus) return 'shades';
  if (S.asleep && (hourNow() >= 22 || hourNow() < 6)) return 'nightcap';
  if (!P.wearing && new Date().getDay() === 5 && hourNow() >= 15) return 'party';
  return P.wearing;
}
function drawBack(cx, t, R){ if (wearing() === 'flower') { /* drawn in front */ } }
function drawFront(cx, t, R){
  const w = wearing(), ey = -R * .12, gap = R * .27;
  cx.save();
  if (w === 'shades' && !S.asleep) {
    cx.fillStyle = '#111827';
    [-1, 1].forEach(s => { cx.beginPath(); cx.roundRect(s * gap - 17, ey - 11, 34, 22, 9); cx.fill(); });
    cx.fillRect(-6, ey - 6, 12, 4);
    cx.fillStyle = '#ffffff55'; [-1, 1].forEach(s => { cx.beginPath(); cx.ellipse(s * gap - 6, ey - 4, 6, 3, -.4, 0, 7); cx.fill(); });
  }
  if (w === 'bowtie') {
    cx.translate(0, R * .98); cx.fillStyle = '#ff4d79';
    cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-20, -11); cx.lineTo(-20, 11); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(20, -11); cx.lineTo(20, 11); cx.closePath(); cx.fill();
    cx.fillStyle = '#c9184a'; cx.beginPath(); cx.arc(0, 0, 6, 0, 7); cx.fill();
  }
  if (w === 'party' || w === 'wizard') {
    cx.translate(-R * .22, -R * .9); cx.rotate(-.25);
    const h = w === 'wizard' ? 70 : 50, g = cx.createLinearGradient(-20, 0, 20, -h);
    g.addColorStop(0, w === 'wizard' ? '#4c1d95' : '#ff5fa2'); g.addColorStop(1, w === 'wizard' ? '#7c3aed' : '#ffd84d');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(-22, 0); cx.lineTo(w === 'wizard' ? 10 : 0, -h); cx.lineTo(22, 0); cx.closePath(); cx.fill();
    cx.fillStyle = w === 'wizard' ? '#fde047' : '#fff';
    if (w === 'party') { for (let i = 0; i < 3; i++) { cx.beginPath(); cx.arc(-8 + i * 8, -10 - i * 12, 3, 0, 7); cx.fill(); } cx.beginPath(); cx.arc(0, -h, 6, 0, 7); cx.fillStyle = '#7cf'; cx.fill(); }
    else { cx.font = '12px system-ui'; cx.fillText('✦', -6, -18); cx.fillText('✧', 4, -38); cx.fillStyle = '#4c1d95'; cx.beginPath(); cx.ellipse(0, 0, 30, 6, 0, 0, 7); cx.fill(); }
  }
  if (w === 'beanie' || w === 'nightcap') {
    cx.translate(0, -R * .62);
    cx.fillStyle = w === 'beanie' ? '#ff8a3d' : '#6d7bff'; cx.beginPath(); cx.arc(0, 4, R * .78, Math.PI * 1.05, Math.PI * 1.95); cx.closePath(); cx.fill();
    if (w === 'nightcap') { cx.beginPath(); cx.moveTo(R * .5, -R * .2); cx.quadraticCurveTo(R * 1.1, -R * .3, R * 1.05, R * .25); cx.lineTo(R * .7, 0); cx.fill();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(R * 1.05, R * .3, 7, 0, 7); cx.fill(); }
    else { cx.fillStyle = '#ffd1a8'; cx.beginPath(); cx.arc(0, -R * .76, 9, 0, 7); cx.fill(); }
    cx.fillStyle = w === 'beanie' ? '#d9641c' : '#4b55c9'; cx.fillRect(-R * .76, -4, R * 1.52, 11);
  }
  if (w === 'crown') {
    cx.translate(-R * .05, -R * .98); cx.fillStyle = '#facc15';
    cx.beginPath(); cx.moveTo(-24, 0); cx.lineTo(-24, -18); cx.lineTo(-12, -8); cx.lineTo(0, -24); cx.lineTo(12, -8); cx.lineTo(24, -18); cx.lineTo(24, 0); cx.closePath(); cx.fill();
    cx.fillStyle = '#ef4444'; cx.beginPath(); cx.arc(0, -6, 3.5, 0, 7); cx.fill(); cx.fillStyle = '#3b82f6'; cx.beginPath(); cx.arc(-14, -5, 3, 0, 7); cx.arc(14, -5, 3, 0, 7); cx.fill();
  }
  if (w === 'flower') {
    cx.translate(-R * .62, -R * .62);
    cx.fillStyle = '#ff9ecf'; for (let i = 0; i < 5; i++) { cx.beginPath(); cx.ellipse(Math.cos(i * 1.256) * 8, Math.sin(i * 1.256) * 8, 7, 5, i * 1.256, 0, 7); cx.fill(); }
    cx.fillStyle = '#ffd84d'; cx.beginPath(); cx.arc(0, 0, 5, 0, 7); cx.fill();
  }
  cx.restore();
}
function drawProps(cx, t, x, y, R){
  if (food) {                                                  // snack dropping into the mouth
    const p = Math.min(1, (t - food.t0) / 700); cx.font = '26px "Segoe UI Emoji",system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.globalAlpha = 1 - Math.max(0, p - .85) * 6; cx.fillText(food.ch, x, -10 + (y + R * .3 + 10) * (p * p)); cx.globalAlpha = 1;
  }
  const h = hourNow();
  if (!S.asleep && h >= 6 && h < 10 && !food && !P.focus) {                 // morning coffee
    const mx = x + R + 8, my = y + R * .55; cx.fillStyle = '#fff'; cx.beginPath(); cx.roundRect(mx - 9, my - 12, 18, 20, 4); cx.fill();
    cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.beginPath(); cx.arc(mx + 10, my - 2, 5, -1.3, 1.3); cx.stroke();
    cx.fillStyle = '#ff7a1a'; cx.fillRect(mx - 9, my - 6, 18, 4);
    cx.strokeStyle = '#ffffff88'; cx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { cx.beginPath(); const o = Math.sin(t / 400 + i) * 3; cx.moveTo(mx - 3 + i * 6, my - 15); cx.quadraticCurveTo(mx + o + i * 6, my - 22, mx - 3 + i * 6, my - 29); cx.stroke(); }
  }
  if (S.jitter > t) S.antV += (Math.random() - .5) * .25;                 // coffee jitters
}
function drawEye(cx, style, x, y, t){
  cx.save(); cx.translate(x, y);
  if (style === 'heart') { const k = 1 + Math.sin(t / 120) * .08; cx.scale(k, k); cx.fillStyle = '#ff3d71';
    cx.beginPath(); cx.moveTo(0, 9); cx.bezierCurveTo(-16, -2, -10, -16, 0, -7); cx.bezierCurveTo(10, -16, 16, -2, 0, 9); cx.fill();
    cx.fillStyle = '#ffffffaa'; cx.beginPath(); cx.arc(-5, -6, 2.5, 0, 7); cx.fill(); }
  else if (style === 'swirl') { cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(0, 0, 15, 17, 0, 0, 7); cx.fill();
    cx.rotate(t / 90); cx.strokeStyle = BUDDY_COLORS.ink; cx.lineWidth = 2.5; cx.beginPath(); for (let a = 0; a < 14; a += .3) cx.lineTo(Math.cos(a) * a * .85, Math.sin(a) * a * .85); cx.stroke(); }
  else if (style === 'stars') { cx.fillStyle = '#ffd84d'; cx.rotate(Math.sin(t / 200) * .2); cx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 15, a = i * Math.PI / 5 - Math.PI / 2; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.closePath(); cx.fill(); }
  else if (style === 'puppy') { cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(0, 0, 16, 18, 0, 0, 7); cx.fill(); cx.fillStyle = BUDDY_COLORS.ink; cx.beginPath(); cx.arc(0, 3, 11, 0, 7); cx.fill();
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(4, -1, 4, 0, 7); cx.fill(); cx.beginPath(); cx.arc(-4, 7, 2, 0, 7); cx.fill(); }
  else if (style === 'happy') { cx.strokeStyle = BUDDY_COLORS.ink; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(-11, 4); cx.quadraticCurveTo(0, -9, 11, 4); cx.stroke(); }
  cx.restore();
}

// ---------- sound effects (synthesised, tiny and quiet) ----------
let ac2 = null;
function sfx(name, vol = 1){
  if (INFO.sounds === false || INFO.quiet || inCall) return;
  try {
    ac2 ||= new AudioContext(); const a = ac2, t0 = a.currentTime, out = a.createGain(); out.gain.value = .07 * vol; out.connect(a.destination);
    const tone = (f1, f2, d, type = 'sine', at = 0, g = 1) => { const o = a.createOscillator(), e = a.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t0 + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + at + d);
      e.gain.setValueAtTime(0, t0 + at); e.gain.linearRampToValueAtTime(g, t0 + at + .01); e.gain.exponentialRampToValueAtTime(.001, t0 + at + d); o.connect(e); e.connect(out); o.start(t0 + at); o.stop(t0 + at + d + .02); };
    const noise = (d, f, at = 0, g = 1, q = 1) => { const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
      const s = a.createBufferSource(), bp = a.createBiquadFilter(), e = a.createGain(); s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      e.gain.setValueAtTime(g, t0 + at); e.gain.exponentialRampToValueAtTime(.001, t0 + at + d); s.connect(bp); bp.connect(e); e.connect(out); s.start(t0 + at); };
    ({
      boop: () => tone(520, 780, .12), pop: () => tone(300, 900, .09), ding: () => { tone(1320, 0, .5, 'sine', 0, .8); tone(1980, 0, .4, 'sine', .02, .3); },
      giggle: () => [0, .08, .16, .24, .32].forEach((at, i) => tone(950 + i * 90, 1250 + i * 90, .06, 'triangle', at, .8)),
      bounce: () => tone(190, 80, .16, 'sine', 0, 1.4), whoosh: () => noise(.35, 900, 0, .9, .7), clap: () => { noise(.08, 1800, 0, 1.4, .8); noise(.06, 2400, .03, 1, .8); },
      munch: () => noise(.07, 600 + Math.random() * 300, 0, 1.1, 1.5), step: () => tone(140, 90, .05, 'triangle', 0, .5),
      purr: () => { for (let i = 0; i < 6; i++) tone(70, 60, .12, 'sawtooth', i * .1, .25); },
      fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, i === 3 ? .45 : .13, 'square', i * .11, .5)),
    })[name]?.();
  } catch (_) {}
}
function hum(){                                                  // an original little music-box tune
  if (INFO.sounds === false || INFO.quiet || inCall) return;
  const N = [659, 784, 880, 784, 659, 587, 523, 587, 659, 659, 587, 523];
  N.forEach((f, i) => setTimeout(() => { sfx_note(f); if (i % 3 === 0) floaty(i % 2 ? '♪' : '♫', HX + 40 + Math.random() * 30, HY - 40); }, i * 260));
}
function sfx_note(f){ try { ac2 ||= new AudioContext(); const a = ac2, t0 = a.currentTime, o = a.createOscillator(), e = a.createGain(); o.type = 'triangle'; o.frequency.value = f;
  e.gain.setValueAtTime(.06, t0); e.gain.exponentialRampToValueAtTime(.001, t0 + .4); o.connect(e); e.connect(a.destination); o.start(t0); o.stop(t0 + .42); } catch (_) {} }
let snoreT = null;
B.on.sleep?.(() => { showNeeds(false); clearInterval(snoreT); let n = 0; snoreT = setInterval(() => { if (!S.asleep || n++ > 5) return clearInterval(snoreT); noise_snore(); }, 6000); });
function noise_snore(){ if (INFO.sounds === false || INFO.quiet || inCall) return; sfx('purr', .5); }

window.PET = { drawBack, drawFront, drawProps, drawEye, hoverMove, overHand, highFive, dizzy, flung, poked, local, chatted, menuState, onAct,
  muted: () => inCall, lastTouch: () => lastTouch, musicPlaying: () => musicPlaying, sfx, _state: P, _feed: feed, _play: play, _focus: startFocus };
})();
