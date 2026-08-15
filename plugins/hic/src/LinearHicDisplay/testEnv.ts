import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import {
  displayTestSessionModel,
  testAssembly,
  testAssemblyManager,
} from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearHicDisplayModel } from './model.ts'

// Headless harness for the Hi-C display model: a real LinearHicDisplay inside a
// real LinearGenomeView, with `rpcManager.call` mocked. HiC's whole fetch chain
// hangs off a one-shot `CoreGetInfo`, so its failure behavior is only reachable
// with a display that actually attaches — a bare `stateModel.create()` runs no
// `afterAttach` and reaches no containing view.

export function createTestEnvironment() {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
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

  const asm = testAssembly({
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
  })

  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(asm),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

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
