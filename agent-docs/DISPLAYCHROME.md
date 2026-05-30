# DisplayChrome — GPU display chrome unification

Status as of the `webgl-poc` commits `50e9aaaef2` + `36079aef8c`.

## What it is

`DisplayChrome` (`plugins/linear-genome-view/src/BaseLinearDisplay/components/DisplayChrome.tsx`)
is the single wrapper every GPU display renders. It **owns the render lifecycle
and all three terminal states**:

- calls `useRenderingBackend(factory, model)` internally (the backend hook lives
  in exactly one place — a display can't bury it),
- gates render error → region-too-large → (body + fetch-error bar + loading
  overlay),
- hands `{ canvasRef, canvas }` to the body via a render-prop child.

Every GPU display follows one shape:

```tsx
<DisplayChrome model={model} factory={Renderer} ...divProps>
  {({ canvasRef, canvas }) => <XBody model={model} canvasRef={canvasRef} .../>}
</DisplayChrome>
```

- Thin outer owns `DisplayChrome` + any hook bound to the chrome container ref
  (maf's drag-select, alignments' mouse tracking).
- A **named observer** body owns the canvas + overlays (so observable reads
  scope to the body, not the chrome). All 10 displays do this — no inline
  bodies.

## Adopted (10/10 LGV GPU displays)

wiggle, multi-wiggle, manhattan, canvas (LinearBasicDisplay), maf, alignments,
hic, LD, multi-variant, variant-matrix.

Deleted competing abstractions: `CanvasDisplayWrapper`, `VariantStatusOverlays`,
`useDisplayRendering` (inlined into DisplayChrome).

## Intentionally NOT on DisplayChrome

`dotplot-view` and `linear-comparative-view` (synteny) use the lower-level
`useRenderingBackend` primitive directly. They are **non-LGV view types** with
no LGV chrome model (`loadingOverlayVisible` / `regionTooLarge` /
`regionCannotBeRendered` / `height`), so DisplayChrome's `ChromeModel` contract
doesn't fit. This is the sanctioned drop-to-primitive path, not partial
adoption. Don't try to force them onto DisplayChrome.

## Behavior changes that still want a real-browser smoke test

Unit tests + tsgo are green, but these were behavior changes verified only in
jsdom. A next agent with a browser should confirm:

1. **Variant force-load cycle** (highest value). The variant displays dropped
   their `visibility:'hidden'` canvas special-casing (ADR-025). DisplayChrome
   now unmounts the canvas on `regionTooLarge` and re-inits on force-load via
   the `stopRenderingBackend → startRenderingBackend` dispose/re-init cycle.
   Confirm: zoom to a too-large region on a multi-variant / variant-matrix
   track → "force load" → canvas re-renders correctly (no blank/detached
   canvas). This is the empirical proof the old constraint was artificial.
2. **Loading overlay timing.** Variants switched from a bespoke
   `isDisplayLoading` (keyed on `cellData`) to the shared `loadingOverlayVisible`
   (keyed on `canvasDrawn` / `isLoading`). hic + LD switched from
   `CanvasDisplayWrapper`'s `LoadingBar` (`isLoading`) to the shared
   `DisplayLoadingOverlay` via a new `GlobalDataDisplayMixin.loadingOverlayVisible`
   (`isLoading && !regionTooLarge && !error`). Confirm loading shows on
   pan/zoom fetch and hides on first paint; confirm LD with the triangle toggled
   off shows NO loading overlay (empty-state, fetches nothing).
3. Run the GPU-display browser-tests (`products/jbrowse-web/browser-tests`) and
   diff goldens for the converted tracks.

## Suggested follow-ups (ranked)

1. ~~Remove the last view-in-model leak.~~ **DONE.** DisplayChrome renders
   `<TooLargeMessage model={model} />` itself; `regionCannotBeRendered()` (JSX)
   was removed from `RegionTooLargeMixin`, and `ChromeModel` widened with
   `regionTooLargeReason` / `featureDensityStats` / `setFeatureDensityStatsLimit`.
   The dead `VariantDisplayModelInterface.ts` fell out and was deleted. The
   pure-GPU displays now fall back to `BaseDisplayModel`'s null
   `regionCannotBeRendered` (unused — DisplayChrome owns the banner).
   **Remaining (legacy, intentionally left):** `FeatureDensityMixin` still has
   its own JSX `regionCannotBeRendered`, used by the server-side **block**
   render path (`serverSideRenderedBlock.ts` returns it as `cannotBeRenderedReason`,
   arc's `BaseDisplayComponent` renders it). Ripping that out means restructuring
   the legacy block-render contract to pass a string + render the message in the
   block component — a separate non-GPU subsystem, not worth bundling here.
2. **Nothing forces the testid convention.** Each display hand-writes its
   `data-testid` (`wiggle-display`, `manhattan-gpu`, `pileup-display`,
   `variant-display`, `display-${id}`, `hic_canvas`, `ld_canvas`,
   `variant_canvas`, `variant_matrix_canvas`). They're load-bearing for tests so
   can't be unified casually — but if you ever do a testid pass, DisplayChrome is
   the place to generate them.

## Gotchas confirmed during the work

- `observer(DisplayChromeInner)` preserves the generic `<B>` signature in this
  toolchain — no cast needed (eslint flagged the cast as unnecessary).
- DisplayChrome needs nothing from the containing view; the render-error overlay
  defaults width to `100%`, so it reads only `model.height`. No `getContainingView`,
  no cast.
- The variant displays' hand-written model interfaces
  (`VariantDisplayModelBase`, etc.) had drifted from the real MST types — the old
  `DisplayMessageComponent: ComponentType<any>` indirection hid it. They now use
  the real `Instance<...>` model types; `cellData` is a `mode`-discriminated
  union, narrow via `cellData.mode === 'matrix' | 'regular'`.
