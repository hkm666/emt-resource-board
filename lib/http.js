"use strict";

const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "same-origin",
};

function json(res, body, status = 200, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...extra });
  res.end(JSON.stringify(body));
}

function text(res, body, status = 200, extra = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...extra });
  res.end(body);
}

function unauthorized(res) {
  return text(res, "Sign in with the team username and password.", 401, {
    "WWW-Authenticate": 'Basic realm="EMT Resource Board", charset="UTF-8"',
  });
}

async function readBody(req) {
  try {
    const t = await new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", c => {
        size += c.length;
        if (size > 65536) { reject(new Error("too_large")); req.destroy(); }
        else chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
    if (!t) return {};
    return JSON.parse(t);
  } catch (e) {
    if (e.message === "too_large") throw e;
    throw new Error("bad_json");
  }
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

module.exports = { json, text, unauthorized, readBody, clean, validId, SEC };