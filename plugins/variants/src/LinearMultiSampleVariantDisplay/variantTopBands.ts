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

interface VariantTopBandsInput {
  showVariantLane: boolean
  /** The lane's configured height, spent only when the lane is on. */
  variantLaneHeight: number
  variantLaneLabels: VariantLaneLabels
  /** 0 on genomic-position displays. */
  lineZoneHeight: number
}

export interface VariantTopBands {
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
 * `variants.height`'s default, so the slot and the menu's reset read
 * one number. 40px holds the marks, an ID line and a description line.
 */
export const DEFAULT_VARIANT_LANE_HEIGHT = 40

/**
 * The field each label kind reads off a record, empty where `variants.labels`
 * hides it.
 */
export interface VariantLaneLabels {
  name: string
  description: string
}

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
    laneHeight: reserved.lane,
    wantsName: variantLaneLabels.name !== '',
    wantsDescription: variantLaneLabels.description !== '',
    lineZoneTop: top.lineZone,
    bottom,
  }
}
