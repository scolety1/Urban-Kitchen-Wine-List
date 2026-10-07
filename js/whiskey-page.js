// Pure presentation helpers for the Whiskey menu page.

import { escapeHtml } from "./utils.js";
import { categoriesFor, categoryId, priceLabel } from "./whiskey-menu.js";

export const DEFAULT_CATEGORY = "Bourbon";

export function sortRowsAz(rows) {
  return [...rows].sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.sourceId - b.sourceId,
  );
}

export function defaultCategory(rows) {
  return rows.some((row) => row.category === DEFAULT_CATEGORY) ? DEFAULT_CATEGORY : "All";
}

export function renderTabsHtml(rows, activeCategory) {
  return ["All", ...categoriesFor(rows)]
    .map(
      (category) => `
        <button
          class="tab-btn${category === activeCategory ? " is-active" : ""}"
          type="button"
          aria-pressed="${category === activeCategory}"
          data-whiskey-category="${escapeHtml(category)}"
        >${escapeHtml(category)}</button>`,
    )
    .join("");
}

export function renderMenuHtml(rows, activeCategory) {
  const visible = activeCategory === "All" ? rows : rows.filter((row) => row.category === activeCategory);
  const groups = activeCategory === "All" ? categoriesFor(visible) : [activeCategory];
  const sorted = sortRowsAz(visible);

  return groups
    .map((category) => {
      const items = sorted.filter((row) => row.category === category);
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
                    <button type="button" class="whiskey-name-btn" data-detail-id="${item.sourceId}" aria-haspopup="dialog">${escapeHtml(item.name)}</button>
                    <span class="whiskey-price" aria-label="Price ${escapeHtml(priceLabel(item.price))}">${escapeHtml(priceLabel(item.price))}</span>
                  </div>`,
              )
              .join("")}
          </div>
        </section>`;
    })
    .join("");
}
