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

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

// Headless harness for the variant display models: registers a VariantTrack
// carrying one display type plus a minimal session/assemblyManager, so the real
// state model can be created inside a real LinearGenomeView and its derived
// getters exercised across zoom/pan/navigation/flip without a worker or a DOM.
// Modeled on canvas's LinearBasicDisplay/testEnv.ts. Each display family wraps
// this with its own factories and instance type (LDDisplay/testEnv.ts,
// LinearMultiSampleVariantMatrixDisplay/testEnv.ts) — the geometry getters they
// test (renderTransform, connectorLineCoords, columnGeometry) all read the
// containing view, so a bare `stateModel.create()` can't reach them.
export function createDisplayTestEnvironment<T>({
  displayName,
  configSchema,
  stateModel,
}: {
  displayName: string
  configSchema: AnyConfigurationSchemaType
  stateModel: IAnyModelType
}) {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

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
      name: displayName,
      configSchema,
      stateModel,
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
            type: 'VariantTrack',
            configuration: 'test_track',
            displays: [{ type: displayName }],
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
    const display: T = view.tracks[0]!.displays[0]
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}
