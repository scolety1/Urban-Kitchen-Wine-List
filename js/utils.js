export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function norm(str) {
  return String(str ?? "").trim();
}

export function normLower(str) {
  return norm(str).toLowerCase();
}

export function toInt(val) {
  const s = norm(val);
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function isYes(val) {
  const s = normLower(val);
  return s === "yes" || s === "y" || s === "true" || s === "1";
}

export function isNo(val) {
  const s = normLower(val);
  return s === "no" || s === "n" || s === "false" || s === "0";
}

export function cmpText(a, b) {
  const aa = normLower(a);
  const bb = normLower(b);
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return 0;
}

export function priceToDisplay(val) {
  const s = norm(val);
  if (!s) return "";
  if (normLower(s) === "mp") return "mp";
  const n = Number(s);
  if (Number.isFinite(n)) return String(n);
  return s;
}

export function makeLocation(row) {
  const parts = [];
  const r2 = norm(row.region_2);
  const r1 = norm(row.region_1);
  const c = norm(row.country);
  if (r2) parts.push(r2);
  if (r1) parts.push(r1);
  if (c) parts.push(c);
  return parts.join(", ");
}

export function makeShortLocation(row) {
  const r2 = norm(row.region_2);
  const r1 = norm(row.region_1);
  if (r2 && r1) return `${r2}, ${r1}`;
  return r2 || r1 || "";
}

export function worldLabel(world) {
  const w = normLower(world);
  if (w === "old") return "Old World";
  if (w === "new") return "New World";
  return world ? world : "";
}
