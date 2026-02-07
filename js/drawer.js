import { escapeHtml, makeLocation, priceToDisplay, norm, normLower } from "./utils.js";

function withDollar(val) {
  const s = norm(val);
  if (!s) return "";
  if (normLower(s) === "mp") return "mp";
  if (s.startsWith("$")) return s;
  return `$${s}`;
}

export function openDrawer(item) {
  const backdrop = document.getElementById("drawer-backdrop");
  const drawer = document.getElementById("drawer");
  if (!backdrop || !drawer) return;

  const name = escapeHtml(item.name);
  const loc = escapeHtml(makeLocation(item));
  const varietal = escapeHtml(norm(item.varietal));
  const vintage = escapeHtml(norm(item.vintage));
  const bin = escapeHtml(norm(item.bin));
  const bottleRaw = priceToDisplay(item.bottle_price);
  const bottle = bottleRaw === "mp" ? "mp" : withDollar(bottleRaw);
  const desc = escapeHtml(norm(item.description));

  const bottleHtml = bottle === "mp" ? `<span class="mp">mp</span>` : escapeHtml(bottle);

  const pills = [];
  if (vintage) pills.push(`<span class="pill">Vintage: <b>${vintage}</b></span>`);
  if (bin) pills.push(`<span class="pill">Bin: <b>${bin}</b></span>`);
  if (bottle) pills.push(`<span class="pill">Bottle: <b>${bottleHtml}</b></span>`);

  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <div class="drawer-title">${name}</div>
        <div class="drawer-subtitle">${[vintage, varietal].filter(Boolean).join(" · ")}</div>
        ${loc ? `<div class="drawer-subtitle">${loc}</div>` : ``}
      </div>
      <button class="drawer-close" type="button" aria-label="Close">×</button>
    </div>

    ${pills.length ? `<div class="drawer-keyline">${pills.join("")}</div>` : ``}

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
