import { getConf, setConf } from '@jbrowse/core/configuration'
import { getLeafNames } from '@jbrowse/tree-sidebar'

import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

// Sample metadata as a samplesTsv supplies it, arriving with the sample list.
const SOURCES = [
  { name: 'S0', population: 'AFR' },
  { name: 'S1', population: 'EUR' },
  { name: 'S2', population: 'AFR' },
  { name: 'S3', population: 'EUR' },
]

function loaded(rows: Record<string, unknown> = {}) {
  const { display } = createTestEnvironment({
    displayConfig: { ...RECORDS_BAND_OFF, rows },
  }).createDisplay()
  display.setSources(SOURCES)
  return display
}

const namesOf = (rows: readonly { name: string }[]) => rows.map(r => r.name)

test('a kept list naming no sample draws and fetches no row, and names the miss', () => {
  const display = loaded({ kept: ['NA0001'] })
  expect(display.sources).toEqual([])
  expect(display.sampleFilter).toEqual([])
  expect(display.rowNarrowingHint?.text).toBe('Showing 0 of 4 rows · Show all')
  expect(display.notices).toContain(
    'rows.kept names no row (NA0001), so no row shows',
  )
})

test('rows.filter on a samplesTsv column narrows the fetch and the rows', () => {
  const display = loaded({
    filter: [{ field: 'population', equal: 'EUR' }],
  })
  expect(display.sampleFilter).toEqual(['S1', 'S3'])
  expect(namesOf(display.sources)).toEqual(['S1', 'S3'])
  expect(display.rowNarrowingHint?.text).toBe('Showing 2 of 4 rows')
})

// Before the samples land there is nothing to filter, and nothing fetched:
// the attributes ride the sample list, so the filter never runs ahead of them.
test('the filter waits for the sample list its attributes arrive with', () => {
  const { display } = createTestEnvironment({
    displayConfig: {
      ...RECORDS_BAND_OFF,
      rows: { filter: [{ field: 'population', equal: 'EUR' }] },
    },
  }).createDisplay()
  expect(display.sampleFilter).toBeUndefined()
  expect(display.rowNarrowingHint).toBeUndefined()
  display.setSources(SOURCES)
  expect(display.sampleFilter).toEqual(['S1', 'S3'])
})

// The config's filter is the track's: "Show all" clears the reader's kept and
// filter and lets it show through, and the chip states it.
test('Show all lets a filter the config states show through', () => {
  const display = loaded({ filter: [{ field: 'population', equal: 'EUR' }] })
  expect(display.rowNarrowingClears).toBe(false)
  expect(display.rowNarrowingHint?.title).toBe(
    "The track's config keeps rows where population is EUR",
  )
  setConf(display, ['rows', 'filter'], [{ field: 'population', equal: 'AFR' }])
  display.setRowFocus(['S0'])
  expect(namesOf(display.sources)).toEqual(['S0'])
  expect(display.rowNarrowingClears).toBe(true)
  expect(display.rowNarrowingHint?.text).toBe('Showing 1 of 4 rows · Show all')

  display.showAllRows()
  expect(getConf(display, ['rows', 'kept'])).toEqual([])
  expect(namesOf(display.sources)).toEqual(['S1', 'S3'])
  expect(display.rowNarrowingClears).toBe(false)
})

test('Reset row order restores the config’s kept and filter', () => {
  const display = loaded({
    kept: ['S1', 'S2'],
    filter: [{ field: 'population', equal: 'EUR' }],
  })
  setConf(display, ['rows', 'filter'], [])
  display.setRowFocus(['S0', 'S2'])
  expect(namesOf(display.sources)).toEqual(['S0', 'S2'])
  display.resetRowArrangement()
  expect(namesOf(display.sources)).toEqual(['S1'])
})

// "Clear subtree filter" clears what a clade pick wrote, never the filter.
test('clearing the subtree filter leaves rows.filter', () => {
  const display = loaded()
  setConf(display, ['rows', 'filter'], [{ field: 'population', equal: 'AFR' }])
  display.setRowFocus(['S0'])
  display.setRowFocus(undefined)
  expect(namesOf(display.sources)).toEqual(['S0', 'S2'])
})

// The rows a run clusters, the tree pruned beside them, the chip's count and
// the fetch all read one narrowing.
test('clustering, the tree, the chip and the fetch agree', () => {
  const display = loaded({
    tree: '((S0,S1),(S2,S3));',
    filter: [{ field: 'population', equal: 'AFR' }],
    kept: ['S0', 'S1', 'S2'],
  })
  expect(namesOf(display.clusterableSources)).toEqual(['S0', 'S2'])
  expect(getLeafNames(display.root!)).toEqual(['S0', 'S2'])
  expect(display.sampleFilter).toEqual(['S0', 'S2'])
  expect(display.rowNarrowingHint?.text).toBe('Showing 2 of 4 rows · Show all')
})

// A haplotype row carries its sample's attributes, and a sample's name keeps
// its haplotypes; the order naming them expands them before any cell lands.
test('a phased sample name keeps its haplotype rows under a filter', () => {
  const display = loaded({
    sort: ['S1 HP1', 'S1 HP2', 'S3 HP1', 'S3 HP2'],
    filter: [{ field: 'population', equal: 'EUR' }],
    kept: ['S1'],
  })
  display.setRowsField('haplotype')
  expect(namesOf(display.sources)).toEqual(['S1 HP1', 'S1 HP2'])
  expect(display.sampleFilter).toEqual(['S1'])
})

test('a top-level filter on a row attribute points at rows.filter', () => {
  const display = loaded()
  expect(display.unreadFilterFieldNotice('population', 'variant')).toContain(
    'rows.filter keeps rows by their attributes',
  )
  expect(display.unreadFilterFieldNotice('DP', 'variant')).not.toContain(
    'rows.filter',
  )
})

// A launch's settings bag writes as any edit does, so it refuses a filter on
// a row's identity with the pointer, where a config loading the same entry
// loads without it.
test('a settings bag refuses rows.filter on a row name; a config loads without it', () => {
  const display = loaded()
  const report = display.applyDisplaySettings({
    rows: { filter: [{ field: 'name', oneOf: ['S0'] }] },
  })
  expect(report.failed).toEqual([
    {
      key: 'rows',
      error: expect.stringContaining(
        "field 'name' names a row rather than an attribute of one: a row's name goes in rows.kept",
      ),
    },
  ])
  expect(display.rowFilter).toEqual([])

  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const loadedWithIt = loaded({ filter: [{ field: 'sample', equal: 'S0' }] })
  expect(loadedWithIt.rowFilter).toEqual([])
  expect(loadedWithIt.rowNarrowingHint).toBeUndefined()
  expect(namesOf(loadedWithIt.sources)).toEqual(['S0', 'S1', 'S2', 'S3'])
  warn.mockRestore()
})
