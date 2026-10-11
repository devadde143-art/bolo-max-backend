const http = require("http");

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

  if (req.url === "/chat" && req.method === "POST") {
    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing in Render");
      }

      let body = "";
      for await (const chunk of req) body += chunk;

      const data = JSON.parse(body);
      if (!data.message || typeof data.message !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: "Please send a message"
        }));
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "You are Bolo Max, a helpful AI assistant. Reply in the user's language, Hindi or English."
              },
              { role: "user", content: data.message }
            ]
          })
        }
      );

      const result = await response.json();
      if (!response.ok) {
        res.writeHead(502, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: result.error?.message || "Groq API request failed"
        }));
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        reply: result.choices?.[0]?.message?.content || "No reply received"
      }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: error.message }));
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Bolo Max backend listening on " + PORT);
});
