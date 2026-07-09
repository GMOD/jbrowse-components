# DisplayChrome — the shared display status chrome

"What it is" + the adoption map. For **why the layering stays** (rejected
refactors — don't re-litigate them) see
[ADR-026](architecture-decision-records/adr-026-displaychrome-layering-stays.md);
for the mount/dispose contract see
[ADR-025](architecture-decision-records/adr-025-gpu-canvas-stays-mounted-not-xor-error.md).

## What it is

`DisplayChrome`
(`plugins/linear-genome-view/src/BaseLinearDisplay/components/DisplayChrome.tsx`)
is the single wrapper every **GPU/Canvas2D-backed** LGV display renders. It owns
the render-backend lifecycle *and* all the mutually-exclusive terminal-state UI:

- calls `useRenderingBackend(factory, model)` internally — the backend hook
  lives in exactly one place, so a display can't paint a canvas while skipping a
  terminal state,
- branches on **one** getter, `model.displayPhase`, whose precedence
  (`renderError > tooLarge > error > loading > ready`) is single-sourced in
  `computeDisplayPhase` (`packages/render-core/src/displayPhase.ts`) — not
  re-encoded by `&& !error && !regionTooLarge …` subtraction in each display,
- hands `{ canvasRef, canvas }` to the body via a render-prop child.

`renderError` / `tooLarge` **replace** the subtree (own root → canvas unmounts →
`backend.dispose()`); `error` / `loading` are overlays *over* the still-mounted
canvas. The lifecycle state (`canvasDrawn`, `renderError`,
`currentRenderingBackend`, `renderTick`) lives on `RenderLifecycleMixin`
(`packages/render-core/src/RenderLifecycleMixin.ts`), which every GPU display
composes — plugins never re-declare it.

Every GPU display follows one shape:

```tsx
<DisplayChrome model={model} factory={Renderer} testid="x-display" ...divProps>
  {({ canvasRef, canvas }) => <XBody model={model} canvasRef={canvasRef} .../>}
</DisplayChrome>
```

A thin outer owns the chrome (plus any hook bound to its container ref — maf's
drag-select, alignments' mouse tracking); a **named observer** body owns the
canvas + overlays so observable reads scope to the body, not the chrome.

## Adoption map

**Direct users (12) — render `DisplayChrome` themselves:** canvas
LinearBasicDisplay (via `FeatureComponent`), canvas LinearMultiRowFeatureDisplay,
wiggle, multi-wiggle, gwas manhattan, sequence, maf, alignments, hic, LD,
multi-sample-variant, variant-matrix.

**Reuse one of those components (3):** `LGVSyntenyDisplay` → LinearBasicDisplay's
component; `LinearGCContentDisplay` → wiggle's; `LinearVariantDisplay` →
`BaseLinearDisplayComponent` → `FeatureComponent`. They get the chrome for free.

**SVG exception (2) — arc / paired-arc.** These render **main-thread SVG** (no
worker, no GPU backend, all features in one array), so they can't wrap
`DisplayChrome` (which owns the backend hook). Instead they **share the concept
without the backend**: `plugins/arc/src/shared/BaseDisplayComponent.tsx` calls
the same `computeDisplayPhase` (with `renderError: undefined`) and renders the
same shared banners (`DisplayErrorBar`, `DisplayLoadingOverlay`, `TooLargeMessage`)
— so the precedence and the visuals stay single-sourced, only the container +
readiness flag (`svgReady`, not `canvasDrawn`) are arc-local. See
`plugins/arc/CLAUDE.md`. Note arc's fetch autorun is `error`-gated, so its
`reload()` clears `error` to re-fire it — without that override the shared error
bar's retry would be dead.

**Not on DisplayChrome, by design (non-LGV views).** Two distinct reasons — don't
conflate them:

- **GPU, drop to the `useRenderingBackend` primitive directly:** `dotplot-view`
  and `linear-comparative-view` (synteny). Non-LGV view types with no
  `ChromeModel` contract (`displayPhase` / `regionTooLarge` / `height`), so the
  chrome doesn't fit. This is the sanctioned drop-to-primitive path, not partial
  adoption — don't force them onto DisplayChrome.
- **Main-thread SVG, own radial banners:** `circular-view` (ChordVariant) is not
  a GPU display at all — it has no `useRenderingBackend` / `RenderLifecycleMixin`
  / `canvasDrawn`. It renders SVG chords (`SVChordsReactComponent`), gating on
  `display.features` / `display.error` with a plain ternary, and keeps its own
  `Loading` (radial spinner) / `DisplayError` (chord-circle text) components
  because the rectangular LGV banners (`BlockMsg`, "Force load", "Zoom in to see
  features") don't fit a radial view. This is the key contrast with arc: arc is
  an *LGV* SVG display so it reuses the LGV banners (see the SVG exception above);
  circular's different visual medium is why it legitimately doesn't.

## First-paint `-done` testid

The readiness gate is `canvasDrawn` (GPU) / `svgReady` (arc), expressed once.
DisplayChrome takes a `testid` **base** and appends `-done` on `canvasDrawn`, so
consumers never hand-write the ternary. Two other emitters coexist **by design**
(ADR-026 "distinct roles, not drift"): the generic `display-${id}-done` from the
`BaseLinearDisplay.tsx` wrapper (Pattern-A displays: canvas-basic, LinearVariant),
and the standalone `synteny_canvas_done` / `dotplot_webgl_canvas_done` on the
non-LGV views. Displays that pixel-match the canvas give the inner `<canvas>` a
**static** selector (`hic_canvas`, `ld_canvas`, `variant_canvas`,
`variant_matrix_canvas`) as a query target — tests wait on `${base}-done`, then
read the static selector.

## Load-bearing gotchas

Two JSX-shape rules keep the terminal-state banners committing under React 19 +
mobx-react + jsdom (both also restated in the `DisplayChrome.tsx` comment block,
guarded by `DisplayChrome.test.tsx`):

- terminal states are literal **early-`return`s**, not ternary branches;
- `displayPhase`'s loading term is a **thunk**, evaluated only after the terminal
  flags are ruled out.

The full "why" (the React-commit repro, sub-rules 1a/1b, and the GPU-dispose
reason) lives in ARCHITECTURE.md §"Terminal states early-return their own root"
— don't duplicate it here.
