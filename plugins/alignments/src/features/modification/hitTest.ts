import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

export interface ModificationHitResult {
  position: number
  modType: string | undefined
  // True when this is the no-mod bucket: `probability` is then the confidence
  // the base is UNmodified, not the confidence of `modType`. Name the call via
  // getModificationCallName rather than off modType alone.
  noMod: boolean
  probability: number
  color: string
}

export function hitTestModification(
  resolved: ResolvedBlock | undefined,
  coords: CigarCoords | undefined,
  featureHeight: number,
): ModificationHitResult | undefined {
  if (!resolved || !coords) {
    return undefined
  }
  const { row, yWithinRow, genomicPos, bpPerPx } = coords
  if (yWithinRow > featureHeight || !resolved.rpcData.modFlatbush) {
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
    modificationNoMod,
    detectedModifications,
  } = resolved.rpcData
  const colorPacked = modificationColors[idx]!
  const typeIdx = modificationTypeIndices?.[idx]
  return {
    position: modificationPositions[idx]!,
    modType: typeIdx !== undefined ? detectedModifications[typeIdx] : undefined,
    noMod: modificationNoMod?.[idx] === 1,
    probability: (modificationProbabilities?.[idx] ?? 255) / 255,
    color: `rgb(${abgrRed(colorPacked)},${abgrGreen(colorPacked)},${abgrBlue(colorPacked)})`,
  }
}
