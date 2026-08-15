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

import { configSchemaFactory } from './configSchemaFactory.ts'
import { stateModelFactory } from './stateModelFactory.ts'

// Headless harness for the real LinearManhattanDisplay inside a real
// LinearGenomeView, with a stub session and a `jest.fn()` rpcManager — no worker
// and no DOM. One per display rather than a copy per test file, the same way the
// wiggle and multi-row displays do it.
//
// Two displayed regions, because the behaviours worth testing here are about
// what happens across a multi-region load (the LD auto-index has to survive a
// partially-arrived batch).
export function createTestEnvironment() {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GWASAdapter',
        configSchema: ConfigurationSchema(
          'GWASAdapter',
          { ldAdapter: { type: 'frozen', defaultValue: null } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaFactory()

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'GWASTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'GWASTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'GWASTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearManhattanDisplay',
        configSchema,
        stateModel: stateModelFactory(pluginManager, configSchema),
        trackType: 'GWASTrack',
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
      type: 'GWASTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: {
        type: 'GWASAdapter',
        ldAdapter: { type: 'PlinkLDAdapter', uri: 'https://example.com/x.ld' },
      },
    },
    { pluginManager },
  )

  const regions = ['ctgA', 'ctgB'].map(refName => ({
    refName,
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  }))

  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(testAssembly({ regions })),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

  function createDisplay({
    colorBy = 'normal',
  }: { colorBy?: 'normal' | 'ld' } = {}) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'GWASTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearManhattanDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions(regions)
    view.showAllRegions()
    const display = view.tracks[0]!.displays[0]!
    if (colorBy !== 'normal') {
      // colorBy is a config slot, so it has to be written through the action
      // rather than passed in the display snapshot
      display.setColorBy(colorBy)
    }
    return { session, view, display }
  }

  return { createDisplay, mockRpcCall }
}
