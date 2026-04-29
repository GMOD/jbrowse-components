import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import type {
  CigarCoords,
  ResolvedBlock,
} from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

export interface ModificationHitResult {
  position: number
  modType: string | undefined
  probability: number
  color: string
}

export function hitTestModification(
  resolved: ResolvedBlock | undefined,
  coords: CigarCoords | undefined,
  featureHeightSetting: number,
): ModificationHitResult | undefined {
  if (!resolved || !coords) {
    return undefined
  }
  const { row, yWithinRow, genomicPos, bpPerPx } = coords
  if (yWithinRow > featureHeightSetting || !resolved.rpcData.modFlatbush) {
    return undefined
  }
  const hitToleranceBp = Math.max(0.5, bpPerPx * 2)
  // Mods are stored at integer positions (left edge of base); visual center is
  // at pos+0.5, so shift the query left by 0.5 so the hit peaks at the center.
  const queryCenter = genomicPos - 0.5
  const hits = resolved.rpcData.modFlatbush.search(
    queryCenter - hitToleranceBp,
    row,
    queryCenter + hitToleranceBp,
    row,
  )
  if (hits.length === 0) {
    return undefined
  }
  const idx = hits[0]!
  const {
    modificationPositions,
    modificationColors,
    modificationProbabilities,
    modificationTypeIndices,
    detectedModifications,
  } = resolved.rpcData
  const colorPacked = modificationColors[idx]!
  const typeIdx = modificationTypeIndices?.[idx]
  return {
    position: modificationPositions[idx]!,
    modType: typeIdx !== undefined ? detectedModifications[typeIdx] : undefined,
    probability: (modificationProbabilities?.[idx] ?? 255) / 255,
    color: `rgb(${abgrRed(colorPacked)},${abgrGreen(colorPacked)},${abgrBlue(colorPacked)})`,
  }
}
