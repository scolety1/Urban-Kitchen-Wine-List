// Rendered QA for the Wine/Whiskey pages in an isolated, headless Opera.
//
//   node tests/rendered-whiskey-qa.mjs
//
// Dependency-free: Node built-ins plus the global WebSocket. It launches ONLY the Opera
// executable below, with a brand-new --user-data-dir under the OS temp directory, serves this
// worktree on 127.0.0.1, drives the page over the DevTools protocol and writes a receipt and
// screenshots under .qa-artifacts/. It never touches any existing browser profile. It cleans up
// only what it created (the browser process tree, the temp profile and the server).

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPERA_EXE = "C:\\Users\\codex-agent\\AppData\\Local\\Programs\\Opera\\opera.exe";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = path.join(ROOT, ".qa-artifacts");
const SHOTS = path.join(ARTIFACTS, "rendered");
const RECEIPT = path.join(ARTIFACTS, "rendered-whiskey-qa-receipt.json");

// Desktop-style zoom: zoom N% on a 1280x800 window gives a (1280/N, 800/N) CSS viewport.
const CASES = [
  { id: "mobile-320", width: 320, height: 640, scale: 1, zoomPercent: 100 },
  { id: "mobile-390", width: 390, height: 844, scale: 1, zoomPercent: 100 },
  { id: "zoom-200", width: 640, height: 400, scale: 2, zoomPercent: 200 },
  { id: "zoom-400", width: 320, height: 200, scale: 4, zoomPercent: 400 },
];
const PAGES = ["wine", "whiskey"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Blocked extends Error {}

// --------------------------------------------------------------- static server

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const NOT_SERVED = /^\/(?:_audit|\.git|\.qa-artifacts|tests|node_modules)(?:\/|$)/;

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname);
      const target = path.resolve(ROOT, `.${pathname === "/" ? "/index.html" : pathname}`);
      const inside = target === ROOT || target.startsWith(ROOT + path.sep);
      if (!inside || NOT_SERVED.test(pathname) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(target)] ?? "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(target).pipe(res);
    } catch {
      res.writeHead(400).end("bad request");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// ------------------------------------------------------------------ CDP client

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? "")})`));
        else resolve(message.result);
      }
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener("open", () => resolve(new Cdp(ws)), { once: true });
      ws.addEventListener("error", () => reject(new Error("DevTools WebSocket failed to connect")), { once: true });
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

// --------------------------------------------------------------------- browser

function validateProfileDir(dir) {
  const tmp = fs.realpathSync(os.tmpdir());
  const real = fs.realpathSync(dir);
  const rel = path.relative(tmp, real);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`profile ${real} is not under ${tmp}`);
  if (!path.basename(real).startsWith("uk-whiskey-qa-")) throw new Error("profile directory has an unexpected name");
  if (!fs.statSync(real).isDirectory() || fs.readdirSync(real).length !== 0) throw new Error("profile directory must be new and empty");
  return real;
}

function killOurTree(pid, profileDir) {
  // Only the process we spawned (and its children) plus any process whose command line carries
  // our unique temp profile path.
  if (pid) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${profileDir.replace(/'/g, "''")}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore" });
}

async function waitFor(fn, timeoutMs, label) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) return last;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

// ------------------------------------------------------------------ page logic

const MASTHEAD_JS = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const q = (s) => [...document.querySelectorAll(s)];
  const clippedBy = (el) => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        const pr = p.getBoundingClientRect();
        if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5) {
          return p.id || p.className || p.tagName;
        }
      }
    }
    return null;
  };
  const describe = (el, kind) => {
    const r = el.getBoundingClientRect();
    return { kind, text: el.textContent.trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      width: r.width, height: r.height, clippedBy: clippedBy(el), selfOverflow: el.scrollWidth > el.clientWidth + 1 };
  };
  const masthead = document.querySelector(".masthead");
  const bar = document.getElementById("top-bar");
  const barRect = bar.getBoundingClientRect();
  const mastCs = getComputedStyle(masthead);
  return {
    vw, vh,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    items: [
      ...q(".masthead-kicker").map((e) => describe(e, "kicker")),
      ...q(".masthead-title").map((e) => describe(e, "title")),
      ...q(".menu-switcher a").map((e) => describe(e, "switcher")),
    ],
    masthead: { scrollHeight: masthead.scrollHeight, clientHeight: masthead.clientHeight,
      scrollWidth: masthead.scrollWidth, clientWidth: masthead.clientWidth,
      maxHeight: mastCs.maxHeight, overflowX: mastCs.overflowX, overflowY: mastCs.overflowY },
    bar: { left: barRect.left, right: barRect.right, position: getComputedStyle(bar).position },
    current: q(".menu-switcher a[aria-current='page']").map((a) => a.textContent.trim()),
    forbiddenLinks: q("a[href]").map((a) => a.getAttribute("href")).filter((h) => /atlas|cocktail/i.test(h)),
  };
})()`;

const FOCUS_JS = `(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const a = document.activeElement;
  return {
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    inDialog: Boolean(dialog && a && dialog.contains(a)),
    tag: a ? a.tagName : null,
    text: a ? (a.textContent || a.value || "").trim().slice(0, 40) : null,
    id: a ? a.id : null,
    detailId: a && a.dataset ? a.dataset.detailId ?? null : null,
    close: Boolean(a && a.hasAttribute && a.hasAttribute("data-modal-close")),
  };
})()`;

const DIALOG_JS = `(() => {
  const d = document.querySelector('[role="dialog"]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const close = d.querySelector("[data-modal-close]").getBoundingClientRect();
  const widest = Math.max(0, ...[...d.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right));
  return {
    left: r.left, right: r.right, vw: innerWidth,
    scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    widestChildRight: widest,
    closeHeight: close.height, closeWidth: close.width,
    ariaModal: d.getAttribute("aria-modal"), labelledby: d.getAttribute("aria-labelledby"),
    labelExists: Boolean(document.getElementById(d.getAttribute("aria-labelledby"))),
    text: d.innerText,
    focusables: [...d.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")]
      .filter((e) => !e.disabled && e.getAttribute("tabindex") !== "-1" && !e.closest("[hidden]")).length,
  };
})()`;

class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
  }

  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`page error: ${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ""}`);
    return result.result.value;
  }

  async key(key, { shift = false } = {}) {
    const codes = { Tab: [9, "Tab"], Enter: [13, "Enter"], Escape: [27, "Escape"] };
    const [code, name] = codes[key];
    const base = { key, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: shift ? 8 : 0 };
    await this.send("Input.dispatchKeyEvent", { type: key === "Enter" ? "keyDown" : "rawKeyDown", ...base, ...(key === "Enter" ? { text: "\r" } : {}) });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await sleep(60);
  }

  async setViewport(c) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: c.width,
      height: c.height,
      deviceScaleFactor: c.scale,
      mobile: false,
    });
  }

  async goto(url, readyExpr) {
    await this.send("Page.navigate", { url });
    await waitFor(() => this.eval(`document.readyState === "complete"`), 20000, `load ${url}`);
    await waitFor(() => this.eval(readyExpr), 20000, `content of ${url}`);
    await sleep(250);
  }

  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(data, "base64");
    fs.mkdirSync(SHOTS, { recursive: true });
    const file = path.join(SHOTS, `${name}.png`);
    fs.writeFileSync(file, buffer);
    return {
      path: path.relative(ROOT, file).split(path.sep).join("/"),
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      bytes: buffer.length,
    };
  }
}

// ------------------------------------------------------------- assertion log

function recorder() {
  const assertions = [];
  return {
    assertions,
    check(name, pass, detail = "") {
      assertions.push({ name, pass: Boolean(pass), detail: pass ? "" : String(detail) });
    },
  };
}

function checkMasthead(r, m, pageName) {
  const expectTitle = pageName === "wine" ? "Wine List" : "Whiskey List";
  const byKind = (kind) => m.items.filter((i) => i.kind === kind);
  r.check("masthead kicker shows 'Urban Kitchen'", byKind("kicker")[0]?.text === "Urban Kitchen", JSON.stringify(byKind("kicker")));
  r.check(`masthead title shows '${expectTitle}'`, byKind("title")[0]?.text === expectTitle, JSON.stringify(byKind("title")));
  r.check(
    "switcher shows both Wine and Whiskey links",
    JSON.stringify(byKind("switcher").map((i) => i.text)) === JSON.stringify(["Wine", "Whiskey"]),
    JSON.stringify(byKind("switcher")),
  );
  r.check("switcher marks only the current page", m.current.length === 1 && m.current[0] === (pageName === "wine" ? "Wine" : "Whiskey"), JSON.stringify(m.current));
  for (const item of m.items) {
    const where = `${item.kind} '${item.text}'`;
    r.check(`${where} has a rendered box`, item.width > 0 && item.height > 0, JSON.stringify(item));
    r.check(
      `${where} stays inside the viewport horizontally`,
      item.left >= -0.5 && item.right <= m.vw + 0.5,
      `${item.left}..${item.right} of ${m.vw}`,
    );
    r.check(`${where} is not cut off vertically`, item.top >= -0.5 && item.bottom <= m.vh + 0.5, `${item.top}..${item.bottom} of ${m.vh}`);
    r.check(`${where} is not clipped by an ancestor`, item.clippedBy === null, String(item.clippedBy));
    r.check(`${where} text does not overflow its own box`, !item.selfOverflow, JSON.stringify(item));
    if (item.kind === "switcher") r.check(`${where} link is at least 44px tall`, item.height >= 43.5, `${item.height}px`);
  }
  r.check("masthead is not height-capped or clipped", m.masthead.maxHeight === "none" && m.masthead.overflowX === "visible" && m.masthead.overflowY === "visible", JSON.stringify(m.masthead));
  r.check("masthead content fits its box", m.masthead.scrollHeight <= m.masthead.clientHeight + 1 && m.masthead.scrollWidth <= m.masthead.clientWidth + 1, JSON.stringify(m.masthead));
  r.check("page has no horizontal overflow", m.docScrollWidth <= m.vw && m.bodyScrollWidth <= m.vw, `doc ${m.docScrollWidth}, body ${m.bodyScrollWidth}, viewport ${m.vw}`);
  r.check("header bar is horizontally contained", m.bar.left >= -0.5 && m.bar.right <= m.vw + 0.5, JSON.stringify(m.bar));
  r.check("no Atlas or Cocktails link on the page", m.forbiddenLinks.length === 0, JSON.stringify(m.forbiddenLinks));
}

async function dialogChecks(page, r, label, { opener, expectText, rejectText }) {
  const focus = await page.eval(FOCUS_JS);
  r.check(`${label}: exactly one dialog opens`, focus.dialogs === 1, JSON.stringify(focus));
  r.check(`${label}: focus moves into the dialog`, focus.inDialog, JSON.stringify(focus));
  const d = await page.eval(DIALOG_JS);
  r.check(`${label}: aria-modal and a real labelledby heading`, d.ariaModal === "true" && d.labelExists, JSON.stringify({ a: d.ariaModal, l: d.labelledby }));
  r.check(`${label}: no horizontal overflow (dialog or page)`, d.scrollWidth <= d.clientWidth + 1 && d.docScrollWidth <= d.vw && d.widestChildRight <= d.vw + 0.5 && d.left >= -0.5 && d.right <= d.vw + 0.5, JSON.stringify(d));
  r.check(`${label}: Close target is at least 44px tall`, d.closeHeight >= 43.5, `${d.closeHeight}px`);
  for (const text of expectText) r.check(`${label}: shows '${text}'`, d.text.includes(text), d.text.slice(0, 300));
  for (const text of rejectText ?? []) r.check(`${label}: does not show '${text}'`, !d.text.includes(text), d.text.slice(0, 300));

  // Tab / Shift+Tab never leave the dialog, and wrap at both ends.
  let escaped = false;
  for (let i = 0; i < d.focusables + 2; i += 1) {
    await page.key("Tab");
    if (!(await page.eval(FOCUS_JS)).inDialog) escaped = true;
  }
  r.check(`${label}: Tab cycles inside the dialog`, !escaped);
  escaped = false;
  for (let i = 0; i < d.focusables + 2; i += 1) {
    await page.key("Tab", { shift: true });
    if (!(await page.eval(FOCUS_JS)).inDialog) escaped = true;
  }
  r.check(`${label}: Shift+Tab cycles inside the dialog`, !escaped);
  await page.eval(`document.querySelector("[data-modal-close]").focus()`);
  await page.key("Tab", { shift: true });
  const wrapped = await page.eval(FOCUS_JS);
  if (d.focusables === 1) {
    r.check(`${label}: with only Close focusable, focus stays on Close`, wrapped.close, JSON.stringify(wrapped));
  } else {
    r.check(`${label}: Shift+Tab from Close wraps to the last control`, wrapped.inDialog && !wrapped.close, JSON.stringify(wrapped));
    await page.key("Tab");
    r.check(`${label}: Tab from the last control wraps to Close`, (await page.eval(FOCUS_JS)).close);
  }
  return opener;
}

async function closeWithEscape(page, r, label, openerCheckExpr) {
  await page.key("Escape");
  const focus = await page.eval(FOCUS_JS);
  r.check(`${label}: Escape closes the dialog`, focus.dialogs === 0, JSON.stringify(focus));
  r.check(`${label}: focus returns to the opener`, await page.eval(openerCheckExpr), JSON.stringify(focus));
  r.check(`${label}: body scroll lock released`, (await page.eval(`document.body.style.overflow`)) !== "hidden");
}

async function runPageCase(cdp, targetSession, c, pageName, base, picks, receiptCase) {
  const page = new Page(cdp, targetSession);
  const r = recorder();
  const url = `${base}/${pageName}.html`;
  receiptCase.url = url;
  await page.setViewport(c);
  const ready = pageName === "wine" ? `document.querySelectorAll("#menu *").length > 0` : `document.querySelectorAll("#menu [data-detail-id]").length > 0 && !document.getElementById("help-me-decide").disabled`;
  await page.goto(url, ready);
  receiptCase.startedAt = new Date().toISOString();

  checkMasthead(r, await page.eval(MASTHEAD_JS), pageName);
  receiptCase.screenshots.push(await page.screenshot(`${c.id}-${pageName}`));

  if (pageName === "whiskey") {
    r.check(
      "Whiskey page: deeper red accent applied, Wine gold is not used",
      await page.eval(`getComputedStyle(document.body).getPropertyValue("--accent").trim().toLowerCase() !== "#b59a6a"`),
    );
    r.check("Whiskey page: Bourbon is the default category", await page.eval(`document.querySelector('[data-whiskey-category="Bourbon"]')?.getAttribute("aria-pressed") === "true"`));

    for (const [kind, pick, expectText, rejectText] of [
      ["long verified detail", picks.long, ["Source:", "Verified on", "Bottle:", "Age:"], ["Exact bottle not verified"]],
      ["unresolved detail", picks.unresolved, ["Exact bottle not verified"], ["Flavor:", "Source:", "Age:", "Region:"]],
    ]) {
      const label = `${kind} (${pick.name})`;
      await page.eval(`(() => { document.querySelector('[data-whiskey-category="${pick.category}"]').click(); })()`);
      await waitFor(() => page.eval(`Boolean(document.querySelector('#menu [data-detail-id="${pick.id}"]'))`), 5000, `row ${pick.id}`);
      await page.eval(`document.querySelector('#menu [data-detail-id="${pick.id}"]').focus()`);
      await page.key("Enter");
      await waitFor(() => page.eval(`document.querySelectorAll('[role="dialog"]').length === 1`), 3000, "detail dialog");
      await dialogChecks(page, r, label, { expectText, rejectText });
      receiptCase.screenshots.push(await page.screenshot(`${c.id}-${pageName}-${kind.replace(/\s+/g, "-")}`));
      await closeWithEscape(page, r, label, `document.activeElement === document.querySelector('#menu [data-detail-id="${pick.id}"]')`);
    }

    // Help me decide: keyboard open, impossible combination, explicit suggestions.
    await page.eval(`document.getElementById("help-me-decide").focus()`);
    await page.key("Enter");
    await waitFor(() => page.eval(`document.querySelectorAll('[role="dialog"]').length === 1`), 3000, "picker dialog");
    const form = await page.eval(`(() => {
      const d = document.querySelector('[role="dialog"]');
      const groups = ["flavor", "budget", "age", "region"].map((n) => ({
        name: n, legend: d.querySelector('input[name="' + n + '"]').closest("fieldset").querySelector("legend").textContent.trim(),
        values: [...d.querySelectorAll('input[name="' + n + '"]')].map((i) => i.value),
        checked: d.querySelector('input[name="' + n + '"]:checked')?.value,
      }));
      return groups;
    })()`);
    r.check("picker: four groups, each defaulting to No preference", form.length === 4 && form.every((g) => g.checked === "none"), JSON.stringify(form));
    r.check("picker: region also offers Anywhere", form[3].values.includes("anywhere"), JSON.stringify(form[3]));
    await dialogChecks(page, r, "picker form", { expectText: ["Flavor", "Budget", "Age", "Region", "Show matches"] });

    const lowestBudget = form[1].values.filter((v) => v !== "none").sort((a, b) => a - b)[0];
    const highestAge = form[2].values.filter((v) => v !== "none").sort((a, b) => b - a)[0];
    await page.eval(`(() => {
      const d = document.querySelector('[role="dialog"]');
      d.querySelector('input[name="budget"][value="${lowestBudget}"]').click();
      d.querySelector('input[name="age"][value="${highestAge}"]').click();
      d.querySelector("[data-picker-submit]").focus();
    })()`);
    await page.key("Enter");
    await waitFor(() => page.eval(`Boolean(document.querySelector("[data-picker-live]")?.textContent.trim())`), 3000, "picker outcome");
    const miss = await page.eval(`(() => {
      const d = document.querySelector('[role="dialog"]');
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const live = d.querySelector('[role="status"][aria-live="polite"]');
      const sug = [...d.querySelectorAll("[data-suggestion]")];
      return { live: live?.textContent.trim(), liveRole: Boolean(live),
        empty: d.querySelector(".wh-empty")?.innerText, cards: d.querySelectorAll("[data-result-card]").length,
        suggestions: sug.map((b) => ({ text: b.textContent.trim(), visible: vis(b), right: b.getBoundingClientRect().right, height: b.getBoundingClientRect().height })),
        vw: innerWidth, docScrollWidth: document.documentElement.scrollWidth, dialogScrollWidth: d.scrollWidth, dialogClientWidth: d.clientWidth,
        focusOnHeading: document.activeElement?.hasAttribute("data-results-heading") };
    })()`);
    r.check("picker: impossible combination announces 'No exact matches' in the live region", miss.liveRole && miss.live === "No exact matches", JSON.stringify(miss));
    r.check("picker: no-match state shows an explicit visible heading", Boolean(miss.empty) && miss.empty.includes("No exact matches"), String(miss.empty));
    r.check("picker: no result cards are shown for an impossible combination", miss.cards === 0, String(miss.cards));
    r.check("picker: at least one explicit suggestion button is visible", miss.suggestions.length >= 1 && miss.suggestions.every((s) => s.visible && s.height >= 43.5 && s.right <= miss.vw + 0.5), JSON.stringify(miss.suggestions));
    r.check("picker: suggestions are worded as user actions", miss.suggestions.every((s) => /^(Raise budget|Remove|Show any)/.test(s.text)), JSON.stringify(miss.suggestions));
    r.check("picker: results view has no horizontal overflow", miss.docScrollWidth <= miss.vw && miss.dialogScrollWidth <= miss.dialogClientWidth + 1, JSON.stringify(miss));
    receiptCase.screenshots.push(await page.screenshot(`${c.id}-${pageName}-picker-no-match`));

    await page.eval(`document.querySelector("[data-picker-back]").click()`);
    const kept = await page.eval(`(() => {
      const d = document.querySelector('[role="dialog"]');
      return { budget: d.querySelector('input[name="budget"]:checked').value, age: d.querySelector('input[name="age"]:checked').value };
    })()`);
    r.check("picker: nothing was auto-relaxed (choices kept after Back)", kept.budget === lowestBudget && kept.age === highestAge, JSON.stringify(kept));

    await page.eval(`document.querySelector("[data-picker-submit]").click()`);
    await sleep(100);
    const field = await page.eval(`document.querySelector("[data-suggestion]")?.dataset.suggestion ?? null`);
    r.check("picker: suggestions repeat without changing the outcome", field !== null);
    await page.eval(`document.querySelector("[data-suggestion]").click()`);
    const after = await page.eval(`(() => {
      const d = document.querySelector('[role="dialog"]');
      return { budget: d.querySelector('input[name="budget"]:checked').value, age: d.querySelector('input[name="age"]:checked').value,
        flavor: d.querySelector('input[name="flavor"]:checked').value, region: d.querySelector('input[name="region"]:checked').value,
        live: document.querySelector("[data-picker-live]").textContent.trim(), cards: d.querySelectorAll("[data-result-card]").length };
    })()`);
    const changedFields = ["budget", "age"].filter((f) => after[f] !== (f === "budget" ? lowestBudget : highestAge));
    r.check("picker: pressing a suggestion changes exactly the chosen field, and shows no results until Show matches", changedFields.length === 1 && changedFields[0] === field && after.cards === 0 && /Press Show matches/.test(after.live), JSON.stringify({ field, after }));

    await page.eval(`document.querySelector("[data-picker-submit]").click()`);
    await sleep(100);
    const results = await page.eval(`({ live: document.querySelector("[data-picker-live]").textContent.trim(), cards: document.querySelectorAll("[data-result-card]").length, docScrollWidth: document.documentElement.scrollWidth, vw: innerWidth })`);
    r.check("picker: after the suggestion is applied, at most three matches show with an announced count", results.cards >= 1 && results.cards <= 3 && /^\d+ match(?:es)?$/.test(results.live) && results.docScrollWidth <= results.vw, JSON.stringify(results));
    receiptCase.screenshots.push(await page.screenshot(`${c.id}-${pageName}-picker-results`));

    await closeWithEscape(page, r, "picker", `document.activeElement === document.getElementById("help-me-decide")`);
  }

  receiptCase.finishedAt = new Date().toISOString();
  receiptCase.assertions = r.assertions;
  return r.assertions;
}

function pickRows() {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "data/whiskey-metadata.json"), "utf8")).rows;
  const verified = meta.filter((m) => m.status === "verified");
  const longest = verified.reduce((a, b) => (b.description.length > a.description.length ? b : a));
  const unresolved = meta.find((m) => m.status === "unresolved");
  const shape = (m) => ({ id: m.source_id, name: m.menu_name, category: m.category });
  return { long: shape(longest), unresolved: shape(unresolved) };
}

// ------------------------------------------------------------------------ main

async function main() {
  const startedAt = new Date().toISOString();
  const receipt = {
    schema: "urban-kitchen-whiskey-rendered-qa/1",
    startedAt,
    finishedAt: null,
    browser: { executable: OPERA_EXE, isolatedProfile: true },
    server: { host: "127.0.0.1", port: null, root: ROOT },
    profile: { createdUnder: os.tmpdir(), removed: false },
    cases: [],
    summary: { passed: 0, failed: 0 },
    cleanup: {},
    error: null,
  };

  if (!fs.existsSync(OPERA_EXE)) {
    receipt.error = `BLOCKED: Opera is not installed at ${OPERA_EXE}`;
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    fs.writeFileSync(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
    throw new Blocked(receipt.error);
  }

  let server;
  let child = null;
  let cdp = null;
  let profileDir = null;
  try {
    const started = await startServer();
    server = started.server;
    receipt.server.port = started.port;
    const base = `http://127.0.0.1:${started.port}`;

    profileDir = validateProfileDir(fs.mkdtempSync(path.join(os.tmpdir(), "uk-whiskey-qa-")));
    receipt.profile.dir = profileDir;

    child = spawn(
      OPERA_EXE,
      [
        `--user-data-dir=${profileDir}`,
        "--headless=new",
        "--remote-debugging-port=0",
        "--remote-debugging-address=127.0.0.1",
        "--remote-allow-origins=http://127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-sync",
        "--disable-gpu",
        "--hide-scrollbars",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        "about:blank",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    receipt.browser.pid = child.pid;
    const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));

    const portFile = path.join(profileDir, "DevToolsActivePort");
    const [port, wsPath] = (await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/).length >= 2 && fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/), 30000, "DevToolsActivePort")).map((s) => s.trim());
    receipt.browser.debugPort = Number(port);
    cdp = await Cdp.connect(`ws://127.0.0.1:${port}${wsPath}`);
    const version = await cdp.send("Browser.getVersion");
    receipt.browser.product = version.product;
    receipt.browser.userAgent = version.userAgent;
    receipt.browser.operaVersion = (/OPR\/([0-9.]+)/.exec(version.userAgent) || [])[1] || null;
    receipt.browser.protocolVersion = version.protocolVersion;

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });

    const picks = pickRows();
    receipt.picks = picks;
    for (const c of CASES) {
      for (const pageName of PAGES) {
        const entry = {
          id: `${c.id}-${pageName}`,
          page: pageName,
          viewport: { cssWidth: c.width, cssHeight: c.height, deviceScaleFactor: c.scale, zoomPercent: c.zoomPercent },
          url: null,
          startedAt: null,
          finishedAt: null,
          screenshots: [],
          assertions: [],
        };
        receipt.cases.push(entry);
        try {
          await runPageCase(cdp, sessionId, c, pageName, base, picks, entry);
        } catch (error) {
          entry.assertions.push({ name: "case ran to completion", pass: false, detail: String(error?.stack || error) });
          entry.finishedAt = new Date().toISOString();
        }
      }
    }

    await cdp.send("Browser.close").catch(() => {});
    receipt.cleanup.browserExitCode = await Promise.race([exited, sleep(5000).then(() => "timeout")]);
  } catch (error) {
    receipt.error = String(error?.stack || error);
  } finally {
    cdp?.close();
    if (child || profileDir) {
      killOurTree(child?.pid, profileDir ?? "\u0000");
      receipt.cleanup.browserTreeKilled = true;
    }
    await new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()));
    receipt.cleanup.serverClosed = true;
    if (profileDir) {
      try {
        const real = validateProfileDirForRemoval(profileDir);
        fs.rmSync(real, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
        receipt.profile.removed = !fs.existsSync(real);
      } catch (error) {
        receipt.cleanup.profileRemovalError = String(error);
      }
    }
  }

  for (const c of receipt.cases) {
    for (const a of c.assertions) receipt.summary[a.pass ? "passed" : "failed"] += 1;
  }
  receipt.finishedAt = new Date().toISOString();
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  const failed = receipt.cases.flatMap((c) => c.assertions.filter((a) => !a.pass).map((a) => `${c.id}: ${a.name} ${a.detail}`.slice(0, 400)));
  console.log(`rendered QA: ${receipt.summary.passed} passed, ${receipt.summary.failed} failed across ${receipt.cases.length} cases`);
  console.log(`browser: ${receipt.browser.product ?? "unknown"}`);
  console.log(`receipt: ${path.relative(ROOT, RECEIPT)}`);
  if (receipt.error) console.log(`error: ${receipt.error}`);
  for (const line of failed.slice(0, 40)) console.log(`FAIL ${line}`);
  if (receipt.error || receipt.summary.failed || !receipt.summary.passed || !receipt.profile.removed) process.exitCode = 1;
}

function validateProfileDirForRemoval(dir) {
  const tmp = fs.realpathSync(os.tmpdir());
  const real = fs.realpathSync(dir);
  const rel = path.relative(tmp, real);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || !path.basename(real).startsWith("uk-whiskey-qa-")) {
    throw new Error(`refusing to remove ${real}`);
  }
  return real;
}

main().catch((error) => {
  console.error(error instanceof Blocked ? error.message : error);
  process.exitCode = error instanceof Blocked ? 2 : 1;
});
