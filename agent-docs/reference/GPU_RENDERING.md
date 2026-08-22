---
name: gpu-rendering
description: The GPU render lifecycle in depth — RenderLifecycleMixin, the upload/render autoruns, per-plugin backends, the four upload patterns, the HAL, and Slang shaders. Read when touching a rendering backend, an upload path, or a shader.
---

# GPU rendering architecture

How a display gets bytes onto the GPU and pixels onto the screen. Split out of
[ARCHITECTURE.md](../ARCHITECTURE.md), which remains the front door: read its
overview, **Display stacks**, and **Data fetching pipeline** first for how a
display is composed and how data reaches the main thread. This doc picks up at
the point where the model has data and needs to draw it.

Everything here applies to displays that draw to a canvas. Arc — the one display
class that paints JSX SVG on both the on-screen and export paths — composes none
of it; see ARCHITECTURE.md §"Display stacks".

## Package layout

The rendering primitives live in **`@jbrowse/render-core`**
(`packages/render-core`): the HAL, `RenderLifecycleMixin`, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. It is a
leaf package (deps: `mobx` + `@jbrowse/mobx-state-tree` + `react` peer; **no**
`@jbrowse/core`), so a third-party display can depend on it directly.

Shader codegen (`packages/shader-tools/src/build-shaders.ts`, plus `slangPass` in
render-core) and the display-integration layer (`MultiRegionDisplayMixin` /
`GlobalDataDisplayMixin` / `DisplayChrome`, in the LGV plugin) stay where they
are. Per-display shaders/passes live per-plugin under
`plugins/<plugin>/src/<display>/{shaders,passes}`. The GPU API is
**static-import-only** — never exposed via the runtime `ReExports` registry. See
[ADR-030](../architecture-decision-records/adr-030-render-core-package-static-import-only.md).

HAL is the hardware abstraction layer (WebGL2 vs WebGPU). Full vocabulary +
Canvas2D→GPU primer: [GPU_GLOSSARY.md](GPU_GLOSSARY.md), whose §8 maps standard
real-time-graphics terms (PSO, bind group, staging buffer, SSBO…) onto the
identifiers used here.

## The core contract

Each GPU display is an MST model that composes `RenderLifecycleMixin` and, in
its `startRenderingBackend(backend)` action, installs one of the three
render-core lifecycles (`installPerRegionLifecycle`, `installKeyedLifecycle`,
`installGlobalLifecycle` — ADR-079); the installer is what calls the mixin's
`attachRenderingBackend`, and `noHandRolledAttach` errors on a display calling
it by hand. Underneath, the mixin spawns two autoruns tied to the model's
lifetime — one runs the upload callback, one the render callback. MobX
auto-tracks every observable read inside each callback, so changes re-fire the
right autorun with no manual dependency declarations. React components are thin
bridges: create a canvas, hand the backend to the model via
`useRenderingBackend`, render JSX.

## The API

```ts
interface RenderingBackend {
  // plugin-defined upload/render methods
  dispose(): void
}

// In the plugin's MST model (the per-region form; keyed and global
// installers take the same shape of callbacks):
startRenderingBackend(backend: RenderingBackend) {
  installPerRegionLifecycle(self, backend, {
    data: () => self.rpcDataMap,
    // The upload half is the installer's diff over `data`; an `encode` option
    // is where a display transforms a region's payload on the way up.
    // `renderState` is a plain resolved getter — never `undefined`. "The view
    // isn't measured yet" is the mixins' `canRender` gate (see below), not a
    // nullable render state.
    //
    // renderBlocks answers "did real content reach the canvas"; forward it. On
    // true the mixin calls markCanvasDrawn() → canvasDrawn flips true → isReady
    // becomes true once isLoading also clears.
    //
    // Don't re-derive that answer here (`rpcDataMap.size === 0` and friends).
    // Per ADR-009 the backend owns it: it holds the regions map, and a
    // model-side predicate both duplicates it and drifts — the two displays
    // that gated on nothing used to flip canvasDrawn over a blank canvas.
    // Add a guard only for something the backend genuinely cannot see, and say
    // what that is (alignments' zero-group grouped fetch, MAF's "no fetch has
    // landed yet" first-paint gate — see HISTORICAL.md).
    render: (b, dataMap) =>
      b.renderBlocks(self.renderBlocks, dataMap, self.renderState),
  })
}
```

That is the shape for a display that owns its canvas. The two views whose canvas
is **shared by several displays** (dotplot, the synteny level) invert the gate:
their `render` repaints unconditionally and returns `true`, because nothing else
repaints that canvas and an empty frame is what erases a hidden track. See
ADR-009's scope clause and
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md#the-empty-frame-is-load-bearing).

## What the mixin owns

```
RenderLifecycleMixin
  .volatile
    canvasDrawn: boolean          set true only after render() returns true with real data
    currentRenderingBackend       stored backend; autoruns read it each tick
    renderTick: number            bumped by renderNow() and after every upload
    autorunsInstalled: boolean    guards attachRenderingBackend (idempotent)
    renderError: unknown          render-backend init / context-loss error; single source for the 'renderError' terminal phase
  .views
    canRender: boolean            overridable precondition, default true; while false BOTH autoruns skip their
                                  callback. The LGV mixins override it with view.initialized — before the view is
                                  measured its geometry throws by design (view.width, so visibleRegions /
                                  trackWidthPx too), and the render autorun routes a throw to renderError, i.e.
                                  "not measured yet" would surface as the GPU error banner. Gated once there, so a
                                  display's renderState stays a resolved getter and its render callback gates only
                                  on its own data ("no fetch has landed") — never on view geometry.
  .actions
    markCanvasDrawn()             idempotent flip to true
    resetCanvasDrawn()            flip to false (called by clearAllRpcData)
    stopRenderingBackend()        clears currentRenderingBackend + resets canvasDrawn → autoruns idle
    renderNow()                   bumps renderTick → render autorun re-fires
    setRenderError(error)         set/clear renderError
    attachRenderingBackend(setup)  spawns upload + render autoruns (once);
                                  takes a setup thunk run once per attach, so
                                  callback-local state is rebuilt with the
                                  backend on context-loss recovery

MultiRegionDisplayMixin  (composes RenderLifecycleMixin)
  .views
    canRender: boolean            view.initialized (see above); GlobalDataDisplayMixin overrides it identically
    viewportWithinLoadedData      every visible block ⊆ a loaded region
    displayPhase                  'renderError' | 'tooLarge' | 'error' | 'loading' | 'ready'
                                  computeDisplayPhase(self, () => computeLoadingTerm({...}, () =>
                                    self.viewportWithinLoadedData))
                                  (this family supplies the staleness axis and constants out rendersCanvas;
                                   customize via the fetchInert hook, never by overriding this getter)
```

Loading-scrim visibility is derived once by `DisplayChrome` as `displayPhase ===
'loading'` and passed to `DisplayLoadingOverlay` as a `visible` prop — not
re-encoded per model.

**The `loading` term itself is one expression, `computeLoadingTerm`**
(`@jbrowse/render-core/displayPhase`), evaluated by both foundations:

```
!fetchInert &&
  (isLoadingOrCanceled || (rendersCanvas && !canvasDrawn) || !viewportCurrent())
```

Each family constants out the axis it doesn't have — per-region passes
`viewportCurrent = () => viewportWithinLoadedData` and `rendersCanvas: true`,
global passes `viewportCurrent = () => true` and `fetchInert: false` — so
the only per-family difference is the staleness axis described below. It was two
hand-written expressions that had drifted three ways, equivalent only by
accident; adding a term now reaches every display. `viewportCurrent` stays a
**thunk** because it is the only input reading the containing view; the other
four are flags on the display. Parity against both replaced expressions is
pinned in `displayPhase.test.ts`, and the wiring on a real display in
`plugins/canvas/src/LinearBasicDisplay/displayPhaseWiring.test.ts`.

Every canvas-drawing display renders through the shared `DisplayChrome`, which
calls `useRenderingBackend(factory, model)` internally, so a display can't bury
the backend hook where the chrome can't see it. The chrome owns every terminal
state via the single `displayPhase` getter: `renderError` and `tooLarge`
early-`return` their own component, `error` and `loading` are overlays over the
still-mounted canvas. It takes a render-prop child
`({ canvasRef, canvas }) => ReactNode`, so it is agnostic to how many canvases a
display draws, and a required `testid` base it publishes unchanged
([DISPLAYCHROME.md](DISPLAYCHROME.md) §"One element per display").

The `loading` phase folds in both fetch- and paint-readiness. The
`isLoadingOrCanceled` and `rendersCanvas && !canvasDrawn` terms cover track-open
through the fetch cycle (hiding once the first frame paints);
`viewportWithinLoadedData` re-shows the overlay when the viewport extends past
loaded data — e.g. the pre-refetch debounce after a zoom-out, where the first two
are already satisfied but stale data is still on screen (separate getter for
tracking reasons — see BaseLinearDisplay/CLAUDE.md). `stopRenderingBackend`
resets `canvasDrawn` so the overlay recovers after WebGL context loss.

That `rendersCanvas && !canvasDrawn` clause covers the window between component
mount and `isLoading` flipping true, in both families. On HiC that window is
real: the fetch can't start until `CoreGetInfo` resolves the file's resolution
list, so `isLoading` is false with nothing painted for that round-trip, and
without `!canvasDrawn` the track reads as blank. The global family does NOT fold
in a staleness axis the way MultiRegion does — it keeps the last frame up during
a refetch (worker output is genomic, so it draws correctly under the live view
transform), so a pan shows no scrim
beyond the `isLoading` window.

`rendersCanvas` (default true) gates the clause so a display showing a static
non-canvas placeholder — LD with `showLDTriangle` off — doesn't sit permanently
under the scrim. It is an overridable hook rather than inlined because the
pre-paint scrim needs both "nothing painted yet" and "not a deliberate empty
placeholder", and only the display knows the second. The alternative that removes
it — rendering LD's placeholder *outside* `DisplayChrome` — was rejected for
disposing and re-initializing the GPU backend on every triangle toggle
([ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md)).
Deleting LD's override as "dead single-use code" regresses a stuck spinner.

`installGlobalFetchAutorun` schedules **leading-edge**: the first fetch fires
immediately, and only subsequent refetches debounce by `delay`. MobX's built-in
`{ delay }` is trailing-only, deferring even the initial run, so on cold open the
first data would wait a full `delay` for no interaction to coalesce, stacked on
the `CoreGetInfo` RTT. A `primed` flag drives a custom `scheduler` that runs
immediately until the first fetch.

All backend-specific plumbing lives in the plugin; all reactivity plumbing lives
in the mixin.

## Life of a frame

- React hook (`useRenderingBackend`) mounts, creates the HAL, resolves a backend,
  calls `model.startRenderingBackend(backend)`.
- Mixin sets `currentRenderingBackend = backend`, spawns two autoruns via
  `addDisposer(self, autorun(...))`.
- Upload autorun fires: reads `currentRenderingBackend`, calls `cbs.upload(b)`,
  bumps `renderTick` so render re-fires after any upload.
- Render autorun fires: reads `currentRenderingBackend` + `renderTick`, calls
  `cbs.render(b)`. If it returns `true`, flips `canvasDrawn` to `true`.
  `clearAllRpcData` resets `canvasDrawn = false` so the flag is only set after the
  canvas has real content.
- Any observable touched by `upload` or `render` becomes a dep — when it changes,
  MobX re-fires that autorun. No manual invalidation.

**Context-loss recovery.** GPU contexts can be lost. `useRenderingBackend` listens
for `webglcontextlost`/`restored` and `device.lost`, rebuilds the backend, and
calls `model.startRenderingBackend(newBackend)`. The mixin sees
`autorunsInstalled === true`, skips re-installation, and just reassigns
`currentRenderingBackend`. Both autoruns re-fire against the new backend. No
special code path.

A **WebGL** loss is more than a rebuild, on two counts. It is silent — calls on a
lost context are no-ops that never throw, so nothing routes to `renderError` and
the canvas holds stale pixels — and it is unfixable in place, since
`getContext('webgl2')` keeps handing back that same lost context. So the hook
waits a grace window for `webglcontextrestored`, which recovers invisibly, and
otherwise reports `createGpuContextLostError()` into `renderError` — the phase
that unmounts the canvas, freeing the context for the page and letting the
remount get a live one. Bounded auto-recovery then clears it and stops at the
manual Retry.

**The recovery budget is windowed, not lifetime** (`RecoveryBudget`, 2 within
60 s). The cap exists for a context that recovers and immediately re-loses, and
that flap happens within seconds. Two unrelated losses an hour apart are not one
flap, and a lifetime counter cannot tell them apart — it spends the second
loss's budget on the first and leaves a long-lived tab unable to auto-recover at
all. A successful re-init does not reset it, since every flap contains one; only
a genuine `webglcontextrestored` or a manual Retry does.

**A WebGPU device loss is capped by the same budget**, and needs the cap more
than WebGL does. That path re-inits invisibly — `gpuDevice` has already dropped
the dead device and the next `getGpuDevice()` acquires a fresh one, so there is
no grace window and no `renderError` — which means nothing reports it. Uncapped,
a display re-initializes against a dying device silently for as long as the tab
is open. On give-up it sets `createGpuDeviceLostError()`, carrying the same
`gpuContextLost` flag: different cause, same remedy on offer.

Navigating away is not one of these: `pagehide` tears the backend down and drops
any pending report, since a bfcache freeze thaws the timer *after* `pageshow`
rebuilt the backend. A loss while the tab is merely hidden does report and
auto-recover in the background, so the user returns to a redrawn track or a Retry
banner rather than a permanently blank one.

The cause is usually **page-wide**: Chrome allows ~16 live WebGL contexts and we
create one per display canvas, so past the cap it force-loses the oldest and
recovery evicts another (see `project_workspaces_freeze_gpu_context`; view-level
lazy mount in `useViewVisibility` is the pressure reducer). For that, the
`renderError` banner offers `setGpuOverride('canvas2d')` — the same switch
`?renderer=canvas2d` sets, so every backend built afterwards is the Canvas2D one.
`isGpuRenderingDisabled()` is the single read for "GPU is off page-wide";
`DisplayRenderErrorOverlay` hides the button when it's already true, and the
button is scoped to context-loss errors (an over-allocation error's remedy is to
zoom in, not to change backend).

**Every re-init needs a canvas element that never held a context**, verified in
Chrome: `getContext('webgl2')` returns the same lost context (the HAL ctor then
throws in shader compile, `getShaderParameter` reporting null), _and_
`getContext('2d')` returns **null** on any element that once had WebGL — so not
even the Canvas2D fallback can bind there, turning a recoverable loss into
"Canvas 2D context not available". More generally: **a canvas's context kind is
permanent**, so any re-init whose HAL ladder lands on a different rung than last
time is stuck — a WebGPU device loss that cannot re-acquire a device falls to
WebGL2 and finds the element already committed to `webgpu`. When that happens
the error now says so, instead of reporting "WebGL2 not supported" on a machine
that supports WebGL2 fine (`canvasContext.ts`, below).

**Both families get the fresh element unconditionally, and the reasoning that
used to distinguish them was wrong.** "DisplayChrome consumers get it free,
since `renderError` unmounts the canvas" holds only for a *reported* loss —
three re-init paths bump `canvasKey` and deliberately set **no** `renderError`
at all (`webglcontextrestored`, WebGPU `onDeviceLost`, a bfcache `pageshow`),
and on those the element was reused. Usually harmless, since the same rung is
normally re-acquirable; the device-loss case is the one that isn't.
`DisplayChromeBase` therefore keys the render-prop body itself
(`<Fragment key={canvasKey}>`), so no display has to know any of this. The
overlays sit **outside** that key on purpose: remounting the loading scrim would
reset the 250 ms anti-flash delay it holds in component state.
`DisplayChrome.test.tsx` pins both halves under "fresh canvas element per
re-init", driving the real `webglcontextrestored` event rather than a mock.

The drop-to-primitive consumers keep their canvas mounted through an error by
design (ADR-025's mount-lifetime rule, written for a _live_ context), so theirs
must be keyed at the mount site. **That is structural too, not a rule to
remember**: they render `RenderCanvas`
(`@jbrowse/render-core/RenderCanvas`), which owns the `key={canvasKey}` and
forwards everything else, so there is no way to mount that canvas without the
key. The same component publishes their `data-display-drawn` as a **required**
prop, because the enumerated list it replaced had quietly omitted dotplot.
`RenderCanvas.test.tsx` pins both halves — a changed key mounts a fresh element,
an unrelated prop change does not — driven from a stable parent rather than
RTL's `rerender()`, which remounts the tree here and would make the key
assertion pass with the key deleted.

It owns the key and nothing else. There used to be a readiness convention to
fold in as well and there is not any more: ADR-065 deleted both spellings
(`DisplayChrome`'s `-done`, these two views' `_done`) in favour of that
attribute. Their readiness *flag* still differs — `settled`, not `canvasDrawn`,
since a shared canvas repaints unconditionally (ADR-009's scope clause) — which
is a real distinction rather than a naming one, so `drawn` is passed at the call
site.

**`getContext` returns one undifferentiated `null` for every failure**, which is
why the ladder used to report the wrong cause. `canvasContext.ts` records the
kind each canvas was committed to (a `WeakMap`, since the platform gives no way
to ask an element what it holds) and turns that `null` into a reason: either
"already committed to a WebGPU context, this is a re-init on a reused element,
mount it with `RenderCanvas`" or an honest statement of the two possibilities
when we never took a context on that element. Every acquisition goes through it
— `acquireCanvas2D` replaced four hand-written copies of the
`getContext('2d')` + throw ritual, three of them belonging to the consumers
whose canvas never unmounts.

**A ladder that fails at every rung reports every rung.** Falling through a rung
is ordinary and stays a `console.warn`, but Canvas2D cannot be fallen back from,
so when it fails too, `createRenderingBackend` throws an `AggregateError`
carrying each rung's reason. That is not decoration: core's `formatErrorStack`
already walks `.errors` and `.cause`, so the stack-trace dialog shows why WebGPU
and WebGL2 declined — previously visible only in a console the person reporting
the bug never had open. A lone Canvas2D failure with nothing collected is
rethrown bare rather than wrapped, so the one real cause doesn't sink a level.

**Tab visibility.** `useTabVisibilityRerender` calls `model.renderNow()` on
`visibilitychange`, bumping `renderTick`. WebGPU swap-chain textures are reissued
by the `render` callback.

## RenderingBackend interfaces per plugin

Each plugin defines its own `RenderingBackend` type and a factory that produces
either a GPU or a Canvas2D implementation:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<XxxRenderingBackend>(canvas, {
    passes: XXX_PASSES,
    uniformByteSize: XXX_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuXxxRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DXxxRenderer(c),
  })
}
```

`createRenderingBackend` calls `createGpuHal`; if a HAL is returned the GPU
backend is constructed, otherwise Canvas2D. The two factories are **named
options, not positional args**, on purpose: both are single-arg
`x => new Backend(x)` lambdas, so positionally they're trivially swappable by
mistake.

### Canvas2D is the floor; GPU is the optional accelerator

Every display that draws to a canvas **must** ship a Canvas2D draw function
regardless — SVG export goes through it (see
[SVG_EXPORT.md](SVG_EXPORT.md)). The GPU shader
path is an *optional accelerator* for displays whose feature counts demand it
(≳100K features/frame — [RFC-001 §3a](RFC-001-community-plugin-api.md)). So a display whose data is always
gene-scale / low-density / text can be **Canvas2D-only**: it writes no `.slang`,
no `GpuXxxRenderer`, no pass list. Its factory skips the HAL ladder and returns
the Canvas2D backend directly:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DXxxRenderer(c))
}
```

The backend plugs into the same `RenderLifecycleMixin` / `DisplayChrome`
machinery — the lifecycle is backend-agnostic, so nothing downstream knows
there's no HAL. Reference: `plugins/sequence`'s `SequenceRenderer`. Start here for
any new display; promote to the dual-path `createRenderingBackend` only when a
profile shows Canvas2D can't hold 60fps at the display's real feature counts.

### Keeping the two backends in parity

A dual-path display renders the same pixels two ways (`.slang` shader vs a
Canvas2D draw fn), and SVG export runs the Canvas2D path — so a shader-only tweak
silently diverges the export. Parity is kept by construction, not vigilance. When
touching either path, preserve whichever of these the display uses:

- **Constants live in the shader, TS re-exports them.** `//! export-consts:` in a
  `.slang` emits the value into its `*.generated.ts`; the Canvas2D side imports it
  (e.g. `sharedRendererConstants.ts` pulls `MIN_RECT_WIDTH_PX`, `CHEVRON_*`,
  `MIN_DENSITY_ALPHA`). Never retype a shader constant as a TS literal.
- **Scalar *decisions* live in the shader too, and TS is generated from them.**
  `//! js-export: fnA, fnB` emits `<base>.js.generated.ts` — TypeScript twins
  transliterated from slangc's own WGSL, so the Canvas2D and SVG paths run the
  shader's math rather than a hand-port of it. `hpmath.slang` exports
  `snapBoxHeightPx` / `snapBoxCenterYPx` / `extendToMinWidthPx` this way;
  `hic.slang` its count→ramp mapping, `insertion.slang` its marker width (to
  another package, via `//! js-export-out:`). The subset is **scalar only** — no
  vectors, swizzles, loops or indexing — and every gap an export reaches throws
  at `pnpm gen:shaders`. Less limiting than it sounds: a color- or
  struct-returning function is nearly always a scalar decision inside a packaging
  wrapper, so authoring the scalar core pure and wrapping the conversion around
  it is what makes it exportable, and is the better shape anyway. Retire the
  hand-written twin only behind a differential sweep —
  `hicShaderParity.test.ts` is the pattern.
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  covers why this stops at scalars and why a vertex/fragment stage is never
  transpiled;
  [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) is how to add an
  export and retire its twin.
- **One draw helper, both consumers.** Marker/glyph geometry and color math that
  both paths (or the on-screen overlay + SVG export) need lives in one function:
  `drawMafInsertionMarker`, `appendPointMarker` (wiggle scatter + Manhattan),
  `mapHicCount`, synteny's `syntenyRibbonPath` geometry (shared by the Canvas2D
  backend, the SVG export, and the CPU pick engine). Change the shared fn,
  not one caller. The same trick covers shared *predicates*, not just geometry —
  canvas's `canvasEdgeFlags` derives the continuation-marker edge gates for both
  backends so the 0.5px epsilon can't drift from `continuation.slang`'s.
- **One registry, exhaustively keyed — and count the wiring points before
  trusting it.** Multi-layer displays list layers/z-order/gating once and map
  each id to a per-backend mechanism through a `Record<LayerId, …>`, which makes
  a half-added layer a compile error; `coverageParity.test.ts` cross-checks
  output. Alignments has two such lists — `PILEUP_LAYERS` and `COVERAGE_LAYERS`
  — because its two bands take different draw signatures; that is a reason for a
  second list, never for a second backend keeping its own.

  **"The layers aren't 1:1" is not a reason to skip this**, and it read like one
  for two months. A registry shares the LIST, not the calls: a backend's record
  entry is free to be a shim calling two functions, or one call with a different
  sixth argument. What a shared list buys is that a layer cannot exist in one
  backend and not the other — and that gap costs correctness, since the missing
  half is also the SVG export. REJECTED_IDEAS.md has the decline and its
  overturn.

  **A pass that is drawn but never uploaded fails silently and on the GPU
  backend only**, so the Canvas2D half of a parity comparison still paints it and
  the result reads as a GPU bug rather than a missing entry. Alignments hit that
  with FOUR wiring points per pass — a hand-kept `ALIGNMENTS_PASSES`, layer→pass
  id, layer→upload fn, and the packer — only two of them keyed by the layer
  union.

  Keying the third is the weaker fix: two exhaustive `Record<PileupLayerId, …>`
  still state the correspondence twice, and two statements can disagree. **The
  one that holds is to make the pass and its packer one object** —
  `{ ...slangPass({…}), pack }`, the `InstancePass` type in
  `@jbrowse/render-core/instancePass`. No constructor wraps that spread, since it
  also has to serve a descriptor built somewhere payload-agnostic, and
  `{ ...RectPass, pack }` is the same line. The layer→pass map is then the
  layer→upload map, the arc and coverage bands are the same shape, and
  `ALIGNMENTS_PASSES` is derived rather than hand-listed — so registration stops
  being a wiring point at all. Four became one. Where a display has no layer
  union to key on, the ordered pass list with its gates *is* the registry.

  **The instance count comes with it, and that half is not optional.**
  `uploadPass` derives the count as `buf.byteLength / pass.instanceStride`,
  because a count arriving separately is a second expression for a number the
  buffer already states, and a count past what the bytes hold reads off the end —
  undefined pixels, no throw. Alignments had 17 such second expressions, one
  commented as needing to agree with the packer's own. If a worker packs the
  buffer and the main thread would count a parallel array, pin the two where they
  are joined (`packCoverageArea.test.ts`, over the real packers, one length per
  pass so a crossed pairing fails) — not at the upload, which should not be
  asking.

  **Reach for this at the scale that needs it.** What broke alignments was 17
  passes and 250 lines between upload and draw. `LinearBasicDisplay`'s 5-pass
  renderer gets the same guarantee more cheaply: one `CANVAS_FEATURE_PASSES` list
  with the two non-obvious cases commented on the entries themselves, upload and
  draw ~60 lines apart and readable together. Don't add registries to a renderer
  you can check by reading.

  **The `id` is the last unkeyed thing, and it is two keys.** A pass id names
  the pipeline in both HALs *and* the instance buffer in `RegionRegistry`, so two
  passes sharing one collide in both: the second registration replaces the
  first's pipeline, both upload to a single buffer, and the wider stride reads
  off the end of it. `assertUniquePassIds` runs in `createRenderingBackend` and
  in `MockHal`'s constructor — the latter being what puts it in front of the
  backend suites, which all build one from their display's real pass list.
- **A per-instance vertex budget is a cap, and the other backend has no such
  cap.** Where one instance draws an unbounded number of marks — canvas's chevron
  pass, whose instance is an intron line and whose marks are the strand chevrons
  along it — the pipeline's `verticesPerInstance` fixes how many the shader can
  address, and every slot costs its vertices on every instance whether it draws or
  not. So the number is a budget with two edges: raise it and every instance pays,
  leave it and a large enough input silently loses the marks past it, while the
  Canvas2D path — which loops in px and has no budget — keeps drawing them.

  None of the four mechanisms above catches this: the divergence is in neither
  path's arithmetic but in the range over which they agree. So a budget needs
  **the input range it covers, stated where the number is**, measured rather than
  reasoned — sweep the shader's own window arithmetic and record the threshold
  and the cost of moving it (`MAX_VISIBLE_CHEVRONS_PER_LINE` carries 4960 CSS px
  of block width, the numbers either side, and what 7680 would cost). A budget
  with no stated range reads as a limit nobody will hit, and there is nothing to
  check it against.
- **`SYNC:` comments anchor formulas** — the fallback, not a mechanism. Where a
  value must match across files and none of the above applies, a
  `SYNC:`/`mirrors` comment names the counterpart; grep the tag before editing
  either side. Before adding one, check whether the thing being mirrored is a
  constant (`export-consts`), a scalar decision (`js-export`), or an equivalence
  two implementations must preserve while staying different (a numeric oracle
  test, as `syntenyShaderParity.test.ts` does for the bezier). Also grep the
  counterpart before trusting an existing tag — five named shader branches that
  had been deleted.

  **The tag means an UNSHARED duplication, and only that.** Nearly half the
  registry once didn't: a predicate two callers reach through one exported
  function, a threshold with its own agreement test, a deliberate narrowing of a
  generated shader predicate, a producer of uniforms its "counterpart" merely
  consumes. None of those can drift, and the whole point of grepping the tag is
  to find where you gave up — so over-reporting is what it costs. Say what the
  coupling is in prose; spend the tag only on genuinely two copies. Count the
  survivors with `grep -rn 'SYNC:' --include='*.ts' packages plugins products`
  rather than restating a number;
  [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) §"The two sweeps" says how to
  re-run the survey.

**Intentional divergences — do NOT "fix" these into parity.** The two backends
legitimately differ where GPU rasterization is watertight but Canvas2D
antialiases each primitive independently. Canvas2D adds a sub-pixel *overdraw* to
close seams the GPU never produces (`WIGGLE_FUDGE_FACTOR` 0.8px, the
variant-matrix `f2`), and swaps a thin fill for a 1px centerline stroke (synteny
sub-pixel ribbons); the shader instead scales coverage alpha. These are
per-backend AA compensation, not drift — a shader has no equivalent to a Canvas2D
fudge factor, and porting one in over-widens GPU glyphs. Min-width floors, by
contrast, *are* mirrored (both clamp to the same px) — those keep sub-pixel
features visible and must stay in step.

### Shared per-region streamed contract

Per-region streamed plugins (canvas, manhattan, MAF, multi-variant, wiggle)
specialize one generic type and inherit from one of two abstract base classes in
`@jbrowse/render-core/perRegionRenderingBackend`:

```ts
// Plugin specializes the interface (used in model + React code):
export type XxxRenderingBackend = PerRegionRenderingBackend<XxxUploadData, XxxRenderState>

// Each pass carries the function that packs its instance buffer:
export const XXX_PASSES = [
  { ...slangPass({ id: PASS, mod: shader }), pack: (d: XxxUploadData) => … },
]

// GPU renderer declares its passes and implements drawRegion:
export class GpuXxxRenderer extends GpuPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  protected regionPasses = XXX_PASSES
  constructor(hal: GpuHal) { super(hal, XXX_UNIFORM_BYTE_SIZE) }
  protected drawRegion(block, clip, region, state) { … }
}

// Canvas2D renderer implements renderBlocks only:
export class Canvas2DXxxRenderer extends Canvas2DPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  renderBlocks(blocks, regions, state) { … }
}
```

The bases own everything that's truly shared:

- `Canvas2DPerRegionRenderingBackend` owns `canvas` + `ctx` (constructor throws if
  no 2D context) and stubs `uploadRegion` / `pruneRegions` / `dispose` as no-ops,
  since the source of truth is the `regions` map.
- `GpuPerRegionRenderingBackend` owns the `hal` reference and a pre-allocated
  uniform scratch `ArrayBuffer`. Default `pruneRegions(active)` delegates to
  `hal.pruneRegions(active)`; default `dispose()` calls `hal.dispose()`. It also
  owns `uploadRegion`, over the `regionPasses` the subclass declares — six
  subclasses used to write that method, each restating an instance count the
  packed buffer already stated and each spelling the empty case differently. A
  pass registered but never uploaded to — wiggle's line passes, canvas's chevron,
  which draw off a sibling's buffer — is simply absent from `regionPasses`.

Two invariants keep the renderer implementations small and uniform:

- `renderBlocks` receives the model's data map as its second argument — the
  renderer holds no `Map<number, ...>` field of its own. GPU buffer lifecycle
  delegates to `hal.pruneRegions(active)`; Canvas2D backends read everything from
  `regions` at render time.
- `hal.drawPass` short-circuits when the region has no buffer for that pass, so
  GPU renderers issue draws unconditionally — no per-region flag cache.

For MAF, `UploadData` and `RenderData` diverge. The upload payload
(`MafUploadPayload`) carries only the pre-encoded GPU buffer (`{ instanceBuffer,
instanceCount }`); the render side reads the raw `MafRegionData` from the model's
`rpcDataMap` (so Canvas2D can draw it and the GPU path can check presence).
`PerRegionRenderingBackend`'s optional fourth type param `RenderData` (defaults to
`UploadData`) expresses this split — shared with `LinearMultiRowFeatureDisplay`;
most per-region plugins keep the default.

Whole-map synced (alignments, multi-LGV synteny) and monolithic (HiC, LD,
multi-variant-matrix, dotplot) plugins define their own backend interfaces
because their upload shapes differ — see "Upload patterns."

#### Whole-map synced: skipping a region without leaving stale buffers

`sync(sources)` is a full rebuild by contract, and two `deleteRegion` calls are
what make that safe with no HAL-side transaction: a key absent this sync is
swept by the departed-key loop, and a key whose payload changed is wiped whole
at the head of the rebuild branch before its unconditional re-uploads — so a
pass (or a whole half: pileup gone, arcs toggled off) whose data went empty
can't leave stale bytes. The wipe is cost-neutral because `uploadBuffer`
destroys-and-recreates each pass's buffer anyway (no buffer pooling — see "What
this architecture deliberately does not have"). The skip exists because the
upload autorun fires on far more than new data — alignments' `sourceSections`
is derived through `sections`, so every band-resize drag frame and arc-mode
flip repacked ~9 passes per region to write the same bytes back. Two rules:

- **The wipe, like the skip, is whole-region.** A per-pass decision would need
  each caller to enumerate the passes it writes; a region with any change
  rebuilds all of it, which is what preserves the emptied-pass guarantee.
- **Forget a key when it leaves** — the sweep deletes the HAL buffers and the
  memo entry together, or a region that returns with a reference-identical
  payload skips an upload onto buffers the sweep destroyed.

(`beginUpload`/`endUpload`/`retainRegion` — a HAL-side write-recording
transaction whose sweep destroyed every buffer not rewritten or retained — was
the previous answer here; the wipe-plus-sweep replaced it 2026-08-21, deleting
the three methods from `GpuHal` and the recording from `RegionRegistry`.)

The memo lives on the renderer (`GpuAlignmentsRenderer.uploaded`), not in a
model-side `createRegionUploadSync`: this pattern's upload is one `sync` call
owning every section, and the renderer is rebuilt with its HAL on a context loss,
so the memo drops exactly when the buffers do — the part a hand-rolled model-side
memo forgets. It stores array identities only, never the payload, so an evicted
region isn't held alive by upload bookkeeping.

The one sub-region exception is the **recolor**, and it rides on a narrower fact:
`readYs` identity means "same layout run", because layout allocates it fresh
(`cloneWithLayout`) and the color tier spreads over the result without touching
it. Same bytes everywhere but the two per-read color arrays ⇒ skip the region
and rewrite the read pass alone. Same split as
`GpuSyntenyRenderer.getInterleaved`'s geometry/color token (ARCHITECTURE.md,
"the color-lane patch"). It requires the model to keep the color bake in its own
computed downstream of layout — the `laidOutByGroupUncolored` →
`laidOutByGroupFramed` → `laidOutByGroup` chain.

Synteny additionally has a level-of-detail axis upstream of all this: which PIF
tier the fetch reads from. That's a fetch/adapter concern, not a backend one —
[SYNTENY_LOD.md](SYNTENY_LOD.md).

### Wiggle-family contract

Wiggle-style per-position GPU displays (wiggle, multi-wiggle, Manhattan) share
types and scale utilities across two packages:

`@jbrowse/wiggle-core` — the cross-plugin contract. Import types and pure
utilities from here so new plugins don't drag in the wiggle plugin's MST
factories or RPC methods:

- `renderingBackendTypes.ts` — `WiggleRenderingBackend`, `WiggleGPURenderState`, `SourceRenderData`
- `dataTypes.ts` — `WiggleDataResult`, `WiggleSourceData`, `WiggleFeatureArrays`
- `normalize.ts` — `SCALE_TYPE_LOG`/`LINEAR`, `scaleTypeFromString`, `makeScoreNormalizer`
- `displayModel.ts` — `WiggleGpuDisplayModel<TRenderingBackend>`: model↔component contract
- `scale.ts` / `autoscale.ts` — `getNiceDomain`, `getScale`, autoscale helpers
- `scoreMenuItems.ts` — `makeScoreSubMenu(self, opts)` + `ScoreScaleModel`: the shared Score submenu
- `pointMarker.ts` / `resolveRenderState.ts` / `transferables.ts` / `YScaleBar` — the shared scatter glyph (wiggle + Manhattan), render-state resolution, worker transfer-list collection, and the Y-axis overlay

`@jbrowse/plugin-wiggle` — composable model pieces. These live in the plugin
because they depend on `BaseDisplay` / `MultiRegionDisplayMixin` and wire up RPC
methods:

- `linearWiggleDisplayConfigSchema` / `linearWiggleDisplayModelFactory` — the full
  LinearWiggleDisplay config + model. Composed **wholesale** by GC-content's
  `LinearGCContentDisplay`. The config schema is reused more widely (Manhattan
  extends it); the model factory is not.
- `WiggleScoreConfigMixin()` / `WiggleCommonMixin()` — score/color config pieces
  composed à la carte by displays that build their own model. The score *axis*
  alone (`scaleType` / `autoscale` / min-max + setters, i.e. the `ScoreScaleModel`
  interface) is `ScoreScaleMixin` in `@jbrowse/wiggle-core`, which
  `WiggleScoreConfigMixin` composes and which the alignments coverage band
  composes directly — that band wants the axis and none of the color/resolution
  config, and hand-wrote an identical copy of it until 2026-08.

GWAS's Manhattan does **not** compose `linearWiggleDisplayModelFactory`. It builds
its own model — `BaseDisplay` + `TrackHeightMixin()` + `MultiRegionDisplayMixin()`
+ `WiggleScoreConfigMixin()` — pulls score utilities and
`makeScoreSubMenu` from `@jbrowse/wiggle-core`, and extends
`linearWiggleDisplayConfigSchema` as its `baseConfiguration`. It ships its own
`GetManhattanData` RPC (per-feature points, not pre-binned density), implements
its own `ManhattanRenderingBackend` with its own pass, and is zoom-independent:
it overrides neither per-region cache hook, so it sits on the empty
`regionFetchKey` and no zoom invalidates a region it has loaded. That falls out
of which mixin it composes rather than needing a statement of its own — the
strict-`bpPerPx` rule is `WiggleCommonMixin`'s, and Manhattan composes only the
score config `WiggleCommonMixin` itself sits on top of.

### Upload patterns

Displays use one of four upload shapes. Pick the one that matches the data
shape, not the one your neighbour copied. **Every one of these contracts extends
`RenderingBackend`** (`dispose` + `setErrorHandler`), and a backend gets that by
extending `GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase` — see
"Every backend extends a base" below for what happened to the three that didn't.

**The installer column is the whole wiring.** A display calls one of these three
from its `startRenderingBackend` and nothing else; `attachRenderingBackend` is
render-core's own and a lint rule says so ([ADR-079](../architecture-decision-records/adr-079-a-display-installs-a-lifecycle.md)).

| Pattern | Installer | Contract | Upload methods | Render | Use when | Examples |
|---|---|---|---|---|---|---|
| **Per-region streamed** | `installPerRegionLifecycle` | `PerRegionRenderingBackend` | `uploadRegion(idx, data)` + `pruneRegions(active)` | `renderBlocks(blocks, regions, state)` | each region's data is independent, reactive per-region updates | canvas, wiggle, multi-wiggle, MAF, manhattan, multi-variant |
| **Whole-map synced** | `installGlobalLifecycle` | (its own; one consumer) | `sync(sources)` | `renderBlocks(blocks, state)` | per-region streams must rebuild coherently — main-thread cross-region Y layout | alignments, and only alignments |
| **Monolithic** | `installGlobalLifecycle` | `GlobalRenderingBackend` | `uploadX(data)` | `render(data, state)` (no blocks, no keys) | display has no region partitioning (heatmaps spanning the whole view) | HiC, LD (both `GlobalDataDisplayMixin`); multi-variant matrix (monolithic backend but `MultiRegionDisplayMixin` fetch) |
| **Keyed shared-canvas** | `installKeyedLifecycle` | `KeyedRenderingBackend` | `uploadGeometry(key, data)` + `deleteGeometry(key)` | `render(state)` — every key, one frame | one canvas paints several displays/levels, each with its own buffer | dotplot (key per display), multi-LGV synteny (key per level) |

Four contracts and three installers, because the whole-map synced payload is one
global slot: what separates it from monolithic is the backend's shape, not how
the upload is driven.

The last row keeps getting misfiled, and this table had it wrong in both
directions: dotplot was listed as Monolithic — whose base class it does not
extend and whose `uploadData(data)` signature it does not have — and synteny as
whole-map synced, which would need a `sync` it has never had. Both are keyed, and
keyed is neither neighbour: monolithic has no key at all, and per-region hands
the model's data map back at render time instead of the backend owning it.

`KeyedRenderingBackend` is an interface with no abstract class under it, unlike
the other two. The base classes are the shared state; there is no shared behavior
on top, because the two render loops genuinely differ.

MAF is **per-region streamed**, not whole-map synced: its blocks are independent,
with no main-thread Y-layout coupling adjacent regions, so each region's upload
re-encodes in isolation. Alignments' whole-map sync exists *only* because pileup
Y-rows must be assigned consistently across `displayedRegions` — a read spanning
a region boundary needs the same Y row in both — which forces the upload to
rebuild the whole map whenever any region's input changes.

All four patterns expose the same lifecycle (`attachRenderingBackend({ upload,
render })`); the difference is how the upload callback shovels bytes.

#### Every backend extends a base, and the reason is the error channel

`GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase` hold what every
backend has: the `hal` + uniform scratch (or `canvas` + 2D context), `dispose`,
and `setErrorHandler` — the last of which routes a HAL over-limit allocation to
the display's `renderError`, which is what raises the "too much data to render
on this GPU — zoom in" banner instead of leaving a blank canvas.

Three backends used to implement their interfaces standalone: **alignments,
dotplot and multi-LGV synteny**. None declared `setErrorHandler`, and
`useRenderingBackend` called it as `r.setErrorHandler?.()` — so the three largest
vertex-buffer allocators in the app were exactly the three whose OOMs reached
nobody. The HAL reported, `OomReporter`'s handler was null, the console got a
line and the view painted blank, with the banner built and wired the whole time.

`setErrorHandler` is **required** on `RenderingBackend` now and the `?.` is gone,
so a backend that doesn't extend a base is a compile error rather than a display
silently forgoing its error channel. `?.` on a capability every implementer
should have reads as tolerance and spends as silence.

#### Per-region streamed: one autorun and a diff (`installPerRegionLifecycle`)

**Plain English:** The naive implementation re-uploads every chromosome to the
GPU each time any chromosome finishes loading — 300 uploads instead of 24 for a
whole-genome wiggle track. The helper remembers what it last sent for each
chromosome and sends only what changed. When chromosome 5 arrives, chromosome 5
uploads. When the user changes a color setting, all 24 re-encode and re-upload —
which is the right behavior, and is why the display has to *declare* that the
color is an encode input.

Naive per-region upload iterates the full `rpcDataMap` inside the upload callback
and re-uploads all N regions on every `rpcDataMap.set` — O(N²) GPU uploads when N
regions arrive sequentially. The loop is fine; the missing piece was memory of
what it already sent.

**The helper lives in `@jbrowse/render-core/installPerRegionLifecycle`** and is
used by wiggle, multi-wiggle, manhattan, MAF, sequence, and canvas's
`LinearMultiRowFeatureDisplay`. It does **not** apply to the canvas plugin's other
display, `LinearBasicDisplay`, whose whole-map Y-layout keeps it on the
computed-map form described below. (The canvas plugin's two displays sit on
opposite upload strategies, so they're always spelled out where they diverge.
`LinearMultiSampleVariantDisplay` is per-region too, deriving its regions map
from a single `cellData` computed (`perRegionCellMap`) and handing that to this
same installer.) Each plugin's `startRenderingBackend`
collapses to a single call:

```ts
startRenderingBackend(backend: XxxRenderingBackend) {
  installPerRegionLifecycle(self, self.rpcDataMap, backend, {
    inputs: () => self.gpuProps(),     // omit for an encode that needs nothing
    encode: (data, props) => encode(data, props),  // omit if there is nothing
    render: (b, encoded) =>            // to encode — see below
      b.renderBlocks(
        self.renderBlocks,
        /* rpcDataMap or `encoded` */,
        self.renderState,
      ),
  })
}
```

**Omit `encode` when the payload the display holds is the payload the backend
takes**, which four of the seven per-region displays are. It is not the same code
with an identity default filled in: the helper skips the encode step, so the two
mirror maps it otherwise keeps — one payload reference and one source reference
per loaded region — are never allocated, and `render` receives the display's own
map. The four each wrote `encode: data => data` and then ignored `render`'s
second argument, reading their own map instead.

One upload autorun runs over the whole map with two reference diffs under it: a
region re-encodes when its own entry is replaced or when `inputs` changes
identity, and re-uploads when its encoded payload changes. A new key costs one
encode and one upload; a settings change costs N of each. The quadratic term left
is N `Map.get`s per arrival. [ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md)
has the reasoning, including why ADR-017's per-key autoruns are gone.

**`inputs` is the whole contract.** `encode`'s own reads still run inside the
upload autorun, so they wake it, but they invalidate nothing — a wide read there
re-runs the diff and encodes nothing. Anything a settings change must reach the
buffer through therefore goes in `inputs`, which the helper memoizes as a
computed.

**This fixes uploads and encodes only. Draws keep the O(N²) shape.**
`renderBlocks` clears the canvas and redraws every loaded region, so N sequential
arrivals still cost about N²/2 block draws. Each arrival no longer draws *twice*
— the upload now happens inside the upload autorun's own run, so there is no pass
where the map holds a region the backend does not — but read
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data)
before chasing the rest: 24 regions cost 72 draws, the double draw explains 24 of
them, and removing two thirds moved no user-visible number.

The helper also caches successful encode outputs in a `Map<number, Encoded>` and
passes it to the render callback — wiggle's renderer reads from this map because
its renderer is stateless; other callers ignore the arg and read `rpcDataMap`
directly.

**Why `LinearBasicDisplay` / alignments are whole-map rather than streamed:** those
lay out features into Y-rows across all loaded regions together (a gene spanning
two adjacent regions lands on the same row in both), so any new arrival can in
principle change the layout of everything already loaded. They route through a
whole-map MobX computed (`laidOutDataMap` / `laidOutPileupMap`) that invalidates
on any `rpcDataMap` change, and their upload payload *is* that computed's output
— no encode step, so nothing to declare `inputs` for. Until ADR-078 the reason
was stronger than that: per-key autoruns could not help a whole-map computed at
all, because reading `laidOutDataMap.get(key)` still tracks the whole thing. Now
the two paths run the same diff and the split is thin, so a display moving from
one to the other is a small change rather than a different strategy. This
cross-region coupling is load-bearing (collapsed-intron views split one
chromosome into many
displayed regions, and a long gene must hold the same Y row in each) and is why
layout runs on the main thread — row assignment needs the union of all visible
regions' features. For alignments that placement is settled by
[ADR-053](../architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md),
which also says what to attack instead when the main-thread pack shows up in a
trace.

The whole-map form takes the **same installer** as the streamed one, with no
encode: `installPerRegionLifecycle(self, backend, { data: () =>
self.renderDataMap, render })`. It diffs the computed map
against the last upload by reference, so only regions whose data object actually
changed re-upload, and it owns the prune plus the re-upload-all on backend swap.
Canvas and `LinearMultiSampleVariantDisplay` are the two.

#### Monolithic and whole-map synced: named upload slots (`installGlobalLifecycle`)

A monolithic display has no region map to diff, but it can still have **more than
one upload slot** — and the mixin gives it exactly one upload autorun, so every
observable any slot reads re-fires all of them. That's harmless when the slots
share a source: LD derives both its matrix and its color ramp from `rpcData`, so
one arrival legitimately re-pushes both. It bites when the inputs are
independent — HiC's palette is a config slot while its contact matrix comes from
the RPC, so a palette flip re-uploaded the whole matrix and every fetch rebuilt
the ramp texture.

The installer hands `upload` a `slot` function for exactly that: name each slot,
and it skips the upload while that slot's input is reference-identical to its
last, dropping every memo on a backend swap for the same context-loss reason.

```ts
startRenderingBackend(backend: HicRenderingBackend) {
  installGlobalLifecycle<HicRenderingBackend>(self, backend, {
    upload: (b, slot) => {
      slot('data', self.rpcData, (bb, data) => {
        if (data) { bb.uploadData(data) }
      })
      slot('colorRamp', self.colorScheme, (bb, scheme) => {
        bb.uploadColorRamp(generateColorRamp(scheme))
      })
    },
    render: …,
  })
}
```

Read every slot's input **unconditionally**, as above — a read moved behind an
`if` drops out of the autorun's dependency set on the runs that skip it, the same
hazard `installGlobalFetchAutorun` documents for its trigger list. Let the upload
callback handle the empty case. A display whose uploads share one input (LD, the
variant matrix, alignments' `sync`) ignores the `slot` argument: the autorun's
whole dependency set is that field, so it cannot re-fire spuriously.

`LinearBasicDisplay` recovers O(N) anyway via `createIncrementalLayout`
(`plugins/canvas/src/LinearBasicDisplay/layout.ts`), which memoizes the pure
layout **per ref-group** so unchanged chromosomes return prior output by reference
and only changed regions re-upload. Alignments/synteny keep the plain whole-map
form (N is only 4–8 buffered regions at their gene-level zoom). Full derivation of
the incremental-layout memo and its chain-mode wrinkle: [ADR-017](../architecture-decision-records/adr-017-wiggle-per-key-autoruns.md), [ADR-011](../architecture-decision-records/adr-011-canvas-flatbush-immutable-offsets.md).

**A keyed-upload backend wants the same kind of memo one level down: the
color-lane patch.** A genuine recolor (`colorBy`, `opacityByIdentity`, a track
palette shift) does produce a fresh `colors` array, and the `geometry` getter
then hands the backend a fresh object over the *same* coordinate arrays — which
is exactly what `createKeyedUploadSync`'s reference diff is meant to catch, but a
naive backend re-packs every lane to change one. So both renderers hold a
`createInstanceCache` (`@jbrowse/render-core/instanceCache`), which memoizes the
packed bytes on `(one geometry array's identity, colors' identity)` and patches
the color lane in place when only the latter moved. The GPU re-upload still
happens — the HAL has no partial-buffer update — but the CPU interleave, which
dominates at 10⁵–10⁶ instances, does not. Each plugin supplies an
`InstanceCacheOpts` naming its geometry token, its color accessor and the stride
and color offset the patch has to write at; any new keyed-upload backend whose
palette is a separate main-thread pass wants the same. The
model-side half of this split — why the colors array is fresh in the first place,
and why opacity is *not* in it — is
[ARCHITECTURE.md § gpuProps and derived region
maps](../ARCHITECTURE.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).

## HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/render-core/src/hal/`.

### The remaining "pass" names mean the pipeline, not WebGPU's render pass

Read this before reading any HAL method name, because the word collides with
WebGPU's own and the collision inverts what two of them appear to do.

**`PipelineDescriptor` is a pipeline state object (PSO).** It carries shader
source, the vertex input layout, blend state, primitive topology and texture
bindings, and each one becomes exactly one `GPURenderPipeline`
(`resolvePipelines`, `webgpuHal.ts`) or one linked program + VAO (`compilePass`,
`webgl2Hal.ts`).

**The two HALs build them at opposite times, and that is not cosmetic.** WebGL2
builds a pass on its first *draw* (`getPass`), keeping one canary link in the
constructor so a GL stack that cannot compile our shaders at all still falls to
Canvas2D; a three-track LGV declares 29 programs and links 14. WebGPU resolves
the whole declared list before `WebGPUHal.create` returns, so a track's first
paint waits on every pass it could ever draw. Measured, that costs less than it
reads: the 23 resolve concurrently, so the batch is ~22 ms of wall time and none
of it on the main thread. And pipelines are **shared across displays** —
`hal/deviceGpuCache.ts` memoizes them per device on the descriptor's own
identity, so a four-track session builds 23 of them, not 92. Both numbers, and
why going lazy here would cost more than it saves, are in
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#every-webgpu-display-resolves-its-whole-pass-list-before-it-can-paint).

A descriptor's identity is what makes that cache correct rather than clever: a
plugin's `*_PASSES` is a module-level const and `slangPass` reads `wgslSource`
off a generated const, so every display of a type hands the HAL the *same*
objects. WebGL2 has no counterpart and wants none — a program belongs to the
context that linked it, and each display owns a context.

The type says so; the **identifiers around it still say "pass"** — `passId`,
`drawPass`, `slangPass`, `InstancePass`, every plugin's `*_PASSES` array. Those
all mean *this* pipeline, and the rest of this section is about reading them
that way.

**WebGPU's render pass is the `beginFrame`/`endFrame` bracket.** There is
exactly one per frame: `beginFrame` calls `beginRenderPass` with the MSAA
attachment and its resolve target, every draw in the frame is encoded into it,
and `endFrame` ends it and submits a single command buffer. Batching the whole
frame into one pass is deliberate — it makes MSAA resolve once instead of per
draw, which is what keeps intermediate-resolve artifacts out.

So, concretely:

| Reads like | Actually is |
|---|---|
| `drawPass(passId, regionKey)` | bind PSO `passId`, bind that region's vertex buffer, issue **one instanced draw call**. It does not begin a pass. |
| `beginFrame` / `endFrame` | open and close **the** render pass, plus the command encoder and submit |
| `PipelineDescriptor.blend` | one field of the PSO's fragment target state |

**Why the rename stopped at the type.** A type name is read in isolation, by
someone deciding what the thing *is*, which is where the wrong word costs most —
and it is one declaration plus its imports. `passId` is not in that position: it
is a join key spelled identically in the HAL's buffer registry, `drawPass`'s
signature, `InstancePass` and every plugin's pass array, so renaming it touches
hundreds of call sites to restate what the type now says once. Read `passId` as
"pipeline id" and the whole interface follows.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d|canvas  → return null                 (Canvas2D backend)
  ?renderer=webgl            → skip WebGPU, try WebGL2 → null on failure
  otherwise                  → try WebGPU → WebGL2 → null
```

**Key methods** (full interface: `packages/render-core/src/hal/types.ts`):

- *Frame lifecycle* — `beginFrame(...)` / `endFrame()` bracket a render pass.
- *Data* — `uploadBuffer(regionKey, passId, data, count)`,
  `getBufferCount(regionKey, passId)`, `uploadTexture(...)`,
  `writeUniforms(data)`.
- *Draw* — `drawPass(passId, regionKey, bufferPassId?)`, `setScissor` /
  `clearScissor`, `setViewport` / `clearViewport`.
- *Lifecycle* — `deleteBuffer(regionKey, passId)`, `deleteRegion(key)`,
  `pruneRegions(active)`, `resize(width, height)`, `setErrorHandler(handler)`,
  `dispose()`.

`drawPass` short-circuits when the region has no buffer for that pass (or count is
zero), so callers issue draws unconditionally without tracking which regions have
data.

**An empty upload IS the release.** Every HAL deletes the pass's prior buffer
*before* looking at the count, so `uploadBuffer(key, pass, data, 0)` is the
"this pass has nothing this time" instruction, and `uploadPass` passes an empty
pack through rather than skipping it. What a caller must not do is skip the call
to save an upload: that leaves the previous frame's bytes on the GPU. A guard
that *deletes* first and returns is merely the same instruction spelled twice —
`GpuHicRenderer` carried one until 2026-08-21, harmless and a second place to
state the release.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery), `WebGL2Hal`
(`antialias: true`, VAO + UBO, context-loss recovery), `MockHal` (tests).

### WebGL2 contexts are a page-level budget, one per display

`WebGL2Hal`'s constructor takes its own `canvas.getContext('webgl2')` with no
pooling, and each display owns one backend canvas (`DisplayChrome` hands out a
single `canvasRef`; extra canvases its child renders are 2D overlays). So the
count to watch is **open GPU tracks**. `WebGPUHal` has no equivalent cap, since
every display shares the `gpuDevice.ts` singleton; **that is a primary reason the
GPU path targets WebGPU.**

Chromosomes are free: a whole-genome view of one track is one canvas holding one
buffer per `displayedRegionIndex`, drawn as several scissored blocks. Practical
consequences:

- Mounting a canvas is not free, and `stopRenderingBackend` + `dispose()` on
  unmount is what returns a context. Views lazy-mount for this reason
  (`useViewVisibility.ts`); tracks within a view do **not** yet.
- `?renderer=canvas2d` allocates none, which is why it is the fallback for
  many-track sessions.

The cap itself, what happens past it, and the mitigation state are in
[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) and
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"One WebGL2 context per
display canvas". Don't restate the numbers here — they have been wrong in three
places at once before.

**A failed device acquisition is cached, except after a loss.** `getGpuDevice()`
memoizes its promise, so a null result normally means "no WebGPU on this machine"
and every later backend skips the rung for free. But the re-init following
`device.lost` asks for an adapter within a frame of the loss, and on a sleep/wake
or driver reset that is precisely when `requestAdapter` still declines — not a
rare race there but the expected timing. Caching *that* pins the whole page to
WebGL2 until a reload, silently. So `gpuDevice.ts` tracks whether a device has
ever been acquired (`hadDevice`) and past that point retries (3 × 700 ms) and
never caches a failure. A machine that genuinely lacks WebGPU declines on the
first ask and waits for nothing.

**Renderer override** (query param `?renderer=`). Only three values are
recognized (`createHal.ts` + `getGpuDevice`): `canvas2d` / `canvas` force the
Canvas2D backend, and `webgl` skips the WebGPU attempt. Omitted → auto-detect.

**`?renderer=webgpu` pins that rung and does not fall past it.** A pinned
renderer that silently substitutes another makes every comparison against it
wrong, so `createGpuHal` fails visibly instead — a `renderError` naming the pin
it could not honor, with the banner's "use Canvas2D" as the way out. This
paragraph used to say the value was unrecognized and fell back like an omitted
param; both halves are false. A test or bug report still proves which backend
ran by asserting on the HAL rather than reading the URL.

### A WebGPU canvas's configuration belongs to the element, not to the HAL

`canvas.getContext('webgpu')` hands back the **same** `GPUCanvasContext` object
every time, so the swap chain a HAL configures is per-element state. Two HALs can
end up sharing one — a display whose `model` prop swaps under it, an init that
overlaps the cancelled one before it — and then `WebGPUHal.dispose()`'s
`unconfigure()` releases whatever is configured, which may be the live HAL's.
Firefox answers every later frame with `InvalidStateError:
GPUCanvasContext.getCurrentTexture: Canvas not configured`, and because there is
**no context-lost event for it**, none of `useRenderingBackend`'s recovery ever
runs: the throw leaves the render autorun, becomes `renderError`, and the display
banners the raw DOMException until the tab is reloaded. Reported from a
five-row pangenome synteny view, where every band showed it at once.

Two guards, in `webgpuHal.ts`: `canvasConfiguredBy` (`canvasContext.ts`) records
which HAL holds a canvas's configuration so `dispose()` releases only its own,
and a frame that finds the swap chain gone rebuilds it and paints rather than
throwing. A rebuild that does not restore it is reported once through the
display's error handler — not retried, since every later frame would rebuild to
no effect, and Retry is what builds a fresh HAL.

**What actually drops a configuration, measured in Firefox Nightly** (the WebGPU
browser here — `runner.ts --backend=webgpu` routes to it):

| action | still configured? |
| --- | --- |
| `unconfigure()` | **no** |
| `device.destroy()` | yes |
| `canvas.remove()` (detached), then re-attached | yes |
| `canvas.width = …` (resize) | yes |
| ancestor `display: none` | yes |
| tab hidden 1 / 3 / 10 s | yes |

So `unconfigure()` is the only producer of that message, and reconfiguring
recovers the context in full. `getCurrentTexture` is the only call that reports
it. Reproduce the whole path against the built app with
`products/jbrowse-web/browser-tests/swapchain-steal-probe.ts`, which steals a
real band's swap chain and reads the canvas back: unguarded, the band goes to
zero inked pixels and stays there under the banner.

### Renderers stay stateless

GPU renderer classes own only what is intrinsically per-instance:

- the `GpuHal` reference
- pre-allocated uniform scratch buffers reused across frames to avoid per-frame GC
  churn
- save/restore UBO scratch where a pass mutates uniforms (alignments arc/overlay)

What does NOT belong as renderer instance state:

- **Region-lifecycle bookkeeping** — call `hal.pruneRegions(active)` instead of
  mirroring HAL's region map in a renderer-side `Map<number, ...>`. HAL is the
  authoritative owner of "which regions have GPU buffers."
- **Per-region metadata derivable from `rpcDataMap`** — `hasRects` / `hasLines` /
  `outlineColor` style fields. `drawPass` skips missing buffers so the boolean
  flags aren't needed; per-region scalars used in uniforms should be passed into
  `renderBlocks` from the MST model rather than cached on the renderer. See
  `GpuCanvasFeatureRenderer` for the canonical shape.
- **Write-only mirror copies of upload data** — if a value lives in
  `rpcDataMap[idx].foo`, don't also store it as `LocalRegion.foo`.

Rule of thumb: anything the upload callback knows from observable inputs can be
looked up at render time too, and less local state means fewer divergence points
when the source of truth shifts.

**The one legal renderer-held region map, and what makes it legal.** The model's
`rpcDataMap` / `laidOutDataMap` is the single source of truth, and most displays
pass it in per frame — that is the default to reach for. A renderer-held `private
regions` map is legal only when written **exclusively by the upload callback**
and never mutated in place: `RenderLifecycleMixin` bumps `renderTick` after every
upload, so the render autorun re-fires and the cache cannot stale. Alignments is
the one display built that way, its GPU side having to hold buffers anyway. Still
forbidden: a cache populated from anywhere else, one whose entries get patched in
place, and mirroring HAL's region map instead of calling
`hal.pruneRegions(active)`.

## Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL (WebGPU) and
GLSL ES 3.00 (WebGL2) by `packages/shader-tools/src/build-shaders.ts`.

**slangc compiles both backends; it just has no GLSL ES target.** Its profile
list runs `glsl_110` … `glsl_460` — desktop only, no `*_es` profile and no ES
capability (checked against the pinned 2026.5.2: `-profile glsl_300_es` is
`unknown profile`). So `-target glsl` yields Vulkan-flavoured desktop GLSL —
`#version 460`, `gl_VertexIndex`/`gl_BaseVertex`, `layout(binding=N)` on UBOs,
`layout(location=N)` on varyings, HLSL brace initializers — and
`vulkanGlslToWebgl2.ts` is the ~200-line adapter down to ES 3.00. That file is
not an alternative to using Slang for WebGL; it is the gap Slang leaves. The one
real alternative — `-target spirv` through SPIRV-Cross's ESSL backend — was
weighed and declined in
[ADR-061](../architecture-decision-records/adr-061-webgl2-glsl-comes-from-the-regex-adapter.md).

**Never hand-edit `*.generated.ts`** — edit the `.slang` source and run `pnpm
gen:shaders`. The generated module exports source strings, per-field byte offsets,
strides, typed uniform/instance structs, a typed `writeUniforms()` /
`packInstances()`, and the `VERTEX_ATTRIBUTES` array; TS imports these by name, so
stride/offset drift between packer and shader is impossible by construction. CI
runs `pnpm gen:shaders && git diff --exit-code` to catch stale outputs, and the
build itself refuses a `.generated.ts` that no `.slang` produces any more — a
renamed shader or a dropped `//! *-out` leaves a committed file frozen at its
last value, which is the one staleness a diff cannot see.

**A shader's binding table is generated, not restated.** `BINDINGS` is the
reflected `@binding` list — `{ index, kind, name }`, with `kind` spelled the way
WebGPU spells it so a consumer hands it straight to `createBindGroupLayout`.
Three places used to assert those indices by hand, none consulting the shader.
The LD compute driver now builds both its layout and its bind group from
`BINDINGS`, matching buffers by *kind* rather than name, since the two kernels
call their input `genotypes` and `haps`. The render HALs still build the two
shapes they implement, but `pnpm gen:shaders` refuses a render shader whose table
is not one of them — the check `createUniformOnlyBindGroupLayout`'s comment
("Binding index 1 matches what the codegen emits") never had.

**Reflection and the emitted WGSL are cross-checked.** They are two outputs of
different slangc passes and only one of them is what the GPU runs, so
`assertBindingsMatchWgsl` reads the `@binding(N) @group(0) var<…>` declarations
back out of the WGSL and makes them agree with the table — the same doctrine as
`assertVertexInputsMatch`, and one-directional for the same reason: slangc drops
a binding the body never reads (`flatQuad.slang` declares a uniform block and
then takes every value from its instance attributes), which is DCE and harmless,
while a *declared* binding the table doesn't mention is one nothing would bind.
This is what a `SLANG_VERSION` bump would trip if the sampler expansion — the one
index the codegen invents, `index + 1` — ever changed.

**One suffix, one meaning: `_BYTES` / `_WORDS` are units, `_F32` / `_U32` /
`_I32` are typed-array views.** So the layout surface is `INSTANCE_STRIDE_BYTES`,
`INSTANCE_STRIDE_WORDS`, and `INSTANCE_OFFSET_F32` / `_U32` / `_I32` — each
offset map holding only the fields whose Slang type takes that view, matching
`UNIFORM_OFFSET_*`.

It was not always: a flat `FIELD_OFFSET_F32` covered every instance field
regardless of type, where `_F32` meant *words*, so two adjacent generated
constants used one suffix for opposite things. Packing through it meant choosing
the destination view by hand, and `f32[o + F.position]` on a `uint position`
compiled and wrote a float bit pattern the shader read as an enormous integer.
About 140 call sites did it correctly and nothing checked them. Both the flat map
and `INSTANCE_STRIDE_F32` are **gone**, not deprecated — leaving either would
have kept the ambiguous suffix in the vocabulary and a second, unchecked way to
do the same thing. A hand-written packer (one that can't use `packInstances()`
because it indexes a second array or scales on the way in) now names the view it
writes through, and naming the wrong one does not compile.

`packages/alignments-core`'s coverage packers are the worked example of why this
matters most at a distance: that package deliberately can't import the plugin
owning the `.slang`, its `layout-out` artifact carried no type information at
all, and so each packer headed a prose restatement of the struct
(`[position(u32), yOffset(f32), …] = 20 bytes`) that nothing could check.

Layout: display-specific shaders in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared in
`plugins/<plugin>/src/shared/shaders/`; cross-plugin modules in
`packages/render-core/src/shaders/` — the atoms (`hpmath.slang`,
`antialias.slang`, `colorPack.slang`) plus the shared *shapes* two or more
plugins draw identically (`pointGlyph.slang` disc/square markers,
`diagonalGrid.slang` the 45°-rotated Hi-C / LD cell transform, `rowRect.slang`
the MAF / multi-row colored-row rectangle). A shape module earns its place on the `pointGlyph` bar —
two real consumers with a live drift hazard — not on surface similarity; see
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md).
`slangPass()` turns a generated module into a `PipelineDescriptor`, with overrides for
`topology`, `blendState`, `textures`, and buffer sharing. Authoring conventions
and gotchas: [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md).

### WGSL validates what GLSL waves through

Codegen emitting both backends means a shader can pass `pnpm gen:shaders`, run
fine on WebGL2, and be rejected at `createShaderModule` on WebGPU. Two rules the
WebGL2 path never enforces:

- **Derivatives (`ddx`/`ddy`/`fwidth`) must sit in uniform control flow.** A
  fragment shader that branches on a varying — a `shape` discriminator, an early
  `return` — and then takes a derivative inside that branch fails with `'dpdy'
  must only be called from uniform control flow`. Fix: each branch picks only its
  SDF, and the derivative + AA ramp run once after the branch (`manhattan.slang`),
  or compute every glyph's alpha before the branch and let it select
  (`wiggle.slang`). Reconvergence restores uniformity, so a plain `if/else` that
  assigns and falls through is fine; `discard` doesn't demote it either.
- **A `max` blend operation takes no factors.** WebGPU rejects any factor but
  `one` on either channel, so `BlendState` makes `{ op: 'max' }` a variant with no
  factor fields at all rather than letting an ignored-but-invalid pair be written.

Both survive review easily because the WebGL2 fallback renders correctly; the
only signal is a `[GPU] UNCAPTURED ERROR` / `GPUPipelineError` in a WebGPU
browser. To check every shader at once without the app, drive puppeteer at a
**secure origin** (`navigator.gpu` is undefined on `about:blank`) with a
WebGPU-capable Chrome, import each `*.generated.ts`, and read
`createShaderModule(...).getCompilationInfo()`; wrap `createRenderPipeline` in
`pushErrorScope('validation')` for the blend/pipeline half.

## Canvas scaling & hi-DPI

**GPU canvases (HAL-managed):** shader uniforms are in CSS pixels; HAL sets the
backing store to `css × dpr`, so `N / canvas_width` in clip space = `N` CSS pixels
at any DPR. Do not manually scale by `devicePixelRatio`.

**2D overlay canvases (`VisibleLabelsOverlay`, `MsaHighlightOverlay`, etc.):**
caller owns DPR. Set `canvas.width = w * dpr` + `canvas.height = h * dpr` in the
effect, call `ctx.scale(dpr, dpr)`, then put CSS `width`/`height` in the style
block. Skipping this renders blurry on Retina. `prepareCanvas` (in
`packages/render-core/src/canvas2dUtils.ts`) does this for the on-screen Canvas2D
backend path; standalone overlay components must replicate it.

## Antialiasing ramps: how wide, and where the width comes from

**`packages/render-core/src/shaders/antialias.slang` is the rule.** It holds
both ramp widths, the one ramp shape and `glyphEdgeAlpha`, and its header says
which width a shader gets to use. What follows is why there is a module at all.

Five shaders were fixed for one bug — synteny, dotplot, the point glyphs, hi-C,
and chevron — and it is the same bug every time: **an AA ramp whose width was
measured with `fwidth`, and/or whose geometry had no room for it.**

`fwidth` is `|ddx| + |ddy|`, which overshoots a true gradient by up to √2, worst
on diagonals, which is what these marks are made of. Where it was *also* the
smoothstep's half-width, the ramp came out 2–2.83 output pixels instead of 1.

The first four were each found by someone looking at the mark. Chevron was found
by asking which shaders still called `fwidth` after the fourth, which is the
sweep worth repeating: its arms run at exactly 45°, so it took the full √2, and
nobody had reported it because a too-wide LINEAR ramp does not thicken a mark —
it dilutes it. The half-max contour does not move. That is the failure mode to
look for, not a fat line.

The sweep is one line, so run it rather than reasoning about it:

```sh
grep -rn 'fwidth(' --include='*.slang' packages plugins example-plugins
```

It returns one line today: `continuation.slang`'s barycentric wireframe
estimator, whose own comment says why it stays and what would decide otherwise.
The paren in the pattern is what keeps the prose mentions — this section
included — out of the answer. A second call site is the thing to look at, and a
second is also what would make a `//! fwidth-ok: <reason>` directive worth
building. At one, the grep is cheaper than the machinery to enforce it.

The right width depends on what the SDF is measured in, and the three cases are
genuinely different:

- **Distance already in pixels** (synteny `perpCoverage`, the dotplot capsule,
  wiggle's center-line capsule and the xyplot bar's horizontal cuts): `|∇d| = 1`,
  so the half-width is `aaHalfPx(dpr)` and there is nothing to differentiate.
  Needs a `devicePixelRatio` uniform. **A varying set from the same screen y the
  vertex converts to clip is in this case**, not the next one — it is affine in
  screen y with unit slope, so the ramp is one output pixel wide by
  construction; `syntenyTypes.slang`'s `vertCoverage` and `wiggle.slang`'s
  `barInkPx` both rely on that.
- **Not a perpendicular distance in known units** — an SDF in quad-local units
  whose scale differs per shape (`pointGlyph`, manhattan: the disc and triangle
  carry unit gradients, the diamond's L1 norm carries √2), or a varying carrying
  a foreshortening the shader cannot state (chevron's vertical `dist`). Must be
  measured, as `aaGradient`, taken as the **full** width. It is also the only
  option for a shader with no `devicePixelRatio` uniform, which is why chevron
  measures — and why wiggle's capsule did, until the xyplot bar gave that
  uniform block a `devicePixelRatio` and it went analytic like the dotplot's.
- **Tiled cells** (hi-C bins): no per-quad AA at all, deliberately. Bins share
  exact edges after a linear transform, and antialiasing them individually
  produces seams. The same refusal covers marks that STACK — wiggle's step-line
  quads overlap at every joint by design, and the alignments coverage band's
  SNP/modification segments tile the depth bar they are drawn over — so those
  keep hard edges too. §"What the coverage band cannot antialias" below.

**There is one ramp SHAPE left, the linear `aaRamp`.** Which one to reach for
used to read as a preference — linear "is what a box filter, and so Canvas2D,
produces on a straight edge", cubic "reads softer on a curve" — and
`scripts/aa_ramp_coverage_study.ts` settles it by scoring both against the exact
area a straight edge covers of a pixel, at five angles. Linear is closer at
every one of them:

| edge angle | max error, linear | max error, cubic |
| --- | --- | --- |
| 0° | 0.00023 (quadrature noise) | 0.09631 |
| 22.5° | 0.03323 | 0.07345 |
| 45° | 0.04298 | 0.06737 |

The cubic is not trading accuracy on the axis for accuracy on the diagonal; it
is worse on both, and "softer" is it carrying more ink on both sides of the
half-max contour. A thin mark shows it plainly: a band built as
`ramp(d) - ramp(d - W)` is exactly right at every width with the linear ramp,
where the cubic paints a half-pixel band at 0.688 coverage instead of 0.500.

**All four cubic call sites are converted** — synteny's `perpCoverage` and
`vertCoverage`, the dotplot capsule, and `glyphEdgeAlpha` with every point glyph
behind it — and `aaSmoothRamp` went with them rather than staying deprecated,
because a shader function nothing calls is dead-code-eliminated out of every
compiled shader and `pnpm gen:shaders` then fails its own js-skip check for
naming a function no emitted shader contains. The smoothstep form is written
down in the study script, which models both shapes in JS.

Each conversion was a one-argument change, and the factor of two is the whole
risk: `aaSmoothRamp(d, halfPx)` becomes `aaRamp(d, 2.0 * halfPx)`, since the
linear form takes the FULL ramp width where the smoothstep takes the half. Get
it wrong and it still compiles, with every ramp in that shader half or double
the width it asks for.

**The drift these conversions predict is NOT yet measured.** The instrument is
the cross-backend gate rather than a golden — it diffs canvas2d against the GPU
render of the same run with canvas2d as the reference side, and `Dotplot View`,
`Synteny Views`, `Multi-Way Synteny Views` and `GWAS Tracks` are all in its CI
scope, so all four sites are watched:

```sh
pnpm --filter @jbrowse/web build
cd products/jbrowse-web && node browser-tests/runner.ts \
  --backend=all --skip-webgpu --swiftshader --gate-only --ci-gate --drift-report
```

A ramp closer to exact coverage should move those pairs DOWN the distribution
[CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) records (66 pairs, max 0.62%,
median 0.00%), not merely somewhere else. Note the wiggle line plots at the top
of that distribution were already on the linear ramp, so they are the control
rather than the target.

**Check that nothing else is driving the harness before you start.** That file
already says the machine has to be quiet; the sharper version is that a SECOND
`runner.ts` in the same worktree does not merely add load — a golden-refresh run
`rm -rf`s `browser-tests/__snapshots__` and restores its own copy, and it holds
the browser and the test server. Two attempts at the run above were spent
learning that: one degraded into `data-display-drawn` timeouts across
`Miscellaneous Tracks` and `Multi-Way Synteny Views`, the other wedged
indefinitely on `BigWig Tracks > GC content track` — which was one of the three
suites the other run was filtered to. `ps -Ao command | grep runner.ts` is the
check, and it costs nothing next to a build.

**Two efforts land on the same pixels, so a drift run has to hold one fixed to
read the other.** This conversion and the per-display MSAA sample-count question
are not independent: `glyphEdgeAlpha` sits behind `pointGlyph` and manhattan's
SDFs, and the primitives
[ideas/arc-antialiasing-without-msaa.md](../ideas/arc-antialiasing-without-msaa.md)
records as still depending on the 4x MSAA target are wiggle/coverage bar tops,
read arrow tips and the tiled Hi-C/LD diamonds. A ramp change and a sample-count
change on one build produce a number neither effort can attribute, so record the
commit any drift table was measured at.

**A ramp needs geometry to live in.** Widening one without padding the quad
clips it: the dotplot capsule quad is now `halfWidth + aaHalfPx` on both axes, with
a `discard` for the fragments the pad introduces. The tests for this
(`shaders/dotplotCapsulePad.test.ts`, `shaders/glyphEdgeAlpha.test.ts`, and the
pre-existing `syntenyFillPad.test.ts`) mirror the shader in TS and assert the
geometry contains everything the fragment shades, each pinning the retired
spelling as a counterexample. They *model* the shader rather than reading it, so
a `SYNC` comment is what keeps them honest.

**And a model test cannot check an agreement it models from one source.**
`syntenyFillPad.test.ts` looked like it would catch a corner→edge pairing drift
and could not: it builds both the polygon and the analytic clip from one copy of
`fillEdges`, so it assumes the very agreement it appears to test. That is what
`ribbonEdges` is for — one corner→edge pairing, so the property is structural
instead of tested.

### What the pad costs, measured

`browser-tests/probe-dotplot-pad-cost.ts` runs the shipped GLSL and changes one
thing, the vertex stage's `ext`. 400k instances at dpr 1 on an Intel UHD 630:

| lineWidth | padded | unpadded | pad costs |
| --- | --- | --- | --- |
| 1 | 5.473 ms | 5.317 ms | +2.9% |
| 2.5 (default) | 6.530 ms | 5.629 ms | +16.0% |
| 5 | 9.826 ms | 8.271 ms | +18.8% |

Real, inside a 60fps budget, and it buys a correct edge — the GPU's ink error
against the Canvas2D render of the same segments goes from −1.87% (under-inked,
the ~1px-narrow line) to +0.91%. Two results that invert the obvious guess:

- **Cost scales opposite to the area *ratio*.** The ratio is worst for thin lines
  (4× for a `lineWidth` 1 dot) and the measured cost is *lowest* there: the quads
  are small enough that per-instance setup dominates and fill barely registers.
  Once fill dominates, absolute added area is what matters, not the ratio.
- **The `discard` is not a lever on it.** `finalAlpha <= 0.0` holds only at
  `d ≥ halfWidth + aa`, so along a line's body the pad ring never discards — that
  ring *is* the outer half of the ramp and has to be shaded. Only the quad corners
  past each cap go. The pad is geometrically required; the only reduction
  available is a narrower ramp, which is a quality decision.

Measuring it has two traps that each produce a confident wrong answer. Headless
Chrome falls back to SwiftShader, whose cost is not area-dominated — it reports
the pad as free (0.8%, against ±3.5% noise); the real GPU needs a headed browser,
as `runner.ts` says for the webgl backend. And machine contention lands mostly on
the cheaper variant: a contended run read 8.1% where a quiet one read 16.0%.
Judge a run by whether the two distributions separate.

### Which backend disagreement is evidence, and which is not

Verifying this family of fixes turned on one question, and it generalizes:
**does the change move one backend, or all of them at once?**

`pnpm test:browser:compare` diffs `webgl` / `webgpu` / `canvas2d`. Where a change
is GPU-only, Canvas2D is an *independent render of the same marks*, so "closer to
Canvas2D" replaces "looks better" with a number — that is what settled both the
dotplot pad above and the point-glyph ramp (differing pixels against the canvas2d
golden 4.51% → 2.03%, excess chroma +11.19% → +5.72%). The goldens corroborate on
their own: canvas2d's capture does not move while webgl's does.

It is no oracle at all for a change that reaches every path together — a
`//! js-export`ed function whose generated twin Canvas2D and the SVG export call
(`fillShade`), or a constant a CPU path imports from the shader
(hi-C's `MIN_VISIBLE_ALPHA`). Those move in lockstep and agree on the new answer,
right or wrong, so they need a snapshot diff or an eye. Ask which side of that
line a change falls on *before* planning how to verify it.

Two things have no suite and needed one-off probes, both of which record their
traps in the file header: `browser-tests/hover-probe.ts` (drive
`setHoveredInstanceIdx`, never the mouse — a mouse move that lands on no feature
is indistinguishable from a hover cue that draws nothing; and require a settled
non-blank frame, because the repaint clears the canvas first) and the pad-cost
probe above.

### A bar's top edge is the datum, and it is measured

It is the one edge in the tree where aliasing corrupts an *encoding* rather than
a silhouette: the reader takes the score off that edge, so rounding its position
rounds the value. `wiggle.slang`'s xyplot bar computes its own coverage for that
reason (2026-08-22). `barInkPx` carries CSS px below each horizontal cut, the
fragment takes the difference of two `aaRamp`s, and the quad grows one device px
past each cut — the ramp's full width, so every fragment the ramp inks is
*fully* covered by the geometry and the rasterizer's own coverage never
multiplies into the analytic one. That last part is what makes the bar identical
at one sample and at four, and it is why `aaHalfPx` (the dotplot capsule's pad,
half as wide) is not enough here: it stops the ramp being cropped, but leaves the
fringe pixel partly covered.

Both horizontal cuts, not only the top. The band form is the only one exact below
one device pixel — a single top ramp against a hard baseline applies a half-plane
coverage formula to a slab, and paints a half-covered row under a bar of zero
height, which on a wiggle full of zero bins is a dotted line along the origin.

**Neighbouring bars do share pixel columns, and the bound is measured rather
than argued away.** `extendToMinWidthX` floors a bin at `MIN_FILL_WIDTH_PX` by
growing it off its anchor, and bbi hands the wiggle a bin no wider than
`2 * bpPerPx` (`basesPerSpan = bpPerPx` at the default `resolutionMultiplier`,
and `getView` takes the coarsest reduction under twice it), so at most zooms a
bar is 1.5 CSS px over a bin narrower than that and overlaps its neighbours two
or three deep. Where their tops agree — a plateau, a flat run — the fringe row
composites `1 - (1 - a)^n` rather than `a`:

| bin (CSS px) | bars per column | fringe painted | correct | apparent top error |
| --- | --- | --- | --- | --- |
| 2.0, 1.5 | 1 | 0.50 | 0.50 | 0 |
| 1.25, 1.0 | 2 | 0.75 | 0.50 | 0.25 device px |
| 0.75, 0.5 | 3 | 0.875 | 0.50 | 0.375 device px |

Under MSAA the same overlap was free, because coincident flat fills cover the
same samples and the union is exact. So the change trades a 0.277 device px
quantisation error on EVERY column (the table below) for up to 0.375 on the
fringe row of a flat-topped run at an overlapping zoom, and is a clear win on
any data whose neighbours differ — which is why it stays. The measurement below
does not exercise it: `volvox_microarray` features are wide, and 2,208 of 2,532
device columns there are interior to a single bar.

The baseline is the same story one row down: every bar in a row shares `originY`,
so the overlap strips over-ink just under the origin too. In multi-row multiwiggle
there is a third instance with the opposite sign — rows stack edge-to-edge, so a
bar clipped to `domainYMax` puts its top cut exactly on the row boundary the row
above baselines on, and two edges that TILE compose to 0.75 where 1.0 is right.
Separator lines default off, so nothing covers it.

The sub-pixel position of the top, over the 2,208 columns interior to a bar in
`volvox_microarray` at dpr 2 — the after arms are the reference, and the record
says how they are independently validated:

<!-- BEGIN GENERATED MEASUREMENT wiggle-bar-top-subpixel -->

| arm                          | mean top error (device px) | max   | columns with the top on a whole device px |
| ---------------------------- | -------------------------- | ----- | ----------------------------------------- |
| before, 4 samples (shipping) | 0.069                      | 0.102 | 179                                       |
| before, 1 sample             | **0.277**                  | 0.475 | **2,151**                                 |
| after, 4 samples             | 0.00                       | 0.00  | 179                                       |
| after, 1 sample              | 0.00                       | 0.00  | 179                                       |

<!-- END GENERATED MEASUREMENT wiggle-bar-top-subpixel -->

`shaders/barCutCoverage.test.ts` pins both properties against the two spellings
that fail them.

The cross-backend gate is the independent check, and it is the falsifiable
prediction §"Which backend disagreement is evidence" asks for: Canvas2D
rasterises `fillRect` at fractional y and has always antialiased that cut, so a
shader computing the same coverage has to move TOWARD it rather than merely
somewhere else. Every pair that moved, fell:

<!-- BEGIN GENERATED MEASUREMENT wiggle-bar-top-backend-drift -->

| snapshot pair                          | before | after | change |
| -------------------------------------- | ------ | ----- | ------ |
| targeted_bigwig-multibigwig-xyplot     | 0.15%  | 0.01% | -0.14% |
| targeted_bigwig-multibigwig-multirowxy | 0.11%  | 0.02% | -0.09% |
| fullpage_bigwig-multibigwig-xyplot     | 0.04%  | 0.00% | -0.04% |
| fullpage_bigwig-multibigwig-multirowxy | 0.04%  | 0.01% | -0.03% |
| targeted_additional-color-wiggle       | 0.39%  | 0.37% | -0.02% |
| targeted_bigwig-gc-skew                | 0.02%  | 0.00% | -0.02% |

<!-- END GENERATED MEASUREMENT wiggle-bar-top-backend-drift -->

Note the rung: that is **webgl** under swiftshader, where the sub-pixel table
above is WebGPU on a retina panel. Two backends, two instruments, one verdict.

### What the coverage band cannot antialias

**The same change does not go on the alignments coverage band, and the reason is
structural.** Every mark there shares a horizontal edge with another mark:

- `snpCoverage` / `modCoverage` segments **stack**. Each accumulates `yOffset`,
  so segment *i*'s top is segment *i+1*'s bottom exactly. Per-fragment alpha on
  both sides of that edge composites to less than full ink and leaks the grey
  depth bar through — Kilgard & Bolz's conflation, the case MSAA sidesteps by
  keeping coverage exclusive per sample.
- The topmost segment's top **coincides** with `coverage.slang`'s depth-bar top
  whenever a position is fully mismatched, which is what a homozygous SNP is. Two
  primitives drawn one over the other with the same edge and the same fractional
  alpha `a` composite to `a·segment + a(1−a)·grey`, so ramping either one alone
  puts a grey fringe above the column and ramping both puts up to 0.25 of one
  there. Hard edges tile exactly at any sample count; that is why they are hard.
- `interbaseHistogram` is already `floor(… + 0.5)` on both y edges, deliberately
  — its own comment records the cross-backend divergence that produced the snap.

`Canvas2DHicRenderer.ts` and §"Tiled cells" above are the two earlier findings
this is the third of. The shape that would let the coverage band go analytic is
the same one §5 of
[ideas/arc-antialiasing-without-msaa.md](../ideas/arc-antialiasing-without-msaa.md)
offers hi-C: draw a position's whole stack as ONE primitive, deriving the segment
in the fragment, so the shared edges stop being primitive boundaries. Nothing has
costed that.

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are added,
removed, or reordered. **Not** an index into `dynamicBlocks.contentBlocks` — one
displayedRegion can produce multiple render blocks that share one GPU buffer and
draw with different scissor clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`, and
`RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny) key on a
tuple of two displayedRegion indices.

## What this architecture deliberately does not have

Every entry below is a standard real-time-rendering technique that a reader
coming from a game-engine background — or an agent prompted with game-engine
vocabulary — will reach for, and that we have a specific reason not to use.
Named here in the standard vocabulary so the reach lands on the reason.

**Render graph / frame graph.** A frame graph exists to order passes and
allocate transient render targets when a frame has many of both, with
dependencies between them. Ours has one render pass, one color attachment, no
offscreen targets, and no pass that consumes another's output. Ordering is a
static z-ordered list beside the renderers that read it (`PILEUP_LAYERS` is the
largest, at 12 entries with per-layer `enabled` gates; `COVERAGE_LAYERS` is the
other), and resource lifetime is `RegionRegistry`'s. The nearest proposal to a
frame graph — a unified GPU/Canvas2D "layer manifest" driving draw dispatch from
a table — was declined 2026-06 and has since been overturned for both of those
bands, which is a narrower thing than a frame graph and worth not confusing with
one: a shared list of layer ids carrying z-order and gates, plus a
`Record<LayerId, …>` per backend. No dependencies between passes, no targets, no
scheduling. See REJECTED_IDEAS.md for what the decline got wrong and what of it
survives.

**Indirect drawing (`drawIndirect`).** Indirect draws exist to remove a CPU
roundtrip when the GPU decides how much to draw. Nothing here generates geometry
on the GPU, and the instance count is already the packed buffer's own
`byteLength / instanceStride` (`uploadPass`), which the CPU computes as it packs.
There is no roundtrip to remove.

**GPU-driven culling.** Culling is CPU-side and stays there. Measured and
declined twice: for dotplot (quads are a few px, so the rasterizer discards them
about as cheaply as a vertex test would) and for hi-C contacts by distance from
the diagonal (2026-08-13). Synteny's `isCulled` is the case that *does* earn its
place, because its quads span the track. Both declines are in REJECTED_IDEAS.md
with their numbers.

**Storage buffers (SSBO) in the render path.** Every render pass feeds
per-instance data through a **vertex buffer** with `stepMode: 'instance'`, never
a storage binding, because Slang cross-compiles to GLSL ES 3.0, which has no
SSBOs. Adopting them would fork every shader into two variants — precisely what
the single-source Slang design exists to prevent. Storage buffers *are* used
where there is no GLSL target: the LD compute kernels
(`plugins/variants/src/VariantRPC/getLDMatrixGPU.ts`) bind `read-only-storage`
input and `storage` output, and are WebGPU-only by construction.

**Spatial acceleration structures for culling.** We index heavily with Flatbush
(a packed Hilbert R-tree, vendored at `packages/core/src/util/flatbush/`) — but
for **hit-testing and picking**, never to decide what to draw. A BVH/quadtree/
octree accelerates culling in a 3D scene with a moving camera; the genome axis
is 1D, and `view.displayedRegions` is already the spatial partition that
`regionKey` and the scissor rects are built on.

**Buffer pooling / sub-allocation.** Not present: `uploadBuffer` destroys and
recreates one `GPUBuffer` per `(regionKey, passId)` per upload. This is the one
item on this list that is an unclaimed opportunity rather than a settled
decision — a size-classed pool behind `RegionRegistry` would be invisible to
every caller. It is unclaimed because it is unmeasured. Measure the allocation
churn on a pan with alignments open before building it, and file the number
either way.

## Adding a new GPU display type

The public
[GPU displays guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
walks this checklist step by step (and
[Plotting features](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
does the Canvas2D-only version); keep them in step with any change here.

- **Types** — `MyData`, `MyRenderState`, `MyRenderingBackend`.
- **Shader** — author `my.slang`; `pnpm gen:shaders` emits `my.generated.ts`.
- **Renderers + factory** — `createRenderingBackend<MyRenderingBackend>` from
  `packages/render-core/src/createRenderingBackend.ts`. Use `slangPass()` to build
  the `PipelineDescriptor`.
- **MST model:**
  - Compose `MultiRegionDisplayMixin()` for LGV-family per-region displays (brings
    in `RenderLifecycleMixin`, `FetchMixin`, `RegionTooLargeMixin`, the five fetch
    autoruns, and `rpcProps()`→refetch wiring).
  - Compose `GlobalDataDisplayMixin()` for displays that hold a single
    non-regional dataset (HiC contact matrix, LD triangle; arc reaches the same
    autorun over the bare `GlobalFetchMixin`). Same slot mixin + `FetchMixin` +
    `RegionTooLargeMixin` plumbing, but **no** fetch autoruns — the display
    installs its own in `afterAttach` via
    `installGlobalFetchAutorun(self, { prepare, run, commit, delay, name })`.
    The helper owns the skeleton every global trigger shares (read the viewport,
    `isMinimized`, `rpcProps()` and `reloadCounter` unconditionally; skip a
    viewport the byte gate already measured; run through `autorunOnReadyView`;
    debounce); the display supplies the three phases. `prepare` runs
    synchronously in the autorun and returning `undefined` from it is the
    display's gate, so what it read to decline stays tracked (HiC declines until
    `effectiveResolution` lands, LD while `showLDTriangle` is off); `run` owns
    every await and writes nothing; `commit` writes while the fetch is still
    current. `runGlobalFetch(self, phases)` is that body without the trigger,
    for a caller wanting one round trip on demand.
  - Compose `RenderLifecycleMixin()` directly only when neither fetch surface is
    needed (rare).
  - Add a cached `renderState` view.
  - Define `startRenderingBackend(backend)` calling
    the render-core installer that fits its upload shape
    (`installPerRegionLifecycle` / `installKeyedLifecycle` /
    `installGlobalLifecycle`) — never a hand-rolled `attachRenderingBackend`.
  - Expose `rpcProps()`; add `gpuProps()` only when the main thread encodes GPU
    buffers from settings.
- **React component** — `observer()`. Render the canvas through the shared
  `DisplayChrome` (from `@jbrowse/plugin-linear-genome-view`), passing the model
  and the renderer `factory`. `DisplayChrome` calls `useRenderingBackend`
  internally and owns the render-error / region-too-large / error-bar / loading
  overlays, so the component only lays out its own canvas(es) via the render-prop
  child:
  ```tsx
  return (
    <DisplayChrome
      model={model}
      factory={MyRenderer}
      testid="my-display"
      style={{ width, height }}
    >
      {({ canvasRef }) => <canvas ref={canvasRef} />}
    </DisplayChrome>
  )
  ```
- **Wiggle-style displays** — to reuse the whole LinearWiggleDisplay model, compose
  `linearWiggleDisplayModelFactory` from `@jbrowse/plugin-wiggle` (see
  `plugins/gccontent`). To borrow only the score machinery, compose
  `WiggleScoreConfigMixin` + `makeScoreSubMenu` (see `plugins/gwas` Manhattan).
  Implement `WiggleRenderingBackend` (typed from `@jbrowse/wiggle-core`). A
  zoom-independent display needs no cache override: the strict-`bpPerPx`
  `regionFetchKey` rides on `WiggleCommonMixin`, so composing the score config
  alone inherits no rule about what a fetch returns.
- **Tests** — unit (`MockHal`); browser (Puppeteer,
  `--backend=webgl|webgpu|canvas2d`).
