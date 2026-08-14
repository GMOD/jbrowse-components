---
name: architectural-limits
description: Live register of the architecture's resource ceilings, accepted couplings, and correctness surfaces nothing mechanical protects. Each entry carries its mitigation state and the condition that retires it. Read before scaling work (many tracks, many views, whole-genome), or when a symptom looks like a product bug but is a ceiling.
---

# Architectural limits and weak points

A **live register**, not a review snapshot. `ARCHITECTURE.md` says how the system
works. This says where it stops working, and why we decided that was acceptable.

Keeping it honest:

- **Cite symbols and files, not line numbers.** Line numbers rot faster than
  limits do.
- **Delete an entry when its retire condition is met.** If the story shaped a
  design, move a paragraph to [HISTORICAL.md](HISTORICAL.md). Never leave a
  "fixed" entry here.
- **Statuses:** `Mitigated` (a mechanism bounds it, root cause remains),
  `Accepted` (a cost we chose, with the reason), `Open` (unbuilt, and we would
  take a fix).
- **Not a backlog.** An entry earns its place by being something you can trip
  over without knowing it exists. Work items go in [../TODO.md](../TODO.md).
- **New entries must be measured or code-verifiable.** Cite the mechanism, not
  the symptom.

---

## GPU / rendering

### One WebGL2 context per display canvas

**Status:** Mitigated (view-level), root cause is WebGL2 itself.

**Budget contexts as one per open GPU track.** One display owns one backend
canvas and `WebGL2Hal` takes its own context with no pooling, so the count to
watch is open GPU tracks. **The ceiling is 16** (Chrome 151, measured
2026-08-05); past it, eviction and re-acquisition cascade and wedge the main
thread rather than degrading. **A single ordinary view reaches it** — 17 GPU
tracks on one LGV, nothing synthetic. That retires the older reading of this
entry, which bracketed the cascade "between 20 and 72" from a 24-view harness
and called the realistic shape unmeasured.

[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) owns this subject and is the
only place the numbers should be edited: the ceiling table on both drivers, the
software-vs-hardware cost crossover, the harness, and the four fixes already
measured and eliminated.

Chromosomes are free: a whole-genome view of one track is still one canvas, with
one GPU buffer per `displayedRegionIndex` and one scissored draw per render
block. **This ceiling is a primary motivation for targeting WebGPU**, which
shares one device across displays (next entry) and so has no per-canvas cap.
(Free *here*, on the canvas and buffer axis this entry is about. The view's own
block and coordinate math is linear in the region count and is not — see
["The region walk is linear"](#the-region-walk-is-linear-and-costs-two-different-ways-at-the-two-ends-of-the-zoom).)

Mitigations in place, both bounding rather than fixing:

- **View-level lazy mount** (`packages/app-core/src/ui/App/useViewVisibility.ts`)
  gates whether a view mounts its GPU subtree, falling back to always-visible
  where IntersectionObserver is absent (jsdom/SSR). Took the 72-canvas case to 6.
  It buys that by rebuilding the pipeline every time a view scrolls back into
  view, converting the cap into a per-scroll cost — cheap on a real GPU, ~10x
  that under software rendering. It is not a free win, and it bounds nothing
  across a multi-panel workspace, where every panel is on screen at once.
- **Bounded auto-recovery** in `useRenderingBackend`: at most
  `MAX_CONTEXT_RECOVER_ATTEMPTS` re-inits on backoff, and the budget resets only
  on a genuine `webglcontextrestored` or a manual retry, so a flapping context
  climbs to the cap and stops rather than spinning.

Still exposed: tracks inside a mounted view are not virtualized, so one LGV with
17 GPU tracks allocates 17 contexts and crosses the ceiling.

**Retire when** WebGL2 retires (RFC-001 §13a) or track-level mount/release lands.
The measurement that used to gate both is done — the ceiling above — and it says
track-level mount/release is worth building. The other unbuilt interim moves are
dropping a display to Canvas2D after K context losses, so the failure is one slow
track rather than a wedged page, and picking Canvas2D up front when the renderer
string says software.

### WebGPU shares one device across every display

**Status:** Accepted.

`packages/render-core/src/gpuDevice.ts` holds a module-level singleton device.
That is what removes the per-canvas cap above; the trade is its mirror image. A
single `device.lost` takes down every display at once, and per-device limits
(`maxBufferSize`, `maxTextureDimension2D`) are one shared budget rather than a
per-track one.

Useful for triage: the backends fail in **opposite** directions, so "one track
broke" points at WebGL2 and "every track broke at once" points at WebGPU. Both
route through `OomReporter` to `renderError`, so the user gets a
zoom-in-or-reduce-height message rather than a blank canvas.

**Retire when** never. Document, don't fix.

### No session-level GPU memory budget

**Status:** Accepted (deferred).

Limit checks are per buffer and per texture, and each display prunes to its
active regions via `hal.pruneRegions(active)`. Nothing sums uploaded bytes
**across** displays, so total GPU memory is bounded only by every display
independently behaving. ADR-035 closed the neighbouring question (`maxHeight`
bounds pixels, not GPU instance count). So OOM is reportable, not preventable,
which is acceptable while the per-object guards keep catching the pathological
single upload.

**Retire when** a HAL byte counter with cross-display LRU prune exists, or an OOM
report arrives that the per-object guards missed.

### A canvas past `MAX_CANVAS_DIM_PX` renders wrong, not smaller

**Status:** Mitigated (per-display sizing), root cause is the unthreaded dpr.

`backingPx` (`packages/render-core/src/canvas2dUtils.ts`) caps a backing store at
`MAX_CANVAS_DIM_PX` (8192 physical px per axis) so an oversized canvas can't
throw `InvalidStateError`. But the cap applies only at the canvas: every
downstream rect is still derived as `cssPx * getDpr()` from the **true** dpr
(`clipBlock`, alignments' `computeBlockGeom`, the per-region base's `pxH`). Past
the cap the browser stretches the smaller backing store over the larger element
*and* the scissor/viewport rects can exceed it, where WebGL2 clamps silently and
WebGPU rejects the rect and blanks the frame. The one-shot `console.warn` reads
like a cosmetic notice.

Mitigated rather than Open because it is unreachable today: canvases are
viewport-sized everywhere except MAF's rows canvas, which sizes to content and
self-bounds via `maxRowsHeight` (`MAX_CANVAS_DIM_PX / getDpr()`). **Any new
display that sizes a canvas to content rather than viewport must copy that
bound**, because nothing mechanical enforces it.

**Retire when** `syncCanvasSize` / `prepareCanvas` report the ratio they actually
used and that effective dpr is threaded through `clipBlock` instead of the free
`getDpr()`, so a clamped canvas renders correct content at reduced resolution.

**The dpr cap is what makes it this hard to reach.** `getDpr()` returns
`min(devicePixelRatio, MAX_DPR)` with `MAX_DPR = 2`, so an axis has to reach 4096
CSS px to clamp, not 2731 as it would at dpr=3. Retina is the target and is
unaffected; the cap only bites above it, where cost scales with dpr² for a
difference essentially nobody resolves. Capping *inside* `getDpr` is what keeps
it safe — every consumer reads the same capped number, so the backing store, the
rects derived from it, and the variant-matrix shader's `devicePixelRatio` uniform
cannot disagree. **A call site that reads the global `devicePixelRatio` directly
re-opens exactly that split**, which is why the one that did
(`GpuVariantMatrixRenderer`) was routed through `getDpr`. Two places diverge on
purpose and say so: `createSvgRasterCanvas` pins 2x because export goes to a file
rather than a screen, and the analytics / error-report paths read the raw global
because they are reporting the device, not drawing on it.

### A region arrival draws twice wherever the render autorun observes the data

**Status:** Accepted, and as of 2026-07-25 measured rather than assumed. Removing
the redundant draws changes nothing a user can perceive.

**Never rely on the upload autorun running before the render autorun.** Both can
observe the same arrival — upload through the key set, render through any read
that reaches `rpcDataMap` — and MobX notifies in observer order, not creation
order. A render autorun that observes the map therefore paints the pre-upload
state on each arrival, and the `renderTick` bump paints the real one. Both draws
land in one task, so the browser composites only the second; the cost is a wasted
GPU submit per arrival, not a visible flash.

**What matters is the render autorun's dependency set, not any one syntactic
read.** A direct `rpcDataMap` read in the callback does it, and so does a
computed chain the callback reaches through `renderState`.
`installPerRegionLifecycle.test.ts` pins the direct form: 4 arrivals in separate
actions give 4 uploads and, counting the one render at attach before any data,
**5** renders when the callback ignores the map (the per-key `renderNow()` and
the upload autorun's `renderNow()` land in one reaction batch and coalesce)
against **9** when it reads it.

Three code paths have such a dependency, so the double draw is not confined to
one display:

- **`LinearAlignmentsDisplay`** reads the map directly (`rpcDataMap.size === 0`,
  for the zero-group grouped-fetch reason in [HISTORICAL.md](HISTORICAL.md)
  §"Each display asserted its own 'did we paint?'") **and** transitively:
  `renderState.sections` is `buildSectionRenders(self.sections, …)`, and
  `sections` reads `groupOrder` / `groupLaidOutMap`, both derived from
  `rpcDataMap`. Deleting the gate would leave the second path in place, so it
  would not stop the double draw. Band geometry has to follow the laid-out data,
  making that path structural. `model.coupling.test.ts` §"a region arrival
  invalidates renderState, not just the size gate" pins it.
- **`LinearManhattanDisplay`** passes `self.rpcDataMap` into `renderBlocks`,
  where the renderer `.get()`s per block inside the render autorun.
- **The wiggle family** through `renderState` → `domain` → `visibleScoreStats` →
  `visibleEntries` (`WiggleCommonMixin`), which reads `rpcDataMap.size` and
  `.get()`.

Two things that already coalesce correctly, so don't "fix" them:

- **Settings fan-out.** One encoder-input change with 4 regions loaded fires all
  4 per-key autoruns and yields exactly **1** render: the per-key `renderNow()`
  bumps land while the render reaction is already scheduled, and MobX dedupes.
- **Pan and zoom.** Wheel, drag and side-scroll batch their MST writes into one
  `requestAnimationFrame` (`useWheelScroll`, `usePointerDrag`, `useRafCommit`),
  so a gesture commits at most once per frame.

**Deferring the `renderTick` bump does not help, and the arrival draw is the
stale one.** The obvious-looking fix is a `renderSoon()` (dirty flag flushed on
rAF) replacing the `renderNow()` in `installPerRegionLifecycle`. It cannot work:
the render autorun is scheduled by the `rpcDataMap` write itself, and it runs
*before* the upload autorun, so deferring the tick defers only the correct,
post-upload draw and leaves the pre-upload one as the single draw in that frame.
Measured with a prototype host whose `renderNow` was frame-coalesced: 4 arrivals
gave 9 renders, exactly the un-deferred count.

**A scheduler on the render autorun works, and buys nothing in the app.**
`autorun(fn, { scheduler })` does coalesce every case. A/B on
`tcga/cohort_cnv_genome` (24 whole-genome regions into
`LinearMultiRowFeatureDisplay`), headed on a real GPU, 3 runs, median:

| arm | draws | to ready | frames >50ms | worst frame | long tasks |
| --- | --- | --- | --- | --- | --- |
| baseline | 72 | 11.9s | 22 | 176ms | 1.3s |
| rAF | 25 | 11.3s | 19 | 176ms | 1.4s |
| microtask | 26 | 11.2s | 18 | 176ms | 1.3s |
| `setTimeout(0)` | 25 | 11.7s | 18 | 174ms | 1.4s |

Note 24 regions cost **72** draws, not the 48 the double-draw alone predicts, so
there is more redundancy here than this entry describes. Removing two thirds of
it still moves nothing: every column is inside baseline run-to-run spread
(11.1s to 12.7s to-ready). The draws are not on the critical path. Fetch, parse
and clustering are, and the long tasks are JS. A microtask scheduler scores the
same as rAF, which says most of the redundancy is same-task.

Three costs, for whoever revisits this:

- **rAF makes painting depend on frame delivery.** In one headless run the rAF
  arm recorded **zero** draws and never became ready inside 900s, because a
  backgrounded tab gets no frames (the harness needed `page.bringToFront()`).
  Synchronous rendering has no such dependency. A microtask or timeout scheduler
  avoids it.
- **The test contract.** Forcing a scheduler on across render-core, wiggle,
  canvas, gwas and maf fails **11 tests in 3 files** (`RenderLifecycleMixin.test.ts`,
  `installPerRegionLifecycle.test.ts`,
  `plugins/canvas/.../renderLifecycleGate.test.ts`), all asserting a synchronous
  draw. Smaller than feared, but they would need an explicit flush helper, and
  anything on jest fake timers stalls because rAF is mocked.
- **Software raster is the one place it pays, and is not the app.** The same A/B
  under SwiftShader went from 208.7s to 43.2s. That is the figure pipeline, not a
  user, and its real answer is the `--angle-gl` flag already on
  `website/scripts/profile-spec.ts` (background in
  [SCREENSHOT_PERF.md](SCREENSHOT_PERF.md)).

**Don't chase this per display.** Removing one display's read is not a fix: the
dependency is legitimate wherever render geometry derives from fetched data
(alignments' stacked bands, wiggle's autoscale domain), and eliminating it means
either duplicating the derivation outside MobX or pushing a data-arrival concept
down into backends whose contract is "did a draw call run". Both cost more than
one wasted submit per arrival.

**Retire when** a profile shows GPU submits on the critical path of a real
interaction, which the numbers above say they are not today. The mechanism is
settled if that ever happens: a microtask (not rAF) scheduler on the render
autorun, with the synchronous contract those three test files assert re-expressed
as an explicit flush. Re-measure first, on hardware GL, and treat any change that
only helps SwiftShader as a figure-pipeline change rather than an app one.

---

## Fetch / RPC

### Worker assignment is sticky per adapter, so one track's parse is single-threaded

**Status:** Accepted.

**The pool spreads tracks, not a track's regions.**
`WorkerPoolRpcDriver.getWorker(sessionId)` assigns one sticky worker per session
id, and a track's session id is `adapterConfigCacheKey(adapter)`
(`BaseTrackModel.rpcSessionId`) — deliberate, since it is what lets a track's
calls share one cached adapter instance. Pool size is
`clamp(hardwareConcurrency - 1, 1, 5)`.

So N per-region calls for one track all land on one worker. They interleave at
`await` points, so network latency overlaps (this is why per-region fan-out beats
batching, ADR-022), but CPU parse serializes: a single dense BAM or PAF track
cannot use more than one core however idle the pool is. Matters most where parse
dominates (synteny PIF, [SYNTENY_LOD.md](SYNTENY_LOD.md)).

**Retire when** never as a design. Revisit the bound only on a profile showing
parse-serialization dominating; the lever is then an opt-in region-shard suffix
on `rpcSessionId` for stateless parses, trading duplicated adapter caches for
cores.

### No fetch prioritization or back-pressure

**Status:** Open.

`FetchVisibleRegions` requests `bufferedVisibleRegions` (wider than visible, for
smooth scrolling) and nothing orders the resulting calls, so visible does not
outrank buffered and near does not outrank far. Ten tracks on a whole-genome open
dispatch hundreds of concurrent RPCs against at most five workers and six
connections per host, and the region the user is looking at is no likelier to
resolve first than one off-screen. Cancellation is per-display (stop-token
rotation in `FetchMixin`), not a scheduler.

**The other axis is volume, and nothing bounds that either.** `fetchSizeLimit`
defaults to 5 MB on `BamAdapter`, and every gate — bytes and density both — is
per display, per region. So the gate's promise is true of one track and there is
no second number: twenty alignments tracks each individually under the limit is
100 MB per viewport move, requested at once, with nothing in the session that
knows the total. This is the same missing object as the ordering, which is why
it is one entry: a priority queue is where both land, ordering as its comparator
and volume as the max-in-flight cap it has to have anyway.

**Retire when** a session-level priority queue with a max-in-flight cap lands, or
`fetchRegions` at least sorts `needed` by distance from viewport center.

### A failed fetch is not retried automatically, and will not be

**Status:** Accepted. Proposed 2026-08-14 and declined the same day.

`RemoteFileWithRangeCache.fetchRange` throws on the first non-2xx, and nothing
anywhere retries it — not this class, not `generic-filehandle2`, not an adapter.
One alignments viewport is hundreds of range requests against a CDN, so a single
transient 5xx, 429 or connection reset fails the whole track.

Automatic retry with backoff was proposed for exactly that and **declined: the
client does not re-issue a request the user did not ask for.** The recovery is a
legible error plus the Retry button the display error chrome already carries
(`DisplayErrorBar` → `model.reload()`, [DISPLAYCHROME.md](DISPLAYCHROME.md)
§"The retry contract"). A retry that fires on its own hides the failure it is
recovering from — a server rate-limiting the page, a CORS header nobody noticed
was missing, a file half-uploaded — behind a delay, and the person who could
have fixed it never learns it happened.

That puts the whole weight on the message, and that is where the work went
instead. Both halves of it have landed in `RemoteFileWithRangeCache`:

- **A network-level rejection is rewritten.** A CORS denial, a mixed-content
  block, a DNS failure and an offline browser all reject `fetch` with the same
  bare `TypeError`, and it now becomes the URL, the byte range, and the triage —
  offline and mixed content where the page can tell them apart, otherwise the
  two CORS headers to add. The other messages the class throws carry the same
  treatment: the 416, the "server ignored the Range header" hint, 401/403 at the
  credential, 404 at the index beside the data file, `stat`'s CORS error naming
  `Access-Control-Expose-Headers: Content-Range`.
- **A stalled connection becomes an error at all.** It used to produce none
  ever, and every readiness signal downstream was *correct* to keep waiting,
  because a fetch really was in flight — so the user got a spinner that never
  resolved and no Retry to press, since the chrome raises one from an error and
  there was none. `RESPONSE_TIMEOUT_MS` bounds the wait for a **response**, not
  for the bytes: it is cleared when the headers arrive, so a 6.5 MiB coalesced
  read over a slow link is never cut off mid-download. It sits on the shared
  request inside the chunk de-duplication and composes with the caller's signal
  rather than replacing it, or cancellation would stop reaching the socket.

**Retire when** never. Document, don't fix — and if it comes up again, the
question to ask first is whether the error the user saw told them what to do,
because that is the thing retry was standing in for.

### Per-JS-context scoping multiplies by the RPC pool

**Status:** Open. Measured 2026-08-12, `browser-tests/percontext-probe.ts`.

Three read-path resources are scoped per JS context, and adapters are sticky per
track to one of `clamp(hardwareConcurrency - 1, 1, 5)` RPC workers — so each
multiplies by however many workers a session spreads its tracks over. On a
production build, 16 cores, N alignments tracks with distinct adapter configs
whose reads carry no MD tag:

| tracks | RPC workers | bgzf pool workers | reference fetches |
| ------ | ----------- | ----------------- | ----------------- |
| 1      | 1           | 4                 | 1                 |
| 5      | 5           | 20                | 5                 |
| 8      | 5           | 20                | 5                 |

Eight tracks give five of each, not eight, so both track the context count
rather than the track count — the caches work, their scope is the problem.

- **The inflate pool.** 20 workers, each with its own copy of the inlined wasm
  bundle and so its own grow-only `WebAssembly.Memory` — the memory
  REJECTED_IDEAS.md names behind the transient RPC-worker peaks. They used to
  outlive the last bgzip track; as of `@gmod/bgzf-filehandle` 6.6.0 a pool
  reaps its own workers after 3 minutes idle and respawns them on demand, so
  the RESTING level is reclaimed. The peak while someone is actively browsing
  is not, and is still unmeasured.
- **`RemoteFileWithRangeCache`.** Its chunk `Map` is module-global, so the same
  reference sequence is downloaded once per worker for tracks sharing an
  assembly and a viewport. Nothing above it dedupes — there is no session-level
  sequence cache, and each alignments adapter builds its own sequence
  sub-adapter inside its own worker.
- **`SharedBudget`** (ADR-064) is the one that should stay per context: a worker
  OOMs on its own heap. Threads and the network are machine-wide and are being
  bounded from inside a context that cannot see the others.

`@gmod/bgzf-filehandle` ships `BgzfWorkerPoolHost` / `BgzfWorkerPoolClient` for
the pool half, naming JBrowse's data workers as the case; neither symbol appears
in this repo.

**The thread count is not what makes this worth fixing** — that was the original
framing and it was measured out. `browser-tests/pool-oversub-probe.ts`, 4 cores
under `taskset` (3 RPC workers x 4 = 12 inflate workers, ~4x oversubscribed), 5
no-MD tracks, min of 3:

| arm                             | rpc | inflate | min    |
| ------------------------------- | --- | ------- | ------ |
| today, build 1                  | 3   | 12      | 2586ms |
| today, build 2, identical code  | 3   | 12      | 2984ms |
| `workerCount=1` (one pool)      | 1   | 4       | 2759ms |
| pool capped to 1 per context    | 3   | 3       | 3382ms |

The two `today` rows are the same code built twice and differ by 15%, wider than
every gap between arms — so the only safe reading is that **no arm beat the
status quo**, and cutting the inflate workers to 3 was slower in every batch.
Per-chunk parallelism is worth more than avoiding oversubscription, which makes
sense: the pool exists to split one chunk across workers, and starving it of
that costs more than the threads do.

That also lowers the risk of the shared-pool work rather than raising it. The
`capped to 1` arm is strictly worse than one shared pool of four — fewer threads
AND no per-chunk parallelism — and cost only ~13%, inside the drift. So the
"one shared pool of four regresses the several-tracks case" worry above is not
supported.

**What is left is memory**, and it is unmeasured: 20 grow-only
`WebAssembly.Memory` instances that nothing tears down. JS heap counters will not
show it — wasm memory is outside `Runtime.getHeapUsage` — so measuring it needs
process-level RSS per target, not the usual heap snapshot.

**Retire when** either that memory is measured and found not to matter, or one
pool and one byte cache serve every RPC worker over a `MessagePort` (the same
channel does both).

### Worker payloads are collect-then-return

**Status:** Accepted (deferred, RFC-001 §13b).

Workers assemble a whole typed-array payload and return it in one message, so
peak memory is the full payload rather than one feature at a time (which the
retired streaming `FeatureRendererType` path had). Fine for every in-tree
display, a real cost for very wide multi-sample tracks (100 samples x 1 Mbp at
1 bp/px).

**Retire when** a plugin's memory ceiling shows up in production. The options are
then chunked typed-array delivery or a streaming RPC primitive, neither built.

### The density axis is a model with no measurement under it

**Status:** Accepted, bounded by the `AUTO_FORCE_LOAD_BP` floor.

`observedMaxDensity` is the last fetch's features-per-bp times the current
`coarseBpPerPx` — so the number the density verdict compares is an extrapolation
from whatever window happened to be fetched, and features clump, which makes it
non-monotone in span in a way the byte axis is not. It is what remains of the
"bytes scale with span" assumption after the byte axis stopped assuming
(REGION_TOO_LARGE.md § "Measurement follows the viewport"), and it is why
`densityGateActive` still carries the floor while `gateActive` doesn't.

**Measured, and the floor costs nothing today.** A scan of all 60 indexed files
in this repo (2026-08-06) found exactly two that would banner below 20kb —
`dog10k_cyp1a2_cohort_cn.bed.gz` (7,511 features in a 20kb window, still 1,987 at
500bp) and `dog10k_slc28a3_cohort_cn.bed.gz` — and both are
`LinearMultiRowFeatureDisplay` tracks, which set `densityGateEnabled: false`. The
densest track with the axis on peaks at 590 features per 20kb and falls
monotonically from there. So removing the floor would buy nothing measurable, and
keeping it hides nothing measurable.

Note the shape of those two files: N samples over the same interval, so the
feature count doesn't fall with span at all. That is the density counterpart of
the block-quantized byte case, and the argument that retired the *byte* floor
(measure at the span being judged) has no counterpart here — there is no cheap
index read that answers "how many features are in this window".

**Retire when** the density figure is measured at the span being judged rather
than extrapolated, or a file with the axis on is found that banners below the
floor. Reach for the scan above before either.

---

## View math

### The region walk is linear, and costs two different ways at the two ends of the zoom

**Status:** Open at the zoomed-in end. The whole-genome end is fixed — the
elided-run fast path landed in `calculateDynamicBlocks`. Measured 2026-08-14,
[`packages/core/benches/displayedRegionScaling.bench.ts`](../../packages/core/benches/displayedRegionScaling.bench.ts),
whose `prior` arm holds the pre-fix walk so the ratio stays re-measurable
interleaved rather than quoted from this table.

`calculateDynamicBlocks` walks `displayedRegions` from index 0 accumulating the
left edge, and breaks once past the window's right edge — bounded on the right,
unbounded on the left. `pxToBp`, `bpToPx`, `bpToOffset` and `cumulativeBp`
(`Base1DUtils.ts`) do the same walk. `dynamicBlocks` is a plain computed over
`offsetPx`, which `useRafCommit` moves once per frame during a drag, so it runs
per frame; `staticBlocks` carries a hand-rolled memo that skips its recompute
when only `offsetPx` moved inside the covered range, and **`dynamicBlocks`
cannot take that memo, because its answer *is* the viewport**. That asymmetry is
why this entry is about the dynamic one.

hg38 with alts is 640 sequences and a draft assembly is routinely tens of
thousands, so the range that matters is wide. ms per call, min of interleaved
rounds; trust the ratios, not the absolutes, which drift on a shared box:

<!-- prettier-ignore -->
| regions | whole genome, before | whole genome, now | zoomed to last contig | + cumulative index |
| --- | --- | --- | --- | --- |
| 640 | 0.120 | 0.027 (4.5x) | 0.027 | 0.001 (39x) |
| 2,500 | 0.467 | 0.096 (4.9x) | 0.062 | 0.001 (89x) |
| 10,000 | 1.868 | 0.375 (5.0x) | 0.251 | 0.001 (309x) |
| 50,000 | 11.112 | 1.983 (5.6x) | 1.314 | 0.001 (1247x) |
| 200,000 | 45.412 | 8.396 (5.4x) | 5.364 | 0.002 (2913x) |

**The two ends want different fixes, and each does nothing for the other.**

- **Whole genome** every region intersects the window, so there is nothing to
  skip and the index measures 1.0x. The cost was per touched region, and it was
  work thrown away: below `minimumBlockWidth` a region becomes an `ElidedBlock`,
  and `BlockSet.push` merges it into its predecessor keeping only the *first*
  sub-block's identity — so the template-literal key and the two object literals
  were built and discarded for every region in an elided run but its first.
  `BlockSet.growElidedRun` now widens the run from a width the loop already has,
  and `calculateDynamicBlocks` calls it instead of building a block `push` would
  throw away. Output-identical, and 4.5-5.6x. Two edges keep it that way and are
  the ones to preserve: the first region can never take the skip, because
  nothing has been pushed for the run to merge into, so its leading padding
  block survives; the last region is held out of it, because it may still owe a
  trailing padding block keyed off its own key.
- **Zoomed in** — a 100 kb window on the last scaffold — the walk is the whole
  cost, and a cumulative-bp prefix array rebuilt per `displayedRegions` change
  (0.003 ms at 640, 1.1 ms at 200k, once, not per frame) plus a binary search
  removes it entirely. This is the case that looks like it should already be
  cheap, and the fast path above does nothing for it: at that zoom the regions
  are wide, so nothing elides.

**The linear accumulation also drifts.** At 10,000 equal contigs summing one
pixel width per region reaches 1000.0000000001588 px against an exact 1000, so
the last region misses `rightPx >= displayedRegionRightPx` by 1.6e-10 px and the
trailing `afterLastRegion` boundary block is never emitted. Dividing an exact
cumulative bp has no such error, so the index changes output as well as speed —
worth knowing before someone diffs a snapshot after the swap and reads it as a
regression. The bench's identity check reports this and needs `--allow-diff` to
proceed past it.

**Retire when** the index lands too, or a profile says the remaining walk is not
on the critical path at the contig counts users actually open. The index is the
lever whose absence is invisible (a viewport that looks cheap and is not), it is
the one that changes output, and its storage shape is already precedented on the
synteny axis
([ADR-067](../architecture-decision-records/adr-067-synteny-dotplot-window-relative-float32.md)).

---

## Failure containment and diagnosis

### Refresh after a fatal error restores the session that caused it

**Status:** Open. The containment half is built; this is the boot half.

`JBrowse.tsx` keeps `session=local-<id>` in the URL and `fetchLocalSession`
restores that id from sessionStorage, which the autosave rewrote at most 400 ms
ago — so `FatalErrorDialog`'s **Refresh** (`window.location.reload()`) restores
the same snapshot and crashes again. Only **Reset Session** escapes, by dropping
the query string, and it discards the user's work to do it. The *load* path has
the rung the render path lacks: `LoaderErrorBanner` offers "Start over without
URL options" for exactly this shape.

What now keeps most crashes away from that dialog is a view-scoped boundary in
`ViewWrapper` (`packages/app-core/src/ui/App/`), whose fallback names the view
and offers retry or close, and an `ErrorBoundary` that can reset — by reset keys
or by the `resetErrorBoundary` handed to the fallback, which is what
`TrackContainer`'s banner passes to `ErrorBanner`'s Retry. So the render path
reaching `Loader.tsx`'s boundary now means the throw was in the app chrome or in
the view *chrome* — `ViewContainer` reads `view.showLoading`, and `ViewHeader`
reads `assemblyNames` through `viewTitle`, both above the boundary — or in the
boot itself, which is the case Refresh re-enters.
[ADR-069](../architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md)
is the standing evidence that a hard throw is reachable rather than theoretical:
`MultipleViews.ts`'s `takeOut` comment records one that "went to an ErrorBoundary
with no view left under it and took the page".

**Retire when** a boot that follows a fatal error offers the session fresh
instead of restoring it.

### Undo applies a whole-session snapshot, bypassing the detach-then-destroy discipline

**Status:** Open. Mechanism verified by reading; the crash is not reproduced.

ADR-069's rule is implemented in one action rather than at the boundary where
nodes die. `MultipleViews.ts`'s `takeOut` detaches a view and hands it to
`scheduleDetachedDestroy`, precisely so React's final read finds a live tree.
`TimeTraveller.undo()` / `redo()` call `applySnapshot` on the session instead,
and every view, track and display carries `ElementId`
(`types.optional(types.identifier, …)`) — so MST reconciles by identifier and
**destroys whatever the target snapshot lacks, synchronously, inside the
action**, with the components still mounted and the action's reactions due at its
`endBatch`. That is the sequence the ADR exists to prevent, reached through a
door it does not cover.

Reachable from a document-level keydown (`HistoryManagementMixin`), suppressed
only while a text entry has focus, and from the File menu. Any undo crossing a
view add or remove, a track close, or a `replaceView` — which
`MultipleViews.test.ts` deliberately made a *single* undoable step — takes it.

**Retire when** whole-tree snapshot application routes disappearing nodes through
the same path first (diff the id sets, `detach` + `scheduleDetachedDestroy`, then
apply), or a test that mounts a view, removes it and undoes shows the reconciler
is not the hazard it looks like. Either way the general form stands: every future
whole-tree apply re-opens this until the discipline moves to the boundary.

### A refName mismatch is silent at the one place that can see it

**Status:** Open.

`loadRefNameMap` (`packages/core/src/assemblyManager/`) holds both name sets in
one scope — the file's, from `CoreGetRefNames`, and the assembly's
canonicalization — and writes
`result[assembly.getCanonicalRefName(name) ?? name] = name`. When **nothing**
canonicalizes, which is the `1/2/3` file against a `chr1/chr2/chr3` assembly, the
`?? name` fallback yields an identity map that matches no region: the track draws
nothing, raises nothing, and is indistinguishable from one that genuinely has no
features in view.

The comparison already exists one package over — `detectSwappedAssemblies`
(`@jbrowse/synteny-core`) does exactly this for the comparative case. Only the
**empty intersection** is a verdict; partial overlap is ordinary (a track
covering some contigs), which is why this is a check on the intersection rather
than on any individual missing name.

**Retire when** an empty intersection records a diagnostic the track chrome
shows, naming the first few names from each side. The partial case belongs in
`RefNameInfoDialog`, which already exists and which nobody opens unprompted.

---

## Accessibility

### The primary surface has no name, role, or announced state

**Status:** Open.

Keyboard support is partial and undiscoverable rather than absent, which is the
part worth stating precisely. `LinearGenomeView/keyboardHandler.ts` binds
ctrl/cmd + arrows to slide and zoom, gated on `session.focusedViewId`; focus is
assigned by `useFocusOnInteraction`, which listens for `mousedown`/`keydown`
*inside* the container — and Tab **into** a view fires its keydown on the element
being left, so the assignment lags a keystroke. The track area carries no
`tabIndex`, so there is nothing to Tab to in the first place.

Past that: no `aria-` attributes in the LGV components except
`HeaderPanControls`, no role or accessible name on any track canvas, and nothing
announces the result of a pan, a zoom or a search. WCAG 2.1.1 (Keyboard) and
4.1.2 (Name, Role, Value) are the two a procurement review fails on, and the
model actions the first needs — `slide`, `zoom`, `moveTo` — all exist already.

**Retire when** the view container is focusable and shows it, each track canvas
carries a role and a generated `aria-label`, one polite live region per view
restates the locstring once navigation settles, and the shortcuts are listed
somewhere a user can find them.

---

## Coupling

### Canvas feature tracks bake appearance into worker output, so a color or theme change refetches

**Status:** Open.

`LinearBasicDisplay`'s `rpcProps()` returns the whole resolved config snapshot
(minus a hand-listed set of display-only slots) plus
`theme: getSession(self).themeOptions`. Every returned field is an RPC cache key,
so `SettingsInvalidate` fires `clearAllRpcData()` and every visible region
refetches. **A light/dark toggle, or one color slot edit, re-downloads and
re-parses every region of every canvas feature track.**

**The exclusion list is a blocklist, so its default is wrong.**
`getConfigSnapshotWithPromotables` walks `fullConfSnapshot`, which emits *every*
slot including defaults — so a slot that is neither read by the worker nor named
in the destructure is a silent refetch trigger, and adding a main-thread-only
slot introduces one by omission. That is a separate failure from the appearance
coupling above: it refetches for settings that have nothing to do with what the
worker draws. Found 2026-08-01 with five such slots in the payload, `height`
among them — and `height` is written on *every resize-handle drag frame*
(`TrackContainer` → `resizeHeight` → `setConf`), so dragging a canvas track
taller re-ran the whole worker pipeline once the drag settled. Grow-mode exit
(`installGrowExitBake`) and the fit bake hit the same path.

Two rules when auditing that list. A slot the worker reads must invalidate
through *something* — either the slot itself or a top-level `rpcProps` field
derived from it — or a track strands at a budget the user just raised. And a
**resolved, viewport-dependent** budget must go the other way: added at the RPC
*call site*, never in `rpcProps`, with the slot it resolves from left in the
payload to carry the invalidation. Both gate budgets work that way now —
`resolvedByteLimit()` behind `fetchSizeLimit`/`forceLoad`, and
`maxFeatureDensity` behind `maxFeatureScreenDensity`. The density one was a cache
key until 2026-08-04, and because `gateActive` folds in `AUTO_FORCE_LOAD_BP` it
flipped `undefined ↔ number` at 20 kb of visible span: zooming across that floor
fired `SettingsInvalidate` and blanked the whole display, for data identical on
both sides of it. See
[REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) § "Neither worker budget may be an RPC
cache key" for why nothing is left unguarded by that.
`loadedRegions`, not `rpcDataMap`, is the signal when measuring — the
canvas base keeps fetched features through a settings clear on purpose. Guarded by
the `SettingsInvalidate keys on the payload, not the reads` suite in
`fetchAutorun.test.ts`.

This is the one place the codebase inverts its own split (worker returns data,
main thread owns pixels), and for a real reason: the canvas worker bakes
per-feature colors, including jexl callbacks that need feature context, into the
instance buffer. It is also why canvas is the only per-region display with no
`gpuProps()` (ARCHITECTURE.md §"`rpcProps()` / `gpuProps()` pattern").

**Retire when** canvas splits its payload into fetch-affecting and
appearance-affecting halves and grows a `gpuProps()`. That split also inverts the
blocklist into an allowlist, which is what stops the omission failure above from
recurring — `DisplayConfig` in `renderConfig.ts` already enumerates exactly what
the worker reads, but the `as DisplayConfig` cast on the payload launders the
extra keys past it. The consistent fix has the
worker emit a per-feature color *class index* plus the attributes jexl needs, and
resolve the palette in the main-thread encoder, as synteny's `computedColors`
already does. The cheap intermediate is a worker-side parsed-feature cache keyed
by adapter + region + the non-visual payload, so a color change re-encodes
without re-parsing.

### Three staleness mechanisms behind one name

**Status:** Mostly closed (2026-07). The naming and the consumers are unified;
the three computations remain, deliberately.

Data freshness is still computed three ways — spatial coverage
(`viewportWithinLoadedData`, per-region mixins), viewport snapshot
(`viewportMatchesLastDrawn`, HiC/LD), signature compare (`isDataCurrent`, arc /
dotplot / synteny) — and each has independently shipped a stale-capture bug
([SVG_EXPORT.md](SVG_EXPORT.md), HISTORICAL.md §"In-place-refetch staleness").

What changed: all three now answer under the single name **`dataCurrent`**, and
every consumer reads that name. `svgReady` — five hand-written copies of
`fresh || terminal`, the actual bug surface — collapsed into one
`computeSvgReady` that each foundation feeds its own `dataCurrent`. So a display
composes a freshness answer instead of choosing which of three names to expose,
and forgetting the terminal set is no longer possible.

Unifying the *computations* into one signature was considered and dropped:
spatial coverage over N streaming regions is not naturally a string, and forcing
it into one would make the per-region refetch decision (which needs the
per-block answer, not the aggregate) go through a serialize/compare it has no
use for.

**Residual:** `dataCurrent` is an overridable getter defaulting to `false`, so a
new global display that forgets it hangs its export rather than failing to
compile. Deliberate (fail-hung over fail-stale). Making it a *required* member
would need a composition trick that
[ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)
rules out; tracked in `agent-docs/ideas/deferred-architecture-review.md`.

---

## Correctness surfaces nothing mechanical protects

### Ordering is the contract

**Status:** Partly closed (2026-08). The two lists below are the count; it is
deliberately not restated as a number in the heading, which asserted one ("in
five places") across two additions while the body listed six and a source
comment citing the heading by title still said four. **Don't put the length of a
growing list anywhere but the list.**

One failure shape recurs: behavior depends on an order no type can see, and
getting it wrong is silent. The fix shape is equally uniform — make the order
report itself at attach, the move `makeSettingsLoopGuard` already applied to the
`rpcProps` loop trap. `assertDisplayContract` (called from
`MultiRegionDisplayMixin.afterAttach` and from `installGlobalFetchAutorun`, so
both fetch families are covered — it was per-region only until 2026-08, which
left HiC and LD, both of which define `rpcProps()`, checked by nothing) is that
generalization. It
`console.error`s rather than throws, deliberately: an error escaping
`afterAttach` is read by the session loader as an invalid track and the display
is dropped, which would hide the very violation being reported.

**Now checked** (dev-only, no false positives possible):

- **`CanvasFeatureGateMixin()` must compose after `MultiRegionDisplayMixin()`.**
  Both define `measuresBytesInFetch` and the later wins, so swapping them switches
  the whole size gate off with no error ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)).
  The gate mixin's own `afterAttach` reads its opt-in back and reports if the
  base's `false` won — local to the mixin, so no generic checker needs to know
  what canvas is.
- **A renamed gate hook must not be left overridden under its old name.**
  `RegionTooLargeMixin`'s `afterAttach` reads `getMembers(self).views` against a
  map of the names renamed in 2026-08 (`byteGateEnabled` → `measuresBytesPreFlight`
  and the rest) and reports any it finds. Same failure as the compose-order case
  and reached a different way: an out-of-tree display's override lands on a
  getter nothing reads, so the gate stays off and the track downloads unguarded.
  **The general move: a rename of an opt-in is only safe if it is louder than the
  thing it renamed** — extend the map before renaming the next one.
- **A display's `afterAttach` must not chain to super.** The MST fork auto-chains
  lifecycle hooks, so capturing and calling it double-installs all five autoruns
  (`models/afterAttachAutoChain.test.ts`). A `WeakSet` of nodes the foundation's
  hook has already run on catches the re-entry.
- **`isCacheValid` / `rpcProps` must be `.views()`, not `.actions()`.** MobX runs
  actions untracked, so the reads register no dependency and callers keep a stale
  answer. Was a hand-copied `getMembers(display).actions` assertion per display
  family; now checked once for every display that composes the foundation,
  including ones not yet written.
- **`HeightModeMixin()` must compose after `TrackHeightMixin()`**, whose `height`
  and `resizeHeight` it overrides, so the wrong order silently leaves grow mode
  inert. This looked uncheckable — both members are legitimately defined on both
  sides, and the two `height` getters agree in fixed mode, so no *value*
  distinguishes the orders. What distinguishes them is a flag that differs by
  construction: `supportsHeightModes` (false on the base, true on the mode
  mixin), read back in `HeightModeMixin`'s own `afterAttach`, exactly as the gate
  case reads `measuresBytesInFetch`. **The general move: when a collision has no
  natural opt-in to probe, add the flag rather than concluding the order can't
  report itself.** Pinned both ways in `TrackHeightMixin.test.ts`.

**Still silent:**

- **`installGlobalFetchAutorun` must read its triggers above the `shouldFetch`
  gate.** MobX rebuilds the dep set per run, so a read under the gate drops out
  of it. Arc shipped a dead `reload()` from exactly this (ARCHITECTURE.md §"The
  global-fetch trigger list must be read unconditionally"). This one is a *shape*,
  not a state, so no attach-time read can see it.
- **A display that omits `rpcProps()` gets no settings invalidation, silently.**
  `rpcPropsCacheKey` returns `''` and `SettingsInvalidate` is never installed —
  correct for `LinearReferenceSequenceDisplay`, indistinguishable from an
  omission for everyone else. Checkable only behind an explicit opt-out
  (`noSettingsInvalidation: true`), which the simplified model shapes in
  `fetchLifecycle.test.ts` / `fetchAutorun.test.ts` would also have to declare —
  otherwise the check is console noise in the test suite rather than a signal.

**Retire when** the remaining two become explicit data: a `deps()` callback the
global-fetch helper reads unconditionally, and a required `rpcProps` (or the
explicit opt-out above). The third condition this used to name — a marker the
height mixins can compare composition order on — is `supportsHeightModes`, above.

### LDDisplay is multi-region on the fetch side and single-region on the axis

**Status:** Open, unmeasured (found 2026-07-26, not chased).

`performLDFetch` sends every content block, `executeRenderLDData` sums
`totalWidthBp` across all of them and orders SNPs across all of them, and then
projects each SNP's x with `bpOffsetInRegion(regions[0], snp.start)`
(`RenderLDDataRPC/ldLayout.ts`). Two consumers do the same on the main thread:
`LDDisplayComponent.tsx` for the hover lines and `renderSvg.tsx` for the
recombination track.

So in a view showing more than one region, SNPs from the second block are placed
in the first block's coordinate space: the inter-block offset and the second
block's own start both drop out. The display is not simply single-region-only,
which would be a clean limitation. It half-supports the case.

Nobody has confirmed how it looks on screen, and no LD spec or test uses a
multi-region view, so the size of the error is unknown. Found by grepping for
the `contentBlocks[0]` pattern behind the region-launch fix in
[REGION_VIEW_LAUNCH.md](REGION_VIEW_LAUNCH.md) convention 6.

**Retire when** either the layout takes the whole `regions` array and accumulates
the inter-region offset the way the launch pickers now do, or the display
declares itself single-region and the fetch stops pretending otherwise.

### The plugin ABI is unversioned and the surface is unbounded

**Status:** Open, with a plan.

Nothing tells you an export is load-bearing until an external plugin breaks at
runtime in a deployment you cannot see, and a plugin built against last year's
host resolves against today's `exports` with no compatibility check. The analysis
and the fix ordering (name a `@public` set, snapshot it with a CI diff, then
version the contract and fail loud at load) are in
[PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md).

One cheap step that list omits: `component_tests/plugin-vite` already installs
`example-plugins/score-example` from a packed tarball and is the only CI job
resolving `@jbrowse/*` through `publishConfig` exports. Having it assert the
**set** of symbols it imports turns one real external-consumer contract into a
build-time gate today, and gives the `@public` audit a factual starting point.

**Retire when** the `@public` set is named and snapshot-checked.

### Invariants enforced by prose, and enumerations that rot

**Status:** Open.

`agent-docs/` plus the in-tree `CLAUDE.md` files carry on the order of 20k lines
of contract. The `CLAUDE.md` half was cut from 3.7k lines to 840 in 2026-08 —
rationale, measurements, and rejected alternatives were dropped in favor of the
imperative rule alone, on the theory that git history and the ADRs already hold
the why. `agent-docs/` itself has had no equivalent pass. Rules the compiler
already owns are still written as warnings, spending the attention the
unenforceable ones need.

Alongside them sit hand-maintained membership lists (the Display stacks table,
DisplayChrome's adoption map and testid table, the upload-pattern examples
column, SVG_EXPORT's per-plugin draw-shape lists) in a doc set that explicitly
warns against enumerations and lists autogenerating them as a follow-up
(PLUGIN_ABI_STABILITY.md §"The same disease rots the docs"). Spot-checked
2026-07-24, DisplayChrome's "Direct users (12)" was accurate, so this is
prevention rather than repair.

**Retire when** the foundation-to-display map is generated from `addDisplayType`
registrations, and each surviving "Don't" either names the machine that enforces
it or is deleted because `tsc` already owns it.
