import assert from "node:assert/strict";
import test from "node:test";

import { createFakeDocument, keydown } from "./helpers/fake-dom.mjs";
import { escapeHtml } from "../js/utils.js";
import { validateWhiskeyMetadata } from "../js/whiskey-metadata.js";
import { ageLineFor, buildDetailModel, openDetail, renderDetailHtml } from "../js/whiskey-detail.js";
import { openPicker, renderPickerFormHtml, renderResultsHtml } from "../js/whiskey-picker.js";
import { buildPicks, renderPicksHtml } from "../js/whiskey-picks.js";
import { defaultCategory, renderMenuHtml, renderTabsHtml, sortRowsAz } from "../js/whiskey-page.js";
import { buildPickerOptions, recommend } from "../js/whiskey-recommend.js";
import {
  clone,
  makeMeta,
  makeRow,
  publicMetadata,
  publicRows,
  read,
  unresolvedMeta,
} from "./helpers/whiskey-fixtures.mjs";

const real = validateWhiskeyMetadata(publicMetadata, publicRows);
const textOf = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

function cssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|[},\\s])${escaped}\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(match, `CSS rule for ${selector} must exist`);
  return match[1];
}

function setup() {
  const doc = createFakeDocument();
  const opener = doc.createElement("button");
  opener.setAttribute("type", "button");
  opener.textContent = "Opener";
  doc.body.appendChild(opener);
  opener.focus();
  return { doc, opener };
}
const dialogs = (doc) => doc.querySelectorAll('[role="dialog"]');

function syntheticSet() {
  const rows = [
    makeRow(1, "Alpha", "Bourbon", 10),
    makeRow(2, "Bravo", "Bourbon", 15),
    makeRow(3, "Delta", "Rye", 20),
    makeRow(4, "Hotel", "Rye", 30),
    makeRow(5, "Mystery", "Rye", 11),
  ];
  const metas = [
    makeMeta(rows[0], { flavor_tags: ["sweet"], region_group: "United States", age_status: "fixed", age_years: 12 }),
    makeMeta(rows[1], { flavor_tags: ["sweet", "fruity"], region_group: "Scotland", age_status: "fixed", age_years: 12 }),
    makeMeta(rows[2], { flavor_tags: ["fruity"], region_group: "United States", age_status: "fixed", age_years: 18 }),
    makeMeta(rows[3], { flavor_tags: ["sweet"], region_group: "Scotland" }),
    unresolvedMeta(rows[4]),
  ];
  const { byId, ok, errors } = validateWhiskeyMetadata(
    { schema_version: 1, verified_on: "x", flavor_vocabulary: ["sweet", "fruity", "spicy", "smoky", "oaky"], rows: metas },
    rows,
  );
  assert.deepEqual(errors, []);
  assert.ok(ok);
  return { rows, byId };
}

// ---------------------------------------------------------------- detail view

test("every one of the 91 public rows builds and renders a detail view", () => {
  for (const row of publicRows) {
    const model = buildDetailModel(row, real.byId[row.sourceId]);
    const html = renderDetailHtml(model, "t");
    assert.ok(html.includes(escapeHtml(row.name)), `${row.sourceId} name`);
    assert.ok(html.includes(`$${row.price}`), `${row.sourceId} price`);
    assert.ok(html.includes(row.category));
    assert.match(textOf(html), /Region|Exact bottle not verified/);
    assert.doesNotMatch(html, /Critic score/);
  }
});

test("detail view states honest unknowns and never invents claims for unresolved rows", () => {
  const unresolved = publicRows.filter((r) => real.byId[r.sourceId].status === "unresolved");
  assert.ok(unresolved.length > 0);
  for (const row of unresolved) {
    const meta = real.byId[row.sourceId];
    const text = textOf(renderDetailHtml(buildDetailModel(row, meta), "t"));
    assert.match(text, /Exact bottle not verified/);
    assert.ok(text.includes(escapeHtml(meta.description)), `${row.name} shows its family-level description`);
    assert.match(text, /The exact expression is not verified\./);
    if (meta.ambiguity_note) assert.ok(!text.includes(escapeHtml(meta.ambiguity_note)), `${row.name} hides internal ambiguity_note`);
    assert.doesNotMatch(text, /HTTP|connection|redirect|retailer|domain[- ]for[- ]sale|blocked/i, `${row.name} leaks process words`);
    assert.doesNotMatch(text, /Flavor:|Aged \d|Menu lists|from producer tasting notes|Source:/);
  }
});

test("detail age line follows the verified-age rules", () => {
  const byName = (n) => publicRows.find((r) => r.name === n);
  const line = (n) => textOf(renderDetailHtml(buildDetailModel(byName(n), real.byId[byName(n).sourceId]), "t"));
  assert.match(line("Rittenhouse"), /Aged 4 years \(producer-stated\)/);
  assert.match(line("Rittenhouse"), /Region not verified/);
  assert.doesNotMatch(line("Rittenhouse"), /Kentucky|Bardstown|United States/);
  assert.match(line("Rittenhouse"), /Flavor: .*\(from producer tasting notes\)/);
  assert.match(line("Rittenhouse"), /Verified on 2026-10-06/);
  assert.match(line("Rittenhouse"), /Source:/);
  // every menu-label-only age in the real data sits on an unresolved row: no age claim is shown
  assert.doesNotMatch(line("Templeton 4 yr"), /Aged 4 years|Menu lists/);
  const labelOnly = makeMeta(makeRow(1, "Label Only 9 yr", "Rye", 10), {
    age_status: "fixed",
    age_years: 9,
    age_basis: "menu_label",
  });
  assert.equal(ageLineFor(labelOnly), "Menu lists 9 years (not verified by a producer page)");
  assert.match(
    textOf(renderDetailHtml(buildDetailModel(makeRow(1, "Label Only 9 yr", "Rye", 10), labelOnly), "t")),
    /Menu lists 9 years \(not verified by a producer page\)/,
  );
  assert.equal(ageLineFor({ ...labelOnly, age_basis: "producer_page" }), "Aged 9 years (producer-stated)");
  assert.match(line("Four Roses Small Batch"), /Range of 6 to 7 years \(producer-stated range, not a single age\)/);
  assert.doesNotMatch(line("Four Roses Small Batch"), /Aged \d/);
  assert.match(line("Tullamore Dew 12 yr"), /Range of 12 to 15 years/);
  assert.doesNotMatch(line("Tullamore Dew 12 yr"), /Aged 12/);
  assert.match(line("Pikesville"), /Region not verified/);
  assert.match(line("Pikesville"), /Flavor not verified/);
});

test("minimum ages are always labelled a minimum and never read as an exact age", () => {
  const byName = (n) => publicRows.find((r) => r.name === n);
  const line = (n) => textOf(renderDetailHtml(buildDetailModel(byName(n), real.byId[byName(n).sourceId]), "t"));
  for (const [name, years] of [
    ["Pendleton 1910", 12],
    ["Lagavulin 16 yr", 16],
    ["Talisker 10 yr", 10],
    ["Proper Twelve", 4],
  ]) {
    assert.match(line(name), new RegExp(`Aged a minimum of ${years} years \\(producer-stated minimum, not an exact age\\)`), name);
    assert.doesNotMatch(line(name), new RegExp(`Aged ${years} years \\(producer-stated\\)`), name);
  }
  assert.match(line("Rittenhouse"), /Aged 4 years \(producer-stated\)/);
  const minimum = makeMeta(makeRow(1, "Min", "Rye", 10), { age_status: "minimum", age_years: 8, age_basis: "producer_page" });
  assert.equal(ageLineFor(minimum), "Aged a minimum of 8 years (producer-stated minimum, not an exact age)");
  assert.equal(ageLineFor({ ...minimum, age_basis: "menu_label" }), "Not verified");
  const timed = makeMeta(makeRow(1, "Timed", "Rye", 10), {
    age_status: "fixed",
    age_years: 7,
    age_text: "7 years, 2 months, 4 days",
    age_basis: "producer_page",
  });
  assert.equal(ageLineFor(timed), "Aged 7 years, 2 months, 4 days (producer-stated)");
});

test("source link is rel=noopener noreferrer and present only with a product url", () => {
  const withUrl = publicRows.find((r) => real.byId[r.sourceId].product_source_url);
  const html = renderDetailHtml(buildDetailModel(withUrl, real.byId[withUrl.sourceId]), "t");
  assert.match(html, /<a [^>]*href="https:\/\/[^"]+"[^>]*rel="noopener noreferrer"/);
  const without = publicRows.find((r) => !real.byId[r.sourceId].product_source_url);
  const htmlNo = renderDetailHtml(buildDetailModel(without, real.byId[without.sourceId]), "t");
  assert.doesNotMatch(htmlNo, /<a /);
});

test("detail degrades to a 'Details unavailable' dialog when metadata is missing", () => {
  const model = buildDetailModel(publicRows[0], undefined);
  const text = textOf(renderDetailHtml(model, "t"));
  assert.match(text, /Details unavailable/);
  assert.ok(text.includes(publicRows[0].name));
  assert.doesNotMatch(text, /Flavor:|Region:|Aged/);
  const { doc, opener } = setup();
  openDetail(doc, publicRows[0], undefined, { opener });
  assert.equal(dialogs(doc).length, 1);
  assert.match(dialogs(doc)[0].textContent, /Details unavailable/);
});

test("Critic block only for valid critic evidence, separate from recommender text", () => {
  const row = makeRow(1, "Alpha", "Rye", 10);
  const critic = { critic: "Example Critic", score: 93, source_url: "https://example.com/r", verified_on: "2026-10-05" };
  const good = textOf(renderDetailHtml(buildDetailModel(row, makeMeta(row, { critic })), "t"));
  assert.match(good, /Critic score/);
  assert.match(good, /Example Critic score 93/);
  assert.match(good, /verified 2026-10-05/);
  const html = renderDetailHtml(buildDetailModel(row, makeMeta(row, { critic })), "t");
  assert.match(html, /<a [^>]*href="https:\/\/example\.com\/r"/);
  const bad = renderDetailHtml(buildDetailModel(row, makeMeta(row, { critic: { ...critic, source_url: "http://x.test" } })), "t");
  assert.doesNotMatch(bad, /Critic score/);
});

test("detail dialog: aria, focus enter/restore, Escape, backdrop, close, scroll lock, single dialog", () => {
  const { doc, opener } = setup();
  const row = publicRows.find((r) => real.byId[r.sourceId].product_source_url);
  const meta = real.byId[row.sourceId];

  for (let i = 0; i < 4; i += 1) {
    doc.body.style.overflow = "";
    openDetail(doc, row, meta, { opener });
    assert.equal(dialogs(doc).length, 1);
    const dialog = dialogs(doc)[0];
    assert.equal(dialog.getAttribute("aria-modal"), "true");
    const labelId = dialog.getAttribute("aria-labelledby");
    assert.ok(labelId);
    assert.ok(dialog.querySelector(`#${labelId}`).textContent.includes(row.name));
    assert.ok(dialog.contains(doc.activeElement), "focus moves into the dialog");
    assert.equal(doc.body.style.overflow, "hidden");
    assert.ok(dialog.querySelector("[data-modal-close]"));

    // clicking inside does not close
    dialog.click();
    assert.equal(dialogs(doc).length, 1);

    if (i === 0) {
      keydown(doc, "Escape");
    } else if (i === 1) {
      doc.querySelector("[data-modal-backdrop]").click();
    } else if (i === 2) {
      dialog.querySelector("[data-modal-close]").click();
    } else {
      openDetail(doc, row, meta, { opener }); // opening again keeps exactly one
      assert.equal(dialogs(doc).length, 1);
      keydown(doc, "Escape");
    }
    assert.equal(dialogs(doc).length, 0);
    assert.equal(doc.activeElement, opener, "focus returns to opener");
    assert.equal(doc.body.style.overflow, "");
    assert.equal(doc.listeners.get("keydown")?.size ?? 0, 0, "no leaked key listeners");
  }
});

test("detail dialog traps Tab inside (forward and backward), including a close-only dialog", () => {
  const { doc, opener } = setup();
  const withLink = publicRows.find((r) => real.byId[r.sourceId].product_source_url);
  openDetail(doc, withLink, real.byId[withLink.sourceId], { opener });
  let dialog = dialogs(doc)[0];
  const close = dialog.querySelector("[data-modal-close]");
  const link = dialog.querySelector("a[href]");
  assert.ok(close && link);
  link.focus();
  let event = keydown(doc, "Tab");
  assert.equal(event.defaultPrevented, true);
  assert.equal(doc.activeElement, close);
  event = keydown(doc, "Tab", { shiftKey: true });
  assert.equal(event.defaultPrevented, true);
  assert.equal(doc.activeElement, link);
  keydown(doc, "Escape");

  const unresolved = publicRows.find((r) => real.byId[r.sourceId].status === "unresolved");
  openDetail(doc, unresolved, real.byId[unresolved.sourceId], { opener });
  dialog = dialogs(doc)[0];
  assert.equal(dialogs(doc).length, 1, "unresolved rows still open a dialog");
  event = keydown(doc, "Tab");
  assert.equal(event.defaultPrevented, true);
  assert.ok(dialog.contains(doc.activeElement));
});

test("detail and close targets are real buttons (type=button)", () => {
  const { doc, opener } = setup();
  openDetail(doc, publicRows[0], real.byId[publicRows[0].sourceId], { opener });
  const close = doc.querySelector("[data-modal-close]");
  assert.equal(close.tagName, "BUTTON");
  assert.equal(close.getAttribute("type"), "button");
});

// ------------------------------------------------------------------- picker

test("picker form: four fieldsets with legends, radio groups, No preference first/default", () => {
  const { doc, opener } = setup();
  openPicker(doc, { rows: publicRows, metaById: real.byId, available: true, opener });
  assert.equal(dialogs(doc).length, 1);
  const dialog = dialogs(doc)[0];
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.ok(dialog.querySelector(`#${dialog.getAttribute("aria-labelledby")}`));
  assert.ok(dialog.contains(doc.activeElement));
  const legends = dialog.querySelectorAll("fieldset legend").map((l) => l.textContent.trim());
  assert.deepEqual(legends, ["Flavor", "Budget", "Age (years, optional)", "Region (optional)"]);
  for (const name of ["flavor", "budget", "age", "region"]) {
    const radios = dialog.querySelectorAll(`input[name="${name}"]`);
    assert.ok(radios.length >= 2, name);
    assert.ok(radios.every((r) => r.getAttribute("type") === "radio"));
    assert.equal(radios[0].value, "none");
    assert.equal(radios[0].checked, true);
    assert.equal(radios.filter((r) => r.checked).length, 1);
    assert.match(radios[0].parentNode.textContent, /No preference/);
  }
  assert.match(dialog.querySelector('input[name="region"][value="anywhere"]').parentNode.textContent, /Anywhere/);
  assert.doesNotMatch(dialog.textContent, /intensity|adventur/i);
  const note = dialog.textContent.match(/(\d+) of (\d+) bottles/);
  assert.ok(note, "derived verified-bottle count is shown");
  assert.equal(Number(note[2]), 91);
  assert.equal(
    Number(note[1]),
    publicMetadata.rows.filter((r) => r.status !== "unresolved").length,
  );
  assert.ok(dialog.querySelector('[data-picker-live][role="status"][aria-live="polite"]'));
});

test("picker shows an explicit unavailable state when metadata is not usable", () => {
  const { doc, opener } = setup();
  openPicker(doc, { rows: publicRows, metaById: {}, available: false, opener });
  const dialog = dialogs(doc)[0];
  assert.match(dialog.textContent, /unavailable/i);
  assert.equal(dialog.querySelector("form"), null);
  assert.ok(dialog.querySelector("[data-modal-close]"));
});

test("show matches announces results, <=3 cards, repeated presses never duplicate or change results", () => {
  const { doc, opener } = setup();
  const { rows, byId } = syntheticSet();
  openPicker(doc, { rows, metaById: byId, available: true, opener });
  const dialog = () => dialogs(doc)[0];
  dialog().querySelector('input[name="flavor"][value="sweet"]').click();
  dialog().querySelector("[data-picker-submit]").click();
  const live = dialog().querySelector("[data-picker-live]");
  assert.match(live.textContent, /^\s*3 matches/);
  const cards1 = dialog().querySelectorAll("[data-result-card]");
  assert.equal(cards1.length, 3);
  const snapshot = dialog().querySelector("[data-picker-results]").innerHTML;
  for (let i = 0; i < 3; i += 1) dialog().querySelector("[data-picker-submit]").click();
  assert.equal(dialogs(doc).length, 1);
  assert.equal(dialog().querySelectorAll("[data-result-card]").length, 3);
  assert.equal(dialog().querySelector("[data-picker-results]").innerHTML, snapshot);
  assert.equal(dialog().querySelectorAll("form").length, 1);
  assert.deepEqual(
    dialog().querySelectorAll("[data-result-card] .wh-card-name").map((n) => n.textContent),
    ["Alpha", "Bravo", "Hotel"],
  );
  assert.match(dialog().querySelector("[data-result-card]").textContent, /\$10/);
  assert.doesNotMatch(dialog().textContent, /critic|rating|serving|pour|per glass|best|award/i);
});

test("no exact match: explicit text, suggestion buttons change only the form when pressed", () => {
  const { doc, opener } = setup();
  const { rows, byId } = syntheticSet();
  openPicker(doc, { rows, metaById: byId, available: true, opener });
  const dialog = () => dialogs(doc)[0];
  dialog().querySelector('input[name="flavor"][value="fruity"]').click();
  dialog().querySelector('input[name="budget"][value="10"]').click();
  dialog().querySelector("[data-picker-submit]").click();
  assert.match(dialog().querySelector("[data-picker-live]").textContent, /No exact matches/);
  assert.match(dialog().querySelector("[data-picker-results]").textContent, /No exact matches/);
  assert.equal(dialog().querySelectorAll("[data-result-card]").length, 0);
  const buttons = dialog().querySelectorAll("[data-suggestion]");
  const labels = buttons.map((b) => b.textContent.trim());
  assert.deepEqual(labels, ["Remove flavor filter (1 match)", "Raise budget to $15 (1 match)"]);
  // nothing auto-applied
  assert.equal(dialog().querySelector('input[name="flavor"]:checked').value, "fruity");
  assert.equal(dialog().querySelector('input[name="budget"]:checked').value, "10");
  assert.equal(dialog().querySelectorAll("[data-result-card]").length, 0);

  buttons[1].click();
  assert.equal(dialog().querySelector('input[name="budget"]:checked').value, "15");
  assert.equal(dialog().querySelector('input[name="flavor"]:checked').value, "fruity");
  assert.equal(dialog().querySelector("[data-picker-form-view]").hidden, false);
  assert.equal(dialog().querySelectorAll("[data-result-card]").length, 0, "pressing a suggestion does not show results");
  dialog().querySelector("[data-picker-submit]").click();
  assert.match(dialog().querySelector("[data-picker-live]").textContent, /^\s*1 match$/);
});

test("Back to choices keeps selections; Start over resets everything", () => {
  const { doc, opener } = setup();
  const { rows, byId } = syntheticSet();
  openPicker(doc, { rows, metaById: byId, available: true, opener });
  const dialog = () => dialogs(doc)[0];
  dialog().querySelector('input[name="flavor"][value="sweet"]').click();
  dialog().querySelector('input[name="region"][value="Scotland"]').click();
  dialog().querySelector("[data-picker-submit]").click();
  assert.equal(dialog().querySelector("[data-picker-results-view]").hidden, false);
  dialog().querySelector("[data-picker-back]").click();
  assert.equal(dialog().querySelector("[data-picker-form-view]").hidden, false);
  assert.equal(dialog().querySelector("[data-picker-results-view]").hidden, true);
  assert.equal(dialog().querySelector('input[name="flavor"]:checked').value, "sweet");
  assert.equal(dialog().querySelector('input[name="region"]:checked').value, "Scotland");
  assert.ok(dialog().contains(doc.activeElement));

  dialog().querySelector("[data-picker-reset]").click();
  for (const name of ["flavor", "budget", "age", "region"]) {
    assert.equal(dialog().querySelector(`input[name="${name}"]:checked`).value, "none");
  }
  assert.equal(dialog().querySelectorAll("[data-result-card]").length, 0);
  assert.equal(dialog().querySelector("[data-picker-live]").textContent.trim(), "");
  assert.equal(dialogs(doc).length, 1);
});

test("picker: Escape closes and restores focus; opening Details returns to results with focus", () => {
  const { doc, opener } = setup();
  const { rows, byId } = syntheticSet();
  openPicker(doc, { rows, metaById: byId, available: true, opener });
  doc.querySelector("[data-picker-submit]").click();
  const detailsButton = doc.querySelector('[data-result-card] [data-detail-id="2"]');
  assert.ok(detailsButton);
  assert.equal(detailsButton.tagName, "BUTTON");
  detailsButton.click();
  assert.equal(dialogs(doc).length, 1, "only the detail dialog is in the DOM");
  assert.match(dialogs(doc)[0].textContent, /Bravo/);
  assert.equal(doc.body.style.overflow, "hidden");
  keydown(doc, "Escape");
  assert.equal(dialogs(doc).length, 1, "picker returns");
  assert.ok(doc.querySelector("[data-picker-results]"));
  assert.equal(doc.querySelectorAll("[data-result-card]").length, 3);
  assert.equal(doc.activeElement.getAttribute("data-detail-id"), "2", "focus lands on the same Details button");
  keydown(doc, "Escape");
  assert.equal(dialogs(doc).length, 0);
  assert.equal(doc.activeElement, opener);
  assert.equal(doc.body.style.overflow, "");
});

test("picker open/close repeatedly leaves exactly one dialog and no leaked listeners", () => {
  const { doc, opener } = setup();
  const { rows, byId } = syntheticSet();
  for (let i = 0; i < 4; i += 1) {
    openPicker(doc, { rows, metaById: byId, available: true, opener });
    assert.equal(dialogs(doc).length, 1);
    keydown(doc, "Escape");
    assert.equal(dialogs(doc).length, 0);
    assert.equal(doc.activeElement, opener);
  }
  assert.equal(doc.listeners.get("keydown")?.size ?? 0, 0);
});

test("selected and empty states carry a non-color cue in the rendered markup and the CSS", () => {
  const { rows, byId } = syntheticSet();
  const options = buildPickerOptions(rows, byId);
  const none = { flavor: "none", budget: "10", age: "none", region: "none" };
  const css = read("css/whiskey.css");

  // rendered: the empty state is a container with its own class and an explicit heading
  const empty = renderResultsHtml(recommend({ ...none, flavor: "fruity" }, rows, byId), { ...none, flavor: "fruity" }, options);
  assert.match(empty, /<div class="wh-empty">\s*<h3[^>]*data-results-heading>No exact matches<\/h3>/);
  const hit = renderResultsHtml(recommend({ ...none, budget: "15" }, rows, byId), { ...none, budget: "15" }, options);
  assert.match(hit, /<li class="wh-card" data-result-card>/);

  // rendered: every choice is a real radio inside a .wh-choice label, with the checked one marked
  const form = renderPickerFormHtml(options, { ...none, flavor: "sweet" }, { eligibleCount: 4, totalCount: 5 });
  assert.equal((form.match(/<label class="wh-choice">/g) || []).length, (form.match(/type="radio"/g) || []).length);
  assert.equal((form.match(/ checked>/g) || []).length, 4);

  // CSS: the selected choice changes border width and adds a check glyph; color is never the only change
  const base = cssBlock(css, ".wh-choice");
  const selected = cssBlock(css, ".wh-choice:has(input:checked)");
  const glyph = cssBlock(css, ".wh-choice:has(input:checked)::after");
  assert.match(base, /border:\s*1px solid/);
  assert.match(selected, /border:\s*2px solid/);
  assert.match(selected, /font-weight:\s*[6-9]\d\d/);
  assert.match(glyph, /content:\s*"\\2713"/);

  // CSS: empty state uses a dashed border; result cards and the detail state use a thick leading bar
  assert.match(cssBlock(css, ".wh-empty"), /border:\s*2px dashed/);
  assert.match(cssBlock(css, ".wh-card"), /border-left:\s*4px solid/);
  assert.match(cssBlock(css, ".wh-detail-state"), /border-left:\s*4px solid/);

  // each cue is structural: removing every color declaration must still leave a visible difference
  const stripColor = (block) => block.replace(/(?<![-\w])(?:background(?:-color)?|color|border-color|accent-color):[^;]+;/g, "");
  assert.match(stripColor(selected), /border:\s*2px solid/);
  assert.match(stripColor(glyph), /content:/);
  assert.match(stripColor(cssBlock(css, ".wh-empty")), /dashed/);
});

// --------------------------------------------------------- page presentation

test("Bourbon is the default category; All and existing categories remain", () => {
  assert.equal(defaultCategory(publicRows), "Bourbon");
  assert.equal(defaultCategory([makeRow(1, "A", "Rye", 10)]), "All");
  const tabs = renderTabsHtml(publicRows, "Bourbon");
  assert.match(tabs, /data-whiskey-category="All"/);
  for (const category of new Set(publicRows.map((r) => r.category))) {
    assert.ok(tabs.includes(`data-whiskey-category="${category}"`), category);
  }
  assert.match(tabs, /aria-pressed="true"[^>]*data-whiskey-category="Bourbon"|data-whiskey-category="Bourbon"[^>]*aria-pressed="true"/s);
  assert.equal((tabs.match(/aria-pressed="true"/g) || []).length, 1);
});

test("every category lists rows A-Z by menu name (base sensitivity, stable by id)", () => {
  const sorted = sortRowsAz(publicRows);
  assert.equal(sorted.length, 91);
  const collator = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.sourceId - b.sourceId;
  for (const category of new Set(publicRows.map((r) => r.category))) {
    const list = sorted.filter((r) => r.category === category);
    assert.deepEqual(list, [...list].sort(collator), category);
  }
  const doc = createFakeDocument();
  const holder = doc.createElement("div");
  holder.innerHTML = renderMenuHtml(publicRows, "All", real.byId);
  const sections = holder.querySelectorAll("section");
  assert.ok(sections.length >= 7);
  for (const section of sections) {
    const names = section.querySelectorAll(".whiskey-name-btn").map((b) => b.textContent);
    const expected = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    assert.deepEqual(names, expected);
  }
  const bourbon = document_free_count(renderMenuHtml(publicRows, "Bourbon", real.byId));
  assert.equal(bourbon, publicRows.filter((r) => r.category === "Bourbon").length);
});

function document_free_count(html) {
  return (html.match(/class="whiskey-name-btn"/g) || []).length;
}

test("menu name cell is a real button for all 91 rows, with price from the CSV", () => {
  const html = renderMenuHtml(publicRows, "All", real.byId);
  assert.equal(document_free_count(html), 91);
  assert.equal((html.match(/<button type="button" class="whiskey-name-btn"/g) || []).length, 91);
  for (const row of publicRows) assert.ok(html.includes(`data-detail-id="${row.sourceId}"`));
  assert.ok(html.includes("aria-haspopup=\"dialog\""));
});

test("Critic Picks come only from valid critic evidence; none exist today", () => {
  assert.deepEqual(buildPicks(publicRows, real.byId), []);
  assert.equal(renderPicksHtml([]), "");
  assert.equal(renderPicksHtml(buildPicks(publicRows, real.byId)), "");

  const rows = [makeRow(1, "Alpha", "Rye", 10), makeRow(2, "Beta", "Rye", 12), makeRow(3, "Gamma", "Rye", 14)];
  const critic = { critic: "Example Critic", score: 91, source_url: "https://example.com/a", verified_on: "2026-10-05" };
  const byId = {
    1: makeMeta(rows[0], { critic }),
    2: makeMeta(rows[1], { critic: { ...critic, source_url: "http://insecure.example" } }),
    3: makeMeta(rows[2]),
  };
  const picks = buildPicks(rows, byId);
  assert.deepEqual(picks.map((p) => p.row.sourceId), [1]);
  const html = renderPicksHtml(picks);
  const text = textOf(html);
  assert.match(text, /Critic Picks/);
  assert.match(text, /Alpha/);
  assert.match(text, /Example Critic/);
  assert.match(text, /91/);
  assert.match(text, /2026-10-05/);
  assert.match(html, /href="https:\/\/example\.com\/a"/);
  assert.doesNotMatch(text, /Beta|Gamma/);

  // a recommender result is never turned into a pick
  const { rows: srows, byId: sById } = syntheticSet();
  assert.deepEqual(buildPicks(srows, sById), []);
});

test("rendered UI copy has no serving/pour/per-glass claims and no unsourced superlatives", () => {
  const { rows, byId } = syntheticSet();
  const options = buildPickerOptions(publicRows, real.byId);
  const none = { flavor: "none", budget: "none", age: "none", region: "none" };
  const strings = [
    renderMenuHtml(publicRows, "All", real.byId),
    renderTabsHtml(publicRows, "Bourbon"),
    renderPickerFormHtml(options, none, { eligibleCount: 44, totalCount: 91 }),
    renderResultsHtml(recommend(none, publicRows, real.byId), none, options),
    ...publicRows.map((r) => renderDetailHtml(buildDetailModel(r, real.byId[r.sourceId]), "t")),
    renderResultsHtml(recommend({ ...none, flavor: "sweet", budget: "9" }, rows, byId), { ...none, flavor: "sweet", budget: "9" }, buildPickerOptions(rows, byId)),
  ];
  for (const html of strings) {
    const text = textOf(html);
    assert.doesNotMatch(text, /\bservings?\b|\bpours?\b|per glass|\bglass(es)?\b/i);
    assert.doesNotMatch(text, /\bbest\b|\btop\b|award-winning|\bpicks?\b/i);
  }
  for (const file of ["js/whiskey-picker.js", "js/whiskey-detail.js", "js/whiskey-page.js", "js/whiskey-recommend.js", "js/whiskey-dialog.js", "css/whiskey.css", "whiskey.html"]) {
    assert.doesNotMatch(read(file), /\bservings?\b|\bpours?\b|per glass/i, file);
  }
});

test("a recommender result card is never labelled as a critic rating", () => {
  const { rows, byId } = syntheticSet();
  const options = buildPickerOptions(rows, byId);
  const prefs = { flavor: "sweet", budget: "none", age: "none", region: "none" };
  const html = renderResultsHtml(recommend(prefs, rows, byId), prefs, options);
  assert.doesNotMatch(textOf(html), /critic|rating|score|rated/i);
});

// ----------------------------------------------------------- static contracts

test("whiskey.html has the picker opener in main above the menu, not in the fixed header", () => {
  const html = read("whiskey.html");
  const header = html.slice(html.indexOf('<header id="top-bar">'), html.indexOf("</header>"));
  assert.doesNotMatch(header, /help-me-decide/);
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const opener = main.indexOf('id="help-me-decide"');
  assert.ok(opener > -1);
  assert.ok(opener < main.indexOf('id="menu"'));
  assert.match(main, /id="help-me-decide"[^>]*aria-haspopup="dialog"|aria-haspopup="dialog"[^>]*id="help-me-decide"/);
  assert.match(main, /<button[^>]*id="help-me-decide"[^>]*type="button"|<button[^>]*type="button"[^>]*id="help-me-decide"/);
  assert.doesNotMatch(html, /Critic Picks|\bbest\b/i);
});

test("stylesheet order and viewport: whiskey.css last for Whiskey only; zoom stays enabled", () => {
  const whiskey = read("whiskey.html");
  const wine = read("wine.html");
  const links = [...whiskey.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ["css/base.css", "css/table.css", "css/drawer.css", "css/language.css", "css/whiskey.css"]);
  assert.doesNotMatch(wine, /whiskey\.css/);
  for (const html of [whiskey, wine]) {
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)[1];
    assert.match(viewport, /width=device-width/);
    assert.doesNotMatch(viewport, /maximum-scale|user-scalable/);
  }
});

test("Wine is unchanged: gold default, no whiskey class, no Wine module imported by new modules", () => {
  const wine = read("wine.html");
  const base = read("css/base.css");
  assert.doesNotMatch(wine, /whiskey-theme/);
  assert.match(base, /:root\s*\{[^}]*--accent:\s*#b59a6a;/s);
  assert.match(wine, /<body data-menu="wine">/);
  for (const file of [
    "js/whiskey-metadata.js",
    "js/whiskey-recommend.js",
    "js/whiskey-picker.js",
    "js/whiskey-detail.js",
    "js/whiskey-dialog.js",
    "js/whiskey-picks.js",
    "js/whiskey-page.js",
    "js/whiskey.js",
  ]) {
    assert.doesNotMatch(read(file), /from\s+["']\.\/(recommend|render|app|drawer)\.js["']/, file);
  }
  // red appears only inside the whiskey-scoped rule
  const rootBlock = base.match(/:root\s*\{[^}]*\}/s)[0];
  assert.doesNotMatch(rootBlock, /#b7647d|#c0|#a0|183,\s*100,\s*125/i);
});

test("no Atlas or Cocktails link in either page", () => {
  for (const file of ["whiskey.html", "wine.html"]) {
    assert.doesNotMatch(read(file), /<a\b[^>]*href="[^"]*(cocktail|atlas)/i, file);
  }
});

test("whiskey accent keeps contrast on the page background and is a deeper red", () => {
  const base = read("css/base.css");
  const block = base.match(/body\[data-menu="whiskey"\]\.whiskey-theme-violet-red\s*\{([^}]*)\}/)[1];
  for (const token of ["--accent", "--accent-soft", "--accent-border", "--panel"]) {
    assert.match(block, new RegExp(`${token}:`), token);
  }
  const accent = block.match(/--accent:\s*(#[0-9a-f]{6})/i)[1];
  assert.notEqual(accent.toLowerCase(), "#b7647d", "red palette must be deepened");
  const [r, g, b] = accent.slice(1).match(/../g).map((v) => Number.parseInt(v, 16));
  assert.ok(r > g * 1.8 && r > b * 1.3, "accent reads red");
});

test("44px targets and 16px+ controls in the Whiskey stylesheet", () => {
  const css = read("css/whiskey.css");
  for (const selector of [".whiskey-name-btn", ".wh-modal-close", ".wh-choice", ".wh-btn", ".wh-picker-open"]) {
    assert.match(cssBlock(css, selector), /min-height:\s*44px/, selector);
  }
  for (const selector of [".wh-choice", ".wh-btn", ".wh-picker-open", ".wh-modal-close"]) {
    const size = cssBlock(css, selector).match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    assert.ok(size && Number(size[1]) >= 16, `${selector} font-size >= 16px`);
  }
  assert.match(css, /\.whiskey-name-btn:focus-visible/);
  assert.match(css, /\.wh-choice:focus-within|\.wh-choice input:focus-visible/);
});

test("picker option groups wrap and never force horizontal overflow", () => {
  const css = read("css/whiskey.css");
  const choices = cssBlock(css, ".wh-choices");
  assert.match(choices, /display:\s*flex/);
  assert.match(choices, /flex-wrap:\s*wrap/);
  assert.match(choices, /min-width:\s*0/);
  const choice = cssBlock(css, ".wh-choice");
  assert.match(choice, /min-width:\s*0/);
  assert.match(choice, /overflow-wrap:\s*anywhere/);
  assert.match(cssBlock(css, ".wh-modal"), /overflow-wrap:\s*anywhere/);
  assert.match(css, /env\(safe-area-inset-left/);
  assert.match(css, /env\(safe-area-inset-right/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  for (const match of css.matchAll(/(?<![-\w])(?:min-)?width\s*:\s*(\d+)px/g)) {
    assert.ok(Number(match[1]) <= 320, `fixed width ${match[0]} exceeds 320px`);
  }
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
});

test("shared menu switcher wraps instead of clipping at narrow and zoomed widths", () => {
  const css = read("css/base.css");
  const nav = cssBlock(css, ".menu-switcher");
  assert.match(nav, /display:\s*flex/);
  assert.match(nav, /flex-wrap:\s*wrap/);
  assert.match(nav, /justify-content:\s*center/);
  assert.match(nav, /min-width:\s*0/);
  assert.match(nav, /max-width:\s*100%/);
  assert.match(nav, /env\(safe-area-inset-left/);
  assert.match(nav, /env\(safe-area-inset-right/);
  assert.doesNotMatch(nav, /white-space:\s*nowrap/);
  const link = cssBlock(css, ".menu-switcher a");
  assert.match(link, /min-height:\s*44px/);
  assert.match(link, /display:\s*(inline-)?flex/);
  assert.match(link, /align-items:\s*center/);
  assert.match(link, /justify-content:\s*center/);
  assert.match(link, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(link, /white-space:\s*nowrap/);
  assert.match(css, /\.menu-switcher a\[aria-current="page"\]\s*\{[^}]*border-color:/);
});

test("masthead never clips its wrapped content: no fixed height cap or overflow clip while expanded", () => {
  const css = read("css/base.css");
  const masthead = cssBlock(css, ".masthead");
  assert.match(masthead, /min-width:\s*0/);
  assert.match(masthead, /max-width:\s*100%/);
  assert.match(masthead, /max-height:\s*none/);
  assert.doesNotMatch(masthead, /max-height:(?!\s*none)[^;]+;/);
  assert.doesNotMatch(masthead, /(?<![-\w])height:\s*\d/);
  assert.doesNotMatch(masthead, /overflow(?:-y|-x)?:\s*(hidden|clip|auto|scroll)/);
  assert.match(masthead, /env\(safe-area-inset-left/);
  assert.match(masthead, /env\(safe-area-inset-right/);
  // only the compact (scrolled) state may collapse it, and it is opt-in via .is-compact
  const compact = cssBlock(css, "#top-bar.is-compact .masthead");
  assert.match(compact, /max-height:\s*0/);
  assert.match(compact, /overflow:\s*hidden/);
  // the switcher and its links never carry a fixed height or clip either
  for (const selector of [".menu-switcher", ".menu-switcher a"]) {
    const block = cssBlock(css, selector);
    assert.doesNotMatch(block, /(?<![-\w])(?:max-)?height:\s*\d/, selector);
    assert.doesNotMatch(block, /overflow(?:-y|-x)?:\s*(hidden|clip|auto|scroll)/, selector);
  }
  // the header must be able to leave the viewport at 400% zoom so it cannot cover the page
  const whiskey = read("css/whiskey.css");
  assert.match(whiskey, /@media\s*\(max-height:\s*\d+px\)\s*\{[^@]*#top-bar\s*\{\s*position:\s*static/);
});

test("whiskey page script keeps header sync and stable filter buttons and wires new modules", () => {
  const script = read("js/whiskey.js");
  assert.match(script, /aria-pressed|renderTabsHtml/);
  assert.match(script, /syncTopbarHeight/);
  assert.match(script, /ResizeObserver/);
  assert.match(script, /loadWhiskeyMetadata/);
  assert.match(script, /openPicker/);
  assert.match(script, /openDetail/);
  assert.match(script, /defaultCategory/);
  assert.doesNotMatch(script, /role="tab"/);
  assert.match(read("js/whiskey-page.js"), /aria-pressed/);
});

test("browser NodeLists are never treated as arrays (the fake DOM returns arrays, real browsers do not)", () => {
  // Found by the rendered Opera run: querySelectorAll(...).filter threw in a real browser and
  // silently disabled the Tab trap. Spread into an array first.
  for (const file of ["js/whiskey-dialog.js", "js/whiskey-picker.js", "js/whiskey-detail.js", "js/whiskey-page.js", "js/whiskey-picks.js", "js/whiskey.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /querySelectorAll\([^)]*\)\s*\.(?:filter|map|some|every|find|findIndex|reduce|slice|indexOf|includes|at)\b/, file);
  }
  assert.match(read("js/whiskey-dialog.js"), /\[\.\.\.root\.querySelectorAll\(FOCUSABLE\)\]/);
});

test("new modules are free of held/private references", () => {
  for (const file of ["js/whiskey-picker.js", "js/whiskey-detail.js", "js/whiskey-dialog.js", "js/whiskey-page.js", "js/whiskey-picks.js", "js/whiskey.js", "whiskey.html"]) {
    assert.doesNotMatch(read(file), /_audit|withheld/i, file);
  }
});

test("fixtures are not mutated by rendering", () => {
  const before = JSON.stringify(real.byId);
  for (const row of publicRows) renderDetailHtml(buildDetailModel(row, real.byId[row.sourceId]), "t");
  assert.equal(JSON.stringify(real.byId), before);
  assert.deepEqual(clone(publicRows), publicRows);
});
