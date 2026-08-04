import type { HicRegion } from './types.ts'

/**
 * Half-open `[first, last+1)` range of bin indices **overlapping** a region.
 *
 * Upstream hic-straw compares bin indices against the raw fractional quotients
 * `start/binsize` and `end/binsize`, which is exact only for the
 * chromosome-aligned queries juicebox issues. JBrowse queries arbitrary
 * viewport blocks, where `start % binsize !== 0` essentially always holds, and
 * the raw quotient then (a) drops the bin straddling the region's start — a
 * missing column at the left edge of every block, jittering as the user pans —
 * while keeping the one straddling the end, and (b) selects *nothing at all*
 * for a region narrower than one bin, which is reachable by locking a coarse
 * binsize while zoomed in.
 *
 * Flooring/ceiling also matches `getNormVectors`, which already builds its
 * vector slice over `[floor(start/binsize), ceil(end/binsize))` — so
 * `rec.bin1 - norm.offset1` indexes exactly the values that were fetched.
 *
 * Lives in its own module because both the record filter (`hicFile`) and the
 * block-number selection (`matrixZoomData`) must agree on the window: widening
 * only one of them still drops records, since a bin can sit in a block the
 * other never asked for.
 */
export function binWindow(region: HicRegion, binsize: number) {
  return [
    Math.floor(region.start / binsize),
    Math.ceil(region.end / binsize),
  ] as const
}
