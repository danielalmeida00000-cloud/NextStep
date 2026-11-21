// More robust Marketplace filler with better React support

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fillReactInput(el, value) {
  if (!el || !value) return false;
  const text = String(value);

  el.focus();
  el.click();
  await sleep(100);

  // Method 1: native value setter (best for React)
  const proto = el.tagName === "TEXTAREA"
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

  if (setter) {
    setter.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(50);

    // Type slowly
    for (let i = 0; i < text.length; i++) {
      setter.call(el, text.slice(0, i + 1));
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text[i], inputType: "insertText" }));
      await sleep(20);
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    return true;
  }

  // Method 2: execCommand fallback
  try {
    el.value = "";
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch (e) {}

  return false;
}

function locateField(keywords) {
  // Direct attribute match
  for (const el of document.querySelectorAll("input, textarea")) {
    const attrs = (
      (el.placeholder || "") +
      (el.getAttribute("aria-label") || "") +
      (el.getAttribute("aria-placeholder") || "") +
      (el.name || "")
    ).toLowerCase();
    if (keywords.some(k => attrs.includes(k))) return el;
  }

  // Label / nearby text match
  for (const node of document.querySelectorAll("label, span, div, p")) {
    const text = (node.innerText || "").toLowerCase().trim();
    if (keywords.some(k => text === k || text.includes(k))) {
      let input = node.querySelector("input, textarea");
      if (!input && node.parentElement) input = node.parentElement.querySelector("input, textarea");
      if (!input && node.nextElementSibling) {
        input = node.nextElementSibling.querySelector?.("input, textarea") || 
                (node.nextElementSibling.tagName === "INPUT" || node.nextElementSibling.tagName === "TEXTAREA" ? node.nextElementSibling : null);
      }
      if (input) return input;
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fillForm" && request.action !== "loadDemo") return;

  (async () => {
    const data = request.data || {
      title: "2022 Toyota RAV4",
      price: "28995",
      mileage: "22150",
      description: "Clean vehicle. Financing available. Message for details.",
      vin: ""
    };

    let year = "", make = "", model = "";
    if (data.title) {
      const m = String(data.title).match(/\b(19|20)\d{2}\b/);
      if (m) year = m[0];
      const parts = String(data.title).replace(year, "").trim().split(/\s+/);
      make = parts[0] || "";
      model = parts.slice(1).join(" ") || "";
    }

    const map = [
      { name: "Year", keys: ["year"], val: year },
      { name: "Make", keys: ["make"], val: make },
      { name: "Model", keys: ["model"], val: model },
      { name: "Price", keys: ["price"], val: data.price },
      { name: "Mileage", keys: ["mileage", "miles"], val: data.mileage },
      { name: "Description", keys: ["description"], val: data.description },
      { name: "VIN", keys: ["vin"], val: data.vin }
    ];

    let count = 0;
    const filled = [];

    for (const item of map) {
      if (!item.val) continue;
      const el = locateField(item.keys);
      if (el && await fillReactInput(el, item.val)) {
        count++;
        filled.push(item.name);
      }
      await sleep(120);
    }

    alert(count
      ? `Filled ${count} fields: ${filled.join(", ")}\n\nReview and upload photos, then publish.`
      : "No fields found. Open the Vehicle listing form and try again.");

    sendResponse({ filled: count, results: filled });
  })();

  return true;
});
