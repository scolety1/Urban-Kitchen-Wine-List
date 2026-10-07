// Tiny hand-made DOM for plain-node tests (no packages). Supports just what the
// Whiskey dialog/picker/detail wiring uses: innerHTML parsing, simple selectors,
// bubbling events, focus tracking, radio groups and form submit.

const VOID = new Set(["input", "br", "img", "hr", "meta", "link"]);

const decode = (s) =>
  s
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

export class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles !== false;
    this.key = init.key;
    this.shiftKey = Boolean(init.shiftKey);
    this.target = null;
    this.defaultPrevented = false;
    this.stopped = false;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this.stopped = true;
  }
}

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.text = text;
    this.parentNode = null;
  }
  get textContent() {
    return this.text;
  }
}

function parseSelectorPart(part) {
  const checks = [];
  let rest = part.trim();
  const tag = rest.match(/^[a-zA-Z][\w-]*|^\*/);
  if (tag) {
    if (tag[0] !== "*") checks.push((el) => el.tagName === tag[0].toUpperCase());
    rest = rest.slice(tag[0].length);
  }
  while (rest) {
    let m;
    if ((m = rest.match(/^#([\w-]+)/))) {
      const id = m[1];
      checks.push((el) => el.id === id);
    } else if ((m = rest.match(/^\.([\w-]+)/))) {
      const cls = m[1];
      checks.push((el) => el.classList.contains(cls));
    } else if ((m = rest.match(/^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/))) {
      const name = m[1];
      const value = m[2] ?? m[3] ?? m[4];
      checks.push((el) =>
        value === undefined ? el.hasAttribute(name) : el.getAttribute(name) === value,
      );
    } else if ((m = rest.match(/^:checked/))) {
      checks.push((el) => Boolean(el.checked));
    } else if ((m = rest.match(/^:not\(((?:[^()]|\([^()]*\))*)\)/))) {
      const inner = parseSelector(m[1]);
      checks.push((el) => !inner(el));
    } else {
      throw new Error(`fake-dom: unsupported selector fragment "${rest}"`);
    }
    rest = rest.slice(m[0].length);
  }
  return (el) => checks.every((check) => check(el));
}

function splitTop(selector, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  let inBracket = false;
  for (const ch of selector) {
    if (ch === "[") inBracket = true;
    if (ch === "]") inBracket = false;
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === separator && depth === 0 && !inBracket) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.filter((p) => p.trim());
}

function parseSelector(selector) {
  const alternatives = splitTop(selector, ",").map((alt) => {
    const compounds = splitTop(alt.trim(), " ").map(parseSelectorPart);
    return (el) => {
      if (!compounds[compounds.length - 1](el)) return false;
      let node = el.parentNode;
      for (let i = compounds.length - 2; i >= 0; i -= 1) {
        while (node && node.nodeType === 1 && !compounds[i](node)) node = node.parentNode;
        if (!node || node.nodeType !== 1) return false;
        node = node.parentNode;
      }
      return true;
    };
  });
  return (el) => alternatives.some((fn) => fn(el));
}

const camelToData = (key) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

export class FakeElement {
  constructor(doc, tagName) {
    this.nodeType = 1;
    this.ownerDocument = doc;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {
      setProperty: (k, v) => {
        this.style[k] = v;
      },
    };
    this._checked = null;
    this._value = null;
    const el = this;
    const classes = () => (el.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    this.classList = {
      contains: (c) => classes().includes(c),
      add: (c) => el.setAttribute("class", [...new Set([...classes(), c])].join(" ")),
      remove: (c) => el.setAttribute("class", classes().filter((x) => x !== c).join(" ")),
      toggle: (c, force) => {
        const want = force === undefined ? !classes().includes(c) : force;
        if (want) el.classList.add(c);
        else el.classList.remove(c);
        return want;
      },
    };
    this.dataset = new Proxy(
      {},
      {
        get: (_, key) => {
          if (typeof key !== "string") return undefined;
          const attr = camelToData(key);
          return el.attributes.has(attr) ? el.attributes.get(attr) : undefined;
        },
        set: (_, key, value) => {
          el.setAttribute(camelToData(key), String(value));
          return true;
        },
      },
    );
  }

  get id() {
    return this.getAttribute("id") || "";
  }
  set id(v) {
    this.setAttribute("id", v);
  }
  get className() {
    return this.getAttribute("class") || "";
  }
  set className(v) {
    this.setAttribute("class", v);
  }
  get hidden() {
    return this.hasAttribute("hidden");
  }
  set hidden(v) {
    if (v) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  get type() {
    return this.getAttribute("type") || (this.tagName === "BUTTON" ? "submit" : "text");
  }
  get name() {
    return this.getAttribute("name") || "";
  }
  get checked() {
    return this._checked === null ? this.hasAttribute("checked") : this._checked;
  }
  set checked(v) {
    this._checked = Boolean(v);
  }
  get value() {
    return this._value === null ? (this.getAttribute("value") ?? "") : this._value;
  }
  set value(v) {
    this._value = String(v);
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get textContent() {
    return this.childNodes.map((n) => n.textContent).join("");
  }
  set textContent(v) {
    this.childNodes.forEach((n) => (n.parentNode = null));
    this.childNodes = [];
    if (v) this.appendChild(new FakeText(String(v)));
  }
  get innerHTML() {
    return this._innerHTML ?? "";
  }
  set innerHTML(html) {
    this.childNodes.forEach((n) => (n.parentNode = null));
    this.childNodes = [];
    this._innerHTML = String(html);
    parseInto(this, String(html));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  append(...nodes) {
    nodes.forEach((n) => this.appendChild(typeof n === "string" ? new FakeText(n) : n));
  }
  insertBefore(node, ref) {
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = ref ? this.childNodes.indexOf(ref) : -1;
    node.parentNode = this;
    if (index < 0) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  replaceChildren(...nodes) {
    this.childNodes.forEach((n) => (n.parentNode = null));
    this.childNodes = [];
    this.append(...nodes);
  }
  remove() {
    const doc = this.ownerDocument;
    const hadFocus = doc.activeElement && this.contains(doc.activeElement);
    if (this.parentNode) this.parentNode.removeChild(this);
    if (hadFocus) doc.activeElement = doc.body;
  }
  contains(node) {
    for (let n = node; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  matches(selector) {
    return parseSelector(selector)(this);
  }
  closest(selector) {
    const test = parseSelector(selector);
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (test(n)) return n;
    return null;
  }
  querySelectorAll(selector) {
    const test = parseSelector(selector);
    const out = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        if (test(child)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  getBoundingClientRect() {
    return { height: 100, width: 320, top: 0, left: 0 };
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    const doc = this.ownerDocument;
    for (let node = this; node && !event.stopped; node = node.parentNode) {
      for (const handler of [...(node.listeners.get(event.type) ?? [])]) handler.call(node, event);
      if (!event.bubbles) break;
      if (node === doc.documentElement && !event.stopped) {
        for (const handler of [...(doc.listeners.get(event.type) ?? [])]) handler.call(doc, event);
      }
    }
    return !event.defaultPrevented;
  }
  focus() {
    if (this.disabled || !this.ownerDocument.documentElement.contains(this)) return;
    this.ownerDocument.activeElement = this;
  }
  blur() {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
  }
  click() {
    if (this.disabled) return;
    if (this.tagName === "INPUT" && this.type === "radio") {
      const scope = this.closest("form") || this.ownerDocument.documentElement;
      scope
        .querySelectorAll('input[type="radio"]')
        .filter((r) => r.name === this.name)
        .forEach((r) => {
          r.checked = false;
        });
      this.checked = true;
    }
    const event = new FakeEvent("click");
    this.dispatchEvent(event);
    if (!event.defaultPrevented && this.tagName === "BUTTON" && this.type === "submit") {
      const form = this.closest("form");
      if (form) form.dispatchEvent(new FakeEvent("submit"));
    }
  }
}

function parseInto(parent, html) {
  const doc = parent.ownerDocument;
  const token =
    /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|[^<]+/g;
  const stack = [parent];
  let m;
  while ((m = token.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const tag = m[1].toUpperCase();
      const idx = stack.map((n) => n.tagName).lastIndexOf(tag);
      if (idx > 0) stack.length = idx;
    } else if (m[2]) {
      const el = new FakeElement(doc, m[2]);
      const attrRe = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let a;
      while ((a = attrRe.exec(m[3] || ""))) {
        const value = a[2] ?? a[3] ?? a[4];
        el.setAttribute(a[1], value === undefined ? "" : decode(value));
      }
      top.appendChild(el);
      if (!VOID.has(m[2].toLowerCase()) && !m[0].endsWith("/>")) stack.push(el);
    } else {
      top.appendChild(new FakeText(decode(m[0])));
    }
  }
}

export function createFakeDocument() {
  const doc = {
    listeners: new Map(),
    activeElement: null,
    createElement(tag) {
      return new FakeElement(doc, tag);
    },
    getElementById(id) {
      return doc.documentElement.querySelector(`#${id}`);
    },
    querySelector(sel) {
      return doc.documentElement.querySelector(sel);
    },
    querySelectorAll(sel) {
      return doc.documentElement.querySelectorAll(sel);
    },
    addEventListener(type, handler) {
      if (!doc.listeners.has(type)) doc.listeners.set(type, new Set());
      doc.listeners.get(type).add(handler);
    },
    dispatchEvent(event) {
      event.target ||= doc;
      for (const handler of [...(doc.listeners.get(event.type) ?? [])]) handler.call(doc, event);
      return !event.defaultPrevented;
    },
    removeEventListener(type, handler) {
      doc.listeners.get(type)?.delete(handler);
    },
  };
  doc.documentElement = new FakeElement(doc, "html");
  doc.body = new FakeElement(doc, "body");
  doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;
  return doc;
}

export function keydown(target, key, init = {}) {
  const event = new FakeEvent("keydown", { key, ...init });
  target.dispatchEvent(event);
  return event;
}
