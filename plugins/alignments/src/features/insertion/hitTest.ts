import { findMarkAt } from '../mark.ts'
import { insertionMark } from './mark.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { InsertionSizeSlot } from './mark.ts'

// Insertions answer in two priority slots — a large insertion's box beats a
// mismatch, a small one's bar loses to it — and `hitTestCigarItem` calls each at
// its own priority. The slot, the sub-range, the tolerance and the two gates are
// the mark's (`insertionMark`); this reads the answer out as the op a person
// sees.
function hitTestInsertion(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  sizes: InsertionSizeSlot,
  featureHeight: number,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const data = resolved.rpcData
  const mark = insertionMark(featureHeight, sizes)
  const i = findMarkAt(mark, data, coords, filterMismatchesByFrequency)
  return i === undefined
    ? undefined
    : {
        type: 'insertion',
        index: i,
        position: mark.startBp(data, i),
        length: data.interbaseLengths[i] ?? 0,
        sequence: data.interbaseSequences[i] || undefined,
      }
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
