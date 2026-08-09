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
 * config slot's default. 0 means the line never breaks: one connected polyline
 * across every hole, which is how the interpolated line behaved before gap
 * breaking existed.
 *
 * OFF BY DEFAULT, deliberately and after having been on. It shipped at 20 and
 * the calibration behind that number still holds — a hole worth breaking on runs
 * orders of magnitude past the mean, and bbi's reduced zoom levels emit
 * fixed-width bins so the series tiles (measured on volvox_microarray.bw at
 * three zooms: 500 bins, every gap exactly 1.0x the mean, no break at any
 * threshold). What changed is the call about whether a reader wants the break at
 * all: "we added this feature awhile back but i dont think i like it now. might
 * consider going back to not skipping, for both the ld recombination and
 * plugins/wiggle line mode". A broken line reads as missing data whether or not
 * data is missing there, and the chord across a hole is at least continuous with
 * what the neighbouring points say.
 *
 * The mechanism stays, whole, because it is the only way to get the other
 * behavior back: set `maxGapMultiple` on the track, 20 being the calibrated
 * value. Nothing about `gapBreakLimit` itself changes — a caller passing a
 * positive multiple gets exactly what it always got.
 *
 * Not shared with the LD recombination curve, which carries its own constant —
 * see RECOMBINATION_GAP_MULTIPLE there, now 0 for the same reason. The two
 * callers plot different kinds of series (tiled bins vs an irregular point
 * process), so one number serving both meant retuning for one silently retuned
 * the other.
 */
export const DEFAULT_GAP_BREAK_MULTIPLE = 0
