/**
 * The Hi-C view transform, forward and inverse, in one place.
 *
 * The forward map is `hic.slang`'s `vs_main`, which the Canvas2D path
 * implements as coordinates pre-multiplied by the uniform `viewScale` (which
 * commutes with rotation, and must stay out of the ctx matrix — SvgCanvas
 * rounds serialized transforms to 2 decimals, and 1/bpPerPx is under 0.005 past
 * ~200 bp/px, so the export rounds the whole triangle to zero)
 * under a `ctx.translate/scale(1, yScalar)/rotate` stack the SVG export
 * inherits through `SvgCanvas`'s CTM: rotate the bin into the triangle
 * **first**, then apply the fit-to-height squash. That order is load-bearing —
 * a squashed triangle's bins are parallelograms, not rectangles, because the
 * y-only scale lands after the rotation.
 *
 * The inverse is what turns a mouse position into a contact bin. It was four
 * lines inlined in `model.hitTest` whose only tie to the forward map was a
 * comment saying it was the inverse of it, and nothing checked the claim:
 * `svgExportGeometry.test.ts` pinned the SVG export against a *private* copy of
 * the forward map, and `contactLookup.test.ts` starts from data-space
 * coordinates, i.e. takes the inverse's output on faith. A dropped `yScalar` or
 * a flipped sign here reports the wrong bin in every tooltip, on a display where
 * "the wrong bin" is a plausible-looking locus rather than a visible break.
 *
 * Pairing them makes the derivation checkable by eye and the round trip testable
 * (`hicTransform.test.ts`). Both are deliberately kept out of `drawHicBlocks`'
 * per-contact cull, which spells the same arithmetic out inline: that loop runs
 * over 300k–4.5M contacts a frame and cannot afford the call.
 */
export interface HicViewTransform {
  /** viewport px per pre-rotation data unit */
  viewScale: number
  /** left edge of the drawn matrix, in canvas px */
  viewOffsetX: number
  /** fit-to-height squash, applied after the rotation */
  yScalar: number
}

/**
 * Pre-rotation data space (the space `positions[]` live in) → canvas px.
 */
export function hicDataToScreen(
  ux: number,
  uy: number,
  { viewScale, viewOffsetX, yScalar }: HicViewTransform,
) {
  const rx = (ux + uy) * Math.SQRT1_2
  const ry = (uy - ux) * Math.SQRT1_2
  return {
    x: rx * viewScale + viewOffsetX,
    y: ry * viewScale * yScalar,
  }
}

/**
 * Canvas px → pre-rotation data space. The exact inverse of `hicDataToScreen`.
 */
export function hicScreenToData(
  x: number,
  y: number,
  { viewScale, viewOffsetX, yScalar }: HicViewTransform,
) {
  const rx = (x - viewOffsetX) / viewScale
  const ry = y / viewScale / yScalar
  return {
    ux: (rx - ry) * Math.SQRT1_2,
    uy: (rx + ry) * Math.SQRT1_2,
  }
}
