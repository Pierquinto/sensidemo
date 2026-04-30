# Icon

The source icon is `assets/icons/sensidemo.svg`.

Chrome uses PNG exports:

- `assets/icons/sensidemo-16.png`
- `assets/icons/sensidemo-32.png`
- `assets/icons/sensidemo-48.png`
- `assets/icons/sensidemo-128.png`

The icon combines:

- a person silhouette for user data
- horizontal blur bands for redaction
- a blue-violet-cyan palette for a privacy/productivity feel

If the icon changes, regenerate PNG files before publishing the extension:

```sh
node scripts/generate-icons.js
```
