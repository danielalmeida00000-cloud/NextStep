const status = document.getElementById("status");
const pull = document.getElementById("pull");
const market = document.getElementById("market");
const desk = document.getElementById("desk");

async function connectOpenDesk() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url || /^(chrome|edge|about|chrome-extension|devtools):/.test(tab.url)) continue;
    try {
      const hits = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => (document.documentElement.dataset.app === "car-poster-pro" ? location.href : ""),
      });
      const url = (hits || []).map((hit) => hit && hit.result).find((value) => typeof value === "string" && value);
      if (url) {
        await chrome.storage.local.set({ appUrl: url });
        return url;
      }
    } catch {
      /* tab cannot be read */
    }
  }
  return "";
}

async function paint() {
  const found = await connectOpenDesk();
  const cur = await chrome.storage.local.get(["appUrl", "packet", "pendingVehicles"]);
  const waiting = Array.isArray(cur.pendingVehicles) ? cur.pendingVehicles.length : 0;
  const title = cur.packet && cur.packet.title ? cur.packet.title : "";
  const bits = [];
  bits.push(
    found || cur.appUrl
      ? "Desk connected."
      : "Open the NextStep desk in its own Chrome tab, then click this extension again.",
  );
  if (waiting) bits.push(`${waiting} pulled car${waiting === 1 ? "" : "s"} waiting to land on the lot.`);
  if (title) bits.push(`Ready to fill: ${title}.`);
  status.textContent = bits.join(" ");
}

paint();

pull.addEventListener("click", async () => {
  pull.disabled = true;
  status.textContent = "Reading this tab…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
    status.textContent = "Open the dealer’s inventory page in this tab, then pull it.";
    pull.disabled = false;
    return;
  }
  try {
    const [hit] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML.slice(0, 1500000),
    });
    const html = (hit && hit.result) || "";
    const vehicles = globalThis.CarPosterScrape.parseDealerHtml(html, tab.url);
    if (!vehicles.length) {
      status.textContent = "No vehicles in this page. Scroll the inventory so the cars are on screen, then pull again.";
      pull.disabled = false;
      return;
    }
    chrome.runtime.sendMessage({ type: "IMPORT", vehicles }, (response) => {
      pull.disabled = false;
      status.textContent =
        response && response.opened
          ? `Sent ${vehicles.length} to the desk.`
          : `Saved ${vehicles.length}. Open the NextStep Automotive Solutions desk and they’ll land on the lot.`;
    });
  } catch {
    status.textContent = "Couldn’t read this tab. Dealer sites work. Chrome’s own pages don’t.";
    pull.disabled = false;
  }
});

market.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_MARKET" });
});

desk.addEventListener("click", () => {
  chrome.storage.local.get(["appUrl"], (cur) => {
    if (!cur.appUrl) {
      status.textContent = "The desk isn’t connected yet. Open NextStep Automotive Solutions in a tab first.";
      return;
    }
    chrome.tabs.create({ url: cur.appUrl });
  });
});
