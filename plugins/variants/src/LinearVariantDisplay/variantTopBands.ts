/**
 * The bands a variant display stacks above its genotype rows, as
 * one pure function:
 *
 * - the **records band**, the VCF's records laid out and stacked as a
 *   `LinearVariantDisplay` lays them out (`records.show`);
 * - the **connector-line zone**, which ties a matrix column to its genomic
 *   position (`lineZoneHeight`, non-zero only in columns).
 *
 * The records sit on top, where the connector lines end. The layout reserving
 * a strip and the painter filling it both read this, or the painter overdraws
 * the first row and nothing fails.
 */
import { boundBandHeight } from '@jbrowse/core/util/bandHeight'
import { stackBands } from '@jbrowse/core/util/bandLayout'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import type { BandBounds } from '@jbrowse/core/util/bandHeight'

/** Where a record stops reading as a mark: the drag floor. */
export const MIN_RECORDS_HEIGHT = 8

/** `records.maxHeight`'s default, the cap on the packed stack. */
export const DEFAULT_RECORDS_MAX_HEIGHT = 170

/**
 * The strip under the records band holding its chips while no genotype row
 * draws: the way back to the rows, and the count of hidden records.
 */
export const BAND_CHIPS_HEIGHT = GROUP_LABEL_HEIGHT + 4

export interface VariantTopBands {
  /** **0 when the band is off**, or holds no record. */
  recordsHeight: number
  lineZoneTop: number
  /**
   * Where the genotype rows begin: the sum of every band above, which
   * `availableHeight` subtracts from the display height.
   */
  bottom: number
}

/**
 * The records band's legal height over rows: the drag floor and no ceiling,
 * since the band is added to the track above the rows rather than taken from
 * them.
 */
export const RECORDS_BAND_BOUNDS: BandBounds = { min: MIN_RECORDS_HEIGHT }

/**
 * The records band over genotype rows: its packed stack at full feature
 * size, up to `records.maxHeight`. Past the cap the fit ladder drops labels
 * and the rows that still do not fit hide.
 */
export function recordsBandHeightOverRows({
  recordsMaxHeight,
  recordsContentHeight,
}: {
  recordsMaxHeight: number
  /** The `full` rung's stack height, labels included. */
  recordsContentHeight: number
}) {
  return Math.min(
    boundBandHeight(recordsMaxHeight, RECORDS_BAND_BOUNDS),
    Math.ceil(recordsContentHeight),
  )
}

/**
 * The bands' offsets, the records band on top. With no rows the records band
 * is the whole display, whose height `heightMode` decides.
 */
export function variantTopBandsGeometry({
  showRecords,
  recordsHeight,
  lineZoneHeight,
}: {
  showRecords: boolean
  recordsHeight: number
  /** 0 at genomic positions. */
  lineZoneHeight: number
}): VariantTopBands {
  const { top, reserved, bottom } = stackBands(['records', 'lineZone'], {
    records: { active: showRecords, height: recordsHeight },
    lineZone: { active: true, height: lineZoneHeight },
  })
  return {
    recordsHeight: reserved.records,
    lineZoneTop: top.lineZone,
    bottom,
  }
}
