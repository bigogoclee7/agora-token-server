var http  = require("http");
var url   = require("url");
var https = require("https");

var APP_ID   = "8f50239c3b45482eb068a83eb1ed1120";
var APP_CERT = "fe951597fb0747b4bca04a81b7d6396e";
var PORT     = process.env.PORT || 3000;
var AUTH     = "Basic " + Buffer.from(APP_ID + ":" + APP_CERT).toString("base64");

function getToken(channel, uid, role, callback) {
  var path = "/v1/project/" + APP_ID + "/rtc/" + encodeURIComponent(channel) + "/uid/" + uid + "/token?ttl=86400&role=" + role;
  var options = {
    hostname: "api.agora.io",
    path: path,
    method: "GET",
    headers: { "Authorization": AUTH, "Content-Type": "application/json" }
  };
  var req = https.request(options, function(res) {
    var data = "";
    res.on("data", function(chunk) { data += chunk; });
    res.on("end", function() {
      try {
        var json = JSON.parse(data);
        if (json.token) callback(null, json.token);
        else callback(new Error("No token: " + data));
      } catch(e) { callback(new Error("Parse error: " + data)); }
    });
  });
  req.on("error", callback);
  req.setTimeout(10000, function() { req.destroy(); callback(new Error("Timeout")); });
  req.end();
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
    var uid  = p.query.uid || "0";
    var role = p.query.role === "subscriber" ? "subscriber" : "publisher";
    getToken(channel, uid, role, function(err, token) {
      if (err) {
        console.error("Token error:", err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ token: token, channel: channel, uid: uid, appId: APP_ID }));
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("Token server on port " + PORT);
});
