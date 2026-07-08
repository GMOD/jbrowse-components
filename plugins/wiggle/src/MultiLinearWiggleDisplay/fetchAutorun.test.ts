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
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { waitFor } from '@testing-library/react'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { WiggleDataResult } from '../util.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// The RenderMultiWiggleData RPC result for a region the adapter has no features
// in: getFallbackSourceArrays groups zero features into zero source arrays and
// getSources([region]) finds no `source` values, so the executor returns an
// empty sources list. This is exactly what a bedMethyl file returns for a
// chromosome it doesn't cover.
function makeEmptyMultiWiggleData(): WiggleDataResult {
  return { sources: [] }
}

function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedTabixAdapter',
        configSchema: ConfigurationSchema(
          'BedTabixAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MultiQuantitativeTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MultiQuantitativeTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MultiQuantitativeTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'MultiLinearWiggleDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'MultiQuantitativeTrack',
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
      type: 'MultiQuantitativeTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: { type: 'BedTabixAdapter' },
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
                configuration: { sequence: undefined },
              }
            : undefined,
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTracksById() {
        return { test_track: trackConfig }
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
            type: 'MultiQuantitativeTrack',
            configuration: 'test_track',
            displays: [{ type: 'MultiLinearWiggleDisplay' }],
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

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('MultiLinearWiggleDisplay zero-feature loading', () => {
  // Regression: a MultiQuantitativeTrack fed a plain feature adapter (the
  // modkit bedMethyl use-case) over a region the file doesn't cover returns
  // zero sources / zero features. renderState must still resolve (to the
  // EMPTY_PLOT_DOMAIN stub) so renderBlocks runs, clears the canvas, and flips
  // canvasDrawn — otherwise the display spins on the loading overlay forever.
  // "Still loading" is now the render callback's `rpcDataMap.size === 0`
  // first-paint gate, not a nullable renderState: the state is a stub both
  // before and after the fetch; what changes is that a (zero-feature) region
  // entry has loaded, so the size gate passes and the stub paints.
  it('renderState stays a stub through a zero-feature fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyMultiWiggleData())
    const { display } = createDisplay()

    // before the fetch: nothing loaded (the first-paint gate holds), stub state
    expect(display.rpcDataMap.size).toBe(0)
    expect(display.renderState).toBeDefined()

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // after the zero-feature fetch: an (empty) region entry exists, so the size
    // gate passes and the stub paints; the score domain stays undefined.
    expect(display.rpcDataMap.size).toBeGreaterThan(0)
    expect(display.numSources).toBe(0)
    expect(display.domain).toBeUndefined()
    expect(display.renderState).toBeDefined()
  })
})
