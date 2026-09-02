import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import FeatureComponent from './components/FeatureComponent.tsx'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

function createView() {
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory(pluginManager)
  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        trackConfigSchema,
      ),
    })
  })
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearGenomeView',
        stateModel: LinearGenomeViewModelFactory(pluginManager),
        ReactComponent: () => null,
      }),
  )
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearBasicDisplay',
        configSchema,
        stateModel: () => Promise.resolve(stateModelFactory(configSchema)),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: FeatureComponent,
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel =
    pluginManager.getViewType('LinearGenomeView').stateModel
  const trackConfig = pluginManager.pluggableConfigSchemaType('track').create(
    {
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      displays: [{ type: 'LinearBasicDisplay', displayId: 'd1' }],
    },
    { pluginManager },
  )
  const notifications: string[] = []
  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: { get: () => undefined },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      getDisplayTypeDefault() {
        return undefined
      },
      get themeOptions() {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notifyError(message: string) {
        notifications.push(message)
      },
    }))
  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({ type: 'LinearGenomeView', tracks: [] }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return { view, pluginManager, notifications }
}

test('the synchronous showTrack on an unloaded display loads it and shows a tick later', async () => {
  const { view, pluginManager, notifications } = createView()
  const display = pluginManager.getDisplayType('LinearBasicDisplay')
  expect(display.isStateModelLoaded).toBe(false)

  expect(view.showTrack('test_track')).toBeUndefined()
  expect(view.tracks.length).toBe(0)

  await display.loadStateModel()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(notifications).toEqual([])
  expect(view.tracks.length).toBe(1)
  expect(view.tracks[0]!.displays[0]!.type).toBe('LinearBasicDisplay')
})

test('launchTrack resolves the shown track once the display is loaded', async () => {
  const { view } = createView()
  const track = await view.launchTrack('test_track')
  expect(view.tracks.length).toBe(1)
  expect(track).toBe(view.tracks[0])
  expect(view.showTrack('test_track')).toBe(track)
})
