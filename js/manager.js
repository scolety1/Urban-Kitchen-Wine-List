const CONFIG = {
  wine: { source: "../data/wines.json", file: "wines.csv" },
  whiskey: { source: "../data/whiskey.csv", file: "whiskey.csv" },
};

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const quote = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) => [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))]
  .map((row) => row.map(quote).join(",")).join("\r\n");

function download(filename, contents) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(field); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = ""; if (row.some(Boolean)) rows.push(row); row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function previewRows(type, rows) {
  return rows.slice(0, 5).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(type === "wine" ? row.varietal || row.type : row.category)}</td><td>${escapeHtml(type === "wine" ? row.bottle_price : row.price)}</td></tr>`).join("");
}

async function pull(type) {
  const button = document.querySelector(`[data-pull="${type}"]`);
  const status = document.querySelector(`[data-status="${type}"]`);
  const results = document.querySelector(`[data-results="${type}"]`);
  button.disabled = true;
  status.textContent = `Pulling ${type} inventory…`;
  results.hidden = true;
  try {
    const response = await fetch(CONFIG[type].source, { cache: "no-store" });
    if (!response.ok) throw new Error(`Inventory returned ${response.status}.`);
    const body = await response.text();
    const ready = type === "wine" ? JSON.parse(body) : parseCsv(body);
    const headers = type === "wine"
      ? ["name","type","varietal","world","country","region_1","region_2","bin","vintage","glass_price","bottle_price","collection","staff_pick","stock","show","description"]
      : ["source_id","category","name","price"];
    const missing = ready.filter((row) => !row.name || (type === "wine" ? !row.bottle_price : !row.price)).length;
    const csv = type === "whiskey" ? body : toCsv(headers, ready);
    status.textContent = `${ready.length} published ${type} selections loaded. Review is ready.`;
    results.innerHTML = `<div class="manager-stats"><div class="manager-stat"><strong>${ready.length}</strong><span>published rows</span></div><div class="manager-stat"><strong>${missing}</strong><span>missing required data</span></div><div class="manager-stat"><strong>${missing ? "Review" : "Ready"}</strong><span>snapshot status</span></div></div><div class="manager-actions"><button class="manager-download" type="button">Download ${CONFIG[type].file}</button></div><table class="manager-preview"><thead><tr><th>Item</th><th>Category</th><th>Price</th></tr></thead><tbody>${previewRows(type, ready)}</tbody></table>`;
    results.querySelector("button").addEventListener("click", () => download(CONFIG[type].file, csv));
    results.hidden = false;
  } catch (error) {
    console.error(error);
    status.textContent = "The published snapshot could not be loaded. Refresh the page and try again.";
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll("[data-pull]").forEach((button) => button.addEventListener("click", () => pull(button.dataset.pull)));
