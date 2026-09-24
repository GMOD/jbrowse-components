import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import MarkScanPlotFields from './MarkScanPlotFields.ts'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const region = { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' }

const features = ['est', 'exonerate'].map(
  (source, i) =>
    new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'ctgA',
      start: i,
      end: i + 10,
      score: i,
      source,
    }),
)

function scan(adapter: object) {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesInMultipleRegionsArray: () => Promise.resolve(features),
    ...adapter,
  } as never)
  return new MarkScanPlotFields(new PluginManager()).execute({
    sessionId: 'test',
    adapterConfig: {},
    regions: [region],
  })
}

test("a GFF3 track's source column facets nothing", async () => {
  expect(await scan({})).toEqual({
    numeric: ['score'],
    categorical: ['source'],
  })
})

test("a multi-BigWig's sources facet the plot", async () => {
  expect(await scan({ getMultiSourceFeatureArraysMulti: jest.fn() })).toEqual({
    numeric: ['score'],
    categorical: ['source'],
    facet: 'source',
  })
})
