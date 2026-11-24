import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => {
  try { return readFileSync(new URL(path, root), "utf8"); }
  catch { return ""; }
};

function loadCore() {
  const context = { console, JSON, Math, Number, Object, String, Array, Date, RegExp, Set, Map };
  runInNewContext([
    source("google-apps-script-manager/SheetDraft.gs"),
    source("google-apps-script-manager/WineReview.gs"),
    source("google-apps-script-manager/OtherBeverages.gs"),
  ].join("\n"), context);
  return context;
}

test("three Sheet tabs project into versioned manager drafts without public cost fields", () => {
  const core = loadCore();
  assert.equal(typeof core.projectManagerDraft_, "function");
  const draft = core.projectManagerDraft_({
    wine: {
      headers: ["Bin", "Menu Name", "Bottle Price", "Show on QR", "Par", "Unit Cost"],
      rows: [["101", "Estate Red", 72, true, 4, 22]],
    },
    whiskey: {
      headers: ["Stable ID", "Menu Name", "Category", "Standard (1.5 oz)", "Show on QR", "On Hand"],
      rows: [["w-1", "Example Rye", "Rye", 14, true, 2]],
    },
    spirits: {
      headers: ["Product", "Category", "Out", "Par (source)", "Bin / location"],
      rows: [["Titos", "Other bar", false, 2, "Right well"]],
    },
  });
  assert.equal(draft.schemaVersion, 1);
  assert.match(draft.revision, /^[a-f0-9]{8}$/);
  assert.deepEqual(JSON.parse(JSON.stringify(draft.wine[0])), {
    key: "101", name: "Estate Red", bottlePrice: 72, showOnQr: true,
    source: { par: 4 },
  });
  assert.equal(draft.whiskey[0].key, "w-1");
  assert.equal(draft.spirits[0].source.location, "Right well");
  assert.doesNotMatch(JSON.stringify(draft), /Unit Cost|22/);
});

test("Wine CSV review parses quoted values and derives a literal change summary", () => {
  const core = loadCore();
  assert.equal(typeof core.reviewWineCsv_, "function");
  const csv = source("tests/fixtures/manager-wine-valid.csv");
  const review = core.reviewWineCsv_(csv, [
    { key: "101", name: "Estate Reserve", bottlePrice: 70, showOnQr: true },
    { key: "999", name: "Old Wine", bottlePrice: 40, showOnQr: true },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(review.counts)), {
    uploaded: 2, added: 1, changed: 1, unchanged: 0, hidden: 1, invalid: 0,
  });
  assert.equal(review.rows[0].name, "Estate, Reserve");
  assert.equal(review.rows[0].description, "Cassis, cedar");
  assert.deepEqual(JSON.parse(JSON.stringify(review.hiddenKeys)), ["999"]);
  assert.equal(review.canPublish, true);
});

test("Wine CSV review blocks missing and duplicate Bin values", () => {
  const core = loadCore();
  const review = core.reviewWineCsv_(source("tests/fixtures/manager-wine-invalid.csv"), []);
  assert.equal(review.canPublish, false);
  assert.equal(review.counts.invalid, 3);
  assert.match(review.errors.join("\n"), /row 2.*Bin is required/i);
  assert.match(review.errors.join("\n"), /rows 3 and 4.*duplicate Bin 101/i);
});

test("formula-looking CSV text remains inert text", () => {
  const core = loadCore();
  const csv = "Bin,Menu Name,Bottle Price,Description,Show on QR\n103,Safe Wine,60,=IMPORTXML(\"https://example.com\"),TRUE";
  const review = core.reviewWineCsv_(csv, []);
  assert.equal(review.rows[0].description, '=IMPORTXML("https://example.com")');
});

test("Wine write plans address only approved guest columns", () => {
  const core = loadCore();
  assert.equal(typeof core.buildWineWritePlan_, "function");
  const plan = core.buildWineWritePlan_({
    rows: [{ key: "101", name: "Estate Red", bottlePrice: 72, showOnQr: true }],
    hiddenKeys: ["999"],
    canPublish: true,
  });
  const fields = plan.upserts.flatMap((entry) => Object.keys(entry.values));
  assert.deepEqual(fields.sort(), ["Bottle Price", "Menu Name", "Show on QR"]);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.hides)), [{ key: "999", values: { "Show on QR": false } }]);
  for (const forbidden of ["Unit Cost", "Par", "Distributor", "On Hand", "Qty to Order", "Manager Notes"]) {
    assert.doesNotMatch(JSON.stringify(plan), new RegExp(forbidden, "i"));
  }
});

test("Wine publication rejects missing identity and blank prices", () => {
  const core = loadCore();
  for (const row of [
    { key: "", name: "Estate Red", bottlePrice: 72, showOnQr: true },
    { key: "101", name: "", bottlePrice: 72, showOnQr: true },
    { key: "101", name: "Estate Red", bottlePrice: "", showOnQr: true },
  ]) {
    assert.throws(() => core.buildWineWritePlan_({ rows: [row], hiddenKeys: [], canPublish: true }), /required|valid/i);
  }
});

test("Spirit suggestions include hard liquor and exclude beer, liqueurs, and mixers", () => {
  const core = loadCore();
  assert.equal(typeof core.suggestSpiritFamily_, "function");
  const cases = [
    ["Titos", "Other bar", "Vodka"],
    ["HENDRICKS", "Other bar", "Gin"],
    ["CASAMIGOS REPO", "Other bar", "Tequila & Mezcal"],
    ["DIPLOMATICO", "Other bar", "Rum"],
    ["REMY MARTIN XO", "Other bar", "Brandy & Cognac"],
    ["FERNET", "Liqueur / aperitif", null],
    ["COORS Light", "Beer", null],
    ["ZING ZANG BLOODY", "Other bar", null],
  ];
  for (const [name, category, want] of cases) assert.equal(core.suggestSpiritFamily_(name, category), want, name);
});

test("Spirit publication requires confirmed family and price and validates Shot Picks", () => {
  const core = loadCore();
  assert.equal(typeof core.validateSpiritRow_, "function");
  assert.deepEqual(Array.from(core.validateSpiritRow_({
    name: "Titos", spiritFamily: "Vodka", pourSize: "1.5 oz", pourPrice: 12,
    showOnQr: true, featuredShot: true, shotPrice: 10, shotNote: "Cold and clean",
  })), []);
  assert.match(core.validateSpiritRow_({ name: "Mystery", showOnQr: true }).join(" "), /Spirit Family.*Pour Price/i);
  assert.match(core.validateSpiritRow_({
    name: "Titos", spiritFamily: "Vodka", pourSize: "1.5 oz", pourPrice: 12,
    showOnQr: true, featuredShot: true, shotPrice: -1,
  }).join(" "), /Shot Price/i);
});

