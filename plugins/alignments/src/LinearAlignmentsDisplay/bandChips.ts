import { JUNCTION_LEGEND_TITLE } from '../shared/legendUtils.ts'
import { READ_CONNECTIONS_MARK_LABELS } from './constants.ts'
import { coverageBandTop } from './sectionLayout.ts'

import type { ReadConnectionsMark } from './constants.ts'
import type { Section } from './sectionLayout.ts'

export type BandChipKey =
  | 'coverage'
  | 'junctions'
  | 'readConnections'
  | 'pileup'

export interface BandChipRow {
  band: BandChipKey
  // Content space.
  top: number
  chips: BandChipKey[]
}

export type BandChipLane = Pick<
  Section,
  'sectionTop' | 'bands' | 'arcBand' | 'pileupTop' | 'pileupHeight'
> & {
  junctionsOverCoverage: boolean
}

const STRIP_KEYS = ['readConnections', 'junctions'] as const

const OVER_COVERAGE_KEYS = ['junctions', 'readConnections'] as const

function arcsOverCoverage(lane: BandChipLane) {
  return (
    lane.arcBand !== undefined &&
    lane.arcBand.height > 0 &&
    lane.bands.reserved.readConnections === 0
  )
}

function drawsOverCoverage(
  lanes: readonly BandChipLane[],
  key: (typeof OVER_COVERAGE_KEYS)[number],
) {
  return key === 'junctions'
    ? lanes.some(l => l.junctionsOverCoverage)
    : lanes.some(arcsOverCoverage)
}

function stripRow(
  lanes: readonly BandChipLane[],
  band: (typeof STRIP_KEYS)[number],
): BandChipRow | undefined {
  const lane = lanes.find(l => l.bands.reserved[band] > 0)
  return lane
    ? { band, top: lane.sectionTop + lane.bands.top[band], chips: [band] }
    : undefined
}

/**
 * The chips naming each band that draws, once for the whole stack: the
 * coverage and anything drawn over it on the first lane's coverage band, and
 * each strip and the pileup on the first lane drawing it. Arcs drawing both
 * over the coverage and in a strip are named on the strip. A lone band is
 * not named, so a chip never hides the last thing the track draws. Under
 * section chips, the row heading the first lane, whichever band that is, is
 * `leading`, drawn ahead of the topmost section chip that would cover it.
 */
export function bandChips(
  lanes: readonly BandChipLane[],
  showPileup: boolean,
  underGroupChips: boolean,
) {
  const rows = bandChipRows(lanes, showPileup)
  const leading = underGroupChips
    ? rows.find(row => row.top === lanes[0]?.sectionTop)
    : undefined
  return { leading, rows: rows.filter(row => row !== leading) }
}

function bandChipRows(lanes: readonly BandChipLane[], showPileup: boolean) {
  const first = lanes[0]
  const pileupLane = showPileup
    ? lanes.find(l => l.pileupHeight > 0)
    : undefined
  const stripRows = STRIP_KEYS.map(band => stripRow(lanes, band))
  const coverageRow: BandChipRow | undefined =
    first && first.bands.reserved.coverage > 0
      ? {
          band: 'coverage',
          top: coverageBandTop(first),
          chips: [
            'coverage',
            ...OVER_COVERAGE_KEYS.filter(
              key =>
                drawsOverCoverage(lanes, key) &&
                !stripRows.some(row => row?.band === key),
            ),
          ],
        }
      : undefined
  const pileupRow: BandChipRow | undefined = pileupLane
    ? { band: 'pileup', top: pileupLane.pileupTop, chips: ['pileup'] }
    : undefined
  const rows = [coverageRow, ...stripRows, pileupRow].filter(
    row => row !== undefined,
  )
  return rows.reduce((n, row) => n + row.chips.length, 0) > 1 ? rows : []
}

/**
 * Each chip's name, as the band's own menu row or legend names it: the read
 * connections by the mark their band draws.
 */
export function bandChipLabel(key: BandChipKey, mark: ReadConnectionsMark) {
  return key === 'coverage'
    ? 'Coverage'
    : key === 'junctions'
      ? JUNCTION_LEGEND_TITLE
      : key === 'pileup'
        ? 'Pileup'
        : READ_CONNECTIONS_MARK_LABELS[mark]
}
