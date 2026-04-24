import { parseCSV } from "./csv.js";
import {
  validateHeaders,
  normalizeRecords,
  filterVisible,
  renderTabs,
  renderSubtabs,
  renderMenu,
  getStateFromUrl
} from "./render.js";

const statusId = "status";

function setStatus(msg) {
  let el = document.getElementById(statusId);
  if (!el) {
    el = document.createElement("div");
    el.id = statusId;
    el.className = "card";
    el.style.padding = "14px";
    el.style.margin = "14px var(--pad)";
    el.style.color = "var(--muted)";
    el.style.fontWeight = "650";
    const content = document.getElementById("content");
    if (content) content.prepend(el);
  }
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.text();
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function syncTopbarHeight() {
  const topbar = document.getElementById("top-bar");
  if (!topbar) return;

  const h = Math.ceil(topbar.getBoundingClientRect().height);
  const curr = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 0;

  if (Math.abs(h - curr) >= 1) {
    document.documentElement.style.setProperty("--topbar-h", `${h}px`);
  }
}


function dataPathForMenu() {
  const type = document.body?.dataset?.menu || "wine";
  return type === "whiskey" ? "data/whiskey.csv" : "data/wines.csv";
}

function syncCompactHeader() {
  const topbar = document.getElementById("top-bar");
  if (!topbar) return;
  const compact = window.scrollY > 28;
  if (topbar.classList.toggle("is-compact", compact)) {
    requestAnimationFrame(syncTopbarHeight);
  }
}

function attachIntroHandlers() {
  const chooseBtn = document.querySelector("[data-intro-choose]");
  const browseBtn = document.querySelector("[data-intro-browse]");

  if (chooseBtn) {
    chooseBtn.addEventListener("click", () => {
      document.querySelector("[data-choose]")?.click();
    });
  }

  if (browseBtn) {
    browseBtn.addEventListener("click", () => {
      const menu = document.getElementById("menu");
      if (!menu) return;
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"), 10) || 0;
      const y = menu.getBoundingClientRect().top + window.scrollY - offset - 10;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    });
  }
}

function jsonPathForMenu() {
  const type = document.body?.dataset?.menu || "wine";
  return type === "whiskey" ? "" : "data/wines.json";
}

let ALL = [];

window.addEventListener("hashchange", () => {
  if (!ALL.length) return;
  renderFromUrl();
});

window.addEventListener("popstate", () => {
  if (!ALL.length) return;
  renderFromUrl();
});

function renderFromUrl() {
  const state = getStateFromUrl();
  renderTabs(ALL, state.tab);
  renderSubtabs(ALL, state);
  syncTopbarHeight();

  renderMenu(ALL, state);
}

async function init() {
  try {
    syncTopbarHeight();
    addEventListener("resize", syncTopbarHeight);
    addEventListener("scroll", syncCompactHeader, { passive: true });
    syncCompactHeader();
    attachIntroHandlers();

    setStatus("Loading menu...");

    let records = [];
    const jsonPath = jsonPathForMenu();

    if (jsonPath) {
      try {
        records = await loadJSON(jsonPath);
      } catch (e) {
        console.warn("Frontend JSON unavailable; falling back to CSV.", e);
      }
    }

    if (!records.length) {
      const csvText = await loadCSV(dataPathForMenu());
      const parsed = parseCSV(csvText);
      const { headers } = parsed;
      records = parsed.records;

      if (!headers.length && !records.length) {
        setStatus("No menu items are available right now.");
        return;
      }

      const missing = validateHeaders(headers);
      if (missing.length) {
        setStatus(`Menu file is missing columns: ${missing.join(", ")}`);
        return;
      }
    }

    const normalized = normalizeRecords(records);
    const visible = filterVisible(normalized);

    ALL = visible;

    renderFromUrl();

    setStatus("");
  } catch (e) {
    setStatus("Menu failed to load. Please check the CSV file and try again.");
    console.error(e);
  }
}

init();
