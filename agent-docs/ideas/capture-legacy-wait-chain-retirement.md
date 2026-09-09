---
name: capture-legacy-wait-chain-retirement
description: Half of @jbrowse/capture's ready chain exists only for builds without `data-app-phase`, and the trigger to delete it is a v5 release reaching jbrowse.org/code/jb2/latest — the package's own default `--instance`. Records the inventory, the measurement that keeps it alive today, and the part that is a migration of ~20 caller files rather than a deletion.
---

# Retiring capture's legacy wait chain

Parked: the trigger has not fired. `ready.ts` says the fallback "can be deleted
the day the oldest supported build has it" and nothing recorded what "it" is or
who notices when that day arrives. This is that note.

## The trigger

`AppReadyMarker` lives in `packages/app-core`, so `data-app-phase` and the
`data-app-*` census ship with v5. The package's default `--instance` is
`https://jbrowse.org/code/jb2/latest/` — the released build every
genomes.jbrowse.org link opens — and measured on 2026-09-05 it publishes the
loading overlay and none of `data-app-phase`, `data-view-phase`,
`data-display-phase`, `data-display-drawn` or `data-busy`. So **the legacy path
is the default path today**, not a compatibility shim for an old pin.

The day `code/jb2/latest` is a v5 build, the fallback becomes unreachable for
anyone who has not pinned an older `--instance` deliberately.

## What goes

In `ready.ts`, everything below the `hasAppReadyMarker` branch: steps 1b through
6, `LEGACY_PAINT_SETTLE_MS`, `LEGACY_BUSY_WINDOW_MS`, `LEGACY_QUIET_MS`, and the
`needsQuietGate` reasoning that exists to decide whether an absence means
anything. `waitForJBrowseReady` becomes the marker branch alone.

In `sessionGate.ts`, the session-model walk under each census read — the
duck-typed recursion over `tracks` / `trackContainers` / `levels` / `views` that
[ADR-103](../architecture-decision-records/adr-103-the-view-answers-for-itself-and-the-marker-publishes-the-census.md)
already reduced to "capture's legacy fallback". With it go `Instrumentation`,
`readInstrumentation`, `hasPaintContract` and `PAINT_CONTRACT_NOTE`, which
report which of the two paths ran.

In `waits.ts`, `isPageBusyInPage` and `BUSY_SELECTOR` — the session-model status
walk that is the only per-display signal an uninstrumented build has.

## The part that is not a deletion

`waitForQuiescent`, `waitForLoadingComplete`, `waitForQuietPeriod`,
`waitForViewPhases` and `waitForDisplayPhases` are exported and called directly
from about twenty files outside the package: thirteen `website/scripts`, four
`products/jbrowse-web/browser-tests`, plus `browser-test-utils`, `synteny-core`
and `sv-inspector`. Most drive a local build, which has the marker, so they are
migrations to `waitForAppSettled` rather than removals — but they are the bulk
of the work and they are what makes this a change worth planning instead of a
tidy-up someone does in passing.

## What stays

The session gate itself. It is the only positive signal in the package and the
only check that the assembly and trackIds asked for are the ones open; the
marker answers "is the app working", not "is it showing what I asked for". Its
census read stays and its model walk goes.
