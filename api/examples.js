"use strict";
const { roleOf } = require("../lib/auth");
const { json, unauthorized } = require("../lib/http");
const { deleteExamples } = require("../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized();
  if (role !== "editor") return json({ error: "view_only" }, 403);
  if (req.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  try {
    const counts = await deleteExamples();
    return json({ removed: counts });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};