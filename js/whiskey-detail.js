// Bottle detail: a pure view-model builder, a pure HTML renderer and a thin
// dialog opener. Unknown facts stay unknown ("Not verified", "Not stated ...").

import { escapeHtml } from "./utils.js";
import { priceLabel } from "./whiskey-menu.js";
import { isValidCritic } from "./whiskey-metadata.js";
import { openModal } from "./whiskey-dialog.js";

export const DETAIL_TITLE_ID = "whiskey-detail-title";

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "producer page";
  }
}

const yearsText = (n) => `${n} ${n === 1 ? "year" : "years"}`;

// Fixed, minimum and range ages are worded differently on purpose: a minimum is only a
// lower bound and a range is never collapsed into one number.
export function ageLineFor(meta) {
  const years = meta.age_years;
  const whole = Number.isInteger(years);
  const producer = String(meta.age_basis).startsWith("producer_page");
  if (meta.age_status === "fixed" && whole) {
    if (producer) return `Aged ${meta.age_text || yearsText(years)} (producer-stated)`;
    if (meta.age_basis === "menu_label") {
      return `Menu lists ${yearsText(years)} (not verified by a producer page)`;
    }
  }
  if (meta.age_status === "minimum" && whole && producer) {
    return `Aged a minimum of ${yearsText(years)} (producer-stated minimum, not an exact age)`;
  }
  const note = meta.age_note ? String(meta.age_note) : "";
  switch (meta.age_status) {
    case "nas":
      return "Not stated by the producer";
    case "range":
      if (Number.isInteger(meta.age_min) && Number.isInteger(meta.age_max)) {
        return `Range of ${meta.age_min} to ${meta.age_max} years (producer-stated range, not a single age)`;
      }
      return note ? `${note} (a range, not a single age)` : "A range, not a single age";
    case "varies":
      return note ? `${note} (varies)` : "Age varies";
    case "blend":
      return note ? `${note} (blend)` : "A blend with no single age";
    default:
      return "Not verified";
  }
}

export function buildDetailModel(row, meta) {
  const base = {
    name: row.name,
    category: row.category,
    price: priceLabel(row.price),
  };
  if (!meta) return { ...base, available: false };

  if (meta.status === "unresolved") {
    return {
      ...base,
      available: true,
      resolved: false,
      description: meta.description || null,
      critic: null,
    };
  }

  const regionParts = [meta.region, meta.region_group].filter(Boolean);
  const region = [...new Set(regionParts)].join(", ");
  return {
    ...base,
    available: true,
    resolved: true,
    version: meta.bottle_version || null,
    age: ageLineFor(meta),
    region: region || null,
    flavor: meta.flavor_tags.length ? meta.flavor_tags.join(", ") : null,
    description: meta.description || null,
    source: meta.product_source_url
      ? { url: meta.product_source_url, label: hostOf(meta.product_source_url) }
      : null,
    verifiedOn: meta.verified_on || null,
    critic: isValidCritic(meta.critic) ? meta.critic : null,
  };
}

export function renderCriticHtml(critic) {
  return `
    <section class="wh-critic" aria-label="Critic score">
      <h3 class="wh-critic-title">Critic score</h3>
      <p>${escapeHtml(critic.critic)} score ${escapeHtml(critic.score)} - <a href="${escapeHtml(critic.source_url)}" target="_blank" rel="noopener noreferrer">source</a> - verified ${escapeHtml(critic.verified_on)}</p>
    </section>`;
}

export function renderDetailHtml(model, titleId = DETAIL_TITLE_ID) {
  const head = `
    <h2 class="wh-modal-title" id="${escapeHtml(titleId)}">${escapeHtml(model.name)}</h2>
    <p class="wh-detail-meta"><span>${escapeHtml(model.category)}</span> <span class="wh-detail-price">${escapeHtml(model.price)}</span></p>`;

  if (!model.available) {
    return `${head}
    <p class="wh-detail-state">Details unavailable. Please ask your server about this bottle.</p>`;
  }

  if (!model.resolved) {
    return `${head}
    <p class="wh-detail-state">Exact bottle not verified</p>
    ${model.description ? `<p class="wh-detail-description">${escapeHtml(model.description)}</p>` : ""}
    <p class="wh-detail-uncertainty">The exact expression is not verified.</p>`;
  }

  const lines = [
    model.version ? `<p><strong>Bottle:</strong> ${escapeHtml(model.version)}</p>` : "",
    `<p><strong>Age:</strong> ${escapeHtml(model.age)}</p>`,
    model.region
      ? `<p><strong>Region:</strong> ${escapeHtml(model.region)}</p>`
      : "<p>Region not verified</p>",
    model.flavor
      ? `<p><strong>Flavor:</strong> ${escapeHtml(model.flavor)} (from producer tasting notes)</p>`
      : "<p>Flavor not verified</p>",
    model.description ? `<p class="wh-detail-description">${escapeHtml(model.description)}</p>` : "",
    model.source
      ? `<p>Source: <a href="${escapeHtml(model.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.source.label)}</a></p>`
      : "",
    model.verifiedOn ? `<p>Verified on ${escapeHtml(model.verifiedOn)}</p>` : "",
    model.critic ? renderCriticHtml(model.critic) : "",
  ];
  return `${head}\n${lines.filter(Boolean).join("\n")}`;
}

export function openDetail(doc, row, meta, { opener, onClosed } = {}) {
  return openModal(doc, {
    innerHtml: renderDetailHtml(buildDetailModel(row, meta), DETAIL_TITLE_ID),
    titleId: DETAIL_TITLE_ID,
    className: "wh-detail",
    opener,
    onClose: onClosed,
  });
}
