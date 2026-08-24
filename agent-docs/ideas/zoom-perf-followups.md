---
name: zoom-perf-followups
description: What is left after the 2026-08-23 scroll-zoom pass, and the two things it establishes should NOT be attempted. The stop-token blob URL is paid on every fetch in the app to serve six await-free worker loops and is the one substantial simplification left; wiggle instance packing could move to the worker and MAF's cannot; and putting content staleness into displayPhase would raise the loading scrim 250ms into every zoom.
---

# Scroll-zoom: what is left, and what not to try

Follow-ups from the 2026-08-23 pass (`perf(zoom)`, and the four fixes after it).
The measurements behind them are in
[reference/INTERACTION_PERF.md](../reference/INTERACTION_PERF.md) §"Profile the
production build"; that page also holds the two measurement traps, which anyone
picking this up should read first.

Numbers below are main-thread self time over one ~7s production-build gesture on
a four-track LGV, whose total busy is ~5.1s.

## Retire the stop-token sync probe

**The largest simplification available, and the motive for the machinery is
gone.**

`createStopToken` mints `URL.createObjectURL(new Blob())` — 94ms of Blob +
createObjectURL — and `notifyStopToken` fans each stop out to every worker in the
pool, 79ms of postMessage. The blob URL exists for exactly one reason: it is what
`probeBlobUrl` fails against once revoked, giving a **synchronous** cancellation
check. `probeBlobUrl` is a synchronous XHR, and is inert unless the caller is in a
worker and the token is a `blob:` id.

Six call sites actually need a sync probe, all await-free worker compute:
`getLDMatrix.ts`'s O(n²) fill, the four clustering executors
(`executeClusterGenotypeMatrix`, `executeClusterScoreMatrix`,
`buildIdentityMatrix`, `clusterMatrix`), and `diagonalizeRegions`. Everything the
zoom path touches — the whole alignments/canvas/wiggle fetch, the streaming
adapters — is already chunked by awaits, where the free `stoppedIds.has` lookup
cancels perfectly well.

So the cost is paid on every fetch in the app to serve six batch jobs. The
original motive was cancelling long synchronous **canvas drawing** during rapid
re-render, which GPU rendering removed.

**The shape of the fix**: make those six loops yield periodically — they are
already inside async RPC methods, so `await` is available — and the plain-id
check cancels them. `probeBlobUrl`, the blob, `createObjectURL` and the revoke
all delete, and `createStopToken` becomes `nanoid()`. Note
`stopToken.ts`'s header records that the probe was deleted once before and had to
be restored; deleting it *without* first chunking those loops is that same
mistake.

**Weaker variants**, if the loops turn out not to be chunkable:

- Upgrade to a blob URL per RPC **method** rather than per token, at
  `RpcManager.call` — it is the one place that knows `functionName`, `sessionId`
  and `args.stopToken` together. Flagging the *rotation* instead does not work:
  LD reaches the worker through the same `FetchMixin.runFetch` →
  `createStopTokenRotation.begin()` path as the zoom-hot fetches, so a
  probe-less rotation would silently un-cancel it.
- Narrow the broadcast. `WebWorkerRpcDriver.getWorker` is sticky per `sessionId`,
  and a token belongs to one display whose session id is fixed, so token → worker
  is a one-hop lookup that already exists. Costs plumbing a sessionId through
  `stopStopToken`, which is public API.

**Do not** reach for cross-origin isolation to get the `SharedArrayBuffer` branch:
[ADR-056](../architecture-decision-records/adr-056-jbrowse-org-is-not-cross-origin-isolated.md)
rejected it. COEP is not the blocker (CORS-mode fetches are exempt); COOP
`same-origin` nulls `window.opener` and hangs the OAuth popup, and an embeddable
library cannot demand headers of its host page anyway.

## Wiggle instance packing could move to the worker; MAF's cannot

`wiggleInstanceBuffer.pack` is 110ms and `mafInstanceBuffer` is 126ms, both run
synchronously inside the RPC message handler, so they land mid-frame.

**MAF is closed.** Its pack depends on `binBp` (a power-of-two tier off
`coarseBpPerPx`) and on the palette, and its `regionFetchKey` is empty — it
deliberately does *not* refetch on zoom, re-encoding on the main thread instead.
Moving the pack worker-side would make every zoom-tier crossing and every theme
flip a full refetch, at ~31ms/region
([reference/MAF_WORKER_PIPELINE.md](../reference/MAF_WORKER_PIPELINE.md)). It
re-encodes precisely because there is no RPC to ride along on.

**Wiggle is open but not cheap.** Its `regionFetchKey` is `String(bpPerPx)`, so a
zoom already refetches and a worker-side pack would ride along free. The obstacles
are that packing needs main-thread-only inputs (the colour strings, `rowIndex`
from the visible ordered source list, the whisker band split) and that
`installPerRegionLifecycle` re-encodes with **no RPC** on recolour, plot-type and
summary-mode changes — so the main-thread packer has to stay for that path
regardless. `createInstanceCache` does not rescue it: wiggle's layer *set* changes
with `summaryScoreMode`, so geometry and colour are not separable.

Transferring the result is solved: `rpcResult(value, transferables)` /
`rpcResultWithArrayBuffers` already carry wiggle's typed arrays, and MAF's
coverage half is already packed in the worker
(`buildMafCoverageRegion.ts`) as the precedent.

## Do not put content staleness into `displayPhase`

During a zoom a display reports `ready` for ~600ms between fetches. That is not a
stop-token handover artifact — supersede is gap-free by construction (ADR-080) —
it is the fetch autorun's debounce, and in that window the display genuinely has
data covering the viewport with nothing in flight.

The tempting fix is to fold `isCacheValid` into the per-region `viewportCurrent`,
so a display whose `regionFetchKey` has moved reads `loading`. **It would raise
the loading scrim 250ms into every zoom**, since `visible = phase === 'loading'`,
and it would delay every interaction-time readiness gate by the debounce.
`zoomInvalidation.test.ts` and `displayPhaseWiring.test.ts` already pin "ready
through a zoom inside the buffer" and are the standing guard against taking this
without deciding to.

The comparative family *does* fold `dataCurrent` in
(`comparativeReadiness.ts`), so the two families genuinely differ here — that is
a real inconsistency, and the LGV reading is the one with the scrim attached to
it.

## Smaller, measured, unclaimed

- **`visibleEntries` rebuilds a fresh `flatMap` array** on every recompute
  (`WiggleCommonMixin.ts`). Worth looking at only if autoscale is still hot after
  the binary-search clip that landed.
- **React commit is still the largest single block** — `react-dom` self time
  651ms, `setAttribute` 81ms. Same answer as ever: fewer components per frame.
  The production profile is what should choose them; the dev build misranks by
  ~20x.
- **`stopStopToken` is still called two or three times per token.** The guard
  that landed makes the repeats free, but the cause is that
  `createStopTokenRotation.end()` does not clear `currentStopToken`, so the next
  `begin()` re-stops what the fetch's own `finally` already stopped.
