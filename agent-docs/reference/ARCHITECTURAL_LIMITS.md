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
canvas and `WebGL2Hal` takes its own context with no pooling. **The ceiling is
16** (Chrome 151); past it, eviction and re-acquisition cascade and wedge the
main thread rather than degrading. **A single ordinary view reaches it** — 17 GPU
tracks on one LGV, nothing synthetic.

[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) owns this subject and is the only
place the numbers should be edited: the ceiling table on both drivers, the
software-vs-hardware cost crossover, the harness, and the four fixes already
measured and eliminated.

Chromosomes are free: a whole-genome view of one track is still one canvas, with
one GPU buffer per `displayedRegionIndex` and one scissored draw per render
block. **This ceiling is a primary motivation for targeting WebGPU**, which
shares one device across displays (next entry) and so has no per-canvas cap.
Free on the canvas and buffer axis only — the view's own block and coordinate
math is linear in the region count, and is
["The region walk is linear"](#the-region-walk-is-linear-and-costs-two-different-ways-at-the-two-ends-of-the-zoom).

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
The measurement that gated both is done, and it says track-level mount/release is
worth building. Two unbuilt interim moves: drop a display to Canvas2D after K
context losses, so the failure is one slow track rather than a wedged page, and
pick Canvas2D up front when the renderer string says software.

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

Both HALs now hold that per-object floor on the vertex-buffer axis, at
different heights. WebGPU refuses past `device.limits.maxBufferSize` — which
`gpuDevice.acquire` raises to the adapter's own maximum, 1 GiB on the Firefox
Nightly / Intel UHD 630 measured here. WebGL2 can query no such limit, so it
refuses past a fixed `MAX_VERTEX_BUFFER_BYTES` of 256 MiB, WebGPU's spec
default. **WebGL2 is therefore the stricter of the two**, and a region can
banner there while rendering on WebGPU. That is the accepted direction: the
unguarded alternative on WebGL2 is not a failed allocation but a dropped
context, which on a page at the context ceiling evicts a sibling and starts the
cascade in [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md).

**Retire when** a HAL byte counter with cross-display LRU prune exists, or an OOM
report arrives that the per-object guards missed. The counter's first customer
is the MSAA target below, which is larger than the buffers and is not counted
anywhere today.

### The MSAA target is the largest per-display allocation, and a resize rebuilds it

**Status:** Open, and the arithmetic below is arithmetic — the *allocation* has
not been timed, though the backend it happens on is reachable: `--backend=webgpu`
runs Firefox Nightly, which has a working device here where Chrome has none
(GPU_CONTEXT_BUDGET.md § "Chrome is not the only browser on the box"). The
device this was read on reports `maxTextureDimension2D=8192`, which is the other
half of the entry — a canvas past 8192 physical px on an axis takes the MSAA
target out entirely and `beginFrame` then skips the whole frame.

`WebGPUHal` holds one 4x MSAA color attachment sized to its own canvas
(`recreateMsaaTexture`). Two things follow that nothing else in this register
covers.

**It is per display, and its size has nothing to do with the data.** Cost is
canvas area x dpr² x 4 samples, so an empty 600px-tall track costs exactly what
a full one does. A 1600x600 CSS track at dpr 2 is 3200x1200x4 B ≈ 15 MB of
single-sample color, so **~61 MB at 4x** — an order of magnitude past the
instance buffers the OOM guards do check, and a ten-track view is hundreds of MB
before a feature is uploaded. `recreateMsaaTexture` compares against
`maxTextureDimension2D` and nothing else. WebGL2 has no counterpart in our
accounting because `antialias: true` puts the multisample backbuffer inside the
browser's own budget.

**`resize` rebuilds it on every backing-store change, and a height drag is one
per frame.** `GpuPerRegionRenderingBackend.renderBlocks` calls
`hal.resize(canvasWidth, canvasHeight)` each frame; `syncCanvasSize` reports the
change; `useResizeDrag` commits one height per animation frame. So dragging a
track taller destroys and creates a tens-of-MB multisample texture for the
length of the gesture.

**The obvious fix is not available, which is the part worth recording.** A
render pass validates that its `resolveTarget` is the same size as its
multisampled `view`, so an MSAA texture kept deliberately oversized and reused
across sizes cannot be attached — growing in steps and shrinking on settle, the
hysteresis this looks like it wants, is not a legal shape. What is left is to
quantize the *canvas* (backing store and CSS together, clipped by the track
container to the true height), or to accept it.

**Retire when** the reallocation is measured on WebGPU hardware and found not to
matter, or the canvas is quantized so a drag reallocates once per step. Measure
before building: the drag is the whole case, and `probe-dotplot-pad-cost.ts` is
the pattern for a probe that changes one thing about a real shipped path.

### Every WebGPU display resolves its whole pass list before it can paint

**Status:** Mitigated (the set is shared across displays), root cause is that
the resolution is eager.

The two HALs sit on opposite sides of a decision WebGL2 made deliberately.
`WebGL2Hal.getPass` links a program on its first *draw*, with a one-descriptor
canary in the constructor so an unusable GL stack still falls to Canvas2D; its
comment records a three-track LGV that declared 29 programs and drew with 14.
`WebGPUHal.create` awaits its whole declared list — alignments declares 23 — and
does it before acquiring the canvas context, so a track's first paint waits on
every pass it could ever draw, including the ones behind a `colorBy` nobody
selected.

That is the shape GPU_CONTEXT_BUDGET.md already measured on the other backend,
where **the load-time pipeline build**, not the per-pass rebuild, turned out to
be what costs. Whether it costs the same here is unmeasured but not
unmeasurable: `createRenderPipelineAsync` is meant to keep the work off the main
thread, and `--backend=webgpu` gives a real device through Firefox Nightly to
time it on.

What bounds it today is `hal/deviceGpuCache.ts`: pipelines and the two bind
group layouts are memoized per device, keyed on the `PipelineDescriptor` object
itself, so displays 2..N of a track type build nothing. Before it, ten
alignments tracks compiled 230 pipelines for 23 distinct programs. The cache is
correct rather than approximate because a plugin's `*_PASSES` is a module const
and `slangPass` reads `wgslSource` off a generated const, so descriptor identity
already means "same shader, same layout, same blend, same topology"; two passes
sharing a `.slang` shape module get separate entries because `slangPass` built
them separate objects. It holds the in-flight promise rather than the resolved
pipeline, which is the half that matters — many tracks mount in one tick, so a
memo of finished compiles would miss on all of them.

**Retire when** WebGPU builds a pass on first draw the way WebGL2 does, or a
measurement on WebGPU hardware says the eager set is free and this becomes an
Accepted entry with a number in it.

### A uniform write binds to its draws by adjacency, and the HALs mean different things by it

**Status:** Accepted, latent — no renderer in tree violates it.

`WebGL2Hal.writeUniforms` does an immediate `bufferSubData` into one UBO.
`WebGPUHal.writeUniforms` stages into a ring slot, and `drawPass` binds slot
`uniformSlot - 1` — "whatever was written most recently". The two agree only
while every renderer writes-then-draws adjacently, which every renderer does.

There is no way to say otherwise: `writeUniforms` returns nothing, so a renderer
cannot name the slot it wants a draw to read. One that batched its writes and
then issued its draws would be correct on Canvas2D and WebGL2 and silently wrong
on WebGPU — the failure class `packages/render-core/CLAUDE.md` says this package
exists to refuse, and one no test in tree would catch, since the parity gate
compares backends on renderers that all obey the convention.

The ring's cost is fixed and paid whether a renderer writes 4 slots or 1900:
`MAX_UNIFORM_SLOTS` x the device-aligned uniform size, as a GPU buffer **and** a
CPU staging array. Alignments' 864-byte uniform aligns to 1024, so 2 MiB on each
side per alignments HAL.

**Retire when** `writeUniforms` returns a slot token that `drawPass` takes and
WebGL2 ignores. Cheap, and the reason to wait is that nothing needs it yet —
take it the first time a renderer wants two uniform sets alive at once.

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
CSS px to clamp, not 2731 as it would at dpr=3. Retina is unaffected; the cap
only bites above it, where cost scales with dpr² for a difference essentially
nobody resolves. Capping *inside* `getDpr` is what keeps it safe — every consumer
reads the same capped number, so the backing store, the rects derived from it and
the variant-matrix shader's `devicePixelRatio` uniform cannot disagree. **A call
site reading the global `devicePixelRatio` directly re-opens that split.** Two
places diverge on purpose: `createSvgRasterCanvas` pins 2x because export goes to
a file rather than a screen, and the analytics / error-report paths read the raw
global because they are reporting the device, not drawing on it.

### A region arrival draws twice wherever the render autorun observes the data

**Status:** Accepted, and measured rather than assumed. Removing the redundant
draws changes nothing a user can perceive.

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
stale one.** The obvious fix — a `renderSoon()` replacing the `renderNow()` in
`installPerRegionLifecycle` — cannot work: the render autorun is scheduled by the
`rpcDataMap` write itself and runs *before* the upload autorun, so deferring the
tick defers only the correct, post-upload draw and leaves the pre-upload one as
the single draw in that frame. Measured with a frame-coalesced `renderNow`: 4
arrivals gave 9 renders, exactly the un-deferred count.

**A scheduler on the render autorun works, and buys nothing in the app.**
`autorun(fn, { scheduler })` coalesces every case. A/B on
`tcga/cohort_cnv_genome` (24 whole-genome regions into
`LinearMultiRowFeatureDisplay`), headed on a real GPU, 3 runs, median:

| arm | draws | to ready | frames >50ms | worst frame | long tasks |
| --- | --- | --- | --- | --- | --- |
| baseline | 72 | 11.9s | 22 | 176ms | 1.3s |
| rAF | 25 | 11.3s | 19 | 176ms | 1.4s |
| microtask | 26 | 11.2s | 18 | 176ms | 1.3s |
| `setTimeout(0)` | 25 | 11.7s | 18 | 174ms | 1.4s |

24 regions cost **72** draws, not the 48 the double-draw alone predicts, so there
is more redundancy here than this entry describes. Removing two thirds of it
moves nothing: every column is inside baseline run-to-run spread (11.1s to 12.7s
to-ready). The draws are not on the critical path — fetch, parse and clustering
are, and the long tasks are JS. A microtask scheduler scores the same as rAF,
which says most of the redundancy is same-task.

Three costs, for whoever revisits this:

- **rAF makes painting depend on frame delivery.** In one headless run the rAF
  arm recorded **zero** draws and never became ready inside 900s, because a
  backgrounded tab gets no frames. Synchronous rendering has no such dependency;
  a microtask or timeout scheduler avoids it.
- **The test contract.** Forcing a scheduler on across render-core, wiggle,
  canvas, gwas and maf fails **11 tests in 3 files**, all asserting a synchronous
  draw. Smaller than feared, but they would need an explicit flush helper, and
  anything on jest fake timers stalls because rAF is mocked.
- **Software raster is the one place it pays, and is not the app.** The same A/B
  under SwiftShader went 208.7s to 43.2s. That is the figure pipeline, whose real
  answer is the `--angle-gl` flag already on `website/scripts/profile-spec.ts`
  ([SCREENSHOT_PERF.md](SCREENSHOT_PERF.md)).

**Don't chase this per display.** The dependency is legitimate wherever render
geometry derives from fetched data (alignments' stacked bands, wiggle's autoscale
domain), so removing one display's read means either duplicating the derivation
outside MobX or pushing a data-arrival concept down into backends whose contract
is "did a draw call run". Both cost more than one wasted submit per arrival.

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

**Status:** Accepted. Proposed and declined the same day.

`RemoteFileWithRangeCache.fetchRange` throws on the first non-2xx, and nothing
anywhere retries it — not this class, not `generic-filehandle2`, not an adapter.
One alignments viewport is hundreds of range requests against a CDN, so a single
transient 5xx, 429 or connection reset fails the whole track.

Automatic retry with backoff was proposed for exactly that and **declined: the
client does not re-issue a request the user did not ask for.** The recovery is a
legible error plus the Retry button the display error chrome already carries
([DISPLAYCHROME.md](DISPLAYCHROME.md) §"The retry contract"). A retry that fires
on its own hides the failure it is recovering from — a server rate-limiting the
page, a missing CORS header, a file half-uploaded — behind a delay, and the
person who could have fixed it never learns it happened.

That puts the whole weight on the message, which is where the work went. Both
halves landed in `RemoteFileWithRangeCache`:

- **A network-level rejection is rewritten.** A CORS denial, a mixed-content
  block, a DNS failure and an offline browser all reject `fetch` with the same
  bare `TypeError`; it now becomes the URL, the byte range, and the triage —
  offline and mixed content where the page can tell them apart, otherwise the two
  CORS headers to add. Every other message the class throws carries the same
  treatment.
- **A stalled connection becomes an error at all.** It used to produce none, and
  every readiness signal downstream was *correct* to keep waiting, because a
  fetch really was in flight — so the user got a spinner that never resolved and
  no Retry to press, the chrome raising one only from an error.
  `RESPONSE_TIMEOUT_MS` bounds the wait for a **response**, not for the bytes: it
  clears when the headers arrive, so a 6.5 MiB coalesced read over a slow link is
  never cut off mid-download. It sits on the shared request inside the chunk
  de-duplication and composes with the caller's signal rather than replacing it,
  or cancellation would stop reaching the socket.

**Retire when** never. Document, don't fix — and if it comes up again, the
question to ask first is whether the error the user saw told them what to do,
because that is the thing retry was standing in for.

### Per-JS-context scoping multiplies by the RPC pool

**Status:** Open. Measured 2026-08-12, `browser-tests/percontext-probe.ts`.

Three read-path resources are scoped per JS context — the BGZF inflate pool,
`RemoteFileWithRangeCache`'s chunk map, and `SharedBudget` — and adapters are
sticky per track to one of `clamp(hardwareConcurrency - 1, 1, 5)` RPC workers, so
each multiplies by however many workers a session spreads its tracks over. Eight
alignments tracks give **five** pools and five reference downloads, not eight:
both quantities track the context count rather than the track count, so the
caches work and their scope is the problem.

Only the third of them should be per context — a worker OOMs on its own heap
(ADR-064). Threads and the network are machine-wide, and are being bounded from
inside a context that cannot see the others.

[BAM_STACK_INTEGRATION.md](BAM_STACK_INTEGRATION.md) § "Seam 1" owns this
subject and is the only place the numbers should be edited: the per-track
counts, the oversubscription A/B that removed the thread-count argument for
fixing it, and the three things a shared `MessagePort` has to settle.
[BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) has the harness and the benchmark
traps.

What keeps it here is the part that is a ceiling rather than a seam: **20
grow-only `WebAssembly.Memory` instances that nothing tears down**, one per
inflate worker. Since `@gmod/bgzf-filehandle` 6.6.0 a pool reaps its own workers
after 3 minutes idle, so the resting level is reclaimed and the peak while
someone is actively browsing is not. That peak is the unmeasured quantity, and
JS heap counters cannot see it.

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
here found exactly two that would banner below 20kb, both
`LinearMultiRowFeatureDisplay` tracks, which set `densityGateEnabled: false`. The
densest track with the axis on peaks at 590 features per 20kb and falls
monotonically. So removing the floor would buy nothing measurable, and keeping it
hides nothing measurable.

Note the shape of those two files: N samples over the same interval, so the
feature count doesn't fall with span at all. That is the density counterpart of
the block-quantized byte case, and the argument that retired the *byte* floor
(measure at the span being judged) has no counterpart here — there is no cheap
index read answering "how many features are in this window".

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
  sub-block's identity, so the key and two object literals were built and
  discarded for every region in an elided run but its first.
  `BlockSet.growElidedRun` widens the run from a width the loop already has, and
  `calculateDynamicBlocks` calls it instead. Output-identical, 4.5-5.6x. Two
  edges keep it that way: the first region can never take the skip, nothing
  having been pushed for the run to merge into, so its leading padding block
  survives; the last is held out because it may still owe a trailing padding
  block keyed off its own key.
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

### The detach-then-destroy discipline stops at the view

**Status:** Accepted. Every door a *view* leaves by is covered, the whole-session
snapshot apply included. Nothing below a view is, and extending it there would be
worse rather than better.

ADR-069's rule is that a tree React may still be rendering is detached, not
destroyed. `MultipleViews.ts`'s `takeOut` is where a view goes out, and undo/redo
goes through it too: `TimeTraveller` calls `takeOutViewsMissingFrom` before its
`applySnapshot`, inside the `skipNextUndoState` bracket so the detach is not
recorded as an undoable step. It needed to, because a whole-session apply
reconciles by `ElementId` and **destroys whatever the target snapshot lacks,
synchronously, inside the action**, with the components still mounted. Measured
on a redo across a closed view: 4 liveliness reads and `getContainingView`'s
throwing branch actually running, down to none.

**Below the view, nodes die where they stand, and that is chosen.**
`hideTrackGeneric` is a plain `tracks.remove`, so closing a track destroys it and
its displays in place. Detaching them instead would trade a warning for a throw:
a **detached display is a live root**, and `getContainingView` walks parents and
throws where a *dead* node only warns. At or above the view is the only place
that walk still lands, which is what scopes the rule.

So the standing cost is a teardown that is loud and, measured, not fatal: every
read is of a scalar or a reference on a display React unmounts in the same
update, and the throw that does occur is stored in a computed nothing reads
again. `undoTeardown.test.tsx` pins both halves — zero for the view, non-zero but
never throwing for the track — so an attempt to "apply ADR-069" below a view
fails there rather than in a figure sweep.

`takeOutViewsMissingFrom` walks `session.views`, so a view nested in another (a
breakpoint-split view's sub-views) is still reconciled to death. No user action
removes one on its own, which is why that is a note here rather than the entry.

**Retire when** a track close and an undo across one both measure zero liveliness
reads. That is the same root cause as the session-switch residual, not a second
one: the undisposed `observer()` reactions in [../TODO.md](../TODO.md)'s
"Destroying an MST tree that something still observes" are what recompute against
the dying nodes, and nothing below a view has to be detached if nothing is left
observing it.

---

## Accessibility

### The primary surface is reachable and named; nothing under it is

**Status:** Mostly closed (2026-08). The four retire conditions this entry
carried are met; what is left is one level down and one axis over.

What landed: the `ViewContainer` Paper is a tab stop (`tabIndex={0}`,
`role="region"`, the header's own title as its name) with a `:focus-visible`-only
ring, and `useFocusOnInteraction` now also listens for `focusin`, so a Tab
**into** a view assigns `session.focusedViewId` on arrival rather than a
keystroke later. Each track's display box carries `role="figure"` and a generated
name (`TrackRenderingContainer`), one polite live region per LGV restates the
settled locstring (`NavigationAnnouncer`), and the ctrl/cmd + arrow bindings are
listed in the Help widget. `browser-tests/probe-a11y-focus.ts` is where the parts
jsdom cannot see are verified — that a click draws no ring, that focus does not
scroll the port, and that Tab reaches the next view.

**Residual, in the order it bites:**

- **The keyboard can reach a view; it cannot reach anything inside one.** No
  feature is focusable, so there is no keyboard path to a click handler, a
  tooltip or a right-click menu. This is the WCAG 2.1.1 half that is still open,
  and it is the expensive one: features are canvas pixels, so it needs a
  navigable model of what is drawn, not an attribute.
- **The announcer and the track name are LGV-only.** Dotplot, circular, synteny
  and breakpoint-split get the container's name and role and nothing else.
- **Four bindings, all needing a modifier.** No bare arrow keys (they would have
  to not fight page scroll), no `?` to open the list, nothing for the actions a
  mouse user has — zoom to region, track menu, search.
- **`role="figure"`, not `role="img"`.** `img` is the textbook role and makes
  descendants presentational, which is wrong while a display draws interactive
  chrome inline rather than portaling it out (`GroupLabelsOverlay`'s group
  collapse buttons). Worth revisiting if that ever changes.
- **A stack of views on one assembly gets one name repeated.** `viewTitle` falls
  back to the assembly display name, so three LGVs on volvox are three landmarks
  called "volvox". The header has the same ambiguity; whether the accessible name
  should disambiguate where the visible title does not is a product decision.

**Retire when** a display's features are reachable and actionable from the
keyboard. The four below it are each something a reader can trip over without
knowing it exists — which is what keeps them here rather than in
[../TODO.md](../TODO.md) — but none of them is a shape problem any more.

---

## Coupling

### Canvas feature tracks bake appearance into worker output, so a color or theme change refetches

**Status:** Open.

`LinearBasicDisplay`'s `rpcProps()` returns the slots the worker reads plus
`theme: getSession(self).themeOptions`. Every returned field is an RPC cache key,
so `SettingsInvalidate` fires `clearAllRpcData()` and every visible region
refetches. **A light/dark toggle, or one color slot edit, re-downloads and
re-parses every region of every canvas feature track.**

**The payload is picked, not filtered, and that half is closed.** It used to be
the whole `getConfigSnapshotWithPromotables` snapshot minus a hand-kept exclusion
list — which, over a walker that emits *every* slot including defaults, made a
slot that was neither read by the worker nor named in the list a silent refetch
trigger, introduced by omission. Ten names had accumulated, and the ones that
mattered were inherited from `BaseLinearDisplay`'s schema rather than written in
canvas, where nobody adding one would look. `height` was among them, and it is
written on *every resize-handle drag frame* (`TrackContainer` → `resizeHeight` →
`setConf`), so dragging a canvas track taller re-ran the whole worker pipeline
once the drag settled. `pickDisplayConfig` (`RenderFeatureDataRPC/renderConfig.ts`)
inverts it: `WORKER_READS` is a `Record<keyof DisplayConfig, true>`, exhaustive
in both directions with no helper, so a slot reaches the worker only by joining
`DisplayConfig` and forgetting means the feature does not work — which someone
notices — rather than every unrelated write refetching, which nobody does.

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
appearance-affecting halves and grows a `gpuProps()`. The consistent fix has the
worker emit a per-feature color *class index* plus the attributes jexl needs, and
resolve the palette in the main-thread encoder, as synteny's `computedColors`
already does. The cheap intermediate is a worker-side parsed-feature cache keyed
by adapter + region + the non-visual payload, so a color change re-encodes
without re-parsing.

The pick above is what makes that split tractable rather than a prerequisite for
it: `WORKER_READS` is already the list of what the worker actually consumes, so
the question left is which of those slots are appearance rather than which slots
are in the payload at all.

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

**A test run fails on any of them** (2026-08). `config/jest/console.js` buffers
every message carrying the `[jbrowse display contract]` prefix and
`config/jest/displayContractGate.js` — in every jest project's
`setupFilesAfterEnv` — fails the test that collected one, quoting it verbatim.
What changed is who *listens*; the reporting channel is unchanged and stays
that way, for the reason above. Before it, a violation printed into a run that
prints thousands of lines and nothing failed, which is one notch above silent.
A test that provokes a violation on purpose takes the messages with
`takeDisplayContractReports()`, which is both the opt-in and how it reads them;
a test that replaces or mocks `console.error` takes itself out of the gate
entirely, which is why the display harnesses silence `console.warn` only.
Attribution is honest in one direction only, and the failure says so: a check
firing from a debounced autorun lands after the test body returns, so it fails
whichever test ran next, and anything arriving after the last test fails the
file rather than being attributed wrongly.

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

- **A fetch installer's triggers must be read above its gate.** MobX rebuilds
  the dep set per run, so a read under the gate drops out of it. Arc shipped a
  dead `reload()` from exactly this (ARCHITECTURE.md §"The global-fetch trigger
  list must be read unconditionally"). This one is a *shape*, not a state, so no
  attach-time read can see it.

  **Narrower than it reads.** `installGlobalFetchAutorun` reads all four of its
  triggers itself and calls `shouldFetch()` on every run, so everything the
  display's gate reads is tracked even on the run that declines — HiC's
  `effectiveResolution` looks like a counterexample and is not, since the gate
  expression reads it. What is exposed is `installComparativeFetchAutorun`, whose
  `prepare()` may `return undefined` above its own reads; held today only by the
  convention that whatever it bails on is itself observable.
- **An `installPerRegionLifecycle` `encode` must read a narrow inputs getter,
  never `renderState`.** The encode body runs inside the per-key autorun, so
  every observable it touches re-encodes *every* region — and a `renderState`
  carries the canvas box and row geometry, which move on each frame of a height
  drag. The failure is not wrong pixels but tens of MB per frame of
  byte-identical output, which reads as "the GPU path is slow". Two call sites
  each carry a paragraph about the time they got it wrong
  (`LinearMultiRowFeatureDisplay`'s model, MAF's `stateModel`), and prose is the
  whole enforcement. Probably checkable — the encode is a pure function the
  installer calls, so it could run once at attach inside a MobX probe that
  reports which observables it touched, and compare against `gpuProps()`'s set.

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

`agent-docs/` is 40k lines against the 28 in-tree `CLAUDE.md` files' 2k. The
`CLAUDE.md` half was cut from 3.7k lines to 840 in 2026-08 — rationale,
measurements, and rejected alternatives dropped in favor of the imperative rule
alone, on the theory that git history and the ADRs already hold the why.
`agent-docs/` itself has had no equivalent pass, and the ratio is the entry:
almost all of the contract now sits in the half nothing trimmed. Rules the
compiler already owns are still written as warnings, spending the attention the
unenforceable ones need.

Alongside them sit hand-maintained membership lists in a doc set that explicitly
warns against enumerations and lists autogenerating them as a follow-up
(PLUGIN_ABI_STABILITY.md §"The same disease rots the docs").

**What a pass actually finds is drift, not verbosity**, which is the thing to
know before budgeting one. The 2026-08-15 sweep of `reference/` turned up almost
no prose worth cutting for its own sake; what it turned up was references that
had quietly stopped resolving — fourteen stale paths, two stale section
citations, a "key functions" table naming a helper that no longer exists, and
two docs describing a config payload the code had since inverted. Every one of
them was invisible to a reader and to CI. So the lever is coverage rather than
editing: each was found by widening `check-doc-imports.ts`, and each class it
now checks cannot come back.

**The sharpest of those classes is a comment a rename inverted.** A rename
sweeps every use of a name, including the sentence recording the rename — which
is written in the old name, so the sweep turns it into "the current name was the
bad one", carrying the old sentence's argument for it. Nothing else can see it:
tsc resolves the identifier, the doc checkers see a live symbol, and the diff
looks like a rename correctly touching a comment. `RegionTooLargeMixin.ts`
carried **three at once** from one rename, and a hand audit of that same file
found only the first. `check-rename-archaeology.ts` is the detector — a
past-tense rename idiom naming an identifier the same file declares — and its
corpus is at zero.

**The membership half is largely done.** Display stacks, cross-cutting mixins,
DisplayChrome's adoption map, gated budgets and the display-hook overrides are
all generated; the pin-coverage list is a test baseline. The last two also
*assert* something a table cannot — that a promotable slot has a pin somewhere,
and that a hook is still declared by the file owning its default. That is the
shape to reach for: a generated list is prevention, one with an assertion under
it is repair.

**Retire when** each surviving "Don't" either names the machine that enforces it
or is deleted because `tsc` already owns it. The list-generation half of this
entry's original retire condition is met.
