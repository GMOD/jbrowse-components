# DotplotDisplay

- **The AA ramp and the quad padding are one change.** The ramp is `0.5/dpr` CSS
  px and `capsuleCorner` pads the quad by the same amount; a ramp the quad
  doesn't contain crops at 50% alpha. Coverage is analytic, not `fwidth`, which
  overshoots on diagonals. Run `shaders/dotplotCapsulePad.test.ts` after
  touching either half.
- **The opacity slider is the `alpha` uniform, never baked into packed colors**;
  the Canvas2D path folds it into its `rgba()` string because SvgCanvas lacks
  `globalAlpha`.
- `instanceInterleave.ts` hand-writes its pack loop (`cumBp - base`) and keys
  its recolor cache on `x1`'s identity, since every plot on the page shares the
  mark list.
- **A display getter that reads `this.view` needs an explicit return type**, or
  the view/display mutual reference collapses into TS7023 and implicit-anys
  across the plugin and `products/jbrowse-img`.
- Fixtures come from `testUtils.ts`.

## Hover and pick

- **The hover stores a segment index**, so both `setRpcData` and
  `setInstanceData` must drop it: zoom, `drawCigar` and `minAlignmentLength`
  renumber segments without a refetch.
- Clearing the hover when the plot moves under a still cursor is one reaction
  over `plotTransform` (`setupClearHoverOnPlotMove`), not per-gesture handlers.
- The pick answers **nearest**, measured in px, and its tie-break is the order
  `visibleSegments` offers candidates (later segment first). A fixture under
  Flatbush's `nodeSize` can't see the ordering bug — `dotplotPickEngine.test.ts`
  pads to 24.
- Hover shading is a restroke overlay (`DotplotHoverHighlight`), not a shader
  uniform, and is on-screen only.

## Coordinates

- **Project through `dotplotProject.ts`** (`cumBpToPxH`/`V` and back), never a
  hand-written `viewHeight - (…)`: draw and pick must agree to the pixel. Take
  the numbers from `plotTransform`, not `dotplotRenderState`, unless you need
  `alpha`/`lineWidth`. The scalar-argument shape is measured
  (`benches/cumBpProjection.bench.ts`); don't wrap it in an object or closure.
- **A coordinate read back from a cumBp round trip is `Math.round`ed off
  `pxToBp`'s `offset`, never `coord0`**, which floors to an off-by-one that
  depends on zoom. Test it with a non-zero `offsetPx`.
- **Every printed coordinate is 1-based.** `coord0` is for arithmetic only.
- The tooltip's shape is `comparativeTooltipLines` in synteny-core, shared with
  the synteny view; change it there.
- Geometry stays absolute Float64 cumBp; the Float32 window-relative conversion
  happens at GPU upload only (`reference/BP_PRECISION.md`).
