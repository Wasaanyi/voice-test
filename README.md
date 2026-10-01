# Voice-Powered AI App (Web Speech API)

Speak a prompt in the browser, and an AI assistant answers it back. Built from the
[freeCodeCamp guide](https://www.freecodecamp.org/news/how-to-build-a-voice-powered-ai-application-with-the-web-speech-api/).

- **Frontend** (Vite, vanilla JS) — `SpeechRecognition` transcribes your voice, `marked`
  renders the AI's Markdown reply.
- **Backend** (Node.js) — prompts Gemini and returns the response.

## Requirements

- **Google Chrome 110+** (the Web Speech API and `Array.prototype.toSorted`)
- Node.js 20+ (uses `node --env-file`)
- A [Gemini API key](https://aistudio.google.com/apikey)

## Setup

Get an API key and put it in `server/.env`:

```sh
cp server/.env.example server/.env
# then edit server/.env and set GEMINI_API_KEY
```

Install dependencies:

```sh
cd server   && npm install
cd ../frontend && npm install
```

## Run

Two terminals:

```sh
# terminal 1 - backend on :8000
cd server && npm start
```

```sh
# terminal 2 - frontend on :5173
cd frontend && npm run dev
```

Open <http://localhost:5173>, click **Record prompt**, allow microphone access, speak,
then click **Stop recording**. Your transcript appears in red on the right and Gemini's
reply in green on the left.

## Notes on this implementation

This deviates from the tutorial in three places:

1. **Model** — the tutorial's `gemini-2.5-flash` is retired for new users (HTTP 404).
   We default to `gemini-3.8-flash`; override with `GEMINI_MODEL` in `server/.env`.
2. **Retries** — Gemini intermittently returns `503 high demand`. The server retries
   up to 3 times with exponential backoff on 429/5xx responses.
3. **Crash fix** — `JSON.parse` in `parseRequestBody` runs inside the request's `end`
   event handler, so a throw there escaped the promise and killed the whole server on
   any malformed request. It is now caught, with `uncaughtException` as a backstop.

Your API key lives in `server/.env`, which is gitignored. Never commit it.

## Troubleshooting

**"Speech recognition unavailable"** — the browser cannot see the API at all.
Open the page at `http://localhost:5173`. Chrome only exposes the Speech
Recognition API in a secure context, so reaching the dev server through a WSL or
LAN IP address over plain http will always fail, however new your Chrome is.
The notice reports the page's protocol and `isSecureContext` to confirm which
case you hit.

## Tests

```sh
cd frontend
npx playwright install chromium   # once
npm test
```

The suite drives a headless browser against the running dev server and covers
the two bugs that were invisible without a real click: the full-screen
"unsupported" overlay silently swallowing every click, and the record button
staying stuck on "Sending..." when you stop without speaking.

Note that headless Chromium's `SpeechRecognition` is a non-functional stub
(`start()` emits no events at all), so these tests cannot validate real speech
recognition or Gemini responses. That path needs a desktop browser.