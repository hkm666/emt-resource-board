"use strict";
const { roleOf } = require("../lib/auth");
const { json, unauthorized, readBody, clean, validId } = require("../lib/http");
const { COLLECTIONS, insertRow, updateRow, deleteRow } = require("../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized();

  const url = new URL(req.url, "http://x");
  const m = url.pathname.match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
  if (!m || !COLLECTIONS.includes(m[1])) return json({ error: "not_found" }, 404);

  const col = m[1];
  const id = m[2] ? decodeURIComponent(m[2]) : null;

  if (req.method === "POST" && !id) {
    if (role !== "editor") return json({ error: "view_only" }, 403);
    try {
      const data = clean(await readBody(req));
      const newId = await insertRow(col, data);
      return json({ id: newId }, 201);
    } catch (e) {
      return json({ error: e.message }, e.message === "bad_json" || e.message === "bad_record" ? 400 : 500);
    }
  }

  if (req.method === "PUT" && id) {
    if (role !== "editor") return json({ error: "view_only" }, 403);
    if (!validId(id)) return json({ error: "bad_id" }, 400);
    try {
      const data = clean(await readBody(req));
      const ok = await updateRow(col, id, data);
      return json({ id }, ok ? 200 : 404);
    } catch (e) {
      return json({ error: e.message }, e.message === "bad_json" || e.message === "bad_record" ? 400 : 500);
    }
  }

  if (req.method === "DELETE" && id) {
    if (role !== "editor") return json({ error: "view_only" }, 403);
    if (!validId(id)) return json({ error: "bad_id" }, 400);
    try {
      const ok = await deleteRow(col, id);
      return json({ id }, ok ? 200 : 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: "method_not_allowed" }, 405);
};