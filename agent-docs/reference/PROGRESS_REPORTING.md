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
RpcStatus = string | { message; current; total } | { message; failed: true }
```

(`packages/core/src/util/progress.ts`). A plain string is an indeterminate
phase label. The second form adds a determinate `current/total` fraction —
unit-agnostic (bytes, blocks, or records). The UI decides presentation, so
percentages are never baked into the message string.

The third is a **retire that says the phase did not finish**, written by the
`finally` of `updateStatus` / `withProgress` / `downloadStatus` and by nothing
else. Its `message` is the same string the retire carries anyway (`''`, or the
enclosing phase's label), so `statusMessageText` and `statusFraction` answer for
it exactly as they do for a bare `''` — a consumer reading the label or the
fraction needs no branch. What it buys is the credit: `aggregateStatus` charges a
completed phase its `total` and a failed one only the `current` it reached, and
the readings cannot tell those apart (ADR-087). The first aggregate it reaches
consumes it, so nothing downstream sees the shape.

Reading `current`/`total` off a status goes through `statusReading(status)`,
which is `undefined` for both a bare label and a failed retire.

There is **no** second `onProgress` channel. Emit through `statusCallback`
only.

## Flow

```
worker adapter → opts.statusCallback(status)
  → RPC drivers special-case statusCallback as out-of-band
    (message type `unknown`, so the object survives serialization)
  → the display's status callback thins the stream (its StatusWindow)
  → setStatusMessage splits it into statusMessage + statusProgress
  → DisplayLoadingOverlay draws a determinate bar + cancel, else a spinner
```

## No callback is a value, and it travels

A caller that passes no `statusCallback` is asking for no reporting, and every
layer below has a branch for it: `downloadStatus` hands the reader no
`onProgress`, `createProgressReporter` skips its emit, and `openPhase` allocates
no stack. **A no-op callback is not the same thing.** It is truthy at all three,
so it turns those branches off while looking like a tidy-up.

**It is not a speed argument, and the tree said it was in four places.** The
reader path `onProgress` selects — generic-filehandle2's `toBytesWithProgress`,
a `getReader` loop — was described as the slow one that withholding the callback
lets you skip. Measured in a Chrome worker, it is the *faster* one for every body
under ~10MB, and only ~1.1x slower past ~25MB:

<!-- BEGIN GENERATED MEASUREMENT download-read-path -->

| body   | no onProgress (`res.bytes()`) | with onProgress (getReader) | loop / plain |
| ------ | ----------------------------- | --------------------------- | ------------ |
| 256 KB | 2.7ms                         | 2.2ms                       | 0.81x        |
| 1 MB   | 5.5ms                         | 3.1ms                       | 0.56x        |
| 4 MB   | 15ms                          | 8ms                         | 0.53x        |
| 10 MB  | 33.1ms                        | 18.6ms                      | 0.56x        |
| 25 MB  | 37.7ms                        | 36.4ms                      | 0.97x        |
| 50 MB  | 66.9ms                        | 73.6ms                      | 1.10x        |
| 100 MB | 126.5ms                       | 135.7ms                     | 1.07x        |
| 200 MB | 234.2ms                       | 277.2ms                     | 1.18x        |

<!-- END GENERATED MEASUREMENT download-read-path -->

So a progress bar on a whole-file load is free or better below the crossover, and
cheap above it. What withholding the callback buys is that a caller who asked for
nothing gets nothing — the postMessage per status to a listener that drops it,
and the two drivers answering the question differently, are the real costs.

The decision was destroyed twice on the way down, so none of those branches were
reachable in a worker:

- `WebWorkerHandle.call` minted a `message-<n>` channel for every call, and
  `wrapForRpc` builds the worker's `statusCallback` out of whatever channel it is
  handed. Every method in every worker therefore ran with a live status handle,
  and every status it sent crossed a postMessage to reach a main-thread listener
  that dropped it. It now mints a channel only when there is a callback to feed,
  and `wrapForRpc` adds no key without one — which is also what
  `MainThreadRpcDriver` does, so the two drivers answer the question the same
  way.
- Thirty-one adapters and worker helpers then wrote
  `statusCallback = () => {}` in their destructuring. `no-restricted-syntax`
  rejects that now; leave the type `StatusCallback | undefined` and call it as
  `statusCallback?.(…)`.

The tell that a layer has re-manufactured one: a whole-file download whose
caller reports nothing still runs `toBytesWithProgress`.

## Helpers (`progress.ts`)

- `downloadStatus(label, cb, fn(onProgress))` wraps every download adapter:
  label + clear + a byte-reporter adapting generic-filehandle2 / tabix / bam /
  cram. `total` is optional — an unknown Content-Length means indeterminate.
  Reach for this, not `updateStatus`, whenever the reader accepts `onProgress`
  — that is what turns a spinner into a byte bar.
- `createProgressReporter` / `withProgress` for determinate worker CPU loops.
  `report()` auto-increments; the cancel-check and emit are counter-gated, so
  calling it every iteration is cheap.
- `updateStatus` for indeterminate phases.
- Both phase helpers **nest**: an inner phase restores its caller's label rather
  than blanking it, and `''` still closes the outermost. They used to not, and
  the rule was "run phases in sequence, or give the inner one no
  `statusCallback`" — a rule about code two files from the call site
  (`cachedSetup` wrapping a `setup` that reaches `fetchAndMaybeUnzip`), so a rule
  waiting to be broken. Two phases sharing one callback concurrently is fine
  too; each retires its own entry, so the one still running keeps the channel.
- `statusMessageText` / `statusFraction` / `statusProgressLabel` extract the
  parts back out.
- `createStatusFanOut(cb)` merges concurrent statuses into one bar: each
  `slot()` is a `StatusCallback` remembering its own value and how much of each
  phase it has finished, and every write re-derives the shared status from all
  slots. Hand a slot to each of N concurrent operations sharing one status
  field. The arithmetic is `aggregateStatus`, which is internal to the module —
  ADR-072 for what it sums and ADR-080 for how the phase is picked.

`parseLineByLine` (flat-file adapters, `label` + `stopToken` opts) and
`fetchAndMaybeUnzip` (bigwig/bigbed/hic/sequence) forward determinate progress
through these.

## Where a status lands: two fields, or one channel

A display declares `statusMessage` / `statusProgress` / `setStatusMessage`
itself, because half the display API reads them and ADR-041 is why `BaseDisplay`
and `FetchMixin` keep their own copies rather than sharing a mixin.

Anything else — a *view* with one operation to narrate — holds a
`createStatusChannel()` in one volatile instead. It is the same
`statusMessageText` / `statusFraction` split done once, behind
`{ message, fraction }`, and it is a plain function rather than a mixin for the
reason ADR-041 gives. `createStopTokenRotation(self, report)` takes the reporter
as an argument for exactly this: where the status lands is the caller's
decision, not a shape the rotation imposes. A display passes itself; the
breakpoint split view passes `self.fetchStatus`.

`ProgressChip` takes the pair as one `status` object, whose field names are the
channel's, so a channel holder passes `status={model.fetchStatus}` and nothing
restates the pair.

## The assembly load has its own status field

The channel above is per-*display*, and it only opens once tracks are fetching.
Everything before that — the wait a fresh LGV, dotplot or synteny view spends on
a spinner — is `assembly.loadPre`, which fetches four independent files at once
(sequence index, chromAlias, cytoband, genetic-code sidecar). That ran with a
bare `{}` for opts, so every adapter's own "Downloading …" reporting was
discarded and the view showed the hardcoded word "Loading" for the whole slow
part of startup.

`loadPre` now runs on the same transport: one `createStatusFanOut` slot per
file (they are concurrent, so last-writer-wins would blank the label the moment
the fastest of the four finished), every slot behind one sink off the load's own
`StatusWindow`, writing `assembly.statusMessage` /
`assembly.statusProgress` — the same split as `BaseDisplayModel`, so
`LoadingProgress` renders both.

The guard is what the four-at-once shape needs and a single fetch does not:
`Promise.all` rejects on the FIRST of them to fail, and the other three go on
downloading and go on reporting. Unguarded, their progress repaints the field
`loadPre`'s `finally` has already cleared, so a failed assembly load sits under
a live "Downloading cytobands 40%". The `finally` closes the guard and then
clears through `throttle.runNow`, for the reason every phase's `''` does.

Views read it through `assemblyManager.loadingAssembly(names)` — the first name
that isn't `initialized` — and expose `loadingMessage` / `loadingProgress`, which
`ViewLoadingScreen` renders. All five views that spin on an assembly do this:
LGV, dotplot, linear synteny, circular and breakpoint-split. Circular and
breakpoint-split were the two that didn't, and showed a bare `LoadingEllipses`
with no label and no bar for the same wait the other three narrated.

**Both getters read `loadingAssembly` behind the `showLoading` ternary, and that
laziness is load-bearing** — same rule as `displayPhase`'s loading thunk. Resolve
it eagerly (say, by passing it to a shared helper) and every view asks the
assembly manager on every read, including the reads where nothing is loading.
Folding these two into a helper was tried and backed out for it: with a thunk
the call is no shorter than the ternary, and without one `CircularView.test.tsx`
fails on an `assemblyManager` stub that never needed the method.

Which names to ask about is the only per-view part, and it is the same shape
each time: `init` names the assemblies before the view has materialized the
thing `assemblyNames` derives from, so it is the source until then. LGV spells
this as `initAssembly` (pre-navigation the assembly `init` names isn't in
`assemblyNames` yet); circular reads `init.assembly`; dotplot and synteny map
`init.views`; breakpoint-split delegates to the first sub-view that hasn't
initialized, since each LGV already resolves its own, and falls back to `init`
before the sub-views exist.

`ViewLoadingScreen` exists because a bare `LoadingProgress` renders an
unconstrained full-width bar under an unaligned label — every other caller wraps
it in a centered flex container and sets `barClassName`. Its metrics deliberately
match `DiagonalizeLoadingScreen`, the sibling render branch in both comparative
views, so a view can't jump between two differently laid-out loading screens.

These adapters run on the **main thread** (`assemblyAdapters.ts` instantiates
them directly, no RPC hop), so `statusCallback` is a plain function call. It is
still the `statusCallback` off `BaseOptions`, so nothing downstream is special
cased.

Labels name **the data, not the file** — the house convention, set by
`Downloading alignments` (which a BAM says, rather than naming the BAM or its
index). One consequence worth knowing before you add a row: chrom.sizes, the
`.fai` and the 2bit header are three sources for one answer — the assembly's
chromosomes and their lengths — so all three say the same thing. A user should
not have to know which their assembly happens to use, and only one is ever in
play at a time.

| data | source | label | bar? |
| --- | --- | --- | --- |
| chromosome list | chrom.sizes (ChromSizes, TwoBit sidecar) | `Downloading chromosome sizes` | bytes |
| chromosome list | `.fai` | `Downloading chromosome sizes` | no |
| chromosome list | 2bit header/index | `Downloading chromosome sizes` | no |
| aliases | chromAlias | `Downloading chromosome aliases` | bytes |
| cytobands | cytoband | `Downloading cytobands` | bytes |
| genetic codes | sidecar TSV | `Downloading genetic codes` | bytes |
| sequence | unindexed FASTA | `Downloading sequence` | bytes |

The determinate ones are the whole-file text reads. They got there by moving off
`readFile('utf8')`, whose remote path is `res.text()` and can't report bytes, to
`fetchAndMaybeUnzipText` — which also means those files may now be gzipped.
`fetchAndMaybeUnzip` takes an optional `label` for exactly this: several files
loading at once behind one indicator, where its default "Downloading file" can't
say which. The two indeterminate rows are readers (`@gmod/indexedfasta`,
`@gmod/twobit`) that expose no byte callback; they get an `updateStatus` phase
label instead.

Still bare: jbrowse-web's pre-`pluginManager` full-page spinner
(`products/jbrowse-web/src/components/Loading.tsx`), which covers config fetch →
plugin load → session load and has no phase reporting of its own.

## Shared setup reports to whoever is waiting

An adapter that parses a whole file caches the work in one promise. Memoizing
it by hand captures the *first* caller's `opts`, so its `statusCallback` is the
only one the parse ever reaches: once that fetch is superseded (its callback
gated off by the display's latest-wins guard) the fetch replacing it awaits the
same promise in silence, behind a blank overlay. `createSharedSetup(run)`
(`packages/core/src/util/createSharedSetup.ts`) fans progress out to the live
waiter set instead, and clears the memo on failure so the next caller retries.

It deliberately drops `stopToken`: the work is shared, so honoring one caller's
cancel would abort a parse the caller replacing it is already waiting on, and
reject them both. Cancellation belongs to per-call work (indexed range
queries), which nobody else is waiting on.

## Concurrent fetches share one field — aggregate, don't clobber

A fetch generation can fan out into N parallel per-region RPCs that all write
the same field. There is one answer on both sides of the RPC boundary:
**`createStatusFanOut`, a slot per operation**, re-deriving the shared value
from every slot on every write. N downloads then read as one honest bar instead
of last-writer thrash.

**The same answer one level up**, for the concurrent *operations* that share one
owner's field rather than the regions of one fetch: the window aggregates too
(ADR-081), so a display's viewport fetch, a lent `createStopTokenRotation` and a
clustering run each take a slot and none of them can end another's label. Which
one holds the label is ADR-072's rule unchanged — only a phase's own slots are
summable, so the phase the owner reached first wins and the rest are charged
below it.

On the main thread nobody calls it directly, because the fan-out helpers own it:
`callEachRegion` — and `fetchEachRegion` through it — hands each region a copy of
the `FetchContext` whose `statusCallback` is that region's slot. So a display
writes `statusCallback: ctx.statusCallback` and is correct in both cases: a
per-region slot in a fan-out, the whole fetch's channel in a batched call. It is
the same field name either way, deliberately — there is no per-display variant to
pick, and no index to remember.

Inside the worker, and in the main-thread paths that fan out by hand, reach for
`createStatusFanOut` yourself: `BaseFeatureDataAdapter`'s multi-region `merge`, a
`Promise.all` over sidecar files, MAF's two concurrent branches — which is the
last main-thread one, the canvas basic display's own `Promise.all` having gone
back to `fetchEachRegion`. The tell that it is missing: the first operation to
finish writes the `''` that every phase helper clears with, and the label blanks
while the rest are still running.

This replaced a second implementation on the model —
`regionStatuses` + `setRegionStatus` + `makeRegionStatusCallback`, a volatile Map
keyed by `displayedRegionIndex`. Two implementations of one idea disagreed about
what retires an entry: the closure retired on `''` and the model retired on
`undefined`, which nothing ever sent. Every *finished* region therefore stayed in
the aggregate, charged a share of the total, and the bar ran backwards as regions
completed.

## The stream is throttled on the callback, never on the write

An adapter emits progress ~40/s and each observable write repaints the overlay
(and repositions its MUI Popper) — measured outpacing the view's own animation.
`createStatusWindow(write)` (`@jbrowse/core/util`) is the one window (100ms), leading
**and trailing**: the last write of a burst is the one that matters most and is
exactly the one a leading-edge-only gate drops, which froze a determinate bar at
whatever percentage happened to land on a boundary. Because a trailing write
fires on a timer, its guard has to be re-read inside the throttled body — which
is what `window.open({isCurrent})` does, and why nothing else builds a status
callback by hand.

**One per owner**, and the streams come off the window rather than taking one as
an argument, so N parallel region fetches thin to one flow between them rather
than N. That used to be a paragraph asking callers not to pass a fresh throttle
per callback; a per-callback window now has no spelling short of
`createStatusWindow(write).open(…)`.

`open` returns `{statusCallback, clear}` together, because a stream nobody
closes is the failure mode the rest of this design rests on not happening: a
fan-out cannot see the end of a batch and no longer guesses at one (ADR-080), so
**an operation retiring its own slot when its work ends is what ends the
stream**. Call `clear()` in the `finally` of the operation; it blanks the field
only when no other operation is still reporting (ADR-081), so a superseded run
calls it too and must.

`createStatusWindow(write)` takes the field's single writer at creation, so
whatever guards it — `isAlive(self)`, a React `alive` flag — guards every status
and every clear by construction rather than by a copy of the check at each
`finally`. The window reopens itself when the field goes idle, which is what
retiring the last slot does; `window.reset()` is for teardown, where the trailing
timer outlives everything that could make it a no-op. The owners, so progress
cadence is uniform whichever path a status took:

- `createStopTokenRotation` — every fetch with a latest-wins guard: the LGV
  displays through `FetchMixin.runFetch`, which wraps one and lends it the
  display's window, and the bare-autorun fetches (dotplot, synteny,
  multi-sample-variant sources, breakpoint split view's overlay features) which
  hold one directly
- `withDiagonalizeProgress` and `DiagonalizeDialog` — the diagonalize RPC,
  which drives a spinner and a dialog rather than a display's status fields
- `useFetch` — every dialog and widget fetch, one window per effect run
- `assembly.loadPre` — the four concurrent startup files (see above)
- `useMateDiscovery` — the synteny launch dialog's mate discovery
- `useClusterRun` — a "Run clustering" dialog, one window per run

The operations that take a *slot* on a display's window, rather than opening one
of their own: `runFetch` (the viewport fetch, one per fetch),
`setupRunClusteringAutorun` (one per run), and a `createStopTokenRotation` the
display lent its window to. All three used to blank the field when they finished
— see ADR-081 for what that did to the other two.

They are listed rather than counted for the reason
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) states at "ordering is the
contract": this said "Three owners" while the last two were already here.

Two rules the shape enforces:

- **`setStatusMessage` itself is never throttled.** A display writing a phase
  label by hand ("Downloading" → "Parsing") is a sequence of distinct labels, and
  a trailing edge only guarantees the *last* of a burst, not each one in turn.
- **The `''` a phase helper closes with IS throttled — the operation's `clear`
  is not.** They are easy to conflate and ADR-071 turns on the difference. The
  `''` goes through the stream like every other status, so a phase that opens and
  closes inside one window paints nothing; it still displaces the percentage
  queued behind it, because the window holds one pending write, so a finished
  phase's progress can never come back. A `''` never *reaches* the field, either:
  the window writes what its slots add up to, and an idle aggregate writes the
  last label alone. `clear()` is the other thing: the operation's last word, which
  has to *land* when it is the last one — nothing is coming to displace it — and
  which reopens the window for whatever starts after the lull.

- **Hold the last determinate reading only where the slots are raw reporters.**
  `createStatusFanOut` does; `createStatusWindow` does not. A slot fed by another
  aggregate has already had ADR-080's hold applied to it, and re-applying it puts
  back a percentage the child retired — which is the write ADR-071 exists to
  cancel. The shared `createStatusAggregate` takes it as a flag so the arithmetic
  has one copy.

## A silent `rpcManager.call` is a lint error, not a judgement call

`RpcHandles` is optional on `RpcCallArgs` and has to stay optional — a
plugin-facing argument may be added optional and never made required
([PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md)) — so the compiler cannot
ask for these. Two `no-restricted-syntax` selectors in `eslint.config.mjs` do
instead: an `rpcManager.call` whose payload is an object literal declaring no
`statusCallback`, and the same for `stopToken`.

Plenty of calls should report nothing, and the rule is not an argument that they
should. It makes that a **stated** decision: disable the line and say why. Grep
the disables for what the accepted reasons look like; they fall into three kinds

- the work is already narrated by the fetch it shares
  (`detectSwappedAssemblies`, whose `getRefNames` awaits the same
  `createSharedSetup` parse the band fetch is reporting),
- there is nothing to narrate and nothing a cancel could save (the memoized
  `CoreGetMetadata` header reads behind a feature widget),
- or the handles belong on an **interface** that does not declare them yet, in
  which case the disable names a `TODO.md` entry rather than a reason — that is
  the section below, and it is the kind worth fixing.

A spread payload is accepted as forwarding: the rule cannot see inside one, and
the call sites that use it are wrappers handing on a `BaseOptions`-shaped bag
that declares both. Source only — a test builds its RPC args freely.

## A fetcher that declares no parameters is opted out, silently

`useFetch` hands its fetcher the key elements and then a **stop token and a
status callback**, positionally. TypeScript accepts a function that declares
fewer parameters, so `() => rpcManager.call(...)` is assignable and simply never
sees either one — no error, and the only symptom is a bare spinner over an
uninterruptible read. That is the intended default for the many fetchers that
are a local lookup; it is a trap for the ones that are an RPC.

Two rules, both from the cluster dialog, where one tab reported a determinate bar
with a Stop and the other a bare spinner with no cancel — for the same fetch:

- **Declare the argument in the contract a display fills in.**
  `ClusterDialogProps.fetchMatrix` takes `{ stopToken, statusCallback }` exactly
  as its sibling `run` does. Both plugins had complied with the signature that
  dropped them, so neither was wrong; the interface was.
- **A variable-length `useFetch` key makes the trailing arguments unnameable.**
  Spread as `[...matrixKey, regionKey]`, the fetcher's parameter list is
  `(...args)` and the two handles have no name to destructure. Nest the caller's
  key pieces (`['clusterMatrix', [...]]`) so the arity is fixed — `useFetch`
  serializes the whole key, so nesting caches identically.

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

**The comparative displays do this differently and deliberately** — they are not
on `FetchMixin` (ADR-054) and their cancel is durable until Retry with no
clear-on-viewport-change, so there is no internal twin at all. The one thing
that does not carry over is that a flag is not a cancel there: the stop-token
rotation lives in the autorun's closure, so `SyntenyFetchStateMixin` is handed
`cancel` at install. See
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md).

## Not yet wired (deferred, low priority)

Worker sort/layout loops emit no per-iteration progress. They could go
determinate via `createProgressReporter` if a context ever surfaced them.

Desktop text-indexing is wired: `indexDriver` reports
`{message, current, total}` across the tracks of one job, `indexJobsModel`
splits that into the job card's message and bar, and the `'end'` of the record
stream hands over to a plain `'Sorting and writing index'` — the ixIxx tail is
unmeasured, so the bar goes indeterminate rather than sitting at 100%.

That chain is covered a hop at a time, which is worth knowing because the hop
nobody covered is the one that kept breaking: `indexJobsModel.test.ts` takes the
worker's byte counts to a `progressPct`, `CurrentJobCard.test.tsx` takes a
`progressPct` to a drawn bar and a percent, and
`jbrowse-web/browser-tests/suites/jobs-list-progress.ts` draws it in a real
browser, where the `color-mix()` track and the indeterminate keyframe sweep exist
at all. The card's determinate branch was repaired three times before anything
rendered it.

`PAFAdapter.getFeatures` still linear-scans every record per region query
(`AllVsAllPAFAdapter` builds a `sidesByContig` index for this); that is a
performance gap, not a reporting one, but it is what makes the unreported
stretches long enough to notice.
