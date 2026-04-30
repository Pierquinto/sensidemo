const activeTabs = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "GET_TAB_STATE") {
    sendResponse({ enabled: activeTabs.get(message.tabId) === true });
    return false;
  }

  if (message.type === "SET_TAB_STATE") {
    activeTabs.set(message.tabId, Boolean(message.enabled));
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "CONTENT_STATE_CHANGED" && sender.tab?.id) {
    activeTabs.set(sender.tab.id, Boolean(message.enabled));
    return false;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    activeTabs.delete(tabId);
  }
});
