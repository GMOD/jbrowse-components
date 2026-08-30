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
- **Statuses:** Mitigated (a mechanism bounds it, root cause remains),
  Accepted (a cost we chose, with the reason), Open (unbuilt, and we would
  take a fix).
- **Not a backlog.** An entry earns its place by being something you can trip
  over without knowing it exists. Work items go in [../TODO.md](../TODO.md).
- **New entries must be measured or code-verifiable.** Cite the mechanism, not
  the symptom.

---

## GPU / rendering

**Every number in this section came off one machine** — Firefox Nightly or
Chrome 151 on an Intel UHD 630. Each entry's provenance line says so.
[GPU_PORTABILITY.md](GPU_PORTABILITY.md) is the complement: what a conformant
implementation guarantees anywhere, which of these limits the code queries at
runtime rather than assuming, and how much headroom the widest in-tree shader
has over the floor. Read it before generalizing a figure below to hardware
nobody here owns.

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
- **Bounded auto-recovery** in `useRenderingBackend`, spending a `RecoveryBudget`:
  at most `MAX_RECOVERIES` re-inits on backoff. **The budget is windowed, not
  lifetime** — `record` restarts the count once `RECOVERY_WINDOW_MS` has passed
  since the last loss, so what the cap bounds is a flap, and two losses a minute
  apart are two first attempts. `reset` clears it outright, only on a genuine
  `webglcontextrestored` or a manual Retry.

Still exposed: tracks inside a mounted view are not virtualized, so one LGV with
17 GPU tracks allocates 17 contexts and crosses the ceiling.

**Retire when** WebGL2 retires (RFC-001 §13a) or track-level mount/release lands.
The measurement that gated both is done, and it says track-level mount/release is
worth building. One unbuilt interim move is left: drop a display to Canvas2D
after K context losses, so the failure is one slow track rather than a wedged
page. The other one — pick Canvas2D up front when the renderer string says
software — shipped: `createGpuHal` steps over the WebGL2 rung when nothing was
pinned and `getGraphicsCapabilities` reports a software rasterizer
(`packages/render-core/src/hal/createHal.ts`), with the measurement behind it
and the two things that check must not break in
[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md).

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
`gpuDevice.acquire` raises to the adapter's own maximum, 2147483644 bytes
(~2 GiB) on the Firefox Nightly / Intel UHD 630 measured here. WebGL2 can query
no such limit, so it refuses past a fixed `MAX_VERTEX_BUFFER_BYTES` of 256 MiB,
WebGPU's spec default. **WebGL2 is therefore the stricter of the two**, and a
region can banner there while rendering on WebGPU. That is the accepted
direction: the unguarded alternative on WebGL2 is not a failed allocation but a
dropped context, which on a page at the context ceiling evicts a sibling and
starts the cascade in [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md).

**Retire when** a HAL byte counter with cross-display LRU prune exists, or an OOM
report arrives that the per-object guards missed. The counter's first customer
is the MSAA target below, measured at 79 MiB for a single tall track — larger
than every instance buffer under it, and counted nowhere.

### The MSAA target is the largest per-display allocation, and nothing counts it

**Status:** Open on size, and the size is now measured on both rungs of dpr —
`products/jbrowse-web/browser-tests/probe-msaa-resize-cost.ts`, Firefox Nightly,
2026-08-16 at dpr 1 and 2026-08-22 on a retina panel. **The per-frame
reallocation it used to also claim is measured and free**, at both.

`WebGPUHal` holds one 4x MSAA color attachment sized to its own canvas
(`recreateMsaaTexture`). **It is per display, and its size has nothing to do
with the data** — canvas area x dpr² x 4 samples, so an empty 600px-tall track
costs exactly what a full one does. Measured, not derived: a 1266x600 canvas is
11.7 MiB, and dragging that track to 4100px takes it to **79.2 MiB for one
track**. That is an order of magnitude past the instance buffers the OOM guards
do check, and `recreateMsaaTexture` compares against `maxTextureDimension2D`
and nothing else.

**The multi-track figure is no longer an extrapolation.** On a retina panel
(dpr 2, `layout.css.devPixelsPerPx` pinned so the arms differ in nothing else),
**eight GPU tracks at their default heights hold eight live targets totalling
109.7 MiB** — against 27.4 MiB for the same session at dpr 1, the dpr² term
exactly. One alignments track dragged to the canvas clamp holds **316.5 MiB** by
itself in a 1266 CSS px window. Nothing counts any of it, and the session that
produced the 109.7 is nobody's idea of a heavy one. The table and the repro are
[GPU_PORTABILITY.md](GPU_PORTABILITY.md) §"The one number that generalizes badly".

**What was measured is what the descriptor asks for, not what is resident**, and
on one class of GPU those differ. `beginFrame` attaches the MSAA view with
`storeOp: 'discard'` and a `resolveTarget`, which is exactly the shape a tiler is
allowed to keep in tile memory and never commit — so on Apple Silicon (a large
share of our users) these figures may be near zero, while on the immediate-mode
AMD/Intel parts they were taken on they are real. **Profile residency at 4x
against 1x before spending anything on the size**: it is the first item in
[../ideas/arc-antialiasing-without-msaa.md](../ideas/arc-antialiasing-without-msaa.md),
and if the target turns out memoryless the rest of this entry is moot on that
hardware.

**Where those bytes went is the lever.** The eight targets were 2532x1200
(46.4 MiB), 2532x500 (19.3), three at 2532x200 and three at 2532x180 — one per
display, each the size of its canvas and none of it the size of its data. And
almost all of what those displays draw is **axis-aligned quads** — pileup reads,
coverage bars, wiggle, matrix cells — which 4x multisampling does approximately
nothing for. The curves that motivated MSAA in the first place are a
minority of displays — and, measured 2026-08-22 at 4x against 1x, the
read-connection arcs **do not depend on it at all** any more: `arc.slang` has
measured an analytic conic distance in the fragment since 2026-08-01, and the two
sample counts differ across the whole arc band by at most one 8-bit level. What
still depends on it is wiggle and coverage **bar tops** (where the edge is the
datum, so this is an encoding rather than a silhouette), read arrow tips, and the
tiled hi-C/LD diamonds, whose conflation at shared cell edges is the one thing
per-fragment AA cannot fix.

**The sample count is now a property of the display**, not of the build:
`RenderingBackendOptions.sampleCount`, threaded to `WebGPUHal` and read by every
render-pass, texture and pipeline decision it makes, with 1 meaning no target at
all rather than a smaller one. The obstacle that used to be stated here — the
multisample state is baked into the pipeline and pipelines come from a
device-wide cache — is gone: `getOrBuildPipeline` keys on the sample count as
well as on descriptor identity. **A split costs no duplicate compiles**, which
was the worry and is now a measurement: with one display family moved to 1 and
the rest left at 4, a four-track scene compiled 8 pipelines and an eight-track
scene 32, the same totals as the all-4x build, because no `PipelineDescriptor`
object is reachable from two displays' pass lists.

**Every display still asks for 4**, so none of those bytes have gone anywhere
yet. Which displays should drop to 1 is a look-at-the-pixels decision taken one
display at a time, and the captures to look at are in
[../ideas/arc-antialiasing-without-msaa.md](../ideas/arc-antialiasing-without-msaa.md).
WebGL2 has no counterpart in our accounting, because `antialias: true` puts the
multisample backbuffer inside the browser's budget.

**Rebuilding it every frame is what turned out not to matter, and the number is
worth keeping so nobody re-derives the worry.** The mechanism is real and
confirmed exactly: `GpuPerRegionRenderingBackend.renderBlocks` calls
`hal.resize` each frame, `syncCanvasSize` reports the change, `useResizeDrag`
commits one height per animation frame — 250 drag frames produced **250** MSAA
rebuilds, against **0** for a pan of the same length, which is the control that
makes the number mean anything (same renderer, same per-frame repaint, constant
canvas). The cost of those 250 rebuilds of a texture growing to 79 MiB was
**1.9 ms of JS in total**, ~8 µs a call and flat in texture size, with the
median frame interval identical to the pan arm's (20.84 ms against 20.74 ms).
The driver is plainly not committing the memory at create time.

Two limits on that result, both in the probe's header. `createTexture`
returning fast is not proof the work did not happen, which is why the frame
interval is measured too — but rAF is vsync-bound here, so the frame column can
only say the cost fits in the frame's slack. And this is one driver; a stack
that does commit on create would read differently.

**The fix that looks obvious is illegal, which is the other thing to keep.** A
render pass validates that its `resolveTarget` is the same size as its
multisampled `view`, so an MSAA texture kept deliberately oversized and reused
across sizes cannot be attached. Growing in steps and shrinking on settle — the
hysteresis this appears to want — is not a legal shape. Quantizing the *canvas*
is, and now has nothing to buy.

**Retire when** a HAL byte counter sums live GPU bytes across displays and this
becomes a line in it, since the size is the whole entry now. The probe's
`--tracks=N` census is that sum taken from outside, by patching `createTexture`
and `destroy` in the page — which is worth knowing twice over: it is how the
109.7 was taken, and it is the shape the in-tree counter would have. Don't reopen the
reallocation without re-running the probe on a driver that behaves differently;
the numbers above are what a change has to beat.

### Every WebGPU display resolves its whole pass list before it can paint

**Status:** Accepted, measured — `products/jbrowse-web/browser-tests/probe-webgpu-pipeline-cost.ts`,
Firefox Nightly on an Intel UHD 630, 2026-08-16. The eagerness is real and
costs about 22 ms of off-thread work once per page.

The two HALs sit on opposite sides of a decision WebGL2 made deliberately.
`WebGL2Hal.getPass` links a program on its first *draw*, with a one-descriptor
canary in the constructor so an unusable GL stack still falls to Canvas2D; its
comment records a three-track LGV that declared 29 programs and drew with 14.
`WebGPUHal.create` awaits its whole declared list — alignments declares 23 — and
does it before acquiring the canvas context, so a track's first paint waits on
every pass it could ever draw, including the ones behind a `colorBy` nobody
selected.

That is the shape GPU_CONTEXT_BUDGET.md measured on the other backend, where
**the load-time pipeline build**, not the per-pass rebuild, turned out to be
what costs. It does not repeat here, and the reason is that
`createRenderPipelineAsync` keeps its word. The 23 resolve **concurrently**:
390 ms summed across them but 21.6 ms for the slowest, so the batch is about
22 ms of wall time and none of it is main-thread. Against a cold load's 4.0 s
to first paint, and 1.9-2.6 s warm, that is not where a track's startup goes.

**Going lazy would cost more than it saves**, which is the other half of
accepting it. `drawPass` is synchronous and `createRenderPipelineAsync` is not,
so first-draw compilation means either the synchronous `createRenderPipeline`
— the main-thread block this avoids — or skipping the draw until the pipeline
lands, which is a visibly missing layer on the frame that first needs it. WebGL2
has neither problem: linking is synchronous there anyway.

**The set is also shared across displays**, which is what keeps the 22 ms from
multiplying — `hal/deviceGpuCache.ts` memoizes pipelines and the two bind group
layouts per device, keyed on the `PipelineDescriptor` object itself. A/B'd by
bypassing the pipeline memo and nothing else, one page load per row, cycling
real alignments tracks:

<!-- prettier-ignore -->
| tracks | pipelines + WGSL parses | | summed resolve | | slowest one | | to all-drawn | |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | **cached** | *bypassed* | **cached** | *bypassed* | **cached** | *bypassed* | **cached** | *bypassed* |
| 1 | 23 | 23 | 445 ms | 406 ms | 24.8 ms | 21.5 ms | 4874 | 3985 |
| 2 | 23 | 46 | 416 ms | 4421 ms | 22.2 ms | 158.8 ms | 2429 | 3595 |
| 3 | 23 | 69 | 452 ms | 3831 ms | 23.7 ms | 71.2 ms | — | 2087 |
| 4 | 23 | 92 | 439 ms | 6292 ms | 21.6 ms | 88.4 ms | 2598 | 1982 |

**The one-track row is the control**: with nothing to share the two arms agree,
so the rest of the table is the cache and not build-to-build noise.

Read it as two findings, and the second is the one that keeps this entry
Accepted rather than closed as a win. The cache removes real work — 4x fewer
pipelines and, because `createShaderModule` is synchronous, 4x fewer
main-thread WGSL parses, with summed compile time 14x lower and the slowest
single compile flat at ~22 ms instead of degrading to 88 ms as compiles contend.
**And none of it reaches the user**: to-all-displays-drawn does not improve, and
the bypassed arm is nominally faster on two of the three rows that recorded
both arms (the cached 3-track run never reached all-drawn). Startup here is
fetch and parse bound, the same answer ["a region arrival draws
twice"](#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data)
reached about draws. What the cache buys is headroom and memory — 92 pipeline
objects and 92 shader modules held for the page's life against 23 — not a
number anyone feels at four tracks. Seventeen would be 391.

It stays flat because those tracks share a display type and therefore the same
module-const pass array. A session of four *different* display types builds four
sets, correctly — that half is reasoned from descriptor identity and pinned in
`deviceGpuCache.test.ts`, not measured here. The cache is exact rather than
approximate because `slangPass` reads `wgslSource` off a generated const, so
descriptor identity already means "same shader, same layout, same blend, same
topology" — and two passes sharing a `.slang` shape module get separate entries,
because `slangPass` built them separate objects. It holds the in-flight promise
rather than the resolved pipeline, which is the half that matters: many tracks
mount in one tick, so a memo of finished compiles would miss on all of them.

**Retire when** never, unless a machine turns up where the batch is not
concurrent. Re-run the probe there before building anything; the numbers above
are what a change has to beat, and the lazy path has a visible cost the eager
one does not.

### A uniform write binds to its draws by adjacency, and the HALs mean different things by it

**Status:** Accepted, latent — no renderer in tree violates it, and it is
checkable now where it was silent.

`WebGL2Hal.writeUniforms` does an immediate `bufferSubData` into one UBO.
`WebGPUHal.writeUniforms` stages into a ring slot, and `drawPass` binds slot
`uniformSlot - 1` — "whatever was written most recently". The two agree only
while every renderer writes-then-draws adjacently, which every renderer does.

The API still cannot say otherwise: `writeUniforms` returns nothing, so a
renderer cannot name the slot it wants a draw to read. One that batched its
writes and then issued its draws would be correct on Canvas2D and WebGL2 and
silently wrong on WebGPU — the failure class `packages/render-core/CLAUDE.md`
says this package exists to refuse, and the cross-backend gate cannot see it,
since every renderer it compares obeys the convention.

**What changed is that a unit test can now ask.** `MockDraw.uniformWrite`
records which write each draw reads and `MockHal.uniformsOf(draw)` returns its
bytes, exactly as the clip log already records the scissor in force — and for
the same reason, that this is *state* rather than an argument, so a test asking
off `calls` has to re-implement the pairing. A backend suite that pins its
renderer's writes to its draws catches the batched shape at the point it is
introduced, rather than on a WebGPU browser nobody ran. `mockHal.test.ts`
§"MockHal uniforms per draw" carries the shapes, including the legal one (two
draws sharing one write).

The ring's cost is fixed and paid whether a renderer writes 4 slots or 1900:
`MAX_UNIFORM_SLOTS` x the device-aligned uniform size, as a GPU buffer **and** a
CPU staging array. Alignments' 864-byte uniform aligns to 1024, so 2 MiB on each
side per alignments HAL.

**Retire when** `writeUniforms` returns a slot token that `drawPass` takes and
WebGL2 ignores. Cheap, and the reason to wait is that nothing needs it yet —
take it the first time a renderer wants two uniform sets alive at once.

### A canvas past `MAX_CANVAS_DIM_PX` renders wrong, not smaller

**Status:** Fixed 2026-08-22, by the retirement condition this entry had been
carrying: the effective dpr is threaded. Kept because the *shape* of the trap
recurs — a size the browser silently declines to give you, and rects derived
from what you asked for rather than what you got.

`backingPx` (`packages/render-core/src/canvas2dUtils.ts`) caps a backing store at
`MAX_CANVAS_DIM_PX` (8192 physical px per axis) so an oversized canvas can't
throw `InvalidStateError`. But the cap applies only at the canvas: every
downstream rect is still derived as `cssPx * getDpr()` from the **true** dpr
(`clipBlock`, alignments' `computeBlockGeom`, the per-region base's `pxH`). Past
the cap the browser stretches the smaller backing store over the larger element
*and* the scissor/viewport rects can exceed it, where WebGL2 clamps silently and
WebGPU rejects the rect and blanks the frame. The one-shot `console.warn` reads
like a cosmetic notice.

**It was filed as unreachable, and it was not.** The argument was that canvases
are viewport-sized everywhere except MAF's rows canvas, which self-bounds via
`maxRowsHeight` (`MAX_CANVAS_DIM_PX / getDpr()`) — and **any new display sizing a
canvas to content still must copy that bound**, because nothing mechanical
enforces it. What the argument missed is that a per-region display's canvas is as
tall as the *display*, and the display's height is a number the user drags:
`TrackHeightMixin`'s `setHeight` / `resizeHeight` clamp at `MIN_DISPLAY_HEIGHT`
and at no maximum. Walking one alignments track's height up at dpr 2 put the
edge between 4000 CSS px (paints) and 4200 (blank, no banner, no console error,
no `display.error`); shrinking it back restored the render, and the same walk at
dpr 1 painted all the way to 8000. The GPU said what the UI would not — `In a
set_viewport command … Viewport size { w: 2532, h: 8400 } greater than device's
requested maxTextureDimension2D` — which is `cssHeight * getDpr()` against a
backing store clamped at 8192.

**The fix is that `syncCanvasSize` now reports the scale each axis actually got,
and every device-px rect derives from that** rather than from the free
`getDpr()`: `hal.resize` returns it, `clipBlock` takes it per-axis (only one axis
clamps at a time), and alignments' `bufH` / `computeBlockGeom` read it the same
way. `prepareCanvas` transforms by it too, which is the Canvas2D half — that path
used to stretch its top slice over the whole track. Past the clamp a display now
draws at reduced resolution, which nobody can see at a track height no screen
shows at once, instead of not drawing. Verified on the panel that broke it: at
dpr 2 the walk paints to 8000 CSS px with no validation error at any height.
`blockClipUtils.test.ts` and `canvas2dUtils.test.ts` pin both halves.

**What still reads the true dpr, correctly, is the uniform.** A stroke width
wants screen density; only rects want target extent. That divergence is the
entry's remaining sharp edge: at a clamped canvas a 1px stroke is ~2.5% off, and
anything new that mixes the two spaces will be wrong in a way no test here
covers.

**Retired by** `syncCanvasSize` / `prepareCanvas` reporting the ratio they
actually used, threaded through `clipBlock` and alignments' geometry instead of
the free `getDpr()` — which is what the paragraph above describes.

**The dpr cap is what makes it this hard to reach.** `getDpr()` returns
`min(devicePixelRatio, MAX_DPR)` with `MAX_DPR = 2`, so an axis has to reach 4096
CSS px to clamp, not 2731 as it would at dpr=3. That is a bound on how bad it
gets, not on whether it happens — this section used to read "retina is
unaffected; the cap only bites above it", which is the opposite of the sentence
before it: 4096 CSS px is *exactly* what a retina panel clamps at, and a
dragged-tall track reaches it. Capping *inside* `getDpr` is what keeps it safe — every consumer
reads the same capped number, so the backing store, the rects derived from it and
the variant-matrix shader's `devicePixelRatio` uniform cannot disagree. **A call
site reading the global `devicePixelRatio` directly re-opens that split.** Two
places diverge on purpose: `createSvgRasterCanvas` pins 2x because export goes to
a file rather than a screen, and the analytics / error-report paths read the raw
global because they are reporting the device, not drawing on it.

### A region arrival draws twice wherever the render autorun observes the data

**Status:** The systematic half is retired ([ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md),
2026-08-19). What remains is a measured surplus nobody has explained, and it was
already known not to matter.

**The cause was a deferred upload, not observer order.** This entry used to say
the render autorun can be notified before the upload autorun and that nothing
should rely on the order. The upload autorun ran first all along; what it did was
*spawn* the per-key autorun that owned the upload, and an `autorun` created inside
a running reaction is scheduled rather than run inline. So the upload could not
happen in the pass that decided to do it: a render callback observing the map
painted the pre-upload state, and the real state followed on the `renderTick`
bump. `installUpload` now uploads inside the upload autorun's own
run, which closes the window — `uploadOrder.test.ts` pins upload-then-paint for
both the direct read and the computed chain, and the count that used to read
**9** renders for 4 arrivals reads **5**, the same as a callback that ignores the
map.

**What matters is still the render autorun's dependency set, not any one
syntactic read** — a direct `rpcDataMap` read and a computed chain reached
through `renderState` both wake it. That is why the fix had to be on the upload
side: the reads are legitimate, and the two tests pin both shapes.

Three code paths have such a dependency. Only the first is outside the helper,
so only it is untouched by ADR-078:

- **`LinearAlignmentsDisplay`** reads the map directly (`rpcDataMap.size === 0`,
  for the zero-group grouped-fetch reason in [HISTORICAL.md](HISTORICAL.md)
  §"Each display asserted its own 'did we paint?'") **and** transitively:
  `renderState.sections` is `buildSectionRenders(self.sections, …)`, and
  `sections` reaches `groupOrder` / `laidOutByGroup` through `drawnLanes` →
  `lanes` → `buildLanes`, both of them derived from `rpcDataMap` (`groupOrder`
  reads it outright). Deleting the gate would leave the second path in place, so it
  would not stop the double draw. Band geometry has to follow the laid-out data,
  making that path structural. `model.coupling.test.ts` §"a region arrival
  invalidates renderState, not just the size gate" pins it.
- **`LinearManhattanDisplay`** passes `self.rpcDataMap` into `renderBlocks`,
  where the renderer `.get()`s per block inside the render autorun.
- **The wiggle family** through `renderState` → `domain` →
  `visibleStatsDomain` (`WiggleCommonMixin`), which reads `rpcDataMap.size` and
  `.get()`.

Two things that already coalesce correctly, so don't "fix" them:

- **Settings fan-out.** One encoder-input change with 4 regions loaded re-encodes
  all 4 regions and yields exactly **1** render: it is one upload autorun run,
  and its single `renderNow()` bump lands while the render reaction is already
  scheduled.
- **Pan and zoom.** Wheel, drag and side-scroll batch their MST writes into one
  `requestAnimationFrame` (`useSideScroll`, `useVirtualScrollWheel`,
  `usePointerDrag`, `useRafCommit`),
  so a gesture commits at most once per frame.

**Deferring the `renderTick` bump was the wrong end, and that is worth keeping.**
A `renderSoon()` replacing the `renderNow()` could not work while the upload was
deferred: the stale draw was the one already scheduled, so deferring the tick
deferred the *correct* draw and left the stale one as the frame's only paint.
Measured with a frame-coalesced `renderNow`: 4 arrivals gave 9 renders, exactly
the un-deferred count. Moving the upload rather than the paint is what fixed it.

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
is more redundancy here than this entry describes. Both arms predate ADR-078,
which removes 24 of that 72 on this display and explains none of the rest —
whatever the other 24 are, they are not the arrival draw. Removing two thirds of it
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

### The LD triangle is materialized in full, so its ceiling is quadratic

**Status:** Mitigated by `maxVariantSeparation`; Accepted at that slot's
default, which is the full triangle.

**Provenance: Chrome 151 on macOS/Metal, Apple silicon, 2026-08-24** — not the
Intel UHD 630 this section's preamble names. The storage-buffer limit differs by
4x between them and is the binding constraint here, so re-measure before quoting
these on other hardware.

`getLDMatrix` computes every pair and returns one `Float32Array` of
`n*(n-1)/2` cells, which `RenderLDData` transfers whole to the main thread. The
cost of a view is therefore quadratic in the SNP count, and **the ceiling is the
output matrix, not the kernel**.

`planLDDispatch` checks that matrix against `maxStorageBufferBindingSize` and
`maxBufferSize` and returns null when it does not fit, dropping to the CPU path:

| adapter                    | cap          | max SNPs   |
| -------------------------- | ------------ | ---------- |
| WebGPU spec floor, 128 MiB | 33.5M cells  | **~8,193** |
| this machine, 2 GiB        | 536.9M cells | **32,768** |

Bracketed by measurement at 2000 samples: n=32,000 dispatches, n=33,000 and
n=50,000 decline. A 1000-Genomes-scale 50,000 SNPs needs **4.66 GiB** and about
**25 minutes** on the CPU fallback (measured 1195 ns/cell). `fetchSizeLimit`
(5 MB, `VcfTabixAdapter`) refuses the underlying VCF long before any of that
runs, which is why this surfaces as a limit rather than as a hang.

**The shader does not move the scale, only the band.** A 20x speedup on an n²
problem buys sqrt(20) ~ 4.5x more SNPs. Measured at one second of latency, the
ceiling is ~1,300 SNPs on CPU and ~4,000 on GPU — real, and worth having, but
not a different order of magnitude. Within that band the win is large (phased,
2504 samples: 510ms -> 31ms at n=800, 1741ms -> 89ms at n=1500); past n=16,000 the
GPU itself takes tens of seconds.

Two sub-points on the input side, both settled since:

- **Both kernels are bit-planed, and the composite one is the cheaper input.**
  `ldCompute.slang` looped per sample over genotype bytes until 3f4c3f6ee4 took
  the same three planes `packDosages` already builds. Its input is therefore
  `n * 3 * ceil(samples/32) * 4` bytes rather than `n * samples`, exactly 3/8 of
  it once `samples` is a multiple of 32, and the phased kernel's four planes
  (`n * 4 * ceil(samples/32) * 4`) are now the larger of the two. At 2,504
  samples the composite input for 50,000 variants is 45.2 MiB where the byte
  loop needed 119.4 MiB. That port also fixed a correctness bug — see the
  detector below.
- **`planLDDispatch` now checks BOTH buffers.** It weighed only the output; the
  genotype input reached the device unchecked and survived by an accident of
  ordering, since `createBuffer` runs before `runGPUCompute`'s
  `pushErrorScope('validation')` and what that scope actually caught was the
  later `setBindGroup` against the invalid handle. Refusing at plan time costs
  no allocation and says the same thing deliberately. Where the byte loop broke:
  `n * samples` at 128 MiB, i.e. 53,601 variants at 2,504 samples, or 65,536
  samples at n = 2,048. Bit-planed: 141,579 variants at 2,504 samples, and
  174,752 samples at n = 2,048 — 8/3 more room, which puts the input clear of
  the output ceiling (~8,193 variants on a 128 MiB-floor device) for any cohort
  a browser would load. `planLDDispatch.test.ts` holds these four figures.

**Which estimator runs is a config slot, not a property of the file.**
`ldMethod` ('auto' | 'phased' | 'composite', `SharedLDConfigSchema`) is
resolved by `resolveLDMethod`, and the two directions are asymmetric: composite
is honoured whatever the callset carries, phased is a preference that unphased
data declines. Neither choice changes the ceilings above, since the two kernels
now read three planes and four planes of the same width and cost the same order.

**Genomic mode costs 5x this, and the check does not see it.**
`buildGenomicCellBuffers` allocates `positions` and `cellSizes`, two more
`Float32Array(numCells * 2)`, so `useGenomicPositions` is 20 bytes/cell against
`ldValues`' 4. `planLDDispatch` weighs `ldValues` and the genotype input, not
these, so the ceilings above are the uniform-mode ones; genomic mode reaches the
same wall at a fifth of the SNPs.

**A dispatch that comes back incomplete raises nothing, so a spot check reads
it back.** This is the correctness bug 3f4c3f6ee4 fixed by making the kernel
fast: the byte loop was slow enough on wide windows that workgroups failed to
run, and the cells they would have written stayed the zeros the buffer was
created with. That is a plausible LD matrix. Against its own CPU twin at 50,000
variants over 2,504 samples on a Radeon Pro 5300M, max |gpu−cpu| went 2.8e-8 at
a 200-variant window, 1.2e-2 at 500, then 1.0 at 1000 and 2000 — a zero where
the answer is r² = 1 — and the 2000 row returned in 411 ms against the 1000
row's 17 s, non-monotonic in the work, which was the tell. `pushErrorScope`
cannot see it: the dispatch is valid, it is submitted, and `mapAsync` resolves.

Speed is not a detector, so `ldGpuSpotCheck.ts` is: after the readback,
recompute about a dozen cells on the CPU — weighted to the end of the flat
order, where a truncated dispatch leaves its hole — and throw if any disagrees
by more than 1e-3, which routes the matrix to the CPU path with a reason. The
tolerance sits between the f32-vs-f64 gap the kernels legitimately show (2.8e-8
to 6.0e-7 across every window measured after the port) and the smallest
disagreement truncation produced (1.2e-2). The cost is O(samples) per probed
cell against a dispatch only reached when `numCells * samples` is at least
500,000.

**The mitigation is `maxVariantSeparation`** (`SharedLDConfigSchema`), plink's
`--ld-window`: pairs separated by more than `k` variants are not computed and
not drawn, so the matrix is `n*k` cells and the cost is linear in the variant
count. At 50,000 SNPs a `k = 500` window is 24,874,750 cells (~95 MiB), inside
even the 128 MiB spec floor, against 1.25e9 cells (4.66 GiB) for the full
triangle.

It is a **semantic** change, not a free optimization, and the slot therefore
defaults to 0 (the full triangle) rather than to some window: both display modes
draw every cell they are given. `canvasHeight` is
`squashToHeight ? ldCanvasHeight : canvasWidth / 2` and `computeTriangleYScalar`
squashes the natural apex height into the display rather than clipping it, so
nothing is off-canvas at any zoom and there is no window that is invisible to
pick. Choosing one says pairs past `k` are not shown.

`ldBand.ts` owns the layout, and the property that made it affordable is that
**it generalizes the triangular one rather than replacing it**: rows are ragged,
`rowStart(i) = m*(m-1)/2 + (i-m)*k` for `m = min(i, k)`, so once the band covers
a row the second term vanishes and the index is the `i*(i-1)/2 + j` it always
was. An unbanded run is bit-identical to the pre-band code, which is why the
existing suite needed no expectation changed. A flat `i*k + (i-j-1)` would be
simpler arithmetic but costs `n*(n-1)` cells at `k = n-1` — twice the triangle —
and loses that collapse.

**Retire when** nothing needs the full triangle, i.e. when the default flips.
That is a product decision about what an LD view means, not an engineering one.

---

## Fetch / RPC

### Worker assignment is sticky per adapter, so one track's parse is single-threaded

**Status:** Accepted.

**The pool spreads tracks, not a track's regions.**
`WebWorkerRpcDriver.getWorker(sessionId)` assigns one sticky worker per session
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

### Per-JS-context scoping multiplies by the RPC pool

**Status:** Open. Measured 2026-08-12, `products/jbrowse-web/browser-tests/percontext-probe.ts`.

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
one: the undisposed `observer()` reactions in
[ideas/destroying-an-mst-tree-that-something-still-observes.md](../ideas/destroying-an-mst-tree-that-something-still-observes.md)
are what recompute against the dying nodes, and nothing below a view has to be
detached if nothing is left observing it.

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
listed in the Help widget. `products/jbrowse-web/browser-tests/probe-a11y-focus.ts` is where the parts
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

### Canvas feature tracks bake per-feature color into worker output, so a color-slot edit refetches

**Status:** Half closed (2026-08). The theme is out; the color slots are not.

`LinearBasicDisplay`'s `rpcProps()` returns the slots the worker reads. Every
returned field is an RPC cache key, so `SettingsInvalidate` fires
`clearAllRpcData()` and every visible region refetches. **One `color` /
`utrColor` / `connectorColor` slot edit re-downloads and re-parses every region
of every canvas feature track**, because those slots are per-feature jexl
callback slots and only the worker has the feature to evaluate them against.

**The theme is no longer one of those fields.** It used to be — `theme:
getSession(self).themeOptions`, so worker-baked CDS-frame, connector and outline
colors followed the palette — which made a light/dark toggle a full refetch of
data that had not changed. The worker now holds no palette at all: where it
would bake a theme color it emits a **color class** in a `*ColorClasses` lane
beside the color lane (`RenderFeatureDataRPC/colorClasses.ts`), and the display's
`gpuProps()` feeds a main-thread `encode` that resolves the classes against
`session.palette`. Six roles cover it — the connector stroke, the theme-derived
outline, and the six CDS reading frames, each with the two codon tints
`emitCodonRects` lightens out of it. A region with none of them re-encodes to
the same arrays by reference, so the upload diff skips it.

Label text colors needed no class: a label's color is a function of its KIND and
the theme, so `LabelItem` carries no color and `labelColors` resolves it beside
the position. That also fixed the SVG export, which resolves the *export*
theme's palette and had been printing worker-baked labels in the session's.

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
[REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) §"Neither budget is an RPC cache key"
for why nothing is left unguarded by that.
`loadedRegions`, not `rpcDataMap`, is the signal when measuring — the
canvas base keeps fetched features through a settings clear on purpose. Guarded by
the `SettingsInvalidate keys on the payload, not the reads` suite in
`plugins/canvas/src/LinearBasicDisplay/fetchAutorun.test.ts`.

This is the one place the codebase inverts its own split (worker returns data,
main thread owns pixels), and for a real reason: the canvas worker bakes
per-feature colors, including jexl callbacks that need feature context, into the
instance buffer.

**Retire the rest when** the per-feature color leaves the worker too. Unlike the
theme, it cannot become a class: the value is per feature, so it would have to
be a full RGBA lane the worker still evaluates jexl to fill — which is a fetch,
which is where it already is. The cheap intermediate is a worker-side
parsed-feature cache keyed by adapter + region + the non-visual payload, so a
color-slot change re-evaluates without re-downloading and re-parsing.

The pick above is what makes that split tractable rather than a prerequisite for
it: `WORKER_READS` is already the list of what the worker actually consumes, so
the question left is which of those slots are appearance rather than which slots
are in the payload at all.

### Staleness mechanisms behind one name

**Status:** Mostly closed (2026-07); down to two mechanisms 2026-08-21, when
HiC and LD moved to genomic worker output and the viewport-snapshot compare
(viewportMatchesLastDrawn, on the deleted StaleViewportRescaleMixin) retired
with the fetch-time pixel space it existed for.

Data freshness is still computed two ways — spatial coverage
(`viewportWithinLoadedData`, per-region mixins) and signature compare
(`isDataCurrent`, arc / HiC / LD / dotplot / synteny) — and each has
independently shipped a stale-capture bug
([SVG_EXPORT.md](SVG_EXPORT.md), HISTORICAL.md §"In-place-refetch staleness").

What changed: both now answer under the single name **`dataCurrent`**, and
every consumer reads that name. `svgReady` — five hand-written copies of
`fresh || terminal`, the actual bug surface — collapsed into one
`computeSvgReady` that each foundation feeds its own `dataCurrent`. So a display
composes a freshness answer instead of choosing which name to expose, and
forgetting the terminal set is no longer possible.

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
getting it wrong is silent. Two fix shapes answer it, and **which one applies
turns on whether the violation is a declaration or a state.** A declaration — a
name declared, a call written, an argument order — is a `no-restricted-syntax`
selector, which costs nothing at runtime and nothing to maintain. A state,
something true only at a particular moment of a run, has to make the order
report itself at attach, the move `makeSettingsLoopGuard` already applied to the
`rpcProps` loop trap. `assertDisplayContract` (called from
`MultiRegionDisplayMixin.afterAttach`, from `installGlobalFetchAutorun`, from
`installComparativeFetchAutorun` and from the shared `installFetch` whenever a
`contract` name is passed, so every fetch is covered — it was per-region only
until 2026-08, which left HiC and LD, both of which define `rpcProps()`, checked
by nothing) is that generalization. It
`console.error`s rather than throws, deliberately: an error escaping
`afterAttach` is read by the session loader as an invalid track and the display
is dropped, which would hide the very violation being reported.

**A test run fails on any of them** (2026-08). `config/jest/console.js` buffers
every message carrying a `[jbrowse <family> contract]` prefix — `display` and
`session` exist today, and a new family reaches the gate without touching it —
and `config/jest/contractGate.js` — in every jest project's
`setupFilesAfterEnv` — fails the test that collected one, quoting it verbatim.
What changed is who *listens*; the reporting channel is unchanged and stays
that way, for the reason above. Before it, a violation printed into a run that
prints thousands of lines and nothing failed, which is one notch above silent.
A test that provokes a violation on purpose takes the messages with
`takeContractReports()`, which is both the opt-in and how it reads them;
a test that replaces or mocks `console.error` takes itself out of the gate
entirely, which is why the display harnesses silence `console.warn` only.
Attribution is honest in one direction only, and the failure says so: a check
firing from a debounced autorun lands after the test body returns, so it fails
whichever test ran next, and anything arriving after the last test fails the
file rather than being attributed wrongly.

**Now checked** (dev-only; every one but the retry contract at the end reports
only on a real violation):

- **A renamed gate hook leaves an override reading nothing.** In tree the hook
  table's generator asserts every hook is still declared by the file owning
  its default; out of tree nothing reports it — the dev-only reporter that
  did was compatibility scaffolding and went with the one-path gate
  (2026-08-23). A renamed opt-in is a breaking change.
- **A display's `afterAttach` must not chain to super.** The MST fork auto-chains
  lifecycle hooks, so capturing and calling it double-installs all five autoruns
  (`models/afterAttachAutoChain.test.ts`). A `WeakSet` of nodes the foundation's
  hook has already run on catches the re-entry. **Kept as a runtime check on
  purpose**: the super-capture is a declaration and would make a fine selector,
  but it is not the only way a foundation's hook runs twice on one node —
  composing two fetch foundations, or calling an installer a mixin already
  called, arrives at the same double-install through a composition assembled
  across files that no single one of them spells out. The check is on the state,
  so it holds whatever produced it; a selector on `self.afterAttach` would
  narrow it to the named cause.
- **`reload()` must reach a fetch, not just clear the error.**
  `makeRetryContractCheck` (`assertDisplayContract.ts`), installed by both fetch
  foundations: a run following a `reloadCounter` bump that declines to fetch *is*
  the dead Retry button `DisplayErrorBar` shows. Unlike the rest of this list it
  is not an attach-time read — the relation between `reload()` and the gate is
  semantic, so it is judged per run, which is also why it is the one entry that
  can be wrong: a `fetchNeeded` override that awaited before fetching would read
  as a decline. None does, and a new one gets a false report rather than a silent
  gap.

  **What it does not survive is a `reload()` override.** The bump is the whole
  arming mechanism and MST replaces an action outright, so an override that
  neither bumps nor chains leaves the counter frozen — which reads as a display
  that never retries, and the check goes quiet for good. Canvas's
  `LinearBasicDisplay` shipped that way and took `LinearVariantDisplay` with it.
  **The general move: a check armed by a value a subclass can stop producing needs
  something watching the producers**, which here is
  `reloadReachesCounter.test.ts`, reading every `reload()` in the tree. Details in
  [DISPLAYCHROME.md](DISPLAYCHROME.md) §"The retry contract".

- **A track config written into a session or config list must outlive its
  assemblies.** `assertTrackConfOutlivesItsAssemblies`
  (`product-core/Session/temporaryAssemblyTracks.ts`), on all three adders and on
  `SessionTracks.addToSession`: a config naming an assembly the session holds as
  **temporary** is dead the moment the comparative view that synthesized it
  closes, and no list outside that view has anyone to sweep it (ADR-084). This is
  the one entry in a family other than `display` — the gate matches
  `[jbrowse <family> contract]`, so a new one needs no change to it. **The general
  move: where a cleanup was deleted because the storage was wrong, the check goes
  on the write, not on the cleanup** — asked at the write it is `some` over the
  names and nothing else, where the sweep it replaced needed `every`, a length
  guard and a copy, each a bug taken the other way. It found a live one on its
  first run: "Copy track" offered a copy of a read-vs-ref band, which
  `publishTrackConf` wrote into the config.json every visitor is served.

  **A check on a write catches the user's writes too, and those are not a
  developer's mistake to report.** Two flows reached it holding nothing a message
  about `inlineConf` could help with: Copy track, and the Add-track widget, which
  takes its assembly from the containing view — so opening a BAM in a read-vs-ref
  panel arrived at `sessionTracks` with a synthesized assembly the user never
  chose. Each needed an answer of its own before the check sees it, and the two
  answers differ because the flows do: a copy of such a track is dead whatever
  you do with it, so the menu greys it and says why, while the file the user
  opened is worth having for the life of the view, so `addTrackFromWidget` routes
  it to `showTrack`'s `inlineConf` and no list at all. **The general move: a check
  on a write needs the user-driven callers answered first, or its report is a
  scolding for something nobody did** — and the tell is a message whose remedy
  the reported caller cannot reach.

- **Nothing inside a live SVG figure may be an `observer`, and a view may hold
  one figure.** `figureContract.ts` (LGV `svgcomponents/`), the `figure` family,
  called from `useViewSvgFigure`. Both violations draw a plausible picture and
  say nothing, which is why they report rather than being left to review: an
  observer inside re-renders on its own subscription and slides the live half of
  the drawing across track bodies frozen at a moment in the past, and two figures
  of one view mint identical SVG ids, where `url(#…)` takes the first and clips
  every later figure with the first one's rects. Three components shipped the
  first (`SVGHighlights`, grid-bookmark's `LGVHighlightSVG`, alignments'
  `SashimiArcsSvg`) before anyone noticed, and the door they came through —
  `LinearGenomeView-HighlightSVGComponent`, and whatever a display's `renderSvg`
  returns — is open to any plugin.

  **The general move: where the shape is not detectable, check the state the
  shape would produce.** `observer(f)` on a function component is `memo(f)` with
  no marker on it, so it cannot be told from a plain `memo`, which is harmless —
  an enumeration of component types would have to guess. A `MutationObserver` on
  the figure's own subtree, reporting only while the snapshot is unchanged, is
  exact instead, and it covers what an enumeration could not name: a plugin's
  component, an observer inside a `renderSvg` result, a subscription that is not
  MobX's. The dual move for the id check: **a deterministic id is a collision the
  moment two of the thing exist**, and here the determinism is load bearing (an
  unchanged view exports to the same bytes — `svgNodeId`), so the check goes on
  the second mount rather than on the ids.

- **A view snapshot key naming no declared property is dropped in silence.**
  `warnUnknownSnapshotKeys` (`core/util/warnUnknownSnapshotKeys.ts`), the `view`
  family, on each registered view model. A config that writes a spec's flat
  launch keys onto a `defaultSession` view — `{ type: 'LinearGenomeView',
  assembly, loc, tracks }` — renders a default view and says nothing about why;
  three demo builders ship that today. The known set is read off the composed
  model, so it cannot drift as a view gains properties. **The general move for a
  check inside a preprocessor: order it against the remaps, not against what was
  authored.** MST runs preprocessors in the reverse of the order they were added
  and a composed base's after all of them, so the call sits BEFORE a view's own
  legacy remap — from the other side it reports `bpPerPx` on every pre-window
  session as a typo — and a base's remap it still cannot see is named in
  `legacy` (LinearSyntenyView's `tracks`).

**Checked without a runtime check:**

- **`CanvasFeatureGateMixin()` must compose after `MultiRegionDisplayMixin()`.**
  Both define `gateEnabled` and `densityGateEnabled` and the later
  argument wins, so swapping them switches the whole size gate off with no error
  ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)). **An argument order is a
  declaration**, and esquery's sibling combinator reads it directly: the rule is
  `CanvasFeatureGateMixin() ~ MultiRegionDisplayMixin()`, which matches the base
  mixin when the gate mixin already appeared earlier in the same argument list,
  and neither mixin's own `export default function` is a call, so no file needs
  a carve-out. It replaced the gate mixin's `afterAttach`, which read its own
  opt-in back and reported if the base's `false` had won. **What a sibling
  selector cannot see is an order assembled across two files** — a gate mixin
  composed ahead of a base *model* that carries the foundation — where the
  attach-time read could. Nothing in tree composes that way (the one display
  that composes the gate mixin names both in one `types.compose`), and out of
  tree neither form reaches at all.

- **`HeightModeMixin()` must compose after `TrackHeightMixin()`**, whose `height`
  and `resizeHeight` it overrides, so the wrong order silently leaves grow mode
  inert. Same selector shape as the canvas gate above, and the same residual.
  This one is worth reading beside the runtime version it replaced, because that
  version needed a **flag invented for it**: both members are legitimately
  defined on both sides and the two `height` getters agree in fixed mode, so no
  value distinguishes the orders, and supportsHeightModes (false on the base,
  true on the mode mixin — unbackticked because nothing declares it any more) was
  added to *both* mixins purely to be read back at attach. **A selector reads the
  argument order itself, so the probe it needed had nothing left to do** — the
  flag and its two declarations are gone with the check. What replaced its two
  tests is the consequence rather than the probe: `TrackHeightMixin.test.ts`
  drag-resizes a grow-mode fixture both ways round, and the wrong order drags the
  raw slot from 100 to 130 while never leaving grow, where the right one takes
  the 300px the track was displaying to 330 and leaves grow first. **The general
  move: a state a check invented for itself is a cost of that check, and moving
  the check should take it.**

- **`rpcProps` / `regionHasData` / `isCacheValid` must be `.views()`, not
  `.actions()`.** MobX runs actions untracked, so the reads register no
  dependency and callers keep a stale answer. A declaration of one of those
  names directly inside an `.actions(…)` block is an eslint error
  (`no-restricted-syntax`, which carries the reason); `regionFetchKey` is spared
  by being a getter, because MST throws on one declared inside `.actions()`. It
  was a hand-copied `getMembers(display).actions` assertion per display family,
  then one `afterAttach` read for every display composing a fetch foundation,
  and is now neither. **The general move applies to a hook the same way it
  applies to a getter: the block a member is written in is syntax, so the
  selector is the whole check** — and it fires in the editor rather than at the
  attach of whichever test happens to build that display.
  [ADR-044](../architecture-decision-records/adr-044-reactive-display-hooks-are-getters-or-pinned-views.md)
  rejected exactly this rule in 2026-07, on the grounds that a lint pass "would
  see the easy cases and miss precisely the 210-line-block case that shipped".
  Two of the three escapes it named are plain syntax and *are* matched — a
  210-line `.actions()` block, and a super-capture override returning its object
  out of a block body — so the objection held only for the third, a helper
  factory spread into the block, which no display does. The ADR records that.
  What none of the three forms covers is an out-of-tree display, which runs
  neither our lint nor our tests, and which the production strip already left
  with nothing
  ([ideas/contract-checks-out-of-tree.md](../ideas/contract-checks-out-of-tree.md)).

**Still silent:**

- **A fetch installer's triggers must be read above its gate.** MobX rebuilds
  the dep set per run, so a read under the gate drops out of it. Arc shipped a
  dead `reload()` from exactly this (ARCHITECTURE.md §"The global-fetch trigger
  list must be read unconditionally"). This one is a *shape*, not a state, so no
  attach-time read can see it.

  **Narrower than it reads, and now the same shape in both families.** Each
  installer reads its own trigger list unconditionally above the display's
  `prepare()` — four of them for `installGlobalFetchAutorun` (viewport,
  `isMinimized`, the `rpcProps()` key, `reloadCounter`), `reloadCounter` alone
  for `installComparativeFetchAutorun` — so what is exposed is a `prepare` that
  returns `undefined` above a read only it makes. HiC's `effectiveResolution`
  looks like that and is not: its `prepare` reads it before deciding. The rest
  is held by convention — every in-tree `prepare` bails on something the
  skeleton already tracks, or on an observable of its own that it read first.
- **An `installUpload` declares a narrow `inputs` getter, never
  `renderState`.** ADR-078 moved this from a trap to a declaration: an
  observable read inside `encode` no longer invalidates anything, so the old
  failure — a `renderState` read rebuilding tens of MB per frame of
  byte-identical output during a height drag, which reads as "the GPU path is
  slow" — now needs `inputs` itself to be the wide one. Getting it too narrow is
  the live risk instead, and it fails visibly (a settings change that never
  reaches the buffer) rather than silently. Prose is still the whole
  enforcement. Probably checkable — the encode is a pure function the
  installer calls, so it could run once at attach inside a MobX probe that
  reports which observables it touched, and compare against what `inputs`
  reads — a set that now has a name to compare against.

- **The comparative family's `reload()` gate conflates two declines.**
  `installComparativeFetchAutorun` passes a `contract`, so it gets BOTH dev-only
  checks — `installFetch` installs `assertDisplayContract` and
  `makeRetryContractCheck` together whenever one is named. (This entry used to
  say the retry check was missing; it never was.) What survives is the gate the
  check watches: it is `prepare()` returning `undefined`, which conflates
  "nothing to fetch" with "not ready yet", so a Retry clicked before either view
  initializes reads as a decline. The exemption half already exists as
  `SyntenyFetchStateMixin.fetchInert`, and the seam for the other half exists
  too — `installFetch`'s separate `fetchKey` gate, written for exactly this
  split ("`prepare` returning `undefined` is *nothing to fetch* ... this is *I
  have exactly this already*"), which `installComparativeFetchAutorun` forwards
  against `loadedFetchKey`. See [DISPLAYCHROME.md](DISPLAYCHROME.md) §"The retry contract"
  for what each display bails on.

- **A display that omits `rpcProps()` gets no settings invalidation, silently.**
  `rpcPropsCacheKey` returns `''` and `SettingsInvalidate` is never installed —
  correct for `LinearReferenceSequenceDisplay`, indistinguishable from an
  omission for everyone else. Checkable only behind an explicit opt-out
  (`noSettingsInvalidation: true`), which the foundation's own test display
  (`plugins/linear-genome-view/src/displayKitTests/perRegionTestEnv.ts`, which defines no `rpcProps`
  because it is testing the autoruns rather than a payload) would also have to
  declare — otherwise the check is console noise in the test suite rather than a
  signal.

**Retire when** each of the above becomes explicit data — this section's own rule
against restating a list's length applies here too, so read the list: a `deps()`
callback the global-fetch helper reads unconditionally, a `prepare()` that says
which of its two bail-outs it took, and a required `rpcProps` (or the explicit
opt-out above). One condition this used to name — a marker the height mixins can
compare composition order on — went the other way: supportsHeightModes was added,
read back at attach, and then deleted along with that check, because the order it
existed to probe is an argument order and a selector reads it directly. It is
unbackticked here because no code declares it.

### A spreadsheet's rows leave the session snapshot silently, and a local import cannot get them back

**Status:** Accepted on the cap, Open on the silence.

`SpreadsheetViewModel`'s `postProcessSnapshot` drops `rowSet` when
`rowsExceedSnapshotBudget` says the serialized rows clear `ROW_SNAPSHOT_BUDGET`
(1 MB). The cap earns its place: the session snapshot is mirrored to
sessionStorage on every edit, which throws on a write rather than failing an
async put, so an unbounded sheet loses the whole session instead of one view.
`snapshotBudget.ts` carries the reasoning, including why the test samples for a
per-row floor before measuring exactly.

**What nothing bounds is the recovery.** `ImportWizard` remembers a location
only when it is a URI — `if ('uri' in src) { self.setCachedFileLocation(src) }`
— so a sheet imported from a local path or a dropped blob has no
`cachedFileLocation`, and the reload path in the view's `afterAttach` keys
entirely on that field. Over the budget, such a sheet returns as an empty import
form. Nothing says so at any point: `omitRows` is computed inside the snapshot
transform, never recorded, and no notification fires — so the loss is visible
only as a sheet that used to have rows.

Two things make it reachable rather than theoretical:

- **The sibling limit on the same import path does speak.** `IMPORT_SIZE_LIMIT`
  (100 MB) sets a visible error naming the cap. A reader who has met that one
  has been taught that this import path announces its limits.
- **`SvInspectorView` holds a child `SpreadsheetView`**, so the SV workflow
  whose ordinary input is a local VCF or BEDPE inherits the whole shape.

**The shape, not the instance, is what to carry away**, because the codebase is
otherwise careful about it: `GranularRectLayout` throws past `hardRowLimit`
rather than truncating, and alignments records a `clippedBy: RowCapSource` so a
lane can say which cap hid its reads. The one sibling with the same silence is
`BaseFeatureWidget`, which persists `undefined` for feature data past 2 MB
serialized — benign only because clicking the feature again rebuilds it, which
is exactly what an imported sheet cannot do.

**Retire when** the drop is either visible or impossible: a flag on the
persisted snapshot that the reloaded view turns into a message naming the file
to re-import, or rows over the budget going somewhere IndexedDB-shaped instead
of into the snapshot. The message is the cheap half and needs nothing about the
budget to change.

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

`agent-docs/` is 42.6k lines against the 28 in-tree `CLAUDE.md` files' 2.6k
(2026-08-18). Rules the compiler already owns are still written as warnings,
spending the attention the unenforceable ones need.

**Re-count before citing those; don't quote them from here.** Both halves grow
fast enough to make any number written down wrong within weeks — over the
sixteen days to 2026-08-18, `CLAUDE.md` grew 3.2x and `agent-docs/` 2.2x, which
moved the ratio from ~24:1 to ~16:1 while a paragraph here asserted it was
getting worse. `find . -name CLAUDE.md -not -path '*/node_modules/*' -not -path
'*/.claude/*' | xargs wc -l` is the whole measurement.

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
