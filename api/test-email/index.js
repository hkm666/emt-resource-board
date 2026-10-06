"use strict";
const { roleOf } = require("../lib/auth");
const { json, unauthorized, readBody } = require("../lib/http");
const { sendTest } = require("../lib/mailer");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  if (role !== "editor") return json(res, { error: "view_only" }, 403);
  if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
  try {
    const { to } = await readBody(req);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to || ""))) return json(res, { error: "Enter a valid e-mail address" }, 400);
    await sendTest(String(to));
    return json(res, { ok: true });
  } catch (e) {
    return json(res, { error: e.message }, 502);
  }
};