"use strict";
const fs = require("fs");
const path = require("path");
const { sql, COLLECTIONS } = require("../lib/db");

async function main() {
  const seedPath = path.join(__dirname, "..", "data", "seed.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  for (const col of COLLECTIONS) {
    const entries = Object.entries(seed[col] || {});
    if (!entries.length) continue;
    let n = 0;
    for (const [id, data] of entries) {
      const json = JSON.stringify(data);
      if (col === "people") await sql()`INSERT INTO people (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
      else if (col === "projects") await sql()`INSERT INTO projects (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
      else if (col === "bookings") await sql()`INSERT INTO bookings (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
      else await sql()`INSERT INTO holidays (id, data, updated) VALUES (${id}, ${json}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated = now()`;
      n++;
    }
    console.log(`${col}: ${n} rows upserted`);
  }
  console.log("Seed complete.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });