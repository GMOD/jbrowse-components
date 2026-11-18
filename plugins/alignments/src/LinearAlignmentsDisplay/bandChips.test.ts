import { bandChipLabel, bandChips } from './bandChips.ts'
import { computeStackedSections } from './sectionLayout.ts'

import type { LaneBandsSettings } from './sectionLayout.ts'

const SETTINGS: LaneBandsSettings = {
  showCoverage: true,
  coverageHeight: 45,
  drawnReadConnections: 'link',
  readConnectionsDown: true,
  readConnectionsAbove: false,
  readConnectionsHeight: 35,
  showJunctions: true,
  junctionsAbove: false,
  junctionsHeight: 30,
}

interface LaneSpec {
  hasArcs?: boolean
  hasJunctionsStripArcs?: boolean
  junctionsOverCoverage?: boolean
  maxY?: number
}

function lanesOf(specs: LaneSpec[], settings: Partial<LaneBandsSettings> = {}) {
  return computeStackedSections(
    specs.map(s => ({
      maxY: s.maxY ?? 10,
      hasArcs: s.hasArcs ?? false,
      hasJunctionsStripArcs: s.hasJunctionsStripArcs ?? false,
      heightOverridePx: undefined,
      junctionsOverCoverage: s.junctionsOverCoverage ?? false,
    })),
    { ...SETTINGS, ...settings },
    { rowHeight: 5, minSectionHeight: 0 },
  )
}

function chipsOf(
  specs: LaneSpec[],
  settings: Partial<LaneBandsSettings> = {},
  showPileup = true,
) {
  return bandChips(
    lanesOf(specs, settings).sections,
    showPileup,
    false,
  ).rows.map(row => [row.band, row.chips])
}

test('the coverage and the pileup each get a chip', () => {
  expect(chipsOf([{}])).toEqual([
    ['coverage', ['coverage']],
    ['pileup', ['pileup']],
  ])
})

test('junctions over the coverage are named beside it, arcs in their strip', () => {
  expect(chipsOf([{ hasArcs: true, junctionsOverCoverage: true }])).toEqual([
    ['coverage', ['coverage', 'junctions']],
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
  expect(chipsOf([{ hasJunctionsStripArcs: true }])).toEqual([
    ['coverage', ['coverage']],
    ['junctions', ['junctions']],
    ['pileup', ['pileup']],
  ])
})

test('junctions split by auto placement are named once, on their strip', () => {
  expect(
    chipsOf([{ junctionsOverCoverage: true, hasJunctionsStripArcs: true }]),
  ).toEqual([
    ['coverage', ['coverage']],
    ['junctions', ['junctions']],
    ['pileup', ['pileup']],
  ])
})

test('no chip for arcs or junctions that draw nothing', () => {
  expect(
    chipsOf([{}], { drawnReadConnections: 'off', showJunctions: false }),
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
  const { rows } = bandChips(sections, true, false)
  expect(rows.map(r => [r.band, r.top])).toEqual([
    ['coverage', sections[0]!.sectionTop],
    ['readConnections', sections[1]!.sectionTop + 45],
    ['pileup', sections[0]!.pileupTop],
  ])
})

test('each row sits at the top of the band it names', () => {
  const { sections } = lanesOf([
    { hasArcs: true, hasJunctionsStripArcs: true, maxY: 20 },
  ])
  const lane = sections[0]!
  expect(
    bandChips(sections, true, false).rows.map(row => [row.band, row.top]),
  ).toEqual([
    ['coverage', 0],
    ['readConnections', lane.bands.top.readConnections],
    ['junctions', lane.bands.top.junctions],
    ['pileup', lane.pileupTop],
  ])
})

test('a strip above the coverage is named at its own top, the coverage below it', () => {
  const { sections } = lanesOf([{ hasJunctionsStripArcs: true }], {
    junctionsAbove: true,
  })
  expect(
    bandChips(sections, true, false).rows.map(row => [row.band, row.top]),
  ).toEqual([
    ['coverage', 30],
    ['junctions', 0],
    ['pileup', 30 + 45],
  ])
})

test('under section chips, whichever row heads the first lane leads them', () => {
  const leadingOf = (
    specs: LaneSpec[],
    settings: Partial<LaneBandsSettings>,
    underGroupChips = true,
  ) => {
    const { sections } = lanesOf(specs, settings)
    const { leading, rows } = bandChips(sections, true, underGroupChips)
    return [leading?.band, rows.map(row => row.band)]
  }
  const bothArcs = [{ hasArcs: true }, { hasArcs: true }]
  expect(leadingOf(bothArcs, {})).toEqual([
    'coverage',
    ['readConnections', 'pileup'],
  ])
  expect(leadingOf(bothArcs, { showCoverage: false })).toEqual([
    'readConnections',
    ['pileup'],
  ])
  expect(leadingOf([{}, { hasArcs: true }], { showCoverage: false })).toEqual([
    'pileup',
    ['readConnections'],
  ])
  expect(
    leadingOf([{ hasJunctionsStripArcs: true }, {}], { junctionsAbove: true }),
  ).toEqual(['junctions', ['coverage', 'pileup']])
  expect(leadingOf(bothArcs, {}, false)).toEqual([
    undefined,
    ['coverage', 'readConnections', 'pileup'],
  ])
})

test('the read connections chip is named by the mark the band draws', () => {
  expect(bandChipLabel('readConnections', 'link')).toBe('Read arcs')
  expect(bandChipLabel('readConnections', 'rule')).toBe('Read cloud')
  expect(bandChipLabel('junctions', 'link')).toBe('Junctions')
})
