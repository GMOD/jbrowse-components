import { followAxes } from './followAxes.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * How much of what aligns under the window ONTO `targetRefName` is
 * reverse-strand, weighted by overlap: 1 when every ribbon placing the row is
 * inverted, 0 when none is, `undefined` when nothing overlaps at all.
 *
 * THE TARGET IS PART OF THE QUESTION, and it is the same insistence
 * `followAxes` makes about the other two scans. A window wider than one
 * alignment reaches several of the mate's contigs and the row is placed on
 * exactly one of them — `followWindowMapping`'s vote — so a share taken across
 * all of them is about a picture the reader is not looking at: a row placed on
 * a contig every block of which is inverted stayed forward because forward
 * blocks to a contig it is NOT on diluted the vote below `NEARLY_ALL`.
 *
 * Settle-only, where the envelope runs per frame: the orientation it decides
 * is applied once per vote and never re-derived by the frame pass.
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
