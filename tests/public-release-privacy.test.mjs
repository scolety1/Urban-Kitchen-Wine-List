import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const publicBase = "99ee6c448a4b36d6163cd82964eedcf9e2a699ac";
const privateKeys = new Set(["ambiguity_note", "research_attempts", "unresolved_rows", "critic_candidates_rejected", "research_backlog"]);

function inspectJson(value, location = "") {
  const errors = [];
  if (!value || typeof value !== "object") return errors;
  for (const [key, child] of Object.entries(value)) {
    const at = `${location}/${key}`;
    if (privateKeys.has(key)) errors.push(at);
    errors.push(...inspectJson(child, at));
  }
  return errors;
}

test("privacy guard rejects internal notes even inside ordinary public metadata", () => {
  assert.deepEqual(inspectJson({ rows: [{ description: "Public description", ambiguity_note: "Internal investigation" }] }), ["/rows/0/ambiguity_note"]);
  assert.deepEqual(inspectJson({ research_attempts: [] }), ["/research_attempts"]);
  assert.deepEqual(inspectJson({ rows: [{ description: "Exact bottle not verified.", status: "unresolved" }] }), []);
});

test("public bottle records contain only supported public fields", () => {
  const allowed = new Set(["source_id", "menu_name", "category", "bottle_version", "description", "region", "region_group", "age_years", "age_status", "age_basis", "age_note", "flavor_tags", "product_source_url", "source_type", "verified_on", "status", "critic", "age_min", "age_max", "age_text"]);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "data/whiskey-metadata.json"), "utf8"));
  for (const row of metadata.rows) {
    for (const key of Object.keys(row)) assert.ok(allowed.has(key), `${row.menu_name}: ${key}`);
  }
  assert.equal(fs.existsSync(path.join(root, "data/whiskey-provenance.json")), false);
});

test("new release files contain no private artifacts or embedded research notes", () => {
  const changed = execFileSync("git", ["diff", "--name-only", publicBase], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  const files = [...new Set([...changed, ...untracked])];
  for (const relative of files) {
    assert.doesNotMatch(relative, /(?:^|\/)(?:_audit|\.qa-artifacts|\.coord-spec)|provenance|receipt|boss-review|source-audit|\.map$/i, relative);
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) continue;
    if (relative.endsWith(".json")) assert.deepEqual(inspectJson(JSON.parse(fs.readFileSync(full, "utf8"))), [], relative);
    if (!relative.startsWith("tests/")) {
      assert.doesNotMatch(fs.readFileSync(full, "utf8"), /HTTP\s+(?:403|429)|connection refused|domain-for-sale|sourceMappingURL|research_attempts|ambiguity_note/, relative);
    }
  }
});
