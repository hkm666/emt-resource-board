"use strict";
const { roleOf } = require("../../lib/auth");
const { json, unauthorized, readBody, clean, validId } = require("../../lib/http");
const { updateRow, deleteRow, prepareBooking, loadState, getRow } = require("../../lib/db");
const { preview, notifyBookingChanged } = require("../../lib/mailer");

module.exports = async (req, res) => {
  const role = roleOf(req.headers);
  if (!role) return unauthorized(res);
  const id = req.query.id;
  if (!id || !validId(id)) return json(res, { error: "bad_id" }, 400);
  if (role !== "editor") return json(res, { error: "view_only" }, 403);

  if (req.method === "PUT") {
    try {
      const before = await getRow("bookings", id);
      let data = clean(await readBody(req));
      data = await prepareBooking(data);
      await updateRow("bookings", id, data);
      const state = await loadState();
      const np = preview(data, state);
      setImmediate(async () => {
        const s = await loadState();
        await notifyBookingChanged(id, before, s);
      });
      return json(res, { id, jobNo: data.jobNo, notify: np });
    } catch (e) {
      return json(res, { error: e.message }, e.message === "bad_json" || e.message === "bad_record" ? 400 : 500);
    }
  }
  if (req.method === "DELETE") {
    try {
      const before = await getRow("bookings", id);
      await deleteRow("bookings", id);
      if (before) {
        setImmediate(async () => {
          const s = await loadState();
          s.bookings[id] = null;
          await notifyBookingChanged(id, before, s);
        });
      }
      return json(res, { id });
    } catch (e) {
      return json(res, { error: e.message }, 500);
    }
  }
  return json(res, { error: "method_not_allowed" }, 405);
};