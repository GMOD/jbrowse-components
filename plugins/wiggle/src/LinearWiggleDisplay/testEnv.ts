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
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

// Headless harness for the real LinearWiggleDisplay inside a real
// LinearGenomeView, with a stub session and a `jest.fn()` rpcManager — no worker
// and no DOM. One per display rather than a copy per test file, the same way the
// multi-row displays do it.
export function createTestEnvironment() {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  const configSchema = configSchemaFactory

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigWigAdapter',
        configSchema: ConfigurationSchema(
          'BigWigAdapter',
          {},
          { explicitlyTyped: true },
        ),
        adapterCapabilities: ['hasResolution'],
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'QuantitativeTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'QuantitativeTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'QuantitativeTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearWiggleDisplay',
      configSchema,
      stateModel: stateModelFactory(pluginManager, configSchema),
      trackType: 'QuantitativeTrack',
      viewType: 'LinearGenomeView',
      // never rendered here; this harness exercises the model
      ReactComponent: () => null,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'QuantitativeTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: { type: 'BigWigAdapter' },
    },
    { pluginManager },
  )

  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(testAssembly()),
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
            type: 'QuantitativeTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearWiggleDisplay' }],
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
