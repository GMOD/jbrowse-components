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

import { configSchemaFactory } from '../LinearArcDisplay/configSchema.ts'
import { stateModelFactory } from '../LinearArcDisplay/model.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

// Headless harness for LinearArcDisplay: registers a FeatureTrack + arc display
// and a minimal session/assemblyManager so the real state model can be created
// and its region-too-large fetch gating exercised across zoom without a worker.
// Modeled on the LD display's derivedRegionTooLarge test harness.
export function createTestEnvironment() {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

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
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearArcDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn(async (_sessionId: string, method: string) =>
    method === 'CoreGetRegionByteEstimate' ? 100 : [],
  )
  const LinearGenomeModel = linearGenomeViewStateModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
    },
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
            type: 'FeatureTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearArcDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
    ])
    // wide zoom: visibleBp (≈1.6 Mb) is well past AUTO_FORCE_LOAD_BP so the byte
    // gate actually engages (below the floor every region auto-loads)
    view.zoomTo(2000)
    const display = view.tracks[0]!.displays[0]! as ArcDisplayModel
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay }
}
