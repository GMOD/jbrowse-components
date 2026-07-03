import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Shared display-instantiation harness: builds a PluginManager with a
// FeatureTrack + LinearBasicDisplay and a minimal session/assemblyManager so a
// real display model can be created and driven in unit tests. createDisplay
// accepts extra display-snapshot props so tests can seed persistent state (e.g.
// soloFeatureIds) declaratively, exactly as the app does via addView.
export function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
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

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearBasicDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: {
        call: mockRpcCall,
      },
      assemblyManager: {
        get: (name: string) =>
          name === 'volvox'
            ? {
                initialized: true,
                regions: [
                  {
                    refName: 'ctgA',
                    start: 0,
                    end: 50_000,
                    assemblyName: 'volvox',
                  },
                ],
                getCanonicalRefName: (refName: string) => refName,
                getGeneticCodeId: () => undefined,
                configuration: {
                  sequence: undefined,
                },
              }
            : undefined,
        waitForAssembly: () =>
          Promise.resolve({
            initialized: true,
            regions: [
              {
                refName: 'ctgA',
                start: 0,
                end: 50_000,
                assemblyName: 'volvox',
              },
            ],
            getCanonicalRefName: (refName: string) => refName,
            getGeneticCodeId: () => undefined,
            configuration: {
              sequence: undefined,
            },
          }),
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTracksById() {
        return {
          test_track: trackConfig,
        }
      },
      get tracksById() {
        return this.getTracksById()
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notify() {},
      notifyError() {},
      queueDialog() {},
    }))

  function createDisplay(displaySnapshot?: Record<string, unknown>) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearBasicDisplay', ...displaySnapshot }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    const track = view.tracks[0]!
    const display = track.displays[0]!
    return { session, view, track, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}
