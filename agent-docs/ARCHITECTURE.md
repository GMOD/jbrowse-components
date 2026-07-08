# Architecture

## Display stacks

Linear-genome-view displays compose from a small set of **foundation mixins**
on `BaseDisplay`. "GPU vs block" is a *render-path* distinction layered on top —
not the primary axis of sharing. Three foundations cover every in-tree display:

| Foundation (composed on `BaseDisplay`) | Brings | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RenderLifecycleMixin` + `FetchMixin` + `RegionTooLargeMixin` + the four fetch autoruns + `rpcProps()`→refetch wiring | `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `LinearManhattanDisplay`, `LinearAlignmentsDisplay`, both multi-sample variant displays (`LinearMultiSampleVariantDisplay` + `…MatrixDisplay`, via `MultiSampleVariantBaseModel`), `LinearReferenceSequenceDisplay`, and — via `LinearCanvasBaseDisplay` — `LinearBasicDisplay`, `LinearVariantDisplay`, `LinearMultiRowFeatureDisplay` |
| `GlobalDataDisplayMixin()` | same slot mixins, **no** fetch autoruns (each display installs its own `afterAttach` autorun) | HiC (`LinearHicDisplay`), LD (`plugins/variants/src/LDDisplay`) |
| `RegionTooLargeMixin()` + custom `renderSvg` (no GPU/fetch mixin) | lightweight React-SVG render — no GPU upload, no block machinery | `LinearArcDisplay`, `LinearPairedArcDisplay` |

`LinearCanvasBaseDisplay` (plugins/canvas) is **not** a peer of these — it is a
canvas-feature *specialization layered on `MultiRegionDisplayMixin`*, and only
`LinearBasicDisplay` + `LinearVariantDisplay` extend it. Wiggle, Manhattan, and
alignments compose `MultiRegionDisplayMixin` directly; they render on the GPU
but share **no** state model with canvas.

**Render path is a separate axis.** GPU-canvas vs Canvas2D is chosen per frame
at the backend factory (see "RenderingBackend interfaces per plugin"), not by
which foundation a display composes.

### Legacy block stack (`BaseLinearDisplay` state model)

`BaseLinearDisplay` (plugins/linear-genome-view) is the one remaining
**server-side RPC render → SVG block** state model — and the pluggable
server-side-renderer extension point. It is **kept indefinitely** because it is
public API composed by external plugins (`jbrowse-plugin-gdc`, `-icgc`, and the
legacy `-mafviewer`, now superseded in-tree by `plugins/maf`) via
`LinearGenomePlugin.exports.BaseLinearDisplay`. In-tree, only `LinearBareDisplay`
still composes it — a rarely-used fallback display for `FeatureTrack`/`BasicTrack`
(the GPU `LinearBasicDisplay` is the default). `LinearBareDisplay` is also the
LGV core test suite's lightweight test vehicle and the sole in-tree exerciser of
the block path, so it stays as long as the path does.

Three differently-scoped artifacts share the `BaseLinearDisplay` name — a
documented hazard, not a bug to "fix" (the name is external public API):

| Artifact | Kind | Scope |
| --- | --- | --- |
| `baseLinearDisplayConfigSchema` | config schema | **shared by every foundation** + external plugins (gwas, quantseq, mafviewer) |
| `BaseLinearDisplay` | state model | **legacy block only** — in-tree `LinearBareDisplay`; external gdc/icgc/mafviewer |
| `BaseLinearDisplayComponent` | React shell | **shared** — branches on `model.DisplayMessageComponent`: set → the display's own content (GPU path); unset → `<LinearBlocks>` (legacy block path). Also used externally (mafviewer, gdc) |

So `LinearBasicDisplay` (GPU) does **not** extend the `BaseLinearDisplay` state
model, even though it uses the shared config schema and React shell.
`BasicTrack` is a back-compat synonym for `FeatureTrack`.

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally for
all genomic features and regions. This matches BED/BAM convention. Adapters
that read 1-based formats (VCF `POS`, GFF `start`) subtract 1 on ingest;
exporters that write 1-based formats add 1 on output.

---

## Data fetching pipeline

`MultiRegionDisplayMixin` (in `plugins/linear-genome-view/src/BaseLinearDisplay/`)
drives RPC fetches for all LGV displays (alignments, canvas, wiggle,
variants) via four autoruns:

| Autorun | Trigger | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` change | `clearAllRpcData()` |
| `FetchVisibleRegions` | viewport / `fetchGeneration` (600ms debounce) | `fetchNeeded(needed)` for uncovered buffered regions; gated by `error`/`regionTooLarge` |
| `SettingsInvalidate` | `rpcProps()` change | `clearAllRpcData()` |
| `ClearBlockingStateOnViewportChange` | viewport change while `regionTooLarge` or `error` is set | `clearAllRpcData()` to unblock retry (no-op for canvas's derived `regionTooLarge`) |

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`,
where `fetchRegions` runs an optional pre-flight byte estimate
(via `getByteEstimateConfig` → `checkByteEstimate` → the
`CoreGetFeatureDensityStats` RPC) before invoking the work callback. Oversize
regions surface a banner: `DisplayChrome` renders `TooLargeMessage` from the
model's `regionTooLargeReason`. `error`/`regionTooLarge`
reads in `ClearBlockingStateOnViewportChange` are `untracked` for correctness —
tracking either would let `set...` re-fire the autorun and wipe the flag
before any viewport change.

**Canvas opts out of the pre-flight** (`getByteEstimateConfig` returns `null`):
a second estimate RPC racing the per-region feature fetch is the kind of
two-call coordination we avoid. Instead canvas folds the byte check into the
feature-fetch RPC itself — `executeRenderFeatureData` calls the adapter's
`getRegionByteSize` (an index-only estimate, no feature download; default
`undefined` on `BaseFeatureDataAdapter`, overridden by tabix adapters) and
short-circuits an over-budget region *before* `getFeaturesArray`, returning
`{ regionTooLarge, bytes }`. This makes the byte gate symmetric with the density
gate (which already short-circuits in-RPC, returning `{ regionTooLarge,
featureCount }`), so a whole-genome fan-out costs one cheap index read per
chromosome instead of downloading every chromosome's features.
`applyFetchResults` sums the per-region `bytes` into `featureDensityStats`,
feeding the same derived `bytesEstimateTooLarge` the pre-flight used to. The
budget itself comes from the display's `byteSizeLimit()`
(`userByteSizeLimit ?? fetchSizeLimit`, only in the force-load zone).

### regionTooLarge: imperative vs. derived

There are two implementations of `regionTooLarge` in the codebase, both
expressed through the `regionTooLarge` getter so consumers
(`regionCannotBeRendered()`, `regionCannotBeRenderedText()`, the
`FetchVisibleRegions` gate) work with either.

- **Imperative** (`RegionTooLargeMixin` default; used by wiggle, alignments,
  LD): `setRegionTooLarge(true)` flips a volatile flag inside `fetchRegions`
  when the byte estimate exceeds the limit. `ClearBlockingStateOnViewportChange`
  clears the flag on viewport change so `FetchVisibleRegions` can retry.
- **Derived** (canvas's `LinearCanvasBaseDisplay`): a pure function of cached
  stats × current `bpPerPx` + visible regions, mirroring `RegionTooLargeMixin`'s
  feature-density stats.
  - `bytesEstimateTooLarge` tests `estimatedVisibleBytes` against
    `resolveByteLimit()` (user override → adapter limit → config; an adapter
    limit of `0` means "no opinion" and is skipped, not a zero budget).
    `applyFetchResults` sets
    `featureDensityStats.bytes` (summed from the per-region fetch results) for
    the span visible *at fetch time*, recorded
    as `byteEstimateVisibleBp`; `estimatedVisibleBytes` rescales it to the
    current span (`bytes × view.visibleBp / byteEstimateVisibleBp`). The
    rescale is what makes the byte gate a pure function of the view (like
    `densityTooLarge` scaling featureCount by `bpPerPx`) so it self-releases on
    zoom-in. Reading raw `bytes` instead deadlocks: the estimate survives
    `clearAllRpcData`, stays above the limit after zooming back into a small
    region, and `FetchVisibleRegions` won't re-estimate while `regionTooLarge`
    holds — the banner sticks forever (the 50kb→5mb→50kb stuck-banner bug).
  - `densityTooLarge` walks `view.visibleRegions`, looks up
    `densityStatsPerRegion[idx]` (populated for both successful fetches and
    worker-side too-large responses), and tests
    `(featureCount/regionWidthBp) × bpPerPx > maxFeatureDensity`. Scoping to
    currently-visible regions means panning past too-large areas naturally
    releases the gate.
  - `regionTooLarge = bytesEstimateTooLarge || densityTooLarge`.
  - `laidOutDataMap` returns empty when `regionTooLarge` is true, so the GPU
    upload pushes nothing — no stale-feature flash through the banner.
  - `FetchVisibleRegions` gates on `regionTooLarge` before calling
    `isCacheValid`, so density-blocked regions are held back by the gate
    rather than inside `isCacheValid`. When density drops (zoom in or force
    load), `regionTooLarge` flips false, the gate opens, and `isCacheValid`
    returns `false` (no rpcData) → refetch fires and the banner clears.
  - A canvas-level autorun on `view.displayedRegions` clears
    `densityStatsPerRegion`/`featureDensityStats` on chromosome navigation
    (`displayedRegionIndex` gets reused, so stale entries would otherwise gate
    against the wrong region's stats and could permanently block refetch).

The derived approach removes the imperative clear-and-reset cycle that caused
the banner to flicker off and back on during small zoom or pan moves that
didn't actually cross the threshold. Both `featureDensityStats` and
`densityStatsPerRegion` survive `clearAllRpcData()` (they aren't in
`clearDisplaySpecificData`'s clearing path), so
`ClearBlockingStateOnViewportChange` is a no-op for the derived banner —
state recomputes the same value before and after.

`regionCannotBeRendered()` and `regionCannotBeRenderedText()` in
`RegionTooLargeMixin` read through `self.regionTooLarge` (the getter) rather
than `self.regionTooLargeState` (the volatile) so subclass overrides flow
into the banner UI and SVG export text.

**Shared decision primitives.** The imperative, derived, and arc/React-SVG
(`RegionTooLargeMixin`, via `fetchArcFeatures`) paths diverge only in *how* they
measure bytes/density;
the verdict, threshold, and banner text are unified in
`shared/featureDensityUtils.ts` so they can't drift:

- `resolveByteLimit({ userByteSizeLimit, adapterFetchSizeLimit, configFetchSizeLimit })`
  — the one byte-budget resolution (with the `0 = no opinion` guard).
- `bytesTooLargeReason(bytes)` / `TOO_MANY_FEATURES_REASON` — the one source
  for the two banner strings.
- `evaluateRegionTooLarge({ visibleBp, bytes, byteLimit, densityTooLarge })` —
  the canonical verdict+reason: below `AUTO_FORCE_LOAD_BP` nothing gates, else
  bytes-over-limit takes precedence over density. `densityTooLarge` is
  **opt-in**, so byte-only displays (alignments) pass only bytes and never gate
  on density. Used by the arc path (`RegionTooLargeMixin` via `fetchArcFeatures`);
  the derived canvas path composes the same pieces around its scaled
  `estimatedVisibleBytes`.

Variants are monolithic: `MultiSampleVariantGetCellData` returns one batched
payload covering all visible regions, so variants' `fetchNeeded` expands
`needed` to all `bufferedVisibleRegions` and marks them all loaded together
when the work callback returns.

### Terminal states early-return their own root — they don't nest under the canvas

`DisplayChrome` branches on `model.displayPhase` and renders the `renderError` /
`tooLarge` banners by **early-`return`ing** the banner as its *entire* output,
replacing the display subtree — *not* by keeping its container `<div>` mounted
and rendering the banner as a swapped-in child beside the canvas/overlays. This
looks like a leak (the caller's `className` / `ref` / mouse handlers are absent
in those two states) but the leak is benign — a too-large region has no canvas
to interact with, and the ref re-attaches on force-load — and the structure is
**load-bearing**: one subtle React-commit reason (1, with two sharp sub-rules
1a/1b) and one GPU-lifecycle reason (2).

**1. React won't render a nested swapped-in terminal child.** If the banner is
nested — `{regionTooLarge ? <TooLargeMessage/> : children}` inside the
persistent container, next to the `DisplayErrorBar` / `DisplayLoadingOverlay`
siblings — the banner never reaches the DOM and `StatsEstimation.test` times
out. Instrumenting every site shows why: `DisplayChrome` re-renders with
`tooLarge`, the sibling overlays render normally, but **React never descends
into the `<TooLargeMessage>` element** — its component body never runs (verified
with a `console` probe inside `TooLargeMessage`: 0 calls when nested, 2 when
returned as a root). Returning the banner as a fresh top-level root mounts it
reliably. The exact React-internal reason a memo/observer child in this position
is skipped is unconfirmed, and the repro is jsdom + React 19 + `act()`; the
**rule** — terminal UI is its own `return`, never a nested child — is what's
load-bearing.

**1a. A literal `return`, not a ternary branch.** Surprisingly, even returning
the banner from a *single-`return` ternary*
(`return phase === 'tooLarge' ? <TooLargeMessage/> : <div>…</div>`) reproduces
the same 0-commit failure, despite producing an element tree identical to the
early-`return` form. Only literal `if (phase === 'tooLarge') return …` statements
commit reliably. This was confirmed the same way (probe inside `TooLargeMessage`:
0 vs 2 calls). So the rule is specifically *early-`return` statements*, and it
overrides the repo's usual "prefer ternaries over early return" style here.

**1b. `displayPhase`'s loading term must be lazy.** `computeDisplayPhase(self,
loading)` takes `loading` as a **thunk** and only calls it after ruling out the
three terminal flags. The loading condition reads the containing view
(`visibleRegions` / `loadedRegions`); evaluating it eagerly makes the chrome's
observer track that churning set even while a banner is up, which re-fires the
observer during the terminal state and reproduces the same commit failure (1) —
*even with* the early-`return`. Lazy evaluation keeps the tracked set to just the
terminal flags when one is active, identical to the old direct `model.regionTooLarge`
reads that always committed. (This is why the older writeup couldn't pin the
React cause: the visible symptom is reconciliation, but the trigger is the
observer's tracked-dependency set.)

There is **no** `regionTooLarge` oscillation here, despite what earlier writeups
of this section (and commit `614465dd51`) claimed. Instrumentation shows
`setRegionTooLarge` reaches `true` **once and holds**; `clearAllRpcData`
(~line 158) and `fetchRegions` (~line 240) do **not** ping-pong, and the fetch
state machine settles. The prior "flag thrash / invalidate→refetch loop" story
was wrong: the failure is React reconciliation, not the fetch machinery. (The
`FetchVisibleRegions` gate and `ClearBlockingStateOnViewportChange` clear,
described in the table above, are real and correct — they just don't loop during
a steady too-large state.)

**2. Clean GPU dispose/re-init (ADR-025).** Early-returning unmounts the body,
firing `canvasRef(null)` → effect cleanup → `backend.dispose()` +
`stopRenderingBackend()`; force-load remounts and re-inits via the callback ref.
The detached-context bug only occurs when the canvas is unmounted **without**
disposing — which the early-return never does.

The `DisplayChrome.tsx` comment block restates the rule so a future pass doesn't
"fix" the apparent leak. The **derived** canvas `regionTooLarge` (above) is a
pure function of cached stats, so its *value* never flickers regardless — but
that's orthogonal to the DOM-commit rule here, which is shared by **every**
display because it lives in `DisplayChrome`'s JSX shape, not in how
`regionTooLarge` is computed.

### `rpcProps()` loop trap and how to break it

Including any fetch-result derivative in `rpcProps()` creates an infinite loop:

```
setCellData → <derived value> changes → rpcProps() changes
  → SettingsInvalidate → clearAllRpcData → cellData cleared
  → <derived value> changes → rpcProps() changes → …
```

The fix is to split the computation: `rpcProps()` gets a cache-key version
computed from user-controlled inputs only; any part that needs fetch-result
data is kept in a separate view used only for rendering or passed directly
to the server.

In the variant case, `rpcProps().sources` calls `getSources` with
`renderingMode: 'alleleCount'` internally so haplotype expansion (which
needs `sampleInfo`) is never triggered. The client's `sources` view still
reads `sampleInfo` for rendering — safe because it is not in `rpcProps()`.
The server receives the unexpanded sources and expands them after computing
`sampleInfo` from features; sources from clustering already carry `HP` and
pass through unchanged.

**Rule**: `rpcProps()` must contain only user-controlled settings. Never
include `cellData`, `sampleInfo`, or any getter that reads them.

See `plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` for the
overridable hook list and test-file mapping.

### Sequence-adapter injection is instance-primed and order-dependent

BAM/CRAM decode against the reference (CRAM to reconstruct bases, BAM to compute
mismatches without an MD tag), but a track's adapter config doesn't carry the
reference — it belongs to the assembly. So the assembly's sequence adapter
config rides **alongside** `adapterConfig` as a sibling RPC arg (never spliced
into it) and is stashed on the resolved adapter instance via
`setSequenceAdapterConfig`; the adapter lazily builds it through `getSubAdapter`
on first `getSequenceAdapter()`. Client side, `getSequenceAdapterConfig(assembly)`
(in `assemblyManager/assembly.ts`) produces the snapshot; worker side,
`getFeatureAdapter()` (in `data_adapters/getFeatureAdapter.ts`) is the shared
prologue that resolves the feature adapter and primes it in one step.

The subtlety: **the adapter cache (`dataAdapterCache`) keys on `adapterConfig`
alone, not on the sequence adapter.** So the *first* RPC to resolve a given
adapter primes its sequence config for the lifetime of that cached instance
(`setSequenceAdapterConfig` is set-once). This is why `CoreGetRefNames` — usually
the first call for a track — passes it, and why every reference-needing fetch
(render, feature details) also passes it rather than relying on ordering. A fetch
that legitimately doesn't need the reference (e.g. `PileupGetGlobalValueForTag`,
which reads BAM tags directly) omits it. **Invariant: any feature RPC that
decodes against the reference must pass `sequenceAdapter`** — don't assume a
prior call primed the instance, and note that `setSequenceAdapterConfig` does
**not** propagate through wrapper adapters (there is no wrapper-over-BAM/CRAM
today; if one is reintroduced, plumb inheritance through `getSubAdapter`).

## Status / progress reporting

One out-of-band channel carries loading status from workers to the loading UI:
`statusCallback: (status: RpcStatus) => void`, where
`RpcStatus = string | { message; current; total }` (`packages/core/src/util/progress.ts`).
A plain string is an indeterminate phase label; the object adds a determinate
`current/total` fraction (unit-agnostic — bytes/blocks/records). The UI decides
presentation, so percentages are never baked into the message string.

Flow: worker adapter → `opts.statusCallback(status)` → RPC drivers special-case
`statusCallback` as out-of-band (message type `unknown`, so objects cross) →
`FetchMixin.setStatusMessage` splits it into `statusMessage` + `statusProgress`
→ `DisplayLoadingOverlay` draws a determinate bar + cancel, else a spinner.
There is no second `onProgress` channel — emit through `statusCallback` only.

Helpers in `progress.ts`: `downloadStatus(label, cb, fn(onProgress))` wraps
every download adapter (label + clear + a byte-reporter adapting
generic-filehandle2 / tabix / bam / cram; `total` optional when Content-Length
is unknown → indeterminate); `createProgressReporter`/`withProgress` for
determinate worker CPU loops (`report()` auto-increments; cancel-check and emit
are counter-gated so calling every iteration is cheap); `updateStatus` for
indeterminate phases; `statusMessageText`/`statusFraction`/`statusProgressLabel`
extract; `aggregateStatus` merges concurrent statuses into one `Σcurrent/Σtotal`.
`parseLineByLine` (flat-file adapters) and `fetchAndMaybeUnzip`
(bigwig/bigbed/hic/sequence) forward determinate progress through these.

**Concurrent fetches share one status field — aggregate, don't clobber.** A
fetch generation can fan out into N parallel per-region RPCs writing the same
volatiles. Route each through `FetchMixin.setRegionStatus(key, status)` (keyed
by `displayedRegionIndex`), which re-derives the shared fields via
`aggregateStatus` — N downloads read as one honest bar instead of last-writer
thrash. `runFetch`/`cancelFetch` clear the map.

**Cancel is durable + retryable.** Two cancels on `FetchMixin`:
`cancelFetch()` is an internal reset (bumps `fetchGeneration` to retrigger,
clears `fetchCanceled`); `cancelFetchByUser()` (the overlay button) sets the
durable `fetchCanceled` volatile and does **not** bump generation, so nothing
restarts. `fetchCanceled` is a blocking state like `error`/`regionTooLarge`:
`FetchVisibleRegions` early-returns on it, `ClearBlockingStateOnViewportChange`
clears it on pan/zoom, and `runFetch` start is the single un-cancel point.
`reload()` is the retry path.

Not wired (deferred, low priority): text-indexing reports byte strings to the
admin CLI, and worker sort/layout loops emit no per-iteration progress — both
could go determinate via `createProgressReporter` if a context surfaces them.

---

## GPU Rendering Architecture

Canonical reference for the GPU rendering lifecycle across all display types.

### Package layout

The rendering primitives live in **`@jbrowse/render-core`**
(`packages/render-core`) — the HAL, `RenderLifecycleMixin`, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. It is a
leaf package (deps: `mobx` + `@jbrowse/mobx-state-tree` + `react` peer; **no**
`@jbrowse/core`), so a third-party display can depend on it directly. Import
rendering primitives from `@jbrowse/render-core`; the former
`@jbrowse/core/gpu/*` re-export shims were removed once every in-tree import
migrated (ADR-030 follow-up). The shader codegen
(`packages/shader-tools/src/build-shaders.ts`, which scans
`packages/render-core/src/shaders` for cross-plugin `.slang` modules, plus
`slangPass` in render-core) and the display-integration layer
(`MultiRegionDisplayMixin` / `GlobalDataDisplayMixin` / `DisplayChrome`, all in
the LGV plugin) stay where they are; per-display shaders/passes live per-plugin
under `plugins/<plugin>/src/<display>/{shaders,passes}`. The GPU API is
**static-import-only** — never exposed via the runtime `ReExports` registry. See
ADR-030.

### Glossary

- HAL — hardware abstraction layer; abstracts WebGL2 and WebGPU calls.

Full vocabulary + Canvas2D→GPU primer (for papers/talks): `GPU_GLOSSARY.md`.

---

### One-liner

Each GPU display is an MST model that composes `RenderLifecycleMixin`
and calls `self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied
to the model's lifetime — one that runs `upload(backend)`, one that runs
`render(backend)`. MobX auto-tracks every observable read inside each callback,
so changes re-fire the right autorun with no manual dependency declarations.
React components are thin bridges: create a canvas, hand the backend to the
model via `useRenderingBackend`, render JSX.

---

### The API

```ts
interface RenderingBackend {
  // plugin-defined upload/render methods
  dispose(): void
}

// In the plugin's MST model:
startRenderingBackend(backend: RenderingBackend) {
  self.attachRenderingBackend<RenderingBackend>(backend, {
    upload: b => {
      // Read plugin observables, push bytes to the GPU.
      // Re-fires on any observable change.
    },
    render: b => {
      const state = self.renderState
      if (!state) return false              // renderState not ready
      return b.renderBlocks(self.renderBlocks, state)
      // return true only when real content was drawn;
      // mixin calls markCanvasDrawn() → canvasDrawn flips true →
      // MultiRegionDisplayMixin.isReady becomes true once isLoading also clears
    },
  })
}
```

---

### What the mixin owns

```
RenderLifecycleMixin
  .volatile
    canvasDrawn: boolean          set true only after render() returns true with real data
    currentRenderingBackend: unknown    stored backend; autoruns read it each tick
    renderTick: number            bumped by renderNow() and after every upload
    autorunsInstalled: boolean guards attachRenderingBackend (idempotent)
    renderError: unknown          render-backend init / context-loss error; single source for the 'renderError' terminal phase
  .actions
    markCanvasDrawn()             idempotent flip to true
    resetCanvasDrawn()            flip to false (called by clearAllRpcData)
    stopRenderingBackend()                 clears currentRenderingBackend + resets canvasDrawn → autoruns idle
    renderNow()                   bumps renderTick → render autorun re-fires
    setRenderError(error)         set/clear renderError (written by useRenderingBackend on init failure / success / retry)
    attachRenderingBackend(b, cbs)         spawns upload + render autoruns (once)

MultiRegionDisplayMixin  (composes RenderLifecycleMixin)
  .views
    isReady: boolean              canvasDrawn && !isLoading
    viewportWithinLoadedData: boolean   every visible block ⊆ a loaded region
    displayPhase: 'renderError' | 'tooLarge' | 'error' | 'loading' | 'ready'
                                  computeDisplayPhase(self, () => !isReady || !viewportWithinLoadedData)
    loadingOverlayVisible: boolean      displayPhase === 'loading'
```

Every display renders its canvas through the shared `DisplayChrome`, which calls
`useRenderingBackend(factory, model)` internally — the backend hook lives in
exactly one place, so a display can't bury it where the chrome can't see it. It
owns every terminal state, all collapsed into one model getter — `displayPhase`
('renderError' | 'tooLarge' | 'error' | 'loading' | 'ready'), whose precedence is
single-sourced in `computeDisplayPhase` (`@jbrowse/render-core/displayPhase`). The
chrome branches on it: `renderError` and `tooLarge` early-`return` their own
component (`DisplayRenderErrorOverlay` / `TooLargeMessage`); `error` + `loading`
are overlays (`DisplayErrorBar` / `DisplayLoadingOverlay`) drawn over the
still-mounted canvas. `loadingOverlayVisible` is just `displayPhase === 'loading'`
— so the loading-vs-terminal precedence is no longer re-encoded by subtraction in
each model (it was triplicated across MultiRegion / Global / sequence). It takes a
render-prop child `({ canvasRef, canvas }) => ReactNode`, so it's agnostic to how
many canvases a display draws and where they mount; pass a `testid` base and the
chrome appends `-done` once `canvasDrawn` flips.
`DisplayLoadingOverlay` reads `loadingOverlayVisible`: `isReady`
covers track-open through the fetch cycle (hiding once the first frame paints);
`viewportWithinLoadedData` re-shows the overlay when the viewport extends past
loaded data — e.g. the pre-refetch debounce after a zoom-out, where `isReady` is
already true but stale data is still on screen (separate getter for tracking
reasons — see BaseLinearDisplay/CLAUDE.md). `stopRenderingBackend` resets
`canvasDrawn` so the overlay recovers after WebGL context loss.

All backend-specific plumbing lives in the plugin. All reactivity plumbing
lives in the mixin.

---

### Life of a frame

1. React hook (`useRenderingBackend`) mounts, creates the HAL, resolves a
   backend, calls `model.startRenderingBackend(backend)`.
2. Mixin sets `currentRenderingBackend = backend`, spawns two autoruns via
   `addDisposer(self, autorun(...))`.
3. Upload autorun fires: reads `currentRenderingBackend`, calls `cbs.upload(b)`,
   bumps `renderTick` so render re-fires after any upload.
4. Render autorun fires: reads `currentRenderingBackend` + `renderTick`, calls
   `cbs.render(b)`. If it returns `true`, flips `canvasDrawn` to `true`.
   `clearAllRpcData` resets `canvasDrawn = false` so the flag is only set
   after the canvas has real content.
5. Any observable touched by `upload` or `render` becomes a dep — when it
   changes, MobX re-fires that autorun. No manual invalidation.

#### Context-loss recovery

GPU contexts can be lost. `useRenderingBackend` listens for
`webglcontextlost`/`restored` and `device.lost`, rebuilds the backend, and
calls `model.startRenderingBackend(newRenderingBackend)`. The mixin sees
`autorunsInstalled === true`, skips re-installation, just reassigns
`currentRenderingBackend`. Both autoruns re-fire against the new backend. No special
code path.

#### Tab visibility

`useTabVisibilityRerender` calls `model.renderNow()` on `visibilitychange`,
bumping `renderTick`. WebGPU swap-chain textures are reissued by the `render`
callback.

---

### RenderingBackend interfaces per plugin

Each plugin defines its own `RenderingBackend` type and a factory that produces either
a GPU or Canvas 2D implementation:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<XxxRenderingBackend>(
    canvas,
    XXX_PASSES,
    XXX_UNIFORM_BYTE_SIZE,
    hal => new GpuXxxRenderer(hal),
    c => new Canvas2DXxxRenderer(c),
  )
}
```

`createRenderingBackend` calls `createGpuHal`; if a HAL is returned, the GPU backend
is constructed, otherwise Canvas 2D.

#### Canvas2D is the floor; GPU is the optional accelerator

Every display **must** ship a Canvas2D draw function regardless — SVG export
goes through it (see "SVG export pipeline"). The GPU shader path is an *optional
accelerator* layered on top for displays whose feature counts demand it
(≳100K features/frame — RFC-001 §3a). So a display whose data is always
gene-scale / low-density / text can be **Canvas2D-only**: it writes no `.slang`,
no `GpuXxxRenderer`, and no pass list. Its factory skips the HAL ladder and
returns the Canvas2D backend directly via `createCanvas2DBackend`:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DXxxRenderer(c))
}
```

The backend plugs into the same `RenderLifecycleMixin` / `DisplayChrome`
machinery as a GPU display — the lifecycle is backend-agnostic, so nothing
downstream knows there's no HAL. Reference: `plugins/sequence`'s
`SequenceRenderer`. Start here for any new display; promote to the dual-path
`createRenderingBackend` only when a profile shows Canvas2D can't hold 60fps at
the display's real feature counts.

#### Keeping the two backends in parity

A dual-path display renders the same pixels two ways (`.slang` shader vs a
Canvas2D draw fn), and SVG export runs the Canvas2D path — so a shader-only tweak
silently diverges the export. Parity is kept by construction, not vigilance. When
touching either path, preserve whichever of these the display uses:

- **Constants live in the shader, TS re-exports them.** `//! export-consts:` in a
  `.slang` emits the value into its `*.generated.ts`; the Canvas2D side imports it
  (e.g. `sharedRendererConstants.ts` pulls `MIN_RECT_WIDTH_PX`, `CHEVRON_*`,
  `MIN_DENSITY_ALPHA` from the passes). Never retype a shader constant as a TS
  literal — import it so the two can't drift.
- **One draw helper, both consumers.** Marker/glyph geometry and color math that
  both paths (or the on-screen overlay + SVG export) need lives in one function:
  `drawMafInsertionMarker`, `appendPointMarker` (wiggle scatter + Manhattan),
  `mapHicCount`, synteny's `syntenyPickEngine` geometry. Change the shared fn, not
  one caller.
- **One registry, exhaustively keyed.** Multi-layer displays list layers/z-order/
  gating once and map each id to a per-backend mechanism through a
  `Record<LayerId, …>` in *both* renderers (alignments' `PILEUP_LAYERS` →
  `GPU_PILEUP_PASS` and a Canvas2D draw-fn map). The exhaustive Record makes a
  half-added layer a compile error; `coverageParity.test.ts` cross-checks output.
- **`SYNC:` comments anchor formulas.** Where a value must match across files
  (synteny's `WIDTH_FADE_FLOOR`, the 0.7-darken / ×5-cap-0.35 hover shade), a
  `SYNC:`/`mirrors` comment names the counterpart. Grep the tag before editing
  either side.

**Intentional divergences — do NOT "fix" these into parity.** The two backends
legitimately differ where GPU rasterization is watertight but Canvas2D
antialiases each primitive independently. Canvas2D adds a sub-pixel *overdraw* to
close seams the GPU never produces (`WIGGLE_FUDGE_FACTOR` 0.8px, the
variant-matrix `f2`), and swaps a thin fill for a 1px centerline stroke
(synteny sub-pixel ribbons); the shader instead scales coverage alpha
(variant-matrix `colWidthPx`, synteny `fillCoverage` `widthFade`). These are
per-backend AA compensation, not drift — a shader has no equivalent to a
Canvas2D fudge factor, and porting one in over-widens GPU glyphs. Min-width
floors, by contrast, *are* mirrored (both clamp to the same px) — those keep
sub-pixel features visible and must stay in step.

#### Shared per-region streamed contract

Per-region streamed plugins (canvas, manhattan, MAF, multi-variant, wiggle)
specialize one generic type and inherit from one of two abstract base
classes in `@jbrowse/render-core/perRegionRenderingBackend`:

```ts
// Plugin specializes the interface (used in model + React code):
export type XxxRenderingBackend = PerRegionRenderingBackend<XxxUploadData, XxxRenderState>

// Plugin's GPU renderer extends GpuPerRegionRenderingBackend, implements uploadRegion + renderBlocks:
export class GpuXxxRenderer extends GpuPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  constructor(hal: GpuHal) { super(hal, XXX_UNIFORM_BYTE_SIZE) }
  uploadRegion(idx, data) { … }
  renderBlocks(blocks, regions, state) { … }
}

// Plugin's Canvas2D renderer extends Canvas2DPerRegionRenderingBackend, implements renderBlocks only:
export class Canvas2DXxxRenderer extends Canvas2DPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  renderBlocks(blocks, regions, state) { … }
}
```

The bases own everything that's truly shared:

- `Canvas2DPerRegionRenderingBackend` — owns `canvas` + `ctx` (constructor throws
  if 2D context unavailable), stubs `uploadRegion` / `pruneRegions` /
  `dispose` as no-ops since the source of truth is the `regions` map.
- `GpuPerRegionRenderingBackend` — owns the `hal` reference and a pre-allocated
  uniform scratch `ArrayBuffer`. Default `pruneRegions(active)` delegates
  to `hal.pruneRegions(active)`; default `dispose()` calls `hal.dispose()`.

Two invariants make the renderer implementations small and uniform:

- `renderBlocks` receives the model's data map as its second argument — the
  renderer holds no `Map<number, ...>` field of its own. GPU buffer lifecycle
  delegates to `hal.pruneRegions(active)`; Canvas2D backends inherit no-op
  upload/prune and read everything from `regions` at render time.
- `hal.drawPass` short-circuits when the region has no buffer for that pass,
  so GPU renderers issue draws unconditionally — no per-region flag cache.

For MAF, `UploadData` and `RenderData` diverge. The upload payload
(`MafUploadPayload`) carries **only** the pre-encoded GPU buffer
(`{ instanceBuffer, instanceCount }`); the render side reads the raw
`MafRegionData` directly from the model's `rpcDataMap` (so Canvas2D can draw it
and the GPU path can check presence). `PerRegionRenderingBackend`'s optional
fourth type param `RenderData` (defaults to `UploadData`) expresses this split —
shared with `LinearMultiRowFeatureDisplay`, which uses the same
pre-encoded-payload / raw-render shape; most per-region plugins keep the default.

Whole-map synced (alignments, multi-LGV-synteny) and monolithic (HiC, LD,
multi-variant-matrix, dotplot) plugins still define their own backend
interfaces because their upload shapes differ — see "Three upload patterns".

#### Wiggle-family contract

Wiggle-style per-position GPU displays (wiggle, multi-wiggle, Manhattan)
share types and scale utilities. Two packages split the surface:

`@jbrowse/wiggle-core` — the cross-plugin contract. Import types and pure
utilities from here so new plugins don't drag in the wiggle plugin's MST
factories or RPC methods:

- `renderingBackendTypes.ts` — `WiggleRenderingBackend`, `WiggleGPURenderState`, `SourceRenderData`
- `dataTypes.ts` — `WiggleDataResult`, `WiggleSourceData`, `WiggleFeatureArrays`
- `normalize.ts` — `SCALE_TYPE_LOG`/`LINEAR`, `scaleTypeFromString`, `makeScoreNormalizer`
- `displayModel.ts` — `WiggleGpuDisplayModel<TRenderingBackend>`: model↔component contract
- `scale.ts` / `autoscale.ts` — `getNiceDomain`, `getScale`, autoscale helpers
- `scoreMenuItems.ts` — `makeScoreSubMenu(self, opts)` + `ScoreScaleModel`: the shared
  Score submenu composed by every wiggle-family display (wiggle, multi-wiggle, Manhattan)

`@jbrowse/plugin-wiggle` — composable model pieces. These live in the plugin
because they depend on `BaseDisplay` / `MultiRegionDisplayMixin` and wire up
RPC methods:

- `linearWiggleDisplayConfigSchema` / `linearWiggleDisplayModelFactory` — the
  full LinearWiggleDisplay config + model. Composed **wholesale** by GC-content's
  `LinearGCContentDisplay` (`plugins/gccontent`). The config schema is reused
  more widely (Manhattan extends it); the model factory is not.
- `WiggleScoreConfigMixin([...slots])` / `WiggleCommonMixin` — score/color config
  pieces composed à la carte by displays that build their own model.

GWAS's Manhattan does **not** compose `linearWiggleDisplayModelFactory`. It
builds its own model — `BaseDisplay` + `TrackHeightMixin()` +
`MultiRegionDisplayMixin()` + `WiggleScoreConfigMixin()` (no args — `colorBy` is
Manhattan's own config slot, `minimalTicks` is read via `getConf`) — pulls the
score domain/scale utilities and `makeScoreSubMenu` from `@jbrowse/wiggle-core`,
and extends `linearWiggleDisplayConfigSchema` as its `baseConfiguration`.
It ships its own `GetManhattanData` RPC (per-feature points, not pre-binned
density), implements its own `ManhattanRenderingBackend`
(`PerRegionRenderingBackend<ManhattanRpcResult, ManhattanRenderState>`) with its
own pass, and is zoom-independent by **never setting `loadedBpPerPx`** — the
inherited `isCacheValid` short-circuits to `true` whenever `loadedBpPerPx` is
`undefined` — rather than by overriding `isCacheValid`.

#### Three upload patterns

Per-LGV displays use one of three upload shapes; pick the one that matches
the data shape, not the one your neighbour copied:

| Pattern | Upload methods | Render | Use when | Examples |
|---|---|---|---|---|
| **Per-region streamed** | `uploadRegion(idx, data)` + `pruneRegions(active)` | `renderBlocks(blocks, state)` | each region's data is independent across regions, reactive per-region updates | canvas, wiggle, multi-wiggle, **MAF**, manhattan, multi-variant |
| **Whole-map synced** | `sync(sources)` | `renderBlocks(blocks, state)` | per-region streams must rebuild coherently (e.g. main-thread cross-region Y layout), or encoder settings drive packing | alignments, multi-LGV synteny |
| **Monolithic** (base class `GlobalRenderingBackend` / `GpuGlobalRenderingBackend`) | `uploadX(data)` | `render(state)` (no blocks) | display has no region partitioning (heatmaps spanning the whole view) | HiC, LD (both `GlobalDataDisplayMixin`); multi-variant matrix (monolithic backend but `MultiRegionDisplayMixin` fetch); dotplot (view-level `RenderLifecycleMixin`) |

MAF is **per-region streamed** (like canvas/wiggle), not whole-map synced like
alignments. MAF blocks are independent — no main-thread Y-layout couples
adjacent regions — so each region's upload re-encodes in isolation via
`installPerRegionLifecycle`. Alignments' whole-map sync exists *only*
because pileup Y-rows must be assigned consistently across multiple
`displayedRegions` (a read spanning a region boundary needs the same Y row in
both regions), forcing the upload to rebuild the whole map whenever any
region's input changes. If a future MAF feature added cross-region coupling
(e.g. main-thread re-clustering of rows based on combined data), it would
move to whole-map synced — until then, per-region streamed is the right
shape.

All three patterns expose the same lifecycle (`attachRenderingBackend({ upload,
render })`); the difference is how the upload callback shovels bytes.

##### Per-region streamed: per-key autoruns (`installPerRegionLifecycle`)

**Plain English:** The naive implementation re-uploads every chromosome to the
GPU each time any chromosome finishes loading — 300 uploads instead of 24 for
a whole-genome wiggle track. The fix gives each chromosome its own tiny MobX
watcher. When chromosome 5 arrives, only chromosome 5's watcher fires and
uploads. When the user changes a color setting, all 24 watchers fire and all
24 re-upload — which is the right behavior.

Naive per-region upload iterates the full `rpcDataMap` inside the upload
callback. Because `for (const [k, v] of rpcDataMap)` makes MobX track the
entire map, every `rpcDataMap.set(key, data)` call re-fires the autorun and
re-uploads all N regions — O(N²) total GPU uploads when N regions arrive
sequentially.

**The fix lives in `@jbrowse/render-core/installPerRegionLifecycle`** and is
used by wiggle, multi-wiggle, manhattan, MAF, sequence, and canvas's
`LinearMultiRowFeatureDisplay`. (The multi-variant displays are per-region
streamed too but hand-roll their `attachRenderingBackend` upload loop rather
than use this helper.) Each plugin's `startRenderingBackend` action collapses to
a single call:

```ts
startRenderingBackend(backend: XxxRenderingBackend) {
  installPerRegionLifecycle(
    self,
    self.rpcDataMap,
    backend,
    data => encode(data, self.gpuProps()),       // optional encode step
    (b, encoded) => {                            // render callback
      const state = self.xxxRenderState
      if (!state) return false
      b.renderBlocks(self.renderBlocks, /* rpcDataMap or `encoded` */, state)
      return true
    },
  )
}
```

The helper spawns one autorun per `rpcDataMap` key. When a new key arrives
only its autorun fires (O(1) upload). When an encoder-tracked observable
changes (theme, color, scale), all per-key autoruns fire (O(N) re-encode) —
which is the right behavior.

Key MobX fact: `ObservableMap.get(existingKey)` tracks `hasMap_.get(key)`
(per-key existence atom), not `keysAtom_`. Adding a new key fires
`keysAtom_` (waking the key-manager only) and that new key's `hasMap_`
entry. Existing per-key autoruns are **not** re-fired.

The helper also caches successful encode outputs in a `Map<number, Encoded>`
and passes it to the render callback — wiggle's renderer reads from this
map because its renderer is stateless; other callers ignore the arg and
read `rpcDataMap` directly. Cleanup is automatic via `addDisposer(self, …)`.

**Plain English on why the helper doesn't apply to canvas / alignments:**
Wiggle uploads each chromosome independently — chromosome 5's data has
nothing to do with chromosome 1's. Canvas and alignments lay out features
into Y-rows across all loaded regions together (so a gene spanning two
adjacent regions ends up on the same row in both). That means any new
arrival could in principle change the layout of everything already loaded,
so the code recomputes and re-uploads everything. Cross-region coupling is
load-bearing in practice — collapsed-intron views split a single chromosome
into many small displayed regions, and a long gene spanning those chunks
must hold the same Y-row in each one. The same view pattern is also why
the layout step runs on the main thread instead of inside the worker: row
assignment needs the union of all visible regions' features, which only
the main thread sees.

**Canvas and alignments both route through a whole-map MobX computed**
(`laidOutDataMap` / `laidOutPileupMap`) that invalidates whenever any
`rpcDataMap` entry changes, causing the upload autorun to re-fire and iterate
all N entries. Per-key autoruns cannot help here: reading
`laidOutDataMap.get(key)` or `laidOutPileupMap.get(key)` in a per-key autorun
still tracks the whole-map computed as a dependency, so all per-key autoruns
re-fire on every new arrival.

- **Canvas** is commonly shown as a whole-genome gene track with N=24
  chromosomes (or many more in collapsed-intron views), so the naive form is
  O(N²). This is fixed: `createIncrementalLayout` (in
  `plugins/canvas/src/LinearBasicDisplay/layout.ts`) memoizes the pure
  `computeLaidOutData` **per ref-group** (`assembly:refName`). Layout is
  independent across chromosomes, so when one chromosome's data arrives only
  its group relays out; unchanged groups return their previous output objects
  *by reference*. The upload autorun then compares each region's reference
  against a per-region `uploaded` map and re-uploads only the ones that
  changed (still pruning against the full active set, and resetting on backend
  swap so context-loss recovery re-uploads everything). Net: O(N) layout +
  GPU uploads as N chromosomes stream in. The memo is a per-instance volatile;
  mutating its internal cache is invisible to MobX, so reading it inside the
  `laidOutDataMap` computed stays pure. Stability unit is the ref-group, not
  the region, because collapsed-intron views split one chromosome into many
  displayed regions and a spanning feature must hold the same Y row in each —
  so adding a region to an existing group relays out that whole group. (This
  covers `LinearBasicDisplay`; canvas's other display,
  `LinearMultiRowFeatureDisplay`, has no cross-region row coupling and so uses
  `installPerRegionLifecycle` like wiggle.)
- **Alignments/synteny** keep the whole-map form. They are never shown at
  whole-genome scale (data density forces gene-level zoom, or synteny is
  pairwise), so N is typically 4–8 buffered regions (more in collapsed-intron).
  The same per-group memo would apply if the perceived cost grew; the extra
  wrinkle there is `laidOutPileupMap`'s cross-region chain-mode coupling
  (connecting lines / Flatbush), which would need to participate in the
  group-signature.

---

### SVG export pipeline (single source of truth)

SVG export and on-screen rendering share the same pure draw function(s) per
plugin. Two shapes, picked by **whether there's a non-trivial builder step
between fetched data and paint**:

- **Direct** — `drawXxxBlocks(ctx, regions, blocks, state)` is the only entry
  point; `regions` IS the fetched data (or a 1:1 derived map like
  `laidOutDataMap`). Both the on-screen `Canvas2DXxxRenderer.renderBlocks`
  and `renderSvg.tsx` call it directly.
  Plugins: canvas, MAF, HiC, LD, multi-variant-matrix, sequence, manhattan,
  dotplot.
- **With builder wrapper** — fetched data needs transformation
  (encode/filter/merge) before painting:
  - `drawXxxBlocks(ctx, regions, blocks, state)` — paints a pre-built map
    (the on-screen renderer accumulates regions and calls this).
  - `drawXxxToCtx(ctx, sources, blocks, state)` — one-shot wrapper used by
    `renderSvg.tsx`: builds the regions map from observable sources, then
    calls `drawXxxBlocks`. The wrapper is what the on-screen
    `uploadRegion` (per-region) accumulates over time.
  Plugins: alignments (merge pileup + arcs), wiggle / multi-wiggle (per-region
  encode), multi-variant (Record→Map + filter), multi-LGV-synteny (merge into
  layout map). Alignments goes one step further and exports a named
  `buildAlignmentsRegionMap` because the on-screen `sync(sources)` reuses it.

All entry points take any 2D-context-shaped surface: real
`CanvasRenderingContext2D` for on-screen, `SvgCanvas` for vector export.
`Canvas2DXxxRenderer` is bound (canvas required at construction) — SVG
export does *not* instantiate the renderer. It calls the pure functions
directly.

**Per-block vs monolithic is an upload/data-shape question, not a draw-API
question.** Canvas, wiggle, MAF, manhattan, multi-variant are per-region
streamed (uploadRegion + renderBlocks); alignments + multi-LGV-synteny are
whole-map synced (sync(sources) + renderBlocks); HiC, LD, variants-matrix,
dotplot are monolithic (uploadX + render). Whether a plugin needs a
`drawXxxToCtx` wrapper depends only on whether there's transformation
between raw data and paint, not on its upload pattern.

Every display's `renderSvg.tsx` follows the **same shape**: an async wrapper that
awaits readiness and mounts the error-gated chrome, plus a sync body component
that paints. Aligning them means a reader learns one file and knows all twelve.

```tsx
export async function renderSvg(model, opts?) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <XxxSvgBody model={model} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function XxxSvgBody({ model, view, height, opts }) {
  // Render naturally — no data-size gate. The only guard is a TS narrow for a
  // single nullable fetch object the body destructures (e.g. `if (!model.rpcData)
  // return null`) — unreachable at runtime after svgReady; empty data paints an
  // empty track.
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  return paintLayer(width, height, opts, ctx => {
    drawXxxBlocks(ctx, model.rpcDataMap, renderBlocks, state)
    // OR, for multi-source: drawXxxToCtx(ctx, sources, renderBlocks, state)
  })
}
```

Three invariants hold for **every** GPU display, no exceptions:

- **Gate the read with `awaitSvgReady(model)`** (the one shared helper,
  re-exported from `@jbrowse/plugin-linear-genome-view` — never re-inline
  `when(() => …)`). The duck-typed model interfaces each `extends SvgExportable`
  (`{ svgReady; error; regionTooLarge }`) so a missing field is a compile error,
  not a runtime hang.
- **`SvgChrome` is the single terminal-state gate** — pass it `error` **and**
  `regionTooLarge`; never hand-roll `if (model.error) return …` or infer
  too-large from empty data. It renders the terminal itself (`SVGErrorBox` on
  error, an `SVGMessageBox` "region too large" next) and paints the children
  only when there's renderable data, so a body never runs in a terminal state.
  An over-budget or errored track exports a labeled box, not a silent blank.
- **Render empty naturally — never gate on data size.** `awaitSvgReady` +
  `SvgChrome` already own "still loading" and the terminal states, so a
  `laidOutMap.size === 0` / `numContacts === 0` / `numCells === 0` check in the
  body only ever fired for a *loaded-but-empty* region, and returning `null`
  there wrongly dropped a legitimate empty render (e.g. alignments' coverage
  axis). Every draw function is empty-safe (self-guards or map-lookup), so the
  body just draws.

The **only** guard a body keeps is a single TypeScript narrow, and it means the
same thing everywhere it appears: `awaitSvgReady` + `SvgChrome` already guarantee
the data is present and non-terminal when the body runs, but TS can't see that
invariant through the field's type. **Every such narrow is runtime-unreachable in
the export path** — a type formality, not a loading branch. A body needs one only
when it **destructures fields off a single nullable object**; bodies that iterate
the `rpcDataMap` (an `ObservableMap`) or read individually-guarded getters need
none, because iterating an empty map is already valid. So "nullable fetch" is
**not a category a display *is*** — it's just the shape (single blob vs per-region
map) its fetch happens to take. There is no "nullable-fetch vs loading"
divergence; both are the one narrow above.

- **Single nullable fetch object** — HiC / LD (`if (!rpcData)`), multi-variant /
  multi-variant-matrix (`if (!cellData)`). The monolithic-blob fetch stores
  `null` until the dataset lands, and the body destructures fields off it.
  `svgReady`'s `dataLoaded` (`= rpcData !== null`) / spatial-coverage disjunct is
  exactly what makes the `SvgChrome` pass (`!error && !regionTooLarge`) imply the
  object is set. Drop any `&& numContacts === 0` size clause — the narrow alone is
  enough, and even it never fires.
- **MAF's `renderState`** is the *same* narrow, **not** a distinct "still loading"
  category: `renderState` is `undefined` only while `!view.initialized ||
  (!sources && loadedRegions.size === 0)`, and `svgReady` requires
  `loadedRegions.size > 0`, so `if (!state) return null` is unreachable here too.
  (On-screen the render autorun legitimately sees `undefined` pre-load — a real
  branch there, just not in export.) Sequence is the genuinely-different case: a
  *terminal* gate (`if (zoomedOut)`) wired through `svgReadyExtraTerminal`, not a
  data narrow.

These narrows stay (rather than being deleted like alignments' below) only
because the field is `T | null` at the type level and can't be made non-nullable
without a fake empty-blob sentinel — `dataLoaded` already carries the "is it
loaded" signal, so a sentinel would just duplicate it. Where a getter's
`undefined` came from view-shape alone, it *was* made non-nullable and the guard
deleted:

- **alignments / multi-row-feature** — `renderState` was `undefined` *only*
  pre-`view.initialized`, unreachable at either real reader (SVG export
  post-`awaitSvgReady`; the on-screen render autorun installed at canvas mount).
  Rule of thumb: if a `renderState` getter's sole `undefined` trigger is
  `!view.initialized`, drop it and return a value.
- **wiggle / multi-wiggle / manhattan** — `renderState` used to fold the
  first-paint gate into itself via `resolveRenderState(domain, hasData, …)`
  (returning `undefined` when neither existed). That gate moved to the render
  callback's `rpcDataMap.size === 0` check (the same one alignments uses), and
  `resolveRenderState(domain, build)` now always builds — real domain, else an
  inert `EMPTY_PLOT_DOMAIN` (`[0,1]`) stub so a loaded-but-scoreless region still
  runs `renderBlocks` to clear the canvas + flip `canvasDrawn`. Nothing is
  plotted against the stub and the axis/legend is gated on the *real* `domain`,
  so it never shows a fake scale. This is the one place a placeholder domain is
  unavoidable: the GPU render-state can't be constructed without a domain, yet an
  empty region must still paint (clear). Result: these three render empty
  naturally like alignments, with no body guard.

#### The `svgReady` gate (single source of truth for "safe to export")

Every GPU display exposes a **`svgReady`** getter and the off-screen renderer
awaits only that — never an inlined `data != null || error || regionTooLarge`.
The inline form resolved on the *first datum* (so multi-region/whole-genome
exports drew a partial viewport) and stayed true through an in-place refetch (so
a pan/zoom export captured stale data). `svgReady` fixes both, and deliberately
**excludes `canvasDrawn`/`isReady`** — an off-screen export runs on a display
whose on-screen canvas may never have painted (e.g. headless jbrowse-img), so
gating on the paint flag would hang forever. Two definitions, one per fetch
mixin:

- **`MultiRegionDisplayMixin.svgReady`** (per-region streamed displays — canvas,
  alignments, MAF, manhattan, wiggle / multi-wiggle, multi-variant,
  multi-variant-matrix): `(viewportWithinLoadedData && loadedRegions.size > 0)
  || error || regionTooLarge`. The spatial-coverage check is what waits for
  *every* visible region (not the first to stream in) and goes false the instant
  a pan/zoom moves the viewport past loaded data. Wiggle-family + manhattan gate
  on it the same way as every other display — `await awaitSvgReady(model)` in
  `renderSvg.tsx`, reading this getter.
- **`GlobalDataDisplayMixin.svgReady`** (whole-view single-blob displays — HiC,
  LD): `dataLoaded || error || regionTooLarge || svgReadyExtraTerminal`. A global
  display has no per-region spatial axis, so it requires the single dataset to
  actually be loaded (or a terminal error / too-large / extra state) — deliberately
  **not** `displayPhase !== 'loading'`, because the fetch trigger is a debounced
  `afterAttach` autorun, so at export time `isLoading` can be false with no data
  yet and a `displayPhase !== 'loading'` test would capture an empty render. Never
  gates on `canvasDrawn`. `dataLoaded` is an overridable getter (default `false`)
  each display must implement — both HiC and LD return `rpcData !== null`. A
  display that forgets to override it leaves `svgReady` unable to resolve on a
  successful load, hanging SVG export.

The sequence display layers one extra disjunct (`svgReady || zoomedOut`) because
zoomed past its base-render threshold it shows a static "zoom in" message and
issues no fetch, so `svgReady` alone would never resolve.

**Displays outside the two LGV GPU mixins define their own `svgReady`** rather
than inheriting a mixin's — they don't track `loadedRegions`/`displayPhase` the
same way. Arc / paired-arc are still LGV track displays, so they keep the full
contract (own `svgReady` getter + `awaitSvgReady` + `SvgChrome`/`SVGErrorBox`): drawing
all features into a single array (gated by `RegionTooLargeMixin`), their
`svgReady` is `(features !== undefined &&
loadedRegionSignature === currentRegionSignature(self)) || error ||
regionTooLarge`. The `loadedRegionSignature` freshness compare (a region-key
string, the single-array analog of `loadedRegions`) is what makes an export
fired right after a pan/zoom wait for fresh arcs instead of capturing stale ones
— closing the in-place-refetch gap earlier writeups (and `plugins/arc/CLAUDE.md`)
still describe as open.

**Multi-LGV synteny** is *non-LGV* (a `LinearSyntenyView` level composing only
`BaseDisplay` with its own fetch — no MultiRegion/Global mixin) yet
*rectangular*, so it keeps the shared `SvgChrome` + `awaitSvgReady` contract with
its own `svgReady` getter: `(ready && !refetching) || error` (`ready` =
`featureData !== undefined`; `refetching` makes it stale-safe, closing the same
in-place-refetch gap as arc). It has no `regionTooLarge` state, so its
`SvgChrome` is passed `error` only. **`SvgChrome` is not LGV-specific** — it is
the terminal chrome for *any* rectangular display, and synteny is the proof.

**Bespoke error UI, shared gate — no `SvgChrome`.** The *non-rectangular* views
keep their own error UI (they have no rectangular width/height axis to host a
message box), but still expose a `svgReady` getter and await it via the shared
`awaitSvgReady` — **not** an inlined `when()`: dotplot
(`svgReady = !!geometry || !!error`, hand-rolled `SVGErrorBox` on a square
canvas) and circular chord (`svgReady = ready || error !== undefined`, renders
`<DisplayError>`). So the readiness gate is now uniform across **every** display
(LGV, arc, synteny, dotplot, circular) — no `renderSvg` inlines `when()` — while
the error chrome splits: `SvgChrome` for rectangular displays, bespoke for
radial/square ones.

`paintLayer` (in `@jbrowse/core/util/paintLayer`) decides between a 2× DPR
raster canvas (when `opts.rasterizeLayers`) or an `SvgCanvas`, and returns
one `ReactNode` (`<image xlinkHref=…>` or `<g dangerouslySetInnerHTML=…>`).
Raster mode bakes the 2× DPR scaling into the embedded PNG; vector mode
serializes the SvgCanvas call log to SVG markup. Either way the caller
draws to `Ctx2D` in CSS pixels — no manual DPR.

**Avoid hand-rolled JSX-SVG inside `renderSvg.tsx`**. Anything draw-shaped
(rects, paths, fills, strokes) should go through `paintLayer` so both raster
and vector modes work and the on-screen draw code can be shared. Hand-rolled
`<rect>`/`<path>`/`<line>` inside `renderSvg.tsx` is a red flag — it can't
rasterize, drifts from on-screen output, and locks in vector output.

**Permitted exception classes** (only these — anything else is a regression):

1. **Trivial chrome**: scalebars, single separator lines, clipPath wrappers,
   transform `<g>` for offsetting an already-paintLayer'd block. Use
   `<SvgClipRect>` from `@jbrowse/plugin-linear-genome-view` for the
   clipPath+rect pair so every plugin shares one shape.
2. **Bezier-arc overlays** (sashimi in `plugins/alignments`, paired arcs in
   `plugins/alignments` and `plugins/arc`): low element count, native SVG
   `<path>` gives hover/tooltip behavior raster cannot match. Math comes from
   a shared `computeXxxArcs(opts) → Arc[]` so on-screen overlay and SVG
   export consume identical geometry. Don't add a new "vector by design"
   exception just because something is "interactive" — bezier-arc displays
   already render this way on-screen, so the JSX path *is* the on-screen
   path.
3. **Shared React-SVG overlays** that the on-screen view also uses (e.g.
   `VariantLabels`, `LinesConnectingMatrixToGenomicPosition`,
   `RecombinationTrack` in `plugins/variants/src/LDDisplay`,
   `SvgRowLabels`/`SvgTreePath` from `@jbrowse/tree-sidebar`). Same
   component renders on-screen + in export with an `exportSVG` prop. The
   heavy raster-friendly fill path (the matrix itself) **must** still go
   through `paintLayer`; only the overlays stay JSX.

Everything else — every "regular" draw path (fills, glyphs, mismatches,
coverage bins, score bars, ribbons, dot lines, sequence text) — goes
through `paintLayer(width, height, opts, ctx => drawXxx{Blocks,ToCtx}(ctx,
…))` using whichever entry point the plugin exposes (see "Direct" vs "With
builder wrapper" above).

This kills the older "SVG-only `renderToCtx`" pattern that drifted out of
sync with the on-screen renderer (different bicolor handling, different
Y-axis offsets, different bezier curves, different palettes — each plugin
had its own flavor of drift). The canonical reference for the
builder-wrapper shape is
`plugins/alignments/src/LinearAlignmentsDisplay/renderers/Canvas2DAlignmentsRenderer.ts`
(`buildAlignmentsRegionMap` + `drawAlignmentsToCtx` + `drawAlignmentBlocks`);
for the direct shape see
`plugins/maf/src/LinearMafRenderer/drawMafBlocks.ts`.

**Shared utilities** (in `@jbrowse/core/util/`):
- `createSvgRasterCanvas(width, height, opts)` — the 2× DPR canvas + `opts.createCanvas` fallback ritual.
- `paintLayer(width, height, opts, paint) → ReactNode` — raster-vs-vector dispatch.
- `svgExport` — `SVGErrorBox` (red error banner) and `SvgClipRect` (clipPath wrapper) for every renderSvg.tsx.
- `Ctx2D = CanvasRenderingContext2D | SvgCanvas` — shared type alias used by every `drawXxxBlocks` signature.

**Every `id` on a `<clipPath>`/`<use>` must be scoped by the owning view or
display model's unique `.id`** (never a bare literal like `"clip-ruler"`, and
never derived only from `trackId`/block key/array index). SVG ids are
document-global — a second `<clipPath id="x">` silently wins nothing; browsers
just resolve every `url(#x)` reference to the *first* match, so the second
clipped group renders unclipped. This is invisible in isolation (single-view
exports look fine) and only surfaces once two view panels land in the same
document — synteny rows, breakpoint-split panels. `exportAndVerifySvg` in
`products/jbrowse-web/src/tests/util.tsx` asserts no duplicate ids as a
regression guard; prefer `SvgClipRect` (zero-offset rects) over hand-rolled
`<defs><clipPath>` for new clip ids.

---

### `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both
are MST view methods (not getters) so subclasses extend them via the standard
`super` capture pattern, mirroring `renderProps`.

| Method             | Consumer                                                          | Invalidation route                                                                              |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `rpcProps()`       | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps()` → `clearAllRpcData` → refetch   |
| `gpuProps()`       | `buildSourceRenderData(data, self.gpuProps())` — encoder input    | Upload callback reads it — MobX re-uploads without an RPC roundtrip                             |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap`          | Upload autorun reads it — MobX re-uploads without an RPC roundtrip                              |
| `renderState`      | `backend.render(state)` per frame                                 | Render callback reads it — re-fires when deps shift                                             |

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `sessionId`,
`stopToken`) are spread in at the RPC call site, not from `rpcProps()` —
keeping `rpcProps()` focused on its purpose: cache keys for
`SettingsInvalidate`. Every display follows the same call shape:

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  sessionId,
  adapterConfig: self.adapterConfig,  // inherited from BaseDisplayModel
  regions, bpPerPx,                    // per-call values
  ...self.rpcProps(),                  // user settings (cache keys)
  stopToken, statusCallback,
})
```

`adapterConfig` is provided by `BaseDisplayModel` (via
`getConf(this.parentTrack, 'adapter')`) — no display redefines it.

`rpcProps()` is the **only** extension point for the RPC payload. Each display
defines its own typed shape; subclasses that need to layer on additional
fields capture `super` and spread:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      const base = superRpcProps()
      return {
        ...base,
        displayConfig: { ...base.displayConfig, geneGlyphMode: self.effectiveGeneGlyphMode },
        showOnlyGenes: self.showOnlyGenes,
      }
    },
  }
})
```

`MultiRegionDisplayMixin` does **not** provide a base default — declaring one
would widen the typed return through MST's `.views()` chain and force consumers
to re-spread named fields. The mixin's `SettingsInvalidate` autorun looks up
`rpcProps` dynamically (`(self as { rpcProps?: () => unknown }).rpcProps`) so
displays without settings-driven refetch (HiC, LD) can simply not define it.

`gpuProps()` exists wherever the main thread encodes the GPU buffer (wiggle,
multi-wiggle, multi-LGV synteny). Canvas's worker pre-builds the buffer, so
canvas has only `rpcProps()`. This splits refetch from re-upload: wiggle color
change → re-encode only; `bicolorPivot` change → worker output differs →
`rpcProps()` → refetch.

Derived region maps apply when upload needs whole fresh per-region payloads,
not just encoder parameters. Alignments' `laidOutPileupMap` returns shallow
clones of `rpcDataMap` entries with freshly-allocated Y arrays from
main-thread layout (+ connecting-line / Flatbush in chain mode). Raw
`rpcDataMap` is never mutated. Use derived maps when settings change the
shape/contents of per-region data; use `gpuProps()` for scalars fed to an
encoder.

#### Theme-derived render inputs are session getters, not pushed volatiles

Color palettes are a pure function of the active theme, so derive them in a
model getter — `buildColorPaletteFromTheme(getSession(self).theme)` — that
`gpuProps()` / `renderState` read directly. Do **not** stage them in a volatile
that a React `useEffect` pushes in via a `setColorPalette` action: the effect
only runs when the component mounts, so SVG export and RPC (no component) saw a
null palette and rendered blank, forcing per-call seeding hacks. As a getter the
value is always present and MobX recomputes it only when the theme changes —
same re-encode invalidation, no mount dependency. `session.theme` is the
resolved MUI `Theme` (required on `AbstractSessionModel`); embedded products
without `ThemeManagerSessionMixin` supply a minimal `get theme()` =
`createJBrowseTheme(getConf(self, 'theme'))`. SVG export still overrides the
palette with the *export* theme (`opts.theme`) so it matches the labels/contrast
that already follow it. (Applies equally to alignments, MAF, and the reference
sequence display.)

---

### Per-region zoom-staleness

All worker position output is **absolute genomic uint32** — no pixel
coordinates cross the worker boundary, so data stays valid under zoom. Two
exceptions for zoom-dependent *content* (not coords):

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based on
  `bpPerPx / resolution`. `isCacheValid` uses strict equality
  (`view.bpPerPx === loadedBpPerPx`) — any zoom change refetches all visible
  regions together. See `architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md`.
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent worker
  decision. `isCacheValid` returns `false` (refetch) when `rpcDataMap` has no
  entry for the region (pruned off-screen or never loaded), and otherwise
  refetches only when the viewport crosses `shouldRenderPeptideBackground`'s
  discrete threshold. Density-blocked regions are held back by the
  `regionTooLarge` gate in `FetchVisibleRegions`, not inside `isCacheValid`.
  `laidOutDataMap` uses `coarseBpPerPx` (debounced 500ms) so Y-row packing
  doesn't recompute on every animation frame during smooth zoom.

All other plugins leave the default `() => true`.

`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override
per region and refetches stale ones.

---

### HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/render-core/src/hal/`.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d     → return null
  else                   → try WebGPU → fallback WebGL2 → fallback null
```

**Key methods:** `uploadBuffer(regionKey, passId, data, count)`,
`getBufferCount(regionKey, passId)`, `drawPass(passId, regionKey, bufferPassId?)`,
`writeUniforms(data)`, `setScissor`, `setViewport`, `deleteRegion(key)`,
`pruneRegions(active)`, `dispose()`.

`drawPass` short-circuits when the region has no buffer for that pass (or
count is zero), so callers can issue draws unconditionally without tracking
which regions have data — HAL already knows.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery),
`WebGL2Hal` (`antialias: true`, VAO + UBO, context-loss recovery),
`MockHal` (tests).

#### Renderers stay stateless

GPU renderer classes own only what is intrinsically per-instance:

- the `GpuHal` reference
- pre-allocated uniform scratch buffers (`ArrayBuffer` + typed views) reused
  across frames to avoid per-frame GC churn
- save/restore UBO scratch where a pass mutates uniforms (alignments arc/overlay)

What does NOT belong as renderer instance state:

- **Region-lifecycle bookkeeping** — call `hal.pruneRegions(active)` instead
  of mirroring HAL's region map in a renderer-side `Map<number, ...>`. HAL
  is the authoritative owner of "which regions have GPU buffers."
- **Per-region metadata derivable from `rpcDataMap`** — `hasRects` /
  `hasLines` / `outlineColor` style fields. `drawPass` skips missing buffers
  so the boolean flags aren't needed; per-region scalars used in uniforms
  should be passed into `renderBlocks` from the MST model rather than cached
  on the renderer. See `GpuCanvasFeatureRenderer` for the canonical shape:
  `renderBlocks(blocks, regions, state)` where `regions` is the model's
  `laidOutDataMap` / `rpcDataMap` passed through verbatim.
- **Write-only mirror copies of upload data** — if a value lives in
  `rpcDataMap[idx].foo`, do not also store it as `LocalRegion.foo` "just in
  case." Read it from the upload data path that needs it.

The rule of thumb: anything the upload callback already knows from observable
inputs can be looked up at render time too — don't snapshot it onto the
renderer instance. Less local state means fewer divergence points when the
source of truth shifts.

**RenderingBackend override** (query param `?renderer=`): `webgpu` / `webgl` /
`canvas2d` / `canvas`; omitted → auto-detect WebGPU → WebGL2 → Canvas 2D.

---

### Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL (WebGPU)
and GLSL ES 3.00 (WebGL2) by `packages/shader-tools/src/build-shaders.ts`. See ADR-005.

**Layout:** display-specific shaders in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared in
`plugins/<plugin>/src/shared/shaders/`; cross-plugin modules
(`hpmath.slang`, `colorPack.slang`, `pointGlyph.slang`) in
`packages/render-core/src/shaders/`. Codegen emits `<name>.generated.ts`.

**What's auto-derived from Slang reflection (not hand-coded):** the
`.generated.ts` file exports shader source strings (`WGSL_SOURCE`,
`GLSL_VERTEX`, `GLSL_FRAGMENT`), per-field byte offsets (`FIELD_OFFSET_BYTES`,
`FIELD_OFFSET_F32`), strides (`INSTANCE_STRIDE_BYTES`, `INSTANCE_STRIDE_F32`),
`UNIFORMS_SIZE_BYTES` + `UniformOffsets`, typed TS interfaces for instance and
uniform structs, a typed `writeUniforms()` uniform packer, a typed
`packInstances()` struct-of-arrays instance packer (one input array per field;
the u32/i32/f32 destination view per field is derived from the shader struct,
so a field-type change can't desync the packer), and the
`GL_ATTRIBUTES: GlAttributeLayout[]` array consumed by `PassDescriptor`. TS
code imports these constants by name from the generated module — stride and
field-offset drift between the TS packer and the shader struct is impossible
by construction. CI runs `pnpm gen:shaders && git diff --exit-code` to catch
stale generated outputs.

**Wire-up:** `slangPass()` turns a generated module into a `PassDescriptor`,
with overrides for `topology`, `blendState`, `textures`, and buffer sharing.

Authoring conventions and gotchas: ADR-005.

---

### BP precision: why both uint32 storage AND hi/lo float math

Genomic positions exceed 3×10⁹ on T2T assemblies; float32's 24-bit mantissa
can't represent every integer past 2²⁴ ≈ 16.7 Mbp, causing ~256 bp precision
loss at 3 Gbp. GPU clip-space is unavoidably float32, so the question is
*where* precision loss happens without corrupting output.

The answer is a **two-stage representation**:

#### Stage 1 — storage as uint32

Absolute genomic positions are stored as `uint32` vertex attributes. Uint32 is
exact for `[0, 2³²)` = 4.29 Gbp.

#### Stage 2 — conversion to clip-space via hi/lo split

In the shader the uint32 is split into a **high** half (bits 12..31, aligned
to 4096-bp boundaries) and a **low** half (bits 0..11, values 0..4095):

```wgsl
uint lo = value & 0xFFFu;
uint hi = value - lo;
float2 split = float2(float(hi), float(lo));
```

Both halves are exact in float32 — `hi` is always an exact multiple of 4096;
`lo` is always in `[0, 4096)`.

`clippedBpStart` is split the same way on the CPU (`splitPositionWithFrac`)
and uploaded as `bpHi`/`bpLo`. The shader subtracts hi-from-hi and
lo-from-lo separately:

```wgsl
float dHi = split.x - u.bpHi;  // exact: large-large = small
float dLo = split.y - u.bpLo;  // exact: small-small = small
float clipX = (dHi + dLo) / bpLen * 2.0 - 1.0;
```

#### Why we need both representations

- **uint32 only (no split)**: shader would convert uint32 → float directly,
  losing precision at 3 Gbp. Works only below ~16 Mbp.
- **float hi/lo pre-split (no uint32)**: doubles per-vertex memory (8 vs 4
  bytes) and pushes split logic onto every CPU packer.
- **uint32, split in shader (current)**: 4 bytes per vertex, precision
  preserved, CPU packers copy absolute positions unchanged. Split is 2 integer
  ops in the shader.

`hpmath.slang` provides `hpSplitUint`, `hpToClipX`, `hpScaleLinear`.
`blockClipUtils.clipBlock` emits `[bpStartHi, bpStartLo]` for the visible
window; `splitPositionWithFrac` is the CPU equivalent for UBO fields.

#### Synteny + dotplot: window-relative Float32 cumulative-bp

Synteny and dotplot corner storage takes a different shape than the LGV-family
uint32 attributes above. A synteny ribbon connects two views (dotplot: two
axes) with independent `bpPerPx`; per-corner positions are **cumulative-bp
across all regions of the corner's view/axis**, not single-region absolute bp —
genome scale, up to Gbp, past Float32's 24-bit mantissa.

Rather than the hi/lo split the LGV path uses, both store each corner **relative
to a per-axis fetch-time base** (`base = offsetPx * bpPerPx`, the viewport-start
cumBp captured when the geometry is built):

- The vertex attribute is a single Float32 `bpRel = cumBp − base`. The shader
  reconstructs screen X as `bpRel * bpPerPxInv + panPx`, where
  `panPx = (base − viewBp) / bpPerPx` is folded on the CPU in float64 from a
  SMALL delta (the pan since fetch — see `GpuSyntenyRenderer` /
  `GpuDotplotRenderer`). Because the base cancels the genome-scale magnitude,
  both `bpRel*inv` (small for on-screen corners) and `panPx` (small for
  realistic pans) stay sub-pixel in a single Float32 — no hi/lo pair, half the
  position bytes. The per-instance layout is the four corners (`bp{1..4}` /
  `x1,y1,x2,y2`) plus `color` etc. (`syntenyTypes.slang` / `dotplot.slang`).
- Synteny bakes the window-relative value into its geometry buffers, so the CPU
  pick path reads it directly (`buildSyntenyGeometry` returns `base0`/`base1`).
  Dotplot keeps **absolute** cumBp `Float64Array`s in geometry — the Canvas2D /
  SVG renderers consume them unchanged — and subtracts the base only at GPU
  upload; `buildLineSegments` carries `baseH`/`baseV` alongside for the GPU path.

This is viable because the fetch is scoped per window and re-runs when the
window moves (synteny: both views refetch on pan; dotplot: the h-axis refetches,
and a zoom on either axis rebuilds geometry), so the base stays near the view.
Far-off-screen corners — a distant-mate ribbon/segment on another chromosome —
lose absolute precision but only on the clipped-away sliver; visible error stays
~`panDistancePx · 2⁻²³`. Storing cumBp instead of regional bp + region index
avoids the per-region uniform table / per-(region-pair) draw-call concerns that
ruled out earlier hp-math attempts; no `MAX_REGIONS` cap. See ADR-010 for the
rejected per-region-table alternatives, ADR-018 for the earlier hi/lo shape this
replaced. (That shape's shared helper `hpCornerScreenX` was removed from
`hpmath.slang` once both views dropped it; the LGV in-shader
`hpSplitUint`/`hpToClipX` path is untouched.)

#### Genome-size limits (what must fit where)

Two distinct thresholds apply — one hard, one not a real limit:

- **Single reference sequence (one chromosome/contig) must be `< 2³²` =
  4.29 Gbp.** This is the one hard assumption. Every `uint32` position
  attribute (LGV-family, split in-shader via `hpSplitUint`) and every
  per-feature `starts`/`ends`/`mateStarts`/`mateEnds` array in the synteny
  RPC (`executeSyntenyFeaturesAndPositions.ts`) stores *chromosome-local*
  coordinates and assumes this. **We accept it:** real chromosomes clear it
  comfortably (human chr1 ≈ 250 Mbp, hexaploid wheat's largest chr3B ≈
  830 Mbp). It would only wrap for a genome whose *single* reference exceeds
  4.29 Gbp (e.g. certain lungfish/amphibian chromosomes) — out of scope.

- **Whole-assembly cumulative-bp is NOT bounded by uint32, and no longer has a
  fixed GPU size ceiling.** The sum across all chromosomes — what a synteny
  ribbon corner or dotplot segment spans — is Float64 on the CPU (exact to 2⁵³).
  On the GPU it is stored **window-relative** as a single Float32 (`cumBp −
  fetch-time base`; see the window-relative subsection above), so on-screen
  precision is `~panDistancePx · 2⁻²³` — sub-pixel for all realistic navigation
  *regardless of assembly size* (16 Gbp hexaploid wheat, or even 100+ Gbp
  genomes like *Tmesipteris oblanceolata* ≈ 160 Gbp / *Paris japonica* ≈ 148 Gbp
  all render correctly), because a zoom recaptures the base near the view.
  `Region.start`/`end` are Float64 throughout with no bitwise coordinate ops.

  This retired the former ~68.7 Gbp ceiling: synteny+dotplot used to split cumBp
  into a 4096-bp-aligned Float32 hi/lo pair, exact only while `cumBp < 2³⁶`, and
  degraded past that. The window-relative base cancels the genome-scale
  magnitude, so the cap is gone. (The LGV-family in-shader hi/lo path still uses
  `splitPositionWithFrac`, but only on single-chromosome `bpRange` uniforms
  `< 2³² = 4.29 Gbp` — well inside the exact range.)

- **Soft, non-bp ceiling:** the synteny per-instance `featureId`
  (`instanceInterleave.ts`) is a Float32, exact only to 2²⁴ ≈ 16.7M *rendered
  instances* — a density limit on a single whole-genome PAF, not a coordinate
  limit. Overview-zoom culling keeps counts well below it.

---

### Coordinate convention (alignments and wiggle data)

**Every** position array emitted by the alignments or wiggle worker is
**absolute genomic uint32** — reads, gaps, mismatches, interbase (ins/soft/
hardclip), softclip bases, modifications, SNP/noncov/indicator/modCov
segments, sashimi junctions, chain connecting lines, `coverageStartPos`,
`readNextPositions`, and wiggle `featurePositions`.

**Why absolute, not regionStart-relative:**

1. Region boundaries change on zoom-out. Anything keyed to `regionStart` is
   silently invalidated when the anchor shifts.
2. No signed offsets needed — genomic positions are always ≥0.
3. Reversed regions are transformed by the drawing layer (`bpToX` on Canvas2D,
   `flipX` on GPU), not the coord convention. Reversal is orthogonal.
4. All consumers (SVG export, Canvas2D, hit testing, tooltips,
   `findFeatureInRpcData`, main-thread layout) compare against absolute bp
   values. No `regionStart +` arithmetic anywhere.

**Precision across the GPU boundary:**

Every shader consumes absolute uint32 positions and converts to clip space via
hp-math.

| Shader group | Attribute | Precision technique |
|---|---|---|
| Point/edge shaders (read, gap, mismatch, insertion, modification, clip, connectingLine, arcLine, coverage, snpCoverage, noncovHistogram, indicator, modCoverage) | `uint position` | `hpClipX(hpSplitUint(absPos), u)` — hi/lo split against `bpHi`/`bpLo`. Exact at 3 Gbp. |
| arc (paired-end bezier curves) | `uint x1, x2` | `hpLinear(hpSplitUint(absPos), u)` → normalized [0,1]; bezier runs on small floats. Same precision floor. |

The alignments UBO has **no `regionStart`**, **no `domainStart`/`domainEnd`**.

**Reversed regions:** Both shader families call `flipX(sx, u)` after
computing clip-space x. `flipX(x) = lerp(x, -x, u.reversed)` maps
left-edge=`region.end`, right-edge=`region.start`.

---

### Canvas scaling & hi-DPI

**GPU canvases (HAL-managed)**: shader uniforms are in CSS pixels; HAL sets the
backing store to `css × dpr`, so `N / canvas_width` in clip space = `N` CSS
pixels at any DPR. Do not manually scale by `devicePixelRatio`.

**2D overlay canvases (`VisibleLabelsOverlay`, `MsaHighlightOverlay`, etc.)**:
caller owns DPR. Set `canvas.width = w * dpr` + `canvas.height = h * dpr` in
the effect, call `ctx.scale(dpr, dpr)`, then put CSS `width`/`height` in the
style block. Skipping this renders blurry on Retina displays. `prepareCanvas`
(in `packages/render-core/src/canvas2dUtils.ts`) does this for the on-screen
Canvas2D backend path; standalone overlay components must replicate it.

---

### `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are
added, removed, or reordered. **Not** an index into
`dynamicBlocks.contentBlocks` — one displayedRegion can produce multiple
render blocks that share one GPU buffer and draw with different scissor clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`,
and `RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny)
key on a tuple of two displayedRegion indices.

---

### Adding a new GPU display type

- **Types** — `MyData`, `MyRenderState`, `MyRenderingBackend`.
- **Shader** — author `my.slang`; `pnpm gen:shaders` emits `my.generated.ts`.
- **Renderers + factory** — `createRenderingBackend<MyRenderingBackend>` from
  `packages/render-core/src/createRenderingBackend.ts`. Use `slangPass()` to build
  the `PassDescriptor`.
- **MST model:**
  - Compose `MultiRegionDisplayMixin()` for LGV-family per-region displays
    (brings in `RenderLifecycleMixin`, `FetchMixin`,
    `RegionTooLargeMixin`, the four fetch autoruns, and `rpcProps()`→refetch
    wiring).
  - Compose `GlobalDataDisplayMixin()` for displays that hold a single
    non-regional dataset (HiC contact matrix, LD triangle, variant matrix).
    Same slot mixin + `FetchMixin` + `RegionTooLargeMixin` plumbing, but
    **no** fetch autoruns — each display installs its own `afterAttach`
    autorun expressing its trigger conditions (e.g. HiC: viewport change;
    LD: viewport + `showLDTriangle` + …).
  - Compose `RenderLifecycleMixin()` directly only when neither
    fetch surface is needed (rare — most GPU displays fetch something).
  - Add a cached `renderState` view.
  - Define `startRenderingBackend(backend)` calling
    `self.attachRenderingBackend(backend, { upload, render })`.
  - Expose `rpcProps()`; add `gpuProps()` only when main thread encodes GPU
    buffers from settings.
- **React component** — `observer()`. Render the canvas through the shared
  `DisplayChrome` (from `@jbrowse/plugin-linear-genome-view`), passing the model
  and the renderer `factory`. `DisplayChrome` calls `useRenderingBackend`
  internally and owns the render-error / region-too-large / error-bar / loading
  overlays (all read off the model), so the component only lays out its own
  canvas(es) via the render-prop child:
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
- **Wiggle-style displays** — to reuse the whole LinearWiggleDisplay model,
  compose `linearWiggleDisplayModelFactory` from `@jbrowse/plugin-wiggle` (see
  `plugins/gccontent`). To build a custom model that only borrows the score
  machinery, compose `WiggleScoreConfigMixin` + `makeScoreSubMenu` instead (see
  `plugins/gwas` Manhattan). Implement `WiggleRenderingBackend` (typed from
  `@jbrowse/wiggle-core`); override `isCacheValid` to `() => true` if the display
  is zoom-independent.
- **Tests** — unit (`MockHal`); browser (Puppeteer, `--backend=webgl|webgpu|canvas2d`).

---

### What NOT to do

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` —
  it belongs in the MST autorun pair spawned by `attachRenderingBackend`.
- Don't destructure model methods; call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't cache per-region data on a renderer class (`private regions = new Map<number, ...>()`).
  The model's `rpcDataMap` / `laidOutDataMap` is the single source of truth;
  pass it into `renderBlocks(blocks, regions, state)` instead. For GPU buffer
  lifecycle delegate to `hal.pruneRegions(active)` rather than mirroring HAL's
  region map. See `PerRegionRenderingBackend` in `@jbrowse/render-core/perRegionRenderingBackend`.
- Don't add or redefine volatiles/actions owned by the slot mixin
  (`canvasDrawn`, `renderTick`, `currentRenderingBackend`, `renderError`,
  `markCanvasDrawn`, `resetCanvasDrawn`, `renderNow`, `setRenderError`,
  `stopRenderingBackend`, etc.) or the `isReady` view owned by
  `MultiRegionDisplayMixin`. `renderError` in particular is the single source
  for the `renderError` terminal phase — don't fork it into a display-local
  volatile.
- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables
  next to generated modules. Edit `.slang` source and run `pnpm gen:shaders`;
  CI's `git diff --exit-code` catches stale outputs. Consume generated
  constants (`FIELD_OFFSET_F32.x`, `INSTANCE_STRIDE_BYTES`, `UniformOffsets.y`,
  etc.) by name from TS — never copy a literal offset into a renderer.
- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()` — `SettingsInvalidate` watches `rpcProps()` and calls
  `clearAllRpcData`, which clears the very data `rpcProps()` just read, creating
  an infinite fetch loop.
- Don't diverge the two render backends. Import shader constants into TS rather
  than retyping them, put shared glyph geometry/color math in one draw helper,
  and keep multi-layer order/gating in one exhaustively-keyed registry. And don't
  go the other way either: a Canvas2D sub-pixel *overdraw* (fudge factor / `f2`)
  or stroke-vs-fill swap is deliberate AA compensation with no shader equivalent —
  don't port it into a `.slang`. See "Keeping the two backends in parity".
