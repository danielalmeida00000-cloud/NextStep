document.getElementById("fillBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes("facebook.com")) {
    alert("Open the Facebook Marketplace Create Listing → Vehicle page first.");
    return;
  }

  const raw = document.getElementById("dataBox").value.trim();
  let data = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (e) {
      alert("Could not read the pasted data. Make sure you copied the full JSON from the app.");
      return;
    }
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "fillForm", data: data });
    if (response && response.filled > 0) {
      alert(`Filled ${response.filled} field(s): ${response.results.join(", ")}`);
    } else {
      alert("Message sent but no fields were filled.\n\nMake sure the vehicle form is fully loaded, then try again.");
    }
  } catch (err) {
    alert("Could not talk to the page.\n\n1. Refresh the Facebook page\n2. Make sure you are on the Create Listing → Vehicle form\n3. Reload the extension at chrome://extensions\n\nError: " + err.message);
  }
});

document.getElementById("demoBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes("facebook.com")) {
    alert("Open the Facebook Marketplace Create Listing → Vehicle page first.");
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "loadDemo" });
  } catch (err) {
    alert("Could not reach the page. Refresh Facebook and try again.\n\n" + err.message);
  }
});
