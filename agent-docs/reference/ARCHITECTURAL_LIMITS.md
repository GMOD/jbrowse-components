---
name: architectural-limits
description: Live register of the architecture's resource ceilings, accepted couplings, and correctness surfaces nothing mechanical protects, each with its mitigation and retire condition. Read before scaling work, or when a symptom looks like a ceiling.
kind: spec
---

# Architectural limits and weak points

A **live register**. `ARCHITECTURE.md` says how the system works; this doc says
where it stops working, and why we accepted that.

- **Cite symbols and files, not line numbers.**
- **Delete an entry when its retire condition is met.** An ADR records any
  story that shaped a design.
- **Statuses:** Mitigated (a mechanism bounds it, root cause remains), Accepted
  (a cost we chose), Open (we would take a fix).
- **Not a backlog.** An entry earns its place by being something you can trip
  over without knowing it exists. Work items go in [../TODO.md](../TODO.md).
- **New entries must be measured or code-verifiable.** Cite the mechanism, not
  the symptom.

---

## GPU / rendering

Every GPU figure here came off one machine (Intel UHD 630).
[GPU_PORTABILITY.md](GPU_PORTABILITY.md) says what holds on any conformant
implementation; read it before generalizing a figure below.

### One WebGL2 context per display canvas

**Status:** Mitigated at the view level; the root cause is WebGL2.

Budget one context per open GPU track: each display owns one canvas, and
`WebGL2Hal` takes its own context with no pooling. Past the browser's ceiling,
eviction and re-acquisition cascade and wedge the main thread rather than
degrading, and a single ordinary LGV can reach it. Tracks inside a mounted view
are not virtualized. [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) owns the
numbers, the harness and the fixes already measured and eliminated.

Chromosomes are free on this axis: a whole-genome track is one canvas with one
buffer per `displayedRegionIndex`. The view's block math is not free — see
["The region walk is linear"](#the-region-walk-is-linear-and-costs-two-different-ways-at-the-two-ends-of-the-zoom).
WebGPU shares one device across displays and has no per-canvas cap, which is a
primary reason for targeting it.

Mitigations, both bounding rather than fixing:

- **View-level lazy mount** (`useViewVisibility`) unmounts an off-screen view's
  GPU subtree. The cost moves to a pipeline rebuild on every scroll back, and a
  multi-panel workspace with every panel on screen gets nothing.
- **Bounded auto-recovery** in `useRenderingBackend` spends a `RecoveryBudget`.
  The budget is windowed, not lifetime: `record` restarts once
  `RECOVERY_WINDOW_MS` passes, so the cap bounds a flap. `reset` runs only on a
  genuine `webglcontextrestored` or a manual Retry.

`createGpuHal` already skips WebGL2 for a software rasterizer when nothing was
pinned.

**Retire when** WebGL2 retires (RFC-001 §13a) or track-level mount/release
lands.

### WebGPU shares one device across every display

**Status:** Accepted.

`gpuDevice.ts` holds a module-level device singleton. A single `device.lost`
takes down every display, and per-device limits are one shared budget. For
triage, the backends fail in opposite directions: "one track broke" points at
WebGL2, "every track broke at once" at WebGPU. Both route through `OomReporter`
to `renderError`.

### No session-level GPU memory budget

**Status:** Accepted (deferred).

Limit checks are per buffer and per texture, and each display releases its own
regions. Nothing sums uploaded bytes across displays, so OOM is reportable, not
preventable. ADR-035 settled that `maxHeight` bounds pixels, not GPU memory.

The per-object vertex-buffer floor differs by HAL. WebGPU refuses past
`device.limits.maxBufferSize`, which `gpuDevice.acquire` raises to the
adapter's maximum. WebGL2 can query no such limit and refuses past the fixed
`MAX_VERTEX_BUFFER_BYTES` of 256 MiB, so **WebGL2 is the stricter of the two** and a
region can banner there while rendering on WebGPU. We accept that direction:
the unguarded WebGL2 failure is a dropped context, which at the context ceiling
evicts a sibling.

**Retire when** a HAL byte counter with cross-display LRU prune exists, or an
OOM report arrives that the per-object guards missed.

### The MSAA target is the largest per-display allocation, and nothing counts it

**Status:** Open on size.

`WebGPUHal` holds one 4x MSAA color attachment per display, sized to the canvas
(`recreateMsaaTexture`): canvas area x dpr² x 4 samples, independent of the
data. An empty tall track costs what a full one does, the target dwarfs the
instance buffers the OOM guards check (79.2 MiB for one track dragged to
4100px), and `recreateMsaaTexture` checks only
`maxTextureDimension2D`. [GPU_PORTABILITY.md](GPU_PORTABILITY.md) §"The number
that generalizes badly" holds the measured sizes;
`probe-msaa-resize-cost.ts` (`--tracks=N`) takes the census by patching
`createTexture`/`destroy`, which is the shape an in-tree counter would take.

**The figures are what the descriptor asks for, not what is resident.**
`beginFrame` attaches the target with `storeOp: 'discard'` and a
`resolveTarget`, which a tiler may keep in tile memory — so on Apple Silicon the
cost may be near zero. Profile residency before spending anything on size:
[arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md).

**The sample count is a per-display property**:
`RenderingBackendOptions.sampleCount`, with 1 meaning no target at all.
`getOrBuildPipeline` keys on it, so a split compiles a shader once per sample
count in use. A display asks for 1 where every pass declares
`//! coverage: analytic` and 4 otherwise; which of the rest should drop to 1 is
a per-display look-at-the-pixels decision. Most of what those displays draw is
axis-aligned quads that 4x does nothing for. WebGL2 has no counterpart in our
accounting, since its `antialias` backbuffer is the browser's.

**Rebuilding the target every frame of a resize drag is measured and free** —
`createTexture` does not commit memory on this driver. Re-run the probe on a
different driver before reopening it.

**The obvious hysteresis is illegal.** A render pass requires `resolveTarget`
and the multisampled view to match in size, so an oversized reusable MSAA
texture cannot be attached.

**Retire when** a HAL byte counter sums live GPU bytes across displays and this
becomes a line in it.

### The uniform ring drops a write past 2048 slots

**Status:** Accepted on the cap.

`WebGPUHal` gives each display a uniform ring — a GPU buffer and a CPU staging
copy, one slot per `writeUniforms` in a frame, each slot sized by the largest
uniform struct a registered pass declares. It starts at `INITIAL_UNIFORM_SLOTS`
and doubles mid-frame; draws already encoded bind the outgrown buffer, which is
released after submit (`webgpuHalUniformRing.test.ts`). **Past
`MAX_UNIFORM_SLOTS` a write is dropped and its draws read another batch's
uniforms, with no error**; `UNIFORM_SLOT_WARN_AT` warns at half.
`probe-uniform-ring.ts` takes the table:

<!-- BEGIN GENERATED MEASUREMENT uniform-ring-occupancy -->

_Generated by `pnpm autogen` — edit the source, not this block._

| session                    | ring, GPU | ring, staging |  MSAA targets | instance data | ring share of GPU bytes | a 512-byte slot would save | peak slots used | of the 2048 cap |
| -------------------------- | --------: | ------------: | ------------: | ------------: | ----------------------: | -------------------------: | --------------: | --------------: |
| 2 alignments tracks, dpr 1 |   3.15 MB |       3.15 MB |      21.57 MB |       0.54 MB |                   12.5% |                    2.10 MB |               2 |           0.10% |
| 6 alignments tracks, dpr 2 |   9.44 MB |       9.44 MB | **223.31 MB** |       1.26 MB |                    4.0% |                    6.29 MB |           **4** |           0.20% |

<!-- END GENERATED MEASUREMENT uniform-ring-occupancy -->

The slot count, not the slot size, was the oversized term, so the ring grows
rather than packing structs (packing would also give up generated setters like
`setUniformReadCategoryColor`). The link mark (ADR-170) sets the largest slot
on every alignments display. The pileup keeps its own scratch
(`PILEUP_UNIFORMS_SIZE_BYTES`), since a write uploads the whole buffer it is
handed.

**The worst case is unmeasured**: a grouped view multiplies writes by up to
`MAX_GROUPS`, a multi-region view by the block count.

**Retire when** a frame's write count is bounded below the cap by
construction, or reaching the cap fails loudly.

### Every WebGPU display resolves its whole pass list before it can paint

**Status:** Accepted, measured (`probe-webgpu-pipeline-cost.ts`).

`WebGL2Hal.getPass` links a program on first draw, with a one-descriptor canary
in the constructor so an unusable GL stack still falls to Canvas2D.
`WebGPUHal.create` awaits every declared pass before acquiring the canvas
context, including passes behind settings nobody selected. The cost is small
because `createRenderPipelineAsync` compiles concurrently and off the main
thread; startup is fetch- and parse-bound.

**Going lazy would cost more.** `drawPass` is synchronous, so first-draw
compilation means either the synchronous `createRenderPipeline` (a main-thread
block) or skipping a draw until the pipeline lands (a visibly missing layer).

`hal/deviceGpuCache.ts` memoizes pipelines and bind group layouts per device,
keyed on `PipelineRecipe` — what `buildPipeline` actually reads — so passes over
one shader share an entry across display types. It holds the in-flight promise,
not the resolved pipeline, because many tracks mount in one tick. The cache cut
pipeline and WGSL-parse counts but measured no gain in time-to-all-drawn; what
it buys is memory and headroom.

**Retire when** never, unless a machine shows the batch is not concurrent.
Re-run the probe there first.

### A uniform write binds to its draws by adjacency, and the HALs mean different things by it

**Status:** Accepted, latent.

`WebGL2Hal.writeUniforms` writes one UBO immediately; `WebGPUHal.writeUniforms`
stages into a ring slot and `drawPass` binds the most recent one. The two agree
only while every renderer writes-then-draws adjacently. `writeUniforms` returns
nothing, so a renderer that batched its writes and then drew would be correct
on Canvas2D and WebGL2 and silently wrong on WebGPU, and the cross-backend gate
cannot see it.

A unit test can catch it: `MockDraw.uniformWrite` records which write each draw
reads and `MockHal.uniformsOf(draw)` returns its bytes (`mockHal.test.ts`
§"MockHal uniforms per draw"). A backend suite pinning writes to draws catches
the batched shape where it is introduced.

**Retire when** `writeUniforms` returns a slot token that `drawPass` takes and
WebGL2 ignores — the first time a renderer wants two uniform sets alive at once.

### A canvas past `MAX_CANVAS_DIM_PX` renders wrong, not smaller

**Status:** Mitigated; kept because the trap recurs.

`backingPx` (`canvas2dUtils.ts`) caps a backing store at `MAX_CANVAS_DIM_PX`
per axis so an oversized canvas cannot throw `InvalidStateError`. Display height
is user-dragged with no maximum (`TrackHeightMixin`), so the cap is reachable.
Any rect derived from the true dpr past the cap overruns the backing store:
WebGL2 clamps silently, WebGPU rejects the viewport and blanks the frame with no
banner.

The fix to keep: `syncCanvasSize` / `hal.resize` / `prepareCanvas` report the
scale each axis actually got, and every device-px rect (`clipBlock`,
alignments' `bufH`) derives from that, not from `getDpr()`
(`blockClipUtils.test.ts`, `canvas2dUtils.test.ts`). **Uniforms still read the
true dpr**, correctly — stroke width wants screen density — so new code mixing
the two spaces is wrong in a way no test covers.

`getDpr()` caps at `MAX_DPR`, and capping inside it keeps the backing store,
the rects and shader `devicePixelRatio` uniforms in agreement. **Reading the
global `devicePixelRatio` directly re-opens that split.** Two sites diverge on
purpose: `createSvgRasterCanvas` pins 2x for export, and analytics/error reports
read the raw device value. Any new display sizing a canvas to content must
bound it as MAF's `maxRowsHeight` does; nothing enforces that.

### A region arrival draws twice wherever the render autorun observes the data

**Status:** The systematic half is retired by
[ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md);
an unexplained surplus remains, measured as harmless.

`installUpload` uploads inside the upload autorun's own run, so a render
callback reading the data map never paints the pre-upload state
(`uploadOrder.test.ts` pins both a direct read and a computed chain). What wakes
the render autorun is its dependency set, not one syntactic read, and three
paths have such a dependency legitimately:

- **`LinearAlignmentsDisplay`**, directly (`hasRegionData`) and through
  `renderState.sections` → lanes → `rpcDataMap`; band geometry has to follow the
  laid-out data (`model.coupling.test.ts`).
- **`LinearMarkDisplay`** (and Manhattan), which passes `rpcDataMap` into
  `renderBlocks`.
- **The wiggle family**, through `renderState` → `domain` →
  `visibleStatsDomain`.

Already coalesced, so don't "fix" them: settings fan-out (one upload run, one
render) and pan/zoom (gestures batch into one `requestAnimationFrame` commit).

**Declined:** deferring the `renderTick` bump (it deferred the correct draw and
left the stale one), and a scheduler on the render autorun — an A/B on a
24-region whole-genome track cut draws by two thirds and moved no user-visible
timing, since fetch, parse and clustering are the critical path. If it ever
matters, use a microtask scheduler, not rAF (rAF stalls a backgrounded tab), and
re-express the synchronous-draw tests as an explicit flush. Software raster is
the one place it pays; that is the figure pipeline's problem
([FIGURE_CAPTURE.md](FIGURE_CAPTURE.md) §"Slow figures are SwiftShader").

**Don't chase this per display.** Removing a legitimate read means duplicating
the derivation outside MobX or pushing a data-arrival concept into backends.

**Retire when** a profile on hardware GL shows GPU submits on the critical path
of a real interaction.

### The LD triangle is materialized in full, so its ceiling is quadratic

**Status:** Mitigated by `maxVariantSeparation`; Accepted at its default (the
full triangle).

`getLDMatrixFromPlink` lays out every pair the file names in the viewport as one
`Float32Array` of `n*(n-1)/2` cells, transferred whole by `RenderLDData`.
`variantLayout: 'genomic'` adds `positions` and `cellSizes`
(`buildGenomicCellBuffers`), 5x the bytes per cell.

`maxVariantSeparation` (`LDTrackDisplay`) is plink's `--ld-window`: pairs more
than `k` variants apart are neither computed nor drawn, making the cost linear.
It is a semantic change, so the slot defaults to 0. `ldBand.ts` generalizes the
triangular index rather than replacing it — once the band covers a row the index
collapses to `i*(i-1)/2 + j`, so an unbanded run is bit-identical to the
triangle.

**Retire when** the default flips — a product decision about what an LD view
means.

---

## Fetch / RPC

### Worker assignment is sticky per adapter, so one track's parse is single-threaded

**Status:** Accepted.

`WebWorkerRpcDriver.getWorker(sessionId)` assigns one sticky worker per session
id, and a track's id is `adapterConfigCacheKey(adapter)`
(`BaseTrackModel.rpcSessionId`) so its calls share one cached adapter. A
track's per-region calls interleave at `await` points, so network latency
overlaps (ADR-022), but CPU parse serializes on one core. Matters most where
parse dominates ([SYNTENY_LOD.md](SYNTENY_LOD.md)).

**Retire when** never as a design. On a profile showing parse serialization
dominating, the lever is an opt-in region-shard suffix on `rpcSessionId` for
stateless parses.

### No fetch prioritization or back-pressure

**Status:** Open.

`FetchVisibleRegions` requests `bufferedVisibleRegions` and nothing orders the
calls: visible does not outrank buffered, near does not outrank far.
Cancellation is per display (`FetchMixin`), not a scheduler. Volume is unbounded
too: every gate (`fetchSizeLimit`, density) is per display per region, and
nothing in the session knows the total across tracks. Both land in one missing
object, a priority queue with a max-in-flight cap.

**Retire when** that queue lands, or `fetchRegions` at least sorts `needed` by
distance from the viewport center.

### Per-JS-context scoping multiplies by the RPC pool

**Status:** Open.

The BGZF inflate pool, `RemoteFileWithRangeCache`'s chunk map and
`SharedBudget` are scoped per JS context, and adapters stick to one of several
RPC workers, so each multiplies by the worker count. Only `SharedBudget` should
be per context (ADR-064); threads and network are machine-wide.
[BAM_STACK_INTEGRATION.md](BAM_STACK_INTEGRATION.md) §"Seam 1" owns the numbers
and the design questions; [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) has the
harness.

The ceiling part: one grow-only `WebAssembly.Memory` per inflate worker that
nothing tears down. `@gmod/bgzf-filehandle` reaps idle pools and boots one only
for a large enough chunk, so the resting level is reclaimed but the peak during
active browsing is not — and JS heap counters cannot see it.

**Retire when** that memory is measured and found not to matter, or one pool
and one byte cache serve every RPC worker over a `MessagePort`.

### Worker payloads are collect-then-return

**Status:** Accepted (deferred, RFC-001 §13b).

Workers assemble a whole typed-array payload and return it in one message, so
peak memory is the full payload. Fine for every in-tree display; a real cost
for very wide multi-sample tracks.

**Retire when** a plugin's memory ceiling shows up in production; the options
are chunked typed-array delivery or a streaming RPC primitive.

### The density axis is a model with no measurement under it

**Status:** Accepted, bounded by the `AUTO_FORCE_LOAD_BP` floor.

`observedMaxDensity` is the last fetch's features-per-bp times the current
`coarseBpPerPx` — an extrapolation from whatever window was fetched, and
non-monotone in span because features clump. That is why `densityGateActive`
keeps the floor while the byte axis, which measures at the span being judged
([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) §"Measurement follows the
viewport"), does not. A scan of the indexed demo files found the floor hides
nothing. No cheap index read answers "how many features are in this window".

**Retire when** density is measured at the span being judged, or a file with
the axis on banners below the floor.

---

## View math

### The region walk is linear, and costs two different ways at the two ends of the zoom

**Status:** Open at the zoomed-in end; the whole-genome end is fixed.

`calculateDynamicBlocks` walks `displayedRegions` from index 0, breaking past
the window's right edge, and `pxToBp`, `bpToPx`, `bpToOffset` and `cumulativeBp`
(`Base1DUtils.ts`) walk the same way. `dynamicBlocks` recomputes per drag frame
and cannot take `staticBlocks`' memo, because its answer is the viewport.
`displayedRegionScaling.bench.ts` measures both ends, with a `prior` arm.

- **Whole genome:** every region intersects, so the cost was per-region work
  thrown away inside elided runs. `BlockSet.growElidedRun` widens the run
  instead. The first region of a run cannot skip (nothing to merge into) and the
  last is held out (it may owe a trailing padding block).
- **Zoomed in** on a late contig, the walk is the whole cost and the fast path
  does nothing. A cumulative-bp prefix array rebuilt per `displayedRegions`
  change plus a binary search removes it.

**The linear accumulation also drifts**: summing per-region pixel widths over
many contigs misses `rightPx >= displayedRegionRightPx` by a rounding error, so
the trailing `afterLastRegion` block is not emitted. A cumulative index changes
output as well as speed; a snapshot diff after the swap is not a regression.

**Retire when** the index lands (storage precedent:
[ADR-067](../architecture-decision-records/adr-067-synteny-dotplot-window-relative-float32.md)),
or a profile says the walk is off the critical path at the contig counts users
open.

---

## Failure containment and diagnosis

### The detach-then-destroy discipline stops at the view

**Status:** Accepted.

ADR-069's detach-not-destroy rule covers every way a view leaves, undo/redo
included (`takeOutViewsMissingFrom` before `TimeTraveller`'s `applySnapshot`).
Below the view, nodes die in place by choice: `hideTrackGeneric` is a plain
`tracks.remove`. A detached display is a live root, and `getContainingView`
throws on one where a dead node only warns, so detaching would trade a warning
for a throw. `undoTeardown.test.tsx` pins zero liveliness reads for the view and
non-throwing reads for the track. A view nested in another (breakpoint-split
sub-views) is still reconciled to death, but no user action removes one alone.

**Retire when** a track close and an undo across one both measure zero
liveliness reads — the root cause is in
[destroying-an-mst-tree-that-something-still-observes.md](../ideas/waiting-on-a-number/destroying-an-mst-tree-that-something-still-observes.md).

---

## Accessibility

### The primary surface is reachable and named; nothing under it is

**Status:** Open below the view.

A view container is a tab stop with a name, Tab into a view sets
`session.focusedViewId` (`useFocusOnInteraction`), each display box has
`role="figure"` and a name (`TrackRenderingContainer`), and `NavigationAnnouncer`
restates the locstring. `probe-a11y-focus.ts` verifies what jsdom cannot.

What remains:

- **No feature is focusable**, so no keyboard path reaches a click handler,
  tooltip or menu (WCAG 2.1.1). Features are canvas pixels, so the fix needs a
  navigable model of what is drawn.
- **The announcer and track names are LGV-only.**
- **Bindings need a modifier**; nothing covers zoom-to-region, track menu or
  search.
- **`role="figure"`, not `img`**, because `img` makes descendants
  presentational and displays draw interactive chrome inline
  (`GroupLabelsOverlay`).
- **Views on one assembly share a name** — `viewTitle` falls back to the
  assembly display name.

**Retire when** a display's features are reachable and actionable from the
keyboard.

---

## Coupling

### Canvas feature tracks bake per-feature color into worker output, so a color-slot edit refetches

**Status:** Accepted.

Every `rpcProps()` field is an RPC cache key, so a change fires
`SettingsInvalidate` and every visible region refetches. `color.value`,
`utrColor` and `connectorColor` are per-feature jexl callbacks only the worker
can evaluate, so editing one re-downloads and re-parses every region. Theme
colors leave as color classes (`colorClasses.ts`) and the colour scale resolves
on the main thread (ADR-167), so neither refetches.

The payload is picked, not filtered: `pickDisplayConfig` reads `WORKER_READS`,
a `Record<keyof SettingsDisplayConfig, true>`, so a slot reaches the worker only
by joining the type, and forgetting one breaks a feature visibly instead of
making an unrelated slot (like `height`, written every drag frame) a silent
refetch trigger.

Two rules when auditing it:

- A slot the worker reads must invalidate through itself or an `rpcProps` field
  derived from it, or a track strands at a budget the user just raised.
- A **resolved, viewport-dependent** budget goes on the RPC call site, never in
  `rpcProps`, with its source slot left in the payload to carry invalidation
  (`resolvedByteLimit()`, `maxFeatureDensity`). Otherwise crossing
  `AUTO_FORCE_LOAD_BP` refetches identical data.

Measure with `loadedRegions`, not `rpcDataMap` — the canvas base keeps features
through a settings clear. `fetchAutorun.test.ts` §"SettingsInvalidate keys on
the payload, not the reads" guards it.

**Retire when** per-feature color leaves the worker. It cannot become a class
— it is per feature — so the cheap intermediate is a worker-side parsed-feature
cache keyed on adapter + region + non-visual payload.

### Staleness mechanisms behind one name

**Status:** Accepted.

Data freshness is computed two ways — spatial coverage
(`viewportWithinLoadedData`, per-region mixins) and signature compare
(`isDataCurrent`, comparative and matrix displays) — and each has shipped a
stale-capture bug ([SVG_EXPORT.md](SVG_EXPORT.md)). Both answer as
**`dataCurrent`**, which feeds one `computeSvgReady`. `foundationSvgReady`
types `dataCurrent` as required, so a new display that forgets it fails to
compile rather than hanging its export. One signature for both was declined:
the per-region refetch needs the per-block answer, not a serialized aggregate.

---

## Correctness surfaces nothing mechanical protects

### Ordering is the contract

**Status:** Partly closed. **Don't state the length of the lists below anywhere
but the lists.**

One failure shape recurs: behavior depends on an order no type can see, and
getting it wrong is silent. **A declaration** (a name, a call, an argument
order) gets a `no-restricted-syntax` selector. **A state** true only at some
moment of a run must report itself at attach, as `makeSettingsLoopGuard` and
`assertDisplayContract` do. `assertDisplayContract` runs from
`MultiRegionDisplayMixin.afterAttach`, `installGlobalFetchAutorun`,
`installComparativeFetchAutorun` and `installFetch` whenever a `contract` is
named. It `console.error`s rather than throws: an error escaping `afterAttach`
makes the session loader drop the display, hiding the violation.

**Production reports go through `@jbrowse/render-core/contractReports`**,
silent until armed (a `localhost` plugin, `localStorage.jbrowseDeveloperMode`,
or `configuration.preferences.developerMode`); armed, a report is a
`console.error` plus a session notification where the host mounts a
`Snackbar`. Reports queue until a sink exists, because MST attaches a display
before its session. The two checks with their own cost — the figure's
`MutationObserver` and `installUpload`'s payload walk — ask
`contractReportsOn()` and need the channel armed before mount. Public docs:
`developer_guides/testing_plugins` §"Developer mode".

**A test fails on any report.** `config/jest/console.js` buffers every
`[jbrowse <family> contract]` message and `config/jest/contractGate.js` fails
the test that collected one. A test provoking one on purpose reads them with
`takeContractReports()`; a test that mocks `console.error` leaves the gate
entirely, which is why display harnesses silence only `console.warn`. A report
from a debounced autorun lands after its test returns and fails the next one, or
the file.

**Checked at runtime:**

- **A renamed gate hook leaves an override reading nothing.** In tree, the hook
  table's generator asserts every hook is still declared by the file owning its
  default. Out of tree nothing reports it, so a renamed opt-in is a breaking
  change.
- **A display's `afterAttach` must not chain to super.** The MST fork
  auto-chains lifecycle hooks, so chaining double-installs every autorun
  (`afterAttachAutoChain.test.ts`). A `WeakSet` catches the re-entry. It stays a
  runtime check because composing two fetch foundations, or calling an installer
  a mixin already called, reaches the same state without the syntax.
- **`reload()` must reach a fetch.** `makeRetryContractCheck`, installed by both
  fetch foundations, judges each run after a `reloadCounter` bump; a decline is
  the dead Retry button. A `fetchNeeded` override that awaited before fetching
  would false-report. **A `reload()` override that neither bumps nor chains
  silences the check for good**, so `reloadReachesCounter.test.ts` reads every
  `reload()` in the tree. A check armed by a value a subclass can stop producing
  needs something watching the producers. [DISPLAYCHROME.md](DISPLAYCHROME.md)
  §"The retry contract".
- **A track config written into a session or config list must outlive its
  assemblies.** `assertTrackConfOutlivesItsAssemblies` runs on every adder:
  a config naming a **temporary** assembly dies with the comparative view that
  synthesized it (ADR-084). Where a cleanup was deleted because the storage was
  wrong, the check goes on the write. A check on a write needs its user-driven
  callers answered first, or it scolds the user: Copy track greys such a track,
  and `addTrackFromWidget` routes it to `showTrack`'s `inlineConf`.
- **Nothing inside a live SVG figure may be an `observer`, and a view may hold
  one figure.** `figureContract.ts`, called from `useViewSvgFigure`. An observer
  inside re-renders on its own and slides live content across frozen track
  bodies; two figures of one view mint identical SVG ids and `url(#…)` clips
  every later one with the first one's rects. `observer(f)` cannot be told from
  `memo(f)`, so a `MutationObserver` on the figure's subtree, reporting only
  while the snapshot is unchanged, checks the state the shape would produce. The
  ids are deterministic on purpose (`svgNodeId`), so the check goes on the
  second mount.

**Checked by lint:**

- **`CanvasFeatureGateMixin()` must compose after `MultiRegionDisplayMixin()`**
  — both define `gateEnabled` and `densityTooLarge`, and the wrong order turns
  the size gate off ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)). The selector
  `CanvasFeatureGateMixin() ~ MultiRegionDisplayMixin()` reads the argument
  order. It cannot see an order assembled across two files; nothing in tree
  composes that way.
- **`HeightModeMixin()` must compose after `TrackHeightMixin()`**, or grow mode
  goes inert. Same selector shape and residual. `TrackHeightMixin.test.ts`
  drag-resizes a grow-mode fixture both ways round.
- **`rpcProps` / `zoomFetchArgs` / `regionHasData` / `isCacheValid` must be
  `.views()`, not `.actions()`** — actions run untracked, so callers keep a
  stale answer. A `no-restricted-syntax` rule matches a declaration of one inside
  `.actions(…)`. It misses a helper factory spread into the block, which no
  display does ([ADR-044](../architecture-decision-records/adr-044-reactive-display-hooks-are-getters-or-pinned-views.md)).
  A selector never reaches an out-of-tree plugin.

**Still silent:**

- **A fetch installer's triggers must be read above its gate**, since MobX
  rebuilds the dep set per run ([FETCH_SKELETON.md](FETCH_SKELETON.md) §"The
  global-fetch trigger list must be read unconditionally"). Each installer reads
  its own triggers unconditionally, so the exposure is a `prepare()` that returns
  `undefined` above a read only it makes. Every in-tree `prepare` bails on
  something already tracked or reads its own observable first.
- **An `installUpload` declares a narrow `inputs` getter, never
  `renderState`.** Since ADR-078 an observable read inside `encode` invalidates
  nothing, so too narrow fails visibly and too wide (`renderState`) rebuilds
  identical buffers every frame of a height drag. Checkable by running `encode`
  once at attach inside a MobX probe and comparing against `inputs`.
- **The comparative `reload()` gate conflates two declines.**
  `installComparativeFetchAutorun` gets both contract checks, but `prepare()`
  returning `undefined` means both "nothing to fetch" and "not ready", so a
  Retry before either view initializes reads as a decline. `FetchMixin.fetchInert`
  and `installFetch`'s `fetchKey` gate are the seams for the split.
- **A display that omits `rpcProps()` gets no settings invalidation.**
  `settingsFetchInputs` then carries only the adapter config — correct for
  `LinearReferenceSequenceDisplay`, indistinguishable from an omission
  elsewhere. A check needs an explicit opt-out that the per-region test display
  (`perRegionTestEnv.ts`) would also declare.

**Retire when** each becomes explicit data: a `deps()` callback the
global-fetch helper reads unconditionally, a `prepare()` that says which bail-out
it took, and a required `rpcProps` or explicit opt-out.

### A spreadsheet's rows leave the session snapshot silently, and a local import cannot get them back

**Status:** Accepted on the cap, Open on the silence.

`SpreadsheetViewModel`'s `postProcessSnapshot` drops `rowSet` when
`rowsExceedSnapshotBudget` says the rows clear `ROW_SNAPSHOT_BUDGET`. The cap
earns its place: the snapshot mirrors to sessionStorage on every edit, which
throws, so an unbounded sheet would lose the whole session (`snapshotBudget.ts`).

The recovery is unbounded. `ImportWizard` caches a location only for a URI, and
the reload in `afterAttach` keys on `cachedFileLocation`, so a local or dropped
file over the budget returns as an empty import form with no message.
`IMPORT_SIZE_LIMIT` on the same path does speak, which teaches readers this
path announces its limits, and `SvInspectorView` inherits the shape for local
VCF/BEDPE. Elsewhere the codebase refuses silence (`GranularRectLayout` throws
past `hardRowLimit`; alignments records `clippedBy`); `BaseFeatureWidget`
shares it but rebuilds on the next click.

**Retire when** the drop is visible (a flag on the snapshot the reloaded view
turns into a message naming the file) or impossible (rows stored
IndexedDB-side).

### The plugin ABI is unversioned and the surface is unbounded

**Status:** Open.

Nothing marks an export load-bearing until an external plugin breaks in a
deployment you cannot see, and a plugin built against an old host resolves
against today's `exports` unchecked. Analysis and plan:
[PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md).

**Retire when** the `@public` set is named and snapshot-checked.

### Invariants enforced by prose, and enumerations that rot

**Status:** Open.

Rules the compiler already owns are still written as warnings, spending the
attention the unenforceable ones need. A doc sweep finds drift, not verbosity:
references that stopped resolving, invisible to readers and CI. The lever is
coverage — widen `check-doc-imports.ts` so a class cannot come back — and a
generated list with an assertion under it, as the display-hook override table
has.

**A rename inverts the comment recording it.** The sentence recording a rename
is written in the old name, so the sweep turns it into "the current name was
the bad one". tsc and the doc checkers both see a live symbol.
`check-rename-archaeology.ts` detects a past-tense rename idiom naming an
identifier the same file declares.

**Retire when** each surviving "Don't" names the machine that enforces it or is
deleted because `tsc` owns it.
