import {
  menuStatusCopy,
  parseWhiskeyCsv,
  resolveWhiskeyDataset,
} from "./whiskey-menu.js";
import { loadWhiskeyMetadata } from "./whiskey-metadata.js";
import { openDetail } from "./whiskey-detail.js";
import { openPicker } from "./whiskey-picker.js";
import { buildPicks, renderPicksHtml } from "./whiskey-picks.js";
import { defaultCategory, renderMenuHtml, renderTabsHtml } from "./whiskey-page.js";

const tabs = document.getElementById("tabs");
const menu = document.getElementById("menu");
const status = document.getElementById("status");
const topbar = document.getElementById("top-bar");
const content = document.getElementById("content");
const picks = document.getElementById("picks");
const pickerButton = document.getElementById("help-me-decide");
let rows = [];
let activeCategory = "All";
let metadata = { ok: false, errors: [], byId: {} };

function setStatus(message, state = "loading") {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function syncTopbarHeight() {
  if (!topbar) return;
  const height = Math.ceil(topbar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--topbar-h", `${height}px`);
}

function updateFilterButtons() {
  tabs.querySelectorAll("[data-whiskey-category]").forEach((button) => {
    const selected = button.dataset.whiskeyCategory === activeCategory;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderTabs() {
  tabs.setAttribute("aria-label", "Whiskey categories");
  tabs.innerHTML = renderTabsHtml(rows, activeCategory);

  tabs.querySelectorAll("[data-whiskey-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.whiskeyCategory;
      updateFilterButtons();
      renderMenu();
    });
  });
}

function renderMenu() {
  menu.innerHTML = renderMenuHtml(rows, activeCategory);
}

function renderPicks() {
  picks.innerHTML = metadata.ok ? renderPicksHtml(buildPicks(rows, metadata.byId)) : "";
}

content.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail-id]");
  if (!button) return;
  const id = Number(button.dataset.detailId);
  const row = rows.find((candidate) => candidate.sourceId === id);
  if (row) openDetail(document, row, metadata.ok ? metadata.byId[id] : undefined, { opener: button });
});

pickerButton?.addEventListener("click", () => {
  openPicker(document, {
    rows,
    metaById: metadata.byId,
    vocabulary: metadata.vocabulary,
    available: metadata.ok,
    opener: pickerButton,
  });
});

async function init() {
  setStatus(menuStatusCopy("loading"));
  try {
    const response = await fetch("data/whiskey.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`Whiskey data returned ${response.status}.`);
    const parsed = parseWhiskeyCsv(await response.text());
    const resolved = resolveWhiskeyDataset(parsed);
    rows = resolved.rows;
    if (resolved.state === "empty") {
      setStatus(menuStatusCopy("empty"), "empty");
      return;
    }

    metadata = await loadWhiskeyMetadata(rows);
    if (!metadata.ok) console.error("Whiskey details unavailable:", metadata.errors);
    activeCategory = defaultCategory(rows);
    renderTabs();
    renderPicks();
    renderMenu();
    syncTopbarHeight();
    setStatus("", "ready");
    if (pickerButton) pickerButton.disabled = false;
  } catch (error) {
    console.error(error);
    menu.replaceChildren();
    setStatus(menuStatusCopy("error"), "error");
  }
}

syncTopbarHeight();
addEventListener("resize", syncTopbarHeight);
if (typeof ResizeObserver === "function" && topbar) {
  new ResizeObserver(syncTopbarHeight).observe(topbar);
}
init();
