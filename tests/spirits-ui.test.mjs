import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Spirits rows require approved guest fields and expose Shot Picks", async () => {
  const { prepareSpirits, spiritCategories, priceLabel } = await import(new URL("../js/spirits-menu.js", import.meta.url));
  const rows = prepareSpirits([
    { id: "titos", name: "Tito's", family: "Vodka", pour_size: "1.5 oz", price: 12, featured_shot: true, shot_price: 10, shot_note: "Cold and clean" },
  ]);
  assert.equal(rows[0].name, "Tito's");
  assert.equal(rows[0].featuredShot, true);
  assert.deepEqual(spiritCategories(rows), ["All", "Vodka"]);
  assert.equal(priceLabel(12), "$12");
  assert.throws(() => prepareSpirits([{ id: "x", name: "Mystery", family: "", pour_size: "1.5 oz", price: 10 }]), /family/i);
  assert.throws(() => prepareSpirits([{ id: "x", name: "Mystery", family: "Vodka", pour_size: "", price: 10 }]), /pour size/i);
  assert.throws(() => prepareSpirits([{ id: "x", name: "Mystery", family: "Vodka", pour_size: "1.5 oz", price: "" }]), /price/i);
  assert.throws(() => prepareSpirits([{ id: "x", name: "Mystery", family: "Vodka", pour_size: "1.5 oz", price: 10, featured_shot: true, shot_price: "" }]), /shot price/i);
});

test("Spirits page keeps categories scrollable and Shot Picks visually separate", () => {
  const page = read("liqueur/index.html");
  const css = read("css/spirits.css");
  assert.match(page, /id="spirits-tabs"/);
  assert.match(page, /id="shot-picks"/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /\.shot-picks/);
  assert.doesNotMatch(page + read("js/spirits.js"), /Beer|Liqueur \/ aperitif/);
});

test("publisher validates and stores the approved Spirits snapshot", () => {
  const publisher = read("scripts/pull-inventory.mjs");
  const workflow = read(".github/workflows/publish-inventory.yml");
  assert.match(publisher, /payload\.spirits/);
  assert.match(publisher, /data\/spirits\.json/);
  assert.match(publisher, /missing a family, pour size, or price/i);
  assert.match(workflow, /data\/spirits\.json/);
});
