import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parseCSV } from "../js/csv.js";

const endpoint = process.argv[2] || process.env.INVENTORY_API_URL;
if (!endpoint || !endpoint.startsWith("https://script.google.com/macros/s/")) {
  throw new Error("A valid Apps Script INVENTORY_API_URL is required.");
}

const response = await fetch(endpoint, { redirect: "follow" });
if (!response.ok) throw new Error(`Inventory endpoint returned ${response.status}.`);
const payload = await response.json();
if (payload.error) throw new Error(payload.error);
if (payload.schemaVersion !== 1 || !Array.isArray(payload.wine) || !Array.isArray(payload.whiskey)) {
  throw new Error("Inventory endpoint returned an unsupported payload.");
}

const clean = (value) => String(value ?? "").trim();
const key = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const csvCell = (value) => {
  const text = clean(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) => [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]
  .map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

const wineHeaders = ["name","type","varietal","world","country","region_1","region_2","bin","vintage","glass_price","bottle_price","collection","staff_pick","stock","show","description"];
for (const row of payload.wine) {
  if (!clean(row.name) || !clean(row.bottle_price)) throw new Error(`Wine row is missing a name or bottle price: ${clean(row.name) || "unnamed"}`);
}

const existingWhiskey = parseCSV(await fs.readFile("data/whiskey.csv", "utf8")).records;
const byComposite = new Map(existingWhiskey.map((row) => [`${key(row.name)}|${key(row.category)}`, row]));
const usedIds = new Set();
const whiskey = payload.whiskey.map((row) => {
  const prior = byComposite.get(`${key(row.name)}|${key(row.category)}`);
  if (!prior || usedIds.has(prior.source_id)) throw new Error(`Whiskey cannot be matched to a stable public ID: ${clean(row.name)}`);
  if (!clean(row.price)) throw new Error(`Whiskey is missing a standard price: ${clean(row.name)}`);
  usedIds.add(prior.source_id);
  return { source_id: prior.source_id, category: row.category, name: row.name, price: row.price };
}).sort((a, b) => Number(a.source_id) - Number(b.source_id));

await fs.writeFile("data/wines.csv", toCsv(wineHeaders, payload.wine), "utf8");
await fs.writeFile("data/whiskey.csv", toCsv(["source_id","category","name","price"], whiskey), "utf8");
console.log(`Pulled ${payload.wine.length} wines and ${whiskey.length} whiskeys from Google Sheets.`);
