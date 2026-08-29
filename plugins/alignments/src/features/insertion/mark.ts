import { insertionSizeAlpha } from '@jbrowse/alignments-core'

import {
  LONG_INSERTION_MIN_LENGTH,
  getInsertionType,
  insertionBarWidth,
  passesFrequencyGate,
} from '../../LinearAlignmentsDisplay/constants.ts'
import { frequencyFade } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PointMark } from '../mark.ts'

// Which of the hit test's two priority slots a mark answers for. Insertions are
// tested twice in `hitTestCigarItem` — a large insertion's labelled box wins
// over a mismatch, a small one's thin bar loses to it — so the split is a
// PRIORITY decision, the way gap's is a visibility one. It cannot live in
// `selects`: which slot an insertion falls in depends on the zoom
// (`getInsertionType` takes `pxPerBp`) and `selects` sees only the data, so the
// filter is part of "may this intercept a click" and sits in `hittable`.
export type InsertionSizeSlot = 'all' | 'small' | 'large'

// Pixels of slop either side of the drawn bar. What makes a 1px insertion
// clickable at all, and the reason a point's tolerance is not containment.
const INSERTION_HIT_SLOP_PX = 2

/**
 * One insertion: a marker centred on the bp edge it sits between, on one pileup
 * row. The first `point` mark.
 *
 * `featureHeight` is the marker's drawn height and belongs to the mark rather
 * than to a member, because both consumers that need the width have it and
 * neither can be handed it later: `insertionBarWidth` gates the wide count-label
 * box on the row being tall enough to draw a count in, so a compact pileup's
 * hit target has to narrow with its ink.
 */
export function insertionMark(
  featureHeight: number,
  sizes: InsertionSizeSlot,
): PointMark<InterbaseUploadData> {
  // The width rule, once. `widthPx` draws from it and `hitToleranceBp` measures
  // from it, so the box a person sees and the box they can click are one
  // expression apart rather than two rules.
  const widthPx = (data: InterbaseUploadData, i: number, pxPerBp: number) =>
    insertionBarWidth(data.interbaseLengths[i]!, pxPerBp, featureHeight)
  return {
    shape: 'point',
    rows: data => data.interbaseYs,
    // The worker lays the merged interbase array out as
    // (insertions, softclips, hardclips), so the insertions are its prefix. The
    // bound is what lets the per-entry `interbaseTypes[i] !== INTERBASE_INSERTION`
    // test go: this and the clip marks each used to walk the whole array, so one
    // hover scanned it three times over to reject most of it on a type byte the
    // layout already guarantees.
    rangeEnd: data => data.numInsertions,
    startBp: (data, i) => data.interbasePositions[i]!,
    selects: () => true,
    widthPx,
    // A long insertion draws as a fixed marker and never frequency-fades. It
    // does still fade by size — `insertionSizeAlpha` asks "is this resolvable at
    // this zoom" rather than "is this site rare", and the two multiply. Both are
    // insertion.slang's, imported rather than mirrored.
    alpha: (data, i, state, _widthPx, pxPerBp) => {
      const length = data.interbaseLengths[i]!
      return (
        (length >= LONG_INSERTION_MIN_LENGTH
          ? 1
          : frequencyFade(
              state,
              pxPerBp * pxPerBp,
              data.interbaseFrequencies[i]!,
            )) * insertionSizeAlpha(length, pxPerBp)
      )
    },
    hittable: (data, i, coords, filterByFrequency) => {
      const length = data.interbaseLengths[i]!
      const pxPerBp = 1 / coords.bpPerPx
      // Tracks the size fade the way the frequency gate below tracks the
      // frequency one: an insertion the renderer has faded out for being
      // unresolvable at this zoom must not intercept clicks either, or a
      // whole-genome view is carpeted in invisible hit targets.
      if (insertionSizeAlpha(length, pxPerBp) === 0) {
        return false
      }
      const isSmall = getInsertionType(length, pxPerBp) === 'small'
      if (sizes === 'small' ? !isSmall : sizes === 'large' && isSmall) {
        return false
      }
      // Small insertions are narrow bars; away from base-level zoom only a
      // high-frequency one may intercept a click, so the read body stays easy to
      // click through. Same gate as mismatches, and with filtering off a
      // low-frequency insertion draws opaque and stays clickable. A large
      // insertion is never frequency-gated, matching its `alpha` above.
      return (
        !isSmall ||
        passesFrequencyGate(
          coords.bpPerPx,
          data.interbaseFrequencies[i]!,
          filterByFrequency,
        )
      )
    },
    hitToleranceBp: (data, i, coords) =>
      (widthPx(data, i, 1 / coords.bpPerPx) / 2 + INSERTION_HIT_SLOP_PX) *
      coords.bpPerPx,
    canvas2d: {
      // A marker is sparse and stands over a read body; nothing abuts it.
      contiguous: false,
      bandTop: (_data, _i, rowY) => rowY,
      bandHeight: (_data, _i, featureHeight) => featureHeight,
    },
  }
}

// The packer's mark. Its height is inert here — the packer reads the arrays and
// the range, and insertion.slang sizes its own quad from `length` and the
// row-height uniform (adr-051), so no width crosses into the buffer.
export const INSERTION_PACK_MARK = insertionMark(0, 'all')
