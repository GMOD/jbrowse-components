import { SASHIMI_LEGEND_TITLE } from '../shared/legendUtils.ts'
import { READ_CONNECTIONS_MARK_LABELS } from './constants.ts'

import type { ReadConnectionsMark } from './constants.ts'
import type { Section } from './sectionLayout.ts'

export type BandChipKey = 'coverage' | 'sashimi' | 'readConnections' | 'pileup'

// A row of chips heads one band, and the coverage's also names the arcs drawn
// over the histogram.
export interface BandChipRow {
  band: BandChipKey
  // Content space, at the top of the band the row heads.
  top: number
  chips: BandChipKey[]
}

export type BandChipLane = Pick<
  Section,
  'coverageTop' | 'bands' | 'arcBand' | 'pileupTop' | 'pileupHeight'
> & {
  // Whether a splice or split junction draws over this lane's coverage.
  sashimiOverCoverage: boolean
}

function arcsOverCoverage(lane: BandChipLane) {
  return (
    lane.arcBand !== undefined &&
    lane.arcBand.height > 0 &&
    lane.bands.reserved.readConnections === 0
  )
}

function stripRow(
  lanes: readonly BandChipLane[],
  band: 'readConnections' | 'sashimi',
) {
  const lane = lanes.find(l => l.bands.reserved[band] > 0)
  return lane
    ? [{ band, top: lane.coverageTop + lane.bands.top[band], chips: [band] }]
    : []
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
): BandChipRow[] {
  const first = lanes[0]
  const coverageShown = first !== undefined && first.bands.reserved.coverage > 0
  const coverageChips: BandChipKey[] = coverageShown
    ? [
        'coverage',
        ...(lanes.some(l => l.sashimiOverCoverage) ? ['sashimi' as const] : []),
        ...(lanes.some(arcsOverCoverage) ? ['readConnections' as const] : []),
      ]
    : []
  const pileupLane = showPileup
    ? lanes.find(l => l.pileupHeight > 0)
    : undefined
  const rows: BandChipRow[] = [
    ...(first && coverageShown
      ? [
          {
            band: 'coverage' as const,
            top: first.coverageTop,
            chips: coverageChips,
          },
        ]
      : []),
    ...stripRow(lanes, 'readConnections'),
    ...stripRow(lanes, 'sashimi'),
    ...(pileupLane
      ? [
          {
            band: 'pileup' as const,
            top: pileupLane.pileupTop,
            chips: ['pileup' as const],
          },
        ]
      : []),
  ]
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
