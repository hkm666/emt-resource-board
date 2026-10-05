"use strict";
const { neon } = require("@neondatabase/serverless");

let _sql = null;
function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

const COLLECTIONS = ["people", "projects", "bookings", "holidays"];
const VALID = new Set(COLLECTIONS);
function checkCol(col) {
  if (!VALID.has(col)) throw new Error("bad_collection");
  return col;
}

const TABLE_SQL = {
  people: () => sql()`SELECT id, data FROM people`,
  projects: () => sql()`SELECT id, data FROM projects`,
  bookings: () => sql()`SELECT id, data FROM bookings`,
  holidays: () => sql()`SELECT id, data FROM holidays`,
};

async function loadState() {
  const out = {};
  for (const col of COLLECTIONS) {
    const rows = await TABLE_SQL[col]();
    out[col] = {};
    for (const r of rows) out[col][r.id] = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }
  return out;
}

async function loadCollection(col) {
  checkCol(col);
  const rows = await TABLE_SQL[col]();
  const out = {};
  for (const r of rows) out[r.id] = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  return out;
}

async function insertRow(col, data) {
  checkCol(col);
  const id = require("crypto").randomUUID().replace(/-/g, "").slice(0, 16);
  const json = JSON.stringify(data);
  if (col === "people") await sql()`INSERT INTO people (id, data, updated) VALUES (${id}, ${json}::jsonb, now())`;
  else if (col === "projects") await sql()`INSERT INTO projects (id, data, updated) VALUES (${id}, ${json}::jsonb, now())`;
  else if (col === "bookings") await sql()`INSERT INTO bookings (id, data, updated) VALUES (${id}, ${json}::jsonb, now())`;
  else await sql()`INSERT INTO holidays (id, data, updated) VALUES (${id}, ${json}::jsonb, now())`;
  return id;
}

async function insertRowWithId(col, id, data) {
  checkCol(col);
  const json = JSON.stringify(data);
  if (col === "people") await sql()`INSERT INTO people (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
  else if (col === "projects") await sql()`INSERT INTO projects (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
  else if (col === "bookings") await sql()`INSERT INTO bookings (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
  else await sql()`INSERT INTO holidays (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
  return id;
}

async function updateRow(col, id, data) {
  checkCol(col);
  const json = JSON.stringify(data);
  if (col === "people") await sql()`UPDATE people SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  else if (col === "projects") await sql()`UPDATE projects SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  else if (col === "bookings") await sql()`UPDATE bookings SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  else await sql()`UPDATE holidays SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  return true;
}

async function deleteRow(col, id) {
  checkCol(col);
  if (col === "people") await sql()`DELETE FROM people WHERE id = ${id}`;
  else if (col === "projects") await sql()`DELETE FROM projects WHERE id = ${id}`;
  else if (col === "bookings") await sql()`DELETE FROM bookings WHERE id = ${id}`;
  else await sql()`DELETE FROM holidays WHERE id = ${id}`;
  return true;
}

async function deleteExamples() {
  await sql()`DELETE FROM people WHERE data->>'example' = 'true'`;
  await sql()`DELETE FROM projects WHERE data->>'example' = 'true'`;
  await sql()`DELETE FROM bookings WHERE data->>'example' = 'true'`;
  return true;
}

function escRe(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function allocJob(projectId) {
  const rows = await sql()`SELECT data FROM projects WHERE id = ${projectId}`;
  if (!rows.length) return "";
  const pr = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
  if (!pr.code) return "";
  const re = new RegExp("^" + escRe(pr.code) + "-(\\d+)$");
  let n = Number(pr.jobSeq || 0);
  const bkRows = await sql()`SELECT data FROM bookings WHERE data->>'projectId' = ${projectId}`;
  for (const r of bkRows) {
    const b = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    const m = re.exec(b.jobNo || "");
    if (m) n = Math.max(n, Number(m[1]));
  }
  n += 1;
  const jobNo = `${pr.code}-${String(n).padStart(3, "0")}`;
  pr.jobSeq = n;
  await sql()`UPDATE projects SET data = ${JSON.stringify(pr)}::jsonb, updated = now() WHERE id = ${projectId}`;
  return jobNo;
}

async function prepareBooking(data) {
  if (data.jobNo === "AUTO") {
    data.jobNo = await allocJob(data.projectId);
  }
  return data;
}

module.exports = {
  COLLECTIONS,
  loadState,
  loadCollection,
  insertRow,
  insertRowWithId,
  updateRow,
  deleteRow,
  deleteExamples,
  allocJob,
  prepareBooking,
  sql,
};