import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { HaplotypeColor } from '@jbrowse/tree-sidebar/haplotypeColors'

// What a graph track beside the callset publishes: its walks' colors
let mockPublished: HaplotypeColor[] = []

jest.mock('@jbrowse/tree-sidebar/haplotypeColors', () => ({
  ...jest.requireActual<object>('@jbrowse/tree-sidebar/haplotypeColors'),
  viewHaplotypeColors: () => mockPublished,
}))

const WALKS: HaplotypeColor[] = [
  { sample: 'dm6', haplotype: 0, color: '#555555' },
  { sample: 'Canton-S_A1', haplotype: 1, color: '#1f77b4' },
  { sample: 'RVC3_B4', haplotype: 1, color: '#ff7f0e' },
  { sample: 'BOG1_A2', haplotype: 1, color: '#9467bd' },
]

const SOURCES = [
  { name: 'Canton-S_A1' },
  { name: 'RVC3_B4' },
  { name: 'BOG1_A2', color: '#00aa00' },
  { name: 'OreR' },
]

function display(rows: Record<string, unknown> = {}) {
  const { display } = createTestEnvironment({
    displayConfig: { ...RECORDS_BAND_OFF, rows },
  }).createDisplay()
  display.setSources(SOURCES)
  return display
}

function haploid(d: LinearVariantDisplayModel) {
  d.setCellData({
    samplePloidy: Object.fromEntries(SOURCES.map(s => [s.name, 1])),
    rowNames: [],
  } as unknown as Parameters<LinearVariantDisplayModel['setCellData']>[0])
}

function rowColors(d: LinearVariantDisplayModel) {
  return Object.fromEntries(
    d.drawnRows.map(r => [r.label ?? r.name, r.rowColor]),
  )
}

beforeEach(() => {
  mockPublished = WALKS
})

test("each haplotype row's label bar takes its walk's color, unless the sheet colors it", () => {
  const d = display({ field: 'haplotype' })
  haploid(d)
  expect(rowColors(d)).toEqual({
    'Canton-S_A1': '#1f77b4',
    RVC3_B4: '#ff7f0e',
    BOG1_A2: '#00aa00',
    OreR: undefined,
  })
})

test('a sample row takes its walk too, and a pinned color wins over it', () => {
  const d = display({ colors: { RVC3_B4: '#d62728' } })
  expect(rowColors(d)).toEqual({
    'Canton-S_A1': '#1f77b4',
    RVC3_B4: '#d62728',
    BOG1_A2: '#00aa00',
    OreR: undefined,
  })
})

test('with no graph track in the view, no row takes a color', () => {
  mockPublished = []
  const d = display({ field: 'haplotype' })
  haploid(d)
  expect(Object.values(rowColors(d))).toEqual([
    undefined,
    undefined,
    '#00aa00',
    undefined,
  ])
})
