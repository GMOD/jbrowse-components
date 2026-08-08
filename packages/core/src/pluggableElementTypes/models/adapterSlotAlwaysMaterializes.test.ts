import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'
import AdapterType from '../AdapterType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig } from './index.ts'

// `BaseTrackModel.adapterConfig` and `BaseDisplayModel.adapterConfig` are typed
// `Record<string, unknown>` with NO `| undefined`, and this is the fact that
// makes that honest.
//
// It looks like it shouldn't hold. `adapter` is
// `pluginManager.pluggableConfigSchemaType('adapter')`, i.e. a bare
// `types.union(...)` of the registered adapter schemas — no `types.maybe`, no
// `defaultValue`. Every union member is a config schema whose slots all have
// defaults, though, so MST can create one from nothing and instantiates the first
// rather than leaving the slot empty.
//
// Worth pinning rather than trusting, because the failure is silent in both
// directions: wrap the slot in `types.maybe` (or give a union member a required
// slot) and every `adapterConfig` reader starts lying about a value that is now
// undefined at runtime, with no compile error anywhere — the annotation says it
// cannot happen. It is also what let the old `if (!adapterConfig) throw` in
// `adapterType` be removed as unreachable.
function trackConfigSchema() {
  const pluginManager = new PluginManager()
  for (const name of ['AAdapter', 'BAdapter']) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name,
          configSchema: ConfigurationSchema(
            name,
            { uri: { type: 'string', defaultValue: '' } },
            { explicitlyTyped: true },
          ),
          getAdapterClass: () => Promise.reject(new Error('not instantiated')),
        }),
    )
  }
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: types.model('FeatureTrack', {}),
    })
  })
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager.getTrackType('FeatureTrack').configSchema
}

describe('the track `adapter` slot never reads as undefined', () => {
  it('materializes an object when `adapter` is omitted entirely', () => {
    const conf = trackConfigSchema().create({
      trackId: 'omitted',
      type: 'FeatureTrack',
    })
    const adapter = readConfObject(conf, 'adapter')
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('object')
  })

  it('materializes an object when `adapter` is explicitly undefined', () => {
    const conf = trackConfigSchema().create({
      trackId: 'explicit-undefined',
      type: 'FeatureTrack',
      adapter: undefined,
    })
    const adapter = readConfObject(conf, 'adapter')
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('object')
  })

  it('keeps a declared adapter intact', () => {
    const conf = trackConfigSchema().create({
      trackId: 'declared',
      type: 'FeatureTrack',
      adapter: { type: 'BAdapter', uri: 'b.txt' },
    })
    expect(readConfObject(conf, 'adapter')).toMatchObject({
      type: 'BAdapter',
      uri: 'b.txt',
    })
  })
})
