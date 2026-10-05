"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized } = require("../../lib/http");
const { loadState } = require("../../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  try {
    const state = await loadState();
    return json(res, state);
  } catch (e) {
    return json(res, { error: e.message }, 500);
  }
};