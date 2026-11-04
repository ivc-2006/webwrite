const STORAGE_KEY = "webwriteEnabledByTab";

async function setTabEnabled(tabId, enabled) {
  const data = await chrome.storage.session.get(STORAGE_KEY);
  const map = data[STORAGE_KEY] ?? {};
  map[String(tabId)] = enabled;
  await chrome.storage.session.set({ [STORAGE_KEY]: map });
}

async function getTabEnabled(tabId) {
  const data = await chrome.storage.session.get(STORAGE_KEY);
  const map = data[STORAGE_KEY] ?? {};
  return Boolean(map[String(tabId)]);
}

async function sendToggle(tabId, enabled) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "WEBWRITE_SET_ENABLED", enabled });
    return true;
  } catch {
    return false;
  }
}

async function ensureContentAndToggle(tabId, enabled) {
  await setTabEnabled(tabId, enabled);
  let ok = await sendToggle(tabId, enabled);
  if (!ok) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "lib/katex.min.js",
          "lib/jspdf.umd.min.js",
          "content/stroke-engine.js",
          "content/background-layer.js",
          "content/theme.js",
          "content/text-tool.js",
          "content/ink-ocr.js",
          "content/recorder.js",
          "content/export.js",
          "content/content.js",
        ],
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content/content.css"],
      });
      ok = await sendToggle(tabId, enabled);
    } catch {
      ok = false;
    }
  }
  return ok;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "WEBWRITE_GET_STATE") {
    const tabId = message.tabId ?? sender.tab?.id;
    if (tabId == null) {
      sendResponse({ enabled: false });
      return false;
    }
    getTabEnabled(tabId).then((enabled) => sendResponse({ enabled }));
    return true;
  }

  if (message.type === "WEBWRITE_TOGGLE") {
    const tabId = message.tabId;
    if (tabId == null) {
      sendResponse({ ok: false });
      return false;
    }
    getTabEnabled(tabId)
      .then((current) => ensureContentAndToggle(tabId, !current))
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "WEBWRITE_SYNC") {
    const tabId = sender.tab?.id ?? message.tabId;
    if (tabId == null) {
      sendResponse({ ok: false });
      return false;
    }
    setTabEnabled(tabId, Boolean(message.enabled))
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "WEBWRITE_SET") {
    const tabId = message.tabId ?? sender.tab?.id;
    if (tabId == null) {
      sendResponse({ ok: false });
      return false;
    }
    ensureContentAndToggle(tabId, Boolean(message.enabled))
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "WEBWRITE_CAPTURE_VISIBLE") {
    const windowId = sender.tab?.windowId;
    if (windowId == null) {
      sendResponse({ ok: false, error: "No active window" });
      return false;
    }
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      const err = chrome.runtime.lastError;
      sendResponse({
        ok: Boolean(dataUrl) && !err,
        dataUrl: dataUrl || null,
        error: err?.message,
      });
    });
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-drawing") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const enabled = await getTabEnabled(tab.id);
  await ensureContentAndToggle(tab.id, !enabled);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.session.get(STORAGE_KEY);
  const map = data[STORAGE_KEY] ?? {};
  delete map[String(tabId)];
  await chrome.storage.session.set({ [STORAGE_KEY]: map });
});
