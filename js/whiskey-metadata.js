// Whiskey bottle metadata: validation against the public menu rows, plus small
// pure helpers for eligibility and verified age. No DOM access.

export const STATUSES = ["verified", "partial", "unresolved"];
// fixed: an exact age. minimum: "at least N". range: "N to M". The rest carry no age.
export const AGE_STATUSES = ["fixed", "minimum", "range", "nas", "varies", "blend", "unknown"];
export const AGE_BASES = ["producer_page", "producer_page_and_menu_label", "menu_label"];
export const SOURCE_TYPES = ["producer_product_page", "producer_catalog_page", "none"];

const UNRESOLVED_NOTE = /not verified/i;

const isText = (value) => typeof value === "string" && value.trim() !== "";
const isHttps = (value) => {
  if (!isText(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export function isValidCritic(critic) {
  return Boolean(
    critic &&
      typeof critic === "object" &&
      isText(critic.critic) &&
      typeof critic.score === "number" &&
      Number.isFinite(critic.score) &&
      isHttps(critic.source_url) &&
      isText(critic.verified_on),
  );
}

export function isEligible(meta) {
  return Boolean(meta) && meta.status !== "unresolved";
}

// An age is "verified" only when it is a fixed or minimum number backed by a producer
// page. Menu-label-only ages, ranges, blends, NAS and unknown ages never qualify.
// A minimum is still only a lower bound: use ageKind() to keep it labelled that way.
export function verifiedAge(meta) {
  if (!meta || !["fixed", "minimum"].includes(meta.age_status)) return null;
  if (typeof meta.age_basis !== "string" || !meta.age_basis.startsWith("producer_page")) return null;
  return Number.isInteger(meta.age_years) && meta.age_years > 0 ? meta.age_years : null;
}

export function ageKind(meta) {
  return verifiedAge(meta) === null ? null : meta.age_status;
}

export function validateWhiskeyMetadata(metadata, menuRows) {
  const errors = [];
  const fail = () => ({ ok: false, errors, byId: {} });

  if (!metadata || typeof metadata !== "object" || !Array.isArray(metadata.rows)) {
    errors.push("Metadata is missing its rows list.");
    return fail();
  }
  if (!Array.isArray(menuRows)) {
    errors.push("Menu rows are unavailable.");
    return fail();
  }

  const vocabulary = Array.isArray(metadata.flavor_vocabulary) ? metadata.flavor_vocabulary : [];
  if (!vocabulary.length) errors.push("Metadata is missing its flavor vocabulary.");

  const menuById = new Map(menuRows.map((row) => [row.sourceId, row]));
  const seen = new Set();
  const byId = {};

  for (const meta of metadata.rows) {
    const id = meta?.source_id;
    if (!Number.isInteger(id)) {
      errors.push("A metadata record has an invalid source id.");
      continue;
    }
    const label = `Row ${id}`;
    if (seen.has(id)) {
      errors.push(`${label}: duplicate metadata record.`);
      continue;
    }
    seen.add(id);

    const menuRow = menuById.get(id);
    if (!menuRow) {
      errors.push(`${label}: not part of the public menu.`);
      continue;
    }
    if (meta.menu_name !== menuRow.name) errors.push(`${label}: menu name does not match the menu.`);
    if (meta.category !== menuRow.category) errors.push(`${label}: category does not match the menu.`);

    if (!STATUSES.includes(meta.status)) errors.push(`${label}: invalid status.`);
    if (!AGE_STATUSES.includes(meta.age_status)) errors.push(`${label}: invalid age status.`);
    if (meta.age_basis !== null && !AGE_BASES.includes(meta.age_basis)) {
      errors.push(`${label}: invalid age basis.`);
    }
    if (!SOURCE_TYPES.includes(meta.source_type)) errors.push(`${label}: invalid source type.`);
    if (["fixed", "minimum"].includes(meta.age_status) && !(Number.isInteger(meta.age_years) && meta.age_years > 0)) {
      errors.push(`${label}: ${meta.age_status} age needs a whole number of years.`);
    }
    if (meta.age_status === "range") {
      const { age_min: lo, age_max: hi } = meta;
      if (meta.age_years !== null && meta.age_years !== undefined) {
        errors.push(`${label}: a range must not carry a single age.`);
      }
      if (lo != null && hi != null && !(Number.isInteger(lo) && Number.isInteger(hi) && lo < hi)) {
        errors.push(`${label}: range bounds are invalid.`);
      }
    }

    if (!Array.isArray(meta.flavor_tags) || meta.flavor_tags.some((tag) => !vocabulary.includes(tag))) {
      errors.push(`${label}: flavor tags must come from the flavor vocabulary.`);
    }
    if (meta.critic !== null && meta.critic !== undefined && !isValidCritic(meta.critic)) {
      errors.push(`${label}: critic evidence is incomplete or invalid.`);
    }

    if (meta.status === "unresolved") {
      if (!isText(meta.description) || !UNRESOLVED_NOTE.test(meta.description)) {
        errors.push(`${label}: unresolved rows may only carry the honest not-verified note.`);
      }
      if (meta.region !== null || meta.region_group !== null) {
        errors.push(`${label}: unresolved rows must not claim a region.`);
      }
      if (Array.isArray(meta.flavor_tags) && meta.flavor_tags.length) {
        errors.push(`${label}: unresolved rows must not claim flavor.`);
      }
      if (meta.product_source_url) errors.push(`${label}: unresolved rows must not claim a source.`);
    }

    byId[id] = meta;
  }

  for (const row of menuRows) {
    if (!seen.has(row.sourceId)) errors.push(`Row ${row.sourceId}: missing metadata record.`);
  }

  return errors.length ? fail() : { ok: true, errors, byId, vocabulary: [...vocabulary] };
}

export async function loadWhiskeyMetadata(
  menuRows,
  fetchImpl = globalThis.fetch,
  url = "data/whiskey-metadata.json",
) {
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response || !response.ok) {
      throw new Error(`Whiskey details returned ${response?.status ?? "no response"}.`);
    }
    return validateWhiskeyMetadata(await response.json(), menuRows);
  } catch (error) {
    return { ok: false, errors: [String(error?.message || error)], byId: {} };
  }
}
