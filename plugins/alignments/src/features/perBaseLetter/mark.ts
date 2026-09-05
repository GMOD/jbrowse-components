import { Band, Fade, Hit } from '../mark.ts'

import type { PileupMark } from '../mark.ts'
import type { PerBaseLetterUploadData } from './types.ts'

// Every aligned base in its nucleotide colour: a `cell` mark on one pileup row,
// drawn for each visible base of each read when `colorBy` is per-base lettering.
// Per-base lettering IS "draw every aligned base like a mismatch base", which is
// why it shares mismatch.slang — and why this mark is `MISMATCH_MARK`'s shape
// with the wall's seam fudge and neither of its two fades.
//
// Opaque, always: there is no frequency here — every covered base is drawn,
// which is the mode — and no quality either, so neither of the shared shader's
// fades has an input. Both are the PACKER's job to neutralize, since the shader
// applies them to whatever the instance carries. See `packPerBaseLetter`.
export const PER_BASE_LETTER_MARK: PileupMark<PerBaseLetterUploadData> = {
  shape: 'cell',
  channels: data => ({
    positions: data.perBaseLetterPositions,
    stride: 1,
    rows: data.perBaseLetterYs,
    start: 0,
    end: data.perBaseLetterYs.length,
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
