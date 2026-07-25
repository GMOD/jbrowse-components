import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import sharedModelFactory from './shared.ts'

import type { SharedLDModel } from './shared.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the LD display: registers a VariantTrack + LDDisplay and
// a minimal session/assemblyManager so the real state model can be created and
// its derived getters exercised across zoom/pan/navigation without a worker.
// Modeled on canvas's LinearBasicDisplay/testEnv.ts.
export function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  const configSchema = ConfigurationSchema(
    'LDDisplay',
    { height: { type: 'number', defaultValue: 400 } },
    { baseConfiguration: sharedLDConfigFactory(), explicitlyTyped: true },
  )

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'VariantTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'VariantTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'VariantTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LDDisplay',
      configSchema,
      stateModel: sharedModelFactory(configSchema)
        .named('LDDisplay')
        .props({ type: types.literal('LDDisplay') }),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()
  const LinearGenomeModel = linearGenomeViewStateModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'VariantTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
    },
    { pluginManager },
  )

  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
    getGeneticCodeId: () => undefined,
    configuration: { sequence: undefined },
  }

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: mockRpcCall },
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        waitForAssembly: () => Promise.resolve(asm),
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
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

  function createDisplay() {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'VariantTrack',
            configuration: 'test_track',
            displays: [{ type: 'LDDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
    ])
    // `displays[0]` is untyped; annotating it makes a getter that doesn't exist
    // on the model a typecheck error rather than a silent any
    const display: SharedLDModel = view.tracks[0]!.displays[0]
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}
