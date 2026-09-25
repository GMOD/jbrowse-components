import { readIdAt } from '@jbrowse/alignments-core'

import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'

type GapFields = Pick<
  WorkerPileupData,
  'gapPositions' | 'gapTypes' | 'gapReadIndices' | 'readKeys' | 'readIdPrefix'
>

/**
 * The ids of the reads whose skip gap is exactly this junction, across every
 * region of one lane that lies on its refName. A read reaching two regions is
 * named once.
 */
export function junctionSupportingReadIds(
  regions: Iterable<{ refName: string | undefined; data: GapFields }>,
  junction: { refName: string; start: number; end: number },
) {
  const ids = new Set<string>()
  for (const { refName, data } of regions) {
    if (refName !== junction.refName) {
      continue
    }
    const { gapPositions, gapTypes, gapReadIndices } = data
    for (let i = 0; i < gapTypes.length; i++) {
      if (
        gapTypes[i] === GAP_SKIP &&
        gapPositions[i * 2] === junction.start &&
        gapPositions[i * 2 + 1] === junction.end
      ) {
        const id = readIdAt(data, gapReadIndices[i]!)
        if (id !== undefined) {
          ids.add(id)
        }
      }
    }
  }
  return [...ids]
}
