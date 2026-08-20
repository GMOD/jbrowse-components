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
import { boundBandHeight } from '@jbrowse/core/util/bandHeight'
import {
  LABEL_FONT_SIZE,
  modeCanShowDescription,
  modeCanShowName,
} from '@jbrowse/plugin-canvas'

import type { ShowLabelsMode } from '@jbrowse/plugin-canvas'

export interface VariantTopBandsInput {
  /** `showVariantLane`: whether the variant lane is switched on at all. */
  showVariantLane: boolean
  /** `variantLaneHeight`: the lane's configured height, spent only when on. */
  variantLaneHeight: number
  /**
   * `variantLaneLabels`: plugin-canvas's label-content enum. The lane reserves
   * one text line per kind the mode admits — a name over a description, the
   * same stacking order and the same two colors `resolveFeatureLabels` gives
   * them.
   */
  variantLaneLabels: ShowLabelsMode
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
   * Top of the label strip inside the lane, or **0 when the lane letters
   * nothing** — which is both "labels are off" and "the lane is too short to
   * letter", since a label strip taller than the marks it annotates is not
   * worth the height it costs the rows.
   */
  labelTop: number
  /** Whether a record's name is drawn, at `labelTop`. */
  showName: boolean
  /**
   * Whether a record's description is drawn, one line below the name when both
   * are on and at `labelTop` when it is alone. Same order plugin-canvas stacks
   * them in.
   */
  showDescription: boolean
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

// Floor/ceiling for a resized lane, and the ceiling is also the size menu's —
// the menu is the only way to set this, so a slider that stopped short of the
// clamp would be two different answers to "how tall can it get". 120 is roughly
// three times what the lane needs at its default (a 14px mark over two lines of
// text); past that it is spending the rows' height on empty band. The floor is
// where a record stops reading as more than a hairline.
export const MIN_VARIANT_LANE_HEIGHT = 8
export const MAX_VARIANT_LANE_HEIGHT = 120

/**
 * The `variantLaneHeight` slot's default, stated here so the slot and the
 * menu's "is this the default" / reset both read one number. Sized to hold a
 * readable mark AND both label lines at the shared label font, since the
 * default mode admits both — a lane that had to drop a line at its own default
 * would teach the reader that line does not exist. 40 = 14px mark + 2 x 11px
 * text + the 2px gap above them + the 2px descender allowance below.
 */
export const DEFAULT_VARIANT_LANE_HEIGHT = 40

/**
 * Vertical gap between the marks and the text under them. Not the *horizontal*
 * one between two adjacent labels — that is plugin-canvas's `LABEL_PADDING_PX`,
 * which is sized to absorb measureText's disagreement with the rendered font and
 * is what `drawVariantLane`'s collision cull clears by.
 */
const LABEL_GAP_PX = 2

/**
 * What the *last* text line needs below its line box, so its descenders land
 * inside the lane instead of against the canvas edge.
 *
 * A label's line box is `LABEL_FONT_SIZE` tall and its baseline sits
 * `LABEL_BASELINE_RATIO` (0.84) of the way down it — plugin-canvas's number, for
 * the faces in play. The descender then runs to `0.84 + 0.244 = 1.084` of the
 * box for Roboto, the deepest of them: ~0.9px past the bottom at 11px. Earlier
 * lines are fine, because the next line's own box absorbs it (which is why this
 * is added once, not per line); the last line has only the canvas edge, and was
 * having the tails of `g`, `p`, `y` sliced off — visible on the ID line of every
 * lettered mark whose ID carries one.
 *
 * 2 rather than 1: a whole pixel of margin over the ~0.9 the documented faces
 * want, so a slightly deeper descender does not quietly bring the clip back.
 */
const LABEL_DESCENDER_PX = 2

/**
 * The label-mode radio rows, wording the five shared modes for a lane. The
 * values are plugin-canvas's enum; only the prose is ours, because "auto" means
 * something narrower here — the lane has no density thresholds, so what adapts
 * is its collision cull.
 */
export const VARIANT_LANE_LABEL_OPTIONS = [
  {
    value: 'auto' as const,
    label: 'Auto',
    helpText:
      'Draw the ID and the description wherever they clear the previous mark’s text',
  },
  {
    value: 'nameAndDescription' as const,
    label: 'ID and description',
  },
  { value: 'name' as const, label: 'ID only' },
  { value: 'description' as const, label: 'Description only' },
  { value: 'none' as const, label: 'None' },
]

export const VARIANT_LANE_BOUNDS = {
  min: MIN_VARIANT_LANE_HEIGHT,
  max: MAX_VARIANT_LANE_HEIGHT,
}

/**
 * The lane height as *stated* — by config, by the size menu, or by this file's
 * own geometry read below. The drag-resize twin is `clampBandHeight` in the
 * setter, which additionally leaves a config-declared sub-floor lane where it
 * is; see `@jbrowse/core/util/bandHeight`.
 */
function boundVariantLaneHeight(n: number) {
  return boundBandHeight(n, VARIANT_LANE_BOUNDS)
}

// The shortest a mark can be drawn and still read as a mark rather than as an
// underline for its own text. Below this the lane declines to letter and gives
// the whole band back to the marks — a label strip that leaves 2px of glyph has
// spent the rows' height on text describing something no longer visible.
const MIN_MARK_HEIGHT_WITH_LABELS = 6

export function variantTopBandsGeometry({
  showVariantLane,
  variantLaneHeight,
  variantLaneLabels,
  lineZoneHeight,
}: VariantTopBandsInput): VariantTopBands {
  // Off spends nothing rather than spending a clamped minimum: the toggle has
  // to leave the display pixel-identical to what it was before the lane
  // existed, or every committed figure moves by 8px.
  const laneHeight = showVariantLane
    ? boundVariantLaneHeight(variantLaneHeight)
    : 0
  // One text line per kind the mode admits, plus the gap above the first and
  // the descender allowance below the last. The font and both spacings are
  // plugin-canvas's, because the lane letters with plugin-canvas's font at
  // plugin-canvas's measured widths — reserving a different amount than the
  // text occupies is how a strip clips its own descenders, which is exactly
  // what `LABEL_DESCENDER_PX` was added to stop.
  const wantsName = modeCanShowName(variantLaneLabels)
  const wantsDescription = modeCanShowDescription(variantLaneLabels)
  const lines = (wantsName ? 1 : 0) + (wantsDescription ? 1 : 0)
  const stripFor = (n: number) =>
    n ? n * LABEL_FONT_SIZE + LABEL_GAP_PX + LABEL_DESCENDER_PX : 0
  const labelStrip = stripFor(lines)
  // Both kinds or neither: a lane tall enough for one line but not two draws
  // the name and drops the description rather than refusing to letter, since
  // the name is the one plugin-canvas drops last.
  const roomForBoth =
    laneHeight - labelStrip >= MIN_MARK_HEIGHT_WITH_LABELS && lines > 0
  const roomForOne = laneHeight - stripFor(1) >= MIN_MARK_HEIGHT_WITH_LABELS
  const drawnLines = roomForBoth ? lines : roomForOne && lines ? 1 : 0
  // With room for one line and both kinds asked for, the name wins — except
  // where the mode asked for a description alone, which then IS the one line.
  const showName = drawnLines > 0 && wantsName
  const showDescription =
    drawnLines === 2 || (drawnLines === 1 && wantsDescription && !wantsName)
  const strip = stripFor(drawnLines)
  const markHeight = laneHeight - strip
  return {
    laneTop: 0,
    laneHeight,
    markHeight,
    labelTop: drawnLines ? markHeight + LABEL_GAP_PX : 0,
    showName,
    showDescription,
    labelsFit: drawnLines > 0,
    lineZoneTop: laneHeight,
    bottom: laneHeight + lineZoneHeight,
  }
}
