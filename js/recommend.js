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
    title: "Choose a pour style",
    options: [
      { label: "Red", value: "red" },
      { label: "White", value: "white" },
      { label: "Ros\u00e9", value: "rose" },
      { label: "Sparkling", value: "sparkling" },
      { label: "Dessert", value: "dessert" },
      { label: "Open to anything", value: "any" },
    ],
  },
  {
    key: "body",
    title: "Preferred weight?",
    options: [
      { label: "Light and bright", value: "light" },
      { label: "Medium and flexible", value: "medium" },
      { label: "Bold and full", value: "bold" },
    ],
  },
  {
    key: "style",
    title: "Flavor lane?",
    options: [
      { label: "Dry and clean", value: "dry" },
      { label: "Fruit-forward", value: "fruity" },
      { label: "Rich and rounded", value: "rich" },
      { label: "Crisp and mineral", value: "crisp" },
      { label: "Smooth and polished", value: "smooth" },
    ],
  },
  {
    key: "pairing",
    title: "Food or moment?",
    options: [
      { label: "Steak or rich protein", value: "steak" },
      { label: "Seafood", value: "seafood" },
      { label: "Pasta", value: "pasta" },
      { label: "Salads and starters", value: "salad" },
      { label: "Celebration", value: "celebratory" },
      { label: "Patio bottle", value: "patio" },
      { label: "Easy table pour", value: "easy" },
    ],
  },
  {
    key: "budget",
    title: "Bottle range?",
    options: [
      { label: "Any", value: "any" },
      { label: "$75 & under", value: "under_75" },
      { label: "$75-$150", value: "75_150" },
      { label: "$150+", value: "150_plus" },
    ],
  },
];

export function recommendWines(records, answers, limit = 3) {
  if (answers.type === "dessert") return recommendDessertWines(records, answers, limit);

  let pool = records.filter((wine) => isAvailable(wine));
  const budgetPool = filterByBudget(pool, answers.budget);

  if (budgetPool.length >= limit) pool = budgetPool;

  const candidates = pool
    .map((wine) => scoreWine(wine, answers))
    .sort((a, b) => b.score - a.score);

  if (answers.type === "any") return spreadRecommendations(candidates, limit);
  return candidates.slice(0, limit);
}

function recommendDessertWines(records, answers, limit) {
  let pool = records.filter((wine) => isAvailable(wine));
  const budgetPool = filterByBudget(pool, answers.budget);
  if (budgetPool.length >= limit) pool = budgetPool;

  return pool
    .map((wine) => {
      const type = wineType(wine);
      const text = searchText(wine);
      const price = numericPrice(wine.bottle_price);
      let score = 0;

      if (type === "dessert") score += 50;
      if (/(dessert|sweet|port|sauternes|late harvest|moscato|brachetto)/.test(text)) score += 35;
      score += scoreBudget(price, answers.budget);
      score += metadataScore(wine);
      if (isYes(wine.staff_pick)) score += WEIGHTS.staffPick;

      return {
        wine,
        score,
        why: "Why it works: closest sweet-finish match from the current list.",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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
    reasons.push(pairingReason(answers.pairing));
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
  if (clean.length >= 2) return `Why it works: ${joinReasons(clean)}.`;
  if (clean.length === 1) return `Why it works: ${clean[0]}; balanced enough for the table.`;
  return `Why it works: closest ${answers.body}, ${answers.style} match from the current list.`;
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
  const text = searchText(wine);
  if (explicit.length) {
    const tags = new Set(explicit);
    if (/(champagne|sparkling|prosecco|brut|moscato|brachetto)/.test(text)) tags.add("celebratory");
    if (/(rose|ros.|sauvignon|riesling|gruner|picpoul|crisp|bright|fresh|sparkling)/.test(text)) tags.add("patio");
    if (/(easy|approachable|smooth|soft|fresh|light|gamay|pinot|rose|sparkling)/.test(text)) tags.add("easy");
    return Array.from(tags);
  }

  const type = wineType(wine);
  const tags = new Set();
  if (type === "red") tags.add("steak");
  if (type === "white" || type === "sparkling") tags.add("seafood");
  if (/(pinot|grenache|sangiovese|nebbiolo|barbera|chianti|burgundy|rhone|rhône)/.test(text)) tags.add("pasta");
  if (/(sauvignon|riesling|gruner|grüner|crisp|bright|sparkling|rose|rosé)/.test(text)) tags.add("salad");
  if (/(champagne|sparkling|prosecco|crisp|fresh|easy)/.test(text)) tags.add("sipping");
  if (/(champagne|sparkling|prosecco|brut|moscato|brachetto)/.test(text)) tags.add("celebratory");
  if (/(rose|ros.|sauvignon|riesling|gruner|gr.ner|albarino|albari.o|picpoul|crisp|bright|fresh|sparkling)/.test(text)) tags.add("patio");
  if (/(easy|approachable|smooth|soft|fresh|light|gamay|pinot|rose|ros.|sparkling)/.test(text)) tags.add("easy");
  if (!tags.size) tags.add("sipping");
  return Array.from(tags);
}

function pairingReason(pairing) {
  const labels = {
    steak: "structured for steak",
    seafood: "fresh with seafood",
    pasta: "textured enough for pasta",
    salad: "bright with lighter plates",
    celebratory: "right for a celebratory pour",
    patio: "refreshing for patio service",
    easy: "easy-drinking and polished",
    sipping: "comfortable for sipping",
  };
  return labels[pairing] || `pairs well with ${pairing}`;
}

function scoreBudget(price, budget) {
  if (!budget || budget === "any" || price == null) return WEIGHTS.budget / 2;
  if (budget === "under_75") return price <= 75 ? WEIGHTS.budget : 0;
  if (budget === "75_150") return price >= 75 && price <= 150 ? WEIGHTS.budget : price > 150 && price <= 175 ? WEIGHTS.budget / 3 : 0;
  if (budget === "150_plus") return price >= 150 ? WEIGHTS.budget : price >= 125 ? WEIGHTS.budget / 3 : 0;
  return 0;
}

function filterByBudget(records, budget) {
  if (!budget || budget === "any") return records;
  return records.filter((wine) => {
    const price = numericPrice(wine.bottle_price);
    if (price == null) return false;
    if (budget === "under_75") return price <= 75;
    if (budget === "75_150") return price >= 75 && price <= 150;
    if (budget === "150_plus") return price >= 150;
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
  if (type === "rose") return "ros\u00e9";
  return type;
}
