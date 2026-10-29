const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = __dirname;
const MAX_BODY = 8 * 1024 * 1024;

function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.GROQ_SECRET || "";
  return typeof key === "string" ? key.trim() : "";
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) {
      const err = new Error("Request too large. Please use a smaller image.");
      err.statusCode = 413;
      throw err;
    }
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

async function callGroq(messages, model) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY is missing in Render Environment.");
    err.statusCode = 500;
    throw err;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6
    })
  });

  const raw = await response.text();
  let result = {};
  try { result = raw ? JSON.parse(raw) : {}; } catch {}

  if (!response.ok) {
    const detail = result.error?.message || `Groq API returned HTTP ${response.status}.`;
    const err = new Error(detail);
    err.statusCode = 502;
    throw err;
  }

  const reply = result.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    const err = new Error("AI did not return a reply.");
    err.statusCode = 502;
    throw err;
  }
  return reply.trim();
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = parsed.pathname;

  if (req.method === "GET" && (route === "/" || route === "/index.html")) {
    const file = path.join(PUBLIC_DIR, "index.html");
    fs.readFile(file, (error, content) => {
      if (error) {
        return sendJSON(res, 500, {
          error: "index.html is missing. Add index.html to the same GitHub repository as index.js."
        });
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(content);
    });
    return;
  }

  if (req.method === "GET" && route === "/health") {
    return sendJSON(res, 200, {
      app: "Bolo Max",
      status: "ok",
      apiKeyConfigured: Boolean(getGroqApiKey())
    });
  }

  if (req.method === "GET" && route === "/vision") {
    return sendJSON(res, 200, {
      app: "Bolo Max",
      feature: "Camera Vision",
      status: "ready",
      note: "Send a POST request with an image data URL to use vision."
    });
  }

  if (req.method === "POST" && route === "/chat") {
    try {
      const data = await readBody(req);
      if (typeof data.message !== "string" || !data.message.trim()) {
        return sendJSON(res, 400, { error: "Please enter a message." });
      }

      const reply = await callGroq([
        {
          role: "system",
          content: "You are Bolo Max, a helpful Hindi and English assistant. Reply in the same language as the user. If the user writes Hindi or Hinglish, answer naturally in Hindi/Hinglish. Keep replies friendly, clear, and simple."
        },
        { role: "user", content: data.message.trim() }
      ], "openai/gpt-oss-20b");

      return sendJSON(res, 200, { app: "Bolo Max", reply });
    } catch (error) {
      return sendJSON(res, error.statusCode || 500, {
        error: error.message || "Backend could not complete chat."
      });
    }
  }

  if (req.method === "POST" && route === "/vision") {
    try {
      const data = await readBody(req);
      if (typeof data.image !== "string" || !data.image.startsWith("data:image/")) {
        return sendJSON(res, 400, { error: "Please choose or capture an image first." });
      }

      const prompt = typeof data.prompt === "string" && data.prompt.trim()
        ? data.prompt.trim()
        : "Describe this image clearly. Read visible text if possible. Reply in simple Hindi.";

      const reply = await callGroq([
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: data.image } }
          ]
        }
      ], "meta-llama/llama-4-scout-17b-16e-instruct");

      return sendJSON(res, 200, { app: "Bolo Max", reply });
    } catch (error) {
      return sendJSON(res, error.statusCode || 500, {
        error: error.message || "Camera Vision could not analyze this image."
      });
    }
  }

  return sendJSON(res, 404, { error: "Not found", path: route });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Bolo Max backend listening on ${PORT}`);
});
