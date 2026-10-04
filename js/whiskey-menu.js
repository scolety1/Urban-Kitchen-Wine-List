export function prepareWhiskeyRows(records) {
  return records.map((record, index) => {
    const sourceId = Number(record.source_id);
    const category = String(record.category || "").trim();
    const name = String(record.name || "").trim();
    const price = Number(record.price);

    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      throw new Error(`Whiskey row ${index + 1} has an invalid source id.`);
    }
    if (!category || !name) {
      throw new Error(`Whiskey source row ${sourceId} is missing a publishable category or name.`);
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Whiskey source row ${sourceId} is missing a confirmed price.`);
    }

    return { sourceId, category, name, price };
  });
}

export function priceLabel(price) {
  const value = Number(price);
  return Number.isFinite(value) && value > 0 ? `$${value}` : "Ask for details";
}

export function categoriesFor(rows) {
  return [...new Set(rows.map((row) => row.category))];
}

export function categoryId(category) {
  const slug = String(category || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `category-${slug || "whiskey"}`;
}

export function menuStatusCopy(state) {
  if (state === "empty") {
    return "Whiskey list is being updated. Please ask your server for current availability.";
  }
  if (state === "error") {
    return "Whiskey list is temporarily unavailable. Please refresh or ask your server for current availability.";
  }
  return "Loading Whiskey list…";
}

export function resolveWhiskeyDataset(parsed) {
  const headers = Array.isArray(parsed?.headers) ? parsed.headers : [];
  const records = Array.isArray(parsed?.records) ? parsed.records : [];
  if (!headers.length && !records.length) return { state: "empty", rows: [] };

  const required = ["source_id", "category", "name", "price"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new Error(`Whiskey data is missing required columns: ${missing.join(", ")}.`);
  }

  const rows = prepareWhiskeyRows(records);
  return { state: rows.length ? "ready" : "empty", rows };
}
