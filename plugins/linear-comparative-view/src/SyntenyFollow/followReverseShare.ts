import { followAxes } from './followAxes.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * How much of what aligns under the window is reverse-strand, weighted by
 * overlap: 1 when every ribbon the anchor is showing is inverted, 0 when none
 * is, `undefined` when nothing overlaps at all.
 *
 * Settle-only, where the envelope runs per frame: the orientation it decides
 * is applied once per vote and never re-derived by the frame pass.
 */
export function followReverseShare({
  data,
  window,
  toMate,
  mateAssembly,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
}) {
  const {
    refNameIds,
    starts,
    ends,
    windowRefNameIds,
    mateAssemblyNameIds,
    mateAssemblyId,
  } = followAxes({ data, windows: [window], toMate, mateAssembly })
  const windowRefNameId = windowRefNameIds[0]!
  let total = 0
  let reverse = 0
  for (let i = 0; i < refNameIds.length; i++) {
    if (
      refNameIds[i] !== windowRefNameId ||
      (mateAssemblyId !== undefined &&
        mateAssemblyNameIds[i] !== mateAssemblyId)
    ) {
      continue
    }
    const overlap =
      Math.min(ends[i]!, window.end) - Math.max(starts[i]!, window.start)
    if (overlap > 0) {
      total += overlap
      if (data.strands[i] === -1) {
        reverse += overlap
      }
    }
  }
  return total > 0 ? reverse / total : undefined
}
