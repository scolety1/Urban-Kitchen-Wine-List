import assert from "node:assert/strict";
import test from "node:test";
import { createFakeDocument } from "./helpers/fake-dom.mjs";
import { openDrawerHtml, closeDrawer } from "../js/drawer.js";

function setup(t) {
  const previous = { document: globalThis.document, window: globalThis.window };
  const doc = createFakeDocument();
  globalThis.document = doc;
  globalThis.window = new EventTarget();
  doc.body.innerHTML = '<header id="top-bar"><button id="opener">Details</button></header><main id="content"></main><div id="drawer-backdrop"></div><div id="drawer"></div>';
  const opener = doc.getElementById("opener");
  opener.focus();
  t.after(() => {
    closeDrawer();
    globalThis.document = previous.document;
    globalThis.window = previous.window;
  });
  return { doc, opener, drawer: doc.getElementById("drawer") };
}

function key(key, shiftKey = false) {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { key, shiftKey });
  window.dispatchEvent(event);
  return event;
}

test("Wine Escape still dismisses the panel after another keypress and after reopening", (t) => {
  const { doc } = setup(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    openDrawerHtml({ title: "Wine details" });
    key("ArrowDown");
    key("Escape");
    assert.equal(doc.body.classList.contains("drawer-open"), false);
  }
});

test("Wine panel receives focus, traps keyboard navigation, and restores its opener", (t) => {
  const { doc, drawer, opener } = setup(t);
  openDrawerHtml({ title: "Wine details", body: '<button id="last-choice">Choose this</button>' });
  assert.equal(doc.activeElement, drawer);
  assert.equal(drawer.getAttribute("role"), "dialog");
  assert.equal(doc.getElementById(drawer.getAttribute("aria-labelledby")).textContent, "Wine details");
  const close = drawer.querySelector(".drawer-close");
  const last = doc.getElementById("last-choice");
  close.focus();
  assert.equal(key("Tab", true).defaultPrevented, true);
  assert.equal(doc.activeElement, last);
  assert.equal(key("Tab").defaultPrevented, true);
  assert.equal(doc.activeElement, close);
  key("Escape");
  assert.equal(doc.activeElement, opener);
});

test("Wine background stays inactive during the panel and closed controls leave the accessibility tree", (t) => {
  const { doc, drawer } = setup(t);
  doc.body.style.overflow = "auto";
  doc.getElementById("content").setAttribute("inert", "");
  openDrawerHtml({ title: "Wine details" });
  assert.equal(doc.getElementById("top-bar").hasAttribute("inert"), true);
  assert.equal(doc.body.style.overflow, "hidden");
  doc.getElementById("drawer-backdrop").click();
  assert.equal(doc.getElementById("top-bar").hasAttribute("inert"), false);
  assert.equal(doc.getElementById("content").hasAttribute("inert"), true);
  assert.equal(doc.body.style.overflow, "auto");
  assert.equal(drawer.getAttribute("aria-hidden"), "true");
  assert.equal(drawer.hasAttribute("inert"), true);
});
