import { SASHIMI_LEGEND_TITLE } from '../shared/legendUtils.ts'
import { READ_CONNECTIONS_MARK_LABELS } from './constants.ts'

import type { ReadConnectionsMark } from './constants.ts'
import type { Section } from './sectionLayout.ts'

export type BandChipKey = 'coverage' | 'sashimi' | 'readConnections' | 'pileup'

export interface BandChipRow {
  band: BandChipKey
  // Content space.
  top: number
  chips: BandChipKey[]
}

export type BandChipLane = Pick<
  Section,
  'coverageTop' | 'bands' | 'arcBand' | 'pileupTop' | 'pileupHeight'
> & {
  sashimiOverCoverage: boolean
}

const STRIP_KEYS = ['readConnections', 'sashimi'] as const

const OVER_COVERAGE_KEYS = ['sashimi', 'readConnections'] as const

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
  return key === 'sashimi'
    ? lanes.some(l => l.sashimiOverCoverage)
    : lanes.some(arcsOverCoverage)
}

function stripRow(
  lanes: readonly BandChipLane[],
  band: (typeof STRIP_KEYS)[number],
): BandChipRow | undefined {
  const lane = lanes.find(l => l.bands.reserved[band] > 0)
  return lane
    ? { band, top: lane.coverageTop + lane.bands.top[band], chips: [band] }
    : undefined
}

/**
 * The chips naming each band that draws, once for the whole stack: the
 * coverage and anything drawn over it on the first lane's coverage band, and
 * each strip and the pileup on the first lane drawing it. A lone band is not
 * named, so a chip never hides the last thing the track draws.
 */
export function bandChipRows(
  lanes: readonly BandChipLane[],
  showPileup: boolean,
) {
  const first = lanes[0]
  const pileupLane = showPileup
    ? lanes.find(l => l.pileupHeight > 0)
    : undefined
  const coverageRow: BandChipRow | undefined =
    first && first.bands.reserved.coverage > 0
      ? {
          band: 'coverage',
          top: first.coverageTop,
          chips: [
            'coverage',
            ...OVER_COVERAGE_KEYS.filter(key => drawsOverCoverage(lanes, key)),
          ],
        }
      : undefined
  const pileupRow: BandChipRow | undefined = pileupLane
    ? { band: 'pileup', top: pileupLane.pileupTop, chips: ['pileup'] }
    : undefined
  const rows = [
    coverageRow,
    ...STRIP_KEYS.map(band => stripRow(lanes, band)),
    pileupRow,
  ].filter(row => row !== undefined)
  return rows.reduce((n, row) => n + row.chips.length, 0) > 1 ? rows : []
}

/**
 * Each chip's name, as the band's own menu row or legend names it: the read
 * connections by the mark their band draws.
 */
export function bandChipLabel(key: BandChipKey, mark: ReadConnectionsMark) {
  return key === 'coverage'
    ? 'Coverage'
    : key === 'sashimi'
      ? SASHIMI_LEGEND_TITLE
      : key === 'pileup'
        ? 'Pileup'
        : READ_CONNECTIONS_MARK_LABELS[mark]
}
