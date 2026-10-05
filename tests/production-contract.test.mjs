import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parseCSV } from "../js/csv.js";

const read = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

function luminance(hex) {
  const channels = hex
    .replace("#", "")
    .match(/../g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("Whiskey uses an accessible violet-red accent while Wine retains the gold default", () => {
  const whiskey = read("whiskey.html");
  const wine = read("wine.html");
  const css = read("css/base.css");

  assert.match(whiskey, /<body[^>]+data-menu="whiskey"[^>]+whiskey-theme-violet-red/);
  assert.doesNotMatch(wine, /whiskey-theme-violet-red/);
  assert.match(css, /:root\s*\{[^}]*--accent:\s*#b59a6a;/s);

  const theme = css.match(
    /body\[data-menu="whiskey"\]\.whiskey-theme-violet-red\s*\{[^}]*--accent:\s*(#[0-9a-f]{6});/is,
  );
  assert.ok(theme, "Whiskey theme must define its own violet-red accent");
  assert.ok(contrast(theme[1], "#090807") >= 4.5, "Whiskey accent must meet WCAG AA on the page background");
});

test("empty and failed menu data resolve to explicit menu-specific status copy", () => {
  const whiskeyModule = read("js/whiskey-menu.js");
  const whiskeyHtml = read("whiskey.html");

  assert.match(whiskeyModule, /list is being updated/i);
  assert.match(whiskeyModule, /ask your server for current availability/i);
  assert.match(whiskeyModule, /list is temporarily unavailable/i);
  assert.match(whiskeyHtml, /aria-live="polite"/);
});

test("authoritative transcription publishes the 91-row audited subset and holds all 18 exclusions", () => {
  for (const path of [
    "_audit/whiskey/whiskey-menu-transcription.csv",
    "_audit/whiskey/whiskey-menu-transcription.txt",
    "_audit/whiskey/primary-source-audit-release-decision.json",
    "data/whiskey.csv",
    "_audit/whiskey/whiskey.withheld.csv",
  ]) {
    assert.ok(fs.existsSync(new URL(`../${path}`, import.meta.url)), `${path} must exist`);
  }

  const source = parseCSV(read("_audit/whiskey/whiskey-menu-transcription.csv")).records;
  const published = parseCSV(read("data/whiskey.csv")).records;
  const withheld = parseCSV(read("_audit/whiskey/whiskey.withheld.csv")).records;

  assert.equal(source.length, 109);
  assert.equal(published.length, 91);
  assert.equal(withheld.length, 18);
  assert.deepEqual(
    withheld.map((row) => Number(row.source_id)),
    [2, 3, 13, 20, 22, 39, 40, 56, 57, 59, 60, 61, 74, 75, 87, 90, 95, 97],
  );
  assert.equal(published.filter((row) => row.category === "Whiskey").length, 18);
  assert.equal(published.some((row) => row.category === "Scotch"), false);
  assert.equal(published.some((row) => !row.name || !row.category || !row.price), false);
  const heldIds = new Set(withheld.map((row) => row.source_id));
  assert.deepEqual(
    published,
    source
      .filter(
        (row) =>
          !new Set([2, 3, 13, 20, 22, 39, 40, 56, 57, 59, 60, 61, 74, 75, 87, 90, 95, 97]).has(
            Number(row.id),
          ),
      )
      .map((row) => ({
        source_id: row.id,
        category: row.category || "Whiskey",
        name:
          Number(row.id) === 21
            ? "Nikka Coffey Grain"
            : row.name.replaceAll("&amp;", "&").trim(),
        price: row.price,
      })),
  );
  assert.equal(published.some((row) => heldIds.has(row.source_id)), false);
  assert.deepEqual(
    [...published.map((row) => row.source_id), ...withheld.map((row) => row.source_id)]
      .map(Number)
      .sort((a, b) => a - b),
    Array.from({ length: 109 }, (_, index) => index + 1),
  );
  assert.match(
    read("_audit/whiskey/whiskey-menu-transcription.txt"),
    /de8c97202129d36e98bb4aa29bfe4125a51c9c80f7b59deba4a3083e1171ee44/i,
  );
  const auditDecision = JSON.parse(read("_audit/whiskey/primary-source-audit-release-decision.json"));
  assert.deepEqual(auditDecision.counts, {
    source_rows: 109,
    publish_verified: 55,
    publish_identity_only: 36,
    hold: 18,
    public_rows: 91,
  });
  assert.equal(published.find((row) => row.source_id === "21").name, "Nikka Coffey Grain");
});

test("Whiskey has an isolated list renderer with safe price and empty-state behavior", async () => {
  const moduleUrl = new URL("../js/whiskey-menu.js", import.meta.url);
  assert.ok(fs.existsSync(moduleUrl), "js/whiskey-menu.js must exist");
  const { categoryId, menuStatusCopy, prepareWhiskeyRows, priceLabel } = await import(moduleUrl);

  assert.deepEqual(prepareWhiskeyRows([{ source_id: "1", category: "Rye", name: "Bulleit", price: "10" }]), [
    { sourceId: 1, category: "Rye", name: "Bulleit", price: 10 },
  ]);
  assert.equal(priceLabel(10), "$10");
  assert.equal(priceLabel(null), "Ask for details");
  assert.equal(typeof categoryId, "function");
  assert.equal(categoryId("Other Whiskey"), "category-other-whiskey");
  assert.throws(() => prepareWhiskeyRows([{ source_id: "2", category: "Rye", name: "", price: "12" }]));
  assert.equal(typeof menuStatusCopy, "function");
  assert.equal(
    menuStatusCopy("empty"),
    "Whiskey list is being updated. Please ask your server for current availability.",
  );
  assert.equal(
    menuStatusCopy("error"),
    "Whiskey list is temporarily unavailable. Please refresh or ask your server for current availability.",
  );

  const whiskeyHtml = read("whiskey.html");
  assert.match(whiskeyHtml, /src="js\/whiskey\.js"/);
  assert.doesNotMatch(whiskeyHtml, /src="js\/app\.js"/);
});

test("a zero-byte Whiskey file becomes an empty state before header validation", async () => {
  const { parseWhiskeyCsv, resolveWhiskeyDataset } = await import(
    new URL("../js/whiskey-menu.js", import.meta.url)
  );
  assert.equal(typeof resolveWhiskeyDataset, "function");
  assert.deepEqual(resolveWhiskeyDataset({ headers: [], records: [] }), { state: "empty", rows: [] });
  assert.throws(
    () => resolveWhiskeyDataset({ headers: ["name"], records: [{ name: "Bulleit" }] }),
    /missing required columns/i,
  );
  assert.throws(
    () => parseWhiskeyCsv('source_id,category,name,price\n1,Rye,Bulleit,"10'),
    /unterminated quoted field/i,
  );
  for (const malformed of [
    'source_id,category,name,price\n1,Rye,Bul"leit",10',
    'source_id,category,name,price\n1,Rye,"Bulleit"junk,10',
    'source_id,category,name,price\n1,Rye,Bulleit,"1"0',
  ]) {
    assert.throws(() => parseWhiskeyCsv(malformed), /invalid quote placement/i);
  }
});

test("Whiskey uses stable filter buttons and synchronizes fixed-header height", () => {
  const script = read("js/whiskey.js");
  assert.doesNotMatch(script, /role="tab"|role", "tablist"/);
  assert.match(script, /aria-pressed/);
  assert.match(script, /syncTopbarHeight/);
  assert.match(script, /ResizeObserver/);
});

test("audit-only source and held rows are excluded from the Pages build", () => {
  const config = read("_config.yml");
  assert.match(config, /exclude:\s*[\s\S]*- _audit/);
  assert.equal(fs.existsSync(new URL("../data/whiskey.withheld.csv", import.meta.url)), false);
  assert.equal(
    fs.existsSync(new URL("../data/source/whiskey-menu-transcription.csv", import.meta.url)),
    false,
  );
});

test("Wine and Whiskey pages cross-link with an accessible current-page state", () => {
  const wine = read("wine.html");
  const whiskey = read("whiskey.html");
  assert.match(wine, /href="whiskey\.html"/);
  assert.match(whiskey, /href="wine\.html"/);
  assert.match(wine, /href="wine\.html" aria-current="page"/);
  assert.match(whiskey, /href="whiskey\.html" aria-current="page"/);
  assert.match(read("css/base.css"), /\.menu-switcher/);
});
