// The faint connector field draws one line per matrix column down to the
// column's genomic position. At a few hundred columns a fixed per-line alpha
// reads as a texture; at the ~13,000 columns an HPRC pangenome VCF puts across
// 1500px the zone rendered as a solid black mass (measured mean grey 25/255)
// that tells the reader nothing.
//
// So per-line alpha is an INK BUDGET: alpha × lines-per-pixel is held roughly
// constant, so the field's total darkness stops growing with the column count.
// Sparse fields clamp to MAX_ALPHA and render exactly as they always did.
//
// INK_PER_PX is calibrated against the rendered band, not derived. A per-line
// compositing model (1 - (1-alpha)^depth) does not describe what the rasterizer
// produces here: the subpaths are near-vertical and antialiased over the zone's
// full height, so a pixel accumulates far more coverage than the
// count-over-width ratio implies, and the implied depth is not even consistent
// between two alpha values on the same figure (4.5 at 0.4, 15 at 0.088). The
// value below puts the HPRC2 band at a legible texture instead; if the geometry
// or stroke width changes, re-measure rather than re-deriving:
//
//   convert static/img/hprc2/mhc_clustered.png -crop 2400x1+0+404 +repage \
//     -format '%[fx:int(255*mean)]' info:
//
// At the value below that row measures ~155, and the individual lines and their
// varying density are visible in the band — a texture, where 0.4 gave ~25 and no
// structure at all. Judge the structure, not just the number.
const INK_PER_PX = 0.17
const MAX_ALPHA = 0.4
// Stroke width the budget above was measured at (the matrix field). A thicker
// line lays down proportionally more ink per crossing, so it is divided back
// out: the LD field's 1px lines would otherwise paint twice the darkness of the
// matrix field's 0.5px lines at the same column density.
const CALIBRATION_STROKE_WIDTH = 0.5

/**
 * Per-line alpha for `count` connector lines of `strokeWidth` spread over
 * `spanPx` horizontal pixels. `spanPx` is the field's own extent (not the view
 * width) so a dense cluster of lines in a narrow band fades like the dense
 * thing it is.
 */
export function connectorLineAlpha(
  count: number,
  spanPx: number,
  strokeWidth: number,
) {
  const inkPerPx =
    (count / Math.max(spanPx, 1)) * (strokeWidth / CALIBRATION_STROKE_WIDTH)
  return inkPerPx > 0 ? Math.min(INK_PER_PX / inkPerPx, MAX_ALPHA) : MAX_ALPHA
}
