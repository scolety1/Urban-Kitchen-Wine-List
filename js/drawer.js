import { escapeHtml, makeLocation, priceToDisplay, worldLabel, norm } from "./utils.js";

export function openDrawer(item) {
  const backdrop = document.getElementById("drawer-backdrop");
  const drawer = document.getElementById("drawer");
  if (!backdrop || !drawer) return;

  const name = escapeHtml(item.name);
  const loc = escapeHtml(makeLocation(item));
  const varietal = escapeHtml(norm(item.varietal));
  const world = escapeHtml(worldLabel(item.world));
  const vintage = escapeHtml(norm(item.vintage));
  const bin = escapeHtml(norm(item.bin));
  const glass = priceToDisplay(item.glass_price);
  const bottle = priceToDisplay(item.bottle_price);
  const desc = escapeHtml(norm(item.description));

  const glassHtml = glass === "mp" ? `<span class="mp">mp</span>` : escapeHtml(glass);
  const bottleHtml = bottle === "mp" ? `<span class="mp">mp</span>` : escapeHtml(bottle);

  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <div class="drawer-title">${name}</div>
        <div class="drawer-subtitle">${[vintage, varietal, world].filter(Boolean).join(" · ")}</div>
        ${loc ? `<div class="drawer-subtitle">${loc}</div>` : ``}
      </div>
      <button class="drawer-close" type="button" aria-label="Close">×</button>
    </div>

    <div class="drawer-grid">
      <div class="drawer-metric">
        <div class="metric-label">Bin</div>
        <div class="metric-value">${bin || "—"}</div>
      </div>
      <div class="drawer-metric">
        <div class="metric-label">Vintage</div>
        <div class="metric-value">${vintage || "—"}</div>
      </div>
      <div class="drawer-metric">
        <div class="metric-label">Glass</div>
        <div class="metric-value">${glassHtml || "—"}</div>
      </div>
      <div class="drawer-metric">
        <div class="metric-label">Bottle</div>
        <div class="metric-value">${bottleHtml || "—"}</div>
      </div>
    </div>

    <div class="drawer-notes">
      <div class="drawer-notes-title">Description</div>
      <div class="drawer-notes-text">${desc || "—"}</div>
    </div>
  `;

  document.body.classList.add("drawer-open");

  const closeBtn = drawer.querySelector(".drawer-close");
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  backdrop.addEventListener("click", closeDrawer);

  window.addEventListener("keydown", onEsc, { once: true });
}

export function closeDrawer() {
  const backdrop = document.getElementById("drawer-backdrop");
  if (backdrop) backdrop.removeEventListener("click", closeDrawer);
  document.body.classList.remove("drawer-open");
}

function onEsc(e) {
  if (e.key === "Escape") closeDrawer();
}
