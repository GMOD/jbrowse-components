/**
 * The bands a multi-sample variant display stacks above its genotype rows, as
 * one pure function.
 *
 * There are two, and they are independent settings:
 *
 * - the **variant lane**, a `LinearVariantDisplay`-style strip painting each
 *   record at its genomic span, so a genotype matrix can be read against the
 *   variants it genotypes without a second track (`showVariantLane`);
 * - the **connector-line zone**, which ties an index-laid-out matrix column to
 *   its genomic position (`lineZoneHeight`, non-zero only on the matrix
 *   display).
 *
 * The lane is on top, because both bands address the genome the same way and
 * the connector lines end at genomic positions — so the lane sits exactly where
 * those lines point, and the matrix reads as columns → positions → variants.
 *
 * This exists as a function, and not as three getters, for the reason
 * `belowCoverageBandsGeometry` does in `LinearAlignmentsDisplay`: the layout
 * that *reserves* the strip and the painter that *fills* it must not derive it
 * separately. A painter that thinks the band is taller than the layout reserved
 * paints over the first row of the plot, and nothing fails — it just looks
 * wrong, in the direction a screenshot review reads as a rendering bug.
 */
import { LABEL_FONT_SIZE } from '@jbrowse/plugin-canvas'

export interface VariantTopBandsInput {
  /** `showVariantLane`: whether the variant lane is switched on at all. */
  showVariantLane: boolean
  /** `variantLaneHeight`: the lane's configured height, spent only when on. */
  variantLaneHeight: number
  /** `showVariantLaneLabels`: whether the lane reserves room to letter its marks. */
  showVariantLaneLabels: boolean
  /** `lineZoneHeight`: the connector-line zone, 0 on genomic-position displays. */
  lineZoneHeight: number
}

export interface VariantTopBands {
  /** Top of the variant lane. Always 0 — it is the topmost band. */
  laneTop: number
  /** Drawn height of the variant lane; **0 when the lane is off**. */
  laneHeight: number
  /**
   * Height of the marks within the lane. Equals `laneHeight` when nothing is
   * lettered, and is the lane minus the label strip when something is.
   */
  markHeight: number
  /**
   * Baseline-ish top of the label strip inside the lane, or **0 when the lane
   * letters nothing** — which is both "labels are off" and "the lane is too
   * short to letter", since a label strip taller than the marks it annotates is
   * not worth the height it costs the rows.
   */
  labelTop: number
  /** Whether the lane letters its marks at all. `labelTop` is only meaningful when true. */
  labelsFit: boolean
  /** Top of the connector-line zone, i.e. the bottom of the lane. */
  lineZoneTop: number
  /**
   * Where the genotype rows begin, and so what `availableHeight` subtracts from
   * the display height. The sum of every band above.
   */
  bottom: number
}

/**
 * Clamp a drag-resized band height.
 *
 * Every band above the rows is drag-resizable and every one of them clamps the
 * same way, for the same two reasons: the **floor** keeps the resize handle
 * (drawn just inside the band's bottom edge) reachable, so a band dragged shut
 * can always be dragged back open, and the **ceiling** stops a drag from
 * swallowing the plot it sits over — `availableHeight` floors at 0, so an
 * unbounded band takes the rows to zero height rather than to a scrollbar.
 *
 * The bounds differ per band and the rule does not, which is why this is one
 * function taking them rather than one clamp per band re-deriving the reasoning
 * — that is how `clampLineZoneHeight` and the matrix's own bespoke clamp drifted
 * apart before they were unified.
 */
export function clampBandHeight(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

// Floor/ceiling for a dragged lane. The floor is also about where a lane stops
// being able to show a record as more than a hairline.
export const MIN_VARIANT_LANE_HEIGHT = 8
export const MAX_VARIANT_LANE_HEIGHT = 500

/**
 * The `variantLaneHeight` slot's default, stated here so the slot and the
 * menu's "is this the default" / reset both read one number. Sized to hold a
 * readable mark AND a label strip at the shared label font, since labels are on
 * by default — a lane that has to drop its labels at the default height would
 * teach the reader they don't exist.
 */
export const DEFAULT_VARIANT_LANE_HEIGHT = 28

/** Gap between the marks and the text under them. */
export const LABEL_GAP_PX = 2

export function clampVariantLaneHeight(n: number) {
  return clampBandHeight(n, MIN_VARIANT_LANE_HEIGHT, MAX_VARIANT_LANE_HEIGHT)
}

// The shortest a mark can be drawn and still read as a mark rather than as an
// underline for its own text. Below this the lane declines to letter and gives
// the whole band back to the marks — a label strip that leaves 2px of glyph has
// spent the rows' height on text describing something no longer visible.
const MIN_MARK_HEIGHT_WITH_LABELS = 6

export function variantTopBandsGeometry({
  showVariantLane,
  variantLaneHeight,
  showVariantLaneLabels,
  lineZoneHeight,
}: VariantTopBandsInput): VariantTopBands {
  // Off spends nothing rather than spending a clamped minimum: the toggle has
  // to leave the display pixel-identical to what it was before the lane
  // existed, or every committed figure moves by 8px.
  const laneHeight = showVariantLane
    ? clampVariantLaneHeight(variantLaneHeight)
    : 0
  // The label strip is the text plus the gap that keeps it off the marks. Both
  // are plugin-canvas's, because the lane letters with plugin-canvas's font at
  // plugin-canvas's measured widths — reserving a different amount than the
  // text occupies is how a strip clips its own descenders.
  const labelStrip = LABEL_FONT_SIZE + LABEL_GAP_PX
  const labelsFit =
    showVariantLaneLabels &&
    laneHeight - labelStrip >= MIN_MARK_HEIGHT_WITH_LABELS
  const markHeight = labelsFit ? laneHeight - labelStrip : laneHeight
  return {
    laneTop: 0,
    laneHeight,
    markHeight,
    labelTop: labelsFit ? markHeight + LABEL_GAP_PX : 0,
    labelsFit,
    lineZoneTop: laneHeight,
    bottom: laneHeight + lineZoneHeight,
  }
}
