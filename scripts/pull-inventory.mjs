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
if (payload.schemaVersion !== 1 || !Array.isArray(payload.wine) || !Array.isArray(payload.whiskey) || !Array.isArray(payload.spirits)) {
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
const SPIRIT_FAMILIES = new Set(["Tequila & Mezcal", "Gin", "Vodka", "Rum", "Brandy & Cognac", "Other Spirits"]);
const optionalPrice = (value, label, name) => {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name}: ${label} must be zero or greater.`);
  return number;
};

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

const spirits = payload.spirits.map((row) => {
  if (!clean(row.name) || !SPIRIT_FAMILIES.has(clean(row.family)) || !clean(row.pour_size) || row.price === "" || row.price === null || row.price === undefined || !Number.isFinite(Number(row.price)) || Number(row.price) < 0) {
    throw new Error(`Spirit is missing a family, pour size, or price: ${clean(row.name) || "unnamed"}`);
  }
  const shotPrice = optionalPrice(row.shot_price, "Shot Price", clean(row.name));
  if (row.featured_shot === true && shotPrice === "") throw new Error(`${clean(row.name)}: Shot Price is required for a Shot Pick.`);
  return {
    id: clean(row.id) || `${key(row.family)}-${key(row.name)}`,
    name: clean(row.name),
    family: clean(row.family),
    style: clean(row.style),
    region: clean(row.region),
    pour_size: clean(row.pour_size),
    price: Number(row.price),
    double_price: optionalPrice(row.double_price, "Double Price", clean(row.name)),
    description: clean(row.description),
    featured_shot: row.featured_shot === true,
    shot_price: shotPrice,
    shot_note: clean(row.shot_note),
  };
});

await fs.writeFile("data/wines.csv", toCsv(wineHeaders, payload.wine), "utf8");
await fs.writeFile("data/whiskey.csv", toCsv(["source_id","category","name","price"], whiskey), "utf8");
await fs.writeFile("data/spirits.json", JSON.stringify(spirits, null, 2) + "\n", "utf8");
console.log(`Pulled ${payload.wine.length} wines, ${whiskey.length} whiskeys, and ${spirits.length} spirits from Google Sheets.`);
