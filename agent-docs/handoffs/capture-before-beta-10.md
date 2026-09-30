---
name: capture-before-beta-10
description: "@jbrowse/capture shipped in beta.10 after two review passes on 2026-09-27. Left are the JBrowseR and jbrowse-anywidget harness commits, still unpushed, and one README sentence on allowUnsettled. Read before changing capture's published surface or those harnesses."
---

# @jbrowse/capture after beta.10

The published surface is the positive chain: `waitForJBrowseReady`,
`waitForFrame`, `waitForSession`, `waitForAppSettled`, `launchBrowser`,
`openJBrowse`/`captureJBrowse`. The negative waits live in
`packages/browser-test-utils/src/phaseWaits.ts`.

## Open

- **JBrowseR and jbrowse-anywidget** import capture's source from the sibling
  checkout (commits `5b0731c`, `ff23cb2` in those repos, unpushed). With
  beta.10 on npm they can take the published package instead. Their nightly
  render jobs fail when UCSC's `hgdownload` stalls; that is the gate working,
  not a flake to retry away.
- **`allowUnsettled` does not cover the session gate**: a trackId or assembly
  that never opens throws either way. Deliberate so far; say so in the README.
