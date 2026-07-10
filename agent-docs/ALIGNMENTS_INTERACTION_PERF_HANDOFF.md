# Alignments perceived-slowness — per-frame React/MobX (MEASURED)

Context: the app "feels kinda slow" on alignments even though the GPU draw is
fast, and worse on an unplugged laptop. This is now **measured, not guessed** —
CPU profiles captured during a sustained zoom in `~/src/jb2bench`
(`scripts/interaction-profile.ts`, `results/interaction-cpu.md`). Numbers are the
**Jun-13 build** (stale for exact component attribution; the architectural
finding is stable). Re-run on a fresh build to refine.

## The measured result

Zoom, `chr22_mask:130000-131000` (1kb), `1000x.shortread.bam`, `renderer=webgl`,
~240 rAF-paced frames staying within loaded data (no refetch), CDP CPU throttle:

| CPU | median frame | p99 | dropped (>20ms) |
|---|---:|---:|---:|
| 1× (desktop) | 16.7ms | 17.2ms | 0% (60fps) |
| 4× (laptop) | 32.7ms | 54.6ms | 100% (~30fps) |
| 6× (unplugged) | 45.9ms | 87ms | 100% (~20fps) |

Frame time scales ~linearly with the CPU factor → **the frame is main-thread-JS
bound, not GPU bound** (throttling CPU wouldn't move a GPU-bound frame). At 1×
there is ~50% idle headroom so it looks smooth; any throttle eats the headroom
and drops frames — exactly the "unplugged laptop" symptom.

## Where the per-frame JS goes (resolved via sourcemaps)

After `(program)` (browser style/layout/paint/composite, itself inflated by the
DOM churn) and idle, the JS self-time is spread — no single hot function — across:

- **React reconcile + commit** (react-dom `setValueForStyle`, `completeWork`,
  `updateFromMap`, `renderWithHooks`, `detachDeletedInstance`).
- **CSS-in-JS runtime**: `@emotion/serialize`, `@emotion/hash`,
  `@emotion/styled`, tss-react `fixClassName`
  (`packages/core/src/util/tss-react/cssAndCx.ts:143`) — styled/`makeStyles`
  components re-serialize CSS on each render.
- **DOM churn**: `removeChild`/`appendChild`/`createElement`/`setAttribute`,
  called from react-dom commit internals (not one component) → **many** small
  components re-rendering each frame.
- **MobX** self-time is minor. **`drawArrays` appears once** — GPU is not it.

So it is genuinely death-by-a-thousand-cuts: the overlay + LGV-chrome React tree
re-renders every interaction frame, each render paying Emotion/tss-react styling
and React commit/DOM cost. "Reduce MobX" is misdirected; the levers are **fewer
React renders per frame** and **less CSS-in-JS per render**.

## Fix directions (ranked, from the data)

1. **Stop the React overlays re-rendering every interaction frame.** The GPU
   pileup canvas already avoids this — it repositions via a shader uniform, no
   React render. Bring the sibling React overlays under `PileupBody`
   (`components/PileupComponent.tsx:147` — `SashimiArcsOverlay`,
   `PileupBezierOverlay`, `GroupLabelsOverlay`, `HighlightOverlay`, the coverage/
   insert-size axis hosts, resize handles) under the same discipline: translate
   via a CSS transform driven by `offsetPx` during the gesture, recompute on
   settle (coarse blocks, mirroring `coverageStats`' `coarseDynamicBlocks` at
   `model.ts:985`). This is the biggest lever — it removes the per-frame React
   commit + DOM churn wholesale.
2. **Cut CSS-in-JS from per-frame renders.** Any `makeStyles`/`styled` component
   that re-renders each frame re-runs Emotion serialize/hash + tss-react
   `fixClassName`. Hoist static styles, avoid dynamic style props on per-frame
   components, prefer stable class names / plain style objects.

Note: `VisibleLabelsOverlay` is a **canvas** (draws in a `useEffect`), so it does
NOT contribute DOM churn; `model.visibleLabels` still recomputes on zoom but was
not a top cost at this light locus. Do not over-index on it — the measured cost
is the DOM-based React tree, not the label canvas.

## Also: mousemove re-renders the display subtree

`AlignmentsDisplayComponent` (`components/AlignmentsDisplayComponent.tsx:96`)
`setMouseCoord` on every `onMouseMove` re-runs the top observer; children are
`observer`-memoized so blast radius is mostly the tooltip, but confirm no inline
object/array prop defeats a child's memo. Same class of cost, per-mousemove.

## Validation / next steps

- **Fresh build** to attribute the churn to specific overlays (June source only).
- **Heavier loci** churn more: re-run `interaction-profile.ts` with sashimi /
  linked-read-bezier / grouped / high-coverage cases — expect wider throttled
  gaps as more overlays mount.
- Tool: `scripts/interaction-profile.ts <url> <label> [pan|scroll|zoom|both]`,
  `THROTTLE=n`. Full write-up in `~/src/jb2bench/results/interaction-cpu.md`.

## Ruled out by profiling (don't chase)

- WebGL draw (`drawArrays` negligible), MobX self-time (minor), the worker
  `.get()` dispatch (~1%), frequency `Map` counters (absent), and `_computeTags`
  (already fixed, `b4da28ba7a` 2026-07-02).
- The one-shot `placeRect` main-thread layout freeze (`laidOutByGroup`,
  `model.ts:1131`) is a real but SEPARATE issue (data/sort/resize changes, not
  per-frame); the user is not concerned with it. Deprioritized.

## Landed this session (webgl-poc, scoped commits)

- `df84057d6e` perf(alignments): drop dead `localeCompare` mod sort + memoize
  per-type mod color parse.
- `b9c44d8295` fix(alignments): explicit `HARDCLIP_TYPE` branch in
  `extractCigarFeatures`.
