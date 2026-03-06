var http = require("http");
var url  = require("url");
var agora = require("agora-token");

var APP_ID   = "8f50239c3b45482eb068a83eb1ed1120";
var APP_CERT = "fe951597fb0747b4bca04a81b7d6396e";
var PORT     = process.env.PORT || 3000;

function buildToken(channel, uid, role, expire) {
  var ts = Math.floor(Date.now() / 1000) + expire;
  var r  = role === "subscriber" ? agora.RtcRole.SUBSCRIBER : agora.RtcRole.PUBLISHER;
  return agora.RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERT, channel, uid, r, ts);
}

var server = http.createServer(function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  var p = url.parse(req.url, true);

  if (p.pathname === "/" || p.pathname === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (p.pathname === "/token") {
    var channel = p.query.channel;
    if (!channel) { res.writeHead(400); res.end(JSON.stringify({ error: "channel required" })); return; }
    var uid   = parseInt(p.query.uid || "0", 10);
    var role  = p.query.role || "publisher";
    var token = buildToken(channel, uid, role, 86400);
    res.writeHead(200);
    res.end(JSON.stringify({ token: token, channel: channel, uid: uid, appId: APP_ID }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("Token server running on port " + PORT);
});
