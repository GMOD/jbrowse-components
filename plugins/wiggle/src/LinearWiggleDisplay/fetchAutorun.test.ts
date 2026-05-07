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
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { stateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/model'
import { waitFor } from '@testing-library/react'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { WiggleDataResult } from '../RenderWiggleDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

function makeEmptyWiggleData(): WiggleDataResult {
  return {
    featurePositions: new Uint32Array(0),
    featureScores: new Float32Array(0),
    featureMinScores: new Float32Array(0),
    featureMaxScores: new Float32Array(0),
    numFeatures: 0,
    posFeaturePositions: new Uint32Array(0),
    posFeatureScores: new Float32Array(0),
    posNumFeatures: 0,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
}

function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
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
      type: 'QuantitativeTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: { type: 'BigWigAdapter' },
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
        waitForAssembly: () =>
          Promise.resolve({
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
          }),
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

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// Architecture under test:
//   rpcProps changes → SettingsInvalidate clears RPC data → fetch re-runs
//   gpuProps changes → framework's getUploadInvalidationToken re-uploads
//                      the GPU buffer (no RPC roundtrip)
//   renderState-only changes → render autorun re-runs (no upload, no fetch)
describe('LinearWiggleDisplay SettingsInvalidate autorun', () => {
  it('refetches when bicolorPivot changes (rpcProps field)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setOverride('bicolorPivot', 5)
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('refetches when resolution changes (rpcProps field)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setResolution(5)
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  // gpuProps fields (color, summaryScoreMode, renderingType, ...) flow
  // through getUploadInvalidationToken → re-upload only. The worker output
  // doesn't change, so no refetch should happen.
  it('does NOT refetch when summaryScoreMode changes (gpuProps re-uploads)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setSummaryScoreMode('max')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // posColor is a pure gpuProps field (only used in the per-instance buffer).
  // We use it instead of color because color indirectly feeds effectiveBicolorPivot
  // (an rpcProps field), so changing color *can* legitimately refetch.
  it('does NOT refetch when posColor changes (gpuProps re-uploads)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setPosColor('#abcdef')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('does not refetch when an unrelated property is touched', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.toggleCrossHatches() // pure UI toggle — no GPU buffer impact
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // Settings consumed only at draw time (renderState, e.g. scaleType) flow
  // through the GPU render autorun as a uniform — they don't need a refetch
  // and don't need a re-upload either.
  it('does NOT refetch when scaleType changes (handled by render autorun)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setScaleType('log')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // Guard against the foot-gun in feedback_rpcprops_no_fetch_results: if any
  // rpcProps field is derived from rpcDataMap (or any other fetch result),
  // populating it during fetch will change rpcProps, which SettingsInvalidate
  // watches → clearAllRpcData → infinite loop. A direct shape comparison
  // before/after fetch catches that the moment a new field is added wrong.
  it('rpcProps shape is unchanged after a fetch populates rpcDataMap', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyWiggleData())
    const { display } = createDisplay()

    const before = JSON.stringify(display.rpcProps())

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(JSON.stringify(display.rpcProps())).toBe(before)
  })
})
