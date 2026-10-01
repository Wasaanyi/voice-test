# Voice-Powered AI App (Web Speech API)

Speak a prompt in the browser and Gemini answers it back. Built while following the
[freeCodeCamp guide](https://www.freecodecamp.org/news/how-to-build-a-voice-powered-ai-application-with-the-web-speech-api/).

- **Frontend** (Vite, vanilla JS) — `SpeechRecognition` transcribes your speech live,
  `marked` renders Gemini's Markdown reply.
- **Backend** (Node.js) — prompts Gemini and returns the reply as text.

## Requirements

- **Google Chrome 110+** (for the Web Speech API and `Array.prototype.toSorted`)
- Node.js 20+ (the backend uses `node --env-file`)
- A [Gemini API key](https://aistudio.google.com/apikey)

## Setup

```sh
git clone git@github.com:Wasaanyi/voice-test.git
cd voice-test

cp server/.env.example server/.env
# edit server/.env and set GEMINI_API_KEY

cd server    && npm install
cd ../frontend && npm install
```

## Run

Two terminals:

```sh
cd server    && npm start     # backend on :8000
cd frontend  && npm run dev   # frontend on :5173
```

Then open <http://localhost:5173>.

Use `localhost`, not a LAN or WSL IP address. Chrome only exposes the Speech
Recognition API in a secure context, so `http://192.168.x.x:5173` will fail however
recent your Chrome is.

### Using it

Click **Start speaking** and grant microphone access. Your words stream into the
**You said** pane as they are recognised, greyed and italic until Chrome finalises
them. Click **Stop & send** when you're finished. Gemini's reply appears in the
**Gemini** pane, rendered as Markdown.

Each new recording replaces the previous exchange, keeping the pipeline legible
rather than scrolling away.

## How it works

1. `SpeechRecognition` streams microphone audio to Chrome's recognition engine and
   returns interim and final transcriptions.
2. On stop, the final transcript is sent as JSON to `POST /` on port 8000.
3. The backend prompts Gemini, retrying transient failures, and responds with text.
4. The frontend converts that Markdown to HTML with `marked` and renders it.

Chrome's recognition is server-side, so transcription needs a working internet
connection. Audio is processed by Google, not locally.

## Differences from the tutorial

The tutorial's code is a good starting point but does not run as written. These are
the changes, and why:

| Change | Reason |
| --- | --- |
| `gemini-3.8-flash` instead of `gemini-2.5-flash` | The original model returns `404 ... no longer available to new users`. Override with `GEMINI_MODEL`. |
| Retries with exponential backoff on 429/5xx | Gemini frequently answers `503 high demand`. Without this, requests fail at random. |
| `Access-Control-Allow-Methods` / `-Headers` and an `OPTIONS` reply | A JSON `POST` triggers a CORS preflight. The tutorial sets only `Allow-Origin`, which is enough for simple GETs, so every request from the browser was blocked. |
| `.unsupported[hidden] { display: none }` | The notice is a full-screen overlay. Its own `display: grid` overrode the browser's `[hidden]` rule, so it covered the page and swallowed every click. |
| `JSON.parse` wrapped in `try`/`catch` | It runs inside the request's `end` event handler, outside the promise executor, so a throw escaped the promise and killed the server process. |
| UI resets when recognition ends with no speech | Otherwise the button stayed stuck on "Sending..." forever. |
| `interimResults` enabled | Shows transcription as you speak instead of only after stopping. |
| Self-diagnosing unsupported notice | Reports the page's protocol and `isSecureContext` instead of a generic message. |
| Distinguishes "backend down" from "Gemini busy" | The two failures need very different advice. |

## Tests

```sh
cd frontend
npx playwright install chromium   # once
npm test
```

Six checks drive a headless browser against the running dev server, covering the
overlay bug, the stuck button, and the diagnostic notice.

**What the tests cannot do:** headless Chromium's `SpeechRecognition` is a
non-functional stub — `start()` emits no events at all, not even `onstart`. Real
speech recognition and live Gemini replies are therefore untested automatically and
need a desktop browser.

## Troubleshooting

**"Speech recognition unavailable"** — the browser cannot see the API. Check the
protocol in the notice: if it says `http://` on a non-localhost host, switch to
`http://localhost:5173`. If the page is already secure, look for a blocked
microphone in `chrome://settings/content/microphone`.

**"Gemini is busy right now"** — Gemini's own servers are overloaded (`503`). This
is upstream, not your code. Retry; the backend already makes three attempts first.

**Nothing happens when clicking** — an older Chrome build is likely, or the dev
server is not running. Both return a connection error otherwise.

## Security

The API key lives in `server/.env`, which is gitignored; only `.env.example` is
committed. Never commit the real file.

For a public deployment, set `ALLOWED_ORIGINS` to your frontend's origin instead of
the `*` default so your Gemini quota cannot be spent by other sites, and terminate
TLS in front of both services.
