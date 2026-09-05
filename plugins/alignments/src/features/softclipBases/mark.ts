import { Band, Fade, Hit } from '../mark.ts'

import type { PileupMark } from '../mark.ts'
import type { SoftclipBasesUploadData } from './types.ts'

// One clipped base of a read's unaligned tail: a `cell` mark on the read's own
// pileup row. Shares mismatch.slang's geometry and colour lookup, so it shares
// `MISMATCH_MARK`'s pivot too — with the wall's seam fudge, because a clipped
// run is contiguous, and with neither of that shader's two fades.
//
// A clipped base has no frequency and no quality, so both are the PACKER's job
// to neutralize — see `packSoftclipBases`, where a slot left at the buffer's
// zero means full-frequency-off and Phred 0 rather than "unset". Hittable at
// every zoom with no significance gate: nothing fades these, so there is no
// faded mark to hand back to the read underneath.
export const SOFTCLIP_BASES_MARK: PileupMark<SoftclipBasesUploadData> = {
  shape: 'cell',
  channels: data => ({
    positions: data.softclipBasePositions,
    stride: 1,
    rows: data.softclipBaseYs,
    start: 0,
    end: data.softclipBaseYs.length,
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
