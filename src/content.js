const STORAGE_KEY = "sensiDemoDomains";
const LEGACY_STORAGE_KEY = "privacyBlurDomains";
const BLUR_CLASS = "pb-blurred";
const HOVER_CLASS = "pb-hover-target";
const SELECTING_CLASS = "pb-selecting";
const MAX_SELECTOR_DEPTH = 5;
const DEFAULT_BLUR_AMOUNT = 8;

let tabEnabled = false;
let selecting = false;
let hoveredElement = null;
let choicePopover = null;
let observer = null;
let observerTimer = null;
let activeRules = [];

function getHostname() {
  return window.location.hostname || "local-file";
}

function getDomainKey() {
  return getHostname().toLowerCase();
}

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(payload) {
  return chrome.storage.local.set(payload);
}

async function getDomainConfig() {
  const result = await storageGet([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const allDomains = result[STORAGE_KEY] || result[LEGACY_STORAGE_KEY] || {};

  if (!result[STORAGE_KEY] && result[LEGACY_STORAGE_KEY]) {
    await storageSet({ [STORAGE_KEY]: result[LEGACY_STORAGE_KEY] });
  }

  return {
    allDomains,
    config: allDomains[getDomainKey()] || { rules: [] }
  };
}

async function saveRule(rule) {
  const { allDomains, config } = await getDomainConfig();
  const rules = Array.isArray(config.rules) ? config.rules : [];
  const nextRules = mergeRule(rules, rule);
  allDomains[getDomainKey()] = { ...config, rules: nextRules };
  await storageSet({ [STORAGE_KEY]: allDomains });
  notifyPopupChanged();
}

function mergeRule(rules, rule) {
  if (rule.mode === "recursive") {
    const existing = rules.find((item) => {
      return item.mode === "recursive"
        && item.containerSelector === rule.containerSelector
        && item.itemSelector === rule.itemSelector;
    });

    if (existing) {
      const targetSelectors = new Set([...(existing.targetSelectors || []), ...(rule.targetSelectors || [])]);
      return rules.map((item) => item.id === existing.id
        ? { ...existing, enabled: true, targetSelectors: [...targetSelectors] }
        : item
      );
    }
  }

  const duplicate = rules.some((item) => {
    if (item.mode !== rule.mode) return false;
    if (item.mode === "single") return item.selector === rule.selector;
    return item.containerSelector === rule.containerSelector
      && item.itemSelector === rule.itemSelector
      && JSON.stringify(item.targetSelectors || []) === JSON.stringify(rule.targetSelectors || []);
  });

  return duplicate ? rules : [...rules, rule];
}

function notifyPopupChanged() {
  chrome.runtime.sendMessage({ type: "RULES_CHANGED", hostname: getDomainKey() }).catch(() => {});
}

async function refreshRules(options = {}) {
  if (!tabEnabled) {
    activeRules = [];
    return;
  }

  const { config } = await getDomainConfig();
  activeRules = (config.rules || []).filter((rule) => rule.enabled !== false);
  applyRules(options);
}

function applyRules(options = {}) {
  if (options.clearExisting) {
    clearBlur();
  }

  if (!tabEnabled) {
    return;
  }

  for (const rule of activeRules) {
    if (rule.mode === "single") {
      applySingleRule(rule);
    } else if (rule.mode === "recursive") {
      applyRecursiveRule(rule);
    }
  }
}

function applySingleRule(rule) {
  for (const element of queryAllSafe(document, rule.selector)) {
    blurElement(element, rule.blurAmount);
  }
}

function applyRecursiveRule(rule) {
  for (const container of queryAllSafe(document, rule.containerSelector)) {
    for (const item of queryAllSafe(container, rule.itemSelector)) {
      for (const targetSelector of rule.targetSelectors || []) {
        for (const target of queryAllSafe(item, targetSelector)) {
          blurElement(target, rule.blurAmount);
        }
      }
    }
  }
}

function queryAllSafe(root, selector) {
  if (!selector || !root?.querySelectorAll) {
    return [];
  }

  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

function blurElement(element, blurAmount = DEFAULT_BLUR_AMOUNT) {
  if (!element || element === document.documentElement || element === document.body) {
    return;
  }

  const blurPixels = blurAmountToPixels(blurAmount);
  element.style.setProperty("--pb-blur-radius", `${blurPixels}px`);
  element.style.setProperty("filter", `blur(${blurPixels}px)`, "important");
  element.classList.add(BLUR_CLASS);
}

function clearBlur() {
  for (const element of document.querySelectorAll(`.${BLUR_CLASS}`)) {
    element.classList.remove(BLUR_CLASS);
    element.style.removeProperty("--pb-blur-radius");
    element.style.removeProperty("filter");
  }
}

function startObserver() {
  if (observer) {
    return;
  }

  observer = new MutationObserver(() => {
    if (!tabEnabled) {
      return;
    }

    window.clearTimeout(observerTimer);
    observerTimer = window.setTimeout(() => {
      applyRules();
    }, 0);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  window.clearTimeout(observerTimer);
}

function setEnabled(enabled) {
  tabEnabled = Boolean(enabled);

  if (tabEnabled) {
    startObserver();
    refreshRules({ clearExisting: true });
  } else {
    activeRules = [];
    stopObserver();
    stopSelecting();
    clearBlur();
  }

  chrome.runtime.sendMessage({ type: "CONTENT_STATE_CHANGED", enabled: tabEnabled }).catch(() => {});
}

function startSelecting() {
  if (selecting) {
    return;
  }

  selecting = true;
  document.documentElement.classList.add(SELECTING_CLASS);
  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("mouseout", handleMouseOut, true);
  document.addEventListener("click", handlePickClick, true);
  document.addEventListener("keydown", handleKeyDown, true);
  showToast("SensiDemo: click a sensitive element. Press Esc to exit.");
}

function stopSelecting() {
  selecting = false;
  document.documentElement.classList.remove(SELECTING_CLASS);
  document.removeEventListener("mouseover", handleMouseOver, true);
  document.removeEventListener("mouseout", handleMouseOut, true);
  document.removeEventListener("click", handlePickClick, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  clearHoveredElement();
  removeChoicePopover();
}

function handleMouseOver(event) {
  if (!selecting || isPrivacyBlurUi(event.target)) {
    return;
  }

  clearHoveredElement();
  hoveredElement = event.target;
  hoveredElement.classList.add(HOVER_CLASS);
}

function handleMouseOut(event) {
  if (event.target === hoveredElement) {
    clearHoveredElement();
  }
}

function handleKeyDown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    stopSelecting();
    showToast("Selection mode stopped.");
  }
}

function handlePickClick(event) {
  if (!selecting || isPrivacyBlurUi(event.target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  showChoicePopover(event.target, event.clientX, event.clientY);
}

function clearHoveredElement() {
  if (hoveredElement) {
    hoveredElement.classList.remove(HOVER_CLASS);
    hoveredElement = null;
  }
}

function isPrivacyBlurUi(element) {
  return element?.closest?.(".pb-choice, .pb-toast");
}

function showChoicePopover(target, x, y) {
  removeChoicePopover();

  const recursiveCandidate = getRecursiveCandidate(target);
  choicePopover = document.createElement("div");
  choicePopover.className = "pb-choice";
  choicePopover.dataset.clickX = String(x);
  choicePopover.dataset.clickY = String(y);

  const title = document.createElement("p");
  title.className = "pb-choice__title";
  title.textContent = "Selected element";

  const targetLabel = document.createElement("span");
  targetLabel.className = "pb-choice__target";
  targetLabel.textContent = labelForElement(target);
  title.append(targetLabel);

  const actions = document.createElement("div");
  actions.className = "pb-choice__actions";

  const singleButton = document.createElement("button");
  singleButton.type = "button";
  singleButton.textContent = "This type only";
  singleButton.addEventListener("click", () => {
    saveSingleSelection(target);
  });

  actions.append(singleButton);

  if (recursiveCandidate) {
    const recursiveButton = document.createElement("button");
    recursiveButton.type = "button";
    recursiveButton.dataset.kind = "recursive";
    recursiveButton.textContent = "Whole list";
    recursiveButton.addEventListener("click", () => {
      saveRecursiveSelection(target, recursiveCandidate);
    });
    actions.append(recursiveButton);
  }

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    removeChoicePopover();
  });
  actions.append(cancelButton);

  choicePopover.append(title, actions);
  document.documentElement.append(choicePopover);
  clearHoveredElement();
}

function removeChoicePopover() {
  choicePopover?.remove();
  choicePopover = null;
}

async function saveSingleSelection(target) {
  const selector = buildSelector(target);
  if (!selector) {
    showToast("Could not create a stable selector for this element.");
    return;
  }

  await saveRule({
    id: createId(),
    label: labelForElement(target),
    mode: "single",
    enabled: true,
    blurAmount: DEFAULT_BLUR_AMOUNT,
    selector
  });

  stopSelecting();
  setEnabled(true);
  showToast("Single rule saved and blur enabled for this tab.");
}

async function saveRecursiveSelection(target, candidate) {
  const targetSelector = buildRelativeSelector(target, candidate.item);
  if (!targetSelector) {
    showToast("Could not create a relative selector for this list.");
    return;
  }

  await saveRule({
    id: createId(),
    label: `${labelForElement(target)} in list`,
    mode: "recursive",
    enabled: true,
    blurAmount: DEFAULT_BLUR_AMOUNT,
    containerSelector: buildSelector(candidate.container),
    itemSelector: buildRelativeSelector(candidate.item, candidate.container),
    targetSelectors: [targetSelector]
  });

  stopSelecting();
  setEnabled(true);
  showToast("List/grid rule saved and blur enabled for this tab.");
}

function getRecursiveCandidate(target) {
  let item = target.closest("[data-pb-item]");

  if (!item) {
    item = findRepeatedAncestor(target);
  }

  if (!item) {
    return null;
  }

  const container = findContainerForItem(item);
  if (!container) {
    return null;
  }

  const containerSelector = buildSelector(container);
  const itemSelector = buildRelativeSelector(item, container);

  if (!containerSelector || !itemSelector) {
    return null;
  }

  return { container, item, containerSelector, itemSelector };
}

function findRepeatedAncestor(target) {
  let current = target.parentElement;
  let depth = 0;

  while (current && current !== document.body && depth < 8) {
    const parent = current.parentElement;
    if (parent) {
      const selector = simpleElementSelector(current);
      if (selector) {
        const siblings = queryAllSafe(parent, `:scope > ${selector}`);
        if (siblings.length >= 2) {
          return current;
        }
      }
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function findContainerForItem(item) {
  let current = item.parentElement;
  let depth = 0;

  while (current && current !== document.body && depth < 5) {
    const itemSelector = buildRelativeSelector(item, current);
    if (itemSelector && queryAllSafe(current, itemSelector).length >= 2) {
      return current;
    }

    current = current.parentElement;
    depth += 1;
  }

  return item.parentElement;
}

function buildSelector(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const stableSelector = stableAttributeSelector(element);
  if (stableSelector && document.querySelectorAll(stableSelector).length === 1) {
    return stableSelector;
  }

  const parts = [];
  let current = element;
  let depth = 0;

  while (current && current !== document.body && depth < MAX_SELECTOR_DEPTH) {
    parts.unshift(simpleElementSelector(current));
    const selector = parts.join(" > ");

    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }

    current = current.parentElement;
    depth += 1;
  }

  return parts.join(" > ");
}

function buildRelativeSelector(element, root) {
  if (!element || !root || element === root || !root.contains(element)) {
    return "";
  }

  const stableSelector = stableAttributeSelector(element, {
    allowId: false,
    allowTextAttributes: false
  });
  if (stableSelector) {
    const matches = queryAllSafe(root, stableSelector);
    if (matches.includes(element)) {
      return stableSelector;
    }
  }

  const parts = [];
  let current = element;
  let depth = 0;

  while (current && current !== root && depth < MAX_SELECTOR_DEPTH) {
    parts.unshift(simpleElementSelector(current, {
      allowId: false,
      allowTextAttributes: false
    }));
    const selector = parts.join(" > ");
    const matches = queryAllSafe(root, selector);

    if (matches.length === 1 && matches[0] === element) {
      return selector;
    }

    current = current.parentElement;
    depth += 1;
  }

  return parts.join(" > ");
}

function simpleElementSelector(element, options = {}) {
  const stableSelector = stableAttributeSelector(element, options);
  if (stableSelector) {
    return stableSelector;
  }

  const tag = element.tagName.toLowerCase();
  const usefulClasses = [...element.classList]
    .filter((className) => !className.startsWith("pb-"))
    .filter((className) => /^[a-zA-Z_-][\w-]*$/.test(className))
    .filter((className) => !looksGenerated(className))
    .slice(0, 3);

  const classSelector = usefulClasses.map((className) => `.${CSS.escape(className)}`).join("");

  if (classSelector) {
    return `${tag}${classSelector}`;
  }

  const parent = element.parentElement;
  if (!parent) {
    return tag;
  }

  const sameTagSiblings = [...parent.children].filter((child) => child.tagName === element.tagName);
  if (sameTagSiblings.length <= 1) {
    return tag;
  }

  return `${tag}:nth-of-type(${sameTagSiblings.indexOf(element) + 1})`;
}

function stableAttributeSelector(element, options = {}) {
  const allowId = options.allowId !== false;
  const allowTextAttributes = options.allowTextAttributes !== false;

  if (allowId && element.id && !looksGenerated(element.id)) {
    return `#${CSS.escape(element.id)}`;
  }

  const technicalAttributes = ["data-testid", "data-test", "data-cy", "data-id", "data-role"];
  const textAttributes = ["aria-label", "name", "alt", "title"];
  const attributes = allowTextAttributes ? [...technicalAttributes, ...textAttributes] : technicalAttributes;
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);
    if (value && value.length <= 80 && !looksGenerated(value)) {
      return `${element.tagName.toLowerCase()}[${attribute}="${cssStringEscape(value)}"]`;
    }
  }

  return "";
}

function looksGenerated(value) {
  return /(?:^|[-_])[a-f0-9]{6,}(?:$|[-_])/i.test(value)
    || /^[a-z0-9_-]{18,}$/i.test(value)
    || /\d{5,}/.test(value);
}

function cssStringEscape(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function labelForElement(element) {
  const text = element.innerText || element.getAttribute("aria-label") || element.getAttribute("alt") || element.tagName.toLowerCase();
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 48) : element.tagName.toLowerCase();
}

function createId() {
  return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function blurAmountToPixels(amount) {
  const normalized = Number.parseInt(amount, 10);
  if (!Number.isFinite(normalized)) {
    return blurAmountToPixels(DEFAULT_BLUR_AMOUNT);
  }

  const clamped = Math.min(10, Math.max(1, normalized));
  return Math.round(1 + ((clamped - 1) * 1.6));
}

function showToast(message) {
  const existing = document.querySelector(".pb-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.className = "pb-toast";
  toast.textContent = message;
  document.documentElement.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "SET_ENABLED") {
    setEnabled(message.enabled);
    sendResponse({ ok: true, enabled: tabEnabled });
    return false;
  }

  if (message.type === "GET_CONTENT_STATE") {
    sendResponse({ enabled: tabEnabled, hostname: getDomainKey(), selecting });
    return false;
  }

  if (message.type === "START_SELECTING") {
    setEnabled(true);
    startSelecting();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "STOP_SELECTING") {
    stopSelecting();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "REFRESH_RULES") {
    refreshRules({ clearExisting: message.clearExisting !== false });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    const oldRules = getRulesForDomain(changes[STORAGE_KEY].oldValue, getDomainKey());
    const newRules = getRulesForDomain(changes[STORAGE_KEY].newValue, getDomainKey());
    refreshRules({ clearExisting: rulesRequireClear(oldRules, newRules) });
  }
});

function getRulesForDomain(domains, domainKey) {
  return domains?.[domainKey]?.rules || [];
}

function rulesRequireClear(oldRules, newRules) {
  if (oldRules.length !== newRules.length) {
    return true;
  }

  const oldRulesById = new Map(oldRules.map((rule) => [rule.id, rule]));

  for (const newRule of newRules) {
    const oldRule = oldRulesById.get(newRule.id);
    if (!oldRule) {
      return true;
    }

    if (ruleSignature(oldRule) !== ruleSignature(newRule)) {
      return true;
    }
  }

  return false;
}

function ruleSignature(rule) {
  return JSON.stringify({
    enabled: rule.enabled !== false,
    mode: rule.mode,
    selector: rule.selector || "",
    containerSelector: rule.containerSelector || "",
    itemSelector: rule.itemSelector || "",
    targetSelectors: rule.targetSelectors || []
  });
}
