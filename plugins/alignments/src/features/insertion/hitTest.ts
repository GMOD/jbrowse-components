import {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
} from '../../LinearAlignmentsDisplay/constants.ts'
import { INTERBASE_INSERTION } from '../../shared/types.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

// Insertions are hit-tested in two priority slots: large insertions (wide
// boxes) win over mismatches; small insertions (thin bars) lose to them.
// The pipeline calls each at the appropriate priority.
function hitTestInsertion(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  sizeFilter: 'small' | 'large',
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseTypes,
    interbaseSequences,
  } = resolved.rpcData
  const numInterbases = interbasePositions.length
  const pxPerBp = 1 / bpPerPx

  for (let i = 0; i < numInterbases; i++) {
    if (interbaseTypes[i] !== INTERBASE_INSERTION || interbaseYs[i] !== row) {
      continue
    }
    const pos = interbasePositions[i]
    if (pos !== undefined) {
      const len = interbaseLengths[i] ?? 0
      const isSmall = getInsertionType(len, pxPerBp) === 'small'
      if (sizeFilter === 'small' ? isSmall : !isSmall) {
        const rectWidthPx = getInsertionRectWidthPx(len, pxPerBp) + 4
        const rectHalfWidthBp = (rectWidthPx / 2) * bpPerPx
        if (Math.abs(genomicPos - pos) < rectHalfWidthBp) {
          return {
            type: 'insertion',
            index: i,
            position: pos,
            length: len,
            sequence: interbaseSequences[i] || undefined,
          }
        }
      }
    }
  }
  return undefined
}

export function hitTestLargeInsertion(
  resolved: ResolvedBlock,
  coords: CigarCoords,
) {
  return hitTestInsertion(resolved, coords, 'large')
}

export function hitTestSmallInsertion(
  resolved: ResolvedBlock,
  coords: CigarCoords,
) {
  return hitTestInsertion(resolved, coords, 'small')
}
