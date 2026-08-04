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
 * Default `multiple` for the wiggle interpolated line — the `maxGapMultiple`
 * config slot's default, so a track can override or disable it with 0.
 *
 * Deliberately far out. A hole worth breaking on runs orders of magnitude past
 * the mean, not a couple of multiples, so this only has to sit clear of ordinary
 * spacing variation rather than track it closely. BigWig data makes that easy:
 * bbi's reduced zoom levels emit fixed-width summary bins, so the series tiles.
 * Measured on volvox_microarray.bw over the range its docs figure renders, at
 * three zooms: 500 bins, every gap exactly 1.0x the mean, no break at any
 * threshold. What is left to catch is a stretch bbi emitted no bin for at all
 * (unmappable, uncovered), which is hundreds of times the bin width.
 *
 * Not shared with the LD recombination curve, which calibrates its own — see
 * RECOMBINATION_GAP_MULTIPLE there. The two callers plot different kinds of
 * series (tiled bins vs an irregular point process), so one number serving both
 * meant retuning for one silently retuned the other.
 */
export const DEFAULT_GAP_BREAK_MULTIPLE = 20
