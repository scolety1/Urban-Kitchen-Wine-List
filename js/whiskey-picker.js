// "Help me decide": pure HTML renderers for the form and results, plus thin
// imperative wiring around the shared modal. Matches come only from the pure
// recommender; nothing here scores, rates or relaxes choices on its own.

import { escapeHtml } from "./utils.js";
import { priceLabel } from "./whiskey-menu.js";
import { openDetail } from "./whiskey-detail.js";
import { openModal } from "./whiskey-dialog.js";
import {
  NO_PREFERENCE,
  buildPickerOptions,
  eligibleRows,
  recommend,
} from "./whiskey-recommend.js";

const TITLE_ID = "whiskey-picker-title";
const GROUPS = [
  { name: "flavor", legend: "Flavor" },
  { name: "budget", legend: "Budget" },
  { name: "age", legend: "Age (years, optional)" },
  { name: "region", legend: "Region (optional)" },
];

export const defaultPrefs = () => ({
  flavor: NO_PREFERENCE,
  budget: NO_PREFERENCE,
  age: NO_PREFERENCE,
  region: NO_PREFERENCE,
});

const plural = (n) => `${n} ${n === 1 ? "match" : "matches"}`;

export function renderPickerFormHtml(options, prefs, { eligibleCount, totalCount }) {
  const fieldsets = GROUPS.map(
    ({ name, legend }) => `
      <fieldset class="wh-fieldset">
        <legend class="wh-legend">${escapeHtml(legend)}</legend>
        <div class="wh-choices">
          ${options[name]
            .map(
              (option) => `
            <label class="wh-choice"><input type="radio" name="${name}" value="${escapeHtml(option.value)}"${
              String(prefs[name]) === option.value ? " checked" : ""
            }><span>${escapeHtml(option.label)}</span></label>`,
            )
            .join("")}
        </div>
      </fieldset>`,
  ).join("");

  return `
    <form class="wh-form" data-picker-form novalidate>
      <p class="wh-note">Matches come from the ${eligibleCount} of ${totalCount} bottles on this menu with verified details.</p>
      ${fieldsets}
      <div class="wh-actions">
        <button type="submit" class="wh-btn wh-btn-primary" data-picker-submit>Show matches</button>
      </div>
    </form>`;
}

export function outcomeText(result) {
  if (result.state === "results") return plural(result.matches.length);
  if (result.state === "no-exact-matches") return "No exact matches";
  return "Matches are unavailable";
}

export function renderResultsHtml(result, prefs, options) {
  const back = `<button type="button" class="wh-btn" data-picker-back>Back to choices</button>`;
  if (result.state === "results") {
    const cards = result.matches
      .map(
        ({ row, reasons }) => `
        <li class="wh-card" data-result-card>
          <h4 class="wh-card-name">${escapeHtml(row.name)}</h4>
          <p class="wh-card-price">${escapeHtml(priceLabel(row.price))} on the menu</p>
          <ul class="wh-reasons">${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
          <button type="button" class="wh-btn" data-detail-id="${row.sourceId}" aria-haspopup="dialog" aria-label="Details for ${escapeHtml(row.name)}">Details</button>
        </li>`,
      )
      .join("");
    return `
      <h3 class="wh-results-title" tabindex="-1" data-results-heading>${plural(result.matches.length)}</h3>
      <ol class="wh-cards">${cards}</ol>
      <div class="wh-actions">${back}</div>`;
  }

  if (result.state === "no-exact-matches") {
    const suggestions = result.suggestions.length
      ? `<p>You can change one choice. Nothing changes until you press a button:</p>
         <ul class="wh-suggestions">${result.suggestions
           .map(
             (s) =>
               `<li><button type="button" class="wh-btn" data-suggestion="${escapeHtml(s.field)}">${escapeHtml(s.label)}</button></li>`,
           )
           .join("")}</ul>`
      : "<p>Try changing your choices.</p>";
    return `
      <div class="wh-empty">
        <h3 class="wh-results-title" tabindex="-1" data-results-heading>No exact matches</h3>
        <p>No bottle matches all of your choices.</p>
        ${suggestions}
      </div>
      <div class="wh-actions">${back}</div>`;
  }

  return `
    <div class="wh-empty">
      <h3 class="wh-results-title" tabindex="-1" data-results-heading>Matches are unavailable</h3>
      <p>Bottle details could not be loaded, so no matches can be suggested.</p>
    </div>
    <div class="wh-actions">${back}</div>`;
}

export function renderUnavailableHtml() {
  return `
    <h2 class="wh-modal-title" id="${TITLE_ID}">Help me decide</h2>
    <p class="wh-detail-state">Help me decide is unavailable right now.</p>
    <p>Bottle details could not be loaded, so no matches can be suggested. The full menu is still available below.</p>`;
}

function readPrefs(form) {
  const prefs = defaultPrefs();
  for (const name of Object.keys(prefs)) {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    if (checked) prefs[name] = checked.value;
  }
  return prefs;
}

export function openPicker(doc, { rows, metaById, available, opener, vocabulary } = {}) {
  const pool = available && metaById ? eligibleRows(rows, metaById) : [];
  if (!available || !pool.length) {
    return openModal(doc, {
      innerHtml: renderUnavailableHtml(),
      titleId: TITLE_ID,
      className: "wh-picker",
      opener,
    });
  }

  const options = buildPickerOptions(rows, metaById, vocabulary);
  const counts = { eligibleCount: pool.length, totalCount: rows.length };
  const state = { prefs: defaultPrefs(), result: null, showResults: false };

  function shell() {
    const formHtml = renderPickerFormHtml(options, state.prefs, counts);
    const resultsHtml = state.result ? renderResultsHtml(state.result, state.prefs, options) : "";
    return `
      <h2 class="wh-modal-title" id="${TITLE_ID}">Help me decide</h2>
      <p class="wh-live" data-picker-live role="status" aria-live="polite">${
        state.showResults && state.result ? escapeHtml(outcomeText(state.result)) : ""
      }</p>
      <div data-picker-form-view${state.showResults ? " hidden" : ""}>${formHtml}</div>
      <div data-picker-results-view${state.showResults ? "" : " hidden"}>
        <div data-picker-results>${resultsHtml}</div>
      </div>
      <div class="wh-actions wh-footer">
        <button type="button" class="wh-btn" data-picker-reset>Start over</button>
      </div>`;
  }

  function mount(focusDetailId) {
    const handle = openModal(doc, {
      innerHtml: shell(),
      titleId: TITLE_ID,
      className: "wh-picker",
      opener,
    });
    const dialog = handle.element;
    const q = (selector) => dialog.querySelector(selector);

    const replaceForm = () => {
      q("[data-picker-form-view]").innerHTML = renderPickerFormHtml(options, state.prefs, counts);
      wireForm();
    };
    const showForm = (focusSelector) => {
      state.showResults = false;
      q("[data-picker-form-view]").hidden = false;
      q("[data-picker-results-view]").hidden = true;
      (focusSelector ? q(focusSelector) : q('input[type="radio"]:checked'))?.focus();
    };

    function wireForm() {
      const form = q("[data-picker-form]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        state.prefs = readPrefs(form);
        state.result = recommend(state.prefs, rows, metaById);
        state.showResults = true;
        q("[data-picker-results]").innerHTML = renderResultsHtml(state.result, state.prefs, options);
        q("[data-picker-live]").textContent = outcomeText(state.result);
        q("[data-picker-form-view]").hidden = true;
        q("[data-picker-results-view]").hidden = false;
        q("[data-results-heading]")?.focus();
      });
      form.addEventListener("click", (event) => {
        const radio = event.target.closest?.('input[type="radio"]');
        if (radio) state.prefs = { ...state.prefs, [radio.name]: radio.value };
      });
    }
    wireForm();

    dialog.addEventListener("click", (event) => {
      const target = event.target;
      const detail = target.closest?.("[data-detail-id]");
      if (detail) {
        const id = Number(detail.dataset.detailId);
        const row = rows.find((candidate) => candidate.sourceId === id);
        if (!row) return;
        handle.close({ restoreFocus: false, silent: true });
        openDetail(doc, row, metaById[id], { opener: detail, onClosed: () => mount(id) });
        return;
      }
      if (target.closest?.("[data-picker-back]")) {
        showForm();
        return;
      }
      if (target.closest?.("[data-picker-reset]")) {
        state.prefs = defaultPrefs();
        state.result = null;
        q("[data-picker-results]").innerHTML = "";
        q("[data-picker-live]").textContent = "";
        replaceForm();
        showForm();
        return;
      }
      const suggestion = target.closest?.("[data-suggestion]");
      if (suggestion && state.result) {
        const chosen = state.result.suggestions.find((s) => s.field === suggestion.dataset.suggestion);
        if (!chosen) return;
        state.prefs = { ...chosen.nextPrefs };
        state.result = null;
        q("[data-picker-results]").innerHTML = "";
        q("[data-picker-live]").textContent = "Choices updated. Press Show matches to see results.";
        replaceForm();
        showForm("[data-picker-submit]");
      }
    });

    if (focusDetailId !== undefined) q(`[data-detail-id="${focusDetailId}"]`)?.focus();
    return handle;
  }

  return mount();
}
