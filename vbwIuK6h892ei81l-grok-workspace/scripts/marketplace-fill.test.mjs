import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const fillPath = join(root, "extension/fill.js");
const formPath = join(root, "extension/fixtures/marketplace-vehicle.html");
const fillSource = readFileSync(fillPath, "utf8");
const formHtml = readFileSync(formPath, "utf8");
const VIN = "1HGCY2F53MA123456";

function createDocument() {
  class Event {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
    }
  }
  class KeyboardEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.key = init.key ?? "";
      this.code = init.code ?? "";
    }
  }
  class MouseEvent extends Event {}
  class InputEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.data = init.data;
      this.inputType = init.inputType;
    }
  }
  class HTMLElement {
    constructor(tag) {
      this.tagName = String(tag || "div").toUpperCase();
      this.nodeType = 1;
      this.children = [];
      this.childNodes = [];
      this.attributes = {};
      this.dataset = {};
      this.style = {};
      this.parentElement = null;
      this.ownerDocument = null;
      this.clicks = 0;
      this._text = "";
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }
    appendChild(node) {
      node.parentElement = this;
      this.childNodes.push(node);
      if (node.nodeType !== 3) this.children.push(node);
      return node;
    }
    get textContent() {
      if (this.childNodes.length) {
        return this.childNodes.map((node) => node.textContent || "").join("");
      }
      return this._text;
    }
    set textContent(value) {
      this._text = String(value);
      this.childNodes = [{ nodeType: 3, textContent: this._text, parentElement: this }];
      this.children = [];
    }
    get innerText() {
      const raw = this.childNodes
        .map((node) => (node.nodeType === 3 ? node.textContent : node.innerText || ""))
        .join(" ");
      return raw.replace(/\s+/g, " ").trim();
    }
    get childElementCount() {
      return this.children.length;
    }
    get nextElementSibling() {
      if (!this.parentElement) return null;
      const index = this.parentElement.children.indexOf(this);
      return this.parentElement.children[index + 1] ?? null;
    }
    matches(selector) {
      return selector.split(",").some((part) => matchSimple(this, part.trim()));
    }
    querySelectorAll(selector) {
      return collect(this, selector, false);
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches?.(selector)) return node;
        node = node.parentElement;
      }
      return null;
    }
    focus() {
      if (this.ownerDocument) this.ownerDocument.activeElement = this;
    }
    blur() {
      if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = null;
    }
    click() {
      this.clicks += 1;
      this.ownerDocument?._log.push({
        kind: "click",
        text: this.innerText || this.getAttribute("aria-label") || "",
        id: this.getAttribute("id") || "",
      });
    }
    dispatchEvent(event) {
      event.target = this;
      this.ownerDocument?._log.push({ kind: "event", type: event.type, key: event.key || "" });
    }
  }
  class HTMLInputElement extends HTMLElement {
    constructor() {
      super("input");
      this._value = "";
    }
    get value() {
      return this._value;
    }
    set value(value) {
      this._value = String(value);
    }
    get type() {
      return (this.getAttribute("type") || "text").toLowerCase();
    }
  }
  class HTMLTextAreaElement extends HTMLElement {
    constructor() {
      super("textarea");
      this._value = "";
    }
    get value() {
      return this._value;
    }
    set value(value) {
      this._value = String(value);
    }
  }
  class HTMLSelectElement extends HTMLElement {
    constructor() {
      super("select");
      this._value = "";
    }
    get value() {
      return this._value;
    }
    set value(value) {
      this._value = String(value);
    }
    get options() {
      return this.querySelectorAll("option");
    }
  }

  const document = {
    activeElement: null,
    _log: [],
    documentElement: null,
    body: null,
    createElement(tag) {
      const name = String(tag).toLowerCase();
      const element =
        name === "input"
          ? new HTMLInputElement()
          : name === "textarea"
            ? new HTMLTextAreaElement()
            : name === "select"
              ? new HTMLSelectElement()
              : new HTMLElement(name);
      element.ownerDocument = document;
      return element;
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: String(text), parentElement: null };
    },
    getElementById(id) {
      return findId(document.documentElement, id);
    },
    querySelectorAll(selector) {
      return collect(document.documentElement, selector, true);
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    dispatchEvent(event) {
      this._log.push({ kind: "key", key: event.key || "", type: event.type });
    },
  };
  const html = document.createElement("html");
  const body = document.createElement("body");
  html.appendChild(body);
  document.documentElement = html;
  document.body = body;
  return {
    document,
    HTMLElement,
    HTMLInputElement,
    HTMLTextAreaElement,
    HTMLSelectElement,
    Event,
    KeyboardEvent,
    MouseEvent,
    InputEvent,
  };
}

function matchSimple(element, selector) {
  if (!selector) return false;
  const attrOnly = selector.match(/^\[([\w-]+)=["']([^"']*)["']\]$/);
  if (attrOnly) return (element.getAttribute(attrOnly[1]) || "") === attrOnly[2];
  const both = selector.match(/^([a-z][\w-]*)(?:\[([\w-]+)=["']([^"']*)["']\])?$/i);
  if (!both || element.tagName !== both[1].toUpperCase()) return false;
  if (both[2] && (element.getAttribute(both[2]) || "") !== both[3]) return false;
  return true;
}

function collect(root, selector, includeRoot) {
  const found = [];
  const visit = (node, self) => {
    if (!node || node.nodeType === 3) return;
    if (self && node.matches?.(selector)) found.push(node);
    for (const child of node.children || []) visit(child, true);
  };
  visit(root, includeRoot);
  return found;
}

function findId(node, id) {
  if (!node || node.nodeType === 3) return null;
  if (node.getAttribute?.("id") === id) return node;
  for (const child of node.children || []) {
    const found = findId(child, id);
    if (found) return found;
  }
  return null;
}

function parseHtml(document, html) {
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? [];
  const stack = [document.body];
  let skipping = 0;
  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    if (/^<\/head/i.test(token)) {
      skipping = Math.max(0, skipping - 1);
      continue;
    }
    if (skipping) continue;
    if (token.startsWith("</")) {
      const name = (token.match(/^<\/\s*([a-z0-9:-]+)/i)?.[1] || "").toUpperCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tagName === name) {
          stack.length = index;
          break;
        }
      }
      continue;
    }
    if (!token.startsWith("<")) {
      if (!token.trim()) continue;
      stack[stack.length - 1].appendChild(document.createTextNode(token));
      continue;
    }
    if (/^<!/i.test(token)) continue;
    const tag = (token.match(/^<\s*([a-z0-9:-]+)/i)?.[1] || "").toLowerCase();
    if (!tag || tag === "html" || tag === "body") continue;
    if (tag === "head") {
      skipping += 1;
      continue;
    }
    const element = document.createElement(tag);
    const attrRe = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = attrRe.exec(token))) element.setAttribute(match[1], match[3] ?? match[4] ?? "");
    stack[stack.length - 1].appendChild(element);
    const voidTag = /^(meta|link|img|br|hr|input)$/.test(tag) || /\/>$/.test(token);
    if (!voidTag) stack.push(element);
  }
}

function loadFill() {
  const dom = createDocument();
  parseHtml(dom.document, formHtml);
  const sandbox = {
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    HTMLInputElement: dom.HTMLInputElement,
    HTMLTextAreaElement: dom.HTMLTextAreaElement,
    HTMLSelectElement: dom.HTMLSelectElement,
    Event: dom.Event,
    KeyboardEvent: dom.KeyboardEvent,
    MouseEvent: dom.MouseEvent,
    InputEvent: dom.InputEvent,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    chrome: {
      storage: {
        local: {
          get(_keys, callback) {
            callback({});
          },
        },
      },
      runtime: { sendMessage() {} },
    },
    window: {
      setTimeout(fn) {
        fn();
        return 1;
      },
      setInterval() {
        return 1;
      },
      clearInterval() {},
    },
    console,
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const hooked = `${fillSource}\nglobalThis.__fillTest = { setPacket(next) { packet = next; stopped = false; running = false; photosTried = false; }, fillOnce, colorChoices };\n`;
  vm.runInContext(hooked, context, { filename: "extension/fill.js" });
  return {
    api: sandbox.__fillTest,
    document: dom.document,
    clicked(text) {
      return dom.document._log.some((entry) => entry.kind === "click" && entry.text === text);
    },
    publishClicks() {
      const button = findId(dom.document.documentElement, "publish");
      return button?.clicks ?? 0;
    },
    field(id) {
      const element = findId(dom.document.documentElement, id);
      assert.ok(element, id);
      return element;
    },
  };
}

async function fill(exterior) {
  const harness = loadFill();
  harness.api.setPacket({
    vehicleType: "Car/Truck",
    year: "2021",
    exterior,
    vin: VIN,
    title: "2021 Honda CR-V",
  });
  await harness.api.fillOnce();
  assert.equal(harness.field("vehicle-type-button").clicks >= 1, true);
  assert.equal(harness.clicked("Car/Truck"), true);
  assert.equal(harness.clicked("2021"), true);
  assert.equal(harness.field("vin").value, VIN);
  assert.equal(harness.field("vehicle-type").dataset.cpp, "1");
  assert.equal(harness.field("year").dataset.cpp, "1");
  assert.equal(harness.field("exterior").dataset.cpp, "1");
  assert.equal(harness.field("vin").dataset.cpp, "1");
  assert.equal(harness.publishClicks(), 0);
  assert.equal(
    harness.document._log.some((entry) => entry.kind === "click" && entry.id === "publish"),
    false,
  );
  return harness;
}

describe("facebook marketplace fill", () => {
  it("keeps fill.js a classic script", () => {
    assert.equal(/^\s*import\s/m.test(fillSource), false);
    assert.equal(/^\s*export\s/m.test(fillSource), false);
  });

  it("selects vehicle type, year, and exterior color, and types the VIN", async () => {
    const harness = await fill("Oxford White");
    assert.equal(harness.clicked("White"), true);
    assert.equal(harness.clicked("Other"), false);
    assert.equal(choices(harness, "Oxford White"), "White,Other");
    assert.equal(choices(harness, "Magnetic Grey"), "Gray,Other");
  });

  it("maps a dealer grey name onto Facebook Gray", async () => {
    const harness = await fill("Magnetic Grey");
    assert.equal(harness.clicked("Gray"), true);
  });

  it("chooses Other for an unknown color and then closes the menu", async () => {
    const harness = await fill("Chartreuse");
    const otherAt = harness.document._log.findIndex(
      (entry) => entry.kind === "click" && entry.text === "Other",
    );
    const escapeAfter = harness.document._log.findIndex(
      (entry, index) => index > otherAt && entry.kind === "key" && entry.key === "Escape",
    );
    assert.equal(otherAt >= 0, true);
    assert.equal(escapeAfter > otherAt, true);
    assert.equal(choices(harness, "Chartreuse"), "Other");
  });
});

function choices(harness, color) {
  return Array.from(harness.api.colorChoices("Exterior color", color), String).join(",");
}
