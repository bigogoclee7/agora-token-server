const http = require("http");
const url = require("url");
const crypto = require("crypto");
const zlib = require("zlib");

const APP_ID = "8f50239c3b45482eb068a83eb1ed1120";
const APP_CERT = "fe951597fb0747b4bca04a81b7d6396e";
const PORT = process.env.PORT || 3000;

function makeToken(channel, uid, role, expire) {
  var uidStr = String(uid || 0);
  var ts = Math.floor(Date.now() / 1000);
  var salt = Math.floor(Math.random() * 0xFFFFFFFF) + 1;
  var exp = ts + expire;
  function u16(v) { var b = Buffer.alloc(2); b.writeUInt16BE(v >>> 0, 0); return b; }
  function u32(v) { var b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0, 0); return b; }
  function str(s) { var sb = Buffer.from(String(s), "utf8"); return Buffer.concat([u16(sb.length), sb]); }
  var msg = Buffer.concat([str(APP_ID), u32(ts), u32(salt), u32(exp), str(channel), str(uidStr), u32(role)]);
  var sig = crypto.createHmac("sha256", Buffer.from(APP_CERT, "utf8")).update(msg).digest();
  var body = Buffer.concat([u16(1), u16(APP_ID.length), Buffer.from(APP_ID), u32(ts), u32(salt), u32(exp), u16(sig.length), sig, str(channel), str(uidStr), u32(role)]);
  return "006" + APP_ID + zlib.deflateRawSync(body).toString("base64");
}

var server = http.createServer(function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  var parsed = url.parse(req.url, true);
  if (parsed.pathname === "/" || parsed.pathname === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", message: "Agora Token Server" }));
    return;
  }
  if (parsed.pathname === "/token") {
    var channel = parsed.query.channel;
    if (!channel) { res.writeHead(400); res.end(JSON.stringify({ error: "channel required" })); return; }
    var uid = parseInt(parsed.query.uid || "0", 10);
    var role = parsed.query.role === "subscriber" ? 2 : 1;
    var token = makeToken(channel, uid, role, 86400);
    res.writeHead(200);
    res.end(JSON.stringify({ token: token, channel: channel, uid: uid, appId: APP_ID }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("Server running on port " + PORT);
});
