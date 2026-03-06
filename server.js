// Agora Token Server — Reverse-engineered from working Agora temp token
const http   = require("http");
const url    = require("url");
const crypto = require("crypto");
const zlib   = require("zlib");

const APP_ID   = "8f50239c3b45482eb068a83eb1ed1120";
const APP_CERT = "fe951597fb0747b4bca04a81b7d6396e";
const PORT     = process.env.PORT || 3000;

function p16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xFFFF, 0); return b; }
function p32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0, 0); return b; }
function pStr(s) { const b = Buffer.from(String(s || ""), "utf8"); return Buffer.concat([p16(b.length), b]); }
function pPrivs(privs) {
  const keys = Object.keys(privs).map(Number).sort((a,b) => a-b);
  let buf = p16(keys.length);
  for (const k of keys) buf = Buffer.concat([buf, p16(k), p32(privs[k])]);
  return buf;
}

function buildToken(channel, uid, role, expireSeconds) {
  const ts     = Math.floor(Date.now() / 1000);
  const salt   = Math.floor(Math.random() * 0xFFFFFFFF) + 1;
  const expire = ts + expireSeconds;
  const uidStr = String(uid || "");
  const privs  = { 1: expire };
  if (role === 1) { privs[2] = expire; privs[3] = expire; privs[4] = expire; }

  const msg = Buffer.concat([
    pStr(APP_ID), p32(ts), p32(salt), p32(expire),
    pPrivs(privs), pStr(channel), pStr(uidStr)
  ]);
  const sig = crypto.createHmac("sha256", Buffer.from(APP_CERT, "utf8")).update(msg).digest();
  const body = Buffer.concat([
    p16(sig.length), sig,
    pStr(APP_ID), p32(ts), p32(salt), p32(expire),
    pPrivs(privs), pStr(channel), pStr(uidStr)
  ]);
  const compressed = zlib.deflateSync(body, { level: 6 });
  const raw = compressed.slice(2, compressed.length - 4);
  return "007" + raw.toString("base64");
}

const server = http.createServer(function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === "/" || parsed.pathname === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (parsed.pathname === "/token") {
    const channel = parsed.query.channel;
    if (!channel) { res.writeHead(400); res.end(JSON.stringify({ error: "channel required" })); return; }
    const uid   = parseInt(parsed.query.uid || "0", 10);
    const role  = parsed.query.role === "subscriber" ? 2 : 1;
    const token = buildToken(channel, uid, role, 86400);
    res.writeHead(200);
    res.end(JSON.stringify({ token, channel, uid, appId: APP_ID }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("Agora Token Server running on port " + PORT);
});
