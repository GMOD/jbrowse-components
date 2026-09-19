import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { executeGetGroupByCandidates } from './executeGetGroupByCandidates.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { MockDisplayConfigOverrides } from './testUtils.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

const features = [
  new SimpleFeature({
    uniqueId: '1',
    refName: 'ctgA',
    start: 0,
    end: 50,
    type: 'gene',
    biotype: 'protein_coding',
  }),
  new SimpleFeature({
    uniqueId: '2',
    refName: 'ctgA',
    start: 10,
    end: 30,
    type: 'gene',
    biotype: 'pseudogene',
  }),
  new SimpleFeature({
    uniqueId: '3',
    refName: 'ctgA',
    start: 60,
    end: 80,
    type: 'gene',
  }),
]

const getFeaturesArray = jest.fn()

function run({
  byteLimit,
  bytes = 1024,
  config,
}: {
  byteLimit?: number
  bytes?: number
  config?: MockDisplayConfigOverrides
} = {}) {
  getFeaturesArray.mockResolvedValue(features)
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesArray,
    getRegionByteSize: () => Promise.resolve(bytes),
  } as never)

  return executeGetGroupByCandidates({
    pluginManager: { jexl: createJexlInstance() } as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [
        { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
      ],
      displayConfig: mockDisplayConfig(config),
      byteLimit,
    },
  })
}

beforeEach(() => {
  getFeaturesArray.mockClear()
})

test('the attributes in view come back with their sections', async () => {
  expect(await run()).toEqual([
    {
      field: 'biotype',
      values: ['protein_coding', 'pseudogene'],
      missing: true,
      overflow: false,
    },
    { field: 'type', values: ['gene'], missing: false, overflow: false },
  ])
})

test('an over-budget region returns the gate result and downloads nothing', async () => {
  expect(await run({ byteLimit: 1 })).toEqual({
    regionTooLarge: true,
    bytes: 1024,
  })
  expect(getFeaturesArray).not.toHaveBeenCalled()
})

test('a value only filtered-out features carry is not a section', async () => {
  const scan = await run({
    config: { jexlFilters: [`get(feature,'biotype')!='pseudogene'`] },
  })
  expect(scan).toContainEqual({
    field: 'biotype',
    values: ['protein_coding'],
    missing: true,
    overflow: false,
  })
})
