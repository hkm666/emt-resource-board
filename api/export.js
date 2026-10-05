"use strict";
const { roleOf } = require("../lib/auth");
const { json, unauthorized, text } = require("../lib/http");
const { loadState } = require("../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized();
  if (role !== "editor") return json({ error: "view_only" }, 403);
  try {
    const state = await loadState();
    const day = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify(state, null, 1);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="emt-resource-board-${day}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "same-origin",
      },
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};