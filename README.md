# Minds Buddy 🎧

A fun little talking head that sits in the corner of your Windows screen while you work, powered by your Mind.
It talks, fixes your typing, reminds you, naps when you're away, and when you come back it tells you where you left off.
Connect Google to get meeting alerts plus calendar and Drive help.

## Start (5 minutes)

1. Extract this folder to e.g. `D:\minds-buddy`.
2. Copy `.env.example` to `.env` and fill in the same three settings as Puppy v2:
   `PROVIDER=minds`, `MINDS_BUILDER_API_KEY=…`, `MIND_ID=…` (you can copy them from `D:\minds-puppet v2\.env`).
   Optional: `ELEVENLABS_API_KEY` (or `OPENAI_API_KEY`) gives the buddy a real voice **and** lets you talk to it.
   With ElevenLabs you can pick any voice from your Voices page with `ELEVENLABS_VOICE_ID`.
3. Double-click **`start-buddy.bat`**. The first time it runs `npm install`, which downloads Electron (~100 MB).
   Or in a terminal: `npm install` then `npm start`.

The buddy appears bottom-right. Drag it anywhere. Right-click it for the menu, which also has **Start with Windows**.

## Hotkeys

| Keys | What it does |
|---|---|
| **Ctrl+Alt+M** / **Ctrl+Alt+Space** | Talk (stops by itself when you pause), or click the orange mic |
| **Ctrl+Alt+H** | Hands-free on/off |
| **Ctrl+Alt+=** / **Ctrl+Alt+-** | Bigger / smaller |
| **Ctrl+Alt+T** | Type to it (or double-click the head) |
| **Ctrl+Alt+F** | Fix the **selected text** in any app (typos, grammar) and paste it back |
| **Ctrl+Alt+I** | Improve / rephrase the selected text |
| **Ctrl+Alt+Q** | Quiet mode (no talking, only meeting and reminder pop-ups) |
| **Ctrl+Alt+P** | Off the record (stops noting which windows you use) |
| **Ctrl+Alt+B** | Hide / show |

Things to try: "remind me at 4 to call Budi", "what's on my calendar tomorrow?", "brief me for my 3 PM meeting",
"find the budget sheet from last week", "summarise the supplier contract", "save a note: …".
You can also drop a file on the head to store it in Drive.

## Talking by voice

- **Click the orange mic** on its headset, or press **Ctrl+Alt+M** (or Ctrl+Alt+Space). It stops listening by itself when you pause.
- **Follow-up:** after it answers something you said, it listens about 6 seconds more, so you can just keep chatting. Say "bye" or "that's all" to end.
- **Voice:** ElevenLabs speaks what matters: answers to you, reminders and meeting alerts (with a little chime), conversations it starts, welcome back and evolution day. Pet chatter, game lines and status messages are bubble-only, to save credits.
- **Hands-free switches itself off** while the buddy's music plays (and back on after), and pops up choices (off / off for 1 hour / off till the meeting ends / keep listening) when a meeting starts, a call app or Spotify/YouTube is in front, or it's been noisy for a minute.
- **Hands-free (Ctrl+Alt+H):** say "Hey <its name>, …" or "Hey Buddy, …". Each time someone speaks near the PC, a short clip goes to speech-to-text to check for the name, so this uses credits.

## It's a little pet now 🐣 (light Tamagotchi)

- **Needs:** 🍪 snack, 🎈 fun, 💙 love, ⚡ energy. They drift down slowly while you work and energy refills while it naps. It never gets sick, sad or dies. When a need is low it hints, at most once every 50 minutes.
  Hover over its head to see the needs bar.
- **Care:** right-click → **Feed** (cookie, apple, noodles, coffee, boba) or just say "cookie" / "coffee". Pet it by slowly rubbing the mouse over its head (heart eyes!).
  Play games, chat, high-five it.
- **Levels and outfits:** everything you do earns XP. Levels unlock a bow tie, sunglasses, party hat, beanie, flower, crown and wizard hat, plus pink, mint, gold and galaxy headsets.
  Right-click → **Wardrobe**. Keep a daily streak 🔥 for bonus XP. Right-click → **My stats** shows everything.

## Playing with it

| Do this | It does |
|---|---|
| Slowly rub the mouse over its head | Heart eyes, purrs |
| Wiggle the mouse fast over it | Giggles (tickles!) |
| Drag it around in circles | Gets dizzy 😵‍💫 |
| Drag and **throw** it | Bounces off the screen edges: "Wheee! Again!" |
| "high five", then click its hand | High five 🙌 |
| Hide it (Ctrl+Alt+B) and bring it back | "Peekaboo!" |
| Leave it alone for a while | Strolls along the taskbar or peeks in from the edge |

**Instant tricks** (type or say, no Mind needed): *dance, flip, spin, jump, wave, sing, high five, cookie, coffee, stats, done!*
(Indonesian works too: *joget, salto, lompat, nyanyi, selesai, kopi, main yuk…*)

**Games** (right-click → Play, or say "let's play"): rock paper scissors (best of 3), guess the number, quick quiz and would you rather. The quiz and would-you-rather questions come from your Mind.

**🕹️ Arcade: you vs the buddy.** Right-click → *Arcade*, or say *"fight me"*, *"bubble game"* or *"space shooter"*. The buddy projects a hologram game window:
- 🫧 **Bubble Pop Battle:** click bubbles before its laser reticle does. ⭐ +5, 💣 −3, ❄️ freezes your opponent, 🌈 pops everything nearby. 60 seconds.
- 🚀 **Space Duel:** your ship vs its saucer. Mouse or ←→ to move, click or Space to shoot; hide behind asteroids and shoot power-ups (⚡ 🛡 ❤).
- 🥊 **Desk Brawl:** best of 3 rounds. A/D move, W jump, J punch, K kick, L block, U Brain Blast when your meter flashes.

The opponent is a computer player that runs on your PC. Your Mind writes the trash talk before the match, its brags and excuses during it, and its reaction after.
It picks a play style too (aggressive, defensive or tricky). The difficulty goes up when you win and down when you lose. Wins give the pet XP and fun.

**Focus timer:** "focus 25" (or right-click → Focus timer). Shades on, no chatter, a countdown, then confetti and an optional 5-minute stretch break. "stop focus" ends it.

**Reacts to what you're doing**, using the window titles it already sees (nothing extra is sent anywhere): YouTube/Netflix, Spotify (head bop), coding, Excel, email, slides, docs, social media and games.
It goes **quiet automatically during Zoom / Teams / Meet calls**. It also has time-of-day moments: morning coffee mug, lunch nudge, Friday party hat, late-night "go to bed".

**Remembers you:** your Mind can save little facts (your name, favourite snack, plans) and bring them up later. Right-click → *Forget what I remember about you* clears them.

**Sound effects:** tiny boops, giggles, bounces and fanfares. Toggle them in the right-click menu. They're off in quiet mode and during calls.

## Doze, sleep and dreams 💭

- **Doze:** after 5 minutes with nothing to talk about, it nods off even while you work (`DOZE_MINUTES`). Poke it, talk to it or press a hotkey to wake it.
  Meetings and reminders wake it too, and it wakes itself when it wants to pop in. If you then walk away, the doze becomes a normal nap and you get a welcome back.
- **Dreams:** about 10 seconds after it falls asleep, a thought cloud appears with little animated dreams: a walk with your dog, a café, a mountain hike, a beach trip and a balloon ride.
  Set `DOG_NAME=` in `.env` to see her name in the dreams. Right-click → *Dreams while sleeping* turns them off.

## Privacy defaults

- Login, sign-in, verification/OTP, banking, password and private-browsing windows are **never noted**. Add your own words with `IGNORE_TITLES=`.
- Your Mind only hears the **app name** you're in (e.g. "Chrome"), not window titles. `SHARE_TITLES=on` sends full titles again.
  The welcome-back and end-of-day summaries still use titles from your local timeline.

## Music 🎵 (YouTube + internet radio, with projected lyrics)

Say or type **"play <song or artist>"**, **"jazz radio"**, **"radio indonesia"**, **"lofi radio"**, **"next song"**, **"pause"** or **"stop music"**.
Or right-click → **🎵 Music**. Your Mind can start music too ("play something chill for focus").
A music window appears next to the buddy: the YouTube player (or a radio visualizer), and the lyrics scrolling in time with the song. The buddy dances along.

- **Internet radio** works straight away, no key needed (stations from Radio Browser, a free public directory).
  Ask by **language** (cantonese, chinese, mandarin, japanese, korean, tagalog, hindi…), **country** ("radio hong kong", "radio taiwan"), **region** (east asia, southeast asia, europe…) or **genre** (jazz, lofi, oldies), or mix them: "cantonese pop", "chinese oldies". Without a YouTube key, "play …" requests fall back to radio.
- **YouTube** needs a free API key, about 5 minutes:
  1. Go to <https://console.cloud.google.com/>, create (or pick) a project, then **APIs & Services → Library → YouTube Data API v3 → Enable**.
  2. **Credentials → Create credentials → API key**. Optionally restrict it to *YouTube Data API v3*.
  3. Put it in `.env` as `YOUTUBE_API_KEY=...` and restart. The free quota is roughly 100 song searches a day.
- **Lyrics** come from LRCLIB (free, time-synced). Popular songs usually have them; if not, it just says so.
- **Talking while music plays:** press **Ctrl+Alt+M** (or click the orange mic). The music dips to a quiet background level while you speak and while the buddy answers, then fades back.
  Hands-free ("Hey Buddy") pauses while music plays, and if it's been noisy for about a minute it pauses itself and asks before using more credits; sounds longer than 15 s without a pause are never sent, because the microphone would hear the music, not you. With headphones, the buddy hears you best.
- YouTube may show its normal ads in the player. Videos that don't allow embedding are skipped automatically.

## Size

Right-click → **Size** (Small, Medium, Large, Extra large), **Ctrl + mouse wheel** on the buddy, or **Ctrl+Alt+=** / **Ctrl+Alt+-**. It remembers its size and where you left it.

## Sleep and "welcome back"

After `IDLE_MINUTES` (default 5) without keyboard or mouse, or when you lock the PC, it naps 😴.
When you return it wakes up and your Mind tells you where you left off, plus your next meeting and any reminders due.
Click **📋 where you left off** in the bubble to see the list.

## Connect Google Calendar + Drive (one time, ~15 min)

1. Go to <https://console.cloud.google.com/> and create a project (e.g. "Minds Buddy").
2. **APIs & Services → Library**: enable **Google Calendar API** and **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: choose **Internal** if you use a Google Workspace (company) account, otherwise **External**.
   Fill in the app name and your email. For External, add yourself under **Test users**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app**.
   Copy the **Client ID** and **Client secret** into `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), then restart the buddy.
5. Right-click the buddy → **Connect Google Calendar + Drive** and sign in in your browser.
   Google will warn that the app isn't verified. That's expected for your own app: click *Continue*.

Note: with a personal Gmail account the app stays in "Testing" mode, and **Google makes you reconnect about every 7 days**.
A Workspace account set to "Internal" doesn't have that limit.

What it can do with Google:
- **Meeting alerts** 10 min and 1 min before (with a 🎥 Join button for Meet, Zoom or Teams links). Declined meetings are skipped.
- Read your calendar and **brief you** on meetings, including attached files.
- **Search and read Drive** (Docs, Sheets, Slides, text files; it can't read PDFs yet). It can also summarise Meet transcripts or Gemini notes if they're saved to your Drive.
- **Create** calendar events and notes, but **only after you click Yes**. Notes and dropped files go into a `Minds Buddy` folder.
  It never deletes or edits your existing files.

## Privacy

- It does **not** record your keystrokes. Every 5 s it only asks Windows which window is in front (app name + window title),
  and keeps that timeline **on your PC** (`%APPDATA%\minds-buddy\timeline.json`) for `TIMELINE_DAYS` (default 3).
- Password managers, banking, private/incognito windows and anything in `IGNORE_APPS` / `IGNORE_TITLES` are never recorded.
  **Ctrl+Alt+P** turns recording off, and the menu has **Forget my activity timeline**.
- Your Mind only sees what you ask it plus a short note (local time, the window you're in), the welcome-back summary,
  and the calendar events or files it looked up for your question.
- Typing fix only sends the text you selected. Your clipboard is put back afterwards.
- The microphone is only on while the headset mic glows orange (after Ctrl+Alt+Space). Audio goes to ElevenLabs (Scribe) or OpenAI for speech-to-text, whichever key you set.
- Google sign-in is stored encrypted with Windows (DPAPI) in `%APPDATA%\minds-buddy\google.bin`.

## Optional: give your Mind standing instructions

On build.hellominds.ai you can add to your Mind's instructions:
"When a message starts with [Minds Buddy app note], follow its format and tag rules exactly."

## Files

`main.js` app, hotkeys, sleep/wake, meeting alerts · `lib/brain.js` talk loop and tags · `lib/minds.js` your Mind (official library) ·
`lib/google.js` Calendar + Drive · `lib/winwatch.js` Windows window/copy/paste helper · `lib/store.js` timeline and reminders ·
`renderer/` the character · `test/unit.test.mjs` checks (`npm test`).

## Minds CLI helper (`node mind.mjs …`)
Uses the official Minds CLI (`@animocabrands/minds-cli`, installed by `npm install`) with your `.env` key and Mind:

| Command | What it does |
|---|---|
| `node mind.mjs doctor` | checks the key and setup |
| `node mind.mjs status` | Mind on/off, cognition balance, today's usage by tool |
| `node mind.mjs usage week` | which tools used the most cognition (day / week / month) |
| `node mind.mjs skills` / `apps` | what your Mind has equipped |
| `node mind.mjs bazaar "weather"` | find skills/apps; add with `equip-skill <id>` / `equip-app <id>` |
| `node mind.mjs history 20` | the last messages between the buddy and your Mind |
| `node mind.mjs ask "Hi!"` | one message on a separate test chat |
| `node mind.mjs selftest` | 3 checks that your Mind follows the buddy's rules (mood tags, reminders, arcade level design) |
| `node mind.mjs raw <args>` | any other CLI command, e.g. `raw circle list` |

## Living dreams
While it sleeps, the buddy projects 3D hologram dreams about you and your pup. Besides the built-in ones, your Mind designs new dreams from what you've been into lately (music you play, the kinds of apps you use, your favourite arcade game, what you told it): a recipe of place, props, what you and the dog do, sky, weather, colours and a glowing sign, which the hologram builds from a library of ~40 light props. The newest plays first; it mentions the dream when you come back. Right-click → 💭 Dreams → ✨ Dream something new now. Only categories (not window titles) and the songs/stations you played are kept, in habits.json on your PC.

## Weekly evolution
Once a week (first one a day after you install), your Mind looks back at your week and grows the buddy: it designs a **new outfit** (cap, beret, headband, halo, bow, flowers, scarf, visor… in its own colours and badge), a **weekly arcade quest** to win it, a **new dream**, and **one idea for a new feature**. Approve ideas with 👍 and they're saved to `IDEAS.md` in this folder: bring it to your next build session. Right-click → 🌱 Evolution → ✨ Evolve now to try it (1 Mind message).
