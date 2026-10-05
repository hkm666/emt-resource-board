"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "public", "index.html");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  fs.createReadStream(INDEX).pipe(res);
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`EMT Resource Board on http://localhost:${PORT}`));
}

module.exports = server;