# Security Policy

## Supported versions

Security fixes target the latest version on the main branch until the project starts publishing tagged releases.

## Reporting a vulnerability

Please open a private security advisory on GitHub if the repository has advisories enabled. If not, contact the repository maintainer privately before publishing details.

Include:

- affected browser and extension version
- steps to reproduce
- expected and actual behavior
- whether sensitive browsing data can leave the local machine

## Privacy model

SensiDemo stores rules locally using `chrome.storage.local`. It does not include analytics, telemetry, remote configuration, or a backend.

Important limitation: blurred content remains present in the page DOM. This extension protects screen recordings and live demos from accidental visual disclosure; it is not designed to hide data from someone with page access, DevTools access, or filesystem access.
