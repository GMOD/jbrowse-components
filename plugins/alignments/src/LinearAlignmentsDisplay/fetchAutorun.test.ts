import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
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

import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

function makeEmptyPileupData(regionStart: number): PileupDataResult {
  return {
    regionStart,
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    readFlags: new Uint16Array(0),
    readMapqs: new Uint8Array(0),
    readInsertSizes: new Float32Array(0),
    readPairOrientations: new Uint8Array(0),
    readStrands: new Int8Array(0),
    readIds: [],
    readNames: [],
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchStrands: new Int8Array(0),
    mismatchFrequencies: new Uint8Array(0),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    numSoftclipBases: 0,
    interbasePositions: new Uint32Array(0),
    interbaseYs: new Uint16Array(0),
    interbaseLengths: new Uint16Array(0),
    interbaseTypes: new Uint8Array(0),
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(0),
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartOffset: 0,
    snpPositions: new Uint32Array(0),
    snpYOffsets: new Float32Array(0),
    snpHeights: new Float32Array(0),
    snpColorTypes: new Uint8Array(0),
    noncovPositions: new Uint32Array(0),
    noncovYOffsets: new Float32Array(0),
    noncovHeights: new Float32Array(0),
    noncovColorTypes: new Uint8Array(0),
    noncovMaxCount: 0,
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    readTagColors: new Uint8Array(0),
    numTagColors: 0,
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint8Array(0),
    numModifications: 0,
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint8Array(0),
    numModCovSegments: 0,
    sashimiX1: new Float32Array(0),
    sashimiX2: new Float32Array(0),
    sashimiScores: new Float32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    numSashimiArcs: 0,
    maxY: 0,
    numReads: 0,
    numGaps: 0,
    numMismatches: 0,
    numInterbases: 0,
    numCoverageBins: 0,
    numSnpSegments: 0,
    numNoncovSegments: 0,
    numIndicators: 0,
    detectedModifications: [],
    simplexModifications: [],
  }
}

function createTestEnvironment() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  const configSchema = configSchemaFactory(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'AlignmentsTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'AlignmentsTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'AlignmentsTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearAlignmentsDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

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
                    end: 500_000,
                    assemblyName: 'volvox',
                  },
                ],
                getCanonicalRefName: (refName: string) => refName,
              }
            : undefined,
        waitForAssembly: () =>
          Promise.resolve({
            initialized: true,
            regions: [
              {
                refName: 'ctgA',
                start: 0,
                end: 500_000,
                assemblyName: 'volvox',
              },
            ],
            getCanonicalRefName: (refName: string) => refName,
          }),
        isValidRefName: () => true,
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
            type: 'AlignmentsTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearAlignmentsDisplay' }],
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

describe('FetchVisibleRegions autorun', () => {
  it('fetches regions on initial load', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockResolvedValue(makeEmptyPileupData(0))

    const { display, view } = createDisplay()

    expect(view.initialized).toBe(true)
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalledWith(
        expect.any(String),
        'RenderPileupData',
        expect.objectContaining({
          region: expect.objectContaining({ refName: 'ctgA' }),
        }),
      )
    })

    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('does not re-fetch when already loading', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockImplementation(() => new Promise(() => {}))

    const { display } = createDisplay()

    jest.advanceTimersByTime(400)

    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(2000)

    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('does not loop after regionTooLarge is set', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { view, display } = createDisplay()

    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 0,
        end: 500_000,
        refName: 'ctgA',
      },
    ])
    view.zoomTo(50)

    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetFeatureDensityStats') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyPileupData(0))
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('regionTooLarge persists until user zooms in enough', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { view, display } = createDisplay()

    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 0,
        end: 500_000,
        refName: 'ctgA',
      },
    ])
    view.zoomTo(50)

    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetFeatureDensityStats') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyPileupData(0))
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Zoom in so the region is small enough (visibleBp < AUTO_FORCE_LOAD_BP
    // bypasses byte check entirely)
    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 0,
        end: 5_000,
        refName: 'ctgA',
      },
    ])
    view.zoomTo(1)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('clears regionTooLarge and re-fetches after force load + reload', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()

    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 0,
        end: 500_000,
        refName: 'ctgA',
      },
    ])
    view.zoomTo(50)

    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetFeatureDensityStats') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyPileupData(0))
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.setFeatureDensityStatsLimit(display.featureDensityStats)
    display.reload()

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
    })
  })

  it('clearAllRpcData resets state and triggers a new fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockResolvedValue(makeEmptyPileupData(0))

    const { display } = createDisplay()

    jest.advanceTimersByTime(400)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length

    display.clearAllRpcData()

    expect(display.loadedRegions.size).toBe(0)

    jest.advanceTimersByTime(400)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('isLoading is false after regionTooLarge is set', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()

    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 0,
        end: 500_000,
        refName: 'ctgA',
      },
    ])
    view.zoomTo(50)

    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetFeatureDensityStats') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyPileupData(0))
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
      expect(display.isLoading).toBe(false)
    })
  })

  it('isLoading is false after force load resolves tooLarge', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()

    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 0,
        end: 500_000,
        refName: 'ctgA',
      },
    ])
    view.zoomTo(50)

    let callCount = 0
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetFeatureDensityStats') {
        callCount++
        if (callCount <= 1) {
          return Promise.resolve({
            bytes: 50_000_000,
            fetchSizeLimit: 1_000_000,
          })
        }
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 100_000_000,
        })
      }
      return Promise.resolve(makeEmptyPileupData(0))
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
      expect(display.isLoading).toBe(false)
    })

    display.setFeatureDensityStatsLimit(display.featureDensityStats)
    display.reload()

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.isLoading).toBe(false)
    })
  })

  it('fetch error sets display error and stops retrying', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(400)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(2000)
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })
})
