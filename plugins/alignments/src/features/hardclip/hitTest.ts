import { INTERBASE_HARDCLIP } from '../../shared/types.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

export function hitTestHardclip(
  resolved: ResolvedBlock,
  coords: CigarCoords,
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const { interbasePositions, interbaseYs, interbaseLengths, interbaseTypes } =
    resolved.rpcData
  const numInterbases = interbasePositions.length
  const hitToleranceBp = Math.max(0.5, bpPerPx * 3)

  for (let i = 0; i < numInterbases; i++) {
    if (interbaseTypes[i] !== INTERBASE_HARDCLIP || interbaseYs[i] !== row) {
      continue
    }
    const pos = interbasePositions[i]
    const len = interbaseLengths[i]
    if (
      pos !== undefined &&
      len !== undefined &&
      Math.abs(genomicPos - pos) < hitToleranceBp
    ) {
      return {
        type: 'hardclip',
        index: i,
        position: pos,
        length: len,
      }
    }
  }
  return undefined
}
