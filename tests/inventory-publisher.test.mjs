import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Apps Script endpoint is read-only and filters exclusively on Show on QR", () => {
  const source = read("google-apps-script/Code.gs");
  assert.match(source, /function doGet\(/);
  assert.doesNotMatch(source, /function doPost\(|setValue|setValues|appendRow|deleteRow|insertRow/);
  assert.match(source, /headers\.indexOf\('Show on QR'\)/);
  assert.match(source, /valuesRow\[showIndex\] === true/);
});

test("Apps Script public projection excludes operational and purchasing fields", () => {
  const source = read("google-apps-script/Code.gs");
  for (const field of ["Unit Cost", "Inventory Value", "Distributor", "Manager Notes", "Qty to Order", "Order Override", "On Hand", "Par"]) {
    assert.doesNotMatch(source, new RegExp(`row\\['${field}'\\]`), field);
  }
  for (const field of ["Menu Name", "Bottle Price", "Standard (1.5 oz)", "Description"]) {
    assert.ok(source.includes(`row['${field}']`), field);
  }
});

test("public manager is only a sign-in landing and stores no publishing credential", () => {
  const manager = read("js/manager.js");
  const page = read("manager/index.html");
  const workflow = read(".github/workflows/publish-inventory.yml");
  assert.match(page, /Continue with Google/);
  assert.doesNotMatch(page, /data-pull=|Publish approved menus|actions\/workflows/);
  assert.match(manager, /manager-app\.json/);
  assert.match(manager, /script\\\.google\\\.com\\\/macros\\\/s\\\//);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /vars\.INVENTORY_API_URL/);
  assert.doesNotMatch(manager + page, /ghp_|github_pat_|Authorization:|Bearer\s/i);
});

test("publisher validates and preserves stable Whiskey IDs before writing public files", () => {
  const source = read("scripts/pull-inventory.mjs");
  assert.match(source, /stable public ID/);
  assert.match(source, /existingWhiskey/);
  assert.match(source, /missing a name or bottle price/);
  assert.match(source, /missing a standard price/);
});
