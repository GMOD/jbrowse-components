import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeDiscoverMates } from './executeDiscoverMates.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')
const getFeaturesInMultipleRegionsArray = jest.fn()
jest
  .mocked(getFeatureAdapterOrThrow)
  .mockResolvedValue({ getFeaturesInMultipleRegionsArray } as never)

const region: Region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 100,
  end: 200,
}

function feature({
  mateAssembly,
  start = 100,
  end = 200,
  extra,
}: {
  mateAssembly: string
  start?: number
  end?: number
  extra?: Record<string, unknown>
}) {
  return new SimpleFeature({
    uniqueId: `${mateAssembly}-${start}`,
    refName: 'ctgA',
    start,
    end,
    strand: -1,
    CIGAR: '100M',
    ...extra,
    mate: {
      refName: 'ctgB',
      start: 0,
      end: 100,
      assemblyName: mateAssembly,
    },
  })
}

function run(
  features: Feature[],
  trackAssemblyNames = ['volvox', 'volvox_ins'],
) {
  getFeaturesInMultipleRegionsArray.mockResolvedValue(features)
  return executeDiscoverMates({
    pluginManager: {} as PluginManager,
    sessionId: 't1',
    adapterConfig: { type: 'PAFAdapter' },
    regions: [region],
    trackAssemblyNames,
    anchorAssembly: 'volvox',
  })
}

// The reason this runs in the worker at all: a locus on an all-vs-all file
// carries an alignment per sample and a selection can be a whole chromosome, so
// reducing here is what keeps the millions of rows behind the fetch from
// crossing the boundary to be thrown away on arrival. One PANEL per mate
// assembly, though — not one alignment: the panel spans every block that
// assembly aligns the region with.
test('one panel per mate assembly, carrying all of its alignments', async () => {
  const { mates } = await run([
    feature({ mateAssembly: 'volvox_ins', start: 150, end: 200 }),
    feature({ mateAssembly: 'volvox_ins', start: 100, end: 200 }),
  ])
  expect(mates.length).toBe(1)
  expect(mates[0]!.features.map(f => f.start)).toEqual([150, 100])
})

test('mates the track declares no assembly for are reported, not shipped', async () => {
  const { mates, unconfigured } = await run([
    feature({ mateAssembly: 'volvox_ins' }),
    feature({ mateAssembly: 'HG002#1' }),
  ])
  expect(mates.map(m => m.assemblyName)).toEqual(['volvox_ins'])
  expect(unconfigured).toEqual(['HG002#1'])
})

// The CIGAR is the whole reason a feature is shipped rather than a pair of
// numbers — it is what puts a panel on the matching slice of its mate. Its
// neighbours in a synteny row are not: a `cs` tag carries the real query bases
// and can outweigh the CIGAR beside it, per mate, for nothing.
test('a shipped alignment carries the CIGAR and none of the bulk beside it', async () => {
  const { mates } = await run([
    feature({
      mateAssembly: 'volvox_ins',
      extra: {
        cs: ':100',
        identity: 0.98,
        numMatches: 98,
        blockLen: 100,
        syntenyId: 3,
      },
    }),
  ])
  const shipped = mates[0]!.features[0]!
  expect(shipped.CIGAR).toBe('100M')
  expect(shipped.strand).toBe(-1)
  expect(shipped.mate).toEqual({
    refName: 'ctgB',
    start: 0,
    end: 100,
    assemblyName: 'volvox_ins',
  })
  expect(Object.keys(shipped).sort()).toEqual([
    'CIGAR',
    'end',
    'mate',
    'refName',
    'start',
    'strand',
    'uniqueId',
  ])
})

// An indexed PIF's coarse tier carries no CIGAR at all, so asking for it here
// would silently downgrade every launched panel from a CIGAR walk to an
// interpolation across the whole block — including when the launch came from a
// view zoomed out far enough to be drawing that coarse tier itself.
test('no lodMode is requested, so the adapter serves its fine tier', async () => {
  await run([feature({ mateAssembly: 'volvox_ins' })])
  const [regions, opts] = getFeaturesInMultipleRegionsArray.mock.calls[0]! as [
    Region[],
    BaseOptions,
  ]
  expect(regions).toEqual([region])
  expect('lodMode' in opts).toBe(false)
})
