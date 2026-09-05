import { Band, Fade, Hit, InsertionSlot, Point } from '../mark.ts'

import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PileupMark } from '../mark.ts'

export type InsertionSizeSlot =
  (typeof InsertionSlot)[keyof typeof InsertionSlot]

/**
 * One insertion: a marker centred on the bp edge it sits between, on one pileup
 * row. The first `point` mark.
 *
 * `featureHeight` is the marker's drawn height and belongs to the mark rather
 * than to the frame, because both consumers that need the width have it and
 * neither can be handed it later: `insertionBarWidth` gates the wide count-label
 * box on the row being tall enough to draw a count in, so a compact pileup's hit
 * target has to narrow with its ink.
 */
export function insertionMark(
  featureHeight: number,
  slot: InsertionSizeSlot,
): PileupMark<InterbaseUploadData> {
  return {
    shape: 'point',
    // The worker lays the merged interbase array out as
    // (insertions, softclips, hardclips), so the insertions are its prefix. The
    // bound is what lets a per-entry type test go: this and the two clip marks
    // each used to walk the whole array, so one hover scanned it three times
    // over to reject most of it on a byte the layout already guarantees.
    channels: data => ({
      positions: data.interbasePositions,
      stride: 1,
      rows: data.interbaseYs,
      start: 0,
      end: data.numInsertions,
      kinds: undefined,
      kind: 0,
      freqs: data.interbaseFrequencies,
      quals: undefined,
      lengths: data.interbaseLengths,
    }),
    fade: Fade.insertion,
    hit: Hit.insertion,
    band: Band.row,
    // A marker is sparse and stands over a read body; nothing abuts it.
    contiguous: false,
    point: { rule: Point.insertionBar, barHeight: featureHeight, slot },
  }
}

// The packer's mark. Its height is inert here — the packer reads the arrays and
// the range, and insertion.slang sizes its own quad from `length` and the
// row-height uniform (adr-051), so no width crosses into the buffer.
export const INSERTION_PACK_MARK = insertionMark(0, InsertionSlot.all)
