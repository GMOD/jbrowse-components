import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import AdapterType from '../AdapterType.ts'
import DisplayType from '../DisplayType.ts'
import TrackType from '../TrackType.ts'
import { displayCandidates, displayTypesFedBy } from './baseTrackConfig.ts'
import { createBaseTrackConfig } from './index.ts'

function adapter(name: string, adapterCapabilities: string[] = []) {
  return () =>
    new AdapterType({
      name,
      configSchema: ConfigurationSchema(
        name,
        {},
        { explicitlyTyped: true, closed: true },
      ),
      adapterCapabilities,
      getAdapterClass: () => Promise.reject(new Error('not instantiated')),
    })
}

function display(
  name: string,
  adapterCapabilities?: string[],
  slots: Record<string, { type: string; defaultValue: unknown }> = {},
) {
  return () =>
    new DisplayType({
      name,
      configSchema: ConfigurationSchema(
        name,
        { height: { type: 'number', defaultValue: 100 }, ...slots },
        {
          explicitIdentifier: 'displayId',
          explicitlyTyped: true,
          closed: 'warn',
        },
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
  pluginManager.addDisplayType(
    display('LinearGraphDisplay', ['getSubgraph'], {
      layout: { type: 'string', defaultValue: 'auto' },
    }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const schema = pluginManager.getTrackType('FeatureTrack').configSchema
  const displaysOf = (snapshot: Record<string, unknown>) =>
    (
      schema.create(
        { type: 'FeatureTrack', trackId: 't', ...snapshot },
        { pluginManager },
      ).displays as { type: string }[]
    ).map(d => d.type)
  return { displaysOf, pluginManager }
}

test("a display is filled in only where the track's adapter serves it", () => {
  const { displaysOf } = trackConfig()
  expect(displaysOf({ adapter: { type: 'BedAdapter' } })).toEqual([
    'LinearBasicDisplay',
  ])
  expect(displaysOf({ adapter: { type: 'GraphAdapter' } })).toEqual([
    'LinearBasicDisplay',
    'LinearGraphDisplay',
  ])
})

test('a display the config names is kept whatever its adapter', () => {
  const { displaysOf } = trackConfig()
  expect(
    displaysOf({
      adapter: { type: 'BedAdapter' },
      displays: [{ type: 'LinearGraphDisplay', displayId: 't-graph' }],
    }),
  ).toEqual(['LinearGraphDisplay', 'LinearBasicDisplay'])
})

// A frozen catalog track is never preprocessed before a view picks its
// display, so the pick reads the same filter: without it the circle opened a
// graph track on an adapter with no synteny lanes as a chord ribbon.
test('a view picks only among the displays the adapter serves', () => {
  const { pluginManager } = trackConfig()
  expect(
    displayTypesFedBy(pluginManager, 'FeatureTrack', { type: 'BedAdapter' }),
  ).toEqual(['LinearBasicDisplay'])
  expect(
    displayTypesFedBy(pluginManager, 'FeatureTrack', { type: 'GraphAdapter' }),
  ).toEqual(['LinearBasicDisplay', 'LinearGraphDisplay'])
})

test('the displays a config declares lead the candidates', () => {
  const { pluginManager } = trackConfig()
  expect(
    displayCandidates(pluginManager, {
      type: 'FeatureTrack',
      adapter: { type: 'GraphAdapter' },
      displays: [{ type: 'LinearGraphDisplay' }],
    }),
  ).toEqual(['LinearGraphDisplay', 'LinearBasicDisplay'])
})

// the config keeps the entry as settings, but the track cannot open as it
test('a declared display the adapter cannot feed is no candidate', () => {
  const { pluginManager } = trackConfig()
  expect(
    displayCandidates(pluginManager, {
      type: 'FeatureTrack',
      adapter: { type: 'BedAdapter' },
      displays: [{ type: 'LinearGraphDisplay' }],
    }),
  ).toEqual(['LinearBasicDisplay'])
})

// A setting reaches the displays the track has; one the adapter cannot feed
// is not added to carry it.
test('displayDefaults adds no display the adapter cannot feed', () => {
  const { displaysOf } = trackConfig()
  expect(
    displaysOf({
      adapter: { type: 'BedAdapter' },
      displayDefaults: { height: 50 },
    }),
  ).toEqual(['LinearBasicDisplay'])
})

test('a setting only an unfed display takes is reported, not applied', () => {
  const { displaysOf } = trackConfig()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(
    displaysOf({
      adapter: { type: 'BedAdapter' },
      displayDefaults: { layout: 'force' },
    }),
  ).toEqual(['LinearBasicDisplay'])
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining(
      'displayDefaults.layout reaches only LinearGraphDisplay',
    ),
  )
  warn.mockRestore()
})
