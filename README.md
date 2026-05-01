# SensiDemo

![SensiDemo icon](assets/icons/sensidemo.svg)

SensiDemo is a lightweight source-available Chrome extension that visually blurs sensitive images and text while recording product demos, customer walkthroughs, sales videos, or internal training material.

It is built for teams who need to show real software without exposing real people, names, roles, profile photos, account details, or other private data.

## Features

- Manual ON/OFF toggle per browser tab.
- Per-domain configuration stored locally.
- Click-to-blur selection directly on the page.
- Single-element rules for isolated sensitive fields.
- Recursive list/grid rules for repeated cards, rows, and profile lists.
- Per-rule blur intensity from 1 to 10.
- MutationObserver support for infinite scroll, lazy-loaded rows, and client-rendered updates.
- No backend, no analytics, no telemetry.

## How it works

SensiDemo stores rules per hostname in `chrome.storage.local`.

Rules can be:

- `single`: blur all elements matching one CSS selector.
- `recursive`: find a container, loop through repeated items, and blur matching targets inside each item.

Recursive rules are useful for pages like CRM lists, social/contact grids, LinkedIn-style cards, customer tables, and team directories.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository folder.

After changing extension files, reload the extension from `chrome://extensions` and refresh the page you are testing.

## Usage

1. Open the website you want to record.
2. Open the SensiDemo extension popup.
3. Turn the tab toggle ON.
4. Click `Select elements`.
5. Click a sensitive element on the page.
6. Choose:
   - `This type only` for a single selector rule.
   - `Whole list` for a recursive list/grid rule.
7. Adjust each rule with the `Blur 1/10` to `Blur 10/10` slider.

## Local demo

Open `demo/index.html` in Chrome and create recursive rules for avatar, name, and role. Use the `Add contact` button to add new cards and verify that dynamic content is blurred automatically.

For local `file://` demos, Chrome may require enabling `Allow access to file URLs` in the extension details page.

## Permissions

SensiDemo requests:

- `storage`: saves rules locally.
- `tabs`: reads the active tab and hostname.
- `activeTab`: interacts with the page after user action.
- `scripting`: injects the content script when needed.
- host access: allows rules to run on pages where the user activates the extension.

See [PRIVACY.md](PRIVACY.md) for the privacy policy.

## Security and privacy model

SensiDemo is a visual privacy aid for recordings and demos. It does not remove sensitive data from the DOM, page source, network responses, browser memory, or developer tools.

Use it to prevent accidental visual disclosure in screen recordings. Do not treat it as a security boundary.

## Project structure

```text
.
├── assets/icons/          Extension icon source and PNG exports
├── demo/                  Local test page
├── docs/                  Maintainer and architecture docs
├── src/background.js      Per-tab enabled state
├── src/content.js         Selection, rule matching, and blur application
├── src/content.css        Page overlay and blur styles
├── src/popup.html         Extension popup UI
├── src/popup.js           Popup state and rule management
└── src/popup.css          Popup styling
```

## Development checks

```sh
node scripts/generate-icons.js
node --check src/background.js
node --check src/content.js
node --check src/popup.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

## Packaging

To publish or share a release, zip the repository contents while excluding `.git`, `.DS_Store`, and generated archives.

```sh
zip -r sensidemo.zip . -x "*.git*" "*.DS_Store" "*.zip"
```

## Roadmap

- Export and import rules.
- Optional domain-level default blur intensity.
- Keyboard shortcut for selection mode.
- Optional masked replacement text mode.
- Firefox support.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening issues or pull requests.

## License

SensiDemo is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).

You may use, study, modify, and redistribute it for noncommercial purposes. Selling it, repackaging it for resale, or using it as part of a paid product or service requires prior written permission from the copyright holder.

This is a source-available noncommercial license, not an OSI-approved open-source license. See [LICENSING.md](LICENSING.md) and [LICENSE](LICENSE).
