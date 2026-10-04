---
name: capture-before-beta-10
description: "@jbrowse/capture shipped in beta.10. Left are the JBrowseR and jbrowse-anywidget harness commits, still unpushed and still importing capture from the sibling checkout. Read before changing capture's published surface or those harnesses."
---

# @jbrowse/capture after beta.10

The published surface is the positive chain: `waitForJBrowseReady`,
`waitForFrame`, `waitForSession`, `waitForAppSettled`, `launchBrowser`,
`openJBrowse`/`captureJBrowse`. The negative waits live in
`packages/browser-test-utils/src/phaseWaits.ts`.

## Open

- **JBrowseR and jbrowse-anywidget** import capture's source from the sibling
  checkout (commits `5b0731c`, `ff23cb2` in those repos, unpushed: JBrowseR
  three ahead of origin, jbrowse-anywidget two, on 2026-10-04). With beta.10
  on npm they can take the published package instead. Their nightly render
  jobs fail when UCSC's `hgdownload` stalls; that is the gate working, not a
  flake to retry away.
