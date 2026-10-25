import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectMatrixFeatures } from './collectMultiRowMatrix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

test('a spliced feature enters the matrix as the blocks it paints', async () => {
  const spliced = new SimpleFeature({
    uniqueId: 'domain',
    refName: 'ctgA',
    start: 100,
    end: 400,
    transcript: 'tx1',
    subfeatures: [
      { uniqueId: 'b1', refName: 'ctgA', start: 300, end: 400, type: 'block' },
      { uniqueId: 'b0', refName: 'ctgA', start: 100, end: 150, type: 'block' },
    ],
  })
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesArray: () => Promise.resolve([spliced]),
  } as never)
  const features = await collectMatrixFeatures({
    pluginManager: { jexl: createJexlInstance() } as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [
        { refName: 'ctgA', start: 0, end: 500, assemblyName: 'volvox' },
      ],
      rowsField: 'transcript',
      clusterField: '',
    },
  })
  expect(features.map(f => [f.row, f.start, f.end])).toEqual([
    ['tx1', 100, 150],
    ['tx1', 300, 400],
  ])
})
