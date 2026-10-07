import assert from "node:assert/strict";
import test from "node:test";

import { validateWhiskeyMetadata, verifiedAge } from "../js/whiskey-metadata.js";
import {
  ANYWHERE,
  NO_PREFERENCE,
  buildPickerOptions,
  eligibleRows,
  recommend,
} from "../js/whiskey-recommend.js";
import {
  clone,
  makeMeta,
  makeRow,
  publicMetadata,
  publicRows,
  unresolvedMeta,
} from "./helpers/whiskey-fixtures.mjs";

const none = () => ({ flavor: NO_PREFERENCE, budget: NO_PREFERENCE, age: NO_PREFERENCE, region: NO_PREFERENCE });

function fixture() {
  const rows = [
    makeRow(1, "Alpha", "Bourbon", 10),
    makeRow(2, "Bravo", "Whiskey", 15),
    makeRow(3, "Charlie", "Whiskey", 15),
    makeRow(4, "Delta", "Rye", 20),
    makeRow(5, "Echo", "Irish", 25),
    makeRow(6, "Foxtrot", "Rye", 9),
    makeRow(7, "Golf", "Bourbon", 12),
    makeRow(8, "Hotel", "Whiskey", 30),
    makeRow(9, "India", "Whiskey", 40),
  ];
  const stated = (years, basis = "producer_page") => ({ age_status: "fixed", age_years: years, age_basis: basis });
  const metas = [
    makeMeta(rows[0], { flavor_tags: ["sweet", "oaky"], region_group: "United States", ...stated(12) }),
    makeMeta(rows[1], { flavor_tags: ["sweet", "fruity"], region_group: "Scotland", ...stated(12) }),
    makeMeta(rows[2], { flavor_tags: ["smoky"], region_group: "Scotland" }),
    makeMeta(rows[3], { flavor_tags: ["fruity"], region_group: "United States", ...stated(18) }),
    makeMeta(rows[4], { flavor_tags: ["sweet"], region_group: "Ireland", age_status: "range", age_years: null, age_note: "6-7 years" }),
    unresolvedMeta(rows[5]),
    makeMeta(rows[6], { status: "partial", flavor_tags: [], region: null, region_group: null, ...stated(6) }),
    makeMeta(rows[7], { flavor_tags: ["sweet"], region_group: "Scotland", ...stated(20, "menu_label") }),
    makeMeta(rows[8], { flavor_tags: ["sweet", "smoky"], region_group: "Scotland", age_status: "blend", age_years: null }),
  ];
  return { rows, metas };
}

function build(metas, rows) {
  const result = validateWhiskeyMetadata({ schema_version: 1, verified_on: "x", flavor_vocabulary: ["sweet", "fruity", "spicy", "smoky", "oaky"], rows: metas }, rows);
  assert.deepEqual(result.errors, []);
  return result.byId;
}

const names = (result) => result.matches.map((m) => m.row.name);

test("eligible pool is the verified/partial rows; unresolved rows are never recommended", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const eligible = eligibleRows(rows, byId);
  assert.equal(eligible.length, 8);
  assert.equal(eligible.some((r) => r.name === "Foxtrot"), false);
  const result = recommend(none(), rows, byId);
  assert.equal(result.matches.some((m) => m.row.name === "Foxtrot"), false);
});

test("real public data: eligibility count is derived from metadata for exactly the 91 CSV rows", () => {
  const { byId, ok } = validateWhiskeyMetadata(publicMetadata, publicRows);
  assert.equal(ok, true);
  const eligible = eligibleRows(publicRows, byId);
  assert.equal(eligible.length, publicMetadata.rows.filter((r) => r.status !== "unresolved").length);
  const csvIds = new Set(publicRows.map((r) => r.sourceId));
  for (const row of eligible) assert.ok(csvIds.has(row.sourceId));
  const options = buildPickerOptions(publicRows, byId);
  for (const group of ["flavor", "budget", "age", "region"]) assert.ok(options[group].length >= 1);
  const prices = new Set(publicRows.map((r) => r.price));
  for (const option of options.budget.slice(1)) assert.ok(prices.has(Number(option.value)));
});

test("every input offers No preference first; region also offers Anywhere; no intensity input", () => {
  const { rows, metas } = fixture();
  const options = buildPickerOptions(rows, build(metas, rows));
  assert.deepEqual(Object.keys(options).sort(), ["age", "budget", "flavor", "region"]);
  for (const key of Object.keys(options)) {
    assert.equal(options[key][0].value, NO_PREFERENCE, key);
    assert.equal(options[key][0].label, "No preference", key);
  }
  assert.ok(options.region.some((o) => o.value === ANYWHERE && o.label === "Anywhere"));
  assert.equal(JSON.stringify(options).match(/intensity|adventur/i), null);
});

test("options are derived from eligible menu data and change when the menu changes", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const options = buildPickerOptions(rows, byId);
  assert.deepEqual(
    options.flavor.slice(1).map((o) => o.value),
    ["sweet", "fruity", "smoky", "oaky"],
  );
  assert.equal(options.flavor.some((o) => o.value === "spicy"), false);
  assert.deepEqual(options.age.slice(1).map((o) => o.value), ["6", "12", "18"]);
  assert.deepEqual(options.age.slice(1).map((o) => o.label), ["6 years or older", "12 years or older", "18 years or older"]);
  assert.deepEqual(options.region.filter((o) => ![NO_PREFERENCE, ANYWHERE].includes(o.value)).map((o) => o.value).sort(), [
    "Ireland",
    "Scotland",
    "United States",
  ]);

  const mutatedMetas = clone(metas);
  mutatedMetas[1].flavor_tags = ["spicy"];
  mutatedMetas[1].region_group = "Japan";
  mutatedMetas[1].age_years = 21;
  const mutated = buildPickerOptions(rows, build(mutatedMetas, rows));
  assert.ok(mutated.flavor.some((o) => o.value === "spicy"));
  assert.ok(mutated.region.some((o) => o.value === "Japan"));
  assert.ok(mutated.age.some((o) => o.value === "21"));
});

test("budget options are actual eligible menu prices at ~25/50/75 percentile plus the maximum", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const options = buildPickerOptions(rows, byId);
  const eligiblePrices = [...new Set(eligibleRows(rows, byId).map((r) => r.price))].sort((a, b) => a - b);
  const values = options.budget.slice(1).map((o) => Number(o.value));
  assert.equal(values.at(-1), Math.max(...eligiblePrices));
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(new Set(values).size, values.length);
  for (const v of values) assert.ok(eligiblePrices.includes(v));
  assert.ok(options.budget.slice(1).every((o) => o.label === `Up to $${o.value}`));
  assert.ok(values.length >= 2 && values.length <= 4);
  // unresolved $9 is not an eligible price
  assert.equal(values.includes(9), false);
});

test("strict budget: price equal to X is allowed, X+1 is not, and it never rounds up", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const at = recommend({ ...none(), budget: "15" }, rows, byId);
  assert.ok(names(at).includes("Bravo"));
  assert.ok(names(at).includes("Charlie"));
  const below = recommend({ ...none(), budget: "14" }, rows, byId);
  assert.equal(names(below).includes("Bravo"), false);
  assert.ok(below.matches.every((m) => m.row.price <= 14));
  const all = recommend({ ...none(), budget: "14", flavor: "fruity" }, rows, byId);
  assert.equal(all.state, "no-exact-matches");
});

test("unknown, NAS, range, blend, varies and menu-label ages never match an age choice", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const matched = new Set();
  for (const age of ["6", "12", "18", "1"]) {
    const result = recommend({ ...none(), age }, rows, byId);
    for (const m of result.matches) {
      assert.ok(verifiedAge(byId[m.row.sourceId]) >= Number(age));
      matched.add(m.row.name);
    }
  }
  for (const bad of ["Charlie", "Echo", "Hotel", "India", "Foxtrot"]) assert.equal(matched.has(bad), false, bad);
  const wide = recommend({ ...none(), age: "1" }, rows, byId);
  assert.deepEqual(names(wide), ["Alpha", "Bravo", "Delta"]);
});

test("barrel finish is never treated as age", () => {
  const rows = [makeRow(1, "Port Finish", "Whiskey", 10)];
  const meta = makeMeta(rows[0], {
    description: "Finished 12 years in port casks.",
    bottle_version: "Port Cask Finish",
    age_status: "nas",
    age_years: null,
  });
  const byId = build([meta], rows);
  assert.equal(recommend({ ...none(), age: "12" }, rows, byId).state, "no-exact-matches");
  assert.deepEqual(buildPickerOptions(rows, byId).age, [{ value: NO_PREFERENCE, label: "No preference" }]);
});

test("a bottling location alone never produces a Region picker match (Rittenhouse)", () => {
  const rittenhouse = publicMetadata.rows.find((m) => m.menu_name === "Rittenhouse");
  assert.equal(rittenhouse.region, null);
  assert.equal(rittenhouse.region_group, null);
  assert.doesNotMatch(rittenhouse.description, /Bardstown|Kentucky|KY|United States/);
  const v = validateWhiskeyMetadata(publicMetadata, publicRows);
  assert.ok(v.ok);
  const regionOptions = buildPickerOptions(publicRows, v.byId).region.map((o) => o.value);
  assert.ok(!regionOptions.includes("Kentucky"));
  for (const region of regionOptions.filter((r) => ![NO_PREFERENCE, ANYWHERE].includes(r))) {
    const r = recommend({ flavor: NO_PREFERENCE, budget: NO_PREFERENCE, age: NO_PREFERENCE, region }, publicRows, v.byId);
    assert.ok(!r.matches.some((m) => m.row.name === "Rittenhouse"), region);
  }
});

test("null region never matches a specific region; no-flavor rows never match a specific flavor", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  for (const region of ["Scotland", "United States", "Ireland"]) {
    const r = recommend({ ...none(), region }, rows, byId);
    assert.ok(!names(r).includes("Golf"));
    assert.ok(r.matches.every((m) => byId[m.row.sourceId].region_group === region));
  }
  for (const flavor of ["sweet", "fruity", "smoky", "oaky"]) {
    const r = recommend({ ...none(), flavor }, rows, byId);
    assert.ok(!names(r).includes("Golf"));
  }
});

test("Anywhere behaves identically to No preference", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const a = recommend({ ...none(), region: ANYWHERE, flavor: "sweet" }, rows, byId);
  const b = recommend({ ...none(), region: NO_PREFERENCE, flavor: "sweet" }, rows, byId);
  assert.deepEqual(a, b);
});

test("flavor and region are independent: options never shift and combined filter equals the intersection", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const options = buildPickerOptions(rows, byId);
  const eligible = eligibleRows(rows, byId);
  for (const flavor of ["sweet", "fruity", "smoky", "oaky"]) {
    for (const region of ["Scotland", "United States", "Ireland"]) {
      const expected = eligible
        .filter((r) => byId[r.sourceId].flavor_tags.includes(flavor) && byId[r.sourceId].region_group === region)
        .map((r) => r.sourceId)
        .sort((x, y) => x - y);
      const result = recommend({ ...none(), flavor, region }, rows, byId);
      const got = result.matches.map((m) => m.row.sourceId);
      // full intersection is <=3 here, so it must equal the expected set
      assert.deepEqual([...got].sort((x, y) => x - y), expected, `${flavor}+${region}`);
    }
  }
  // choosing a flavor does not alter the region option list (options come from data only)
  assert.deepEqual(buildPickerOptions(rows, byId).region, options.region);
});

test("results are deterministic, at most 3, ordered verified > partial, price, name, id", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const result = recommend(none(), rows, byId);
  assert.equal(result.state, "results");
  assert.equal(result.matches.length, 3);
  assert.deepEqual(names(result), ["Alpha", "Bravo", "Charlie"]);
  // partial (Golf $12) sorts after verified Alpha $10..Charlie $15 despite lower price than 15
  const widePartial = recommend({ ...none(), budget: "12" }, rows, byId);
  assert.deepEqual(names(widePartial), ["Alpha", "Golf"]);
  assert.deepEqual(recommend(none(), rows, byId), recommend(none(), rows, byId));
  const reversed = recommend(none(), [...rows].reverse(), byId);
  assert.deepEqual(names(reversed), names(result));
  for (const m of result.matches) {
    assert.equal("score" in m, false);
    assert.equal("fit" in m, false);
    assert.equal("rating" in m, false);
  }
});

test("price ties order by name (case/accent-insensitive) then source id", () => {
  const rows = [makeRow(5, "beta", "Rye", 10), makeRow(2, "Alpha", "Rye", 10), makeRow(9, "Beta", "Rye", 10), makeRow(3, "alpha", "Rye", 10)];
  const metas = rows.map((r) => makeMeta(r));
  const byId = build(metas, rows);
  const result = recommend(none(), rows, byId);
  assert.deepEqual(result.matches.map((m) => m.row.sourceId), [2, 3, 5]);
});

test("reasons come only from verified facts and menu prices", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const result = recommend({ flavor: "sweet", budget: "15", age: "12", region: "Scotland" }, rows, byId);
  assert.equal(result.state, "results");
  const bravo = result.matches.find((m) => m.row.name === "Bravo");
  assert.ok(bravo.reasons.includes("Flavor: sweet (from producer tasting notes)"));
  assert.ok(bravo.reasons.includes("$15 on the menu, within your $15 budget"));
  assert.ok(bravo.reasons.includes("Aged 12 years (producer-stated)"));
  assert.ok(bravo.reasons.includes("Region: Scotland"));
  const text = JSON.stringify(result.matches.map((m) => m.reasons));
  assert.doesNotMatch(text, /serving|pour|per glass|rating|critic|best|top|award/i);
});

function bruteCount(prefs, rows, byId) {
  const active = (v) => ![undefined, null, "", NO_PREFERENCE, ANYWHERE].includes(v);
  return rows.filter((row) => {
    const meta = byId[row.sourceId];
    if (meta.status === "unresolved") return false;
    if (active(prefs.flavor) && !meta.flavor_tags.includes(prefs.flavor)) return false;
    if (active(prefs.budget) && !(row.price <= Number(prefs.budget))) return false;
    if (active(prefs.age)) {
      const age = verifiedAge(meta);
      if (age === null || age < Number(prefs.age)) return false;
    }
    if (active(prefs.region) && meta.region_group !== prefs.region) return false;
    return true;
  }).length;
}

test("no exact match: explicit state, single-relaxation suggestions, never auto-relaxed", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const prefs = { flavor: "smoky", budget: "15", age: "12", region: "Scotland" };
  const snapshot = clone(prefs);
  const result = recommend(prefs, rows, byId);
  assert.equal(result.state, "no-exact-matches");
  assert.deepEqual(result.matches, []);
  assert.deepEqual(prefs, snapshot, "prefs are never mutated");
  assert.deepEqual(recommend(prefs, rows, byId).matches, [], "still empty on repeat");
  assert.equal(bruteCount(prefs, rows, byId), 0);

  assert.deepEqual(result.suggestions.map((s) => s.field), ["flavor", "age"]);
  for (const s of result.suggestions) {
    assert.ok(s.label);
    const changed = Object.keys(prefs).filter((k) => s.nextPrefs[k] !== prefs[k]);
    assert.deepEqual(changed, [s.field], "exactly one field is relaxed");
    assert.ok([NO_PREFERENCE, ANYWHERE].includes(s.nextPrefs[s.field]));
    assert.equal(s.matchCount, bruteCount(s.nextPrefs, rows, byId));
    assert.ok(s.matchCount >= 1);
  }
  assert.equal(result.suggestions[0].matchCount, 1);
  assert.equal(result.suggestions[1].matchCount, 1);
});

test("budget suggestion is a raise to the smallest derived option, with correct count and label", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const prefs = { flavor: "fruity", budget: "10", age: "18", region: "United States" };
  const result = recommend(prefs, rows, byId);
  assert.equal(result.state, "no-exact-matches");
  assert.deepEqual(result.suggestions.map((s) => s.field), ["budget"]);
  const [budget] = result.suggestions;
  assert.deepEqual(budget.nextPrefs, { ...prefs, budget: "20" });
  assert.equal(budget.matchCount, 1);
  assert.match(budget.label, /Raise budget to \$20 \(1 match\)/);
  assert.equal(prefs.budget, "10");
});

test("budget suggestion uses the smallest derived option that yields a match", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const prefs = { flavor: "fruity", budget: "10", age: NO_PREFERENCE, region: NO_PREFERENCE };
  const result = recommend(prefs, rows, byId);
  assert.equal(result.state, "no-exact-matches");
  const options = buildPickerOptions(rows, byId).budget.slice(1).map((o) => Number(o.value));
  const budget = result.suggestions.find((s) => s.field === "budget");
  const expected = options.find((x) => recommend({ ...prefs, budget: String(x) }, rows, byId).matches.length > 0);
  assert.equal(Number(budget.nextPrefs.budget), expected);
});

test("unavailable state when metadata is missing or the eligible pool is empty", () => {
  const { rows } = fixture();
  assert.equal(recommend(none(), rows, null).state, "unavailable");
  assert.equal(recommend(none(), rows, {}).state, "unavailable");
  const allUnresolved = [makeRow(1, "A", "Rye", 10)];
  const byId = build([unresolvedMeta(allUnresolved[0])], allUnresolved);
  assert.equal(recommend(none(), allUnresolved, byId).state, "unavailable");
  const options = buildPickerOptions(allUnresolved, byId);
  assert.equal(options.flavor.length, 1);
});

test("recommender is pure: inputs are not mutated", () => {
  const { rows, metas } = fixture();
  const byId = build(metas, rows);
  const before = JSON.stringify({ rows, byId });
  recommend({ ...none(), flavor: "sweet" }, rows, byId);
  buildPickerOptions(rows, byId);
  assert.equal(JSON.stringify({ rows, byId }), before);
});

test("real data: any single flavor/region/age/budget choice yields only in-menu verified facts", () => {
  const { byId } = validateWhiskeyMetadata(publicMetadata, publicRows);
  const options = buildPickerOptions(publicRows, byId);
  for (const f of options.flavor.slice(1)) {
    const r = recommend({ ...none(), flavor: f.value }, publicRows, byId);
    assert.equal(r.state, "results");
    for (const m of r.matches) {
      assert.ok(byId[m.row.sourceId].flavor_tags.includes(f.value));
      assert.notEqual(byId[m.row.sourceId].status, "unresolved");
    }
  }
  for (const a of options.age.slice(1)) {
    const r = recommend({ ...none(), age: a.value }, publicRows, byId);
    assert.equal(r.state, "results");
    for (const m of r.matches) assert.ok(verifiedAge(byId[m.row.sourceId]) >= Number(a.value));
  }
  assert.equal(options.age.slice(1).length > 0, true);
});

test("a producer minimum satisfies an 'at least' age filter but is always reported as a minimum", () => {
  const rows = [
    makeRow(1, "Fixed Twelve", "Whiskey", 20),
    makeRow(2, "Minimum Twelve", "Whiskey", 21),
    makeRow(3, "Range Twelve To Fifteen", "Whiskey", 22),
    makeRow(4, "Minimum Four", "Whiskey", 23),
  ];
  const producer = "producer_page";
  const metas = [
    makeMeta(rows[0], { age_status: "fixed", age_years: 12, age_basis: producer }),
    makeMeta(rows[1], { age_status: "minimum", age_years: 12, age_basis: producer }),
    makeMeta(rows[2], { age_status: "range", age_years: null, age_min: 12, age_max: 15, age_basis: producer }),
    makeMeta(rows[3], { age_status: "minimum", age_years: 4, age_basis: producer }),
  ];
  const byId = build(metas, rows);
  const options = buildPickerOptions(rows, byId);
  assert.deepEqual(options.age.slice(1).map((o) => o.value), ["4", "12"]);

  const result = recommend({ ...none(), age: "12" }, rows, byId);
  assert.equal(result.state, "results");
  assert.deepEqual(names(result), ["Fixed Twelve", "Minimum Twelve"]);
  const reasons = Object.fromEntries(result.matches.map((m) => [m.row.name, m.reasons]));
  assert.ok(reasons["Fixed Twelve"].includes("Aged 12 years (producer-stated)"));
  assert.ok(reasons["Minimum Twelve"].includes("At least 12 years (producer-stated minimum)"));
  assert.equal(reasons["Minimum Twelve"].some((r) => /^Aged 12 years/.test(r)), false);
  // the range never satisfies a specific age, even though its lower bound is 12
  assert.equal(names(result).includes("Range Twelve To Fifteen"), false);

  const four = recommend({ ...none(), age: "4" }, rows, byId);
  const minimumFour = four.matches.find((m) => m.row.name === "Minimum Four");
  assert.ok(minimumFour.reasons.includes("At least 4 years (producer-stated minimum)"));
});

test("real data: no recommendation ever presents a minimum or range as an exact age", () => {
  const { byId } = validateWhiskeyMetadata(publicMetadata, publicRows);
  const options = buildPickerOptions(publicRows, byId);
  for (const option of options.age.slice(1)) {
    const result = recommend({ ...none(), age: option.value }, publicRows, byId);
    for (const match of result.matches) {
      const meta = byId[match.row.sourceId];
      const ageReason = match.reasons.find((r) => /year/.test(r));
      if (meta.age_status === "minimum") assert.match(ageReason, /^At least \d+ years \(producer-stated minimum\)$/);
      if (meta.age_status === "fixed") assert.match(ageReason, /^Aged .+ \(producer-stated\)$/);
      assert.ok(["fixed", "minimum"].includes(meta.age_status), meta.menu_name);
    }
  }
});

test("recommender source has no dependency on Wine modules and no score exposure", async () => {
  const { read } = await import("./helpers/whiskey-fixtures.mjs");
  const src = read("js/whiskey-recommend.js");
  assert.doesNotMatch(src, /from\s+["'][^"']*(recommend|render|app|drawer)\.js["']/);
  assert.doesNotMatch(src, /\bdocument\b|\bwindow\b/);
  assert.doesNotMatch(src, /intensity|adventur/i);
});
