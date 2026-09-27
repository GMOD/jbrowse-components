import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { defaultFilterFlags } from '../shared/util.ts'
import GetGlobalValueForTag from './GetGlobalValueForTag.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const region = { refName: 'ctgA', assemblyName: 'volvox', start: 0, end: 1000 }

function mate(name: string, n: number, orientation: string, HP: string) {
  return new SimpleFeature({
    uniqueId: `${name}-${n}`,
    refName: 'ctgA',
    start: n * 300,
    end: n * 300 + 100,
    name,
    flags: 0x2,
    pair_orientation: orientation,
    tags: { HP },
  })
}

// The proper-pair filter needs whole chains, so the adapter cannot apply it;
// a value only hidden reads carry must not reach "Found values"
test('a value carried only by hidden reads is not found', async () => {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesArray: jest
      .fn()
      .mockResolvedValue([
        mate('proper', 1, 'F1R2', '1'),
        mate('proper', 2, 'F1R2', '1'),
        mate('discordant', 1, 'F1F2', '2'),
        mate('discordant', 2, 'F1F2', '2'),
      ]),
  } as unknown as BaseFeatureDataAdapter)
  const values = await new GetGlobalValueForTag(new PluginManager()).invoke({
    sessionId: 'sess',
    adapterConfig: { type: 'BamAdapter' },
    regions: [region],
    tag: 'HP',
    filterBy: { ...defaultFilterFlags, properPairs: 'exclude' },
  })
  expect(values).toEqual(['2'])
})
