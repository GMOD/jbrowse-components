/**
 * The contact-triangle view transform, forward and inverse, in one place — the
 * rotate-45°-and-squash map both triangle displays (HiC's contact matrix, LD's
 * matrix) draw and hit-test through. It was the same math twice, once per
 * plugin, with LD's copy documenting that a dropped `yScalar` term had already
 * survived its coarse round-trip test once — the exact silent divergence one
 * implementation ends.
 *
 * The forward map is `hic.slang`'s `vs_main`, which the Canvas2D paths
 * implement as coordinates pre-multiplied by the uniform `viewScale` (which
 * commutes with rotation, and must stay out of the ctx matrix — SvgCanvas
 * rounds serialized transforms to 2 decimals, and 1/bpPerPx is under 0.005
 * past ~200 bp/px, so the export rounds the whole triangle to zero) under a
 * `ctx.translate/scale(1, yScalar)/rotate` stack the SVG export inherits
 * through `SvgCanvas`'s CTM: rotate the bin into the triangle **first**, then
 * apply the fit-to-height squash. That order is load-bearing — a squashed
 * triangle's bins are parallelograms, not rectangles, because the y-only scale
 * lands after the rotation.
 *
 * The inverse is what turns a mouse position into a contact cell. A dropped
 * `yScalar` or a flipped sign here reports the wrong bin in every tooltip, on
 * displays where "the wrong bin" is a plausible-looking locus rather than a
 * visible break — and a cell-granular round trip is too coarse to catch it
 * (the error is a fraction of a cell at realistic squashes, verified), so the
 * tests assert coordinates.
 *
 * HiC's per-contact cull (`drawHicBlocks`) deliberately spells the forward
 * arithmetic inline: that loop runs over 300k–4.5M contacts a frame and cannot
 * afford the call.
 */
export interface TriangleTransform {
  /** viewport px per pre-rotation data unit */
  viewScale: number
  /** left edge of the drawn matrix, in canvas px */
  viewOffsetX: number
  /** fit-to-height squash, applied after the rotation */
  yScalar: number
  /**
   * Canvas-px y where the triangle's base sits — LD reserves its connector
   * zone above the matrix, HiC states 0. Required rather than defaulted, so
   * the term a consumer has no use for is a stated 0 and not an omission the
   * inverse silently disagrees with.
   */
  yOffsetPx: number
}

/**
 * Pre-rotation data space (the space instance positions live in) → canvas px.
 */
export function triangleDataToScreen(
  ux: number,
  uy: number,
  { viewScale, viewOffsetX, yScalar, yOffsetPx }: TriangleTransform,
) {
  const rx = (ux + uy) * Math.SQRT1_2
  const ry = (uy - ux) * Math.SQRT1_2
  return {
    x: rx * viewScale + viewOffsetX,
    y: ry * viewScale * yScalar + yOffsetPx,
  }
}

/**
 * Canvas px → pre-rotation data space. The exact inverse of
 * `triangleDataToScreen`: `yScalar` squashes Y, so it divides out before the
 * un-rotation.
 */
export function triangleScreenToData(
  x: number,
  y: number,
  { viewScale, viewOffsetX, yScalar, yOffsetPx }: TriangleTransform,
) {
  const rx = (x - viewOffsetX) / viewScale
  const ry = (y - yOffsetPx) / viewScale / yScalar
  return {
    ux: (rx - ry) * Math.SQRT1_2,
    uy: (rx + ry) * Math.SQRT1_2,
  }
}
