"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized, readBody, validId } = require("../../lib/http");
const { updateJobStatus } = require("../../lib/db");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  const jobNo = req.query.jobNo;
  if (!jobNo || !validId(jobNo)) return json(res, { error: "bad job number" }, 400);
  if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
  try {
    const body = await readBody(req);
    const updated = await updateJobStatus(jobNo, body.status, body.reportRef, role);
    return json(res, { ok: true }, 200);
  } catch (e) {
    const code = e.message === "no such job" ? 404 : e.message === "unknown status" || e.message === "report reference required" ? 400 : 500;
    return json(res, { error: e.message }, code);
  }
};