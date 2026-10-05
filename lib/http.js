// Small HTTP helpers for Vercel serverless functions.
"use strict";

const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "same-origin",
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...extra },
  });
}

function text(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...extra },
  });
}

function unauthorized() {
  return text("Sign in with the team username and password.", 401, {
    "WWW-Authenticate": 'Basic realm="EMT Resource Board", charset="UTF-8"',
  });
}

async function readBody(req) {
  try {
    const t = await req.text();
    if (!t) return {};
    return JSON.parse(t);
  } catch (e) {
    throw new Error("bad_json");
  }
}

// Sanitize a record: drop reserved keys, limit key names, stamp updatedAt.
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

module.exports = { json, text, unauthorized, readBody, clean, validId, SEC };