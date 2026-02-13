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
  renderTabs([], state.tab);
  renderSubtabs(ALL, state);
  syncTopbarHeight();

  renderMenu(ALL, state);
}

async function init() {
  try {
    syncTopbarHeight();
    addEventListener("resize", syncTopbarHeight);

    setStatus("Loading menu…");

    const csvText = await loadCSV(dataPathForMenu());
    const { headers, records } = parseCSV(csvText);

    const missing = validateHeaders(headers);
    if (missing.length) {
      setStatus(`Menu file is missing columns: ${missing.join(", ")}`);
      return;
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
