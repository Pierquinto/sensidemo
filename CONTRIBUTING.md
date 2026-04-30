# Contributing

Thanks for wanting to improve SensiDemo.

## Development setup

1. Clone the repository.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository folder.

After changing files, reload the extension from `chrome://extensions` and refresh the page you are testing.

## Local checks

Run these checks before opening a pull request:

```sh
node --check src/background.js
node --check src/content.js
node --check src/popup.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

## Pull requests

- Keep changes focused.
- Explain the privacy or UX impact of the change.
- Include manual test notes for Chrome.
- Avoid adding dependencies unless they are clearly necessary.
- By contributing, you agree that your contribution may be distributed under this project's noncommercial license.

## Project principles

- Configuration stays local in `chrome.storage.local`.
- The extension should not send browsing data to any server.
- Blur is a visual demo aid, not a security boundary.
- Prefer simple, auditable JavaScript over framework complexity.

## Licensing

SensiDemo uses the PolyForm Noncommercial License 1.0.0. Contributions should not introduce code or assets that conflict with noncommercial distribution.
