import { LINK_MAX_REGIONS } from '../shaders/linkMark.consts.generated.ts'

/**
 * One displayed region as a foot places through it: the canvas px of an
 * anchor bp chosen near the view, so a foot's offset from it stays inside
 * float32 on the GPU, and the signed px per bp, negative on a reversed
 * region.
 */
export interface LinkRegion {
  anchorPx: number
  anchorBp: number
  signedPxPerBp: number
  /** The region's screen extent, which a foot stops at; unbounded when absent. */
  leftPx?: number
  rightPx?: number
}

/** Where `bp` on displayed region `index` lands on the canvas, in px. */
export function regionPx(
  regions: readonly LinkRegion[],
  index: number,
  bp: number,
) {
  const r = regions[index]!
  return r.anchorPx + (bp - r.anchorBp) * r.signedPxPerBp
}

/** Displayed region `index` as a far end finds it: none past the shader's table. */
export function linkedRegion(regions: readonly LinkRegion[], index: number) {
  return index < LINK_MAX_REGIONS ? regions[index] : undefined
}
