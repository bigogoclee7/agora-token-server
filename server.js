// Agora Token Server — Official RTC Token Builder 2 algorithm
// Based on Agora's official AccessToken2 spec

const http = require("http");
const url = require("url");
const crypto = require("crypto");
const zlib = require("zlib");

const APP_ID = "8f50239c3b45482eb068a83eb1ed1120";
const APP_CERT = "fe951597fb0747b4bca04a81b7d6396e";
const PORT = process.env.PORT || 3000;

// ── Agora AccessToken2 (official format) ─────────────────────────────────────
// Privilege codes
const PRIV_JOIN_CHANNEL = 1;
const PRIV_PUBLISH_AUDIO = 2;
const PRIV_PUBLISH_VIDEO = 3;
const PRIV_PUBLISH_DATA = 4;

function pack16(v) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v >>> 0, 0);
  return b;
}
function pack32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0, 0);
  return b;
}
function packString(s) {
  const sb = Buffer.from(String(s || ""), "utf8");
  return Buffer.concat([pack16(sb.length), sb]);
}
function packMap(m) {
  // map<uint16, uint32>
  const keys = Object.keys(m);
  let buf = pack16(keys.length);
  for (const k of keys) {
    buf = Buffer.concat([buf, pack16(parseInt(k)), pack32(m[k])]);
  }
  return buf;
}

function buildTokenV2(channelName, uid, role, expire) {
  const uidStr = String(uid || 0);
  const ts = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 0xFFFFFFFF) + 1;
  const expireTs = ts + expire;

  // Privileges: join always, publish if host
  const privs = { [PRIV_JOIN_CHANNEL]: expireTs };
  if (role === 1) { // publisher/host
    privs[PRIV_PUBLISH_AUDIO] = expireTs;
    privs[PRIV_PUBLISH_VIDEO] = expireTs;
    privs[PRIV_PUBLISH_DATA] = expireTs;
  }

  // Message to sign
  const msg = Buffer.concat([
    packString(APP_ID),
    pack32(ts),
    pack32(salt),
    packString(channelName),
    packString(uidStr),
    packMap(privs),
  ]);

  const sig = crypto
    .createHmac("sha256", Buffer.from(APP_CERT, "utf8"))
    .update(msg)
    .digest();

  // Token body
  const body = Buffer.concat([
    pack16(2), // version = 2
    packString(APP_ID),
    pack32(ts),
    pack32(salt),
    packString(channelName),
    packString(uidStr),
    packMap(privs),
    pack16(sig.length),
    sig,
  ]);

  const compressed = zlib.deflateRawSync(body);
  return "007" + Buffer.from(compressed).toString("base64");
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);

  if (parsed.pathname === "/" || parsed.pathname === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", message: "Agora Token Server v2" }));
    return;
  }

  if (parsed.pathname === "/token") {
    const channel = parsed.query.channel;
    if (!channel) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "channel required" }));
      return;
    }
    const uid = parseInt(parsed.query.uid || "0", 10);
    const role = parsed.query.role === "subscriber" ? 2 : 1;
    const expire = 86400; // 24 hours
    const token = buildTokenV2(channel, uid, role, expire);
    res.writeHead(200);
    res.end(JSON.stringify({ token, channel, uid, appId: APP_ID }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("Agora Token Server v2 running on port " + PORT);
});
