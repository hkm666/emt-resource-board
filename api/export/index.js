"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized } = require("../../lib/http");
const { loadState } = require("../../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  if (role !== "editor") return json(res, { error: "view_only" }, 403);
  try {
    const state = await loadState();
    const day = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify(state, null, 1);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="emt-resource-board-${day}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    });
    res.end(body);
  } catch (e) {
    return json(res, { error: e.message }, 500);
  }
};