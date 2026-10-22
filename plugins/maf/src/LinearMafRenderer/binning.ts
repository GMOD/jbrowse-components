import { DASH } from '@jbrowse/core/util/alignedBytes'

/**
 * The column carrying each genomic offset in a block, which `buildMafChannels`
 * reads to walk genomic offsets in steps of `binBp`: `binBp === 1` visits every
 * base, and a larger step samples each window's first base without walking the
 * columns between. Sampling suits the cells, whose window is under half a CSS
 * pixel, so the surviving base was arbitrary anyway; "any mismatch wins" would
 * paint most windows of a divergent alignment as mismatches. The identity plot
 * and the conservation band bin by `binBp` too but average every base in the
 * window rather than sample one, since a mean needs its whole sample.
 * Reference-gap columns hold no genomic position and are absent.
 */
export function buildColumnForGenomicOffset(
  refSeqBytes: Uint8Array,
): GenomicColumns {
  return new ColumnMapper().build(refSeqBytes)
}

/** `colForGpos[g]` is the column of genomic offset `g`, for `g < refLen`. */
export interface GenomicColumns {
  colForGpos: Uint32Array
  refLen: number
}

/**
 * `buildColumnForGenomicOffset` with one buffer reused across blocks (2.4x
 * over a buffer per block at ce11 26-way's median 7bp block). After a wide
 * block `colForGpos` is longer than `refLen`, which is the bound to walk to.
 */
export class ColumnMapper {
  private colForGpos = new Uint32Array(0)

  build(refSeqBytes: Uint8Array): GenomicColumns {
    if (this.colForGpos.length < refSeqBytes.length) {
      this.colForGpos = new Uint32Array(refSeqBytes.length)
    }
    const colForGpos = this.colForGpos
    let refLen = 0
    for (let col = 0; col < refSeqBytes.length; col++) {
      if (refSeqBytes[col] !== DASH) {
        colForGpos[refLen] = col
        refLen++
      }
    }
    return { colForGpos, refLen }
  }
}
