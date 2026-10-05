// Auth helpers — preserved from the original server.js.
// HTTP Basic Auth with timing-safe comparison.
"use strict";
const crypto = require("crypto");

const TEAM_USER = process.env.TEAM_USER || "emt";
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "";
const VIEW_USER = process.env.VIEW_USER || "view";
const VIEW_PASSWORD = process.env.VIEW_PASSWORD || "";
const ALLOW_NO_AUTH = process.env.ALLOW_NO_AUTH === "1";

function same(x, y) {
  const a = crypto.createHash("sha256").update(x).digest();
  const b = crypto.createHash("sha256").update(y).digest();
  return crypto.timingSafeEqual(a, b);
}

// Returns "editor", "viewer" or null.
function roleOf(headers) {
  if (!TEAM_PASSWORD && !ALLOW_NO_AUTH) return null;
  if (ALLOW_NO_AUTH && !TEAM_PASSWORD) return "editor";
  const h = headers.authorization || "";
  if (!h.startsWith("Basic ")) return null;
  const [u, ...rest] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
  const cred = `${u}:${rest.join(":")}`;
  if (TEAM_PASSWORD && same(cred, `${TEAM_USER}:${TEAM_PASSWORD}`)) return "editor";
  if (VIEW_PASSWORD && same(cred, `${VIEW_USER}:${VIEW_PASSWORD}`)) return "viewer";
  return null;
}

function requiresAuth() {
  return !!TEAM_PASSWORD || !ALLOW_NO_AUTH;
}

module.exports = { roleOf, requiresAuth, TEAM_PASSWORD };