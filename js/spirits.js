import { prepareSpirits, priceLabel, spiritCategories, spiritsStatusCopy } from "./spirits-menu.js";

const tabs = document.getElementById("spirits-tabs");
const menu = document.getElementById("spirits-menu");
const picks = document.getElementById("shot-picks");
const status = document.getElementById("spirits-status");
const topbar = document.getElementById("top-bar");
let rows = [];
let activeFamily = "All";

const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function setStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function syncTopbarHeight() {
  document.documentElement.style.setProperty("--topbar-h", `${Math.ceil(topbar.getBoundingClientRect().height)}px`);
}

function renderTabs() {
  tabs.innerHTML = spiritCategories(rows).map((family) => `<button class="tab-btn${family === activeFamily ? " is-active" : ""}" type="button" data-spirit-family="${esc(family)}" aria-pressed="${family === activeFamily}">${esc(family)}</button>`).join("");
  tabs.querySelectorAll("[data-spirit-family]").forEach((button) => button.addEventListener("click", () => {
    activeFamily = button.dataset.spiritFamily;
    renderTabs();
    renderMenu();
  }));
}

function spiritCard(row) {
  const details = [row.style, row.region, row.pourSize].filter(Boolean).join(" · ");
  return `<article class="spirit-card"><div><h2>${esc(row.name)}</h2>${details ? `<p class="spirit-meta">${esc(details)}</p>` : ""}${row.description ? `<p class="spirit-description">${esc(row.description)}</p>` : ""}</div><strong class="spirit-price">${esc(priceLabel(row.price))}</strong></article>`;
}

function renderMenu() {
  const visible = activeFamily === "All" ? rows : rows.filter((row) => row.family === activeFamily);
  menu.innerHTML = visible.length ? visible.map(spiritCard).join("") : `<p class="spirits-empty">No ${esc(activeFamily)} selections are published right now.</p>`;
}

function renderPicks() {
  const featured = rows.filter((row) => row.featuredShot);
  picks.hidden = featured.length === 0;
  picks.querySelector("[data-shot-picks-list]").innerHTML = featured.map((row) => `<article class="shot-card"><div><h2>${esc(row.name)}</h2>${row.shotNote ? `<p>${esc(row.shotNote)}</p>` : ""}</div><strong>${esc(priceLabel(row.shotPrice ?? row.price))}</strong></article>`).join("");
}

async function init() {
  setStatus(spiritsStatusCopy("loading"));
  try {
    const response = await fetch("../data/spirits.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Spirits data returned ${response.status}.`);
    rows = prepareSpirits(await response.json());
    if (!rows.length) { setStatus(spiritsStatusCopy("empty")); syncTopbarHeight(); return; }
    renderTabs();
    renderPicks();
    renderMenu();
    setStatus("");
    syncTopbarHeight();
  } catch (error) {
    console.error(error);
    setStatus(spiritsStatusCopy("error"));
  }
}

addEventListener("resize", syncTopbarHeight);
if (typeof ResizeObserver === "function") new ResizeObserver(syncTopbarHeight).observe(topbar);
init();
