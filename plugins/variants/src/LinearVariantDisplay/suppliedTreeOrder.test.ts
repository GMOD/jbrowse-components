import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

import type { LinearVariantDisplayModel } from './model.ts'

const SOURCES = [
  { name: 'S0', population: 'AFR' },
  { name: 'S1', population: 'EUR' },
  { name: 'S2', population: 'AFR' },
  { name: 'S3', population: 'EUR' },
]

const SAMPLE_PLOIDY = { S0: 2, S1: 2, S2: 2, S3: 1 }

function displayWith(rows: Record<string, unknown>, phased: boolean) {
  const { display } = createTestEnvironment({
    displayConfig: {
      ...RECORDS_BAND_OFF,
      rows: { ...(phased ? { field: 'haplotype' } : {}), ...rows },
    },
  }).createDisplay()
  display.setSources(SOURCES)
  display.setCellData({
    samplePloidy: SAMPLE_PLOIDY,
    rowNames: [],
  } as unknown as Parameters<LinearVariantDisplayModel['setCellData']>[0])
  return display
}

function rowNames(display: LinearVariantDisplayModel) {
  return display.sources.map(s => s.name)
}

test('a supplied tree orders the sample rows by its leaves', () => {
  const display = displayWith({ tree: '((S3,S1),(S2,S0));' }, false)
  expect(rowNames(display)).toEqual(['S3', 'S1', 'S2', 'S0'])
  expect(display.hierarchy).toBeDefined()
})

test('a supplied sample-leaf tree orders the haplotype rows at their sample', () => {
  const display = displayWith({ tree: '((S3,S1),(S2,S0));' }, true)
  expect(rowNames(display)).toEqual([
    'S3 HP1',
    'S1 HP1',
    'S1 HP2',
    'S2 HP1',
    'S2 HP2',
    'S0 HP1',
    'S0 HP2',
  ])
  expect(display.hierarchy).toBeDefined()
})

test('a supplied tree turns towards rows.sort in haplotype mode', () => {
  const display = displayWith(
    { tree: '((S3,S1),(S2,S0));', sort: ['S0'] },
    true,
  )
  expect(rowNames(display).slice(0, 2)).toEqual(['S0 HP1', 'S0 HP2'])
  expect(display.hierarchy).toBeDefined()
})

test('a supplied tree keeps every row in its band', () => {
  const display = displayWith({ tree: '((S3,S0),(S1,S2));' }, true)
  display.facetByField('population')
  expect(rowNames(display)).toEqual([
    'S0 HP1',
    'S0 HP2',
    'S2 HP1',
    'S2 HP2',
    'S3 HP1',
    'S1 HP1',
    'S1 HP2',
  ])
})

test('the row order stays out of the fetch', () => {
  const tree = displayWith({ tree: '((S3,S1),(S2,S0));' }, false)
  const plain = displayWith({}, false)
  expect(tree.sampleFilter).toEqual(plain.sampleFilter)
  expect(tree.rpcProps()).toEqual(plain.rpcProps())
})
