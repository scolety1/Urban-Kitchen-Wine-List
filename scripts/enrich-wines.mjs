#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCSV } from "../js/csv.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const inputPath = path.join(root, "data", "wines.csv");
const csvOutputPath = path.join(root, "data", "wines.cleaned.csv");
const jsonOutputPath = path.join(root, "data", "wines.json");

const REQUIRED = [
  "name",
  "type",
  "varietal",
  "world",
  "country",
  "region_1",
  "region_2",
  "bin",
  "vintage",
  "glass_price",
  "bottle_price",
  "staff_pick",
  "show",
];

const OUTPUT_FIELDS = [
  "id",
  "name",
  "producer",
  "type",
  "category",
  "varietal",
  "world",
  "country",
  "region_1",
  "region_2",
  "region",
  "bin",
  "vintage",
  "glass_price",
  "bottle_price",
  "style",
  "body",
  "acidity",
  "sweetness",
  "oak",
  "pairing_tags",
  "description_original",
  "description_ai",
  "description_final",
  "description",
  "collection",
  "staff_pick",
  "stock",
  "show",
  "available",
];

function norm(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return norm(value).toLowerCase();
}

function isYes(value) {
  return ["yes", "y", "true", "1"].includes(lower(value));
}

function isNo(value) {
  return ["no", "n", "false", "0"].includes(lower(value));
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] != null && norm(row[key]) !== "") return norm(row[key]);
  }
  return "";
}

function normalizeType(value) {
  const v = lower(value).replace("rosé", "rose").replace("ros\u00e9", "rose");
  if (v.includes("sparkling") || v.includes("champagne")) return "sparkling";
  if (v.includes("white")) return "white";
  if (v.includes("rose")) return "rose";
  if (v.includes("dessert")) return "dessert";
  return "red";
}

function inferBody(row) {
  const text = searchable(row);
  if (/(full|bold|rich|powerful|structured|dense|concentrated|cabernet|syrah|shiraz|malbec|nebbiolo|zinfandel|mourv[eè]dre)/i.test(text)) return "bold";
  if (/(light|fresh|delicate|crisp|bright|pinot noir|gamay|barbera|riesling|sauvignon|gruner|grüner|albari[nñ]o|picpoul|txakolina|hondarrabi)/i.test(text)) return "light";
  return "medium";
}

function inferStyle(row) {
  const text = searchable(row);
  if (/(crisp|bright|fresh|citrus|lemon|lime|mineral|acid|saline|zesty|racy)/i.test(text)) return "crisp";
  if (/(smooth|soft|round|polished|velvety|supple|silky|plush)/i.test(text)) return "smooth";
  if (/(rich|creamy|butter|brioche|toast|toasted|full|opulent|weight|texture)/i.test(text)) return "rich";
  if (/(fruit|fruity|berry|cherry|raspberry|strawberry|apple|pear|peach|stone fruit|plum)/i.test(text)) return "fruity";
  return "dry";
}

function inferAcidity(row) {
  const text = searchable(row);
  if (/(crisp|bright|fresh|acid|citrus|mineral|riesling|sauvignon|sparkling)/i.test(text)) return "high";
  if (/(soft|round|rich|creamy)/i.test(text)) return "medium";
  return "medium";
}

function inferSweetness(row) {
  const text = searchable(row);
  if (/(sweet|dessert|late harvest|port|sauternes)/i.test(text)) return "sweet";
  return "dry";
}

function inferOak(row) {
  const text = searchable(row);
  if (/(oak|vanilla|toast|toasted|brioche|butter|cedar)/i.test(text)) return "some";
  return "unknown";
}

function inferPairings(row) {
  const type = normalizeType(row.type);
  const text = searchable(row);
  const tags = new Set();

  if (/(cabernet|syrah|shiraz|malbec|zinfandel|bold|structured|tannin|dark fruit|cedar)/i.test(text)) tags.add("steak");
  if (/(chardonnay|sauvignon|riesling|gruner|grüner|albari[nñ]o|picpoul|seafood|shellfish|citrus|mineral|saline|sparkling)/i.test(text)) tags.add("seafood");
  if (/(pinot|grenache|garnacha|sangiovese|nebbiolo|barbera|chianti|burgundy|rh[oô]ne|tomato|savory|earth)/i.test(text)) tags.add("pasta");
  if (/(sauvignon|riesling|gruner|grüner|albari[nñ]o|picpoul|crisp|bright|sparkling|rose|rosé|fresh|saline)/i.test(text)) tags.add("salad");
  if (/(champagne|sparkling|prosecco|brut|crisp|fresh|easy|aperitif|lighter|delicate)/i.test(text)) tags.add("sipping");

  if (type === "red" && !tags.size) tags.add("steak");
  if ((type === "white" || type === "sparkling" || type === "rose") && !tags.size) tags.add("seafood");

  if (!tags.size) tags.add("sipping");
  return Array.from(tags).join("|");
}

function searchable(row) {
  return [
    row.name,
    row.type,
    row.varietal,
    row.country,
    row.region_1,
    row.region_2,
    row.description,
    row.description_original,
    row.description_ai,
    row.description_final,
  ].join(" ");
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function toCSV(rows) {
  return [
    OUTPUT_FIELDS.join(","),
    ...rows.map((row) => OUTPUT_FIELDS.map((field) => csvEscape(row[field])).join(",")),
  ].join("\n");
}

function validateHeaders(headers) {
  const present = new Set(headers.map(lower).filter(Boolean));
  return REQUIRED.filter((field) => !present.has(field));
}

function normalizeRow(raw, index, warnings) {
  const row = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key) continue;
    row[lower(key)] = norm(value);
  }

  const type = normalizeType(row.type);
  const region = [row.region_2, row.region_1, row.country].map(norm).filter(Boolean).join(", ");
  const descriptionOriginal = pick(row, ["description_original", "description"]);
  const descriptionAi = pick(row, ["description_ai", "ai_description", "updated_description"]);
  const descriptionFinal = pick(row, ["description_final", "final_description", "approved_description"]);
  const description = descriptionFinal || descriptionAi || descriptionOriginal;
  const available = row.available ? !isNo(row.available) : !isNo(row.show);

  const normalized = {
    id: `${index}-${norm(row.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${norm(row.bin)}`,
    name: row.name,
    producer: pick(row, ["producer"]) || row.name,
    type,
    category: row.category || type,
    varietal: row.varietal,
    world: row.world,
    country: row.country,
    region_1: row.region_1,
    region_2: row.region_2,
    region,
    bin: row.bin,
    vintage: row.vintage,
    glass_price: pick(row, ["glass_price", "price_glass"]),
    bottle_price: pick(row, ["bottle_price", "price_bottle"]),
    style: row.style,
    body: row.body,
    acidity: row.acidity,
    sweetness: row.sweetness,
    oak: row.oak,
    pairing_tags: row.pairing_tags,
    description_original: descriptionOriginal,
    description_ai: descriptionAi,
    description_final: descriptionFinal,
    description,
    collection: row.collection,
    staff_pick: isYes(row.staff_pick) ? "Y" : "N",
    stock: row.stock,
    show: isNo(row.show) ? "N" : "Y",
    available: available ? "Y" : "N",
  };

  normalized.style ||= inferStyle(normalized);
  normalized.body ||= inferBody(normalized);
  normalized.acidity ||= inferAcidity(normalized);
  normalized.sweetness ||= inferSweetness(normalized);
  normalized.oak ||= inferOak(normalized);
  normalized.pairing_tags ||= inferPairings(normalized);

  if (!normalized.name) warnings.push(`Row ${index + 2}: missing wine name.`);
  if (!normalized.bottle_price && !normalized.glass_price) warnings.push(`Row ${index + 2}: missing glass and bottle price for "${normalized.name || "unknown"}".`);
  if (!normalized.description) warnings.push(`Row ${index + 2}: missing all description fields for "${normalized.name || "unknown"}".`);

  return normalized;
}

function main() {
  const source = fs.readFileSync(inputPath, "utf8");
  const { headers, records } = parseCSV(source);
  const missing = validateHeaders(headers);
  const warnings = [];

  if (missing.length) {
    console.error(`Missing required columns: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const rows = records.map((row, index) => normalizeRow(row, index, warnings));
  const visibleRows = rows.filter((row) => row.show !== "N" && row.available !== "N");

  fs.writeFileSync(csvOutputPath, `${toCSV(rows)}\n`, "utf8");
  fs.writeFileSync(jsonOutputPath, `${JSON.stringify(visibleRows, null, 2)}\n`, "utf8");

  console.log(`Read ${records.length} wine rows.`);
  console.log(`Wrote ${path.relative(root, csvOutputPath)} (${rows.length} rows).`);
  console.log(`Wrote ${path.relative(root, jsonOutputPath)} (${visibleRows.length} frontend rows).`);

  if (warnings.length) {
    console.warn(`Validation warnings (${warnings.length}):`);
    for (const warning of warnings) console.warn(`- ${warning}`);
  } else {
    console.log("Validation warnings: none.");
  }
}

main();
