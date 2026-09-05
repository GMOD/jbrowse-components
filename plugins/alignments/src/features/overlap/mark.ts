import { Band, Fade, Hit } from '../mark.ts'

import type { PileupMark } from '../mark.ts'
import type { OverlapsUploadData } from './types.ts'

// One overlap: the interval where two features sharing a row both align, as a
// full-row bar. Twin of overlap.slang, whose `chainMode` branch says what the
// span MEANS in each of the two layouts that put more than one feature on a row
// — and the branch is only the paint, which is why the geometry here has none.
//
// `Fade.overlap` reaches 0 at FADE_LO_PX, which is what makes `paintMarks`'s
// sub-pixel widening unreachable here: a bar narrow enough to be widened has
// already faded out, so this mark's ink stays its true span like the shader's,
// which does not call `expandMinWidthX`.
//
// Nothing hit-tests an overlap. It covers reads, and `hitTestFeature` answers
// with one of them, which is what a person pointing at it means.
export const OVERLAP_MARK: PileupMark<OverlapsUploadData> = {
  shape: 'span',
  channels: data => ({
    // overlapPositions stores [start, end] pairs
    positions: data.overlapPositions,
    stride: 2,
    rows: data.overlapYs,
    start: 0,
    end: data.overlapYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
  }),
  fade: Fade.overlap,
  hit: Hit.always,
  band: Band.row,
  // Overlaps stack on a collapsed row and never abut along one, so no seam.
  contiguous: false,
}
