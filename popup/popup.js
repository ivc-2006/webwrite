const statusLabel = document.getElementById("status-label");
const toggleBtn = document.getElementById("toggle-btn");
const errorEl = document.getElementById("error");

function setUi(enabled) {
  statusLabel.textContent = enabled ? "Drawing on" : "Drawing off";
  statusLabel.classList.toggle("on", enabled);
  toggleBtn.textContent = enabled ? "Turn off" : "Turn on";
  toggleBtn.classList.toggle("active", enabled);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshState() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    showError("No active tab.");
    return;
  }
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    showError("Cannot draw on browser internal pages.");
    setUi(false);
    toggleBtn.disabled = true;
    return;
  }

  const res = await chrome.runtime.sendMessage({
    type: "WEBWRITE_GET_STATE",
    tabId: tab.id,
  });
  setUi(Boolean(res?.enabled));
}

toggleBtn.addEventListener("click", async () => {
  errorEl.classList.add("hidden");
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const res = await chrome.runtime.sendMessage({
    type: "WEBWRITE_TOGGLE",
    tabId: tab.id,
  });

  if (!res?.ok) {
    showError("Could not enable on this page. Try refreshing the tab.");
    return;
  }

  await refreshState();
});

refreshState();
