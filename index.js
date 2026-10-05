"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "public", "index.html");

const handlers = {
  me: require("./api/me/index.js"),
  state: require("./api/state/index.js"),
  exportDb: require("./api/export/index.js"),
  peopleList: require("./api/people/index.js"),
  peopleId: require("./api/people/[id].js"),
  projectsList: require("./api/projects/index.js"),
  projectsId: require("./api/projects/[id].js"),
  bookingsList: require("./api/bookings/index.js"),
  bookingsId: require("./api/bookings/[id].js"),
  holidaysList: require("./api/holidays/index.js"),
  holidaysId: require("./api/holidays/[id].js"),
};

const COLLECTIONS = ["people", "projects", "bookings", "holidays"];
const listHandlers = { people: handlers.peopleList, projects: handlers.projectsList, bookings: handlers.bookingsList, holidays: handlers.holidaysList };
const idHandlers = { people: handlers.peopleId, projects: handlers.projectsId, bookings: handlers.bookingsId, holidays: handlers.holidaysId };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = url.pathname.replace(/\/+$/, "") || "/";

    if (p === "/api/me") return handlers.me(req, res);
    if (p === "/api/state") return handlers.state(req, res);
    if (p === "/api/export") return handlers.exportDb(req, res);

    const m = p.match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
    if (m && COLLECTIONS.includes(m[1])) {
      const col = m[1];
      const id = m[2] ? decodeURIComponent(m[2]) : null;
      if (id) {
        req.query = { id };
        return idHandlers[col](req, res);
      }
      return listHandlers[col](req, res);
    }

    if (p === "/" || p === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(INDEX).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  } catch (err) {
    console.error("Route error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`EMT Resource Board on http://localhost:${PORT}`));
}

module.exports = server;