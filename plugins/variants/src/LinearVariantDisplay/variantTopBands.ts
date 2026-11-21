/**
 * The bands a variant display stacks above its genotype rows, as
 * one pure function:
 *
 * - the **records band**, the VCF's records laid out and stacked as a
 *   feature track lays them out (`records.show`);
 * - the **connectors band**, which ties a matrix column to its genomic
 *   position (`connectorsBand`, active only in columns).
 *
 * The records sit on top, where the connector lines end. The layout reserving
 * a strip and the painter filling it both read this, or the painter overdraws
 * the first row and nothing fails.
 *
 * Every band comes out of the track's `height`, and the rows take what is
 * left. With the rows hidden the track is the records band and the chips.
 */
import { MIN_BAND_HEIGHT, boundBandHeight } from '@jbrowse/core/util/bandHeight'
import {
  boundStackedBands,
  dragBandHeight,
  stackBands,
} from '@jbrowse/core/util/bandLayout'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import { DEFAULT_VARIANT_DISPLAY_HEIGHT } from './configSchema.ts'

import type { BandBounds } from '@jbrowse/core/util/bandHeight'
import type { Band, BandStack } from '@jbrowse/core/util/bandLayout'

/** Where a record stops reading as a mark: the drag floor. */
export const MIN_RECORDS_HEIGHT = 8

/** The most the band opens at beside rows while no `records.height` is written. */
export const DEFAULT_RECORDS_HEIGHT = 170

/**
 * The strip under the records band heading the genotype rows: their hide,
 * a hidden band's show, and the records' chips where the band's top is taken.
 * Reserved rather than laid over the rows, whose tree, facet strip and labels
 * draw over their left edge.
 */
export const BAND_CHIPS_HEIGHT = GROUP_LABEL_HEIGHT + 4

/**
 * The track a VCF with genotype rows opens at with `height` unset: the rows'
 * default under the chips and a records band at its default.
 */
export const DEFAULT_ROWS_TRACK_HEIGHT =
  DEFAULT_VARIANT_DISPLAY_HEIGHT + BAND_CHIPS_HEIGHT + DEFAULT_RECORDS_HEIGHT

// The most of the plot an unwritten records band takes: its default against
// the rows' default, so the default track splits at the two defaults.
const RECORDS_SHARE =
  DEFAULT_RECORDS_HEIGHT /
  (DEFAULT_RECORDS_HEIGHT + DEFAULT_VARIANT_DISPLAY_HEIGHT)

/** The bands above the genotype rows, top to bottom. */
const VARIANT_BAND_ORDER = ['records', 'chips', 'connectors'] as const

type VariantBandKey = (typeof VARIANT_BAND_ORDER)[number]

export type VariantTopBands = BandStack<VariantBandKey>

/**
 * The records band's legal height as written: the drag floor. With the rows
 * hidden it has no ceiling, the band being the track; over drawn rows the
 * plot they share bounds it ({@link boundRecordsBand}).
 */
export const RECORDS_BAND_BOUNDS: BandBounds = { min: MIN_RECORDS_HEIGHT }

/**
 * The height the records band holds beside genotype rows, drawn or hidden,
 * before the track bounds it: `records.height` as a seam drag or a config
 * wrote it, or the stack it settled at when it opened, whatever the records
 * in view need, so a pan never resizes it. Until one holds, its packed stack
 * up to the default. Past its height the fit ladder drops labels and the rows
 * that still do not fit hide.
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
 * The plot the records band and the drawn genotype rows share: the track
 * under the chips' strip, of which the rows keep `MIN_BAND_HEIGHT`.
 */
function recordsPlot(trackHeight: number) {
  return {
    height: Math.max(0, trackHeight - BAND_CHIPS_HEIGHT),
    floor: MIN_BAND_HEIGHT,
  }
}

/**
 * The records band over drawn genotype rows, bound against the track it comes
 * out of. A written `records.height` takes what it states, up to where the
 * rows keep their floor. An unwritten band also stops at its share of the
 * plot, so a short track shortens the band with it and a taller one gives
 * the band back its stack.
 */
export function boundRecordsBand({
  band,
  written,
  trackHeight,
}: {
  /** `height` as {@link recordsBandHeightOverRows} answers it. */
  band: Band
  written: boolean
  trackHeight: number
}) {
  const plot = recordsPlot(trackHeight)
  return boundStackedBands(
    ['records'],
    {
      records: {
        active: band.active,
        height: written
          ? band.height
          : Math.min(band.height, Math.round(plot.height * RECORDS_SHARE)),
      },
    },
    plot,
  ).records
}

/**
 * The records band over drawn genotype rows: the height
 * {@link recordsBandHeightOverRows} holds, bound against the track
 * ({@link boundRecordsBand}).
 */
export function boundHeldRecordsBand({
  active,
  written,
  trackHeight,
  ...held
}: Parameters<typeof recordsBandHeightOverRows>[0] & {
  active: boolean
  written: boolean
  trackHeight: number
}) {
  return boundRecordsBand({
    band: { active, height: recordsBandHeightOverRows(held) },
    written,
    trackHeight,
  })
}

/** The bound records band folded alone, the stack its seam drag is clamped against. */
export function recordsBandStack(band: Band) {
  return stackBands(['records'], { records: band })
}

/**
 * A seam drag of the records band folded by {@link recordsBandStack}: down to
 * the records' floor and up to where the rows under it keep their own. The
 * track does not move.
 */
export function dragRecordsHeight(
  stack: BandStack<'records'>,
  trackHeight: number,
  target: number,
) {
  return dragBandHeight(
    stack,
    'records',
    recordsPlot(trackHeight),
    target,
    MIN_RECORDS_HEIGHT,
  )
}

/**
 * The track at which the genotype rows under the records band get
 * `rowsHeight`. A written band keeps its height as the track grows; an
 * unwritten one grows with the track along its share until it reaches
 * `recordsHeight`, so the track has to grow by more than the rows lack.
 */
export function trackHeightForRows({
  rowsHeight,
  recordsHeight,
  written,
}: {
  rowsHeight: number
  /** The band's height before the track bounds it, 0 while it is off. */
  recordsHeight: number
  written: boolean
}) {
  const stated = rowsHeight + recordsHeight
  return (
    BAND_CHIPS_HEIGHT +
    Math.ceil(
      written ? stated : Math.min(stated, rowsHeight / (1 - RECORDS_SHARE)),
    )
  )
}

/**
 * The bands' offsets, the records band on top. With no rows the records band
 * is the whole display, whose height `heightMode` decides.
 */
export function variantTopBandsGeometry({
  records,
  showChips,
  connectors,
}: {
  /** Bound against the track (`boundRecordsBand`) while rows draw. */
  records: Band
  showChips: boolean
  /** Bound against the track (`boundConnectorsBand`). */
  connectors: Band
}) {
  return stackBands(VARIANT_BAND_ORDER, {
    records,
    chips: { active: showChips, height: BAND_CHIPS_HEIGHT },
    connectors,
  })
}
