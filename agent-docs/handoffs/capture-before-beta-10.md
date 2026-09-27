---
name: capture-before-beta-10
description: '@jbrowse/capture had two review passes on 2026-09-27 ahead of beta.10; what is left is publishing it and a few calls. Read before changing capture''s published surface or the JBrowseR / jbrowse-anywidget harnesses.'
---

# @jbrowse/capture before beta.10

The published surface is now the positive chain: `waitForJBrowseReady`,
`waitForFrame`, `waitForSession`, `waitForAppSettled`, `launchBrowser`,
`openJBrowse`/`captureJBrowse`. The negative waits (`waitForLoadingComplete`,
`waitForQuiescent`, `waitForDisplayPhases`, `waitForViewPhases`) and `delay`
live in `packages/browser-test-utils/src/phaseWaits.ts`, re-exported from
there, so no browser-test call site changed. `waitForAppReady` is gone:
`waitForAppSettled` now waits for the marker to mount.

## Open

- **Publish beta.10.** beta.9 on npm still shoots LGV error banners and
  defaults to `jb2/latest/` (4.3.0).
- **JBrowseR and jbrowse-anywidget** import capture's source from the sibling
  checkout (commits `5b0731c`, `ff23cb2` in those repos, unpushed). Their
  nightly render jobs now fail when UCSC's `hgdownload` stalls, which it did
  all afternoon; that is the gate working, not a flake to retry away.
- **`allowUnsettled` does not cover the session gate**: a trackId or assembly
  that never opens throws either way. Deliberate so far; say so in the README
  if nobody objects.
