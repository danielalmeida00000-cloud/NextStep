const SOURCE_PAGE = "car-poster-page";
const SOURCE_EXT = "car-poster-ext";

document.documentElement.dataset.carPosterExt = "1";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== SOURCE_PAGE) return;

  if (data.type === "PING") {
    window.postMessage({ source: SOURCE_EXT, type: "PONG" }, "*");
    return;
  }

  if (document.documentElement.dataset.app !== "car-poster-pro") return;

  if (data.type === "HELLO") {
    chrome.runtime.sendMessage({ type: "HELLO", appUrl: location.href }, (response) => {
      const vehicles = response && Array.isArray(response.vehicles) ? response.vehicles : [];
      if (vehicles.length) {
        window.postMessage({ source: SOURCE_EXT, type: "IMPORT", vehicles }, "*");
      }
      window.postMessage({ source: SOURCE_EXT, type: "PONG" }, "*");
    });
  }

  if (data.type === "FILL" && data.packet) {
    chrome.runtime.sendMessage({ type: "FILL", packet: data.packet }, () => {
      window.postMessage({ source: SOURCE_EXT, type: "ACK" }, "*");
    });
  }

  if (data.type === "IMPORTED") {
    chrome.runtime.sendMessage({ type: "CLEAR_PENDING" });
  }
});

function announceDesk() {
  if (document.documentElement.dataset.app !== "car-poster-pro") return;
  chrome.runtime.sendMessage({ type: "HELLO", appUrl: location.href }, (response) => {
    const vehicles = response && Array.isArray(response.vehicles) ? response.vehicles : [];
    if (vehicles.length) {
      window.postMessage({ source: SOURCE_EXT, type: "IMPORT", vehicles }, "*");
    }
  });
}

const deskWatch = new MutationObserver(announceDesk);
deskWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-app"] });
announceDesk();
setInterval(announceDesk, 2000);

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "DELIVER") return;
  if (document.documentElement.dataset.app !== "car-poster-pro") return;
  chrome.runtime.sendMessage({ type: "HELLO", appUrl: location.href }, (response) => {
    const vehicles = response && Array.isArray(response.vehicles) ? response.vehicles : [];
    if (vehicles.length) window.postMessage({ source: SOURCE_EXT, type: "IMPORT", vehicles }, "*");
  });
});

function maybePill() {
  if (window.top !== window) return;
  if (document.documentElement.dataset.app === "car-poster-pro") return;
  if (document.getElementById("car-poster-pill")) return;
  const host = location.hostname;
  if (/facebook\.com$/i.test(host) || host.endsWith(".facebook.com")) return;
  const text = document.body ? document.body.innerText.slice(0, 20000) : "";
  const vehicleish =
    /\b(?:19[9]\d|20[0-2]\d)\s+[A-Z][A-Za-z-]+\s+[A-Za-z0-9]/.test(text) ||
    /\b[A-HJ-NPR-Z0-9]{17}\b/.test(text);
  if (!vehicleish) return;

  const root = document.createElement("div");
  root.id = "car-poster-pill";
  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      button {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483646;
        border: 0;
        border-radius: 999px;
        background: #e4a54b;
        color: #1a1408;
        font: 600 14px/1.2 "Segoe UI", sans-serif;
        padding: 12px 16px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,.28);
      }
      button:disabled { opacity: .7; cursor: wait; }
    </style>
    <button type="button">Send to NextStep Automotive Solutions</button>
  `;
  const button = shadow.querySelector("button");
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Reading this page…";
    let vehicles = [];
    try {
      vehicles = globalThis.CarPosterScrape.parseDealerHtml(document.documentElement.outerHTML, location.href);
    } catch {
      vehicles = [];
    }
    if (!vehicles.length) {
      button.disabled = false;
      button.textContent = "No cars yet. Scroll the lot, then try again.";
      return;
    }
    chrome.runtime.sendMessage({ type: "IMPORT", vehicles }, (response) => {
      const count = vehicles.length;
      button.disabled = false;
      button.textContent =
        response && response.opened
          ? `Sent ${count} to the desk`
          : `Saved ${count}. Open the NextStep Automotive Solutions desk once.`;
    });
  });
  document.documentElement.appendChild(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(maybePill, 600), { once: true });
} else {
  setTimeout(maybePill, 600);
}
