const http = require("http");

const getGroqApiKey = () => {
  const key = process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.GROQ_SECRET;
  return typeof key === "string" ? key.trim() : "";
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      app: "Bolo Max",
      status: "Backend running"
    }));
  }
if (req.url === "/vision" && req.method === "GET") {
  res.writeHead(200, { "Content-Type": "application/json" });
  return res.end(JSON.stringify({
    feature: "Camera Vision",
    status: "Ready for setup"
  }));
}
  if (req.url === "/chat" && req.method === "POST") {
    try {
      const groqApiKey = getGroqApiKey();
      if (!groqApiKey) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: "GROQ_API_KEY is missing or empty in Render environment"
        }));
      }

      let body = "";
      for await (const chunk of req) body += chunk;

      if (!body.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Request body is empty" }));
      }

      let data;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }

      if (!data.message || typeof data.message !== "string" || !data.message.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Please send a message" }));
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [
              {
                role: "system",
               content: "You are Bolo Max, a helpful AI assistant. Always reply in the same language the user uses. If the user speaks Hindi, reply in natural Hindi or Hinglish. If the user speaks English, reply in English. Keep replies simple, friendly, and easy to understand."
              },
              { role: "user", content: data.message }
            ]
          })
        }
      );

      const responseText = await response.text();
      let result = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        result = {};
      }

      if (!response.ok) {
        const groqError = result.error?.message || result.message || "Groq API request failed";
        res.writeHead(502, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: groqError }));
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        reply: result.choices?.[0]?.message?.content || "No reply received"
      }));
    } catch (error) {
      const message = error?.message || "Unknown server error";
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: message }));
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Bolo Max backend listening on " + PORT);
});
