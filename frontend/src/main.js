import "./style.css";
import { marked } from "marked";

const apiUrl = "http://localhost:8000";
const btnRecord = document.getElementById("btn_record");
const uListChat = document.getElementById("ulist_chat");

function ensureBrowserHasSpeechAPI() {
  if (
    !("webkitSpeechRecognition" in window) &&
    !("SpeechRecognition" in window)
  ) {
    btnRecord.style.display = "none";

    return alert(
      "This browser does not have the features required for this demo. Use Google Chrome >= v33"
    );
  }

  start();
}

function toggleRecording(config, listener) {
  if (config.isListening) {
    config.isListening = false;
    btnRecord.innerText = "Start recording";
    return listener.stop();
  }

  config.isListening = true;
  btnRecord.innerText = "Stop recording";

  return listener.start();
}

/** @param {string} transcript  */
function appendTranscriptToChatList(transcript) {
  const li = document.createElement("li");
  li.innerText = transcript;
  li.classList.add("transcript");
  uListChat.appendChild(li);
}

/** @param {string} aiResponse  */
function appendAIResponseToChatList(aiResponse) {
  const li = document.createElement("li");
  li.innerHTML = marked.parse(aiResponse);
  li.classList.add("ai_response");
  uListChat.appendChild(li);
}

/** @param {string} prompt  */
async function promptAI(prompt) {
  try {
    const response = await fetch(apiUrl, {
      body: JSON.stringify({ prompt }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(err);
      alert("An error occurred. Try again");
      return;
    }

    const text = await response.text();
    return text;
  } catch (error) {
    logError(error);
    alert("An error occurred. Try again");
    return "";
  }
}

function setUpSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const listener = new SpeechRecognition();
  listener.continuous = true; // listen for long speech
  listener.maxAlternatives = 2; // only two transcription suggestions required
  let transcript = "";

  // automatic: onstart -> onaudiostart -> onsoundstart -> onspeechstart
  // automatic: onspeechend -> onsoundend -> onaudioend -> onresult -> onend
  // click button: onaudioend -> onresult -> onend

  listener.onend = async function () {
    if (!transcript || !transcript.trim()) return;

    btnRecord.innerText = "Thinking...";
    btnRecord.disabled = true;
    appendTranscriptToChatList(transcript);
    promptAI(transcript)
      .then(function (res) {
        appendAIResponseToChatList(res);
      })
      .finally(function () {
        btnRecord.innerText = "Record prompt";
        btnRecord.disabled = false;
        transcript = "";
      });
  };

  listener.onerror = function (err) {
    logError(err);
    alert("Error occurred while capturing speech");
  };

  listener.onresult = function (event) {
    for (const alternatives of event.results) {
      const [bestAlternative] = Array.from(alternatives).toSorted(
        (altA, altB) => altB.confidence - altA.confidence
      );

      transcript += bestAlternative.transcript;
    }
  };

  return listener;
}

async function start() {
  const config = {
    isListening: false,
  };

  const listener = setUpSpeechRecognition();

  btnRecord.addEventListener("click", function () {
    toggleRecording(config, listener);
  });
}

ensureBrowserHasSpeechAPI();

function logError(...str) {
  for (const s of str) {
    console.error("error:", s);
  }
}