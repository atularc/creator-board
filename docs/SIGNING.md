# Code signing

**Status: the installer is not signed yet.** Windows therefore shows "Windows protected your PC" (SmartScreen) the first time someone runs it. That screen appears for every new app without a publisher certificate; it does not mean the file is harmful. Users can click **More info > Run anyway**, and they can check the file first (see the README).

## Why not just sign it myself?
A self-made ("self-signed") certificate is **not trusted** by Windows and gives the same warning, sometimes a scarier one. It would add nothing, so this project does not use one.

## The free, trusted options

### Option A: SignPath Foundation (free signing for open-source projects)
Gives the downloadable `.exe` a real signature. The publisher shown by Windows is "SignPath Foundation".
Requirements (check the [current terms](https://signpath.org/terms) before applying): public repository, OSI-approved licence (this project uses MIT), automated build (this repository's GitHub Actions workflow), multi-factor authentication on the accounts involved, and a short code signing policy page.
Steps:
1. Make this repository public and run the build workflow once (see the README).
2. Apply at <https://signpath.org/apply> using the answers prepared below.
3. After approval, add SignPath's GitHub Action to `.github/workflows/build.yml` where marked, so the installer is signed before the checksum and attestation steps.

**Prepared answers for the application**
- Project: Creator Board, a free, private planner for YouTube, Instagram and Facebook creators.
- Licence: MIT. Repository: *(this repository's URL)*.
- Build: fully automated by GitHub Actions on every version tag (`.github/workflows/build.yml`).
- Purpose of signing: let people install without a scary "unknown publisher" screen; the app is local-only and collects nothing (see PRIVACY.md).
- Maintainer: The Hot Explainer. MFA is enabled on GitHub and SignPath.

### Option B: Microsoft Store (free for individual developers)
Microsoft signs the package, and people install with the Store's own trusted button ("Get").
1. Register a free individual developer account at <https://partner.microsoft.com> (identity check with an ID is required).
2. Reserve the app name **Creator Board** and copy the package identity values (name and publisher) Microsoft gives you.
3. Add an MSIX/AppX target with those values to the build, and submit the package through Partner Center. Microsoft's certification takes a few days.

### Not recommended
Paid certificates (hundreds of dollars a year) or cheap unknown resellers. They are not needed for a free open-source app.

## What helps trust right now (no signing needed)
Open source code, an automated GitHub build, a SHA-256 checksum, a build provenance attestation, automated safety tests, and a plain privacy statement. See the README section "Is it safe?".
