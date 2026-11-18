import { bandChipLabel, bandChipRows } from './bandChips.ts'
import { computeStackedSections } from './sectionLayout.ts'

import type { BelowCoverageBandsSettings } from './sectionLayout.ts'

const SETTINGS: BelowCoverageBandsSettings = {
  showCoverage: true,
  coverageHeight: 45,
  drawnReadConnections: 'link',
  readConnectionsDown: true,
  readConnectionsHeight: 35,
  showSashimi: true,
  sashimiHeight: 30,
}

interface LaneSpec {
  hasArcs?: boolean
  hasSashimiDownArcs?: boolean
  sashimiOverCoverage?: boolean
  maxY?: number
}

function lanesOf(
  specs: LaneSpec[],
  settings: Partial<BelowCoverageBandsSettings> = {},
) {
  const { sections, contentHeight } = computeStackedSections(
    specs.map(s => ({
      maxY: s.maxY ?? 10,
      hasArcs: s.hasArcs ?? false,
      hasSashimiDownArcs: s.hasSashimiDownArcs ?? false,
      heightOverridePx: undefined,
      sashimiOverCoverage: s.sashimiOverCoverage ?? false,
    })),
    { ...SETTINGS, ...settings },
    { rowHeight: 5, minSectionHeight: 0 },
  )
  return { sections, contentHeight }
}

function chipsOf(
  specs: LaneSpec[],
  settings: Partial<BelowCoverageBandsSettings> = {},
  showPileup = true,
) {
  return bandChipRows(lanesOf(specs, settings).sections, showPileup).map(
    row => [row.band, row.chips],
  )
}

test('the coverage and the pileup each get a chip', () => {
  expect(chipsOf([{}])).toEqual([
    ['coverage', ['coverage']],
    ['pileup', ['pileup']],
  ])
})

test('junctions over the coverage are named beside it, arcs in their strip', () => {
  expect(chipsOf([{ hasArcs: true, sashimiOverCoverage: true }])).toEqual([
    ['coverage', ['coverage', 'sashimi']],
    ['readConnections', ['readConnections']],
    ['pileup', ['pileup']],
  ])
})

test('arcs drawn up over the coverage are named in the coverage row', () => {
  expect(chipsOf([{ hasArcs: true }], { readConnectionsDown: false })).toEqual([
    ['coverage', ['coverage', 'readConnections']],
    ['pileup', ['pileup']],
  ])
})

test('junctions bound for the strip below get a chip on the strip', () => {
  expect(chipsOf([{ hasSashimiDownArcs: true }])).toEqual([
    ['coverage', ['coverage']],
    ['sashimi', ['sashimi']],
    ['pileup', ['pileup']],
  ])
})

test('no chip for arcs or junctions that draw nothing', () => {
  expect(
    chipsOf([{}], { drawnReadConnections: 'off', showSashimi: false }),
  ).toEqual([
    ['coverage', ['coverage']],
    ['pileup', ['pileup']],
  ])
})

test('a lone band is not named, so no chip hides the last band', () => {
  expect(chipsOf([{}], {}, false)).toEqual([])
  expect(chipsOf([{ maxY: 0 }])).toEqual([])
})

test('with coverage hidden, up arcs take a strip and are named there', () => {
  expect(
    chipsOf([{ hasArcs: true }], {
      showCoverage: false,
      readConnectionsDown: false,
    }),
  ).toEqual([
    ['readConnections', ['readConnections']],
    ['pileup', ['pileup']],
  ])
})

test('a stack of lanes names each band once, on the first lane drawing it', () => {
  const { sections } = lanesOf([{}, { hasArcs: true }])
  const rows = bandChipRows(sections, true)
  expect(rows.map(r => [r.band, r.top])).toEqual([
    ['coverage', sections[0]!.coverageTop],
    ['readConnections', sections[1]!.coverageTop + 45],
    ['pileup', sections[0]!.pileupTop],
  ])
})

test('each row sits at the top of the band it names, which reserves no px for it', () => {
  const { sections, contentHeight } = lanesOf([
    { hasArcs: true, hasSashimiDownArcs: true, maxY: 20 },
  ])
  const lane = sections[0]!
  expect(contentHeight).toBe(45 + 35 + 30 + 20 * 5)
  expect(bandChipRows(sections, true).map(row => [row.band, row.top])).toEqual([
    ['coverage', 0],
    ['readConnections', lane.bands.top.readConnections],
    ['sashimi', lane.bands.top.sashimi],
    ['pileup', lane.pileupTop],
  ])
})

test('the read connections chip is named by the mark the band draws', () => {
  expect(bandChipLabel('readConnections', 'link')).toBe('Read arcs')
  expect(bandChipLabel('readConnections', 'rule')).toBe('Read cloud')
  expect(bandChipLabel('sashimi', 'link')).toBe('Sashimi arcs')
})
