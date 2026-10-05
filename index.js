"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "public", "index.html");

const COLLECTIONS = ["people", "projects", "bookings", "holidays"];

async function loadApiHandler(p) {
  return require(p);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (p === "/api/me") { return (await loadApiHandler("./api/me/index.js"))(req, res); }
  if (p === "/api/state") { return (await loadApiHandler("./api/state/index.js"))(req, res); }
  if (p === "/api/export") { return (await loadApiHandler("./api/export/index.js"))(req, res); }

  const m = p.match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
  if (m && COLLECTIONS.includes(m[1])) {
    const col = m[1];
    const id = m[2] ? decodeURIComponent(m[2]) : null;
    if (id) {
      req.query = { id };
      return (await loadApiHandler(`./api/${col}/[id].js`))(req, res);
    }
    return (await loadApiHandler(`./api/${col}/index.js`))(req, res);
  }

  if (p === "/" || p === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(INDEX).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`EMT Resource Board on http://localhost:${PORT}`));
}

module.exports = server;
