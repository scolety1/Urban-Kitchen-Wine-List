import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { execFileSync } from "node:child_process";

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

test("current owner menu publishes all 109 priced items with resolved wrapped lines", () => {
  const source = parseCSV(read("_audit/whiskey/whiskey-menu-transcription.csv")).records;
  const published = parseCSV(read("data/whiskey.csv")).records;
  const corrections = {
    2: { price: "12" },
    21: { name: "Nikka Coffey Grain" },
    39: { price: "60" },
    57: { name: "Ezra Brooks Cask Strength" },
    61: { name: "Eagle Rare 10 yr" },
    74: { price: "35" },
  };
  assert.equal(published.length, 109);
  assert.equal(new Set(published.map((row) => row.source_id)).size, 109);
  assert.deepEqual(published, source.map((row) => ({
    source_id: row.id,
    category: row.category || "Whiskey",
    name: row.name.replaceAll("&amp;", "&").trim(),
    price: row.price,
    ...corrections[Number(row.id)],
  })));
  assert.equal(published.filter((row) => row.category === "Whiskey").length, 20);
  assert.ok(published.every((row) => row.name && row.category && Number(row.price) > 0));
});

test("release validation preserves the current menu and metadata byte for byte", () => {
  const paths = ["data/whiskey.csv", "data/whiskey-metadata.json"];
  const before = paths.map(read);
  const output = execFileSync(process.execPath, ["scripts/build-whiskey-release.mjs"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8",
  });
  assert.match(output, /Validated 109 current Whiskey items/);
  assert.deepEqual(paths.map(read), before);
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

test("Wine, Whiskey and Other Beverages form an accessible menu loop", () => {
  const wine = read("wine.html");
  const whiskey = read("whiskey.html");
  const other = read("liqueur/index.html");
  assert.match(wine, /href="whiskey\.html"/);
  assert.match(wine, /href="liqueur\/"/);
  assert.match(whiskey, /href="wine\.html"/);
  assert.match(whiskey, /href="liqueur\/"/);
  assert.match(other, /href="\.\.\/wine\.html"/);
  assert.match(other, /href="\.\.\/whiskey\.html"/);
  assert.match(read("css/base.css"), /\.menu-loop/);
});
