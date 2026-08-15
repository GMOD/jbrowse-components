import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
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
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'

// Headless harness for the multi-row display, modeled on maf/LD's
// derivedRegionTooLarge harness. Exercises the CanvasFeatureGateMixin gate (byte
// + density) through the real state model without a worker: drive
// setByteEstimate / setDensityStats and read the derived regionTooLarge.
export function createTestEnvironment(opts?: {
  adapterFetchSizeLimit?: number
  // Display-level config slots, written into the track config's own `displays`
  // entry — the long form of the `displayDefaults` shorthand, and the only way
  // to reach a slot with no setter (`rowGroups`). The shorthand itself is
  // expanded by a Core-preProcessTrackConfig handler this bare harness doesn't
  // install, so spell it out.
  displayConfig?: Record<string, unknown>
}) {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestFeatureAdapter',
        configSchema: ConfigurationSchema(
          'TestFeatureAdapter',
          { fetchSizeLimit: { type: 'number', defaultValue: 0 } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaF(pluginManager)

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

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearMultiRowFeatureDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )

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
      adapter: {
        type: 'TestFeatureAdapter',
        fetchSizeLimit: opts?.adapterFetchSizeLimit ?? 0,
      },
      displays: [
        {
          type: 'LinearMultiRowFeatureDisplay',
          displayId: 'test_track-LinearMultiRowFeatureDisplay',
          ...opts?.displayConfig,
        },
      ],
    },
    { pluginManager },
  )

  const asm = testAssembly({
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
      { refName: 'ctgB', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
  })

  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(asm),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

  function createDisplay(displayedRegions = asm.regions.slice(0, 1)) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            configuration: 'test_track',
            displays: [
              {
                type: 'LinearMultiRowFeatureDisplay',
                configuration: 'test_track-LinearMultiRowFeatureDisplay',
              },
            ],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions(displayedRegions)
    // annotated so a getter that doesn't exist on the model is a typecheck
    // error rather than a silent any
    const display: LinearMultiRowFeatureDisplayModel =
      view.tracks[0]!.displays[0]
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}
