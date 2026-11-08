---
name: windows-release-signing
description: "v5 prereleases ship Linux and Mac only until SignPath's release-signing policy and production certificate exist; then set `WINDOWS_RELEASE_SIGNING` and put the signer's exact CN in `WINDOWS_PUBLISHER_NAMES`. Test-signing already works end to end."
---

# Windows release signing

The SignPath Foundation accepted the project on 2026-10-09; ssl.com signing was
discontinued and is not coming back. Test-signing works end to end: a hand
dispatch of `.github/workflows/windows-desktop.yml` under the `test-signing`
policy (run 37969118203), with `WINDOWS_TEST_SIGNING` skipping the
publisher-name check, since the test certificate's CN is not in
`WINDOWS_PUBLISHER_NAMES`. The SignPath GitHub App has to be installed on the
repo, whatever their docs say about it being optional.

**Waits on SignPath's setup review** for the `release-signing` policy and the
production certificate. Until then `release.yml` builds Windows only for a
stable tag (failing if it cannot sign) or once the repo variable
`WINDOWS_RELEASE_SIGNING` is `'true'`.

**Then:** set the variable, and put the production certificate's exact CN into
`WINDOWS_PUBLISHER_NAMES`. `appUpdateYml` in
`products/jbrowse-desktop/scripts/packaging/updateFeed.ts` writes
`publisherName` only when names are supplied, and keeps that for any unsigned
build. Publishing a beta as a prerelease is safe for v4.3.0 installs:
electron-updater resolves `/releases/latest`, which skips prereleases.

**If SignPath stalls:** a Berkeley IT InCommon/Sectigo certificate (KB0014601;
needs an HSM-held key such as Azure Key Vault Premium), Azure Artifact Signing,
a Certum open-source certificate (in a personal name), or Microsoft Store MSIX
(a separate update channel).
