// The faint connector field draws one line per matrix column down to the
// column's genomic position. At a few hundred columns a fixed per-line alpha
// reads as a texture; at the ~13,000 columns an HPRC pangenome VCF (or all of
// chr1 of an SV callset) puts across 1500px, a fixed alpha stacks into a solid
// mass that tells the reader nothing.
//
// So per-line alpha is an INK BUDGET: alpha × lines-per-pixel is held roughly
// constant, so the field's total darkness stops growing with the column count.
// Sparse fields clamp to MAX_ALPHA and render exactly as they always did.
//
// INK_PER_PX is a judgement about how dark the band should read, made on the
// picture rather than derived. Each line composites separately
// (`drawConnectorField` strokes them one at a time, and see the note there about
// what happens when they don't), so alpha × depth is the ink a pixel receives
// and the budget holds that constant. At the value below, the 12,530-column
// hg38 chr1 HGSVC band measures ~191 mean grey with a 103 minimum: the fan's
// bundles, the density falling off down the zone and the centromere gap are all
// visible. 0.5 puts a saturated black wedge where the lines converge, 0.17 is
// legible but washed out. Judge the structure, not just the number.
const INK_PER_PX = 0.25
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
