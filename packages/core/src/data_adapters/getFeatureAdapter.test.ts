import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import { ObservableCreate } from '../util/rxjs.ts'
import { BaseAdapter, BaseFeatureDataAdapter } from './BaseAdapter/index.ts'
import { getFeatureAdapter } from './getFeatureAdapter.ts'

import type { Feature } from '../util/simpleFeature.ts'

class FeatureAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['ctgA']
  }

  getFeatures() {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }
}

// a non-feature adapter (no getFeatures), e.g. a sequence/regions/text-search
// adapter accidentally routed through a feature RPC
class NonFeatureAdapter extends BaseAdapter {}

const pluginManager = new PluginManager()
for (const [name, AdapterClass] of [
  ['FeatureAdapter', FeatureAdapter],
  ['NonFeatureAdapter', NonFeatureAdapter],
] as const) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name,
        configSchema: ConfigurationSchema(name, {}, { explicitlyTyped: true }),
        getAdapterClass: () => Promise.resolve(AdapterClass),
      }),
  )
}
pluginManager.createPluggableElements()
pluginManager.configure()

// the reference rides on every call; a type that does not declare it reads the
// reference is built without one (adapterReference.test.ts has the declared case)
test('resolves a feature adapter, and an undeclared type ignores the sequence', async () => {
  const dataAdapter = await getFeatureAdapter({
    pluginManager,
    sessionId: 'test',
    adapterConfig: { type: 'FeatureAdapter' },
    sequenceAdapter: { type: 'SeqAdapter' },
  })
  expect(dataAdapter).toBeInstanceOf(FeatureAdapter)
  expect(dataAdapter?.sequenceAdapterConfig).toBeUndefined()
})

test('returns undefined for a non-feature adapter', async () => {
  const dataAdapter = await getFeatureAdapter({
    pluginManager,
    sessionId: 'test',
    adapterConfig: { type: 'NonFeatureAdapter' },
  })
  expect(dataAdapter).toBeUndefined()
})
