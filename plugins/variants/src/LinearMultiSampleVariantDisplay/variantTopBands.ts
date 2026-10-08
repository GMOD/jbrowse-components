/**
 * The bands a multi-sample variant display stacks above its genotype rows, as
 * one pure function. Two independent settings:
 *
 * - the **variant lane**, a `LinearVariantDisplay`-style strip painting each
 *   record at its genomic span (`showVariantLane`);
 * - the **connector-line zone**, which ties an index-laid-out matrix column to
 *   its genomic position (`lineZoneHeight`, non-zero only on the matrix
 *   display).
 *
 * The lane sits on top, where the connector lines end.
 *
 * A function and not three getters, as `belowCoverageBandsGeometry` in
 * `LinearAlignmentsDisplay`: the layout that reserves a strip and the painter
 * that fills it must not derive it separately, or the painter overdraws the
 * first row and nothing fails. The lane's internal geometry belongs to
 * plugin-canvas (`laneFitStage`); this file only says how many pixels it gets.
 */
import { stackBands } from '@jbrowse/core/util/bandLayout'
import { modeCanShowDescription, modeCanShowName } from '@jbrowse/plugin-canvas'

import type { ShowLabelsMode } from '@jbrowse/plugin-canvas'

interface VariantTopBandsInput {
  showVariantLane: boolean
  /** The lane's configured height, spent only when the lane is on. */
  variantLaneHeight: number
  /** plugin-canvas's label-content enum. */
  variantLaneLabels: ShowLabelsMode
  /** 0 on genomic-position displays. */
  lineZoneHeight: number
}

export interface VariantTopBands {
  /** Always 0: the lane is the topmost band. */
  laneTop: number
  /** **0 when the lane is off**. */
  laneHeight: number
  /**
   * Whether the label mode asks for each record's name / description. The
   * mode's want, not the band's answer: plugin-canvas's fit ladder decides what
   * fits.
   */
  wantsName: boolean
  wantsDescription: boolean
  /** The bottom of the lane. */
  lineZoneTop: number
  /**
   * Where the genotype rows begin: the sum of every band above, which
   * `availableHeight` subtracts from the display height.
   */
  bottom: number
}

// The ceiling is also the size menu's, so the slider, the drag and the clamp
// agree on how tall the lane can get
export const MIN_VARIANT_LANE_HEIGHT = 8
export const MAX_VARIANT_LANE_HEIGHT = 120

/**
 * The `variantLaneHeight` slot's default, so the slot and the menu's reset read
 * one number. 40px is two labeled rows, enough to show stacking and both label
 * kinds the default mode admits.
 */
export const DEFAULT_VARIANT_LANE_HEIGHT = 40

/**
 * The label-mode radio rows. The values are plugin-canvas's enum; the prose is
 * ours because "auto" means something narrower here: the band cannot grow, so
 * what adapts is how much of each record it spends its height on
 * (`laneFitStage`).
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
  // An off lane spends nothing rather than a clamped minimum, and its `bounds`
  // bind the stated height at read time (the drag twin is `clampBandHeight` in
  // the setter). The connector zone has no bounds or toggle: off is height 0.
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
