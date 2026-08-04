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
 * The default for {@link gapBreakLimit}'s `multiple`. Deliberately loose: bins
 * that tile the genome sit at exactly 1x, and the sporadic non-tiling bins that
 * reduced BigWig data is full of land around 2x, so the threshold has to clear
 * both without needing a per-track knob. What it does catch is the case it is
 * for — an unmappable or unsequenced stretch with no bins at all, which runs
 * orders of magnitude past the mean rather than a couple of multiples.
 */
export const DEFAULT_GAP_BREAK_MULTIPLE = 5
