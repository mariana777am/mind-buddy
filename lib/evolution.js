// Weekly evolution: once a week your Mind looks at your week and grows the buddy.
// It invents a new outfit (won by finishing a weekly arcade quest), a new dream, and one feature idea for the build.
// Everything it sends is checked against what the app can draw and do.
export const KINDS = ['cap', 'beret', 'headband', 'sweatband', 'halo', 'bow', 'flowers', 'scarf', 'visor'];
export const COLORS = { pink: ['#ff6fb0', '#ffd1e6'], mint: ['#3fd1ab', '#c9fff0'], sky: ['#4fb6ff', '#d6efff'], sunset: ['#ff8a3d', '#ffd84d'], gold: ['#f2bd3a', '#fff1b8'],
  lavender: ['#a78bfa', '#ede4ff'], cherry: ['#ff4d6d', '#ffe0e6'], ocean: ['#2563eb', '#7dd3fc'], lime: ['#84cc16', '#ecfccb'], mono: ['#1f2937', '#f9fafb'] };
export const BADGES = ['⭐', '🌸', '🍀', '🎵', '🎧', '🐾', '🍜', '🧋', '☕', '🏔️', '✈️', '🌙', '☀️', '❄️', '🎄', '🎁', '🔥', '💎', '🍓', '🐉', '🏮', '🎮', '🌊', '🌈', '💫', '🦋', '🐶', '🎀', '⚡', '🍵'];
export const GAMES = { bubbles: 'Bubble Pop', space: 'Space Duel', brawl: 'Desk Brawl' };
const WEEK = 7 * 86400000;

const short = (s, n) => String(s || '').replace(/^["'“”\s]+|["'“”\s]+$/g, '').replace(/[\[\]<>{}|]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const pickIn = (v, list, dflt) => { const s = String(v || '').toLowerCase().replace(/[^a-z]/g, ''); if (!s) return dflt;
  return list.find(x => x === s) || [...list].sort((a, b) => b.length - a.length).find(x => s.includes(x)) || dflt; };
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'outfit';

export function evolutionPrompt({ lately, petLevel = 1, outfits = [], dreams = [], history = [], ideas = [], twists, dreamFormat }){
  const tw = Object.entries(twists).map(([g, t]) => `${g}: ${Object.keys(t).filter(x => x !== 'none').join('/')}`).join('; ');
  return `[weekly evolution, not a chat — no tags] Once a week you, the buddy's Mind, evolve the buddy so it keeps growing with her and stays fresh. ` +
    `Look at her week and create: a NEW outfit for the buddy (she wins it by finishing a weekly arcade quest you design), a NEW dream about her, and ONE idea for a new feature of the buddy app itself.\n` +
    `Her week:\n${lately}\nBuddy level ${petLevel}. Outfits it already has: ${outfits.join(', ') || 'none yet'}.\n` +
    (dreams.length ? `Recent dreams (don't repeat): ${dreams.slice(-5).join('; ')}\n` : '') +
    (history.length ? `Past evolutions: ${history.slice(-4).join('; ')}\n` : '') +
    (ideas.length ? `Past ideas and her answers (learn from them, don't repeat): ${ideas.slice(-6).join('; ')}\n` : '') +
    `Reply ONLY in this exact format on one line, nothing else: TITLE: name of this evolution, max 5 words | OUTFIT: outfit name, max 3 words | KIND: one of ${KINDS.join(', ')} | ` +
    `COLOR: one of ${Object.keys(COLORS).join(', ')} | BADGE: one of ${BADGES.join(' ')} or none | QUEST: quest name, max 4 words | GAME: one of ${Object.keys(GAMES).join(', ')} | ` +
    `TWIST: a twist for that game (${tw}) | ${dreamFormat} | IDEA: one new feature for the buddy app, max 16 words | IDEA_WHY: how her week inspired it, max 14 words | ` +
    `NOTE: a cheerful one-line announcement of this evolution, max 22 words`;
}

export function parseEvolution(text, { twists }){
  const t = String(text || ''), get = k => (t.match(new RegExp('(?:^|[|\\s])' + k + ':\\s*([^|\\n]+)', 'i')) || [])[1];
  const title = get('TITLE'), outfitName = get('OUTFIT'); if (!title || !outfitName) return null;
  const game = pickIn(get('GAME'), Object.keys(GAMES), 'bubbles');
  const twistList = Object.keys(twists[game] || {}).filter(x => x !== 'none');
  const twist = pickIn(get('TWIST'), twistList, twistList[0] || 'none');
  const badge = BADGES.find(b => String(get('BADGE') || '').includes(b)) || '';
  const outfit = { name: short(outfitName, 24), kind: pickIn(get('KIND'), KINDS, 'cap'), color: pickIn(get('COLOR'), Object.keys(COLORS), 'pink'), badge };
  outfit.id = 'evo:' + slug(outfit.name);
  const idea = short(get('IDEA'), 140);
  return {
    title: short(title, 40), outfit,
    quest: { name: short(get('QUEST'), 32) || 'Weekly Challenge', game, twist, twistText: twists[game]?.[twist] || '' },
    idea: idea ? { text: idea, why: short(get('IDEA_WHY'), 120) } : null,
    note: short(get('NOTE'), 160),
  };
}

// the state kept in evolution.json
export function createEvolution({ read, write, now = () => Date.now() }){
  const E = Object.assign({ first: now(), last: 0, history: [], ideas: [], quest: null }, read() || {});
  const save = () => write(E);
  return {
    data: E,
    due(){ const from = E.last || (E.first + 86400000 - WEEK); return now() - from >= WEEK; },   // first one a day after install, then weekly
    add(ev){ const id = now().toString(36);
      E.last = now(); E.quest = { ...ev.quest, outfit: ev.outfit, id, done: false, until: now() + WEEK };
      E.history.push({ t: now(), id, title: ev.title, outfit: ev.outfit.name, quest: ev.quest.name, dream: ev.dream || '', idea: ev.idea?.text || '' }); E.history = E.history.slice(-20);
      if (ev.idea) { E.ideas.push({ id, t: now(), text: ev.idea.text, why: ev.idea.why, status: 'new' }); E.ideas = E.ideas.slice(-30); }
      save(); return id; },
    quest(){ const q = E.quest; return q && !q.done && now() < q.until ? q : null; },
    completeQuest(){ const q = this.quest(); if (!q) return null; q.done = true; q.doneAt = now(); save(); return q; },
    answerIdea(id, yes){ const i = E.ideas.find(x => x.id === id); if (!i || i.status !== 'new') return null; i.status = yes ? 'approved' : 'skipped'; save(); return i; },
    ideasText(){ return E.ideas.map(i => `"${i.text}" → ${i.status}`); },
    historyText(){ return E.history.map(h => `${h.title} (outfit ${h.outfit}, quest ${h.quest})`); },
  };
}

// IDEAS.md in the project folder: the approved ideas, for the next build session
export function ideasMarkdown(ideas){
  const row = i => `- [${i.status === 'built' ? 'x' : ' '}] **${i.text}**  \n  _${i.why || ''}_ (${new Date(i.t).toLocaleDateString('en-CA')}, ${i.status})`;
  const ok = ideas.filter(i => i.status === 'approved' || i.status === 'built'), wait = ideas.filter(i => i.status === 'new'), no = ideas.filter(i => i.status === 'skipped');
  return `# Buddy upgrade ideas from your Mind\n\nEvery week your Mind suggests one new feature for the buddy, based on your week. ` +
    `The ones you approved are listed first: bring this file to your next build session.\n\n## Approved\n${ok.map(row).join('\n') || '_none yet_'}\n\n` +
    `## Waiting for your answer\n${wait.map(row).join('\n') || '_none_'}\n\n## Skipped\n${no.map(row).join('\n') || '_none_'}\n`;
}

// ---------- blind boxes: a surprise outfit your Mind designs from your habits ----------
export const RARITY = { common: { label: 'Common', stars: '★' }, rare: { label: 'Rare', stars: '★★' }, super: { label: 'Super Rare', stars: '★★★' }, secret: { label: 'Secret', stars: '✦' } };
export function rollRarity(r = Math.random()){ return r < .03 ? 'secret' : r < .15 ? 'super' : r < .45 ? 'rare' : 'common'; }
export function blindboxPrompt({ lately, rarity, owned = [] }){
  return `[blind box designer, not a chat — no tags] The user just earned a blind box for her desk buddy. Design the surprise inside: ONE wearable for the buddy, ` +
    `inspired by her habits and week, as part of a collectible "series" with a fun name. Rarity: ${RARITY[rarity].label}` +
    `${rarity === 'secret' ? ' (the rarest: make it extra special and personal)' : rarity === 'super' ? ' (very special)' : ''}.\nHer week:\n${lately}\n` +
    (owned.length ? `Items she already owns (don't repeat): ${owned.slice(-12).join(', ')}\n` : '') +
    `Reply ONLY in this exact format on one line, nothing else: SERIES: series name, max 3 words | OUTFIT: item name, max 3 words | KIND: one of ${KINDS.join(', ')} | ` +
    `COLOR: one of ${Object.keys(COLORS).join(', ')} | BADGE: one of ${BADGES.join(' ')} or none | LINE: a cheerful reveal line, max 14 words | WHY: what inspired it, max 12 words`;
}
export function parseBlindbox(text, rarity){
  const t = String(text || ''), get = k => (t.match(new RegExp('(?:^|[|\\s])' + k + ':\\s*([^|\\n]+)', 'i')) || [])[1];
  const name = get('OUTFIT'); if (!name) return null;
  const outfit = { name: short(name, 24), kind: pickIn(get('KIND'), KINDS, 'cap'), color: pickIn(get('COLOR'), Object.keys(COLORS), 'pink'),
    badge: BADGES.find(b => String(get('BADGE') || '').includes(b)) || '', rarity, series: short(get('SERIES'), 24) || 'Surprise Series' };
  outfit.id = 'evo:' + slug(outfit.name) + '-' + Math.random().toString(36).slice(2, 6);
  return { outfit, line: short(get('LINE'), 120), why: short(get('WHY'), 100) };
}
// when the Mind is busy: still a surprise, from a few habits
export function localBlindbox(rarity, hint = ''){
  const pick = a => a[Math.floor(Math.random() * a.length)], h = String(hint).toLowerCase();
  const badge = /chinese|mandarin|cantonese/.test(h) ? '🏮' : /music|radio/.test(h) ? '🎵' : /travel/.test(h) ? '✈️' : /game|arcade/.test(h) ? '🎮' : pick(BADGES);
  const kind = pick(KINDS), color = pick(Object.keys(COLORS));
  const outfit = { name: `${color[0].toUpperCase() + color.slice(1)} ${kind[0].toUpperCase() + kind.slice(1)}`, kind, color, badge, rarity, series: 'Surprise Series' };
  outfit.id = 'evo:' + slug(outfit.name) + '-' + Math.random().toString(36).slice(2, 6);
  return { outfit, line: 'Ta-da! A little surprise, just for you!', why: '' };
}
