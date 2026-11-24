export const SPIRIT_FAMILIES = ["Tequila & Mezcal", "Gin", "Vodka", "Rum", "Brandy & Cognac", "Other Spirits"];

const clean = (value) => String(value ?? "").trim();
const numberOrNull = (value) => value === "" || value === null || value === undefined ? null : Number(value);

export function prepareSpirits(source) {
  if (!Array.isArray(source)) throw new Error("Spirits data must be a list.");
  return source.map((row, index) => {
    const name = clean(row.name);
    const family = clean(row.family);
    const pourSize = clean(row.pour_size);
    const price = numberOrNull(row.price);
    if (!name) throw new Error(`Spirits row ${index + 1} is missing a name.`);
    if (!SPIRIT_FAMILIES.includes(family)) throw new Error(`${name} is missing a supported spirit family.`);
    if (!pourSize) throw new Error(`${name} is missing a pour size.`);
    if (!Number.isFinite(price) || price < 0) throw new Error(`${name} is missing a valid price.`);
    const shotPrice = numberOrNull(row.shot_price);
    if (row.featured_shot === true && (!Number.isFinite(shotPrice) || shotPrice < 0)) throw new Error(`${name} is missing a valid shot price.`);
    return {
      id: clean(row.id) || `${family}-${name}`,
      name,
      family,
      style: clean(row.style),
      region: clean(row.region),
      pourSize,
      price,
      doublePrice: numberOrNull(row.double_price),
      description: clean(row.description),
      featuredShot: row.featured_shot === true,
      shotPrice: Number.isFinite(shotPrice) && shotPrice >= 0 ? shotPrice : null,
      shotNote: clean(row.shot_note),
    };
  });
}

export function spiritCategories(rows) {
  return ["All", ...SPIRIT_FAMILIES.filter((family) => rows.some((row) => row.family === family))];
}

export function priceLabel(value) {
  return Number.isFinite(value) ? `$${Number.isInteger(value) ? value : value.toFixed(2)}` : "Ask for details";
}

export function spiritsStatusCopy(state) {
  if (state === "empty") return "Spirits & Drinks is being prepared. Please ask your server for current selections.";
  if (state === "error") return "Spirits & Drinks is temporarily unavailable. Please refresh or ask your server for current selections.";
  return "Loading Spirits & Drinks.";
}
