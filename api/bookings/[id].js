"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized, readBody, clean, validId } = require("../../lib/http");
const { updateRow, deleteRow } = require("../../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized();
  const id = req.query.id;
  if (!id || !validId(id)) return json({ error: "bad_id" }, 400);
  if (role !== "editor") return json({ error: "view_only" }, 403);

  if (req.method === "PUT") {
    try {
      const data = clean(await readBody(req));
      const ok = await updateRow("bookings", id, data);
      return json({ id }, ok ? 200 : 404);
    } catch (e) {
      return json({ error: e.message }, e.message === "bad_json" || e.message === "bad_record" ? 400 : 500);
    }
  }
  if (req.method === "DELETE") {
    try {
      const ok = await deleteRow("bookings", id);
      return json({ id }, ok ? 200 : 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
  return json({ error: "method_not_allowed" }, 405);
};