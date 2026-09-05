import { Band, Fade, Hit } from '../mark.ts'

import type { PileupMark } from '../mark.ts'
import type { PerBaseQualityUploadData } from './types.ts'

// One aligned base, coloured by its Phred score: a `cell` mark on one pileup
// row, drawn for every visible base of every read when `colorBy` is
// per-base-quality. Same pivot as `MISMATCH_MARK` and the same reason for it,
// with the seam fudge on, because this layer paints an unbroken wall.
//
// Opaque on both backends: `packedColorQuad.slang` has no fade of any kind and
// the ramp packs alpha 255 into every entry. The score is carried in the COLOUR,
// not in the alpha — a low-quality base goes red rather than faint, which is the
// whole point of the ramp.
//
// Nothing hit-tests these cells: they cover the read body, and `hitTestFeature`
// answers the read underneath them. `Hit.always` is stated rather than omitted
// so that a later hit test has to say what it means by significant.
export const PER_BASE_QUALITY_MARK: PileupMark<PerBaseQualityUploadData> = {
  shape: 'cell',
  channels: data => ({
    positions: data.perBaseQualPositions,
    stride: 1,
    rows: data.perBaseQualYs,
    start: 0,
    end: data.perBaseQualYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
  }),
  fade: Fade.opaque,
  hit: Hit.always,
  band: Band.row,
  contiguous: true,
}
