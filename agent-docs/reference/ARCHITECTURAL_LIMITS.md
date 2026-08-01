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

**Budget contexts as one per open GPU track.** Each display owns one backend
canvas (`DisplayChrome` hands out a single `canvasRef`; extra canvases its child
renders are 2D overlays), and `WebGL2Hal`'s constructor takes its own
`canvas.getContext('webgl2')` with no pooling. Browsers cap live WebGL contexts
per page and force-lose the oldest past the cap, `useRenderingBackend`
re-acquires, that eviction evicts another, and the cascade wedges the main thread
instead of degrading.

Chromosomes are free: a whole-genome view of one track is still one canvas, with
one GPU buffer per `displayedRegionIndex` and one scissored draw per render
block. **This ceiling is a primary motivation for targeting WebGPU**, which
shares one device across displays (next entry) and so has no per-canvas cap.

Measured once, synthetically, with a many-*views* harness because that was the
reported symptom: 72 canvases (24 views x 3 tracks) gave 56 `context LOST` events
and a 143s frozen frame, while 20 canvases stayed smooth, and the freeze followed
run order rather than dockview-vs-classic. Read that as bracketing the cascade
between 20 and 72 live contexts on the tested Chrome, and nothing more. Two
caveats that matter more than the numbers:

- **The realistic shape is unmeasured.** A 24-view session is not a workload; one
  or two views holding 10 to 20 GPU tracks is, and reaches the same count.
- **Don't trust caps quoted elsewhere.** RFC-001 §12b says "Firefox around 16,
  Chrome around 8", which the 20-canvas result contradicts.

Mitigations in place, both bounding rather than fixing:

- **View-level lazy mount** (`packages/app-core/src/ui/App/useViewVisibility.ts`)
  gates whether a view mounts its GPU subtree, falling back to always-visible
  where IntersectionObserver is absent (jsdom/SSR). Took the 72-canvas case to 6.
- **Bounded auto-recovery** in `useRenderingBackend`: at most
  `MAX_CONTEXT_RECOVER_ATTEMPTS` re-inits on backoff, and the budget resets only
  on a genuine `webglcontextrestored` or a manual retry, so a flapping context
  climbs to the cap and stops rather than spinning.

Still exposed: tracks inside a mounted view are not virtualized, so one LGV with
15+ GPU tracks allocates 15+ contexts.

**Retire when** WebGL2 retires (RFC-001 §13a) or track-level mount/release lands.
Measure before building either: [../TODO.md](../TODO.md) §"Measure the WebGL2
context budget in the shape users actually hit". The other unbuilt interim move is
dropping a display to Canvas2D after K context losses, so the failure is one slow
track rather than a wedged page.

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

**Retire when** a session-level priority queue with a max-in-flight cap lands, or
`fetchRegions` at least sorts `needed` by distance from viewport center.

### Worker payloads are collect-then-return

**Status:** Accepted (deferred, RFC-001 §13b).

Workers assemble a whole typed-array payload and return it in one message, so
peak memory is the full payload rather than one feature at a time (which the
retired streaming `FeatureRendererType` path had). Fine for every in-tree
display, a real cost for very wide multi-sample tracks (100 samples x 1 Mbp at
1 bp/px).

**Retire when** a plugin's memory ceiling shows up in production. The options are
then chunked typed-array delivery or a streaming RPC primitive, neither built.

### The byte gate assumes bytes scale with span, so block-quantized formats slip past it

**Status:** Open.

`rescaleByteEstimateToVisibleSpan` scales one cached measurement by
`visibleBp / measuredSpanBp`, and `AUTO_FORCE_LOAD_BP` skips gating below 20kb.
Both assume a smaller view means a smaller fetch. Tabix returns whole
overlapping lines, so for a format that puts an unbounded amount of data on one
line — MAF-tabix stores an entire alignment block, every species, in column 6 —
the cost is quantized by feature, not by view. Zooming into a megabase block
divides the estimate by the zoom factor while the fetch stays the same size, and
the floor means nothing checks. The gate under-reports precisely the fetch that
needs stopping, so there is no ceiling on the path that needs one.

**Retire when** the gate can re-measure per view instead of rescaling (an
opt-in, since canvas/LD/alignments share the mixin) and the byte axis is allowed
to fire below the floor. Sketch and the MAF-specific fixes in
[MAF_LARGE_BLOCKS.md](../guides/MAF_LARGE_BLOCKS.md).

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

Two rules when auditing that list. A slot that reaches the worker through a
*separate* top-level `rpcProps` field must still invalidate through that field —
`maxFeatureScreenDensity` rides as `maxFeatureDensity`, which is `undefined`
while nothing gates, so excluding the slot alone would strand a track at a budget
the user just raised. And `fetchSizeLimit`/`forceLoad` must stay in the payload:
the byte budget itself (`resolvedByteLimit()`) is added at the RPC *call site* and
so is not a cache key, leaving those slots as what makes raising the limit
refetch. `loadedRegions`, not `rpcDataMap`, is the signal when measuring — the
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
rules out; tracked in OTHER_IDEAS.md §"Deferred architecture-review items".

---

## Correctness surfaces nothing mechanical protects

### Ordering is the contract, in four places

**Status:** Open (each has a test, none has a type).

One failure shape recurs: behavior depends on an order no type and no runtime
check can see, and getting it wrong is silent.

- **`CanvasFeatureGateMixin()` must compose after `MultiRegionDisplayMixin()`.**
  Both define `derivedRegionTooLargeEnabled` and the later wins, so swapping them
  switches the whole size gate off with no error
  ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)).
- **`installGlobalFetchAutorun` must read its triggers above the `shouldFetch`
  gate.** MobX rebuilds the dep set per run, so a read under the gate drops out
  of it. Arc shipped a dead `reload()` from exactly this (ARCHITECTURE.md §"The
  global-fetch trigger list must be read unconditionally").
- **A display that omits `rpcProps()` gets no settings invalidation, silently.**
  `rpcPropsCacheKey` returns `''` and `SettingsInvalidate` is never installed —
  correct for `LinearReferenceSequenceDisplay`, indistinguishable from an
  omission for everyone else.
- **A display's `afterAttach` must not chain to super.** The MST fork auto-chains
  lifecycle hooks, so capturing and calling it double-installs all five autoruns
  (`models/afterAttachAutoChain.test.ts`).

**Retire when** each order becomes explicit data: a `deps()` callback the
global-fetch helper reads unconditionally, a required `rpcProps` (or an explicit
`noSettingsInvalidation: true`) on the fetch foundations, and a dev-mode
`afterAttach` assertion that warns when a display composing the gate mixin still
resolves `derivedRegionTooLargeEnabled` false. `makeSettingsLoopGuard` is this
move already applied to the `rpcProps` loop trap. Generalize it.

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
[REGION_VIEW_LAUNCH.md](../guides/REGION_VIEW_LAUNCH.md) convention 6.

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

`agent-docs/` plus the 24 in-tree `CLAUDE.md` files carry on the order of 15k
lines of contract, including ~60 imperative bullet rules. Rules the compiler
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
