"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized, readBody, clean } = require("../../lib/http");
const { insertRow } = require("../../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
  if (role !== "editor") return json(res, { error: "view_only" }, 403);
  try {
    const data = clean(await readBody(req));
    const id = await insertRow("jobs", data);
    return json(res, { id }, 201);
  } catch (e) {
    return json(res, { error: e.message }, e.message === "bad_json" || e.message === "bad_record" ? 400 : 500);
  }
};