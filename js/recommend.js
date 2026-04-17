import { isYes, norm, normLower, priceToDisplay } from "./utils.js";

const WEIGHTS = {
  typeExact: 28,
  bodyExact: 18,
  styleExact: 16,
  pairingExact: 18,
  budget: 22,
  metadata: 10,
  staffPick: 5,
};

const TYPE_SPREAD = ["red", "white", "sparkling", "rose"];

export const DECIDER_STEPS = [
  {
    key: "type",
    title: "What sounds good?",
    options: [
      { label: "Red", value: "red" },
      { label: "White", value: "white" },
      { label: "Rose", value: "rose" },
      { label: "Sparkling", value: "sparkling" },
      { label: "Dessert", value: "dessert" },
      { label: "Anything", value: "any" },
    ],
  },
  {
    key: "body",
    title: "How much body?",
    options: [
      { label: "Light", value: "light" },
      { label: "Medium", value: "medium" },
      { label: "Bold", value: "bold" },
    ],
  },
  {
    key: "style",
    title: "What style?",
    options: [
      { label: "Dry", value: "dry" },
      { label: "Fruity", value: "fruity" },
      { label: "Rich", value: "rich" },
      { label: "Crisp", value: "crisp" },
      { label: "Smooth", value: "smooth" },
    ],
  },
  {
    key: "pairing",
    title: "What are you having?",
    options: [
      { label: "Steak", value: "steak" },
      { label: "Seafood", value: "seafood" },
      { label: "Pasta", value: "pasta" },
      { label: "Salad", value: "salad" },
      { label: "Sipping", value: "sipping" },
    ],
  },
  {
    key: "budget",
    title: "Bottle budget?",
    options: [
      { label: "Any", value: "any" },
      { label: "$75 & under", value: "under_75" },
      { label: "$80-$90", value: "80_90" },
      { label: "$90+", value: "90_plus" },
    ],
  },
];

export function recommendWines(records, answers, limit = 3) {
  let pool = records.filter((wine) => isAvailable(wine));
  const budgetPool = filterByBudget(pool, answers.budget);

  if (budgetPool.length >= limit) pool = budgetPool;

  const candidates = pool
    .map((wine) => scoreWine(wine, answers))
    .sort((a, b) => b.score - a.score);

  if (answers.type === "any") return spreadRecommendations(candidates, limit);
  return candidates.slice(0, limit);
}

function scoreWine(wine, answers) {
  let score = 0;
  const reasons = [];
  const type = wineType(wine);
  const body = wineBody(wine);
  const style = wineStyle(wine);
  const pairings = pairingTags(wine);
  const bottlePrice = numericPrice(wine.bottle_price);

  if (answers.type !== "any" && type === answers.type) {
    score += WEIGHTS.typeExact;
    reasons.push(`matches your ${labelFor(type)} preference`);
  } else if (answers.type === "any" && TYPE_SPREAD.includes(type)) {
    score += WEIGHTS.typeExact / 2;
  }

  if (body === answers.body) {
    score += WEIGHTS.bodyExact;
    reasons.push(`has a ${answers.body} body`);
  } else if (nearBody(body, answers.body)) {
    score += WEIGHTS.bodyExact / 2;
  }

  if (style === answers.style) {
    score += WEIGHTS.styleExact;
    reasons.push(`leans ${answers.style}`);
  } else if (relatedStyle(style, answers.style)) {
    score += WEIGHTS.styleExact / 2;
  }

  if (pairings.includes(answers.pairing)) {
    score += WEIGHTS.pairingExact;
    reasons.push(`pairs well with ${answers.pairing}`);
  }

  const budgetScore = scoreBudget(bottlePrice, answers.budget);
  score += budgetScore;
  if (budgetScore >= WEIGHTS.budget) reasons.push("fits your budget");

  score += metadataScore(wine);
  if (isYes(wine.staff_pick)) score += WEIGHTS.staffPick;

  return {
    wine,
    score,
    why: buildWhy(reasons, wine, answers),
  };
}

function spreadRecommendations(scored, limit) {
  const picked = [];
  const usedTypes = new Set();

  for (const item of scored) {
    const type = wineType(item.wine);
    if (usedTypes.has(type)) continue;
    picked.push(item);
    usedTypes.add(type);
    if (picked.length >= limit) return picked;
  }

  for (const item of scored) {
    if (picked.includes(item)) continue;
    picked.push(item);
    if (picked.length >= limit) return picked;
  }

  return picked;
}

function buildWhy(reasons, wine, answers) {
  const clean = reasons.slice(0, 3);
  if (clean.length >= 2) return `This fits because it ${joinReasons(clean)}.`;
  if (clean.length === 1) return `This fits because it ${clean[0]} and has enough balance for the table.`;
  return `This is one of the strongest available matches for your ${answers.body} ${answers.style} preference.`;
}

function joinReasons(reasons) {
  if (reasons.length <= 1) return reasons[0] || "";
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;
  return `${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
}

function isAvailable(wine) {
  if (isYes(wine.available)) return true;
  if (normLower(wine.available) && !isYes(wine.available)) return false;
  return !["n", "no", "false", "0"].includes(normLower(wine.show));
}

function wineType(wine) {
  const type = normLower(wine.type || wine.category).replace("ros\u00e9", "rose");
  if (type.includes("sparkling") || type.includes("champagne")) return "sparkling";
  if (type.includes("white")) return "white";
  if (type.includes("rose")) return "rose";
  if (type.includes("dessert")) return "dessert";
  return "red";
}

function wineBody(wine) {
  const explicit = normLower(wine.body);
  if (["light", "medium", "bold"].includes(explicit)) return explicit;
  const text = searchText(wine);
  if (/(bold|full|rich|powerful|cabernet|syrah|shiraz|malbec)/.test(text)) return "bold";
  if (/(light|fresh|crisp|delicate|pinot|gamay|riesling|sauvignon|gruner|grüner)/.test(text)) return "light";
  return "medium";
}

function wineStyle(wine) {
  const explicit = normLower(wine.style);
  if (["dry", "fruity", "rich", "crisp", "smooth"].includes(explicit)) return explicit;
  const text = searchText(wine);
  if (/(crisp|bright|fresh|citrus|mineral|acid)/.test(text)) return "crisp";
  if (/(smooth|soft|round|polished|velvety)/.test(text)) return "smooth";
  if (/(rich|creamy|butter|brioche|toast|full)/.test(text)) return "rich";
  if (/(fruit|fruity|berry|cherry|apple|pear|stone fruit)/.test(text)) return "fruity";
  return "dry";
}

function pairingTags(wine) {
  const explicit = normLower(wine.pairing_tags)
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;

  const type = wineType(wine);
  const text = searchText(wine);
  const tags = new Set();
  if (type === "red") tags.add("steak");
  if (type === "white" || type === "sparkling") tags.add("seafood");
  if (/(pinot|grenache|sangiovese|nebbiolo|barbera|chianti|burgundy|rhone|rhône)/.test(text)) tags.add("pasta");
  if (/(sauvignon|riesling|gruner|grüner|crisp|bright|sparkling|rose|rosé)/.test(text)) tags.add("salad");
  if (/(champagne|sparkling|prosecco|crisp|fresh|easy)/.test(text)) tags.add("sipping");
  if (!tags.size) tags.add("sipping");
  return Array.from(tags);
}

function scoreBudget(price, budget) {
  if (!budget || budget === "any" || price == null) return WEIGHTS.budget / 2;
  if (budget === "under_75") return price <= 75 ? WEIGHTS.budget : 0;
  if (budget === "80_90") return price >= 80 && price <= 90 ? WEIGHTS.budget : price >= 76 && price <= 95 ? WEIGHTS.budget / 2 : 0;
  if (budget === "90_plus") return price >= 90 ? WEIGHTS.budget : price >= 80 ? WEIGHTS.budget / 3 : 0;
  return 0;
}

function filterByBudget(records, budget) {
  if (!budget || budget === "any") return records;
  return records.filter((wine) => {
    const price = numericPrice(wine.bottle_price);
    if (price == null) return false;
    if (budget === "under_75") return price <= 75;
    if (budget === "80_90") return price >= 80 && price <= 90;
    if (budget === "90_plus") return price >= 90;
    return true;
  });
}

function metadataScore(wine) {
  const fields = ["description", "description_final", "description_ai", "body", "style", "pairing_tags", "bottle_price"];
  const filled = fields.filter((field) => norm(wine[field])).length;
  return Math.round((filled / fields.length) * WEIGHTS.metadata);
}

function nearBody(a, b) {
  return (a === "medium" && (b === "light" || b === "bold")) || (b === "medium" && (a === "light" || a === "bold"));
}

function relatedStyle(a, b) {
  const groups = [
    ["dry", "crisp"],
    ["rich", "smooth"],
    ["fruity", "smooth"],
  ];
  return groups.some((group) => group.includes(a) && group.includes(b));
}

function numericPrice(value) {
  const display = priceToDisplay(value);
  const n = Number(String(display).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function searchText(wine) {
  return [
    wine.name,
    wine.varietal,
    wine.country,
    wine.region_1,
    wine.region_2,
    wine.description,
    wine.description_final,
    wine.description_ai,
    wine.description_original,
  ].join(" ").toLowerCase();
}

function labelFor(type) {
  if (type === "rose") return "rose";
  return type;
}
