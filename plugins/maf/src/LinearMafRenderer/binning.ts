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
export function buildColumnForGenomicOffset(refSeqBytes: Uint8Array) {
  const colForGpos = new Uint32Array(refSeqBytes.length)
  let refLen = 0
  for (let col = 0; col < refSeqBytes.length; col++) {
    if (refSeqBytes[col] !== DASH) {
      colForGpos[refLen] = col
      refLen++
    }
  }
  return { colForGpos, refLen }
}
