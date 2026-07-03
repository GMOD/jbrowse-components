import { CIGAR_CLICK_MIN_FREQ } from '../../LinearAlignmentsDisplay/constants.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

export function hitTestMismatch(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { genomicPos, row, bpPerPx } = coords
  const { mismatchPositions, mismatchYs, mismatchBases, mismatchFrequencies } =
    resolved.rpcData
  const numMismatches = mismatchPositions.length
  // 1bp features — floor to the integer base the mouse is over
  const mousePos = Math.floor(genomicPos)

  for (let i = 0; i < numMismatches; i++) {
    if (mismatchYs[i] !== row) {
      continue
    }
    const pos = mismatchPositions[i]
    // Zoomed in (bpPerPx <= 1) every mismatch is clickable. Zoomed out, a
    // low-frequency mismatch is only clickable when frequency filtering is on
    // (which fades it in the draw) — with filtering off it draws fully opaque,
    // so it must stay clickable too. Mirrors drawMismatches' alpha gate.
    if (
      pos !== undefined &&
      mousePos === pos &&
      (bpPerPx <= 1 ||
        !filterMismatchesByFrequency ||
        (mismatchFrequencies[i] ?? 0) >= CIGAR_CLICK_MIN_FREQ)
    ) {
      const baseCode = mismatchBases[i]!
      return {
        type: 'mismatch',
        index: i,
        position: pos,
        base: String.fromCharCode(baseCode),
      }
    }
  }
  return undefined
}
