/**
 * The bands a variant display stacks above its genotype rows, as
 * one pure function:
 *
 * - the **records band**, the VCF's records laid out and stacked as a
 *   `LinearVariantDisplay` lays them out (`records.show`);
 * - the **connectors band**, which ties a matrix column to its genomic
 *   position (`connectorsHeight`, non-zero only in columns).
 *
 * The records sit on top, where the connector lines end. The layout reserving
 * a strip and the painter filling it both read this, or the painter overdraws
 * the first row and nothing fails.
 */
import { boundBandHeight } from '@jbrowse/core/util/bandHeight'
import { stackBands } from '@jbrowse/core/util/bandLayout'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import type { BandBounds } from '@jbrowse/core/util/bandHeight'
import type { BandStack } from '@jbrowse/core/util/bandLayout'

/** Where a record stops reading as a mark: the drag floor. */
export const MIN_RECORDS_HEIGHT = 8

/** The most the band opens at over rows while no `records.height` is written. */
export const DEFAULT_RECORDS_HEIGHT = 170

/**
 * The strip under the records band holding its chips: each band's hide and
 * show, and the count of hidden records. Reserved rather than laid over the
 * rows, whose tree, facet strip and labels draw over their left edge.
 */
export const BAND_CHIPS_HEIGHT = GROUP_LABEL_HEIGHT + 4

/** The bands above the genotype rows, top to bottom. */
export const VARIANT_BAND_ORDER = ['records', 'chips', 'connectors'] as const

export type VariantBandKey = (typeof VARIANT_BAND_ORDER)[number]

export interface VariantTopBands extends BandStack<VariantBandKey> {
  /**
   * What the bands add to the track above the rows' slot: the records and
   * the chips. The connectors are taken from the slot, so they end the stack.
   */
  addedHeight: number
}

/**
 * The records band's legal height over rows: the drag floor and no ceiling,
 * since the band is added to the track above the rows rather than taken from
 * them.
 */
export const RECORDS_BAND_BOUNDS: BandBounds = { min: MIN_RECORDS_HEIGHT }

/**
 * The records band over genotype rows: the height it holds (written to
 * `records.height` by its seam drag or a config, or settled at its opening),
 * whatever the records in view need, so a pan never resizes the track. Until
 * one holds, its packed stack up to the default. Past its height the fit
 * ladder drops labels and the rows that still do not fit hide.
 */
export function recordsBandHeightOverRows({
  recordsHeight,
  recordsHeightHeld,
  recordsContentHeight,
}: {
  recordsHeight: number
  recordsHeightHeld: boolean
  /** The `full` rung's stack height, labels included. */
  recordsContentHeight: number
}) {
  const height = boundBandHeight(recordsHeight, RECORDS_BAND_BOUNDS)
  return recordsHeightHeld
    ? height
    : Math.min(height, Math.ceil(recordsContentHeight))
}

/**
 * The bands' offsets, the records band on top. With no rows the records band
 * is the whole display, whose height `heightMode` decides.
 */
export function variantTopBandsGeometry({
  showRecords,
  recordsHeight,
  showChips,
  connectorsHeight,
}: {
  showRecords: boolean
  recordsHeight: number
  showChips: boolean
  /** 0 at genomic positions. */
  connectorsHeight: number
}) {
  const stack = stackBands(VARIANT_BAND_ORDER, {
    records: { active: showRecords, height: recordsHeight },
    chips: { active: showChips, height: BAND_CHIPS_HEIGHT },
    connectors: { active: true, height: connectorsHeight },
  })
  return { ...stack, addedHeight: stack.top.connectors }
}
