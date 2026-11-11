# Security

Creator Board runs locally and has no accounts, passwords or network features, but bugs are still possible.

## Reporting a problem
Please open a **[private security advisory](../../security/advisories/new)** on this repository (Security tab > Report a vulnerability), or message the maintainer on LinkedIn. Please do not post details publicly until it is fixed. You will get a reply within a few days.

## What is protected
- The local server only listens on `127.0.0.1`.
- The window cannot open other websites inside the app; links open in your normal browser.
- Your data file is never uploaded anywhere.

## Supported versions
Only the latest release receives fixes.

## Phone mode (advanced, off by default)
Running from source with `HQ_LAN=1` lets other devices on your Wi-Fi open the app **without a password**. Use it at home only. The installed app never enables this.
