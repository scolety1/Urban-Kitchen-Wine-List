import { parseCSV } from "./csv.js";
import { escapeHtml } from "./utils.js";
import {
  categoriesFor,
  categoryId,
  menuStatusCopy,
  priceLabel,
  resolveWhiskeyDataset,
} from "./whiskey-menu.js";

const tabs = document.getElementById("tabs");
const menu = document.getElementById("menu");
const status = document.getElementById("status");
let rows = [];
let activeCategory = "All";

function setStatus(message, state = "loading") {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function renderTabs() {
  const categories = ["All", ...categoriesFor(rows)];
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Whiskey categories");
  tabs.innerHTML = categories
    .map(
      (category) => `
        <button
          class="tab-btn${category === activeCategory ? " is-active" : ""}"
          type="button"
          role="tab"
          aria-selected="${category === activeCategory}"
          data-whiskey-category="${escapeHtml(category)}"
        >${escapeHtml(category)}</button>`,
    )
    .join("");

  tabs.querySelectorAll("[data-whiskey-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.whiskeyCategory;
      renderTabs();
      renderMenu();
    });
  });
}

function renderMenu() {
  const visible =
    activeCategory === "All" ? rows : rows.filter((row) => row.category === activeCategory);
  const groups = activeCategory === "All" ? categoriesFor(visible) : [activeCategory];

  menu.innerHTML = groups
    .map((category) => {
      const items = visible.filter((row) => row.category === category);
      const headingId = categoryId(category);
      return `
        <section class="section whiskey-section" aria-labelledby="${headingId}">
          <div class="varietal-header">
            <h2 class="varietal-title" id="${headingId}">${escapeHtml(category)}</h2>
            <span class="varietal-meta">${items.length} ${items.length === 1 ? "selection" : "selections"}</span>
          </div>
          <div class="whiskey-table-head" aria-hidden="true">
            <span>Whiskey</span>
            <span>Price</span>
          </div>
          <div class="whiskey-list">
            ${items
              .map(
                (item) => `
                  <div class="whiskey-row">
                    <span class="whiskey-name">${escapeHtml(item.name)}</span>
                    <span class="whiskey-price" aria-label="Price ${escapeHtml(priceLabel(item.price))}">${escapeHtml(priceLabel(item.price))}</span>
                  </div>`,
              )
              .join("")}
          </div>
        </section>`;
    })
    .join("");
}

async function init() {
  setStatus(menuStatusCopy("loading"));
  try {
    const response = await fetch("data/whiskey.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`Whiskey data returned ${response.status}.`);
    const parsed = parseCSV(await response.text());
    const resolved = resolveWhiskeyDataset(parsed);
    rows = resolved.rows;
    if (resolved.state === "empty") {
      setStatus(menuStatusCopy("empty"), "empty");
      return;
    }

    renderTabs();
    renderMenu();
    setStatus("", "ready");
  } catch (error) {
    console.error(error);
    menu.replaceChildren();
    setStatus(menuStatusCopy("error"), "error");
  }
}

init();
