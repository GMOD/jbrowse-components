import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import { isWithinReadBand } from '../../shared/hitTestTypes.ts'

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
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
): ModificationHitResult | undefined {
  const { row, genomicPos, basePos, bpPerPx } = coords
  if (
    !isWithinReadBand(coords, featureHeight) ||
    !resolved.rpcData.modFlatbush
  ) {
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
  const {
    modificationPositions,
    modificationColors,
    modificationProbabilities,
    modificationTypeIndices,
    modificationNoMod,
    modificationTypes,
  } = resolved.rpcData
  // Nearest to the cursor, NOT `hits[0]`. Flatbush returns its packed
  // (Hilbert-sorted) tree order, which for the collinear points of one row is
  // ascending position — so taking the first hit reported the LEFTMOST
  // candidate in the window, up to `hitToleranceBp + 0.5` bp left of the
  // cursor. The window is ±2bp at 1bp/px and consecutive modified bases on one
  // read are the normal case for 5mC/6mA, so the tooltip and the details widget
  // routinely named a neighbouring base — and disagreed with the `snpBase`
  // annotation, which comes from the mismatch test pinned to the exact cursor
  // base.
  //
  // A cursor on a cell boundary is equidistant from the bases either side, so
  // the tie goes to `basePos` — the base the painter draws under that pixel.
  let idx = hits[0]!
  let bestDist = Infinity
  for (const h of hits) {
    const pos = modificationPositions[h]!
    const dist = Math.abs(pos - queryCenter)
    if (dist < bestDist || (dist === bestDist && pos === basePos)) {
      bestDist = dist
      idx = h
    }
  }
  const colorPacked = modificationColors[idx]!
  const typeIdx = modificationTypeIndices?.[idx]
  return {
    position: modificationPositions[idx]!,
    modType: typeIdx !== undefined ? modificationTypes?.[typeIdx] : undefined,
    noMod: modificationNoMod?.[idx] === 1,
    probability: (modificationProbabilities?.[idx] ?? 255) / 255,
    color: `rgb(${abgrRed(colorPacked)},${abgrGreen(colorPacked)},${abgrBlue(colorPacked)})`,
  }
}
