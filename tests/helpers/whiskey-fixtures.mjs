import fs from "node:fs";

import { parseWhiskeyCsv, prepareWhiskeyRows } from "../../js/whiskey-menu.js";

export const read = (relativePath) =>
  fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

export const publicRows = prepareWhiskeyRows(parseWhiskeyCsv(read("data/whiskey.csv")).records);
export const publicMetadata = JSON.parse(read("data/whiskey-metadata.json"));
export const publicIds =publicRows.map((row) => row.sourceId);

export const VOCAB = ["sweet", "fruity", "spicy", "smoky", "oaky"];

export function makeRow(sourceId, name, category, price) {
  return { sourceId, category, name, price };
}

export function makeMeta(row, overrides = {}) {
  return {
    source_id: row.sourceId,
    menu_name: row.name,
    category: row.category,
    bottle_version: `${row.name} (exact)`,
    description: `Producer description for ${row.name}.`,
    region: "Somewhere",
    region_group: "Scotland",
    age_years: null,
    age_status: "nas",
    age_basis: "producer_page",
    age_note: null,
    flavor_tags: [],
    product_source_url: `https://example.com/${row.sourceId}`,
    source_type: "producer_product_page",
    verified_on: "2026-10-06",
    status: "verified",
    ambiguity_note: null,
    critic: null,
    ...overrides,
  };
}

export function unresolvedMeta(row, overrides = {}) {
  return makeMeta(row, {
    bottle_version: null,
    description: "Exact bottle not verified, so no producer description, region or flavor is claimed.",
    region: null,
    region_group: null,
    age_years: null,
    age_status: "unknown",
    age_basis: null,
    flavor_tags: [],
    product_source_url: null,
    source_type: "none",
    status: "unresolved",
    ambiguity_note: "Menu label does not say which bottle.",
    ...overrides,
  });
}

export function makeMetadata(metas) {
  return {
    schema_version: 1,
    verified_on: "2026-10-06",
    flavor_vocabulary: [...VOCAB],
    rows: metas,
  };
}

export const clone = (value) => JSON.parse(JSON.stringify(value));
