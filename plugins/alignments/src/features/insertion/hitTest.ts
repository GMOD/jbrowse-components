import {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
  passesFrequencyGate,
} from '../../LinearAlignmentsDisplay/constants.ts'
import { INTERBASE_INSERTION } from '../../shared/types.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

// Insertions are hit-tested in two priority slots: large insertions (wide
// boxes) win over mismatches; small insertions (thin bars) lose to them.
// The pipeline calls each at the appropriate priority.
function hitTestInsertion(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  sizeFilter: 'small' | 'large',
  featureHeight: number,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseTypes,
    interbaseSequences,
    interbaseFrequencies,
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
        // Small insertions are narrow bars; when not at base-level zoom only
        // let high-frequency insertions intercept clicks so the read body
        // remains easy to click through. Same gate as mismatches (drift-proof
        // via passesFrequencyGate) so it tracks the draw fade — with filtering
        // off, low-freq insertions draw opaque and must stay clickable too.
        if (
          sizeFilter === 'small' &&
          !passesFrequencyGate(
            bpPerPx,
            interbaseFrequencies[i] ?? 0,
            filterMismatchesByFrequency,
          )
        ) {
          continue
        }
        const rectWidthPx =
          getInsertionRectWidthPx(len, pxPerBp, featureHeight) + 4
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
  featureHeight: number,
) {
  // Large insertions never frequency-gate, so the flag is inert here.
  return hitTestInsertion(resolved, coords, 'large', featureHeight, true)
}

export function hitTestSmallInsertion(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
  filterMismatchesByFrequency: boolean,
) {
  return hitTestInsertion(
    resolved,
    coords,
    'small',
    featureHeight,
    filterMismatchesByFrequency,
  )
}
