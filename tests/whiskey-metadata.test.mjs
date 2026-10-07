import assert from "node:assert/strict";
import test from "node:test";

import {
  ageKind,
  isEligible,
  isValidCritic,
  loadWhiskeyMetadata,
  validateWhiskeyMetadata,
  verifiedAge,
} from "../js/whiskey-metadata.js";
import {
  clone,
  makeMeta,
  makeMetadata,
  makeRow,
  publicIds,
  publicMetadata,
  publicRows,
  read,
  unresolvedMeta,
} from "./helpers/whiskey-fixtures.mjs";

const validCritic = {
  critic: "Example Critic",
  score: 92,
  source_url: "https://example.com/review",
  verified_on: "2026-10-06",
};

test("public boundary is exactly the 91 rows of data/whiskey.csv", () => {
  assert.equal(publicRows.length, 91);
  assert.equal(new Set(publicIds).size, 91);
});

test("metadata id set equals the 91 CSV ids and validates against the menu", () => {
  const metaIds = publicMetadata.rows.map((r) => r.source_id).sort((a, b) => a - b);
  assert.deepEqual(metaIds, [...publicIds].sort((a, b) => a - b));

  const result = validateWhiskeyMetadata(publicMetadata, publicRows);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  for (const row of publicRows) {
    const meta = result.byId[row.sourceId];
    assert.ok(meta, `row ${row.sourceId} has a detail record`);
    assert.equal(meta.menu_name, row.name);
    assert.equal(meta.category, row.category);
  }
});

test("every public row has an explicit status, age status and honest unknowns", () => {
  const { byId } = validateWhiskeyMetadata(publicMetadata, publicRows);
  for (const row of publicRows) {
    const meta = byId[row.sourceId];
    assert.ok(["verified", "partial", "unresolved"].includes(meta.status));
    assert.ok(meta.age_status);
    if (meta.status === "unresolved") {
      assert.equal(meta.region_group, null);
      assert.deepEqual(meta.flavor_tags, []);
    }
  }
});

function validFixture() {
  const rows = [makeRow(1, "Alpha", "Rye", 10), makeRow(2, "Beta", "Bourbon", 12), makeRow(3, "Gamma", "Rye", 14)];
  const metas = [makeMeta(rows[0]), makeMeta(rows[1]), unresolvedMeta(rows[2])];
  return { rows, metadata: makeMetadata(metas) };
}

test("validator accepts a consistent synthetic fixture", () => {
  const { rows, metadata } = validFixture();
  const result = validateWhiskeyMetadata(metadata, rows);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(Object.keys(result.byId).length, 3);
});

test("validator rejects extra, missing and duplicate ids", () => {
  const { rows, metadata } = validFixture();

  const extra = clone(metadata);
  extra.rows.push(makeMeta(makeRow(99, "Extra", "Rye", 9)));
  assert.equal(validateWhiskeyMetadata(extra, rows).ok, false);

  const missing = clone(metadata);
  missing.rows.pop();
  assert.equal(validateWhiskeyMetadata(missing, rows).ok, false);

  const dup = clone(metadata);
  dup.rows[1] = clone(dup.rows[0]);
  const dupResult = validateWhiskeyMetadata(dup, rows);
  assert.equal(dupResult.ok, false);
  assert.ok(dupResult.errors.some((e) => /duplicate/i.test(e)));
});

test("validator rejects name or category mismatches versus the CSV row", () => {
  const { rows, metadata } = validFixture();
  const renamed = clone(metadata);
  renamed.rows[0].menu_name = "Other";
  assert.equal(validateWhiskeyMetadata(renamed, rows).ok, false);
  const recategorised = clone(metadata);
  recategorised.rows[1].category = "Rye";
  assert.equal(validateWhiskeyMetadata(recategorised, rows).ok, false);
});

test("validator rejects bad enums and flavor tags outside the vocabulary", () => {
  const { rows, metadata } = validFixture();
  for (const [field, value] of [
    ["status", "great"],
    ["age_status", "old"],
    ["age_basis", "rumor"],
    ["source_type", "blog"],
  ]) {
    const bad = clone(metadata);
    bad.rows[0][field] = value;
    assert.equal(validateWhiskeyMetadata(bad, rows).ok, false, `${field}=${value}`);
  }
  const tag = clone(metadata);
  tag.rows[0].flavor_tags = ["sweet", "peaty"];
  assert.equal(validateWhiskeyMetadata(tag, rows).ok, false);
});

test("validator rejects malformed input without throwing", () => {
  const { rows } = validFixture();
  for (const bad of [null, undefined, {}, { rows: "x" }, []]) {
    const result = validateWhiskeyMetadata(bad, rows);
    assert.equal(result.ok, false);
    assert.deepEqual(result.byId, {});
  }
});

test("critic is null or fully valid", () => {
  assert.equal(isValidCritic(null), false);
  assert.equal(isValidCritic(validCritic), true);
  for (const patch of [
    { critic: "" },
    { critic: undefined },
    { score: Number.NaN },
    { score: "92" },
    { score: Infinity },
    { source_url: "http://example.com" },
    { source_url: "" },
    { verified_on: "" },
    { verified_on: undefined },
  ]) {
    assert.equal(isValidCritic({ ...validCritic, ...patch }), false, JSON.stringify(patch));
  }

  const { rows, metadata } = validFixture();
  const good = clone(metadata);
  good.rows[0].critic = validCritic;
  assert.equal(validateWhiskeyMetadata(good, rows).ok, true);
  const bad = clone(metadata);
  bad.rows[0].critic = { ...validCritic, source_url: "http://insecure.example" };
  assert.equal(validateWhiskeyMetadata(bad, rows).ok, false);
});

test("unresolved rows must not carry description, region, flavor or source claims", () => {
  const { rows, metadata } = validFixture();
  for (const patch of [
    { description: "A rich and powerful whiskey." },
    { region: "Kentucky" },
    { region_group: "United States" },
    { flavor_tags: ["sweet"] },
    { product_source_url: "https://example.com/x" },
  ]) {
    const bad = clone(metadata);
    Object.assign(bad.rows[2], patch);
    assert.equal(validateWhiskeyMetadata(bad, rows).ok, false, JSON.stringify(patch));
  }
});

test("age is verified only for a fixed or minimum age backed by a producer page", () => {
  const row = makeRow(1, "A", "Rye", 10);
  assert.equal(verifiedAge(makeMeta(row, { age_status: "fixed", age_years: 12, age_basis: "producer_page" })), 12);
  assert.equal(
    verifiedAge(makeMeta(row, { age_status: "fixed", age_years: 12, age_basis: "producer_page_and_menu_label" })),
    12,
  );
  assert.equal(verifiedAge(makeMeta(row, { age_status: "fixed", age_years: 12, age_basis: "menu_label" })), null);
  assert.equal(verifiedAge(makeMeta(row, { age_status: "minimum", age_years: 12, age_basis: "producer_page" })), 12);
  assert.equal(verifiedAge(makeMeta(row, { age_status: "minimum", age_years: 12, age_basis: "menu_label" })), null);
  for (const age_status of ["nas", "range", "varies", "blend", "unknown"]) {
    assert.equal(verifiedAge(makeMeta(row, { age_status, age_years: 7, age_basis: "producer_page" })), null, age_status);
  }
  assert.equal(isEligible(makeMeta(row)), true);
  assert.equal(isEligible(unresolvedMeta(row)), false);
});

test("a minimum age keeps its own kind and is never reported as a fixed age", () => {
  const row = makeRow(1, "A", "Rye", 10);
  const minimum = makeMeta(row, { age_status: "minimum", age_years: 16, age_basis: "producer_page" });
  const fixed = makeMeta(row, { age_status: "fixed", age_years: 16, age_basis: "producer_page" });
  assert.equal(ageKind(minimum), "minimum");
  assert.equal(ageKind(fixed), "fixed");
  assert.equal(ageKind(makeMeta(row, { age_status: "range", age_years: null, age_min: 6, age_max: 7, age_basis: "producer_page" })), null);
  assert.equal(ageKind(makeMeta(row, { age_status: "minimum", age_years: 16, age_basis: "menu_label" })), null);
});

test("validator checks minimum and range age shapes", () => {
  const { rows, metadata } = validFixture();
  const bad = (patch) => {
    const copy = clone(metadata);
    Object.assign(copy.rows[0], patch);
    return validateWhiskeyMetadata(copy, rows).ok;
  };
  assert.equal(bad({ age_status: "minimum", age_years: null, age_basis: "producer_page" }), false);
  assert.equal(bad({ age_status: "fixed", age_years: 3.5, age_basis: "producer_page" }), false);
  assert.equal(bad({ age_status: "range", age_years: 6, age_min: 6, age_max: 7, age_basis: "producer_page" }), false);
  assert.equal(bad({ age_status: "range", age_years: null, age_min: 7, age_max: 6, age_basis: "producer_page" }), false);
  assert.equal(bad({ age_status: "range", age_years: null, age_min: 6, age_max: 7, age_basis: "producer_page" }), true);
  assert.equal(bad({ age_status: "minimum", age_years: 4, age_basis: "producer_page" }), true);
});

test("real data: only producer-backed fixed or minimum ages are verified; ranges are never one age", () => {
  const { byId } = validateWhiskeyMetadata(publicMetadata, publicRows);
  for (const meta of Object.values(byId)) {
    const age = verifiedAge(meta);
    if (age !== null) {
      assert.ok(["fixed", "minimum"].includes(meta.age_status));
      assert.match(meta.age_basis, /^producer_page/);
    }
    if (meta.age_basis === "menu_label") assert.equal(age, null);
    if (meta.age_status === "range") {
      assert.equal(meta.age_years, null, meta.menu_name);
      assert.equal(age, null);
    }
  }
  const named = (name) => Object.values(byId).find((m) => m.menu_name === name);
  assert.equal(named("Four Roses Small Batch").age_status, "range");
  assert.deepEqual([named("Four Roses Small Batch").age_min, named("Four Roses Small Batch").age_max], [6, 7]);
  assert.equal(verifiedAge(named("Four Roses Small Batch")), null);
});

test("real data: producer-stated minimum ages stay minimums, not fixed ages", () => {
  const { byId } = validateWhiskeyMetadata(publicMetadata, publicRows);
  const named = (name) => Object.values(byId).find((m) => m.menu_name === name);
  // producer wording refetched 2026-10-06: "minimum of" / "at least"
  for (const [name, years] of [
    ["Pendleton 1910", 12],
    ["Lagavulin 16 yr", 16],
    ["Talisker 10 yr", 10],
    ["Proper Twelve", 4],
    ["Sudden Wisdom", 3],
  ]) {
    assert.equal(named(name).age_status, "minimum", name);
    assert.equal(verifiedAge(named(name)), years, name);
    assert.equal(ageKind(named(name)), "minimum", name);
  }
  // producer wording is an exact age here
  for (const name of ["Rittenhouse", "Laphroaig 10 yr", "Elijah Craig 18 yr"]) {
    assert.equal(named(name).age_status, "fixed", name);
  }
  assert.equal(named("Tullamore Dew 12 yr").age_status, "range");
});

test("public metadata preserves the verified, partial and unresolved boundaries", () => {
  const count = (status) => publicMetadata.rows.filter((m) => m.status === status).length;
  assert.equal(count("verified"), 42);
  assert.equal(count("partial"), 4);
  assert.equal(count("unresolved"), 45);
  assert.equal(publicMetadata.rows.filter((m) => m.critic).length, 0);
});

test("unresolved rows carry only a short family-level description and no release-specific facts", () => {
  const unresolved = publicMetadata.rows.filter((m) => m.status === "unresolved");
  assert.equal(unresolved.length, 45);
  for (const m of unresolved) {
    const label = m.menu_name;
    assert.ok(m.description.length > 40 && m.description.length < 260, label);
    assert.match(m.description, /not verified/i, label);
    assert.doesNotMatch(m.description.replace(m.menu_name, ""), /\d|proof|tasting|aroma|notes|score|rated/i, label);
    assert.equal(m.bottle_version, null, label);
    assert.equal(m.product_source_url, null, label);
    assert.deepEqual(m.flavor_tags, [], label);
    assert.equal(m.critic, null, label);
  }
});

test("ambiguous and source-blocked rows are not asserted as exact bottles", () => {
  const named = (n) => publicMetadata.rows.find((m) => m.menu_name === n);
  for (const name of ["Willet Small Batch", "Glenfiddich 12 yr"]) {
    const m = named(name);
    assert.equal(m.status, "unresolved", name);
    assert.equal(m.bottle_version, null, name);
    assert.equal(m.product_source_url, null, name);
    assert.notEqual(m.age_basis, "producer_page", name);
  }
  assert.equal(named("Willet Small Batch").age_years, null);
  assert.doesNotMatch(named("Willet Small Batch").description, /Family Estate|\d/);
  // no product-fact claim rests on a retail shop
  for (const m of publicMetadata.rows) assert.doesNotMatch(String(m.product_source_url), /thirstie|shop\./i, m.menu_name);
  const elk = named("Old Elk Rum Cask");
  assert.equal(elk.bottle_version, null);
  assert.equal(elk.age_status, "unknown");
  assert.equal(elk.age_min, null);
  assert.equal(elk.age_max, null);
  assert.equal(verifiedAge(elk), null);
});

test("flavor tags are limited to what the producer notes support for corrected rows", () => {
  const named = (n) => publicMetadata.rows.find((m) => m.menu_name === n);
  assert.ok(!named("Elijah Craig Small Batch").flavor_tags.includes("oaky"));
  assert.doesNotMatch(named("Elijah Craig Small Batch").description, /oak|wood/i);
  const heigold = named("Rabbit Hole Heigold");
  assert.ok(!heigold.flavor_tags.includes("oaky"));
  assert.doesNotMatch(heigold.description, /Whiskey Advocate|cherr|licorice|\boak/i);
  assert.equal(heigold.age_status, "minimum");
  // every retained tag maps to the producer's own wording (malt/butterscotch, baking spice/pepper, citrus)
  assert.deepEqual([...heigold.flavor_tags].sort(), ["fruity", "spicy", "sweet"]);
  assert.match(heigold.description, /toasted malt.*warm baking spices.*butterscotch.*bright citrus.*pepper spice/);
  assert.deepEqual(named("Blood Oath Pact No. 6").flavor_tags, ["sweet", "fruity"]);
  assert.match(named("Blood Oath Pact No. 6").description, /rested in cognac casks/);
  assert.doesNotMatch(named("Blood Oath Pact No. 7").description, /cognac/);
});

test("region and release claims are limited to what the exact product page states", () => {
  const named = (n) => publicMetadata.rows.find((m) => m.menu_name === n);
  const angel = named("Angels Envy");
  assert.equal(angel.region, null);
  assert.equal(angel.region_group, null);
  assert.doesNotMatch(angel.description, /Kentucky|United States/);
  const pot = named("Willet Pot");
  assert.doesNotMatch(pot.description, /Kentucky/);
  assert.equal(pot.region, null);
  for (const name of ["Stagg Barrel Proof", "Bookers Barry’s Batch"]) {
    const m = named(name);
    assert.equal(m.status, "unresolved", name);
    for (const k of ["bottle_version", "region", "region_group", "age_years", "age_basis", "product_source_url", "critic"]) assert.equal(m[k], null, name + k);
    assert.deepEqual(m.flavor_tags, [], name);
    assert.equal(verifiedAge(m), null, name);
    assert.equal(Object.hasOwn(m, "ambiguity_note"), false, name);
    assert.ok(m.description.length > 40, name);
  }
});

test("loadWhiskeyMetadata never throws and reports unavailable on failure", async () => {
  const { rows, metadata } = validFixture();
  const ok = await loadWhiskeyMetadata(rows, async () => ({ ok: true, json: async () => metadata }));
  assert.equal(ok.ok, true);

  const http = await loadWhiskeyMetadata(rows, async () => ({ ok: false, status: 404 }));
  assert.equal(http.ok, false);
  assert.deepEqual(http.byId, {});
  assert.ok(http.errors.length > 0);

  const boom = await loadWhiskeyMetadata(rows, async () => {
    throw new Error("offline");
  });
  assert.equal(boom.ok, false);

  const badJson = await loadWhiskeyMetadata(rows, async () => ({
    ok: true,
    json: async () => {
      throw new Error("bad json");
    },
  }));
  assert.equal(badJson.ok, false);
});

test("new whiskey modules never reference audit or withheld material", () => {
  for (const file of [
    "js/whiskey-metadata.js",
    "js/whiskey-recommend.js",
    "js/whiskey-picker.js",
    "js/whiskey-detail.js",
    "js/whiskey-dialog.js",
    "js/whiskey-picks.js",
    "js/whiskey-page.js",
    "css/whiskey.css",
  ]) {
    const text = read(file);
    assert.doesNotMatch(text, /_audit|withheld/i, file);
  }
});
