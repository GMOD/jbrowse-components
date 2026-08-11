import { DASH } from '../util/asciiBytes.ts'

/**
 * The column index carrying each genomic offset in a block, shared by the two
 * base-cell painters (the GPU instance encoder and the Canvas2D fallback).
 *
 * Both painters walk genomic offsets in steps of `binBp` and look the column up
 * here, which is what lets one loop serve both zoom regimes: `binBp === 1`
 * visits every base, and larger steps sample the first base of each window
 * without walking the columns in between (turning a block pass from
 * O(columns x rows) into O(columns + samples x rows)). Built once per block and
 * reused across every row.
 *
 * Sampling rather than aggregating is deliberate. `encodeBinBp` keeps a window
 * under half a CSS pixel, so every column skipped here was already losing the
 * sub-pixel race for its pixel — the surviving cell was arbitrary either way,
 * and taking the window's first base keeps that unbiased. An "any mismatch
 * wins" rule would instead paint most windows as mismatches on a divergent
 * alignment.
 *
 * That reasoning does NOT carry over to the identity plot or the conservation
 * band, so don't reach for `binBp` there. Those paint a *mean* over the bases
 * under a pixel rather than one surviving base, and a mean needs its whole
 * sample: at 333bp/px `encodeBinBp` picks a 128bp window, which would average
 * about 2.6 bases per pixel instead of 333 and turn a smooth ramp into noise.
 * They are made affordable a different way — `IdentityColumns` hoists the
 * row-independent work out of the per-row walk and drops off-block columns
 * (`drawRowIdentity.ts`).
 *
 * Both painters reading this is what keeps them showing the same *data*. It
 * does not make them pixel-identical — they never were, and measurably differ
 * on rect edges and antialiasing at every zoom.
 *
 * Reference-insertion columns (ref `-`) hold no genomic position and are
 * therefore absent, so neither painter needs a skip case; `refLen` is the
 * block's genomic extent. Insertion markers are drawn separately, from
 * positioned overlays.
 */
export function buildColumnForGenomicOffset(
  refSeqBytes: Uint8Array,
): GenomicColumns {
  return new ColumnMapper().build(refSeqBytes)
}

/** What both painters read: `colForGpos[g]` is the column of genomic offset
 *  `g`, for `g < refLen`. The array may be longer than `refLen`. */
export interface GenomicColumns {
  colForGpos: Uint32Array
  refLen: number
}

/**
 * `buildColumnForGenomicOffset` with the buffer reused across blocks.
 *
 * Real MAF is many small blocks — UCSC's ce11 26-way has a median block of 7bp
 * and tens of thousands per buffered region — and both painters build this map
 * once per block, so the standalone spelling allocates one short `Uint32Array`
 * per block per encode and per frame. The buffer only ever grows to the widest
 * block seen, and nothing outlives the block's own row loop, so one instance per
 * pass serves them all. Same shape and the same reason as `IdentityColumns` in
 * `drawRowIdentity.ts`, which measured 2.4x over per-block allocation at that
 * block count.
 *
 * `colForGpos` is therefore longer than `refLen` after a wide block, which is
 * why `refLen` — not the array length — has always been the bound both painters
 * walk to.
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
