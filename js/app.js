import { parseCSV } from "./csv.js";
import { validateHeaders, normalizeRecords, filterVisible, getVarietals, renderTabs, renderMenu, getActiveVarietalFromHash } from "./render.js";

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

function dataPathForMenu() {
  const type = document.body?.dataset?.menu || "wine";
  return type === "whiskey" ? "data/whiskey.csv" : "data/wines.csv";
}

let ALL = [];

async function init() {
  try {
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

    const varietals = getVarietals(ALL);
    const active = getActiveVarietalFromHash();

    renderTabs(varietals, active);
    renderMenu(ALL, active);

    setStatus("");
  } catch (e) {
    setStatus("Menu failed to load. Please check the CSV file and try again.");
    console.error(e);
  }
}

window.addEventListener("hashchange", () => {
  if (!ALL.length) return;
  const active = getActiveVarietalFromHash();
  const varietals = getVarietals(ALL);
  renderTabs(varietals, active);
  renderMenu(ALL, active);

  if (active && active !== "all") {
    const el = document.getElementById(active);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

init();
