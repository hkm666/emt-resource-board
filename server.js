// EMT Resource Board — self-hosted server
// Zero dependencies. Needs Node.js 18 or newer.
// Stores everything in one JSON file (data/db.json) with daily backups.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const TEAM_USER = process.env.TEAM_USER || "emt";
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "";
const VIEW_USER = process.env.VIEW_USER || "view";
const VIEW_PASSWORD = process.env.VIEW_PASSWORD || "";
const ALLOW_NO_AUTH = process.env.ALLOW_NO_AUTH === "1";
const KEEP_BACKUPS = Number(process.env.KEEP_BACKUPS || 30);

const COLLECTIONS = ["people", "projects", "bookings", "holidays"];
const DB_FILE = path.join(DATA_DIR, "db.json");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const INDEX_FILE = path.join(__dirname, "public", "index.html");

if (!TEAM_PASSWORD && !ALLOW_NO_AUTH) {
  console.error("Refusing to start: set TEAM_PASSWORD (or ALLOW_NO_AUTH=1 for local testing only).");
  process.exit(1);
}

/* ---------- storage ---------- */
fs.mkdirSync(BACKUP_DIR, { recursive: true });
function emptyDb() { const d = { rev: 1 }; COLLECTIONS.forEach(c => (d[c] = {})); return d; }
function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const d = fs.existsSync(SEED_FILE) ? JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) : emptyDb();
  COLLECTIONS.forEach(c => (d[c] = d[c] || {}));
  d.rev = d.rev || 1;
  persist(d);
  console.log(fs.existsSync(SEED_FILE) ? "Created data/db.json from seed.json" : "Created empty data/db.json");
  return d;
}
function persist(d) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(d));
  fs.renameSync(tmp, DB_FILE);
  const day = new Date().toISOString().slice(0, 10);
  const bk = path.join(BACKUP_DIR, `db-${day}.json`);
  if (!fs.existsSync(bk)) {
    fs.copyFileSync(DB_FILE, bk);
    const old = fs.readdirSync(BACKUP_DIR).filter(f => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    old.slice(0, Math.max(0, old.length - KEEP_BACKUPS)).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  }
}
let db = loadDb();

/* ---------- live updates (Server-Sent Events) ---------- */
const clients = new Set();
function broadcast() {
  const msg = `event: change\ndata: ${db.rev}\n\n`;
  for (const res of clients) { try { res.write(msg); } catch (e) { clients.delete(res); } }
}
setInterval(() => { for (const res of clients) { try { res.write(": ping\n\n"); } catch (e) { clients.delete(res); } } }, 25000);

/* ---------- helpers ---------- */
// Returns "editor", "viewer" or null
function same(x, y) {
  const a = crypto.createHash("sha256").update(x).digest();
  const b = crypto.createHash("sha256").update(y).digest();
  return crypto.timingSafeEqual(a, b);
}
function roleOf(req) {
  if (!TEAM_PASSWORD) return "editor";
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return null;
  const [u, ...rest] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
  const cred = `${u}:${rest.join(":")}`;
  if (same(cred, `${TEAM_USER}:${TEAM_PASSWORD}`)) return "editor";
  if (VIEW_PASSWORD && same(cred, `${VIEW_USER}:${VIEW_PASSWORD}`)) return "viewer";
  return null;
}
const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "same-origin",
};
function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...SEC, ...extra });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > 65536) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Error("bad_json")); } });
    req.on("error", reject);
  });
}
function clean(rec) {
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) throw new Error("bad_record");
  const out = {};
  for (const [k, v] of Object.entries(rec)) {
    if (k === "id" || k.startsWith("_")) continue;
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(k)) continue;
    out[k] = v;
  }
  out.updatedAt = new Date().toISOString();
  return out;
}
const validId = id => /^[A-Za-z0-9_.:-]{1,80}$/.test(id);
function commit() { db.rev++; persist(db); broadcast(); }

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (p === "/healthz") return send(res, 200, { ok: true });
  const role = roleOf(req);
  if (!role) {
    return send(res, 401, "Sign in with the team username and password.", "text/plain; charset=utf-8",
      { "WWW-Authenticate": 'Basic realm="EMT Resource Board", charset="UTF-8"' });
  }

  try {
    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return send(res, 200, fs.readFileSync(INDEX_FILE), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && p === "/api/me") return send(res, 200, { role });
    if (req.method === "GET" && p === "/api/state") return send(res, 200, db);
    if (req.method !== "GET" && role !== "editor") return send(res, 403, { error: "view_only" });
    if (req.method === "GET" && p === "/api/export") {
      if (role !== "editor") return send(res, 403, { error: "view_only" });
      const day = new Date().toISOString().slice(0, 10);
      return send(res, 200, JSON.stringify(db, null, 1), "application/json; charset=utf-8",
        { "Content-Disposition": `attachment; filename="emt-resource-board-${day}.json"` });
    }
    if (req.method === "GET" && p === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no", ...SEC });
      res.write(`event: change\ndata: ${db.rev}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    const m = p.match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
    if (m && COLLECTIONS.includes(m[1])) {
      const col = m[1]; const id = m[2] ? decodeURIComponent(m[2]) : null;
      if (req.method === "POST" && !id) {
        const nid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        db[col][nid] = clean(await readBody(req)); commit();
        return send(res, 201, { id: nid });
      }
      if (req.method === "PUT" && id) {
        if (!validId(id)) return send(res, 400, { error: "bad_id" });
        db[col][id] = clean(await readBody(req)); commit();
        return send(res, 200, { id });
      }
      if (req.method === "DELETE" && id) {
        if (db[col][id]) { delete db[col][id]; commit(); }
        return send(res, 200, { id });
      }
    }
    return send(res, 404, { error: "not_found" });
  } catch (e) {
    const code = e.message === "too_large" ? 413 : (e.message === "bad_json" || e.message === "bad_record") ? 400 : 500;
    if (code === 500) console.error(e);
    return send(res, code, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`EMT Resource Board running on http://${HOST}:${PORT}  (data: ${DB_FILE})`);
  if (!TEAM_PASSWORD) console.warn("WARNING: running WITHOUT a password. Do not expose this to the internet.");
});
