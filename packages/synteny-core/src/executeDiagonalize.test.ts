import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeDiagonalize } from './executeDiagonalize.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')
const getFeaturesInMultipleRegionsArray = jest.fn()
jest
  .mocked(getFeatureAdapterOrThrow)
  .mockResolvedValue({ getFeaturesInMultipleRegionsArray } as never)

function feature(
  id: string,
  refName: string,
  mateRefName: string,
  start = 100,
) {
  return new SimpleFeature({
    uniqueId: id,
    refName,
    start,
    end: start + 100,
    strand: 1,
    mate: { refName: mateRefName, start, end: start + 100 },
  })
}

const pm = { jexl: {} } as unknown as PluginManager

// The adapter lives in its own refName namespace ("NC_..."), the view in the
// canonical one ("p1"/"c1"). renameRegionIfNeeded rewrites a region's refName
// for the fetch but keeps its assemblyName, so the two axes bridge like this:
//   - fetchRegions:    adapter-space refName, canonical assemblyName
//   - refRefNameMap /
//     queryRefNameMap: adapter refName -> canonical, applied to the features
//   - reference/currentRegions: canonical throughout
const adapterSpec = {
  adapterConfig: {},
  // renamed for the fetch: adapter refName, assemblyName untouched
  fetchRegions: [
    { refName: 'NC_p1', start: 0, end: 1000, assemblyName: 'peach' },
    { refName: 'NC_p2', start: 0, end: 1000, assemblyName: 'peach' },
  ] as Region[],
  refRefNameMap: { NC_p1: 'p1', NC_p2: 'p2' },
  queryRefNameMap: { NC_c1: 'c1', NC_c2: 'c2' },
}

const referenceRegions: Region[] = [
  { refName: 'p1', start: 0, end: 1000, assemblyName: 'peach' },
  { refName: 'p2', start: 0, end: 1000, assemblyName: 'peach' },
]
const currentRegions: Region[] = [
  { refName: 'c1', start: 0, end: 1000, assemblyName: 'cacao' },
  { refName: 'c2', start: 0, end: 1000, assemblyName: 'cacao' },
]

beforeEach(() => {
  getFeaturesInMultipleRegionsArray.mockReset()
})

test('bridges adapter refNames back to canonical before diagonalizing', async () => {
  // the adapter answers in ITS namespace: NC_p1 carries cacao's NC_c2, NC_p2
  // carries NC_c1 — so canonical cacao must reorder to [c2, c1].
  getFeaturesInMultipleRegionsArray.mockResolvedValue([
    feature('a', 'NC_p1', 'NC_c2'),
    feature('b', 'NC_p2', 'NC_c1'),
  ])

  const result = await executeDiagonalize(pm, {
    sessionId: 'test',
    adapters: [adapterSpec],
    referenceRegions,
    currentRegions,
  })

  // The reorder only lands if BOTH maps applied: the reference axis to match
  // NC_p1/NC_p2 against canonical p1/p2 ordering, and the query axis to match
  // NC_c1/NC_c2 against the canonical currentRegions handed back to the view.
  expect(result?.newRegions.map(r => r.refName)).toEqual(['c2', 'c1'])
})

test('fetches with the renamed regions, whose assemblyName still anchors the pair', async () => {
  getFeaturesInMultipleRegionsArray.mockResolvedValue([
    feature('a', 'NC_p1', 'NC_c2'),
  ])

  await executeDiagonalize(pm, {
    sessionId: 'test',
    adapters: [adapterSpec],
    referenceRegions,
    currentRegions,
  })

  const [regions, opts] = getFeaturesInMultipleRegionsArray.mock.calls[0] as [
    Region[],
    BaseOptions,
  ]
  // adapter-space refNames reach getFeatures...
  expect(regions.map(r => r.refName)).toEqual(['NC_p1', 'NC_p2'])
  // ...but assemblyName survives renaming, which is the anchor side every
  // comparative adapter reads off the region itself. Only the mate side has to
  // be named, and it comes from the canonical (never-renamed) currentRegions.
  expect(regions.map(r => r.assemblyName)).toEqual(['peach', 'peach'])
  expect(opts.targetAssemblyName).toBe('cacao')
})

test('an unmapped refName is treated as already canonical', async () => {
  // A refName absent from the map has no alias, so it passes through unchanged
  // — p2 here is canonical on both sides.
  getFeaturesInMultipleRegionsArray.mockResolvedValue([
    feature('a', 'NC_p1', 'NC_c2'),
    feature('b', 'p2', 'c1'),
  ])

  const result = await executeDiagonalize(pm, {
    sessionId: 'test',
    adapters: [adapterSpec],
    referenceRegions,
    currentRegions,
  })

  expect(result?.newRegions.map(r => r.refName)).toEqual(['c2', 'c1'])
})
