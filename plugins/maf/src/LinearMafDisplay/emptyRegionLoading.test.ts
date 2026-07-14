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
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { waitFor } from '@testing-library/react'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// The LinearMafGetAlignmentData result for a region with no alignment blocks on
// a sample-discovery track (no configured `samples`): the worker discovers rows
// from the blocks present, so an empty region yields an empty `samples` list.
function makeEmptyMafResult() {
  return {
    samples: [],
    treeNewick: undefined,
    regionData: {
      blocks: [],
      coverage: {
        coverageDepths: new Float32Array(0),
        coverageStartPos: 0,
        coverageMaxDepth: 0,
        identityScores: new Float32Array(0),
        mismatchPositions: new Uint32Array(0),
        mismatchBases: new Uint8Array(0),
        insertionPositions: new Uint32Array(0),
        insertionLengths: new Uint32Array(0),
        coveragePackedBuffer: { data: new Uint8Array(0), width: 0, height: 0 },
        snpPackedBuffer: new ArrayBuffer(0),
        interbasePackedBuffer: new ArrayBuffer(0),
        interbaseMaxCount: 0,
        indicatorPackedBuffer: new ArrayBuffer(0),
      },
    },
  }
}

function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  // MAF's configSchema reads baseLinearDisplayConfigSchema off the installed
  // LinearGenomeViewPlugin's exports, so the real plugin must be registered.
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        configSchema: ConfigurationSchema(
          'MafTabixAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaF(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MafTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MafTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MafTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearMafDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'MafTrack',
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
      type: 'MafTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      // No `samples` slot on the adapter → sample-discovery path.
      adapter: { type: 'MafTabixAdapter' },
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
      theme: createJBrowseTheme(),
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
        return new Map(Object.entries(this.getTracksById()))
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
            type: 'MafTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearMafDisplay' }],
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

describe('LinearMafDisplay zero-block loading', () => {
  // Regression: a sample-discovery MAF track (no configured `samples`) over a
  // region with no alignment blocks resolves to zero sources. renderState used
  // to gate on `!self.sources` alone, so after the fetch completed it stayed
  // undefined, the render callback returned false, canvasDrawn never flipped,
  // and the loading overlay spun forever. Once a region has loaded, renderState
  // must resolve so the canvas clears and the display settles.
  it('renderState resolves after a fetch that returns no blocks/samples', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyMafResult())
    const { display } = createDisplay()

    expect(display.renderState).toBeUndefined()

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(display.sources).toBeUndefined()
    expect(display.renderState).toBeDefined()
  })
})
