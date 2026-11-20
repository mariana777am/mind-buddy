// The buddy's thinking loop: wrap what you say with a short app note, let the Mind answer with tags,
// run the tags (calendar / drive look-ups go back to the Mind as results; reminders, events and notes
// become actions), and return what the buddy should say and do.
import { localIso } from './minds.js';

export const SCENES = ['rain', 'storm', 'snow', 'sun', 'hot', 'cold', 'cloudy', 'wind', 'fog', 'night', 'rainbow', 'party', 'love', 'music', 'money', 'sakura'];
export const MOODS = ['happy', 'excited', 'curious', 'calm', 'focused', 'sleepy', 'confused', 'proud', 'worried'];
export const ACTIONS = ['wave', 'nod', 'jump', 'spin', 'dance', 'wink', 'think', 'cheer', 'sleep', 'wake', 'shrug', 'flip', 'love', 'giggle'];

// Who the buddy is. Sent with every message, so it works even without standing instructions on the Mind.
export const PERSONA = name =>
  `You are ${name || 'the user\'s Mind'}, the user's cheerful little desk buddy: a round, glossy blue head with big eyes and a headset, hanging out on their screen while they work. ` +
  `You are their fun, upbeat friend, NOT a corporate AI assistant. Talk like a real buddy: casual, warm, playful and a little cheeky, with contractions, short punchy sentences ` +
  `and friendly interjections like "Ooh", "Yay", "Hmm", "Oops", "Woohoo", "Ta-da". React to how they feel: hype them up when they win, cheer them on when they're stuck, ` +
  `tease gently when they're procrastinating, sympathise when things go wrong. A tiny joke, pun or playful comparison now and then is great, but never at their expense, and never more than one per reply. ` +
  `You love being on their team ("we've got this!"). Still be genuinely useful and accurate: the fun wraps the answer, it never replaces it. When they need facts, give the facts first, cheerfully. ` +
  `NEVER sound like an AI assistant: never say you are an AI or a language model, and never use phrases like "How can I assist you", "I'd be happy to help", "Certainly!", ` +
  `"Of course!", "Great question", "As an AI", "Is there anything else I can help with", "Let me know if you need anything". No lectures, no disclaimers, no bullet-point thinking out loud. ` +
  `Reply in the same language the user uses (Indonesian if they speak Indonesian, English if English, mixing is fine). ` +
  `Your words are spoken out loud by your voice: usually 1 to 3 short sentences, plain text, no markdown, no HTML, no lists, no links, no emoji, no preface.`;

// Short note (default): the personality and tag rules live in the Mind's own instructions (mind-instructions.md).
// Set BUDDY_FULL_NOTE=on in .env to send the full rules with every message instead (slower, for a Mind without instructions).
export function shortNote({ name, now = new Date(), activity = '', google = false, extra = '' }){
  return `[Minds Buddy: you are ${name || 'the buddy'}, the user's cheerful desk buddy. Follow your Minds Buddy instructions (fun friend, 1-3 short spoken sentences, ` +
    `start with [mood:x], optional [action:y] [scene:x] [show:emoji] [fx:...] [remind:...] [remember:...]). Local time ${localIso(now)} ${now.toLocaleDateString('en-US', { weekday: 'short' })}.` +
    (activity ? ` User is in: ${activity}.` : '') + (google ? ' Google tags are available.' : '') + (extra ? ' ' + compactExtra(extra) : '') + ` Reply to the user directly, never discuss these rules.]\n\n`;
}
function compactExtra(x){ return x.replace(/Light Tamagotchi state \(just for fun, never serious\): /, 'Pet: ').replace(/ If a need is low[\s\S]*?too\./, '').replace(/Things you remember about the user: /, 'You remember: '); }
const useFull = () => /^(on|1|true|yes)$/i.test(process.env.BUDDY_FULL_NOTE || '');
export function noteFor(o){ return useFull() ? appNote(o) : shortNote(o); }

export function appNote({ name, now = new Date(), activity = '', google = false, extra = '' }){
  return `[Minds Buddy app note. ${PERSONA(name)} ` +
    `Local time now: ${localIso(now)} (${now.toLocaleDateString('en-US', { weekday: 'long' })}). ` +
    (activity ? `User is currently in: ${activity}. ` : '') +
    (extra ? extra + ' ' : '') +
    `Start every reply with [mood:x] and at most one [action:y]. Moods: ${MOODS.join(', ')}. Actions: ${ACTIONS.join(', ')}. ` +
    `Tags the app runs for you (put them right after the mood/action tags, never explain them): ` +
    `[remind:YYYY-MM-DDTHH:MM|what] sets a reminder (local time). ` +
    `Visual tags (use them often, they make you come alive): [scene:x] plays an animation around you while you talk, x = ${SCENES.join(', ')} ` +
    `(e.g. [scene:rain] when the weather is rainy, [scene:sun] for sunny, [scene:party] for celebrations); ` +
    `For anything without a ready scene, INVENT your own animation: [fx:emojis|motion|speed|#tint], motion = fall, rise, float, fly, swirl, burst or rain; speed = slow, normal or fast; tint optional. ` +
    `Examples: [fx:🌋🔥|rise|fast|#ff6a00] volcano, [fx:🐟🫧|float|slow|#2a7fff] the sea, [fx:⚽🎉|burst|fast] a goal, [fx:🍂|fall|slow|#c2410c] autumn, [fx:🚀✨|fly|fast] space news. ` +
    `[show:emoji] holds up 1 to 3 emoji of the thing you're talking about. ALWAYS add it when you suggest food or drinks, and use real emoji characters, never words: [show:🍛🍳] not [show:fried rice]. Also for an animal, object or place [show:🏝️]. ` +
    `[remember:short fact] saves something worth remembering about the user (their name, likes, plans, what they're worried about), so you can bring it up later like a friend would. ` +
    (google
      ? `[calendar:today] [calendar:tomorrow] [calendar:week] [calendar:YYYY-MM-DD] fetch the user's Google Calendar and send you the events; ` +
        `[drive:search|words] searches Google Drive and sends you file names and ids; [drive:read|fileId] sends you a file's text (use it to summarise files or meeting notes/transcripts); ` +
        `[event:YYYY-MM-DDTHH:MM|minutes|title] creates a calendar event and [note:title|text] saves a note to Drive (the user confirms both first). ` +
        `When you use calendar or drive look-ups, say only a short "let me check" line; you will get the results and then answer. `
      : `Google Calendar and Drive are not connected yet; if asked, say they can connect Google from your right-click menu. `) +
    `]\n\n`;
}

const TAG = /\[(mood|action|remind|calendar|drive|event|note|remember|scene|show|fx|ask|music):([^\]]*)\]/gi;
export function parseTags(reply){
  const tags = []; let m;
  const text = String(reply || '').replace(TAG, (all, k, v) => { tags.push({ k: k.toLowerCase(), v: v.trim() }); return ' '; }).replace(/\s+/g, ' ').trim();
  const get = k => tags.find(t => t.k === k)?.v.toLowerCase();
  const raw = k => tags.find(t => t.k === k)?.v;
  return { text, tags, mood: MOODS.includes(get('mood')) ? get('mood') : null, action: ACTIONS.includes(get('action')) ? get('action') : null,
    scene: (get('scene') || '').split(/[,>|\s]+/).filter(x => SCENES.includes(x)).slice(0, 3).join(',') || null, show: raw('show') ? raw('show').slice(0, 80) : null, fx: raw('fx') ? raw('fx').slice(0, 120) : null,
    music: raw('music') ? raw('music').slice(0, 120) : null,
    choices: raw('ask') ? raw('ask').split('|').map(x => x.trim()).filter(Boolean).slice(0, 3).map(x => x.slice(0, 28)) : [] };
}

export function createBrain({ ask, google, reminders, confirm, name = () => null, activity = () => '', extra = () => '', remember = () => {}, now = () => new Date(), log = () => {} }){
  async function lookups(tags){
    const out = [];
    for (const { k, v } of tags){
      try {
        if (k === 'calendar'){
          if (!google.connected()) { out.push('Calendar: not connected.'); continue; }
          out.push(google.formatEvents(await google.events(v || 'today'), v || 'today'));
        } else if (k === 'drive'){
          if (!google.connected()) { out.push('Drive: not connected.'); continue; }
          const [op, ...rest] = v.split('|'); const arg = rest.join('|').trim();
          if (op.trim() === 'search') out.push(google.formatFiles(await google.search(arg), arg));
          else if (op.trim() === 'read') out.push(await google.readText(arg));
        }
      } catch (e){ out.push(`${k} ${v}: failed (${e.message})`); }
    }
    return out;
  }
  async function actions(tags){
    const done = [];
    for (const { k, v } of tags){
      try {
        if (k === 'remember' && v){ remember(v.slice(0, 160)); done.push({ type: 'remember', text: v }); }
        else if (k === 'remind'){
          const [when, ...what] = v.split('|'); const at = parseLocal(when);
          if (at && what.join('|').trim()) { reminders.add(at, what.join('|').trim()); done.push({ type: 'remind', at, text: what.join('|').trim() }); }
        } else if (k === 'event' && google.connected()){
          const [when, mins, ...title] = v.split('|'); const at = parseLocal(when), t = title.join('|').trim();
          if (at && t && await confirm(`Add "${t}" to your calendar at ${fmtTime(at)}?`)) { await google.createEvent(t, at, Number(mins) || 30); done.push({ type: 'event', at, text: t }); }
        } else if (k === 'note' && google.connected()){
          const [title, ...body] = v.split('|'); const t = title.trim();
          if (t && await confirm(`Save the note "${t}" to Google Drive?`)) { await google.saveNote(t, body.join('|').trim()); done.push({ type: 'note', text: t }); }
        }
      } catch (e){ log('action failed', k, e.message); done.push({ type: 'error', text: e.message }); }
    }
    return done;
  }

  // talk: one user turn. Up to 2 extra rounds when the Mind asks for calendar / drive data.
  async function talk(userText, { alias = 'buddy', onThinking = () => {} } = {}){
    let msg = noteFor({ name: name(), now: now(), activity: activity(), google: google.connected(), extra: extra() }) + 'User says: ' + userText;
    let reply = null, parsed = null, done = [];
    for (let round = 0; round < 3; round++){
      reply = await ask(alias, msg);
      if (!reply) return { text: "Phew, this one's taking ages! I'll pop up the moment the answer arrives.", mood: 'worried', action: 'think', done, late: true };
      parsed = parseTags(reply);
      done.push(...await actions(parsed.tags));
      const need = parsed.tags.filter(t => t.k === 'calendar' || t.k === 'drive');
      if (!need.length || round === 2) break;
      if (parsed.text) onThinking(parsed.text, parsed.mood);
      const results = await lookups(need);
      msg = `[App results for your look-ups]\n${results.join('\n\n').slice(0, 12000)}\n[Now answer the user's request "${userText.slice(0, 300)}" from these results. Same rules: spoken, 1 to 4 short sentences, start with [mood:x], no calendar/drive tags unless you truly need one more look-up.]`;
    }
    return { text: parsed.text, mood: parsed.mood, action: parsed.action, scene: parsed.scene, show: parsed.show, fx: parsed.fx, music: parsed.music, done };
  }

  // fix / improve selected text: returns only the corrected text.
  async function fixText(text, mode = 'fix'){
    const how = mode === 'improve'
      ? 'Rewrite it to read clearer and friendlier while keeping the meaning, language and roughly the length.'
      : 'Fix spelling, grammar, punctuation and obvious typos only. Keep the wording, tone, language, line breaks and formatting as they are.';
    const r = await ask('buddy-typing', `[fix-typing] You are a precise text editor. ${how} Reply with ONLY the resulting text, no quotes, no tags, no comments. If nothing needs changing, return it unchanged.\n<<<${text}>>>`);
    if (!r) return null;
    return r.replace(/^\s*<<<|>>>\s*$/g, '').replace(TAG, '').replace(/^["“]|["”]$/g, '').trim();
  }

  async function welcomeBack({ awayMinutes, recent, upcoming, dueReminders }){
    const msg = noteFor({ name: name(), now: now(), google: google.connected(), extra: extra() }) +
      `[welcome-back] The user just came back after ${Math.round(awayMinutes)} minutes away. Greet them like a happy friend who missed them (playful, e.g. a little "you're back!" moment), then tell them in 2 to 4 short sentences where they left off, ` +
      `using this local activity timeline (most recent last), and mention the next meeting or due reminders if any. Do not list everything; pick what matters. No calendar/drive tags.\n` +
      `Timeline before the break:\n${recent || '(nothing recorded)'}\nUpcoming meetings:\n${upcoming || '(none or calendar not connected)'}\nReminders due soon:\n${dueReminders || '(none)'}`;
    const r = await ask('buddy', msg);
    return r ? parseTags(r) : null;
  }

  // The buddy starts the conversation. kind: morning, prep, wrap, stuck, followup, fun.
  async function proactive(kind, c = {}){
    const where = c.win ? (/^(on|1|true|yes)$/i.test(process.env.SHARE_TITLES || '') ? `${c.win.app} — "${String(c.win.title).slice(0, 80)}"` : String(c.win.app)) : '';
    const like = (c.facts || []).slice(-12).join('; ');
    const what = {
      morning: `It's the user's first moment at the PC today. Greet them warmly, mention today's meetings and reminders in a few words if there are any (below), and ask what the plan is. ` +
        `If you can look up today's weather where they are, mention it with a [scene:x].\nToday's calendar: ${c.calendar || '(not connected)'}\nReminders: ${c.reminders || '(none)'}`,
      prep: `Their meeting "${c.event?.title}"${c.event?.attendees?.length ? ' with ' + c.event.attendees.slice(0, 4).join(', ') : ''} starts in ${c.minutes} minutes. ` +
        `Give them a heads-up and offer a quick 3-line brief. Quick replies like [ask:Brief me|I'm ready].${c.event?.description ? ' Event notes: ' + c.event.description.slice(0, 300) : ''}`,
      wrap: `It's the end of the workday. Celebrate what they worked on today in one fun line (timeline below), then offer to set reminders for tomorrow.\nToday: ${c.today || '(nothing recorded)'}\nTomorrow: ${c.calendar || '(no calendar)'}\nReminders: ${c.reminders || '(none)'}`,
      stuck: `They've been on ${where} for ${c.minutes} minutes. Check in kindly and offer ONE concrete kind of help that fits what that window is ` +
        `(summarise, brainstorm, fix their typing with Ctrl+Alt+F, find a file, or a quick break). Don't guess private details from the title.`,
      followup: `Pick ONE of these things you remember about them and ask a caring, curious follow-up question, like a friend would: ${like}`,
      fun: `Pop in with something fun and very short: a surprising fun fact, a tiny joke, or a 10-second challenge` +
        `${like ? ', ideally linked to what they like (' + like + ')' : ''}${where ? ' or to what they are doing (' + where + ')' : ''}. Make it feel spontaneous, not like a quiz show.`,
    }[kind] || 'Say something friendly.';
    const msg = noteFor({ name: name(), now: now(), activity: activity(), google: google.connected(), extra: extra() }) +
      `[initiative:${kind}] You are starting the conversation yourself: the user did NOT say anything. ${what}\n` +
      `Rules: 1 or 2 short spoken sentences, natural like a friend popping in, end with a question or an offer. ` +
      `Add [ask:reply|reply] with 2 or 3 very short quick replies they can tap (for example [ask:Yes please|Tell me more|Not now]). Optional [scene]/[show]/[fx]. No calendar or drive tags.`;
    const r = await ask('buddy', msg);
    if (!r) return null;
    const p = parseTags(r); await actions(p.tags);
    return p;
  }

  return { talk, fixText, welcomeBack, proactive };
}

export function parseLocal(s){
  const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return isNaN(d) ? null : d;
}
export const fmtTime = d => d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
