"use strict";
const fs = require("fs");
const path = require("path");

let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) {}

const MODE = (process.env.MAIL_MODE || (process.env.SMTP_HOST ? "smtp" : "off")).toLowerCase();
const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "EMT Resource Board <no-reply@localhost>";
const BOARD_URL = (process.env.BOARD_URL || "").replace(/\/+$/, "");
const NOTIFY_PM = process.env.NOTIFY_PM !== "0";

let transport = null;
let status = "off";
if (MODE !== "off") {
  if (!nodemailer) {
    status = "missing nodemailer";
  } else if (MODE === "file") {
    transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    status = "file";
  } else {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "1" || Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
    });
    status = "smtp";
  }
}

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const toD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmt = s => { const d = toD(s); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const WORK = { site: "On site", office: "Office", production: "Workshop / Production", remote: "Remote / Travel" };
const TRIP = [["meet", "Meeting point & time"], ["transport", "Transport"], ["contact", "Site contact"], ["access", "Access & PPE"], ["bring", "What to bring"], ["scope", "Scope / tasks"], ["forms", "Forms & documents"]];
const tripOf = j => { const o = {}; if (j) TRIP.forEach(([k]) => { if (j[k]) o[k] = j[k]; }); return o; };
const notifiable = b => b && b.kind !== "leave" && !b.example;
const nameTel = u => `${u.short || u.name}${u.phone ? " (" + u.phone + ")" : ""}`;
const relevant = b => b ? [b.personId, b.projectId, b.start, b.end, b.work, b.location, b.alloc, b.jobNo, b.weekends, b.note].join("|") : "";

function workingDays(b, db) {
  let n = 0;
  for (let d = b.start; d <= b.end; d = addDays(d, 1)) {
    const w = toD(d).getUTCDay();
    if (b.weekends || (w !== 0 && w !== 6 && !db.holidays[d])) n++;
  }
  return n;
}

function holidaysIn(b, db) {
  const out = [];
  for (let d = b.start; d <= b.end; d = addDays(d, 1)) if (db.holidays[d]) out.push(`${fmt(d)}: ${db.holidays[d].name}`);
  return out;
}

function mates(b, db) {
  const ids = new Set();
  for (const x of Object.values(db.bookings)) if (x !== b && x.kind !== "leave" && x.jobNo && x.jobNo === b.jobNo && x.personId !== b.personId && x.end >= b.start && x.start <= b.end) ids.add(x.personId);
  return [...ids].map(id => db.people[id]).filter(Boolean);
}

function jobJson(b, db) {
  return b && b.jobNo ? JSON.stringify({ trip: tripOf(db.jobs[b.jobNo]), mates: mates(b, db).map(u => u.name).sort() }) : "{}";
}

function fold(l) {
  const buf = Buffer.from(l, "utf8"); if (buf.length <= 75) return l;
  const out = []; let cur = "";
  for (const ch of l) { if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ""; } cur += ch; }
  out.push(cur); return out.join("\r\n ");
}

function icsFor(id, b, method, person) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const fromAddr = (FROM.match(/<([^>]+)>/) || [null, FROM])[1];
  const line = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "PRODID:-//EMT//Resource Board//EN", "VERSION:2.0", `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:booking-${id}@emt-resource-board`,
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${b.start.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${addDays(b.end, 1).replace(/-/g, "")}`,
    `SUMMARY:${line(`${b.jobNo || "Project"}${b.location ? " · " + b.location : ""}`)}`,
    `DESCRIPTION:${line(`${WORK[b.work] || ""} · ${b.alloc || 100}%${b.note ? "\n" + b.note : ""}`)}`,
    b.location ? `LOCATION:${line(b.location)}` : null,
    `ORGANIZER;CN=EMT Resource Board:mailto:${fromAddr}`,
    person && person.email ? `ATTENDEE;CN=${line(person.name || "")};RSVP=FALSE:mailto:${person.email}` : null,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).map(fold).join("\r\n") + "\r\n";
}

function compose(kind, id, b, before, beforeJob, db) {
  const pr = db.projects[b.projectId] || {};
  const person = db.people[b.personId] || {};
  const pm = db.people[pr.pmId];
  const first = (person.short || person.name || "").split(" ")[0] || "there";
  const title = { new: "You have been booked", update: "Your booking has changed", cancel: "Your booking has been cancelled" }[kind];
  const subject = `[EMT] ${title}: ${b.jobNo || pr.code || "Project"}, ${fmt(b.start)}${b.end !== b.start ? " to " + fmt(b.end) : ""}`;
  const hol = holidaysIn(b, db);
  const rows = [
    ["Project", `${pr.code || ""} · ${pr.name || ""}`],
    ["Job number", b.jobNo || "Not assigned yet"],
    ["Dates", `${fmt(b.start)}${b.end !== b.start ? " to " + fmt(b.end) : ""}`],
    ["Working days", `${workingDays(b, db)}${b.weekends ? " (includes weekends / public holidays)" : ""}`],
    ["Where", `${WORK[b.work] || ""}${b.location ? " · " + b.location : ""}`],
    ["Allocation", `${b.alloc || 100}%`],
    ["Project Manager", pm ? nameTel(pm) : "Not assigned"],
  ];
  if (kind !== "cancel") { const m = mates(b, db); rows.push(["Going with", m.length ? m.map(nameTel).join(", ") : "Nobody else on this job"]); }
  const trip = kind === "cancel" ? {} : tripOf(db.jobs[b.jobNo]);
  TRIP.forEach(([k, label]) => { if (trip[k]) rows.push([label, trip[k]]); });
  if (b.note) rows.push(["Note", b.note]);
  if (hol.length) rows.push(["Public holidays in this period", hol.join("; ")]);
  const changed = [];
  if (kind === "update" && before) {
    if (before.start !== b.start || before.end !== b.end) changed.push(`Dates were ${fmt(before.start)} to ${fmt(before.end)}`);
    if ((before.location || "") !== (b.location || "")) changed.push(`Location was ${before.location || "not set"}`);
    if (before.projectId !== b.projectId) changed.push(`Project was ${(db.projects[before.projectId] || {}).code || "?"}`);
    if ((before.jobNo || "") !== (b.jobNo || "")) changed.push(`Job number was ${before.jobNo || "not set"}`);
    if (before.work !== b.work) changed.push(`Work type was ${WORK[before.work] || before.work}`);
    if (Number(before.alloc || 100) !== Number(b.alloc || 100)) changed.push(`Allocation was ${before.alloc || 100}%`);
    if (beforeJob !== undefined && beforeJob !== jobJson(b, db)) changed.push("Team or trip details were updated (see above)");
  }
  const intro = kind === "cancel"
    ? `The booking below has been cancelled. Please do not plan for it.`
    : kind === "update" ? `One of your bookings has been changed. The latest details are below.`
    : `You have been booked for the work below. A calendar invite is attached.`;
  const text = [`Hi ${first},`, "", intro, "", ...rows.map(r => `${r[0]}: ${r[1]}`),
    ...(changed.length ? ["", "What changed:", ...changed.map(c => "- " + c)] : []),
    "", "If something is wrong, contact your Project Manager or the Operations Manager.",
    ...(BOARD_URL ? ["", `Open the board: ${BOARD_URL}`] : []), "", "EMT Operations Resource Board"].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#F2F4F1;font-family:Segoe UI,Arial,sans-serif;color:#16241C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F1;padding:20px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid #D8DFD9">
<tr><td style="background:#1C3C2D;color:#FFFFFF;padding:16px 22px;border-bottom:3px solid #C8A84B;font-size:13px;letter-spacing:1px;text-transform:uppercase">EMT · Operations Resource Board</td></tr>
<tr><td style="padding:22px">
<h1 style="margin:0 0 6px;font-size:20px;color:${kind === "cancel" ? "#B3261E" : "#1C3C2D"}">${esc(title)}</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5">Hi ${esc(first)},<br>${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
${rows.map(r => `<tr><td style="padding:7px 10px 7px 0;color:#5A6A60;width:38%;vertical-align:top;border-top:1px solid #E8ECE8">${esc(r[0])}</td><td style="padding:7px 0;font-weight:600;border-top:1px solid #E8ECE8;white-space:pre-wrap">${esc(r[1])}</td></tr>`).join("")}
</table>
${changed.length ? `<p style="margin:16px 0 4px;font-size:13px;font-weight:600">What changed</p><ul style="margin:0;padding-left:18px;font-size:13px;color:#5A6A60">${changed.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
<p style="margin:18px 0 0;font-size:13px;color:#5A6A60">If something is wrong, contact your Project Manager or the Operations Manager.</p>
${BOARD_URL ? `<p style="margin:16px 0 0"><a href="${esc(BOARD_URL)}" style="display:inline-block;background:#1C3C2D;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:600">Open the board</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  const cc = NOTIFY_PM && pm && pm.email && pm.email !== person.email ? pm.email : undefined;
  return {
    from: FROM, to: person.email, cc, subject, text, html,
    icalEvent: { method: kind === "cancel" ? "CANCEL" : "REQUEST", filename: "booking.ics", content: icsFor(id, b, kind === "cancel" ? "CANCEL" : "REQUEST", person) },
  };
}

async function deliver(kind, id, b, before, beforeJob, db) {
  const person = db.people[b.personId] || {};
  if (!person.email) return;
  if (!transport) return;
  const msg = compose(kind, id, b, before, beforeJob, db);
  try {
    await transport.sendMail(msg);
  } catch (e) {
    console.error("E-mail failed:", e.message);
  }
}

function preview(b, db) {
  if (!notifiable(b)) return null;
  const person = db.people[b.personId] || {};
  if (!transport) return { sent: false, reason: "E-mail notifications are off" };
  if (!person.email) return { sent: false, reason: `No e-mail on file for ${person.short || person.name || "this person"}` };
  return { sent: true, to: person.short || person.name };
}

async function sendTest(to) {
  if (!transport) throw new Error(status === "off" ? "E-mail notifications are off. Set SMTP settings first." : status);
  await transport.sendMail({ from: FROM, to, subject: "[EMT] Resource Board test e-mail", text: "This is a test from the EMT Operations Resource Board. E-mail notifications are working.", html: "<p>This is a test from the <b>EMT Operations Resource Board</b>. E-mail notifications are working.</p>" });
}

async function notifyBookingChanged(id, before, db) {
  if (!transport) return;
  const after = db.bookings[id] || null;
  const was = notifiable(before), now = notifiable(after);
  if (was && !now) return deliver("cancel", id, before, null, null, db);
  if (!was && now) return deliver("new", id, after, null, null, db);
  if (!was && !now) return;
  if (before.personId !== after.personId) { await deliver("cancel", id, before, null, null, db); return deliver("new", id, after, null, null, db); }
  if (relevant(before) !== relevant(after)) return deliver("update", id, after, before, null, db);
}

module.exports = { status: () => status, preview, sendTest, notifyBookingChanged, tripOf };