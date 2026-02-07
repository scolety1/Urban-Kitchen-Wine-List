import { escapeHtml, cmpText, makeShortLocation, isYes, isNo, toInt, worldLabel, norm, normLower, priceToDisplay } from "./utils.js";
import { openDrawer } from "./drawer.js";

const REQUIRED = [
  "name",
  "varietal",
  "world",
  "country",
  "region_1",
  "region_2",
  "bin",
  "vintage",
  "glass_price",
  "bottle_price",
  "internal_notes",
  "staff_pick",
  "stock",
  "show",
  "description",
];

export function validateHeaders(headers) {
  const present = new Set(headers.map((h) => normLower(h)));
  const missing = REQUIRED.filter((k) => !present.has(k));
  return missing;
}

export function normalizeRecords(records) {
  return records.map((r, idx) => {
    const row = {};
    for (const key of REQUIRED) row[key] = r[key] ?? r[key.toUpperCase?.()] ?? r[key.toLowerCase?.()] ?? "";
    row._id = `${idx}-${norm(row.name)}-${norm(row.bin)}`;
    row._binNum = toInt(row.bin) ?? 999999;
    row._varietal = norm(row.varietal);
    row._world = normLower(worldLabel(row.world)).includes("old") ? "old" : normLower(worldLabel(row.world)).includes("new") ? "new" : normLower(row.world);
    row._country = norm(row.country);
    row._r1 = norm(row.region_1);
    row._r2 = norm(row.region_2);
    row._name = norm(row.name);
    return row;
  });
}

export function filterVisible(records) {
  return records.filter((r) => {
    const s = normLower(r.show);
    if (!s) return true;
    if (isNo(s)) return false;
    if (isYes(s)) return true;
    return true;
  });
}

export function getVarietals(records) {
  const set = new Set();
  for (const r of records) {
    const v = norm(r._varietal);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => cmpText(a, b));
}

export function renderTabs(_varietals, activeVarietal) {
  const tabsEl = document.getElementById("tabs");
  if (!tabsEl) return;

  const current = normLower(activeVarietal || "all");

  const btn = (label, id, active) => `
    <button class="tab-btn ${active ? "is-active" : ""}" type="button" data-tab="${escapeHtml(id)}" aria-selected="${active ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>
  `;

  const parts = [];
  parts.push(btn("All", "all", current === "all"));
  parts.push(btn("Red", "red", current === "red"));
  parts.push(btn("White", "white", current === "white"));
  parts.push(btn("Sparkling", "sparkling", current === "sparkling"));

  tabsEl.innerHTML = parts.join("");

  tabsEl.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const tab = el.getAttribute("data-tab") || "all";
      if (tab === "all") {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        location.hash = `#${tab}`;
      }
      window.dispatchEvent(new Event("hashchange"));
    });
  });
}

export function renderMenu(records, activeVarietal) {
  const menuEl = document.getElementById("menu");
  if (!menuEl) return;

  const filtered = records.filter((r) => matchesTopTab(r, activeVarietal));

  const byVarietal = groupBy(filtered, (r) => r._varietal || "Other");
  const varietalKeys = Object.keys(byVarietal).sort((a, b) => cmpText(a, b));

  const html = [];

  for (const varietal of varietalKeys) {
    const vSlug = slug(varietal);
    const items = byVarietal[varietal];

    const oldWorld = items.filter((r) => r._world === "old");
    const newWorld = items.filter((r) => r._world === "new");
    const otherWorld = items.filter((r) => r._world !== "old" && r._world !== "new");

    const sections = [];
    if (oldWorld.length) sections.push({ world: "old", rows: oldWorld });
    if (newWorld.length) sections.push({ world: "new", rows: newWorld });
    if (otherWorld.length) sections.push({ world: "other", rows: otherWorld });

    html.push(`
      <section class="section" id="${escapeHtml(vSlug)}">
        <div class="sticky-stack">
          <div class="varietal-header">
            <div class="varietal-title">${escapeHtml(varietal)}</div>
          </div>
          <div class="table-head">
            <div>Bin</div>
            <div>Wine</div>
            <div style="text-align:right;">Bottle</div>
          </div>
        </div>

        <div class="section-body">
          ${sections.map((s) => renderWorldBlock(s.world, s.rows)).join("")}
        </div>
      </section>
    `);
  }

  if (!html.length) {
    menuEl.innerHTML = `
      <div class="card" style="padding: 14px;">
        <div style="font-weight: 800; margin-bottom: 6px;">No items to show</div>
        <div style="color: var(--muted); font-weight: 600;">Try a different tab.</div>
      </div>
    `;
    return;
  }

  menuEl.innerHTML = html.join("");

  menuEl.querySelectorAll(".table-row[data-id]").forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      const id = rowEl.getAttribute("data-id");
      const item = filtered.find((r) => r._id === id);
      if (item) openDrawer(item);
    });
  });
}

function renderWorldBlock(world, rows) {
  const label = world === "other" ? "Other" : worldLabel(world);

  const sorted = rows.slice().sort((a, b) => {
    const c0 = cmpText(a._country, b._country);
    if (c0) return c0;
    const c1 = cmpText(a._r1, b._r1);
    if (c1) return c1;
    const c2 = cmpText(a._r2, b._r2);
    if (c2) return c2;
    const c3 = (a._binNum ?? 999999) - (b._binNum ?? 999999);
    if (c3) return c3;
    return cmpText(a._name, b._name);
  });

  const rowsHtml = sorted.map((r) => renderRow(r)).join("");

  return `
    <div class="world-block">
      <div class="world-header">${escapeHtml(label)}</div>
      ${rowsHtml}
    </div>
  `;
}

function withDollar(val) {
  const s = norm(val);
  if (!s) return "";
  if (normLower(s) === "mp") return "mp";
  if (s.startsWith("$")) return s;
  return `$${s}`;
}

function renderRow(r) {
  const name = escapeHtml(r._name);
  const loc = escapeHtml(makeShortLocation(r));
  const vintage = norm(r.vintage) ? escapeHtml(norm(r.vintage)) : "";
  const subtitle = [loc, vintage].filter(Boolean).join(" · ");

  const bottleRaw = priceToDisplay(r.bottle_price);
  const bottle = bottleRaw === "mp" ? "mp" : withDollar(bottleRaw);
  const bottleHtml = bottle === "mp" ? `<span class="mp">mp</span>` : escapeHtml(bottle || "");

  const star = isYes(r.staff_pick) ? `<span class="tag">Staff</span>` : "";

  return `
    <div class="table-row" data-id="${escapeHtml(r._id)}" role="button" tabindex="0">
      <div class="cell bin">${escapeHtml(norm(r.bin) || "—")}</div>
      <div class="cell name">
        <div class="name-line">
          <div class="name-text">${name}</div>
          ${star}
        </div>
        <div class="subtext">${subtitle || ""}</div>
      </div>
      <div class="cell price">${bottleHtml || ""}</div>
    </div>
  `;
}

function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item) ?? "";
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

function slug(s) {
  return normLower(s)
    .replaceAll("&", "and")
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

function topTabForRecord(r) {
  const v = normLower(r._varietal || "");

  if (v.includes("sparkling") || v.includes("champagne") || v.includes("prosecco") || v.includes("cava") || v.includes("cremant")) {
    return "sparkling";
  }

  const whiteKeys = [
    "chardonnay", "sauvignon", "riesling", "pinot gris", "pinot grigio", "moscato",
    "chenin", "viognier", "verdejo", "vermentino", "gruner", "grüner", "albariño", "albarino",
    "semillon", "sémillon", "gewurztraminer", "gewürztraminer", "white"
  ];
  for (const k of whiteKeys) if (v.includes(k)) return "white";

  return "red";
}

function matchesTopTab(r, activeVarietal) {
  const tab = normLower(activeVarietal || "all");
  if (tab === "all") return true;
  return topTabForRecord(r) === tab;
}

export function getActiveVarietalFromHash() {
  const raw = (window.location.hash || "").replace("#", "").trim();
  return raw ? normLower(raw) : "all";
}
