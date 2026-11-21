const FIELDS = [
  ["Vehicle type", "vehicleType", "combo"],
  ["Year", "year", "combo"],
  ["Make", "make", "combo"],
  ["Model", "model", "combo"],
  ["Trim", "trim", "combo"],
  ["Mileage", "mileage", "text"],
  ["Price", "price", "text"],
  ["Body style", "body", "combo"],
  ["Exterior color", "exterior", "combo"],
  ["Interior color", "interior", "combo"],
  ["Fuel type", "fuel", "combo"],
  ["Transmission", "transmission", "combo"],
  ["VIN", "vin", "text"],
  ["Description", "description", "text"],
];

const ALIASES = {
  "Vehicle type": ["vehicle type"],
  Year: ["year"],
  "Exterior color": ["exterior color", "exterior colour"],
  "Interior color": ["interior color", "interior colour"],
  VIN: ["vin", "vehicle identification number"],
};

const COLOR_WORDS = [
  ["offwhite", "Off white"],
  ["off white", "Off white"],
  ["charcoal", "Charcoal"],
  ["burgundy", "Burgundy"],
  ["maroon", "Burgundy"],
  ["turquoise", "Turquoise"],
  ["teal", "Turquoise"],
  ["beige", "Beige"],
  ["silver", "Silver"],
  ["grey", "Gray"],
  ["gray", "Gray"],
  ["white", "White"],
  ["pearl", "White"],
  ["black", "Black"],
  ["blue", "Blue"],
  ["navy", "Blue"],
  ["red", "Red"],
  ["green", "Green"],
  ["brown", "Brown"],
  ["tan", "Tan"],
  ["gold", "Gold"],
  ["orange", "Orange"],
  ["yellow", "Yellow"],
  ["pink", "Pink"],
  ["purple", "Purple"],
];

const TYPE_OPTIONS = ["Car/Truck", "Car/truck", "Cars & trucks", "Cars and trucks", "Car"];

let packet = null;
let photosTried = false;
let stopped = false;
let running = false;

chrome.storage.local.get(["packet", "packetAt"], (stored) => {
  if (!stored.packet || !stored.packetAt) return;
  if (Date.now() - stored.packetAt > 2 * 60 * 60 * 1000) return;
  packet = stored.packet;
  start();
});

function start() {
  tick();
  const timer = window.setInterval(tick, 900);
  window.setTimeout(() => {
    stopped = true;
    window.clearInterval(timer);
  }, 45000);
}

async function tick() {
  if (!packet || stopped || running) return;
  running = true;
  try {
    await fillOnce();
  } finally {
    running = false;
  }
}

async function fillOnce() {
  if (!packet || stopped) return;
  if (document.querySelector('input[name="email"], input[type="password"]')) {
    overlay("Log into Facebook first. Then open Marketplace again from the extension. It never presses Publish.");
    return;
  }
  clickVehicleType();
  const filled = [];
  for (const [label, key, kind] of FIELDS) {
    const value = packet[key];
    if (!value) continue;
    const control = findControl(label);
    if (!control || control.dataset.cpp === "1") continue;
    if (document.activeElement === control) continue;
    const current = (control.value || "").trim();
    if (current && normalize(current) === normalize(String(value))) {
      control.dataset.cpp = "1";
      continue;
    }
    if (kind === "text") {
      const input = control.matches("input, textarea") ? control : control.querySelector("input, textarea");
      if (!input) continue;
      setNativeValue(input, digitsOnly(label) ? String(value).replace(/\D/g, "") : String(value));
      control.dataset.cpp = "1";
      filled.push(label);
    } else {
      const options = label === "Vehicle type" ? TYPE_OPTIONS : colorChoices(label, value);
      const ok = await chooseOption(control, options);
      closeMenu();
      const tries = Number(control.dataset.cppTries || "0") + 1;
      control.dataset.cppTries = String(tries);
      if (ok || tries >= 2) {
        control.dataset.cpp = "1";
        if (ok) filled.push(label);
      }
    }
  }
  if (!photosTried && Array.isArray(packet.imageUrls) && packet.imageUrls.length) {
    photosTried = true;
    void attachPhotos(packet.imageUrls);
  }
  const done = FIELDS.filter(([label, key]) => packet[key] && findControl(label)?.dataset.cpp === "1").map(([label]) => label);
  const waiting = FIELDS.filter(([label, key]) => packet[key] && !findControl(label)).map(([label]) => label);
  const name = packet.title || "This car";
  if (done.length) {
    overlay(
      `${name}: filled ${done.join(", ")}. ${
        waiting.length ? `Still waiting on ${waiting.slice(0, 4).join(", ")}. ` : ""
      }Check it, then you press Publish.`,
    );
  } else {
    overlay(`${name} is ready. Move through Facebook’s screens. This extension fills fields it can see and never presses Publish.`);
  }
  if (filled.length === 0 && done.length === 0) return;
}

function colorChoices(label, value) {
  if (label !== "Exterior color" && label !== "Interior color") return [String(value)];
  const folded = normalize(String(value));
  for (const [needle, name] of COLOR_WORDS) {
    if (folded.includes(normalize(needle))) return [name, "Other"];
  }
  return ["Other"];
}

function closeMenu() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function clickVehicleType() {
  if (document.documentElement.dataset.cppType === "1") return;
  const nodes = document.querySelectorAll('[role="button"], [role="radio"], label, [role="option"]');
  for (const node of nodes) {
    const text = (node.innerText || node.getAttribute("aria-label") || "").trim();
    if (text.length > 40) continue;
    if (/car/i.test(text) && /truck/i.test(text)) {
      node.click();
      document.documentElement.dataset.cppType = "1";
      return;
    }
  }
}

function findControl(label) {
  const wants = (ALIASES[label] || [label.toLowerCase()]).map((item) => item.toLowerCase());
  let best = null;
  let bestScore = 0;
  const controls = document.querySelectorAll("input, textarea, select, [role='combobox']");
  for (const el of controls) {
    if (el instanceof HTMLInputElement && /hidden|file|checkbox|radio|submit/i.test(el.type)) continue;
    const text = labelText(el).toLowerCase();
    if (!text || /search facebook|email|password/.test(text)) continue;
    for (const want of wants) {
      let score = 0;
      if (text === want) score = 5;
      else if (new RegExp(`(^|\\n|\\b)${escapeReg(want)}(\\b|$)`).test(text) && text.length < want.length + 36) score = 3;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
  }
  if (best) return best;
  const labels = document.querySelectorAll("label, span");
  for (const node of labels) {
    const own = [...node.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!wants.includes(own)) continue;
    const parent = node.parentElement;
    const next = node.nextElementSibling;
    const control =
      (next && next.matches("input, textarea, select, [role='combobox']") ? next : null) ||
      next?.querySelector?.("input, textarea, select, [role='combobox']") ||
      (parent && parent.childElementCount < 8 ? parent.querySelector("input, textarea, select, [role='combobox']") : null);
    if (control && control !== node) return control;
  }
  return null;
}

function labelText(input) {
  const bits = [input.getAttribute("aria-label") || "", input.getAttribute("placeholder") || ""];
  const labelledby = input.getAttribute("aria-labelledby");
  if (labelledby) {
    for (const id of labelledby.split(/\s+/)) {
      const node = document.getElementById(id);
      if (node) bits.push(node.innerText || "");
    }
  }
  const parent = input.closest("label");
  if (parent) bits.push(parent.innerText || "");
  return bits.join(" ").replace(/\s+/g, " ").trim();
}

function setNativeValue(el, value) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor && descriptor.set) descriptor.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function chooseOption(control, values) {
  for (const value of values) {
    control.focus();
    control.click();
    if (control instanceof HTMLSelectElement) {
      const match = [...control.options].find((option) => normalize(option.text) === normalize(value) || normalize(option.text).includes(normalize(value)));
      if (!match) continue;
      control.value = match.value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const input = control.matches("input, textarea") ? control : control.querySelector("input, textarea");
    if (input) setNativeValue(input, value);
    control.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await sleep(450);
    const want = normalize(value);
    const options = [...document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]')];
    const hit =
      options.find((option) => normalize(option.innerText || "") === want) ||
      options.find((option) => {
        const text = normalize(option.innerText || "");
        return text.includes(want) && text.length < want.length + 8;
      });
    if (!hit) continue;
    hit.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    hit.click();
    await sleep(80);
    return true;
  }
  return false;
}

function attachPhotos(urls) {
  chrome.runtime.sendMessage({ type: "FETCH_IMAGES", urls }, (response) => {
    const images = response && Array.isArray(response.images) ? response.images : [];
    if (!images.length) {
      overlay("Fields are filling. Photos didn’t transfer, so add them on Facebook if they’re missing.");
      return;
    }
    const input = [...document.querySelectorAll('input[type="file"]')].find((el) => {
      const accept = (el.getAttribute("accept") || "").toLowerCase();
      return !accept || accept.includes("image") || accept.includes("jpg") || accept.includes("*");
    });
    if (!input) return;
    const transfer = new DataTransfer();
    images.forEach((image, index) => {
      const bytes = fromBase64(image.b64);
      const type = image.type || "image/jpeg";
      const ext = type.includes("png") ? "png" : "jpg";
      transfer.items.add(new File([bytes], `photo-${index + 1}.${ext}`, { type }));
    });
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function overlay(text) {
  let box = document.getElementById("car-poster-overlay");
  if (!box) {
    box = document.createElement("div");
    box.id = "car-poster-overlay";
    box.style.cssText =
      "position:fixed;z-index:2147483647;left:16px;bottom:16px;max-width:340px;background:#121410;color:#f2efe6;border:1px solid #e4a54b;border-radius:16px;padding:12px 14px;font:14px/1.4 Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)";
    document.documentElement.appendChild(box);
  }
  box.textContent = text;
}

function digitsOnly(label) {
  return label === "Price" || label === "Mileage" || label === "Year";
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fromBase64(value) {
  const binary = atob(value || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
