// Critic Picks: shown only for rows whose critic evidence validates. Never derived
// from recommender output; with no valid evidence nothing is rendered.

import { escapeHtml } from "./utils.js";
import { priceLabel } from "./whiskey-menu.js";
import { isValidCritic } from "./whiskey-metadata.js";

export function buildPicks(rows, metaById) {
  return rows
    .map((row) => ({ row, critic: metaById?.[row.sourceId]?.critic }))
    .filter((entry) => isValidCritic(entry.critic))
    .sort(
      (a, b) =>
        a.row.name.localeCompare(b.row.name, undefined, { sensitivity: "base" }) ||
        a.row.sourceId - b.row.sourceId,
    );
}

export function renderPicksHtml(picks) {
  if (!picks.length) return "";
  const items = picks
    .map(
      ({ row, critic }) => `
        <li class="wh-pick">
          <button type="button" class="whiskey-name-btn" data-detail-id="${row.sourceId}" aria-haspopup="dialog">${escapeHtml(row.name)}</button>
          <span class="whiskey-price">${escapeHtml(priceLabel(row.price))}</span>
          <p class="wh-pick-critic">${escapeHtml(critic.critic)} score ${escapeHtml(critic.score)} - <a href="${escapeHtml(critic.source_url)}" target="_blank" rel="noopener noreferrer">source</a> - verified ${escapeHtml(critic.verified_on)}</p>
        </li>`,
    )
    .join("");
  return `
    <section class="section wh-picks" aria-labelledby="critic-picks-title">
      <div class="varietal-header"><h2 class="varietal-title" id="critic-picks-title">Critic Picks</h2></div>
      <ul class="wh-pick-list">${items}</ul>
    </section>`;
}
