import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'
import AdapterType from '../AdapterType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig } from './index.ts'

// An adapter renamed out of tree declares its old name in `aliases`, the way a
// display does. A config still spelling the old name has to reach the same
// adapter everywhere the name is looked up: the adapter config union, which
// dispatches on `type`, and the plugin manager's own lookups, which the worker
// and the local-files walk go through with a raw snapshot.
function pluginManagerWithRenamedAdapter() {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'NewAdapter',
        aliases: ['OldAdapter'],
        configSchema: ConfigurationSchema(
          'NewAdapter',
          { uri: { type: 'string', defaultValue: '' } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.reject(new Error('not instantiated')),
      }),
  )
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
  return pluginManager
}

describe('an adapter alias', () => {
  it('resolves through getAdapterType and hasAdapterType', () => {
    const pluginManager = pluginManagerWithRenamedAdapter()
    expect(pluginManager.getAdapterType('OldAdapter').name).toBe('NewAdapter')
    expect(pluginManager.hasAdapterType('OldAdapter')).toBe(true)
    expect(pluginManager.canonicalAdapterTypeName('OldAdapter')).toBe(
      'NewAdapter',
    )
    expect(pluginManager.hasAdapterType('NeverAdapter')).toBe(false)
    expect(() => pluginManager.getAdapterType('NeverAdapter')).toThrow(
      /'NeverAdapter' is not registered/,
    )
  })

  it('loads a track config spelling the old name, and snapshots the new one', () => {
    const pluginManager = pluginManagerWithRenamedAdapter()
    const conf = pluginManager.getTrackType('FeatureTrack').configSchema.create(
      {
        trackId: 'legacy',
        type: 'FeatureTrack',
        adapter: { type: 'OldAdapter', uri: 'old.txt' },
      },
      { pluginManager },
    )
    expect(readConfObject(conf, 'adapter')).toMatchObject({
      type: 'NewAdapter',
      uri: 'old.txt',
    })
    expect(getSnapshot(conf).adapter.type).toBe('NewAdapter')
  })
})
