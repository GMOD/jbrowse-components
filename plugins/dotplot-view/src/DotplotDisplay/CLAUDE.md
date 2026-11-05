# DotplotDisplay

- **Change the AA ramp and the quad padding together.** The ramp is `0.5/dpr`
  CSS px and `capsuleCorner` pads the quad by the same amount; a ramp the quad
  doesn't contain crops at 50% alpha. Coverage is analytic, not `fwidth`, which
  overshoots on diagonals. Run `shaders/dotplotCapsulePad.test.ts` after
  touching either half.
- The pick answers **nearest**, measured in px, and its tie-break is the order
  `visibleSegments` offers candidates (later segment first). **Pad a pick
  fixture past Flatbush's `nodeSize`** (`dotplotPickEngine.test.ts` pads to 24);
  one under it can't see an ordering bug.

## Coordinates

- **Project through `dotplotProject.ts`** (`cumBpToPxH`/`V` and back), not a
  hand-written `viewHeight - (…)`: draw and pick must agree to the pixel. Take
  the numbers from `plotTransform`, not `dotplotRenderState`, unless you need
  `alpha`/`lineWidth`.
- **`Math.round` a coordinate read back from a cumBp round trip off `pxToBp`'s
  `offset`, never `coord0`**, which floors to an off-by-one that depends on
  zoom. Test it with a non-zero `offsetPx`.
- **Print every coordinate 1-based.** `coord0` is for arithmetic only.
- **Keep geometry absolute Float64 cumBp**; the Float32 window-relative
  conversion happens at GPU upload only (`reference/BP_PRECISION.md`).
