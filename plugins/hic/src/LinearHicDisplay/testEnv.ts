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

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearHicDisplayModel } from './model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the Hi-C display model: a real LinearHicDisplay inside a
// real LinearGenomeView, with `rpcManager.call` mocked. HiC's whole fetch chain
// hangs off a one-shot `CoreGetInfo`, so its failure behavior is only reachable
// with a display that actually attaches — a bare `stateModel.create()` runs no
// `afterAttach` and reaches no containing view.
//
// A third copy of the same shape as canvas's and variants' harnesses, kept local
// rather than shared: hoisting it would make one plugin's tests depend on
// another's test utilities for the sake of ~40 lines of registration.
export function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'HicTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'HicTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'HicTrack',
        trackConfigSchema,
      ),
    })
  })

  const displayConfigSchema = configSchemaF()
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearHicDisplay',
        configSchema: displayConfigSchema,
        stateModel: stateModelFactory(displayConfigSchema),
        trackType: 'HicTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()
  const LinearGenomeModel = linearGenomeViewStateModelFactory(pluginManager)
  const trackConfig = pluginManager
    .pluggableConfigSchemaType('track')
    .create(
      { type: 'HicTrack', trackId: 'test_track', assemblyNames: ['volvox'] },
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
      getDisplayTypeDefault() {
        return undefined
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
            type: 'HicTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearHicDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
    ])
    const display: LinearHicDisplayModel = view.tracks[0]!.displays[0]
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}
