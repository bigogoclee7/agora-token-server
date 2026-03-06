// Agora Token Server — Uses Agora REST API to generate tokens
const http  = require("http");
const url   = require("url");
const https = require("https");

const APP_ID   = "8f50239c3b45482eb068a83eb1ed1120";
const APP_CERT = "fe951597fb0747b4bca04a81b7d6396e";
const PORT     = process.env.PORT || 3000;

const AUTH = "Basic " + Buffer.from(APP_ID + ":" + APP_CERT).toString("base64");

function getAgoraToken(channel, uid, role) {
  return new Promise((resolve, reject) => {
    // role: "publisher" or "subscriber"
    const path = /v1/project/${APP_ID}/rtc/${encodeURIComponent(channel)}/uid/${uid}/token?ttl=86400&role=${role === "subscriber" ? "subscriber" : "publisher"};
    const options = {
      hostname: "api.agora.io",
      path: path,
      method: "GET",
      headers: {
        "Authorization": AUTH,
        "Content-Type": "application/json"
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.token) resolve(json.token);
          else reject(new Error("No token in response: " + data));
        } catch(e) { reject(new Error("Parse error: " + data)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

const server = http.createServer(async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const p = url.parse(req.url, true);

  if (p.pathname === "/" || p.pathname === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (p.pathname === "/token") {
    const channel = p.query.channel;
    if (!channel) { res.writeHead(400); res.end(JSON.stringify({ error: "channel required" })); return; }
    const uid  = p.query.uid || "0";
    const role = p.query.role || "publisher";
    try {
      const token = await getAgoraToken(channel, uid, role);
      res.writeHead(200);
      res.end(JSON.stringify({ token, channel, uid, appId: APP_ID }));
    } catch(e) {
      console.error("Token error:", e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", () => console.log("Token server on port " + PORT));
