import "./style.css";
import { marked } from "marked";

const apiUrl = "http://localhost:8000";

const btnRecord = document.getElementById("btn_record");
const btnLabel = document.getElementById("btn_record_label");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status_text");
const transcriptEl = document.getElementById("transcript");
const transcriptPlaceholder = document.getElementById(
  "transcript_placeholder"
);
const responseEl = document.getElementById("response");
const responsePlaceholder = document.getElementById("response_placeholder");
const typingEl = document.getElementById("typing");
const hintEl = document.getElementById("hint");
const unsupportedEl = document.getElementById("unsupported");

const ERROR_MESSAGES = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser settings.",
  "service-not-allowed": "The browser blocked the speech service. Try Chrome over HTTPS or localhost.",
  "audio-capture": "No microphone was found. Check your audio input device.",
  "network": "The speech recognition service needs a network connection.",
  "no-speech": "No speech detected. Try again and speak a little louder.",
  aborted: "",
};

function setStatus(state, text) {
  statusEl.dataset.state = state;
  statusText.textContent = text;
}

function setHint(text) {
  hintEl.textContent = text;
}

function showTyping(show) {
  typingEl.hidden = !show;
}

function renderTranscript(text, { interim = false } = {}) {
  transcriptEl.textContent = text;
  transcriptEl.dataset.interim = String(interim);
  transcriptPlaceholder.hidden = Boolean(text);
}

function renderResponse(markdown) {
  // marked output is inserted as HTML. The content is Markdown returned by our
  // own backend, but it is still model-generated text, so treat it as untrusted
  // if this demo is ever pointed at a different backend or model.
  responseEl.innerHTML = marked.parse(markdown);
  responsePlaceholder.hidden = true;
}

function resetPanes() {
  renderTranscript("");
  responseEl.innerHTML = "";
  responsePlaceholder.hidden = false;
  showTyping(false);
}

/** @param {string} prompt  */
async function promptAI(prompt) {
  const response = await fetch(apiUrl, {
    body: JSON.stringify({ prompt }),
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Server responded ${response.status}`);
  }

  return response.text();
}

function setUpSpeechRecognition(onFinish) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const listener = new SpeechRecognition();
  listener.continuous = true;
  listener.maxAlternatives = 2;
  listener.interimResults = true;

  let finalText = "";

  listener.onstart = function () {
    setStatus("listening", "Listening...");
    setHint("Speak now. Click again when you're done.");
    renderTranscript("", { interim: true });
    finalText = "";
  };

  listener.onresult = function (event) {
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const results = event.results[i];
      const [best] = Array.from(results).toSorted(
        (a, b) => b.confidence - a.confidence
      );

      // Finalised phrases accumulate; in-progress ones are shown greyed out.
      if (results.isFinal) finalText += best.transcript;
      else interim += best.transcript;
    }

    renderTranscript(finalText + interim, { interim: !finalText.trim() });
  };

  listener.onerror = function (event) {
    const message = ERROR_MESSAGES[event.error];

    if (event.error !== "aborted" && message) {
      setHint(message);
      setStatus("idle", "Error");
      console.error("recognition error:", event.error);
    }
  };

  listener.onend = function () {
    const transcript = finalText.trim();
    if (!transcript) {
      renderTranscript("");
      return;
    }
    onFinish(transcript);
  };

  return listener;
}

async function start() {
  let isListening = false;
  let isBusy = false;

  const listener = setUpSpeechRecognition(async function (transcript) {
    isBusy = true;
    btnRecord.disabled = true;
    btnLabel.textContent = "Thinking...";
    setStatus("thinking", "Thinking...");
    setHint("Waiting for Gemini...");
    showTyping(true);

    renderTranscript(transcript);
    responseEl.innerHTML = "";
    responsePlaceholder.hidden = true;

    try {
      const answer = await promptAI(transcript);
      renderResponse(answer);
      setStatus("done", "Done");
      setHint("Click to record another prompt.");
    } catch (error) {
      console.error("error:", error);
      setStatus("idle", "Error");
      setHint("Could not reach the backend. Is the server running on :8000?");
    } finally {
      isBusy = false;
      isListening = false;
      btnRecord.disabled = false;
      btnLabel.textContent = "Start speaking";
      btnRecord.dataset.state = "idle";
      showTyping(false);
    }
  });

  btnRecord.addEventListener("click", function () {
    if (isBusy) return;

    if (isListening) {
      isListening = false;
      btnLabel.textContent = "Sending...";
      btnRecord.dataset.state = "idle";
      return listener.stop();
    }

    isListening = true;
    btnLabel.textContent = "Stop & send";
    btnRecord.dataset.state = "listening";
    responsePlaceholder.hidden = true;
    listener.start();
  });
}

function ensureBrowserHasSpeechAPI() {
  const supported =
    "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

  if (!supported) {
    btnRecord.hidden = true;
    statusEl.hidden = true;
    unsupportedEl.hidden = false;
    return;
  }

  start();
}

ensureBrowserHasSpeechAPI();