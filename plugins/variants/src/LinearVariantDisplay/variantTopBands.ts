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
import { MIN_BAND_HEIGHT, boundBandHeight } from '@jbrowse/core/util/bandHeight'
import { stackBands } from '@jbrowse/core/util/bandLayout'

import type { BandBounds } from '@jbrowse/core/util/bandHeight'

/** Where a record stops reading as a mark: the drag floor. */
export const MIN_RECORDS_HEIGHT = 8

/** `records.maxHeight`'s default, the cap on the packed stack. */
export const DEFAULT_RECORDS_MAX_HEIGHT = 170

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
 * The records band's legal height: the drag floor, and a ceiling that leaves
 * the rows a band's floor of the display.
 */
export function recordsBandBounds(displayHeight: number): BandBounds {
  return {
    min: MIN_RECORDS_HEIGHT,
    max: Math.max(MIN_RECORDS_HEIGHT, displayHeight - MIN_BAND_HEIGHT),
  }
}

/**
 * Over genotype rows the records band grows to its packed stack at full
 * feature size, up to `records.maxHeight`; past the cap the fit ladder
 * squeezes the stack into it. With no rows it is the whole display, whose
 * height `heightMode` decides.
 */
export function variantTopBandsGeometry({
  showRecords,
  recordsOnly,
  displayHeight,
  recordsMaxHeight,
  recordsContentHeight,
  recordsBounds,
  lineZoneHeight,
}: {
  showRecords: boolean
  /** No genotype rows draw. */
  recordsOnly: boolean
  displayHeight: number
  recordsMaxHeight: number
  /** The `full` rung's stack height, labels included. */
  recordsContentHeight: number
  recordsBounds: BandBounds
  /** 0 at genomic positions. */
  lineZoneHeight: number
}): VariantTopBands {
  const { top, reserved, bottom } = stackBands(['records', 'lineZone'], {
    records: {
      active: showRecords,
      height: recordsOnly
        ? displayHeight
        : Math.min(
            boundBandHeight(recordsMaxHeight, recordsBounds),
            Math.ceil(recordsContentHeight),
          ),
    },
    lineZone: { active: true, height: lineZoneHeight },
  })
  return {
    recordsHeight: reserved.records,
    lineZoneTop: top.lineZone,
    bottom,
  }
}
