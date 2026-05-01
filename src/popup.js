const STORAGE_KEY = "sensiDemoDomains";
const LEGACY_STORAGE_KEY = "privacyBlurDomains";
const DEFAULT_BLUR_AMOUNT = 8;

const domainEl = document.getElementById("domain");
const enabledToggle = document.getElementById("enabledToggle");
const selectButton = document.getElementById("selectButton");
const stopSelectButton = document.getElementById("stopSelectButton");
const clearButton = document.getElementById("clearButton");
const ruleList = document.getElementById("ruleList");
const statusEl = document.getElementById("status");

let currentTab = null;
let currentHostname = "";
let blurUpdateTimer = null;

init();

async function init() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentHostname = hostnameFromUrl(currentTab?.url);
  domainEl.textContent = currentHostname || "Unsupported page";

  if (!currentTab?.id || !currentHostname) {
    setDisabled(true);
    renderRules([]);
    return;
  }

  try {
    await ensureContentReady();
    await refreshState();
    await renderDomainRules();
  } catch (error) {
    showStatus(errorMessage(error), true);
    setDisabled(true);
    renderRules([]);
  }
}

function setDisabled(disabled) {
  enabledToggle.disabled = disabled;
  selectButton.disabled = disabled;
  stopSelectButton.disabled = disabled;
  clearButton.disabled = disabled;
}

async function ensureContentReady() {
  try {
    await chrome.tabs.sendMessage(currentTab.id, { type: "GET_CONTENT_STATE" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ["src/content.js"]
      });
      await chrome.scripting.insertCSS({
        target: { tabId: currentTab.id },
        files: ["src/content.css"]
      });
    } catch (error) {
      throw new Error(`SensiDemo cannot run on this page. Detail: ${error.message}`);
    }
  }
}

async function refreshState() {
  const state = await chrome.tabs.sendMessage(currentTab.id, { type: "GET_CONTENT_STATE" });
  enabledToggle.checked = Boolean(state.enabled);
}

async function renderDomainRules() {
  const domains = await getStoredDomains();
  const rules = domains[currentHostname]?.rules || [];
  renderRules(rules);
}

function renderRules(rules) {
  ruleList.textContent = "";

  if (!rules.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No rules saved for this domain.";
    ruleList.append(empty);
    return;
  }

  for (const rule of rules) {
    const item = document.createElement("article");
    item.className = "rule";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = rule.enabled !== false;
    checkbox.title = "Enable rule";
    checkbox.addEventListener("change", async () => {
      await updateRule(rule.id, { enabled: checkbox.checked });
    });

    const body = document.createElement("div");
    const kind = document.createElement("div");
    kind.className = "rule__kind";
    kind.textContent = rule.mode === "recursive" ? "List/Grid" : "Single";

    const name = document.createElement("div");
    name.className = "rule__name";
    name.textContent = rule.label || "Sensitive element";

    const meta = document.createElement("div");
    meta.className = "rule__meta";
    meta.textContent = describeRule(rule);

    const blurControl = document.createElement("label");
    blurControl.className = "rule__blur";

    const blurText = document.createElement("span");
    const currentBlur = normalizeBlurAmount(rule.blurAmount);
    blurText.textContent = `Blur ${currentBlur}/10`;

    const blurRange = document.createElement("input");
    blurRange.type = "range";
    blurRange.min = "1";
    blurRange.max = "10";
    blurRange.step = "1";
    blurRange.value = String(currentBlur);
    blurRange.addEventListener("input", () => {
      blurText.textContent = `Blur ${blurRange.value}/10`;
      scheduleBlurUpdate(rule.id, blurRange.value);
    });
    blurRange.addEventListener("change", async () => {
      await updateRule(rule.id, { blurAmount: normalizeBlurAmount(blurRange.value) }, { clearExisting: false });
      showStatus(`Blur updated to ${blurRange.value}/10.`);
    });

    blurControl.append(blurText, blurRange);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "x";
    removeButton.title = "Remove rule";
    removeButton.addEventListener("click", async () => {
      await removeRule(rule.id);
    });

    body.append(kind, name, meta, blurControl);
    item.append(checkbox, body, removeButton);
    ruleList.append(item);
  }
}

function describeRule(rule) {
  if (rule.mode === "recursive") {
    const targetCount = rule.targetSelectors?.length || 0;
    return `${targetCount} target${targetCount === 1 ? "" : "s"} in ${rule.itemSelector || "item"} inside ${rule.containerSelector || "container"}`;
  }

  return rule.selector || "Selector unavailable";
}

function normalizeBlurAmount(amount) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_BLUR_AMOUNT;
  }
  return Math.min(10, Math.max(1, parsed));
}

async function updateRule(ruleId, patch, options = {}) {
  const { domains, rules } = await getCurrentRules();
  domains[currentHostname].rules = rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule);
  await chrome.storage.local.set({ [STORAGE_KEY]: domains });
  await refreshRulesInTab(options);
  await renderDomainRules();
}

function scheduleBlurUpdate(ruleId, value) {
  window.clearTimeout(blurUpdateTimer);
  blurUpdateTimer = window.setTimeout(async () => {
    await updateRule(ruleId, { blurAmount: normalizeBlurAmount(value) }, { clearExisting: false });
  }, 120);
}

async function removeRule(ruleId) {
  const { domains, rules } = await getCurrentRules();
  domains[currentHostname].rules = rules.filter((rule) => rule.id !== ruleId);
  await chrome.storage.local.set({ [STORAGE_KEY]: domains });
  await refreshRulesInTab();
  await renderDomainRules();
}

async function getCurrentRules() {
  const domains = await getStoredDomains();
  domains[currentHostname] ||= { rules: [] };
  return { domains, rules: domains[currentHostname].rules || [] };
}

async function getStoredDomains() {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const domains = result[STORAGE_KEY] || result[LEGACY_STORAGE_KEY] || {};

  if (!result[STORAGE_KEY] && result[LEGACY_STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: result[LEGACY_STORAGE_KEY] });
  }

  return domains;
}

async function refreshRulesInTab(options = {}) {
  if (currentTab?.id) {
    await chrome.tabs.sendMessage(currentTab.id, {
      type: "REFRESH_RULES",
      clearExisting: options.clearExisting !== false
    }).catch(() => {});
  }
}

enabledToggle.addEventListener("change", async () => {
  if (!currentTab?.id) return;

  const enabled = enabledToggle.checked;
  try {
    await chrome.runtime.sendMessage({ type: "SET_TAB_STATE", tabId: currentTab.id, enabled });
    await chrome.tabs.sendMessage(currentTab.id, { type: "SET_ENABLED", enabled });
    showStatus(enabled ? "Blur is active in this tab." : "Blur is off in this tab.");
  } catch (error) {
    enabledToggle.checked = !enabled;
    showStatus(errorMessage(error), true);
  }
});

selectButton.addEventListener("click", async () => {
  if (!currentTab?.id) return;

  try {
    enabledToggle.checked = true;
    await chrome.runtime.sendMessage({ type: "SET_TAB_STATE", tabId: currentTab.id, enabled: true });
    await chrome.tabs.sendMessage(currentTab.id, { type: "START_SELECTING" });
    showStatus("Selection mode is active: click sensitive data on the page. Choose 'Whole list' when available.");
  } catch (error) {
    showStatus(errorMessage(error), true);
  }
});

stopSelectButton.addEventListener("click", async () => {
  if (!currentTab?.id) return;
  try {
    await chrome.tabs.sendMessage(currentTab.id, { type: "STOP_SELECTING" });
    showStatus("Selection mode stopped.");
  } catch (error) {
    showStatus(errorMessage(error), true);
  }
});

clearButton.addEventListener("click", async () => {
  const { domains } = await getCurrentRules();
  domains[currentHostname].rules = [];
  await chrome.storage.local.set({ [STORAGE_KEY]: domains });
  await refreshRulesInTab();
  await renderDomainRules();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RULES_CHANGED" && message.hostname === currentHostname) {
    renderDomainRules();
  }
});

function hostnameFromUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (!["http:", "https:", "file:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.hostname || "local-file";
  } catch {
    return "";
  }
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", isError);
  statusEl.classList.add("is-visible");
}

function errorMessage(error) {
  const message = error?.message || String(error);
  if (message.includes("Cannot access") || message.includes("chrome://")) {
    return "Chrome does not allow extensions on this page. Try an http/https website.";
  }
  if (message.includes("file://")) {
    return "To use the local demo, enable 'Allow access to file URLs' in the extension details, or try an http/https website.";
  }
  return message;
}
