# Privacy Policy

SensiDemo does not collect, transmit, sell, or share personal data.

## Data stored locally

The extension stores the following data in the user's browser through `chrome.storage.local`:

- hostnames where rules were created
- CSS selectors for sensitive elements
- rule labels
- per-rule blur intensity
- whether each rule is enabled

This data stays on the local device unless the user exports, syncs, or backs up their browser profile through browser or operating system features outside this extension.

## Network access

SensiDemo has no backend and makes no network requests.

## Permissions

- `storage`: saves per-domain blur rules locally.
- `tabs`: identifies the active tab and hostname.
- `activeTab`: interacts with the current page after user action.
- `scripting`: injects the content script when needed.
- host access: allows blur rules to run on pages where the user activates the extension.

## Limitation

Blur is visual only. It does not remove sensitive data from the page source, network responses, browser memory, or developer tools.
