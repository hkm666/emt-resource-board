"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized } = require("../../lib/http");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  return json(res, { role });
};