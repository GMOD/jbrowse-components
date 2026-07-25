---
name: progress-reporting
description: The worker to UI status channel via statusCallback, determinate bars, concurrent-fetch aggregation, and cancel. Read when touching a progress bar or download loop.
---

# Status / progress reporting

How loading status travels from workers to the loading UI. This is one
out-of-band channel, orthogonal to the render lifecycle — read it when touching
a progress bar, a download adapter, or a worker loop that should report
progress.

## The one channel

`statusCallback: (status: RpcStatus) => void`, where

```ts
RpcStatus = string | { message; current; total }
```

(`packages/core/src/util/progress.ts`). A plain string is an indeterminate
phase label. The object form adds a determinate `current/total` fraction —
unit-agnostic (bytes, blocks, or records). The UI decides presentation, so
percentages are never baked into the message string.

There is **no** second `onProgress` channel. Emit through `statusCallback`
only.

## Flow

```
worker adapter → opts.statusCallback(status)
  → RPC drivers special-case statusCallback as out-of-band
    (message type `unknown`, so the object survives serialization)
  → the display's status callback thins the stream (createStatusThrottle)
  → setStatusMessage splits it into statusMessage + statusProgress
  → DisplayLoadingOverlay draws a determinate bar + cancel, else a spinner
```

## Helpers (`progress.ts`)

- `downloadStatus(label, cb, fn(onProgress))` wraps every download adapter:
  label + clear + a byte-reporter adapting generic-filehandle2 / tabix / bam /
  cram. `total` is optional — an unknown Content-Length means indeterminate.
- `createProgressReporter` / `withProgress` for determinate worker CPU loops.
  `report()` auto-increments; the cancel-check and emit are counter-gated, so
  calling it every iteration is cheap.
- `updateStatus` for indeterminate phases.
- `statusMessageText` / `statusFraction` / `statusProgressLabel` extract the
  parts back out.
- `aggregateStatus` merges concurrent statuses into one `Σcurrent/Σtotal`.

`parseLineByLine` (flat-file adapters) and `fetchAndMaybeUnzip`
(bigwig/bigbed/hic/sequence) forward determinate progress through these.

## Concurrent fetches share one field — aggregate, don't clobber

A fetch generation can fan out into N parallel per-region RPCs that all write
the same volatiles. Route each through `FetchMixin.setRegionStatus(key,
status)` (keyed by `displayedRegionIndex`), which re-derives the shared fields
via `aggregateStatus`. N downloads then read as one honest bar instead of
last-writer thrash. `runFetch` / `cancelFetch` clear the map.

## The stream is throttled on the callback, never on the write

An adapter emits progress ~40/s and each observable write repaints the overlay
(and repositions its MUI Popper) — measured outpacing the view's own animation.
`createStatusThrottle()` (`@jbrowse/core/util`) is the one leading-edge window
(100ms): **one per display**, shared across its status callbacks so N parallel
region fetches thin to one stream between them rather than N. Both fetch
families own one — `FetchMixin` for the LGV displays, `createStopTokenRotation`
for the bare-autorun fetches (dotplot, synteny) that compose no fetch mixin — so
progress cadence is uniform whichever path a display took.

Two rules the shape enforces:

- **`setStatusMessage` itself is never throttled.** A display writing a phase
  label by hand ("Downloading" → "Parsing") must see every write land; there is
  no trailing flush to recover a dropped one.
- **`setRegionStatus` throttles only its derived bar write**, never the
  per-region map. Throttling the whole call (as it once did) dropped `undefined`
  deletes too, stranding a finished region in the aggregate for the rest of the
  fetch. A cleared aggregate also bypasses the window, or a finished fetch's
  message would stay on screen.

## Cancel is durable and retryable

Two cancels on `FetchMixin`:

- `cancelFetch()` — internal reset. Bumps `fetchGeneration` to retrigger,
  clears `fetchCanceled`.
- `cancelFetchByUser()` — the overlay button. Sets the durable `fetchCanceled`
  volatile and does **not** bump the generation, so nothing restarts.

`fetchCanceled` is a blocking state like `error` / `regionTooLarge`:
`FetchVisibleRegions` early-returns on it, `ClearBlockingStateOnViewportChange`
clears it on pan/zoom, and `runFetch` start is the single un-cancel point.
`reload()` is the retry path.

## Not yet wired (deferred, low priority)

Text-indexing reports byte strings to the admin CLI, and worker sort/layout
loops emit no per-iteration progress. Both could go determinate via
`createProgressReporter` if a context ever surfaces them.
