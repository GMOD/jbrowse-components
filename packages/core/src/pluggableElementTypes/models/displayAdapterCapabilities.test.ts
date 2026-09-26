import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import AdapterType from '../AdapterType.ts'
import DisplayType from '../DisplayType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig } from './index.ts'

function adapter(name: string, adapterCapabilities: string[] = []) {
  return () =>
    new AdapterType({
      name,
      configSchema: ConfigurationSchema(name, {}, { explicitlyTyped: true }),
      adapterCapabilities,
      getAdapterClass: () => Promise.reject(new Error('not instantiated')),
    })
}

function display(name: string, adapterCapabilities?: string[]) {
  return () =>
    new DisplayType({
      name,
      configSchema: ConfigurationSchema(
        name,
        {},
        { explicitIdentifier: 'displayId', explicitlyTyped: true },
      ),
      stateModel: types.model(name, {}),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
      adapterCapabilities,
    })
}

function trackConfig() {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(adapter('BedAdapter'))
  pluginManager.addAdapterType(adapter('GraphAdapter', ['getSubgraph']))
  pluginManager.addTrackType(
    () =>
      new TrackType({
        name: 'FeatureTrack',
        configSchema: ConfigurationSchema(
          'FeatureTrack',
          {},
          {
            baseConfiguration: createBaseTrackConfig(pluginManager),
            explicitIdentifier: 'trackId',
          },
        ),
        stateModel: types.model('FeatureTrack', {}),
      }),
  )
  pluginManager.addDisplayType(display('LinearBasicDisplay'))
  pluginManager.addDisplayType(display('LinearGraphDisplay', ['getSubgraph']))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const schema = pluginManager.getTrackType('FeatureTrack').configSchema
  return (snapshot: Record<string, unknown>) =>
    (
      schema.create(
        { type: 'FeatureTrack', trackId: 't', ...snapshot },
        { pluginManager },
      ).displays as { type: string }[]
    ).map(d => d.type)
}

test("a display is filled in only where the track's adapter serves it", () => {
  const displaysOf = trackConfig()
  expect(displaysOf({ adapter: { type: 'BedAdapter' } })).toEqual([
    'LinearBasicDisplay',
  ])
  expect(displaysOf({ adapter: { type: 'GraphAdapter' } })).toEqual([
    'LinearBasicDisplay',
    'LinearGraphDisplay',
  ])
})

test('a display the config names is kept whatever its adapter', () => {
  const displaysOf = trackConfig()
  expect(
    displaysOf({
      adapter: { type: 'BedAdapter' },
      displays: [{ type: 'LinearGraphDisplay', displayId: 't-graph' }],
    }),
  ).toEqual(['LinearGraphDisplay', 'LinearBasicDisplay'])
})
