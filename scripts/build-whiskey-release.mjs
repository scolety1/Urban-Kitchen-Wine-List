import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCSV } from "../js/csv.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = path.join(root, "_audit", "whiskey");
const sourcePath = path.join(auditPath, "whiskey-menu-transcription.csv");
const publishedPath = path.join(root, "data", "whiskey.csv");
const withheldPath = path.join(auditPath, "whiskey.withheld.csv");
const expectedHeldIds = [2, 3, 13, 20, 22, 39, 40, 56, 57, 59, 60, 61, 74, 75, 87, 90, 95, 97];
const heldIdSet = new Set(expectedHeldIds);
const supportedNameCorrections = new Map([[21, "Nikka Coffey Grain"]]);

function flagsFor(row) {
  return String(row.flags || "").split("+").filter(Boolean);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvCell(row[header])).join(","))
    .join("\n")}\n`;
}

const source = parseCSV(fs.readFileSync(sourcePath, "utf8")).records;
if (source.length !== 109) throw new Error(`Expected 109 source rows; found ${source.length}.`);

const held = source.filter((row) => heldIdSet.has(Number(row.id)));
const heldIds = held.map((row) => Number(row.id));
if (heldIds.join(",") !== expectedHeldIds.join(",")) {
  throw new Error(`Unexpected held ids: ${heldIds.join(", ")}`);
}

const published = source
  .filter((row) => !heldIdSet.has(Number(row.id)))
  .map((row) => {
    const sourceId = Number(row.id);
    const category = row.category || (flagsFor(row).includes("U") ? "Whiskey" : "");
    const name =
      supportedNameCorrections.get(sourceId) ||
      String(row.name || "").replaceAll("&amp;", "&").trim();
    const price = Number(row.price);
    if (!sourceId || !category || !name || !Number.isFinite(price) || price <= 0) {
      throw new Error(`Source row ${row.id} is not safe to publish.`);
    }
    return { source_id: sourceId, category, name, price };
  });

if (published.length !== 91) throw new Error(`Expected 91 publishable rows; found ${published.length}.`);
if (published.filter((row) => row.category === "Whiskey").length !== 18) {
  throw new Error("Expected 18 neutral Whiskey rows.");
}
if (published.some((row) => row.category === "Scotch")) {
  throw new Error("Scotch cannot be inferred from the source image.");
}

const withheld = held.map((row) => ({
  source_id: Number(row.id),
  source_category: row.category,
  source_name: String(row.name || "").replaceAll("&amp;", "&"),
  source_price: row.price,
  flags: row.flags,
  hold_reason: flagsFor(row).includes("H")
    ? "Collision in photographed line; do not publish without confirmation"
    : "Primary-source audit requires owner or bottle confirmation before publication",
}));

fs.writeFileSync(publishedPath, toCsv(["source_id", "category", "name", "price"], published));
fs.writeFileSync(
  withheldPath,
  toCsv(
    ["source_id", "source_category", "source_name", "source_price", "flags", "hold_reason"],
    withheld,
  ),
);

console.log(`Wrote ${published.length} publishable rows and ${withheld.length} held rows.`);
