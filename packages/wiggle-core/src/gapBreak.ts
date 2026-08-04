/**
 * #api
 * How far apart two consecutive points of an interpolated (point-to-point) line
 * may be before the span between them counts as a hole rather than a segment to
 * draw. Returns `Infinity` when there is nothing to decide, so a caller can
 * always compare against it unguarded.
 *
 * The limit is a multiple of the series' own *mean* spacing rather than an
 * absolute distance, which is what makes one number work across zoom levels and
 * data types: reduced BigWig bins get wider as you zoom out, so any fixed bp
 * threshold would be either useless at one end or destructive at the other. It
 * also lets the same rule serve a bp axis (wiggle's linecenter) and a px one
 * (the LD recombination curve) — the caller picks the space, this only cares
 * that the units are consistent.
 *
 * Mean, not median: it is O(1) from the endpoints, and it errs the safe way. A
 * series' holes inflate their own mean, which raises the limit and so breaks
 * *less* — a line that stays connected is the status quo, whereas a spuriously
 * broken one destroys data the user can see nowhere else. Sorting for a true
 * median would cost O(n log n) per source per region on the encode path, for a
 * threshold this coarse.
 *
 * `count < 3` returns Infinity: two points have no "typical" spacing to be
 * unusual against, so there is nothing to call a hole.
 */
export function gapBreakLimit({
  first,
  last,
  count,
  multiple,
}: {
  /** position of the first point, in whatever space the caller measures gaps */
  first: number
  /** position of the last point, same space */
  last: number
  /** number of points in the series */
  count: number
  /** how many mean spacings a gap must exceed; <= 0 disables breaking */
  multiple: number
}) {
  if (multiple <= 0 || count < 3) {
    return Number.POSITIVE_INFINITY
  }
  const meanSpacing = (last - first) / (count - 1)
  // A degenerate series (every point at the same position) has no spacing to
  // scale by, and a limit of 0 would break every segment.
  return meanSpacing > 0 ? meanSpacing * multiple : Number.POSITIVE_INFINITY
}

/**
 * #api
 * The default for {@link gapBreakLimit}'s `multiple`. Deliberately far out:
 * a hole worth breaking on runs orders of magnitude past the mean, not a couple
 * of multiples, so the threshold's job is to sit well clear of ordinary spacing
 * variation rather than to track it closely.
 *
 * Calibrated against the LD recombination curve at the LCT locus, which is the
 * least forgiving series either caller has — 1401 MAF-filtered SNPs over 3.1 Mb,
 * spacing that is not uniform but a heavy right tail (median 996 bp against a
 * 2354 bp mean, i.e. dense stretches and sparse ones in the same window, with no
 * bimodal split between "typical" and "hole" to aim at). There:
 *
 *   5x  -> 47 breaks, the curve shatters into dots wherever the local density
 *          runs below the global average — a first guess at this constant, and
 *          plainly wrong once rendered
 *   10x -> 17 breaks, still reads as dashed
 *   20x -> 2 breaks, exactly the two longest bridged spans (73 kb and 67 kb;
 *          the next one down is 44 kb, so this sits in a real gap in the tail
 *          rather than slicing through a run of comparable spans)
 *
 * BigWig bins, the other caller, tile the genome and so sit at 1x with the
 * occasional skipped bin near 2x; 20x clears those with room to spare and still
 * catches an unmappable stretch, which is hundreds of times the bin width. So
 * the loose end of the range serves both, where the tight end served neither.
 */
export const DEFAULT_GAP_BREAK_MULTIPLE = 20
