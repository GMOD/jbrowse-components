# ADR-026: DisplayChrome's layering stays — the split maps to concern boundaries, not accidental indirection

## Status

Accepted. Builds on [ADR-025](adr-025-gpu-canvas-stays-mounted-not-xor-error.md)
and [DISPLAYCHROME.md](../DISPLAYCHROME.md) (the migration history and the
"what it is"). This ADR records the outcome of a **leakiness / radical-simplification
audit** of the chrome stack so the rejected refactors aren't re-litigated.

## Context

The GPU-display chrome stack has five layers:

- `useRenderer` (`packages/core/src/util/useRenderer.ts`) — pure React/DOM canvas
  lifecycle: runs the factory after mount, owns the canvas ref, `retry()`
  remount, dispose-on-unmount.
- `useRenderingBackend` (`packages/core/src/util/useRenderingBackend.ts`) — the
  MST adapter: wires `useRenderer`'s `{onReady,onDispose,onError}` to
  `model.startRenderingBackend` / `stopRenderingBackend` / `setRenderError`, plus
  `useTabVisibilityRerender → renderNow`.
- `RenderLifecycleMixin` (`packages/core/src/gpu/RenderLifecycleMixin.ts`) — the
  *observable* draw-loop state (`canvasDrawn`, `renderError`,
  `currentRenderingBackend`, `renderTick`) and the upload/render autorun pair.
- per-display `startRenderingBackend(backend)` — injects that display's
  upload/render closures (or an `installPerRegionLifecycle` call for streamed
  per-region displays).
- `DisplayChrome` (`plugins/linear-genome-view/.../DisplayChrome.tsx`) — owns the
  backend hook + the three terminal-state overlays + the positioning container,
  handing `canvasRef`/`canvas` to a render-prop body.

The audit confirmed the **state axis is sound and not leaky**: the model owns all
four terminal states and `loadingOverlayVisible` is defined so they are mutually
exclusive *by construction* (`… && !regionTooLarge && !error && !renderError`),
making DisplayChrome's JSX precedence defensive rather than load-bearing. The
audit then pressure-tested several structural simplifications. They are recorded
here as rejected.

## Decision

Keep the current layering. Each layer maps to a genuine concern boundary:

- **DOM/React lifecycle** (`useRenderer`) is separable from **state-tree wiring**
  (`useRenderingBackend`). The seam is what lets `useRenderer.test.ts` exercise
  the hard React parts (async factory, retry remount, dispose) with **no MST
  model**.
- **Render-lifecycle state must be model-side**, not React-local, because
  `loadingOverlayVisible` is a *join* of render state (`canvasDrawn`,
  `renderError`) and fetch state (`isLoading`, `error`, `regionTooLarge`). A join
  of two state machines must live on one observable object, and fetch state is
  irreducibly MST. This is also why the upload/render autoruns live on the model
  (read its getters directly, survive a WebGL context-loss backend swap without a
  React remount).
- **DisplayChrome owns the container `<div>`** because `LoadingOverlay`
  (`position:absolute; inset:0`) and `ErrorBar` (`position:absolute`) need a
  shared `position:relative` ancestor with the canvas. The canvas and the
  overlays cannot be separated into different containers.

### Rejected alternatives

- **Merge `useRenderer` into `useRenderingBackend`.** `useRenderer`'s callback API
  has zero production consumers — every call site (dotplot, synteny,
  DisplayChrome) goes through `useRenderingBackend`; only `useRenderer.test.ts`
  uses it directly. So it *could* collapse. Rejected: that test file is the only
  place the canvas lifecycle is exercised without an MST model. Merging trades one
  fewer file for coupling those tests to an MST fake. The layer is collapsible but
  load-bearing for testability.
- **"Body owns its own div; chrome renders overlays around it."** Rejected —
  refuted by the positioning requirement above. The overlays must share the
  canvas's relative container, so the chrome must own it. The outer/body
  two-component split in maf/alignments/canvas is a consequence of React
  hook-ordering (the drag/mouse hook needs the container ref at the same level as
  `useRenderingBackend`, which lives inside DisplayChrome), not a flaw to design
  away.
- **Hand `canvasRef` to the body via context (plain children) instead of a
  render-prop.** Tempting because the render-prop only hands the ref to the
  *immediate* child, so the two multi-level bodies still drill it a hop or two
  (alignments: `PileupBody → PileupInner`; canvas: `FeatureBody`). Rejected — a
  lateral move, not a simplification. The wrapper-owns-the-hook property (the
  actual anti-scatter invariant) is identical either way; only the handoff
  differs. Those bodies already thread `model` (and often `canvas`) down the same
  path, so `canvasRef` rides along at near-zero marginal cost, while context would
  trade an *explicit* handoff (`({ canvasRef }) =>` shows the source) for an
  *implicit* "must render inside a DisplayChrome" dependency plus a hidden
  `useChromeCanvas()` read — against this codebase's explicit-over-indirect grain
  — and would touch all ten displays on the GPU paint path for the reward of
  deleting ~three prop hops. (A bare *hook* returning `canvasRef` for the
  component to wire the states itself is strictly worse still: it reintroduces the
  call-anywhere / forget-a-terminal-state failure mode the wrapper exists to
  prevent — the original alignments bug.)
- **Move the upload/render autoruns out of the model into a component
  `useEffect`+`autorun`.** Thins the model on paper (drops `attachRenderingBackend`,
  `autorunsInstalled`, `renderTick`, `currentRenderingBackend`). Rejected: it
  relocates complexity from MST to React, re-runs the draw loop on remount
  (changing the GPU-upload perf profile), doesn't actually delete the
  context-loss/`renderTick` machinery (just moves it into dep arrays), and runs
  against this codebase's documented preference for `autorun`-in-model over
  `useEffect`-in-component (root `CLAUDE.md`).
- **Convention-based `uploadFrame`/`renderFrame` to delete per-display
  `startRenderingBackend`.** Rejected — `startRenderingBackend`'s body *is* the
  display's draw logic (the upload/render closures over `self.renderState` /
  `self.rpcDataMap`, or an `installPerRegionLifecycle` call), not a forwarding
  shim. There are two registration flavors (single-pair `attachRenderingBackend`
  vs per-key `installPerRegionLifecycle`) a name-convention can't capture
  uniformly. Net-neutral on code, and it would split the upload/render pair.
- **Collapse the 3-way contract** (`ChromeModel` / `RenderLifecycleModel` /
  canvas's hand-rolled `LinearBasicDisplayModel`) into one derived type. Rejected
  — the canvas display deliberately hand-rolls its interface to dodge a `lazy()`
  circular type (documented in `FeatureComponent.tsx`). The duplication is
  duck-typed and compile-checked at every call site, so drift fails loud.

## Consequences

- The chrome stack is treated as near a local optimum for its constraints and
  this codebase's idioms. Future "why is this 5 layers" questions land here.
- The first-paint `data-testid` `-done` convention was the one residual debt, and
  the **chrome-div half is now owned by DisplayChrome**: it takes a `testid` base
  prop and appends `-done` on `canvasDrawn`, so the eight chrome-div consumers no
  longer hand-write the ternary (emitted strings unchanged → no test churn; the
  `ChromeModel` contract gained `canvasDrawn`). Two emitters remain *by design*,
  on a different axis: the **canvas-pixel** selectors (`hic_canvas_done`,
  `ld_canvas_done`, `variant_canvas_done`, `variant_matrix_canvas_done`,
  `synteny_canvas_done`, `dotplot_webgl_canvas_done`) stay on the inner `<canvas>`
  because `expectCanvasMatch` reads that element, not the chrome div; and the
  generic block-path `display-${id}-done` comes from `BaseLinearDisplay.tsx` (the
  legacy `LinearBlocks` wrapper, gated `'canvasDrawn' in model`), which never
  renders DisplayChrome. Three emitters, three distinct roles — not drift. See
  [DISPLAYCHROME.md](../DISPLAYCHROME.md) follow-up #2.
- `renderTick` stays: it is a justified workaround for MobX's inability to express
  "re-fire on A's *effect* when A doesn't change my deps' identity," and one
  counter serves both triggers (post-upload + tab-restore).
