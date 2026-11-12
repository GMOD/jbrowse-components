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

test("a GFF3 track's source column takes no rows", async () => {
  expect(await scan({})).toEqual({
    numeric: ['score'],
    categorical: ['source'],
  })
})

test("a multi-BigWig's listed files take a row each, though its first features are all one file's", async () => {
  expect(
    await scan({
      getFeaturesInMultipleRegionsArray: () =>
        Promise.resolve(
          features.map(
            f => new SimpleFeature({ ...f.toJSON(), source: 'est' }),
          ),
        ),
      listRowSources: () =>
        Promise.resolve({
          field: 'source',
          sources: [{ name: 'est' }, { name: 'bw2' }],
        }),
    }),
  ).toEqual({
    numeric: ['score'],
    categorical: ['source'],
    rows: 'source',
  })
})

test('a multi-BigWig of one file takes no rows', async () => {
  expect(
    await scan({
      listRowSources: () =>
        Promise.resolve({ field: 'source', sources: [{ name: 'est' }] }),
    }),
  ).toEqual({
    numeric: ['score'],
    categorical: ['source'],
  })
})

test("a MAF's listed species take no rows on source", async () => {
  expect(
    await scan({
      listRowSources: () =>
        Promise.resolve({
          field: 'alignments',
          sources: [{ name: 'hg38' }, { name: 'mm10' }],
        }),
    }),
  ).toEqual({
    numeric: ['score'],
    categorical: ['source'],
  })
})

// The display's own listing read falls back to the features on a failure, and
// so does the scan: a samples table that cannot be read fails no dialog.
test('a listing that fails lists no rows, and the scan still answers', async () => {
  expect(
    await scan({
      listRowSources: () => Promise.reject(new Error('samples.tsv: 404')),
    }),
  ).toEqual({
    numeric: ['score'],
    categorical: ['source'],
  })
})
