import type { PileupMark } from '../mark.ts'
import type { SoftclipBasesUploadData } from './types.ts'

// One clipped base of a read's unaligned tail: a `cell` mark on the read's own
// pileup row. Shares mismatch.slang's geometry and colour lookup, so it shares
// `MISMATCH_MARK`'s pivot too — with the wall's seam fudge, because a clipped
// run is contiguous, and with neither of that shader's two fades.
export const SOFTCLIP_BASES_MARK: PileupMark<SoftclipBasesUploadData> = {
  shape: 'cell',
  rows: data => data.softclipBaseYs,
  startBp: (data, i) => data.softclipBasePositions[i]!,
  endBp: (data, i) => data.softclipBasePositions[i]! + 1,
  selects: () => true,
  // Opaque, always: a clipped base has no frequency and no quality, so neither
  // of the shared shader's fades has an input. Both are the PACKER's job to
  // neutralize — see `packSoftclipBases`, where a slot left at the buffer's zero
  // means full-frequency-off and Phred 0 rather than "unset".
  alpha: () => 1,
  // Hittable at every zoom, with no significance gate: nothing fades these, so
  // there is no faded mark to hand back to the read underneath. What the hit
  // ANSWERS with is the read — see `hitTestSoftclipBase`.
  hittable: () => true,
  canvas2d: {
    // A contiguous run of per-base cells, so it takes the half-pixel seam fudge;
    // without it the Canvas2D fallback showed hairline gaps the GPU did not.
    contiguous: true,
    bandTop: (_data, _i, rowY) => rowY,
    bandHeight: (_data, _i, featureHeight) => featureHeight,
  },
}
