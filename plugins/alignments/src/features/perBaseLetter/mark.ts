import type { PileupMark } from '../mark.ts'
import type { PerBaseLetterUploadData } from './types.ts'

// Every aligned base in its nucleotide colour: a `cell` mark on one pileup row,
// drawn for each visible base of each read when `colorBy` is per-base lettering.
// Per-base lettering IS "draw every aligned base like a mismatch base", which is
// why it shares mismatch.slang — and why this mark is `MISMATCH_MARK`'s shape
// with the wall's seam fudge and neither of its two fades.
export const PER_BASE_LETTER_MARK: PileupMark<PerBaseLetterUploadData> = {
  shape: 'cell',
  rows: data => data.perBaseLetterYs,
  startBp: (data, i) => data.perBaseLetterPositions[i]!,
  endBp: (data, i) => data.perBaseLetterPositions[i]! + 1,
  selects: () => true,
  // Opaque, always. There is no frequency here — every covered base is drawn,
  // which is the mode — and no quality either, so neither of the shared
  // shader's fades has an input. Both are the PACKER's job to neutralize, since
  // the shader applies them to whatever the instance carries: full frequency,
  // and the no-quality sentinel rather than a Phred 0 that means the worst score
  // in the file. See `packPerBaseLetter`.
  alpha: () => 1,
  // Nothing hit-tests these cells: they cover the read body, and
  // `hitTestFeature` answers the read underneath them.
  hittable: () => true,
  canvas2d: {
    // An unbroken wall of abutting cells, so it takes the half-pixel seam fudge
    // that closes Canvas2D's AA hairlines. The GPU tiles pixel-snapped quads
    // and needs none.
    contiguous: true,
    bandTop: (_data, _i, rowY) => rowY,
    bandHeight: (_data, _i, featureHeight) => featureHeight,
  },
}
