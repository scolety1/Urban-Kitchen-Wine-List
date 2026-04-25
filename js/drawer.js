import { escapeHtml, makeLocation, priceToDisplay, norm, normLower } from "./utils.js";

let previousFocus = null;
const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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

  const activeEl = document.activeElement;
  previousFocus = activeEl instanceof HTMLElement && activeEl !== document.body && !drawer.contains(activeEl)
    ? activeEl
    : previousFocus;

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

  const closeBtn = drawer.querySelector(".drawer-close");
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  backdrop.addEventListener("click", closeDrawer);

  window.removeEventListener("keydown", onDrawerKeydown);
  window.addEventListener("keydown", onDrawerKeydown);

  if (typeof onOpen === "function") onOpen(drawer);

  closeBtn?.focus({ preventScroll: true });
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
  const guide = renderSelectionGuide(item);
  return `
    <div class="drawer-notes">
      <div class="drawer-notes-title">Description</div>
      <div class="drawer-notes-text">${desc || "-"}</div>
    </div>
    ${guide}
  `;
}

function renderSelectionGuide(item) {
  const cards = [
    ["Why choose it", chooseReason(item)],
    ["Pairing cue", pairingCue(item)],
    ["Staff talking point", staffTalkingPoint(item)],
  ].filter(([, text]) => text);

  if (!cards.length) return "";

  return `
    <div class="drawer-guide" aria-label="Selection guidance">
      ${cards.map(([label, text]) => `
        <div class="drawer-guide-card">
          <div class="drawer-notes-title">${escapeHtml(label)}</div>
          <div class="drawer-guide-text">${escapeHtml(text)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function chooseReason(item) {
  const style = cleanDescriptor(item.style);
  const body = cleanDescriptor(item.body);
  const type = cleanDescriptor(item.type);
  const acidity = cleanDescriptor(item.acidity);
  const sweetness = cleanDescriptor(item.sweetness);
  const traits = [body, style].filter(Boolean).join(", ");
  const wineType = type ? `${type} wine` : "wine";

  if (traits && acidity) return `Choose this for a ${traits} ${wineType} with ${acidity} acidity.`;
  if (traits && sweetness) return `Choose this for a ${traits} ${wineType} that reads ${sweetness}.`;
  if (traits) return `Choose this for a ${traits} ${wineType}.`;
  if (acidity) return `Choose this when a guest wants a ${wineType} with ${acidity} acidity.`;
  return "";
}

function pairingCue(item) {
  const pairings = norm(item.pairing_tags)
    .split("|")
    .map((tag) => pairingLabel(tag))
    .filter(Boolean);

  if (!pairings.length) return "";
  if (pairings.length === 1) return `Point guests toward ${pairings[0]}.`;
  return `Point guests toward ${pairings.slice(0, 2).join(" or ")}.`;
}

function staffTalkingPoint(item) {
  const varietal = norm(item.varietal);
  const location = makeLocation(item);
  const style = cleanDescriptor(item.style);
  const body = cleanDescriptor(item.body);
  const sweetness = cleanDescriptor(item.sweetness);
  const descriptors = [body, style, sweetness].filter(Boolean).slice(0, 2).join(" and ");

  if (varietal && location && descriptors) {
    return `Lead with ${varietal} from ${location}; describe it as ${descriptors}.`;
  }
  if (varietal && location) return `Lead with ${varietal} from ${location}.`;
  if (varietal && descriptors) return `Lead with the ${varietal}; describe it as ${descriptors}.`;
  return "";
}

function cleanDescriptor(value) {
  const text = normLower(value);
  if (!text || text === "unknown") return "";
  return text;
}

function pairingLabel(value) {
  const key = normLower(value);
  const labels = {
    seafood: "seafood or lighter fish dishes",
    salad: "salads, herbs, and lighter starters",
    sipping: "a glass before the meal",
    steak: "steak or richer proteins",
    pasta: "pasta or creamier dishes",
  };
  return labels[key] || "";
}

export function closeDrawer() {
  const backdrop = document.getElementById("drawer-backdrop");
  if (backdrop) backdrop.removeEventListener("click", closeDrawer);
  window.removeEventListener("keydown", onDrawerKeydown);
  document.body.classList.remove("drawer-open");
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
}

function onDrawerKeydown(e) {
  if (e.key === "Escape") {
    closeDrawer();
    return;
  }

  if (e.key !== "Tab") return;

  const drawer = document.getElementById("drawer");
  if (!drawer || !document.body.classList.contains("drawer-open")) return;

  const focusable = Array.from(drawer.querySelectorAll(focusableSelector))
    .filter((el) => el instanceof HTMLElement && el.offsetParent !== null);
  if (!focusable.length) {
    e.preventDefault();
    drawer.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus({ preventScroll: true });
  } else if (!drawer.contains(document.activeElement)) {
    e.preventDefault();
    first.focus({ preventScroll: true });
  }
}
