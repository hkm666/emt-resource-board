"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "public", "index.html");
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  fs.createReadStream(INDEX).pipe(res);
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`EMT Resource Board on http://localhost:${PORT}`));
}

module.exports = server;