// The dream "recipe" your Mind writes, and the safe list of things the hologram knows how to draw.
// The Mind picks and combines; the app only draws what's on these lists, so nothing can break.
export const PLACES = ['park', 'city', 'beach', 'mountain', 'lake', 'rooftop', 'stage', 'market', 'space', 'clouds', 'cafe'];
export const PROPS = ['tree', 'sakura', 'bamboo', 'pagoda', 'torii', 'lanterns', 'skyline', 'bridge', 'ferriswheel', 'lighthouse', 'tent', 'campfire',
  'notes', 'headphones', 'speaker', 'microphone', 'guitar', 'piano', 'coffee', 'bubbletea', 'noodles', 'cake', 'book', 'laptop', 'gamepad',
  'moon', 'sun', 'stars', 'fireworks', 'plane', 'balloon', 'boat', 'birds', 'butterflies', 'koi', 'snowman', 'xmastree', 'gift'];
export const HER = ['walk', 'sit', 'dance', 'wave', 'sing', 'hike', 'stargaze'];
export const DOG = ['walk', 'sit', 'run', 'play', 'sleep'];
export const SKY = ['day', 'sunset', 'night'];
export const WEATHER = ['none', 'rain', 'snow', 'petals', 'fireflies', 'confetti'];
export const PALETTES = ['neon', 'sakura', 'ocean', 'sunset', 'jade', 'lantern', 'night', 'gold', 'frost'];

const pick = (v, list, dflt) => { const s = String(v || '').toLowerCase().replace(/[^a-z]/g, ''); if (!s) return dflt;
  return list.find(x => x === s) || [...list].sort((a, b) => b.length - a.length).find(x => s.includes(x)) || list.find(x => x.startsWith(s)) || dflt; };   // "Night Market" → market, "sakura tree" → sakura
const short = (s, n) => String(s || '').replace(/^["'“”\s]+|["'“”\s]+$/g, '').replace(/[\[\]<>{}|]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

export function sanitize(d){
  const props = [...new Set(String(Array.isArray(d?.props) ? d.props.join(',') : d?.props || '').split(/[,;/]+/).map(p => pick(p, PROPS, null)).filter(Boolean))].slice(0, 6);
  const sign = String(d?.sign || '').replace(/[^\p{L}\p{N} .!♪♥★'-]/gu, '').trim().slice(0, 10);
  return {
    title: short(d?.title, 44) || 'a little dream', place: pick(d?.place, PLACES, 'park'), props: props.length ? props : ['stars'],
    her: pick(d?.her, HER, 'walk'), dog: pick(d?.dog, DOG, 'walk'), sky: pick(d?.sky, SKY, 'night'), weather: pick(d?.weather, WEATHER, 'none'),
    palette: pick(d?.palette, PALETTES, 'neon'), sign: /^(none|no|-|n\/a)$/i.test(sign) ? '' : sign, why: short(d?.why, 100),
  };
}
export function parseDream(text){
  const t = String(text || ''), get = k => (t.match(new RegExp('\\b' + k + ':\\s*([^|\\n]+)', 'i')) || [])[1];
  const title = get('DREAM'); if (!title) return null;
  return sanitize({ title, place: get('PLACE'), props: get('PROPS'), her: get('HER'), dog: get('DOG'), sky: get('SKY'), weather: get('WEATHER'), palette: get('PALETTE'), sign: get('SIGN'), why: get('WHY') });
}
export const dreamFormatPart = () => `DREAM: dream title, max 6 words | PLACE: one of ${PLACES.join(', ')} | PROPS: 3 to 6 of ${PROPS.join(', ')} (comma separated) | ` +
  `HER: one of ${HER.join(', ')} | DOG: one of ${DOG.join(', ')} | SKY: one of ${SKY.join(', ')} | WEATHER: one of ${WEATHER.join(', ')} | PALETTE: one of ${PALETTES.join(', ')} | ` +
  `SIGN: a glowing sign, max 8 characters (any language, never song lyrics) or none | WHY: what inspired the dream, max 12 words`;
export function dreamPrompt({ lately, past = [], dogName = '' }){
  return `[dream designer, not a chat — no tags] While the user is away, your buddy sleeps and projects a short 3D hologram dream about her: ` +
    `an Asian woman with a short bob, casual sporty, and her white Maltese${dogName ? ' ' + dogName : ''}. Design ONE new dream inspired by what she's been into lately, ` +
    `so it feels personal and alive (e.g. lots of Mandarin music → a Taipei night market with lanterns and floating notes). Surprise her; don't repeat recent dreams.\n` +
    `Lately:\n${lately}\n` + (past.length ? `Recent dreams (don't repeat): ${past.slice(-6).join('; ')}\n` : '') +
    `Reply ONLY in this exact format on one line, nothing else: DREAM: dream title, max 6 words | PLACE: one of ${PLACES.join(', ')} | ` +
    `PROPS: 3 to 6 of ${PROPS.join(', ')} (comma separated) | HER: one of ${HER.join(', ')} | DOG: one of ${DOG.join(', ')} | SKY: one of ${SKY.join(', ')} | ` +
    `WEATHER: one of ${WEATHER.join(', ')} | PALETTE: one of ${PALETTES.join(', ')} | SIGN: a glowing sign, max 8 characters (any language, never song lyrics) or none | WHY: what inspired it, max 12 words`;
}
