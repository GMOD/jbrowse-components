---
status: Accepted
summary: '"Has JBrowse finished rendering" is implemented three times — the phase attributes the app publishes, jb.waitReady, and @jbrowse/capture — and stays that way, because capture serializes its readers into the page and cannot import; what is shared is the selector contract, pinned by a test'
---

# ADR-100: Readiness is answered three times, on purpose

## Status

Accepted

## Context

`jb.waitReady` landed in `packages/app-core/src/JbApi/` when the `jb` helper
library moved out of the desktop MCP handler, and made a third implementation of
"has JBrowse finished rendering". The other two are the `data-*-phase`
attributes the app publishes ([ADR-076](adr-076-a-shared-canvas-answers-readiness-twice.md)
is why the comparative views publish what they do), and `@jbrowse/capture`'s
`sessionGate.ts` / `waits.ts`.

Three readers of one contract that can drift is a real smell, and consolidating
them was proposed. It is the wrong merge.

## Decision

**The logic stays duplicated. The contract gets pinned.**

Three things make sharing the logic impossible rather than merely awkward:

- **Serialization.** Every in-page function in capture is handed to
  `page.evaluate`, which stringifies it, so it "can only call what it declares
  inside itself" — capture's own source says so three times
  (`sessionGate.ts:53-58`, `:73-78`, `waits.ts:340-342`). That is why
  `BUSY_SELECTOR` is exported *and* re-typed inside `isPageBusyInPage`, and why
  `readViews` is inlined rather than imported. A shared module import is exactly
  what does not survive the trip into the page.
- **Dependency direction.** `@jbrowse/capture` is a published CLI whose only
  runtime dependency is puppeteer. Importing `@jbrowse/app-core` pulls
  `@jbrowse/core`, MST, mobx and React into it, and
  `scripts/workspaceLayering.test.ts` records exactly one lib→product runtime
  edge today.
- **Version skew is the design, not drift.** Capture defaults to `jb2/latest`,
  which publishes none of the phase attributes; roughly half of `capture.ts` is
  the fallback chain for builds older than the marker, and `capture.ts:166-168`
  says it can be deleted "the day the oldest supported build has it".
  `jb.waitReady` answers only for the build it ships inside. One reader asking a
  question the other cannot is the point.

What they genuinely share is two attribute selectors, `[data-app-phase="ready"]`
and `[data-testid="loading-overlay"]`, published by `AppReadyMarker` and
`LoadingOverlay`. Those are plain strings in three files, and a rename in one
splits the readers **silently**: each keeps waiting on a selector that will
never match, which presents as "still loading" rather than as a broken build.
`scripts/readinessContract.test.ts` pins the strings — in the neutral root-level
home, since neither package may import the other.

## Consequences

The differences *below* the contract are deliberate and are documented rather
than checked:

| | `@jbrowse/capture` | `jb.waitReady` |
| --- | --- | --- |
| pending census | the DOM, `[data-display-drawn="false"]` | the session model |
| sees `tooLarge` / `renderError` | no — they replace the subtree and publish no attribute | yes |
| displays per track | all that publish the attribute | `displays[0]` only |
| nested views | recurses to any depth | flattens exactly one level |
| scope | document-wide | a `root`, because react-app2 mounts two apps |

Neither is a bug in the other. If `jb.waitReady` is ever wanted as the strict
superset, the last three rows are where it is not.

The seam that already keeps the *session walk* honest across this boundary is
`products/jbrowse-web/src/tests/pluginFacingSessionApi.test.ts`, which pins the
shape from inside jbrowse-web precisely because capture performs the same walk
from outside. Strengthening that seam is the direction to take; a shared module
is not.
