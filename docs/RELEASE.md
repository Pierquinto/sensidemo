# Release Checklist

Use this checklist before publishing a GitHub release or Chrome Web Store package.

## Code checks

```sh
node scripts/generate-icons.js
node --check src/background.js
node --check src/content.js
node --check src/popup.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

## Manual test

- Load the extension unpacked in Chrome.
- Test a single rule on a simple page.
- Test a recursive rule on `demo/index.html`.
- Change blur intensity from 1 to 10 and verify the page updates.
- Disable and re-enable the tab toggle.
- Remove one rule.
- Clear all rules.
- Verify rules do not apply on another hostname.

## Package

```sh
zip -r sensidemo.zip . -x "*.git*" "*.DS_Store" "*.zip"
```

## GitHub release notes

Include:

- summary of user-facing changes
- privacy impact
- licensing note: source-available under PolyForm Noncommercial 1.0.0
- manual test notes
- known limitations

## Chrome Web Store notes

Use the privacy policy from `PRIVACY.md`.

Suggested short description:

```text
Blur sensitive images and text per domain while recording product demos.
```

Suggested category:

```text
Productivity
```
