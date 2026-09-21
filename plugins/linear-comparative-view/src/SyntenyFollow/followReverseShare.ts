import { followAxes } from './followAxes.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * The overlap-weighted share of what aligns under the window onto
 * `targetRefName`, the contig the row is placed on, that is reverse-strand;
 * `undefined` when nothing overlaps. Settle-only.
 */
export function followReverseShare({
  data,
  window,
  toMate,
  mateAssembly,
  targetRefName,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  targetRefName: string
}) {
  const {
    refNameIds,
    starts,
    ends,
    otherRefNameIds,
    otherRefNameDict,
    windowRefNameIds,
    mateAssemblyNameIds,
    mateAssemblyId,
  } = followAxes({ data, windows: [window], toMate, mateAssembly })
  const windowRefNameId = windowRefNameIds[0]!
  const targetRefNameId = otherRefNameDict.indexOf(targetRefName)
  let total = 0
  let reverse = 0
  for (let i = 0; i < refNameIds.length; i++) {
    if (
      refNameIds[i] !== windowRefNameId ||
      otherRefNameIds[i] !== targetRefNameId ||
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
