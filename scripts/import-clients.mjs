// One-off: loads the cleaned BrandSource customer list (names exactly as in
// Xero) into the clients table as managed clients with no account manager or
// contact email. Existing names (case-insensitive) are skipped, so it is safe
// to re-run. Run supabase/clients-xero-terms.sql first.
//
// Usage: node --env-file=.env.local scripts/import-clients.mjs <csv> [--dry-run]
// The CSV has a single "name" column header.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const file = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
if (!file) throw new Error("Pass the path to the cleaned CSV.");

function parseNames(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.slice(1).map((l) => {
    const m = l.match(/^"((?:[^"]|"")*)"/);
    return (m ? m[1].replace(/""/g, '"') : l).trim();
  });
}

const names = [...new Set(parseNames(readFileSync(file, "utf8")))].filter(Boolean);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: existing, error } = await db.from("clients").select("name");
if (error) throw new Error(error.message);
const have = new Set(existing.map((c) => c.name.toLowerCase()));

const toAdd = names.filter((n) => !have.has(n.toLowerCase()));
console.log(`${names.length} in file, ${names.length - toAdd.length} already present, ${toAdd.length} to add.`);

if (DRY) {
  console.log(toAdd.slice(0, 10).join("\n"), toAdd.length > 10 ? "\n..." : "");
  console.log("Dry run: nothing written.");
} else {
  for (let i = 0; i < toAdd.length; i += 100) {
    const batch = toAdd.slice(i, i + 100).map((name) => ({ name, client_type: "managed" }));
    const { error: insertError } = await db.from("clients").insert(batch);
    if (insertError) throw new Error(insertError.message);
  }
  console.log(`Added ${toAdd.length} clients.`);
}
