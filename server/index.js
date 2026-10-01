import http from "node:http";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    // JSON.parse runs inside an event handler, so its throw must be caught
    // here. Left uncaught it becomes an uncaught exception and kills the server.
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini intermittently returns 503 "high demand", so retry a few times
// before giving up and letting the frontend show an error.
async function generateWithRetry(prompt) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      });
    } catch (error) {
      lastError = error;
      const status = error?.status;

      if (!RETRYABLE_STATUS.has(status) || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(
        `Gemini ${status} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${waitMs}ms`
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}

const server = http.createServer(async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  switch (req.method) {
    case "POST": {
      try {
        const body = await parseRequestBody(req);
        const response = await generateWithRetry(body.prompt);

        res.statusCode = 200;
        return res.end(response.text);
      } catch (error) {
        console.error("error:", error?.message || error);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: "Failed to get AI response" }));
      }
    }

    default:
      return res.end("non-POST request received");
  }
});

const port = Number(process.env.PORT) || 8000;
server.listen(port, function () {
  console.log("server running on port", port);
});

// Never let one bad request take down the whole server.
process.on("uncaughtException", (err) => console.error("uncaught:", err));
process.on("unhandledRejection", (err) =>
  console.error("unhandled rejection:", err)
);