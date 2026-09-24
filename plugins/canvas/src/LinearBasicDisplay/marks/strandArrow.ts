import { STEM_LENGTH_PX } from '../passes/shaders/arrow.consts.generated.ts'
import { arrowDraws } from '../passes/shaders/arrow.js.generated.ts'

/**
 * How far past each bp side of a feature its strand arrow paints, in px: only
 * past the 3' end and only where the arrow draws. A flipped region flips the
 * arrow with the axis, so its bp side never changes.
 */
export function strandArrowReachPx(
  strand: number | undefined,
  featureWidthPx: number,
) {
  const reach = strand && arrowDraws(featureWidthPx) ? STEM_LENGTH_PX : 0
  return {
    left: strand === -1 ? reach : 0,
    right: strand === 1 ? reach : 0,
  }
}
