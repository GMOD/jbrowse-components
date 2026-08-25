/**
 * Zoom at which a per-base pass stops visiting every base and starts
 * decimating. Below it a base is still wide enough that dropping any would be
 * visible; at or above it the first bin is 2bp wide, so nothing that survived
 * the sub-pixel race is lost.
 */
export const MIN_BINNED_BP_PER_PX = 4

/**
 * Genomic bp one emitted cell stands for, for a pass that would otherwise emit
 * one mark per aligned base — MAF's GPU encoder (`encodeBinBp`) and the
 * alignments worker's per-base-letter / per-base-quality extracts.
 *
 * `binBp <= bpPerPx / 2` keeps a window under half a CSS pixel at every tier.
 * That bound is what lets the surviving marks still tile an unbroken wall: both
 * displays floor a cell to 1 CSS px (`pileupCellX`, `pileupCellWidth`), so
 * samples half a pixel apart overlap rather than stripe.
 *
 * Quantized to a power of two, and read off the DEBOUNCED `coarseBpPerPx` by
 * both callers: unquantized, MAF re-encodes every region on every wheel tick
 * and alignments refetches one, and a bin that stays put across a zoom nudge
 * keeps the picture stable.
 *
 * Sampling rather than aggregating is deliberate — every base skipped here had
 * already lost the sub-pixel race for its pixel, so the survivor was arbitrary
 * either way and the window's first base keeps that unbiased, where an "any
 * mismatch wins" rule would paint most windows as mismatches on a divergent
 * alignment. That reasoning does NOT carry to anything painting a MEAN over the
 * bases under a pixel (an identity plot, a conservation band, a coverage
 * depth): a mean needs its whole sample, and at 333bp/px this picks a 128bp
 * window, which would average about 2.6 bases per pixel instead of 333 and turn
 * a smooth ramp into noise.
 */
export function subPixelBinBp(bpPerPx: number) {
  return bpPerPx >= MIN_BINNED_BP_PER_PX
    ? 2 ** Math.floor(Math.log2(bpPerPx / 2))
    : 1
}
