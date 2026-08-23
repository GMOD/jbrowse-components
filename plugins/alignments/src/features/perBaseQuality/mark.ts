import type { PileupMark } from '../mark.ts'
import type { PerBaseQualityUploadData } from './types.ts'

// One aligned base, coloured by its Phred score: a `cell` mark on one pileup
// row, drawn for every visible base of every read when `colorBy` is
// per-base-quality. Same pivot as `MISMATCH_MARK` and the same reason for it —
// `makeCellLeftMapper` matches the shader's snapped left edge — with the seam
// fudge on, because this layer paints an unbroken wall.
export const PER_BASE_QUALITY_MARK: PileupMark<PerBaseQualityUploadData> = {
  shape: 'cell',
  rows: data => data.perBaseQualYs,
  startBp: (data, i) => data.perBaseQualPositions[i]!,
  endBp: (data, i) => data.perBaseQualPositions[i]! + 1,
  selects: () => true,
  // Opaque, always, on both backends: `packedColorQuad.slang` has no fade of any
  // kind and the ramp packs alpha 255 into every entry. The score is carried in
  // the COLOUR, not in the alpha — a low-quality base goes red rather than
  // faint, which is the whole point of the ramp.
  alpha: () => 1,
  // Nothing hit-tests these cells: they cover the read body, and
  // `hitTestFeature` answers the read underneath them. Stated rather than
  // omitted so that a later hit test has to say what it means by significant.
  hittable: () => true,
  canvas2d: {
    // A wall of abutting cells — one per aligned base of every read — so it
    // takes the half-pixel seam fudge that closes Canvas2D's AA hairlines. The
    // GPU tiles pixel-snapped quads and needs none.
    contiguous: true,
    bandTop: (_data, _i, rowY) => rowY,
    bandHeight: (_data, _i, featureHeight) => featureHeight,
  },
}
