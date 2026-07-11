# SenseBridge Live

**A shared, real-time audio meeting room that bridges blind/low-vision and deaf/hard-of-hearing users, powered by the Google Gemini Live API.**

Built for **Problem Statement 1: Real-Time Multimodal Interaction (Gemini Live API / Live Translate)**.

---

## Problem statement

Communication between a **blind or low-vision** person and a **deaf or hard-of-hearing** person is uniquely hard: one cannot easily read text or see gestures, the other cannot easily hear speech. Existing tools solve one direction (speech-to-text *or* text-to-speech) but rarely bridge both sides in a single, real-time conversation.

**SenseBridge Live** is a two-person **meeting room** (audio only, no video) where each person joins with a room code and gets a UI tailored to their needs:

1. The **blind user speaks** → their words are captioned live for the deaf user.
2. The **deaf user reads** the captions and **types or taps a reply**.
3. That reply is **spoken aloud automatically** on the blind user's device.
4. Either side can request a **slower, clarified** version of the last instruction.
5. Either side can generate a **text + spoken recap** of the whole conversation.
6. The deaf user can use **Scene Assist** (camera) to get a spoken description of nearby signs / surroundings.

Real audio also streams peer-to-peer over WebRTC, so it is a genuine call — not just a shared screen.

---

## Features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Role-based rooms** | Pick a role in the lobby — **Blind / Low-vision**, **Deaf / Hard-of-hearing**, or **Speech difficulty / Mute** — enter a room code, and get a purpose-built view. Everyone who enters the same code joins the same room from any device/tab. |
| 2 | **Live Caption Mode** | A speaking user's mic streams to the backend → Gemini Live API → partial/final captions broadcast to the room and shown large, labeled by speaker. |
| 3 | **SpeakBack** | A text user types a message; it is delivered to the room and read aloud (on the blind user's device, and — for the mute role — on the sender's own device too, AAC-style). |
| 1b | **Deaf can use their own voice** | Deaf/HoH users who speak can toggle **"Use my voice"** to send real audio over WebRTC that is also captioned — not everyone who is deaf wants to type. |
| 1c | **Mute / speech-difficulty role** | Users who cannot speak **hear others normally** (WebRTC audio + captions) and **type to talk**: their device voices their messages aloud so people around them hear it. |
| 4 | **Quick Replies** | One tap sends a canned phrase (Please repeat, Speak slower, I understood, Can you explain again?, Wait here, Follow me, Turn left, Turn right) — spoken to the blind user. |
| 5 | **Pause & Clarify** | If the blind user says "repeat that" / "slower" / "explain again", SenseBridge auto-asks Gemini to rewrite the last instruction as calm, step-by-step guidance and speaks it slower. Also a manual "Clarify my last message" button. |
| 6 | **Recap** | Sends the transcript to Gemini's text model → short recap, shown to the deaf user and spoken for the blind user. Either side can trigger it. |
| 7 | **Scene Assist** | Deaf user captures a camera frame → Gemini multimodal → a short, navigation-focused description delivered (and spoken) to the room. |
| 8 | **WebRTC audio call** | Real peer-to-peer audio (no video) between the two participants via STUN + a WebSocket signaling server. |

Live **status badges**: Connected / Disconnected, participant count, Talking, Mock mode.

---

## Tech stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + `ws` (WebSocket signaling + caption relay)
- **Realtime audio:** WebRTC (peer-to-peer, audio only) with Google STUN
- **AI:** Google Gemini Live API (captions) + Gemini text/vision models (`@google/genai`)
- **TTS:** Browser `SpeechSynthesis` (MVP-reliable; designed to be swapped for Gemini audio)
- **Mic capture:** Web Audio API → 16 kHz PCM16 for the Live API
- **Multi-device demos:** [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (`cloudflared`) for a public HTTPS URL
- **State:** In-memory rooms (hackathon MVP)

---

## Architecture (text diagram)

```
        Blind user's browser                         Deaf user's browser
 ┌───────────────────────────────┐          ┌───────────────────────────────┐
 │ BlindView (voice-first)        │          │ DeafView (read + type)         │
 │  • Tap-to-talk → mic PCM       │          │  • Big captions + transcript   │
 │  • Auto-reads incoming msgs    │          │  • Type-to-speak, quick replies│
 │  • useRoom hook                │          │  • Clarify / Recap / Scene     │
 └───────┬───────────────┬────────┘          └───────┬───────────────┬────────┘
         │ mic PCM (WS)   │  WebRTC audio (P2P)       │  text msgs (WS)│
         │ + text (WS)    └───────────── ⇄ ───────────┘                │
         ▼                                                             ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                 Node.js backend — Express + ws (/ws)                       │
 │                                                                            │
 │  rooms.ts .......... in-memory room registry (code → participants)         │
 │  index.ts .......... relays WebRTC signaling, broadcasts captions + msgs   │
 │  geminiLiveClient .. per-participant Live session (real OR mock captions)  │
 │  REST: /health  /api/clarify  /api/summary  /api/scene-assist              │
 │        └────────────── geminiTextClient.ts → Gemini text / vision ─────────┘
 └──────────────────────────────────────────────────────────────────────────┘
```

Audio flows **peer-to-peer** over WebRTC; the backend only relays signaling. Captions are produced from each speaker's mic on the backend and broadcast to the room. Typed replies travel over the WebSocket and are spoken locally on the recipient's device.

If no `GEMINI_API_KEY` is set (or `USE_MOCK_LIVE=true`), captions are **simulated** and clarify/summary/scene return deterministic sample text — so the whole app demos offline with two browser tabs and no credentials.

---

## Project structure

```
.
├── index.html
├── package.json            # frontend + orchestration scripts
├── vite.config.ts          # proxies /api and /ws to the backend
├── .env.example
├── README.md
├── src/                    # frontend
│   ├── main.tsx
│   ├── App.tsx             # router: Lobby → BlindView / DeafView
│   ├── index.css
│   ├── types.ts
│   ├── components/
│   │   ├── Lobby.tsx           # role + room-code entry
│   │   ├── CaptionPanel.tsx
│   │   ├── Transcript.tsx
│   │   ├── QuickReplies.tsx
│   │   ├── SummaryPanel.tsx
│   │   ├── ViewHeader.tsx      # shared in-room top bar
│   │   └── RemoteAudio.tsx     # plays peers' WebRTC audio
│   ├── views/
│   │   ├── BlindView.tsx           # voice-first
│   │   └── ConversationView.tsx    # deaf (read+type, opt. voice) & mute (type-to-speak)
│   ├── hooks/
│   │   └── useRoom.ts          # WS + WebRTC + captions + messages + presence
│   └── utils/
│       ├── speech.ts           # TTS (SpeechSynthesis)
│       └── pcm.ts              # mic → 16 kHz PCM16 base64
└── server/                 # backend
    ├── package.json
    ├── config.ts
    ├── index.ts               # Express + WebSocket signaling/relay
    ├── rooms.ts               # in-memory room registry
    ├── geminiLiveClient.ts    # real + mock live captions
    ├── geminiTextClient.ts    # clarify / summary / scene-assist
    └── routes/
        ├── summary.ts
        ├── clarify.ts
        └── sceneAssist.ts
```

---

## Setup

**Prerequisites:** Node.js 18+ (tested on Node 20) and npm.

```bash
npm run install:all                 # frontend + backend deps
cp .env.example .env                # frontend flags
cp .env.example server/.env         # backend config
```

Edit **`server/.env`** (see the `TODO` comments):

```env
GEMINI_API_KEY=your_real_key_here          # TODO: https://aistudio.google.com/apikey
GEMINI_LIVE_MODEL=gemini-2.0-flash-live-001
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_VISION_MODEL=gemini-2.0-flash
USE_MOCK_LIVE=false                         # set false once your key + live model work
```

> **No key yet?** Leave `USE_MOCK_LIVE=true`. Everything still runs with simulated captions.

---

## Run

```bash
npm run dev        # backend :8080 + frontend :5173 together
```

Open **http://localhost:5173**. Vite proxies `/api` and `/ws` to the backend.

Run separately if you prefer:

```bash
npm run dev:server   # backend only
npm run dev:web      # frontend only
```

Production build:

```bash
npm run build          # typecheck + build frontend
npm run build:server   # compile backend → server/dist
```

> **Two-device / cross-network note:** WebRTC works out of the box for two tabs on one machine or two devices on the same Wi-Fi (STUN only). For participants on different networks behind strict NATs you would add a **TURN** server to `ICE_SERVERS` in `src/hooks/useRoom.ts`. Captions and text messaging do **not** need TURN — they go through the WebSocket.
>
> **Mic/HTTPS note:** `getUserMedia` requires a secure context. `localhost` counts as secure, so local dev is fine; a deployed build must be served over HTTPS.

---

## Multi-device demo with Cloudflare Tunnel

Phones and tablets need **HTTPS** for mic/camera. SenseBridge uses a **Cloudflare quick tunnel** so any device can open the same public URL while the app still runs on your laptop.

### Why Cloudflare?

| Need | Why |
|---|---|
| HTTPS | Required by the browser for `getUserMedia` (mic / camera) |
| Public URL | Judges / teammates can join from their phones without being on your Wi‑Fi |
| One command | No Cloudflare account required for quick tunnels |

Vite already proxies `/api` and `/ws` to the backend, so **one tunnel to port 5173** is enough.

### Steps

**1. Start the app locally**

```bash
npm run install:all
cp .env.example server/.env   # add GEMINI_API_KEY, set USE_MOCK_LIVE=false for live Gemini
npm run dev
```

Leave this running (frontend `http://localhost:5173`, backend `http://localhost:8080`).

**2. Open a second terminal and start Cloudflare Tunnel**

```bash
npm run tunnel
```

That runs:

```bash
npx --yes cloudflared tunnel --url http://localhost:5173
```

**3. Copy the HTTPS URL**

Look for a line like:

```text
https://random-words-here.trycloudflare.com
```

**4. Open that URL on every device**

| Device | Role | Room |
|---|---|---|
| Laptop | Blind / Low-vision | `DEMO` |
| Phone | Deaf / Hard-of-hearing | `DEMO` |
| Optional tablet | Speech difficulty / Mute | `DEMO` |

Allow mic (and camera for **Show your camera**). Keep the tunnel terminal open for the whole demo.

### Notes

- Restarting `npm run tunnel` **changes the URL** — share the new one with everyone.
- No Cloudflare login is needed for trycloudflare.com quick tunnels.
- For a stable custom hostname, use a named Cloudflare Tunnel tied to your zone (see [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)).
- Vite allows `*.trycloudflare.com` hosts via `server.allowedHosts` in `vite.config.ts`.
- WebRTC voice usually works on the same network; captions and typed SpeakBack always go through the tunneled WebSocket.

---

## Hackathon demo flow

> Easiest demo: two browser tabs on localhost, **or** multiple devices via the Cloudflare URL above.

1. **Tab A — Blind user:** open the app, choose **Blind / Low-vision**, name yourself, enter room code `DEMO`, **Join**.
2. **Tab B — Deaf user:** open the app, choose **Deaf / Hard-of-hearing**, enter the same code `DEMO`, **Join**. Both tabs now show **Connected · 1 other**.
3. **Blind speaks:** in Tab A press the big **Tap to talk** and say *"Hi, I cannot see clearly. Can you help me find the registration desk?"* (In mock mode press **▶️ Simulate speech**.)
   → Tab B streams the caption into the big panel, then into the transcript labeled as the blind user.
4. **Deaf replies:** in Tab B type *"Yes. Walk straight and turn left near the blue banner."* and press **🗣️ Speak** (or tap a quick reply).
   → Tab A **speaks it aloud automatically** and shows it under "Last message".
5. **Blind asks to slow down:** in Tab A speak/simulate *"Can you repeat that more slowly?"*
   → SenseBridge auto-clarifies: *"Sure. Walk straight. Take about ten steps. Then turn left near the blue banner."* — spoken slower on Tab A.
6. **Recap:** press **📝 Recap** (either tab) → *"The blind user asked for help finding the registration desk. The deaf user instructed them to walk straight and turn left near the blue banner."* — shown to the deaf user and spoken to the blind user.
7. **(Optional) Scene Assist:** in Tab B press **📷 Scene Assist**, allow the camera → a short spoken description is delivered to the room.

---

## Accessibility notes

- **Role-based UI:** each participant only sees controls relevant to them — the blind view is a single large tap-to-talk with everything read aloud; the deaf view is caption- and text-centric (with an optional "use my voice" toggle); the mute/speech-difficulty view is type-to-speak (their device voices typed text) while they hear others normally.
- **Large text & high contrast** throughout; captions are 32px, the talk button is a 260px target.
- **ARIA live regions:** captions use `aria-live="assertive"`; status, last-message, and summary use `aria-live="polite"` so screen readers announce updates.
- **Keyboard friendly:** real buttons everywhere, `Enter` sends a reply (Shift+Enter for newline), visible focus outlines.
- **Auto-speech** on the blind side means the blind user never has to find or press anything to hear a reply.
- **Speaker labels + replay** on every transcript line.

---

## Safety disclaimer

> **SenseBridge Live is an accessibility assistance prototype. It should not be used as the sole source of navigation, medical, legal, emergency, or safety-critical guidance.**

It does **not** replace professional accessibility tools, mobility aids (white canes, guide dogs), certified interpreters, or emergency services. **Scene Assist** in particular is only an accessibility aid and should not replace mobility tools or human assistance.

---

## Where Gemini plugs in

- `server/config.ts` — API key + model names (`TODO`s).
- `server/geminiLiveClient.ts` — real-time audio→caption session via `ai.live.connect`; falls back to mock on any error.
- `server/geminiTextClient.ts` — clarify / summary / scene-assist calls, each with offline fallbacks.
- `src/utils/speech.ts` — browser TTS today; single `speak()` to later swap for Gemini audio.
- `src/hooks/useRoom.ts` — `ICE_SERVERS` is where you add TURN for cross-network calls.
