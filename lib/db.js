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
  let res;
  if (col === "people") res = await sql()`UPDATE people SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  else if (col === "projects") res = await sql()`UPDATE projects SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  else if (col === "bookings") res = await sql()`UPDATE bookings SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  else res = await sql()`UPDATE holidays SET data = ${json}::jsonb, updated = now() WHERE id = ${id}`;
  return res.count > 0;
}

async function deleteRow(col, id) {
  checkCol(col);
  let res;
  if (col === "people") res = await sql()`DELETE FROM people WHERE id = ${id}`;
  else if (col === "projects") res = await sql()`DELETE FROM projects WHERE id = ${id}`;
  else if (col === "bookings") res = await sql()`DELETE FROM bookings WHERE id = ${id}`;
  else res = await sql()`DELETE FROM holidays WHERE id = ${id}`;
  return res.count > 0;
}

async function deleteExamples() {
  const counts = {};
  let r1 = await sql()`DELETE FROM people WHERE data->>'example' = 'true'`; counts.people = r1.count;
  let r2 = await sql()`DELETE FROM projects WHERE data->>'example' = 'true'`; counts.projects = r2.count;
  let r3 = await sql()`DELETE FROM bookings WHERE data->>'example' = 'true'`; counts.bookings = r3.count;
  return counts;
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
  sql,
};