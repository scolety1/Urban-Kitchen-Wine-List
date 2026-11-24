import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => {
  try { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
  catch { return ""; }
};

test("private manager exposes Pull All and three independent workspaces", () => {
  const page = read("google-apps-script-manager/Index.html");
  assert.match(page, /data-pull-all[^>]*>Pull all from Google Sheets</);
  for (const [key, label] of [["wine", "Wine"], ["whiskey", "Whiskey"], ["spirits", "Spirits"]]) {
    assert.match(page, new RegExp(`data-workspace-tab="${key}"[^>]*>${label}`));
    assert.match(page, new RegExp(`data-pull-menu="${key}"`));
    assert.match(page, new RegExp(`data-publish-menu="${key}"`));
  }
  assert.doesNotMatch(page, /Beer workspace|Cocktail workspace|Liqueur workspace/i);
});

test("manager client protects dirty drafts and pulls all three Sheet menus", () => {
  const client = read("google-apps-script-manager/Manager.html");
  assert.match(client, /runServer\("pullMenus",\s*menuNames\)/);
  assert.match(client, /pull\(\["wine",\s*"whiskey",\s*"spirits"\]/);
  assert.match(client, /dirtyMenus:\s*new Set/);
  assert.match(client, /dirtyMenus\.has\(menu\)/);
  assert.match(client, /dirtyMenus\.delete\(menu\)/);
  assert.match(client, /confirm\([^)]*discard/i);
  assert.match(client, /Google Sheets changed|Pull again/i);
  assert.match(client, /aria-live/);
  assert.match(client, /beforeunload/);
});

test("table edits commit on change without rebuilding rows on every keystroke", () => {
  const client = read("google-apps-script-manager/Manager.html");
  assert.match(client, /panel\.addEventListener\("change",\s*updateRow\)/);
  assert.doesNotMatch(client, /panel\.addEventListener\("input",\s*updateRow\)/);
});

test("Wine supports optional CSV review without making CSV the source of truth", () => {
  const page = read("google-apps-script-manager/Index.html");
  const client = read("google-apps-script-manager/Manager.html");
  assert.match(page, /type="file"[^>]*accept="\.csv,text\/csv"[^>]*data-wine-csv/);
  assert.match(client, /reviewCsv/);
  assert.match(client, /wineHiddenKeys/);
  assert.match(page, /Google Sheets is the source of truth/);
});

test("Spirits editor excludes beer and liqueurs and supports curated Shot Picks", () => {
  const client = read("google-apps-script-manager/Manager.html");
  for (const family of ["Tequila & Mezcal", "Gin", "Vodka", "Rum", "Brandy & Cognac", "Other Spirits"]) {
    assert.ok(client.includes(family), family);
  }
  assert.match(client, /data-field="featuredShot"/);
  assert.match(client, /data-field="shotPrice"/);
  assert.match(client, /data-field="shotNote"/);
  assert.match(client, /Needs Review/);
  assert.match(client, /row\.out/);
  assert.match(client, /Out — hidden from guests/);
  assert.match(client, /inventoryCategory.*Beer|Beer.*inventoryCategory/s);
  assert.match(client, /Liqueur \/ aperitif/);
});

test("publish buttons validate a pulled revision and present workflow receipts", () => {
  const client = read("google-apps-script-manager/Manager.html");
  assert.match(client, /publishMenus/);
  assert.match(client, /state\.draft\.menuRevisions\[menu\]/);
  assert.match(client, /"PUBLISH"/);
  assert.match(client, /sheet-updated-workflow-not-started/);
  assert.match(client, /retryPublishWorkflow/);
  assert.match(client, /Retry website publish/);
  assert.match(client, /workflowUrl/);
  assert.match(client, /data-publish-status/);
});

