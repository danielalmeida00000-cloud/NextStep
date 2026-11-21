const MARKET_URL = "https://www.facebook.com/marketplace/create/vehicle";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "HELLO") {
    const appUrl = typeof message.appUrl === "string" ? message.appUrl : "";
    chrome.storage.local.get(["pendingVehicles"], (cur) => {
      const patch = appUrl ? { appUrl } : {};
      chrome.storage.local.set(patch, () => {
        sendResponse({ vehicles: Array.isArray(cur.pendingVehicles) ? cur.pendingVehicles : [] });
      });
    });
    return true;
  }

  if (message.type === "CLEAR_PENDING") {
    chrome.storage.local.set({ pendingVehicles: [] }, () => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "IMPORT") {
    const incoming = Array.isArray(message.vehicles) ? message.vehicles : [];
    chrome.storage.local.get(["pendingVehicles", "appUrl"], (cur) => {
      const prev = Array.isArray(cur.pendingVehicles) ? cur.pendingVehicles : [];
      const seen = new Set(prev.map((car) => (car && car.vin ? String(car.vin) : "")).filter(Boolean));
      const merged = prev.slice();
      for (const car of incoming) {
        if (!car || !car.year || !car.make || !car.model) continue;
        if (car.vin && seen.has(String(car.vin))) continue;
        if (car.vin) seen.add(String(car.vin));
        merged.push(car);
      }
      chrome.storage.local.set({ pendingVehicles: merged.slice(0, 60) }, () => {
        focusApp(cur.appUrl).then((opened) => {
          sendResponse({ ok: true, opened, count: incoming.length });
        });
      });
    });
    return true;
  }

  if (message.type === "FILL") {
    chrome.storage.local.set({ packet: message.packet, packetAt: Date.now() }, () => {
      chrome.tabs.create({ url: MARKET_URL }, () => sendResponse({ ok: true }));
    });
    return true;
  }

  if (message.type === "OPEN_MARKET") {
    chrome.tabs.create({ url: MARKET_URL }, () => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "FETCH_IMAGES") {
    const urls = Array.isArray(message.urls) ? message.urls.slice(0, 6) : [];
    Promise.all(urls.map(fetchImage)).then((images) => {
      sendResponse({ images: images.filter(Boolean) });
    });
    return true;
  }
});

async function focusApp(appUrl) {
  if (!appUrl) return false;
  const tabs = await chrome.tabs.query({});
  const base = appUrl.split("#")[0];
  const found = tabs.find((tab) => tab.url && tab.url.split("#")[0] === base);
  if (found && found.id) {
    await chrome.tabs.update(found.id, { active: true });
    if (found.windowId) await chrome.windows.update(found.windowId, { focused: true });
    chrome.tabs.sendMessage(found.id, { type: "DELIVER" });
    return true;
  }
  await chrome.tabs.create({ url: appUrl });
  return true;
}

async function fetchImage(url) {
  try {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!type.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 2000 || buffer.byteLength > 4_000_000) return null;
    return { type, b64: toBase64(buffer) };
  } catch {
    return null;
  }
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}
