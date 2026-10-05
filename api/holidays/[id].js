"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized, readBody, clean, validId } = require("../../lib/http");
const { updateRow, deleteRow } = require("../../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  const id = req.query.id;
  if (!id || !validId(id)) return json(res, { error: "bad_id" }, 400);
  if (role !== "editor") return json(res, { error: "view_only" }, 403);

  if (req.method === "PUT") {
    try {
      const data = clean(await readBody(req));
      const ok = await updateRow("holidays", id, data);
      return json(res, { id }, ok ? 200 : 404);
    } catch (e) {
      return json(res, { error: e.message }, e.message === "bad_json" || e.message === "bad_record" ? 400 : 500);
    }
  }
  if (req.method === "DELETE") {
    try {
      const ok = await deleteRow("holidays", id);
      return json(res, { id }, ok ? 200 : 404);
    } catch (e) {
      return json(res, { error: e.message }, 500);
    }
  }
  return json(res, { error: "method_not_allowed" }, 405);
};