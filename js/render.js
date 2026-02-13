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

export function getStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = normLower(params.get("tab") || "all");
  const varietal = normLower(params.get("varietal") || "");
  const special = normLower(params.get("special") || "");
  return { tab, varietal, special };
}

function setUrlState(next) {
  const params = new URLSearchParams(window.location.search);

  if (next.tab) params.set("tab", next.tab); else params.delete("tab");
  if (next.varietal) params.set("varietal", next.varietal); else params.delete("varietal");
  if (next.special) params.set("special", next.special); else params.delete("special");

  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
  history.pushState(null, "", url);
}


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
    row._varietal = canonicalVarietal(row.varietal);
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

export function renderTabs(_varietals, activeTab) {
  const tabsEl = document.getElementById("tabs");
  if (!tabsEl) return;

  const current = normLower(activeTab || "all");

  const btn = (label, id, active) => `
    <button class="tab-btn ${active ? "is-active" : ""}" type="button" data-tab="${escapeHtml(id)}" aria-selected="${active ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>
  `;

  tabsEl.innerHTML = [
    btn("All", "all", current === "all"),
    btn("Red", "red", current === "red"),
    btn("White", "white", current === "white"),
    btn("Sparkling", "sparkling", current === "sparkling"),
    btn("Specials", "specials", current === "specials"),
  ].join("");

  tabsEl.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const tab = el.getAttribute("data-tab") || "all";
      setUrlState({ tab, varietal: "", special: tab === "specials" ? "featured" : "" });
      window.dispatchEvent(new Event("hashchange"));
    });
  });
}

export function renderSubtabs(records, state) {
  const el = document.getElementById("subtabs");
  if (!el) return;

  const tab = normLower(state.tab || "all");

  // hide by default
  el.classList.add("hidden");
  el.innerHTML = "";

  const makeBtn = (label, key, active, kind) => `
    <button class="subtab-btn ${active ? "is-active" : ""}" type="button"
      data-kind="${escapeHtml(kind)}" data-key="${escapeHtml(key)}"
      aria-selected="${active ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>
  `;

  // Varietal subtabs for red/white/sparkling
  if (tab === "red" || tab === "white" || tab === "sparkling") {
    const filteredForType = records.filter((r) => topTabForRecord(r) === tab);
    const varietals = Array.from(new Set(filteredForType.map((r) => normLower(r._varietal)).filter(Boolean)))
      .sort((a, b) => cmpText(a, b));

    el.classList.remove("hidden");

    const activeVar = normLower(state.varietal || "");
    const parts = [makeBtn("All", "", !activeVar, "varietal")];
    for (const v of varietals) parts.push(makeBtn(titleCase(v.replaceAll("_", " ")), v, activeVar === v, "varietal"));

    el.innerHTML = parts.join("");

    el.querySelectorAll("[data-kind='varietal']").forEach((b) => {
      b.addEventListener("click", () => {
        const key = b.getAttribute("data-key") || "";
        setUrlState({ tab, varietal: key, special: "" });
        window.dispatchEvent(new Event("hashchange"));
      });
    });

    return;
  }

  // Specials subtabs
  if (tab === "specials") {
    el.classList.remove("hidden");

    const activeSpecial = normLower(state.special || "");
    const parts = [
      makeBtn("Featured", "featured", activeSpecial === "featured", "special"),
      makeBtn("High Roller", "high_roller", activeSpecial === "high_roller", "special"),
      makeBtn("Valentine’s", "valentines", activeSpecial === "valentines", "special"),
    ];

    el.innerHTML = parts.join("");

    el.querySelectorAll("[data-kind='special']").forEach((b) => {
      b.addEventListener("click", () => {
        const key = b.getAttribute("data-key") || "";
        setUrlState({ tab: "specials", varietal: "", special: key });
        window.dispatchEvent(new Event("hashchange"));
      });
    });

    return;
  }
}

function titleCase(s) {
  return String(s || "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function canonicalVarietal(raw) {
  const v = normLower(raw);

  if (!v) return "";

  // basic cleanup
  const cleaned = v
    .replaceAll("&", " and ")
    .replaceAll("/", " ")
    .replaceAll("-", " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  // synonyms (expand anytime)
  const rules = [
    { keys: ["syrah", "shiraz"], label: "Syrah/Shiraz" },
    { keys: ["grenache", "garnacha"], label: "Grenache/Garnacha" },
  ];

  for (const r of rules) {
    for (const k of r.keys) {
      if (cleaned.includes(k)) return r.label;
    }
  }

  return titleCase(cleaned);
}

function isOtherBucket(label) {
  return normLower(label).startsWith("other ");
}

export function renderMenu(records, state) {
  const menuEl = document.getElementById("menu");
  if (!menuEl) return;

  const tab = normLower(state?.tab || "all");
  let view = records.slice();

  if (tab === "red" || tab === "white" || tab === "sparkling") {
    view = view.filter((r) => topTabForRecord(r) === tab);
  } else if (tab === "specials") {
    view = view.filter((r) => matchesSpecial(r, state?.special));
  }

  const vSub = normLower(state?.varietal || "");
  if (vSub && (tab === "red" || tab === "white" || tab === "sparkling")) {
    view = view.filter((r) => normLower(r._varietal) === vSub);
  }

  const staff = view.filter((r) => isYes(r.staff_pick));
  const rest = view.filter((r) => !isYes(r.staff_pick));

  let byVarietal = groupBy(rest, (r) => r._varietal || "Other");

  const otherLabel =
    tab === "red" ? "Other Red" :
    tab === "white" ? "Other White" :
    tab === "sparkling" ? "Other Sparkling" :
    "Other";

  const merged = {};
  let otherRows = [];

  for (const [k, rows] of Object.entries(byVarietal)) {
    if (k !== "Other" && rows.length <= 2) {
      otherRows = otherRows.concat(rows);
    } else {
      merged[k] = rows;
    }
  }

  if (otherRows.length) {
    merged[otherLabel] = (merged[otherLabel] || []).concat(otherRows);
  }

  // ensure any existing plain "Other" also rolls into the typed label when in a type tab
  if (merged["Other"] && otherLabel !== "Other") {
    merged[otherLabel] = (merged[otherLabel] || []).concat(merged["Other"]);
    delete merged["Other"];
  }

  byVarietal = merged;

  const varietalKeys = Object.keys(byVarietal).sort((a, b) => {
    // keep typed "Other X" at the bottom
    const ao = isOtherBucket(a) ? 1 : 0;
    const bo = isOtherBucket(b) ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return cmpText(a, b);
  });

  const html = [];

  if (staff.length) {
    html.push(renderPinnedStaff(staff));
  }

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
      const item = view.find((r) => r._id === id);
      if (item) openDrawer(item);
    });
  });
}


function renderPinnedStaff(rows) {
  const sorted = rows.slice().sort((a, b) => (a._binNum ?? 999999) - (b._binNum ?? 999999));
  const rowsHtml = sorted.map((r) => renderRow(r)).join("");

  return `
    <section class="section" id="staff-picks">
      <div class="sticky-stack">
        <div class="varietal-header">
          <div class="varietal-title">Staff Picks</div>
        </div>
        <div class="table-head">
          <div>Bin</div>
          <div>Wine</div>
          <div style="text-align:right;">Bottle</div>
        </div>
      </div>
      <div class="section-body">
        ${rowsHtml}
      </div>
    </section>
  `;
}

function matchesSpecial(r, specialKey) {
  const key = normLower(specialKey || "");
  if (!key) return false;

  const notes = normLower(r.internal_notes || "");
  if (!notes) return false;

  if (key === "high_roller") return notes.includes("high_roller") || notes.includes("high roller") || notes.includes("highroller");
  if (key === "valentines") return notes.includes("valentine") || notes.includes("valentines");
  if (key === "featured") return notes.includes("featured");

  return false;
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

  // Sparkling first
  if (
    v.includes("sparkling") ||
    v.includes("champagne") ||
    v.includes("prosecco") ||
    v.includes("cava") ||
    v.includes("cremant") ||
    v.includes("crémant")
  ) return "sparkling";

  // Red-first keys (prevents "sauvignon" inside cab sauv from misclassifying)
  const redKeys = [
    "cabernet sauvignon", "cabernet", "cab", "merlot", "pinot noir",
    "syrah", "shiraz", "grenache", "garnacha", "tempranillo",
    "malbec", "sangiovese", "nebbiolo", "barbera", "zinfandel",
    "primitivo", "petite sirah", "mourvedre", "monastrell",
    "cinsault", "carignan", "mencia", "agiorgitiko", "gamay"
  ];
  for (const k of redKeys) if (v.includes(k)) return "red";

  // White keys
  const whiteKeys = [
    "chardonnay", "sauvignon blanc", "riesling", "pinot gris", "pinot grigio", "moscato",
    "chenin", "viognier", "verdejo", "vermentino", "gruner", "grüner", "albariño", "albarino",
    "semillon", "sémillon", "gewurztraminer", "gewürztraminer", "white"
  ];
  for (const k of whiteKeys) if (v.includes(k)) return "white";

  return "red";
}
