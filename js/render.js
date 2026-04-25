import {
  escapeHtml,
  cmpText,
  makeShortLocation,
  isYes,
  isNo,
  toInt,
  worldLabel,
  norm,
  normLower,
  priceToDisplay,
} from "./utils.js";
import { openDrawer, openDrawerHtml } from "./drawer.js";
import { DECIDER_STEPS, recommendWines } from "./recommend.js";

const REQUIRED = [
  "name",
  "type",
  "varietal",
  "world",
  "country",
  "region_1",
  "region_2",
  "bin",
  "vintage",
  "glass_price",
  "bottle_price",
  "collection",
  "staff_pick",
  "stock",
  "show",
  "description",
];

export function getStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = normLower(params.get("tab") || "all");
  const tab = ["all", "red", "white", "sparkling", "rose"].includes(requestedTab)
    ? requestedTab
    : "all";
  const varietal = normLower(params.get("varietal") || "");
  return { tab, varietal };
}

let activeJumpVarietal = "";

function setUrlState(next) {
  const params = new URLSearchParams(window.location.search);

  if (next.tab) params.set("tab", next.tab);
  else params.delete("tab");

  if (next.varietal) params.set("varietal", next.varietal);
  else params.delete("varietal");


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
    const row = { ...r };
    for (const key of REQUIRED) {
      row[key] = r[key] ?? r[key.toUpperCase?.()] ?? r[key.toLowerCase?.()] ?? "";
    }

    row.description_original = r.description_original || r.description || "";
    row.description_ai = r.description_ai || "";
    row.description_final = r.description_final || "";
    row.description = row.description_final || row.description_ai || row.description_original || row.description || "";

    row._id = r.id || `${idx}-${norm(row.name)}-${norm(row.bin)}`;
    row._binNum = toInt(row.bin) ?? 999999;

    row._varietal = canonicalVarietal(row.varietal);

    let t = normLower(row.type);
    if (t === "ros\u00e9") t = "rose";
    if (t === "ros\u00e9 wine") t = "rose";
    if (!["red", "white", "sparkling", "rose"].includes(t)) t = "red";
    row._type = t;

    row._collection = normLower(row.collection || "");

    row._world = normLower(worldLabel(row.world)).includes("old")
      ? "old"
      : normLower(worldLabel(row.world)).includes("new")
      ? "new"
      : normLower(row.world);

    row._country = norm(row.country);
    row._r1 = norm(row.region_1);
    row._r2 = norm(row.region_2);
    row._name = norm(row.name);

    return row;
  });
}

export function filterVisible(records) {
  return records.filter((r) => {
    if (normLower(r.available) && isNo(r.available)) return false;
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
    <button class="tab-btn ${active ? "is-active" : ""}" type="button" data-tab="${escapeHtml(
    id
  )}" aria-selected="${active ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>
  `;

  tabsEl.innerHTML = [
    `<span class="filter-label" aria-hidden="true">Mood</span>`,
    `<button class="tab-btn choose-btn" type="button" data-choose="true" aria-label="Help me decide by mood">Help Me Decide</button>`,
    `<span class="filter-label" aria-hidden="true">Category</span>`,
    btn("All", "all", current === "all"),
    btn("Red", "red", current === "red"),
    btn("White", "white", current === "white"),
    btn("Ros\u00e9", "rose", current === "rose"),
    btn("Sparkling", "sparkling", current === "sparkling"),
  ].join("");

  tabsEl.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const tab = el.getAttribute("data-tab") || "all";
      setUrlState({ tab, varietal: "" });
      window.dispatchEvent(new Event("hashchange"));
    });
  });

  const chooseBtn = tabsEl.querySelector("[data-choose]");
  if (chooseBtn) chooseBtn.addEventListener("click", () => openChooser(_varietals || []));
}

export function renderSubtabs(records, state) {
  const el = document.getElementById("subtabs");
  if (!el) return;

  const tab = normLower(state?.tab || "all");

  el.classList.add("hidden");
  el.innerHTML = "";

  const makeBtn = (label, key, active, kind) => `
    <button class="subtab-btn ${active ? "is-active" : ""}" type="button"
      data-kind="${escapeHtml(kind)}" data-key="${escapeHtml(key)}"
      aria-selected="${active ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>
  `;

  if (tab === "red" || tab === "white" || tab === "sparkling" || tab === "rose") {
    const filteredForType = records.filter((r) => topTabForRecord(r) === tab);

    const groups = getVarietalGroups(filteredForType, tab);
    const varietals = Object.keys(groups);
    if (varietals.length <= 1) return;

    el.classList.remove("hidden");

    const activeVar = normLower(state?.varietal || "");
    const jumpVar = activeJumpVarietal && varietals.includes(activeJumpVarietal) ? activeJumpVarietal : "";
    const parts = [
      `<span class="filter-label filter-label-sub" aria-hidden="true">Style</span>`,
      makeBtn("All", "", !jumpVar && !activeVar, "varietal"),
    ];

    for (const v of varietals) {
      parts.push(makeBtn(titleCase(v.replaceAll("_", " ")), v, jumpVar === v || activeVar === v, "varietal"));
    }

    el.innerHTML = parts.join("");

    el.querySelectorAll("[data-kind='varietal']").forEach((b) => {
      b.addEventListener("click", () => {
        const key = b.getAttribute("data-key") || "";
        activeJumpVarietal = key;
        renderSubtabs(records, { ...state, varietal: "" });
        scrollToCurrentSection(key);
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

  const cleaned = v
    .replaceAll("&", " and ")
    .replaceAll("/", " ")
    .replaceAll("-", " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  const rules = [
    { keys: ["syrah", "shiraz"], label: "Syrah/Shiraz" },
    { keys: ["grenache", "garnacha"], label: "Grenache/Garnacha" },
    { keys: ["red blend", "bordeaux blend", "rhône blend", "rhone blend"], label: "Red Blends" },
    { keys: ["white blend", "white bordeaux blend", "white rhône blend", "white rhone blend"], label: "White Blends" },
    { keys: ["champagne", "sparkling"], label: "Sparkling" },
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

  if (tab === "red" || tab === "white" || tab === "sparkling" || tab === "rose") {
    view = view.filter((r) => topTabForRecord(r) === tab);
  }

  const vSub = normLower(state?.varietal || "");
  if (vSub && (tab === "red" || tab === "white" || tab === "sparkling" || tab === "rose")) {
    view = view.filter((r) => normLower(r._varietal) === vSub);
  }

  const staff = view.filter((r) => isYes(r.staff_pick));
  const rest = view.filter((r) => !isYes(r.staff_pick));

  const html = [];

  if (staff.length) html.push(renderPinnedStaff(staff));

  const byVarietal = getVarietalGroups(rest, tab);

  const varietalKeys = Object.keys(byVarietal).sort((a, b) => {
    const ao = isOtherBucket(a) ? 1 : 0;
    const bo = isOtherBucket(b) ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return cmpText(a, b);
  });

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
      <div class="card empty-state">
        <div class="empty-state-kicker">Nothing matched</div>
        <div class="empty-state-title">Let's get you back to a good pour.</div>
        <p class="empty-state-copy">Try the full wine list, or use Help Me Decide for three options that fit the mood.</p>
        <div class="empty-state-actions">
          <button class="tab-btn choose-btn" type="button" data-empty-choose="true">Help Me Decide</button>
          <button class="tab-btn" type="button" data-empty-reset="true">Show Full List</button>
        </div>
      </div>
    `;
    attachEmptyStateHandlers(menuEl, records);
    return;
  }

  menuEl.innerHTML = html.join("");

  attachRowHandlers(menuEl, view);
}

function attachEmptyStateHandlers(menuEl, records) {
  const chooseBtn = menuEl.querySelector("[data-empty-choose]");
  const resetBtn = menuEl.querySelector("[data-empty-reset]");

  if (chooseBtn) {
    chooseBtn.addEventListener("click", () => openChooser(records || []));
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      activeJumpVarietal = "";
      setUrlState({ tab: "all", varietal: "" });
      window.dispatchEvent(new Event("hashchange"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function attachRowHandlers(menuEl, view) {
  menuEl.querySelectorAll(".table-row[data-id]").forEach((rowEl) => {
    const open = () => {
      const id = rowEl.getAttribute("data-id");
      const item = view.find((r) => r._id === id);
      if (item) openItem(item);
    };

    rowEl.addEventListener("click", open);
    rowEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open();
    });
  });
}

function openItem(item) {
  trackWineClick(item);
  openDrawer(item);
}

function trackWineClick(item) {
  if (typeof gtag !== "function") return;

  gtag("event", "wine_click", {
    wine_name: item.name,
    varietal: item.varietal,
    price: item.bottle_price,
    type: item.type,
  });
}

function openChooser(records) {
  const answers = {};
  const body = `
    <div class="chooser" data-step="0">
      <p class="chooser-intro">A few quick taps for three staff-ready picks from the current list.</p>
      <div class="chooser-step-title"></div>
      <button class="chooser-back" type="button" hidden>Back</button>
      <div class="chooser-options"></div>
      <div class="chooser-result" hidden></div>
      <p class="chooser-disclaimer">Suggestions use the current list; the service team can confirm availability and steer the final bottle.</p>
    </div>
  `;

  openDrawerHtml({
    title: "Help Me Decide",
    body,
    onOpen(drawer) {
      renderChooserStep(drawer, records, answers, 0);
    },
  });
}

function renderChooserStep(drawer, records, answers, index) {
  const titleEl = drawer.querySelector(".chooser-step-title");
  const backBtn = drawer.querySelector(".chooser-back");
  const optionsEl = drawer.querySelector(".chooser-options");
  const resultEl = drawer.querySelector(".chooser-result");
  if (!titleEl || !backBtn || !optionsEl || !resultEl) return;

  backBtn.hidden = index <= 0;
  backBtn.onclick = () => {
    const previousIndex = answers.type === "dessert" && DECIDER_STEPS[index]?.key === "budget"
      ? 0
      : Math.max(0, index - 1);
    renderChooserStep(drawer, records, answers, previousIndex);
  };

  if (index >= DECIDER_STEPS.length) {
    backBtn.hidden = false;
    renderChooserResults(records, answers, titleEl, optionsEl, resultEl);
    return;
  }

  const step = DECIDER_STEPS[index];
  titleEl.textContent = step.title;
  resultEl.hidden = true;
  resultEl.innerHTML = "";
  optionsEl.innerHTML = step.options.map((option) => `
    <button class="chooser-option" type="button" data-value="${escapeHtml(option.value)}">
      ${escapeHtml(option.label)}
    </button>
  `).join("");

  optionsEl.querySelectorAll(".chooser-option").forEach((button) => {
    button.addEventListener("click", () => {
      answers[step.key] = button.getAttribute("data-value") || "";
      if (step.key === "type" && answers.type === "dessert") {
        const budgetIndex = DECIDER_STEPS.findIndex((next) => next.key === "budget");
        renderChooserStep(drawer, records, answers, budgetIndex >= 0 ? budgetIndex : index + 1);
        return;
      }
      renderChooserStep(drawer, records, answers, index + 1);
    });
  });
}

function renderChooserResults(records, answers, titleEl, optionsEl, resultEl) {
  const recommendations = recommendWines(records, answers, 3);

  titleEl.textContent = "Staff-ready picks";
  optionsEl.innerHTML = "";
  resultEl.hidden = false;

  if (!recommendations.length) {
    resultEl.innerHTML = `
      <p>No tight match right now. Ask the service team for the closest bottle in the same style.</p>
    `;
    return;
  }

  resultEl.innerHTML = `
    <div class="recommendation-list">
      ${recommendations.map((item, index) => renderRecommendationCard(item, index)).join("")}
    </div>
  `;

  resultEl.querySelectorAll("[data-rec-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = recommendations.find((rec) => rec.wine._id === button.getAttribute("data-rec-id"));
      if (item) openItem(item.wine);
    });
  });
}

function renderRecommendationCard(item, index = 0) {
  const wine = item.wine;
  const bottle = priceToDisplay(wine.bottle_price);
  const glass = priceToDisplay(wine.glass_price);
  const price = glass ? `$${escapeHtml(glass)} glass` : bottle ? `$${escapeHtml(bottle)} bottle` : "Ask for price";
  const description = norm(wine.description_final || wine.description || wine.description_ai || wine.description_original);
  const shortDescription = description.length > 120 ? `${description.slice(0, 117).trim()}...` : description;
  const badge = index === 0 ? "First pick" : "Also works";

  return `
    <button class="recommendation-card" type="button" data-rec-id="${escapeHtml(wine._id)}">
      <span class="recommendation-topline">
        <span class="recommendation-badge">${badge}</span>
        <span class="recommendation-price">${price}</span>
      </span>
      <span class="recommendation-name">${escapeHtml(wine.name)}</span>
      <span class="recommendation-meta">${escapeHtml([wine.vintage, wine.varietal].filter(Boolean).join(" | "))}</span>
      <span class="recommendation-description">${escapeHtml(shortDescription || "A balanced, table-ready choice from the current list.")}</span>
      <span class="recommendation-why">${escapeHtml(item.why)}</span>
    </button>
  `;
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

function getVarietalGroups(rows, tab) {
  const grouped = groupBy(rows, (r) => r._varietal || "Other");
  const otherLabel =
    tab === "red" ? "Other Red" :
    tab === "white" ? "Other White" :
    tab === "sparkling" ? "Other Sparkling" :
    tab === "rose" ? "Other Ros\u00e9" :
    "Other";

  const merged = {};
  let otherRows = [];

  for (const [label, items] of Object.entries(grouped)) {
    if (label !== "Other" && items.length <= 2) otherRows = otherRows.concat(items);
    else merged[label] = items;
  }

  if (otherRows.length) merged[otherLabel] = (merged[otherLabel] || []).concat(otherRows);

  if (merged.Other && otherLabel !== "Other") {
    merged[otherLabel] = (merged[otherLabel] || []).concat(merged.Other);
    delete merged.Other;
  }

  return Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => {
      const ao = isOtherBucket(a) ? 1 : 0;
      const bo = isOtherBucket(b) ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return cmpText(a, b);
    })
  );
}

function scrollToCurrentSection(key) {
  requestAnimationFrame(() => {
    const target = key
      ? document.getElementById(slug(titleCase(key.replaceAll("_", " "))))
      : document.getElementById("menu");
    if (!target) return;
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"), 10) || 0;
    const y = target.getBoundingClientRect().top + window.scrollY - offset - 10;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
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

function mobileNoteSnippet(row) {
  const note = norm(row.description || row.description_final || row.description_ai);
  if (!note) return "";
  const firstSentence = note.match(/^[^.!?]+[.!?]/)?.[0] || note;
  return firstSentence.length > 92 ? `${firstSentence.slice(0, 89).trim()}...` : firstSentence;
}

function renderRow(r) {
  const name = escapeHtml(r._name);
  const loc = escapeHtml(makeShortLocation(r));
  const vintage = norm(r.vintage) ? escapeHtml(norm(r.vintage)) : "";
  const subtitle = [loc, vintage].filter(Boolean).join(" &middot; ");
  const style = norm(r.style);
  const mobileMeta = [norm(r.varietal), style ? `${style} style` : ""].filter(Boolean).join(" · ");
  const mobileNote = mobileNoteSnippet(r);
  const mobileDetailsHtml = mobileMeta || mobileNote
    ? `
        <div class="mobile-card-details">
          ${mobileMeta ? `<span>${escapeHtml(mobileMeta)}</span>` : ""}
          ${mobileNote ? `<span>${escapeHtml(mobileNote)}</span>` : ""}
        </div>`
    : "";

  const bottleRaw = priceToDisplay(r.bottle_price);
  const bottle = bottleRaw === "mp" ? "mp" : withDollar(bottleRaw);
  const bottleHtml = bottle === "mp" ? `<span class="mp">mp</span>` : escapeHtml(bottle || "");

  const star = isYes(r.staff_pick) ? `<span class="tag">Staff</span>` : "";

  return `
    <div class="table-row" data-id="${escapeHtml(r._id)}" role="button" tabindex="0">
      <div class="cell bin">${escapeHtml(norm(r.bin) || "-")}</div>
      <div class="cell name">
        <div class="name-line">
          <div class="name-text">${name}</div>
          ${star}
        </div>
        <div class="subtext">${subtitle || ""}</div>
        ${mobileDetailsHtml}
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
  const t = normLower(r._type || r.type || "");
  if (t === "ros\u00e9") return "rose";
  if (t === "rose") return "rose";
  if (t === "white") return "white";
  if (t === "sparkling") return "sparkling";
  return "red";
}
