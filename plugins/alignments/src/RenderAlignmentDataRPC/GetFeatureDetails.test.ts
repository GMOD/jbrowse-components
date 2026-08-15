import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import GetFeatureDetails from './GetFeatureDetails.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const region = {
  refName: 'ctgA',
  assemblyName: 'volvox',
  start: 100,
  end: 101,
}

// Stand in for the adapter the RPC resolves, recording the options it is queried
// with — the tier is the point of these cases.
function mockAdapter(features: SimpleFeature[]) {
  const getFeaturesArray = jest.fn().mockResolvedValue(features)
  jest.mocked(getFeatureAdapter).mockResolvedValue({
    getFeaturesArray,
  } as unknown as BaseFeatureDataAdapter)
  return getFeaturesArray
}

function run(args: { featureId: string; lodMode?: 'fine' | 'coarse' }) {
  return new GetFeatureDetails(new PluginManager()).execute({
    sessionId: 'sess',
    adapterConfig: { type: 'PairwiseIndexedPAFAdapter' },
    regions: [region],
    ...args,
  })
}

function feature(uniqueId: string) {
  return new SimpleFeature({ uniqueId, refName: 'ctgA', start: 100, end: 900 })
}

// Feature ids are only comparable within one detail tier — a tiered PIF adapter
// numbers its coarse and fine rows from different file offsets — so the tier the
// pileup was drawn at has to reach the adapter, or a coarse-tier feature is
// looked up against fine-tier ids and silently never found.
test('the requested tier reaches the adapter', async () => {
  const getFeaturesArray = mockAdapter([feature('123')])
  const { feature: found } = await run({ featureId: '123', lodMode: 'coarse' })

  expect(getFeaturesArray).toHaveBeenCalledWith(region, { lodMode: 'coarse' })
  expect(found?.uniqueId).toBe('123')
})

// undefined is a real value here, not a missing one: it means "whatever the
// adapter picks", which is what every untiered adapter gets.
test('no tier asks for none', async () => {
  const getFeaturesArray = mockAdapter([feature('123')])
  await run({ featureId: '123' })

  expect(getFeaturesArray).toHaveBeenCalledWith(region, { lodMode: undefined })
})

// The query is a whole region, not a single feature, so everything overlapping
// comes back and the id is what picks the row out.
test('picks the matching id out of the overlapping rows', async () => {
  mockAdapter([feature('122'), feature('123'), feature('124')])
  const { feature: found } = await run({ featureId: '123' })

  expect(found?.uniqueId).toBe('123')
})

test('an id no row carries resolves to nothing', async () => {
  mockAdapter([feature('122')])

  expect((await run({ featureId: '123' })).feature).toBeUndefined()
})

// A config that resolves to something that isn't a feature adapter. The display
// reports the empty result as a failed lookup; throwing here would surface as an
// error snackbar instead.
test('a non-feature adapter resolves to nothing rather than throwing', async () => {
  jest.mocked(getFeatureAdapter).mockResolvedValue(undefined)

  expect((await run({ featureId: '123' })).feature).toBeUndefined()
})
