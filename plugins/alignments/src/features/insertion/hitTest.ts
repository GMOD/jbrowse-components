import { MIN_VISIBLE_ALPHA, insertionSizeAlpha } from '@jbrowse/alignments-core'

import {
  insertionBarWidth as getInsertionRectWidthPx,
  getInsertionType,
  passesFrequencyGate,
} from '../../LinearAlignmentsDisplay/constants.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'

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
    interbaseSequences,
    interbaseFrequencies,
  } = resolved.rpcData
  // The worker lays the merged interbase array out as
  // (insertions, softclips, hardclips), so the insertions are a prefix — the
  // same slice `packInsertions` uploads. Bounding the scan is what lets the
  // per-entry `interbaseTypes[i] !== INTERBASE_INSERTION` test go: this and
  // `hitTestClip` each walked the whole array, so one hover scanned it three
  // times over (large insertion, small insertion, clip) to reject most of it on
  // a type byte the layout already guarantees.
  const { insEnd } = interbaseRangeEnds(resolved.rpcData)
  const pxPerBp = 1 / bpPerPx

  for (let i = 0; i < insEnd; i++) {
    if (interbaseYs[i] !== row) {
      continue
    }
    const pos = interbasePositions[i]
    if (pos !== undefined) {
      const len = interbaseLengths[i] ?? 0
      // Tracks the size fade the same way the frequency gate below tracks the
      // frequency one: an insertion the renderer has faded out for being
      // unresolvable at this zoom must not intercept clicks either, or a
      // whole-genome view is carpeted in invisible hit targets. Both backends
      // multiply this in (insertion.slang, drawCanvas.ts).
      if (insertionSizeAlpha(len, pxPerBp) <= MIN_VISIBLE_ALPHA) {
        continue
      }
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
