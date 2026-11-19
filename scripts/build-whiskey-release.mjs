import fs from "node:fs";
import { parseWhiskeyCsv, resolveWhiskeyDataset } from "../js/whiskey-menu.js";
import { validateWhiskeyMetadata } from "../js/whiskey-metadata.js";

// The current guest CSV is the source of truth. Validate it in place; rebuilding
// from a historical photograph would silently undo subsequent menu updates.
const menuUrl = new URL("../data/whiskey.csv", import.meta.url);
const metadataUrl = new URL("../data/whiskey-metadata.json", import.meta.url);
const dataset = resolveWhiskeyDataset(parseWhiskeyCsv(fs.readFileSync(menuUrl, "utf8")));
if (dataset.state === "empty") throw new Error("The Whiskey menu has no publishable items.");

const metadata = JSON.parse(fs.readFileSync(metadataUrl, "utf8"));
const validation = validateWhiskeyMetadata(metadata, dataset.rows);
if (!validation.ok) throw new Error(validation.errors.join("\n"));

console.log(`Validated ${dataset.rows.length} current Whiskey items and matching metadata. No files changed.`);
