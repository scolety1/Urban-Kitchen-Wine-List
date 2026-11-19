import { escapeHtml, makeLocation, priceToDisplay, norm, normLower } from "./utils.js";

let drawerOpener = null;
let previousOverflow = "";
let backgroundState = [];

function withDollar(val) {
  const s = norm(val);
  if (!s) return "";
  if (normLower(s) === "mp") return "mp";
  if (s.startsWith("$")) return s;
  return `$${s}`;
}

export function openDrawer(item) {
  openDrawerHtml({
    title: escapeHtml(item.name),
    subtitle: renderItemSubtitle(item),
    keyline: renderItemPills(item),
    body: renderItemDescription(item),
  });
}

export function openDrawerHtml({ title, subtitle = "", keyline = "", body = "", onOpen } = {}) {
  const backdrop = document.getElementById("drawer-backdrop");
  const drawer = document.getElementById("drawer");
  if (!backdrop || !drawer) return;

  if (!document.body.classList.contains("drawer-open")) {
    drawerOpener = document.activeElement;
    previousOverflow = document.body.style.overflow || "";
    backgroundState = ["top-bar", "content"]
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((element) => ({ element, inert: element.hasAttribute("inert") }));
    for (const { element } of backgroundState) element.setAttribute("inert", "");
  }
  drawer.removeAttribute("inert");
  drawer.removeAttribute("aria-hidden");
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "drawer-title");
  drawer.setAttribute("tabindex", "-1");

  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <div class="drawer-title" id="drawer-title">${title || ""}</div>
        ${subtitle}
      </div>
      <button class="drawer-close" type="button" aria-label="Close">&times;</button>
    </div>

    ${keyline}
    ${body}
  `;

  document.body.classList.add("drawer-open");
  document.body.style.overflow = "hidden";

  const closeBtn = drawer.querySelector(".drawer-close");
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  backdrop.addEventListener("click", closeDrawer);

  window.removeEventListener("keydown", onDrawerKeydown);
  window.addEventListener("keydown", onDrawerKeydown);

  if (typeof onOpen === "function") onOpen(drawer);
  drawer.focus();
}

function renderItemSubtitle(item) {
  const loc = escapeHtml(makeLocation(item));
  const varietal = escapeHtml(norm(item.varietal));
  const vintage = escapeHtml(norm(item.vintage));
  return `
    <div class="drawer-subtitle">${[vintage, varietal].filter(Boolean).join(" &middot; ")}</div>
    ${loc ? `<div class="drawer-subtitle">${loc}</div>` : ``}
  `;
}

function renderItemPills(item) {
  const vintage = escapeHtml(norm(item.vintage));
  const bin = escapeHtml(norm(item.bin));
  const bottleRaw = priceToDisplay(item.bottle_price);
  const bottle = bottleRaw === "mp" ? "mp" : withDollar(bottleRaw);
  const bottleHtml = bottle === "mp" ? `<span class="mp">mp</span>` : escapeHtml(bottle);

  const pills = [];
  if (vintage) pills.push(`<span class="pill">Vintage: <b>${vintage}</b></span>`);
  if (bin) pills.push(`<span class="pill">Bin: <b>${bin}</b></span>`);
  if (bottle) pills.push(`<span class="pill">Bottle: <b>${bottleHtml}</b></span>`);

  return pills.length ? `<div class="drawer-keyline">${pills.join("")}</div>` : "";
}

function renderItemDescription(item) {
  const desc = escapeHtml(norm(item.description));
  return `
    <div class="drawer-notes">
      <div class="drawer-notes-title">Description</div>
      <div class="drawer-notes-text">${desc || "-"}</div>
    </div>
  `;
}

export function closeDrawer() {
  if (!document.body.classList.contains("drawer-open")) return;
  const backdrop = document.getElementById("drawer-backdrop");
  if (backdrop) backdrop.removeEventListener("click", closeDrawer);
  window.removeEventListener("keydown", onDrawerKeydown);
  document.body.classList.remove("drawer-open");
  document.body.style.overflow = previousOverflow;
  const drawer = document.getElementById("drawer");
  drawer?.setAttribute("inert", "");
  drawer?.setAttribute("aria-hidden", "true");
  for (const { element, inert } of backgroundState) {
    if (!inert) element.removeAttribute("inert");
  }
  backgroundState = [];
  if (drawerOpener && document.documentElement.contains(drawerOpener)) drawerOpener.focus();
  drawerOpener = null;
}

function onDrawerKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDrawer();
    return;
  }
  if (event.key !== "Tab") return;
  const drawer = document.getElementById("drawer");
  const items = [...drawer.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")]
    .filter((element) => !element.disabled && element.getAttribute("tabindex") !== "-1" && !element.closest("[hidden]"));
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement;
  if (!first) {
    event.preventDefault();
    drawer.focus();
  } else if (!drawer.contains(current) || (current === drawer && !event.shiftKey)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (current === first || current === drawer)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}
