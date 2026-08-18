import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { findTopmostOnRow } from '../../shared/hitTestTypes.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

// `includeDeletions` mirrors the two draw layers this one array feeds: `skip`
// draws unconditionally, `deletion` only under `showMismatches`. An undrawn
// deletion must not be found at all — not merely lose a tie — or it goes on
// intercepting the whole span of a read that paints solid across it, and it
// masks any skip beneath it on the same row.
export function hitTestGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  includeDeletions: boolean,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const { gapPositions, gapYs, gapTypes, gapFrequencies } = resolved.rpcData
  const numGaps = gapPositions.length / 2

  // The significance gate every other mark test applies, on the one gap kind
  // that has a frequency: `deletionStartFrequencies` writes a hardcoded 0 into
  // every SKIP slot, so running this over the whole array would make each
  // intron centerline inert past 1 bp/px while `gap.slang` goes on drawing it.
  // Deletions were the last mark left ungated — `hitTestClip` was fixed for the
  // same reason — so between ~1 and 25 bp/px a deletion the worker had zeroed
  // drew at `widthPx³` (four of 255 alpha at 20 bp/px, invisible) and still
  // intercepted every click across its span.
  //
  // `bpPerPx / length` rather than a bare `bpPerPx` because the "already covers
  // a pixel" half of the gate is per-mark. A deletion HAS a reference span, so
  // its own `widthPx` is what gap.slang squares into the fade, and
  // `bpPerPx / length <= 1` is exactly `widthPx >= 1` — the zoom at which that
  // fade resolves opaque whatever the frequency. A point mark passes `bpPerPx`
  // because its span is one base.
  const deletionIsSignificant = (idx: number, length: number) =>
    passesFrequencyGate(
      length > 0 ? bpPerPx / length : bpPerPx,
      gapFrequencies[idx] ?? 0,
      filterMismatchesByFrequency,
    )

  // Topmost, not first: see `findTopmostOnRow`. On a collapsed group every read
  // sits on row 0, so scanning forwards answered with the deletion of a read
  // painted under the one `hitTestFeature` names alongside it.
  const i = findTopmostOnRow(gapYs, 0, numGaps, row, i => {
    const startPos = gapPositions[i * 2]
    const endPos = gapPositions[i * 2 + 1]
    if (startPos === undefined || endPos === undefined) {
      return false
    }
    if (
      gapTypes[i] !== GAP_SKIP &&
      (!includeDeletions || !deletionIsSignificant(i, endPos - startPos))
    ) {
      return false
    }
    return genomicPos >= startPos && genomicPos < endPos
  })
  if (i === undefined) {
    return undefined
  }
  const startPos = gapPositions[i * 2]!
  return {
    type: gapTypes[i] === GAP_SKIP ? 'skip' : 'deletion',
    index: i,
    position: startPos,
    length: gapPositions[i * 2 + 1]! - startPos,
  }
}
