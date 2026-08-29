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
 *
 * What this file used to also do — split the lane into a mark strip and a label
 * strip, from a font size and a line count — is gone. The lane is laid out by
 * plugin-canvas's packer and compacted by its fit ladder now (`laneFitStage`),
 * so the band's internal geometry is that plugin's answer and this file's job
 * stops at how many pixels the band gets.
 */
import { stackBands } from '@jbrowse/core/util/bandLayout'
import { modeCanShowDescription, modeCanShowName } from '@jbrowse/plugin-canvas'

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
   * Whether the label MODE asks for each record's name / its description.
   *
   * The mode's want, not the band's answer — this file used to compute a label
   * strip, a mark height and a "do the labels fit" from a font size and a line
   * count, because the lane lettered its own marks. It does not any more: the
   * band is laid out by plugin-canvas's packer and fitted by its ladder (see
   * `laneFitStage`), which reserves a label's room per row, drops the
   * description before the name, decimates names that have nowhere to go, and
   * scales what survives to fill the band. That is a strictly better answer to
   * the same question, and it is the answer a `LinearVariantDisplay` gives.
   *
   * So what is left here is what plugin-canvas cannot know: which kinds this
   * display's slot asked for.
   */
  wantsName: boolean
  wantsDescription: boolean
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
// clamp would be two different answers to "how tall can it get". 120 holds
// roughly six labeled rows of the band's compact layout; past that it is
// spending the rows' height on empty band. The floor is where a record stops
// reading as more than a hairline.
export const MIN_VARIANT_LANE_HEIGHT = 8
export const MAX_VARIANT_LANE_HEIGHT = 120

/**
 * The `variantLaneHeight` slot's default, stated here so the slot and the
 * menu's "is this the default" / reset both read one number. 40px is two labeled
 * rows of the band's compact layout, so the default shows both what stacking
 * looks like and both label kinds the default mode admits — a band that could
 * only ever draw one row at its own default would teach the reader that
 * overlapping records do not stack.
 */
export const DEFAULT_VARIANT_LANE_HEIGHT = 40

/**
 * The label-mode radio rows, wording the five shared modes for a lane. The
 * values are plugin-canvas's enum; only the prose is ours, because "auto" means
 * something narrower here — the band cannot grow, so what adapts is how much of
 * each record it spends its height on (see the fit ladder in `laneFitStage`).
 */
export const VARIANT_LANE_LABEL_OPTIONS = [
  {
    value: 'auto' as const,
    label: 'Auto',
    helpText:
      'Draw the ID and the description, dropping the description and then thinning the IDs as the band runs out of room',
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

export function variantTopBandsGeometry({
  showVariantLane,
  variantLaneHeight,
  variantLaneLabels,
  lineZoneHeight,
}: VariantTopBandsInput): VariantTopBands {
  // The fold gives the two contract rules: off spends nothing rather than a
  // clamped minimum (the toggle has to leave the display pixel-identical to
  // what it was before the lane existed, or every committed figure moves by
  // 8px), and the lane's `bounds` bind its *stated* height at read time — the
  // drag-resize twin is `clampBandHeight` in the setter, which additionally
  // leaves a config-declared sub-floor lane where it is. The connector zone
  // carries no bounds and no toggle: its "off" is the slot being 0.
  const { top, reserved, bottom } = stackBands(['lane', 'lineZone'], {
    lane: {
      active: showVariantLane,
      height: variantLaneHeight,
      bounds: VARIANT_LANE_BOUNDS,
    },
    lineZone: { active: true, height: lineZoneHeight },
  })
  return {
    laneTop: top.lane,
    laneHeight: reserved.lane,
    wantsName: modeCanShowName(variantLaneLabels),
    wantsDescription: modeCanShowDescription(variantLaneLabels),
    lineZoneTop: top.lineZone,
    bottom,
  }
}
