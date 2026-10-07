// Pure whiskey picker logic. Inputs are exactly flavor, budget, age (optional) and
// region (optional). No DOM, no numeric fit score: matches are strict filters
// ordered deterministically.

import { ageKind, isEligible, verifiedAge } from "./whiskey-metadata.js";

export const NO_PREFERENCE = "none";
export const ANYWHERE = "anywhere";

const FIELDS = ["flavor", "budget", "age", "region"];
const NEUTRAL = new Set([undefined, null, "", NO_PREFERENCE, ANYWHERE]);
const MAX_MATCHES = 3;

const metaFor = (metaById, row) => (metaById ? metaById[row.sourceId] : undefined);
const isActive = (value) => !NEUTRAL.has(value);
const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const compareText = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

export function eligibleRows(rows, metaById) {
  return rows.filter((row) => isEligible(metaFor(metaById, row)));
}

function percentile(sorted, fraction) {
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

// Display order hint only: a tag is offered solely when an eligible row carries it.
const DEFAULT_FLAVOR_ORDER = ["sweet", "fruity", "spicy", "smoky", "oaky"];

export function buildPickerOptions(rows, metaById, flavorOrder = DEFAULT_FLAVOR_ORDER) {
  const pool = eligibleRows(rows, metaById);
  const metas = pool.map((row) => metaFor(metaById, row));

  const present = new Set(metas.flatMap((meta) => meta.flavor_tags));
  const flavor = [
    ...flavorOrder.filter((tag) => present.has(tag)),
    ...[...present].filter((tag) => !flavorOrder.includes(tag)).sort(compareText),
  ];

  const prices = [...new Set(pool.map((row) => row.price))].sort((a, b) => a - b);
  const budgets = prices.length
    ? [...new Set([0.25, 0.5, 0.75].map((p) => percentile(prices, p)).concat(prices[prices.length - 1]))]
    : [];

  const ages = [...new Set(metas.map(verifiedAge).filter((age) => age !== null))].sort((a, b) => a - b);
  const regions = [...new Set(metas.map((meta) => meta.region_group).filter(Boolean))].sort(compareText);

  const none = { value: NO_PREFERENCE, label: "No preference" };
  return {
    flavor: [none, ...flavor.map((tag) => ({ value: tag, label: capitalise(tag) }))],
    budget: [none, ...budgets.map((x) => ({ value: String(x), label: `Up to $${x}` }))],
    age: [none, ...ages.map((n) => ({ value: String(n), label: `${n} years or older` }))],
    region: [
      none,
      { value: ANYWHERE, label: "Anywhere" },
      ...regions.map((group) => ({ value: group, label: group })),
    ],
  };
}

function rowMatches(prefs, row, meta) {
  if (isActive(prefs.flavor) && !meta.flavor_tags.includes(prefs.flavor)) return false;
  if (isActive(prefs.budget) && !(row.price <= Number(prefs.budget))) return false;
  if (isActive(prefs.age)) {
    const age = verifiedAge(meta);
    if (age === null || age < Number(prefs.age)) return false;
  }
  if (isActive(prefs.region) && meta.region_group !== prefs.region) return false;
  return true;
}

function compareRows(a, b, metaById) {
  const rank = (row) => (metaFor(metaById, row).status === "verified" ? 0 : 1);
  return (
    rank(a) - rank(b) ||
    a.price - b.price ||
    compareText(a.name, b.name) ||
    a.sourceId - b.sourceId
  );
}

function allMatches(prefs, pool, metaById) {
  return pool
    .filter((row) => rowMatches(prefs, row, metaFor(metaById, row)))
    .sort((a, b) => compareRows(a, b, metaById));
}

function reasonsFor(prefs, row, meta) {
  const reasons = [];
  if (isActive(prefs.flavor)) reasons.push(`Flavor: ${prefs.flavor} (from producer tasting notes)`);
  if (isActive(prefs.budget)) reasons.push(`$${row.price} on the menu, within your $${Number(prefs.budget)} budget`);
  if (isActive(prefs.age)) {
    const age = verifiedAge(meta);
    reasons.push(
      ageKind(meta) === "minimum"
        ? `At least ${age} years (producer-stated minimum)`
        : `Aged ${meta.age_text || `${age} years`} (producer-stated)`,
    );
  }
  if (isActive(prefs.region)) reasons.push(`Region: ${meta.region_group}`);
  if (!reasons.length) reasons.push("Bottle details verified against the producer's page");
  return reasons;
}

const plural = (n) => `${n} ${n === 1 ? "match" : "matches"}`;

function relaxed(prefs, field) {
  return { ...prefs, [field]: field === "region" ? ANYWHERE : NO_PREFERENCE };
}

function buildSuggestions(prefs, rows, pool, metaById) {
  const suggestions = [];
  const count = (next) => allMatches(next, pool, metaById).length;

  for (const field of FIELDS) {
    if (!isActive(prefs[field])) continue;

    if (field === "budget") {
      const options = buildPickerOptions(rows, metaById).budget.slice(1);
      for (const option of options) {
        const nextPrefs = { ...prefs, budget: option.value };
        const matchCount = count(nextPrefs);
        if (matchCount >= 1) {
          suggestions.push({
            field,
            label: `Raise budget to $${option.value} (${plural(matchCount)})`,
            nextPrefs,
            matchCount,
          });
          break;
        }
      }
      continue;
    }

    const nextPrefs = relaxed(prefs, field);
    const matchCount = count(nextPrefs);
    if (matchCount < 1) continue;
    const verb = {
      flavor: "Remove flavor filter",
      age: "Remove age filter",
      region: "Show any region",
    }[field];
    suggestions.push({ field, label: `${verb} (${plural(matchCount)})`, nextPrefs, matchCount });
  }
  return suggestions;
}

export function recommend(prefs, rows, metaById) {
  const pool = Array.isArray(rows) && metaById ? eligibleRows(rows, metaById) : [];
  if (!pool.length) return { state: "unavailable", matches: [], suggestions: [] };

  const wanted = Object.fromEntries(FIELDS.map((field) => [field, prefs?.[field]]));
  const found = allMatches(wanted, pool, metaById);
  if (found.length) {
    return {
      state: "results",
      matches: found.slice(0, MAX_MATCHES).map((row) => ({
        row,
        meta: metaFor(metaById, row),
        reasons: reasonsFor(wanted, row, metaFor(metaById, row)),
      })),
      suggestions: [],
    };
  }
  return {
    state: "no-exact-matches",
    matches: [],
    suggestions: buildSuggestions(wanted, rows, pool, metaById),
  };
}
