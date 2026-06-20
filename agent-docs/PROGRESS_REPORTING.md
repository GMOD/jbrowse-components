# Status / progress reporting — handoff

Branch `webgl-poc`. Landed in commit `67f70619a5` (2026-06-18). This doc is the
single source of truth for how loading status + determinate progress flows from
workers to the loading UI, and what's left to do.

## The model: one transport

There is **one** out-of-band status channel: `statusCallback`, carrying

```ts
// packages/core/src/util/progress.ts
type RpcStatus = string | StatusWithProgress      // string = indeterminate phase
interface StatusWithProgress { message: string; current: number; total: number }
type StatusCallback = (status: RpcStatus) => void  // canonical type, use everywhere
```

- A plain **string** is an indeterminate phase label (`"Loading features"`).
- A **StatusWithProgress** object adds a determinate fraction. `current`/`total`
  are unit-agnostic (bytes for a download, blocks for an unzip, features for a
  scan). The UI — not the worker — decides presentation, which is why this is an
  object and not a baked `"... 45%"` string: `statusFraction()` needs the
  numeric ratio to draw the bar, the message stays stable while the bar
  animates, and it stays aggregatable / i18n-able.

### Flow

worker adapter/RPC → `opts.statusCallback(status)` → (RPC drivers special-case
`statusCallback` as out-of-band, message type `unknown`, so objects cross fine)
→ main thread → `FetchMixin.setStatusMessage(status: RpcStatus)` splits it into
`statusMessage` (via `statusMessageText`) + `statusProgress` (via
`statusFraction`) → `DisplayLoadingOverlay` renders a determinate bar + % +
cancel when `statusProgress` is set, else a spinner + message.

`statusCallback` is the only channel the RPC drivers wire. There is **no**
`onProgress` channel — an earlier attempt added a second `BaseOptions.onProgress`
that was never RPC-wired (dead) and has been removed. Don't reintroduce it; emit
through `statusCallback`.

## Helpers (`packages/core/src/util/progress.ts`)

All status helpers now live in **one file** — `progress.ts`. `updateStatus` /
`updateStatus2` moved here from `util/index.ts` (which still re-exports them via
`export * from './progress.ts'`, so `@jbrowse/core/util` imports are unchanged).

| Helper | Use |
| --- | --- |
| `downloadStatus(label, statusCallback, fn(onProgress))` | **The API for download phases.** Combines `updateStatus` (label + clear) with an internal byte-reporter and hands the reporter to `fn`, so the phase label lives in **one** place. The reporter adapts the byte-granularity `onProgress(bytes, total?)` from generic-filehandle2 / `@gmod/tabix` / `@gmod/bam` / `@gmod/cram`; `total` is **optional** — readers that don't know the size up front (generic-filehandle2 with no Content-Length) emit just the label (indeterminate spinner), with a total it's a determinate bar. Passes `undefined` to `fn` when there's no `statusCallback` so the reader skips bookkeeping. All 7 download adapters (bam/cram/bed/gff3/gtf/vcf/splitvcf) + `fetchAndMaybeUnzip` use this. (The reporter itself, `downloadStatusReporter`, is module-private — nothing outside `progress.ts` calls it; don't re-export it.) |
| `createProgressReporter({label,total,statusCallback,stopToken})` | Per-iteration `report()` for long worker CPU loops: throttled cancel-check + throttled object emit. **Bare `report()` auto-increments** an internal counter (the elegant default — `for (…) report()`); pass `report(n)` only when the caller tracks its own running position across batches. Cheap enough to call every iteration: cancel-check and the emit's `Date.now()` are both counter-gated (bitmask), so the common path is an int compare — no clock read. With no `statusCallback`/`total` it's a pure cancel-tick. |
| `withProgress({label,total,statusCallback,stopToken}, fn)` | Determinate phase wrapper; the counterpart to `updateStatus`. |
| `updateStatus(label, statusCallback, fn)` | Indeterminate phase: sets `label`, runs `fn`, clears. |
| `statusMessageText(status)` / `statusFraction(status)` | Extract text / `[0,1]` fraction from any `RpcStatus`. |
| `aggregateStatus(statuses[])` | Combine several concurrent statuses into one: determinate ones sum to `Σcurrent/Σtotal`, message borrowed from a determinate entry (else the first). For displays that fan one fetch into parallel per-region RPCs. |

## Concurrent fetches share one status field — aggregate, don't clobber

A single fetch generation can fan out into **N parallel RPCs** — canvas's
`fetchNeeded` does `Promise.all(needed.map(fetchFeaturesForRegion))`, one per
visible region. They all report into the *same* `statusMessage`/`statusProgress`
volatiles, so a naive `statusCallback: msg => self.setStatusMessage(msg)` makes
the bar thrash (region A at 60%, region B at 5%, last-writer-wins).

Fix: route each concurrent op's status through `FetchMixin.setRegionStatus(key,
status)` (keyed by `displayedRegionIndex`) instead of `setStatusMessage`. It
keeps a per-key `regionStatuses` map and re-derives the shared fields via
`aggregateStatus` on every update — N parallel downloads read as one honest
`Σcurrent/Σtotal` bar. `runFetch`/`cancelFetch` clear the map. The single-region
case (`needed.length === 1`) is unchanged. `runFetch` still guarantees only one
fetch generation at a time, so this conflict only ever exists *within* one
`Promise.all`.

The per-phase loops are now determinate too — bam/cram `Processing alignments`
and the canvas worker's `Computing layout` use `withProgress` + `report()`, so a
region in its processing phase still contributes a fraction to the aggregate
rather than dropping to a spinner.

Residual gap: the summed fraction mixes units across phases — a region counting
download *bytes* and another counting processed *records* are added into one
`Σcurrent/Σtotal`. Within a single phase the units match; across phases the bar
is a rough blend (download bytes dominate the magnitude). Acceptable — download
is the wall-clock-dominant phase and the bar stays monotonic-ish.

## Pattern: forwarding download progress in a feature adapter

See `plugins/variants/src/VcfTabixAdapter/VcfTabixAdapter.ts` (and SplitVcf).
`downloadStatus` owns the label + clear and hands you the `onProgress` to pass
straight through:

```ts
await downloadStatus('Downloading variants', statusCallback, onProgress =>
  vcf.getLines(refName, start, end, {
    signal: opts.signal,
    lineCallback: (line, fileOffset) => { observer.next(...) },
    onProgress,
  }),
)
```

Do **not** spread `...opts` into `getLines` — that was the old footgun (a stray
`onProgress` object would collide with tabix's `onProgress(bytes,total)`). Pass
only `signal` + `lineCallback` + `onProgress`. (`fetchAndMaybeUnzip` *does*
spread `...opts` into `readFile`, but that's safe: `BaseOptions` carries no
`onProgress`, so the explicit `onProgress` we add is the only one.)

## Parse phase: `parseLineByLine`

`parseLineByLine` (`util/parseLineByLine.ts`) is the central line scanner behind
the flat-file adapters (PAF/MashMap/Delta/Blast comparative, plaintext
GFF3/GTF/BED via `groupLinesByRef`, VCF). It tracks `blockStart` against
`buffer.length`, so it now emits a **determinate** `StatusWithProgress`
(`{ message: 'Loading', current: blockStart, total: buffer.length }`) every
10k lines instead of the old baked `Loading 1.2/3.4Mb` string. Its local
`StatusCallback` type is now the canonical `(arg: RpcStatus) => void`, so the
parse phase lights up the same determinate bar the download phase already had.
`ChainAdapter/util.ts` (a bespoke byte-loop, not using `parseLineByLine`) was
converted the same way. `getProgressDisplayStr` (bpUtils) is no longer used by
either — left in place as a public util.

## Whole-file reads: `fetchAndMaybeUnzip`

`fetchAndMaybeUnzip` (`util/index.ts`) is the central whole-file reader behind
the BigWig/BigBed/Hic/comparative/sequence adapters. It now forwards download
progress through generic-filehandle2's `readFile({ onProgress })`, so a single
wiring lights up determinate "Downloading file" bars across all of them:

```ts
const buf = await downloadStatus('Downloading file', statusCallback, onProgress =>
  loc.readFile({ ...opts, onProgress }) as Promise<Uint8Array>,
)
```

This required generic-filehandle2 **2.2.0** (`onProgress` in `FilehandleOptions`,
streams the body with byte-granularity ticks; `total` omitted when no
Content-Length). Bumped to `^2.2.0` repo-wide and added to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

## gmod libraries (published, separate repos)

- `generic-filehandle2` 2.2.0 — `FilehandleOptions.onProgress(bytesReceived, total?)`; streams body into one pre-sized buffer when Content-Length known. **Wired** through `fetchAndMaybeUnzip` (see above); `^2.2.0` repo-wide.
- `@gmod/tabix` 3.4.0 — `getLines({ onProgress(bytesDownloaded, totalBytes) })`, block granularity (cache hits tick instantly). **Not modified** — positional byte callback is the correct low-level primitive.
- `@gmod/bam` 7.3.0, `@gmod/cram` 8.3.0 — `getRecordsForRange({ onProgress })`.

## Cancel + retry (`FetchMixin`)

The loading overlay's cancel button used to be a no-op trap: `cancelFetch()`
bumps `fetchGeneration`, which `FetchVisibleRegions` watches — so cancel just
**restarted** the load ~600 ms later. There was no durable "canceled" state.

Now there are two distinct cancels on `FetchMixin`:

- `cancelFetch()` — *internal* reset (used by `clearAllRpcData` /
  `invalidateLoadedRegions`). Stops the fetch, **bumps** `fetchGeneration` to
  retrigger, and clears `fetchCanceled` (a reset must be allowed to re-fetch).
- `cancelFetchByUser()` — what the overlay's cancel button calls. Stops the
  fetch and sets the durable `fetchCanceled` volatile. **Does not bump**
  `fetchGeneration`, so nothing restarts.

`fetchCanceled` behaves like `error`/`regionTooLarge`: a blocking state.
`FetchVisibleRegions` early-returns on it (tracked); `ClearBlockingStateOnViewportChange`
clears it on viewport change (pan/zoom retries). Retry is the existing
`reload()` (universal across MultiRegion + HiC/LD/canvas). The **single clear
point** is `runFetch` start (`self.fetchCanceled = false`) — so every retrigger
path (reload, viewport, settings) un-cancels, including HiC/LD whose `reload()`
goes through `reloadCounter` rather than `cancelFetch`.

Both `displayPhase` loading thunks (MultiRegion + Global) OR in `fetchCanceled`
so the overlay stays visible (showing its **Retry** button) after `isLoading`
has gone false. `DisplayLoadingOverlay` passes `canceled`/`onCancel`
(→`cancelFetchByUser`)/`onRetry` (→`reload`); `LoadingOverlay` renders "Loading
canceled" + a refresh button in the canceled branch.

## TODO / follow-ups

- **DONE — all download adapters wired + consolidated.** bam/cram/bed/gff3/gtf/
  vcf/splitvcf use `downloadStatus`; `fetchAndMaybeUnzip` forwards
  generic-filehandle2 progress (covers bigwig/bigbed/hic/comparative/sequence).
- **DONE — cancel is durable + retryable** (see the cancel section above).
- **DONE — comparative/dialog consumers upgraded to determinate.** The synteny
  display now stores `RpcStatus` (`statusMessage` + derived `statusProgress`,
  mirroring `FetchMixin`) and passes `progress` to `LoadingOverlay`; its RPC
  forwards `statusCallback` into the adapter (it previously wrapped the fetch in
  an indeterminate `updateStatus('Loading')` that swallowed the adapter's
  determinate ticks). The wiggle-cluster and dotplot-diagonalization dialogs
  store `RpcStatus` and render a determinate `LinearProgress` when a fraction is
  present (`DiagonalizeDotplot` now forwards `statusCallback` into its feature
  fetch). `BaseDisplayModel.setStatusMessage` and the `WorkerHandle.call`
  interface now type the callback as `RpcStatus`, not `string`.
- **DONE — dotplot display fetch is determinate.** `DotplotGetFeaturesAndPositions`
  takes a `statusCallback` and forwards it into the adapter; the display
  (`DotplotDisplay`) overrides `setStatusMessage` to derive `statusProgress`
  (pairing with BaseDisplay's `statusMessage`), cleared in `setRpcData`/`setError`.
  `DisplayStatusOverlays` renders the message under the `LoadingEllipses` plus a
  determinate `LinearProgress` when a fraction is present (the first-load
  centered overlay; the corner refetch overlay shows the label only).
- **DONE — synteny diagonalize unified onto the dotplot RPC pattern.** The
  linear-comparative diagonalize previously ran `diagonalizeRegions`
  *synchronously on the main thread* (reading already-loaded `featureData`),
  diverging from the dotplot's worker RPC. It now goes through a
  `DiagonalizeSynteny` RPC that fetches each level's alignments and runs the
  shared algorithm in the worker — `runDiagonalize` is a thin wrapper (the
  `setTimeout(0)` paint hack is gone), and the dialog shows determinate progress
  + cancels via stop token. Both diagonalize RPCs now share
  `extractAlignmentData` (synteny-core: features → `AlignmentData[]`). Because
  the synteny render path uses raw (non-canonicalized) refNames, the re-fetch is
  refName-equivalent to the old loaded-`featureData` path while covering the full
  displayed regions (no more "zoom out for best results" caveat).
- **DONE — shared loading-UI helpers.** `StatusProgressBar` (`@jbrowse/core/ui`,
  determinate-vs-indeterminate `LinearProgress` from an `RpcStatus`) and
  `statusProgressLabel` (`progress.ts`, message + rounded `%`) collapse the
  duplicated inline logic across the diagonalize/clustering dialogs. Dead
  `getProgressDisplayStr` removed from `bpUtils.ts`.
- **Not wired (different context, low priority):** text-indexing
  (`packages/text-indexing`) reports byte counts as plain strings to the admin
  CLI, not the loading overlay; worker CPU sort/layout loops (synteny dedup/sort,
  `collectRenderData`) emit no per-iteration progress. Both have the data to go
  determinate via `createProgressReporter` if a context ever surfaces them.

## Tests

- `packages/core/src/util/progress.test.ts` — the pure helpers: the `RpcStatus`
  accessors (`statusMessageText` / `statusFraction` incl. the zero-total
  divide-guard and >100% clamp / `statusProgressLabel`), the phase wrappers
  (`updateStatus` / `downloadStatus` incl. the no-Content-Length indeterminate
  branch / `withProgress`'s 0%-kickoff + clear), `createProgressReporter`, and
  `aggregateStatus` (the Σcurrent/Σtotal no-clobber merge).
- `packages/core/src/util/stopToken.test.ts` — the SAB atomic path + throttle
  gates (the XHR/blob-URL fallback needs a real worker, untestable in jest).
- `plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.test.ts` —
  the fetch state machine: `cancelFetch` vs `cancelFetchByUser` (generation-bump
  vs durable `fetchCanceled`), retry clearing, abort swallowing, staleness, and
  the `setStatusMessage`/`setRegionStatus` → `statusProgress` aggregation wiring.
- `packages/core/src/ui/LoadingOverlay.test.tsx` — the overlay UI: anti-flash
  (250ms) and cancel-enable (5000ms) timer gates, determinate bar fill / clamp /
  indeterminate spinner, and the cancel/retry click → handler wiring.

## Don't

- Don't add a parallel progress channel; emit through `statusCallback`.
- Don't bake percentages into the message string.
- Don't type a status callback as `(msg: string) => void` — use `StatusCallback`
  (or `(msg: RpcStatus)` for an inline lambda) so determinate progress can flow.
