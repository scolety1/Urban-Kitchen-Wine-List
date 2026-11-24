import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => {
  try { return readFileSync(new URL(path, root), "utf8"); }
  catch { return ""; }
};

const baseSheets = {
  Wine: [
    ["Bin", "Menu Name", "Bottle Price", "Show on QR", "Par"],
    ["101", "Estate Red", 72, true, 4],
  ],
  Whiskey: [
    ["Stable ID", "Menu Name", "Category", "Standard (1.5 oz)", "Show on QR"],
    ["w-1", "Example Rye", "Rye", 14, true],
  ],
  "Other Beverages": [
    ["Product", "Category", "Out", "Par (source)", "Bin / location"],
    ["Titos", "Other bar", false, 2, "Right well"],
  ],
};

function loadBackend({ email = "owner@example.com", properties = {}, sheets = baseSheets } = {}) {
  const calls = { reads: [], batches: [], appends: [], fetches: [], locks: 0, releases: 0 };
  const values = {
    get(_id, range) {
      calls.reads.push(range);
      const match = range.match(/^'([^']+)'!A\d+:ZZ$/);
      return { values: structuredClone(sheets[match?.[1]] || []) };
    },
    batchUpdate(body) { calls.batches.push(structuredClone(body)); return {}; },
    append(body, _id, range) { calls.appends.push({ body: structuredClone(body), range }); return {}; },
  };
  const context = {
    console, JSON, Math, Number, Object, String, Array, Date, RegExp, Set, Map,
    Session: { getActiveUser: () => ({ getEmail: () => email }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] ?? null }) },
    LockService: { getScriptLock: () => ({
      waitLock: () => { calls.locks += 1; },
      releaseLock: () => { calls.releases += 1; },
    }) },
    Sheets: { Spreadsheets: { Values: values } },
    UrlFetchApp: { fetch: (url, options) => {
      calls.fetches.push({ url, options: structuredClone(options) });
      return { getResponseCode: () => 204, getContentText: () => "" };
    } },
    HtmlService: { createTemplateFromFile: () => ({ evaluate: () => ({ setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } }) }), XFrameOptionsMode: { DEFAULT: "DEFAULT" } },
  };
  runInNewContext([
    source("google-apps-script-manager/SheetDraft.gs"),
    source("google-apps-script-manager/WineReview.gs"),
    source("google-apps-script-manager/OtherBeverages.gs"),
    source("google-apps-script-manager/Code.gs"),
  ].join("\n"), context);
  return { context, calls };
}

const configured = {
  ALLOWED_MANAGER_EMAILS: "owner@example.com,manager@example.com",
  GITHUB_TOKEN: "secret-token",
  GITHUB_OWNER: "scolety1",
  GITHUB_REPO: "Urban-Kitchen-Wine-List",
  GITHUB_WORKFLOW: "publish-inventory.yml",
};

test("unauthorized identities fail before any private Sheet read", () => {
  const { context, calls } = loadBackend({ email: "outsider@example.com", properties: configured });
  assert.equal(typeof context.pullMenus, "function");
  assert.throws(() => context.pullMenus(["wine"]), /not authorized/i);
  assert.equal(calls.reads.length, 0);
});

test("authorized Pull All reads the three bounded Sheet ranges", () => {
  const { context, calls } = loadBackend({ properties: configured });
  const result = context.pullMenus(["wine", "whiskey", "spirits"]);
  assert.deepEqual(Array.from(calls.reads), ["'Wine'!A2:ZZ", "'Whiskey'!A4:ZZ", "'Other Beverages'!A4:ZZ"]);
  assert.equal(result.wine.length, 1);
  assert.equal(result.whiskey.length, 1);
  assert.equal(result.spirits.length, 1);
  assert.equal(result.manager.email, "owner@example.com");
  assert.doesNotMatch(JSON.stringify(result), /secret-token|GITHUB_TOKEN/);
});

test("stale publication is rejected before locking or writing", () => {
  const { context, calls } = loadBackend({ properties: configured });
  assert.throws(() => context.publishMenus(["wine"], "stale-revision", { wine: [] }, "PUBLISH"), /changed.*pull again/i);
  assert.equal(calls.locks, 1);
  assert.equal(calls.batches.length, 0);
  assert.equal(calls.appends.length, 0);
  assert.equal(calls.fetches.length, 0);
  assert.equal(calls.releases, 1);
});

test("authorized no-change publication dispatches the workflow without exposing its token", () => {
  const { context, calls } = loadBackend({ properties: configured });
  const pulled = context.pullMenus(["wine", "whiskey", "spirits"]);
  const receipt = context.publishMenus([], pulled.revision, {}, "PUBLISH");
  assert.equal(calls.fetches.length, 1);
  assert.equal(calls.fetches[0].url, "https://api.github.com/repos/scolety1/Urban-Kitchen-Wine-List/actions/workflows/publish-inventory.yml/dispatches");
  assert.equal(calls.fetches[0].options.headers.Authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(calls.fetches[0].options.payload), { ref: "main" });
  assert.equal(receipt.state, "published");
  assert.match(receipt.workflowUrl, /github\.com\/scolety1\/Urban-Kitchen-Wine-List\/actions\/workflows\/publish-inventory\.yml/);
  assert.doesNotMatch(JSON.stringify(receipt), /secret-token/);
  assert.equal(calls.releases, 1);
});

test("missing GitHub configuration reports Sheet-only partial success", () => {
  const withoutToken = { ...configured };
  delete withoutToken.GITHUB_TOKEN;
  const { context, calls } = loadBackend({ properties: withoutToken });
  const pulled = context.pullMenus(["wine"]);
  const receipt = context.publishMenus([], pulled.revision, {}, "PUBLISH");
  assert.equal(receipt.state, "sheet-updated-workflow-not-started");
  assert.match(receipt.message, /Sheet is current.*workflow was not started/i);
  assert.equal(calls.fetches.length, 0);
  assert.equal(calls.releases, 1);
});

test("private manifest requests write, identity, and outbound-request scopes", () => {
  const manifest = JSON.parse(source("google-apps-script-manager/appsscript.json") || "{}");
  assert.deepEqual(manifest.oauthScopes, [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.external_request",
  ]);
});

