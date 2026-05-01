# Architecture

SensiDemo is a vanilla JavaScript Chrome extension using Manifest V3.

## Components

- `src/background.js`: keeps manual ON/OFF state per tab.
- `src/popup.js`: reads the active tab, manages domain rules, and sends commands to the content script.
- `src/content.js`: runs in the page, handles selection mode, creates selectors, applies blur, and observes DOM mutations.
- `chrome.storage.local`: stores all per-domain rules.

## Rule model

Rules are stored under the `sensiDemoDomains` key:

```json
{
  "example.com": {
    "rules": [
      {
        "id": "rule_...",
        "label": "Profile photo",
        "mode": "single",
        "enabled": true,
        "blurAmount": 8,
        "selector": "img.avatar"
      },
      {
        "id": "rule_...",
        "label": "Name in list",
        "mode": "recursive",
        "enabled": true,
        "blurAmount": 8,
        "containerSelector": "[data-testid=\"connections-grid\"]",
        "itemSelector": "[data-testid=\"connection-card\"]",
        "targetSelectors": [".name", ".role"]
      }
    ]
  }
}
```

## Blur flow

1. User enables blur in the popup.
2. Popup sends `SET_ENABLED` to the content script.
3. Content script loads domain rules from local storage and caches active rules in memory.
4. Matching elements receive `.pb-blurred` and an inline `filter: blur(...) !important`.
5. DOM mutations re-apply cached rules without clearing existing blur, which avoids visible flicker when apps replace rows or cards dynamically.

## Selection flow

1. User clicks `Select elements`.
2. Content script enters selection mode and highlights hovered elements.
3. User clicks an element.
4. Content script offers a single rule or recursive list/grid rule.
5. The chosen rule is saved to `chrome.storage.local`.
6. The page refreshes matching rules immediately.

## Selector strategy

Selector generation prefers stable attributes first:

- `id`, when it does not look generated
- `data-testid`, `data-test`, `data-cy`, `data-id`, `data-role`
- selected text attributes only for non-recursive selectors
- readable class names
- `nth-of-type` fallback when necessary

Recursive rules avoid personal text attributes such as `alt` and `aria-label`, because those often contain the user's name and would not match repeated cards.
