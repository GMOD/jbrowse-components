import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
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

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'
import { makeEmptyPileupData } from './testUtils.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// RenderAlignmentData now returns the grouped envelope; ungrouped fetches are a
// single section with key ''.
function makeEmptyGroupedData(): GroupedAlignmentsResult {
  return { groups: [{ key: '', label: '', data: makeEmptyPileupData() }] }
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

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
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
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
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
            configuration: 'test_track',
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

    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())

    const { display, view } = createDisplay()

    expect(view.initialized).toBe(true)
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalledWith(
        expect.any(String),
        'RenderAlignmentData',
        expect.objectContaining({
          regions: expect.arrayContaining([
            expect.objectContaining({ refName: 'ctgA' }),
          ]),
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
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyGroupedData())
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
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyGroupedData())
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
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.raiseForceLoadLimits(display.byteEstimate)
    display.reload()

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
    })
  })

  it('clearAllRpcData resets state and triggers a new fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())

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
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyGroupedData())
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

    let forceLoaded = false
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetRegionByteEstimate') {
        if (!forceLoaded) {
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
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
      expect(display.isLoading).toBe(false)
    })

    forceLoaded = true
    display.raiseForceLoadLimits(display.byteEstimate)
    display.reload()

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.isLoading).toBe(false)
    })
  })

  it('does not make duplicate byte estimate RPC calls', async () => {
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

    let densityCallCount = 0
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetRegionByteEstimate') {
        densityCallCount++
        return Promise.resolve({
          bytes: 50_000_000,
          fetchSizeLimit: 1_000_000,
        })
      }
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Only one CoreGetRegionByteEstimate call should have been made
    // (isLoading guard prevents the autorun from firing concurrently)
    expect(densityCallCount).toBe(1)
  })

  it('fetch error sets display error and stops retrying', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
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
    spy.mockRestore()
  })

  it('autorun does not loop when isLoading transitions', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    let rpcCallCount = 0
    mockRpcCall.mockImplementation(() => {
      rpcCallCount++
      return Promise.resolve(makeEmptyGroupedData())
    })

    const { display } = createDisplay()

    // First fetch cycle
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsAfterFirstFetch = rpcCallCount

    // Wait several autorun cycles — no new fetches should happen
    // since the loaded region covers the viewport
    jest.advanceTimersByTime(3000)
    await jest.runAllTimersAsync()

    expect(rpcCallCount).toBe(callsAfterFirstFetch)
  })

  it('re-fetches after loading finishes if viewport changed during fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    let resolveRpc: ((v: unknown) => void) | undefined
    mockRpcCall.mockImplementation(() => {
      return new Promise(resolve => {
        resolveRpc = resolve
      })
    })

    const { display, view } = createDisplay()

    // Start first fetch
    jest.advanceTimersByTime(400)

    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    // Change viewport while loading (should not trigger concurrent fetch)
    view.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        start: 5_000,
        end: 15_000,
        refName: 'ctgA',
      },
    ])

    jest.advanceTimersByTime(400)

    // Only one RPC should be in flight (the cleared one was invalidated)
    const callCount = mockRpcCall.mock.calls.length

    // Resolve the pending RPC
    resolveRpc!(makeEmptyGroupedData())
    await jest.runAllTimersAsync()

    // After the first fetch resolves, isLoading becomes false, and the
    // autorun should detect the new viewport needs data and re-fetch
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    // A new fetch should have been triggered for the new viewport
    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callCount)
  })

  it('does NOT refetch when readConnections toggles (arc-only setting)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setReadConnections('arc')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('does NOT refetch when arc draw settings change', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    display.setReadConnections('arc')
    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setDrawInter(false)
    display.setDrawLongRange(false)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('refetches when drawSingletons or drawProperPairs changes (rpcProps fields)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setDrawSingletons(false)
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    const callsBefore2 = mockRpcCall.mock.calls.length
    display.setDrawProperPairs(false)
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore2)
    })
  })

  it('refetches when colorBy changes (rpcProps field)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setColorScheme({ type: 'strand' })
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('refetches when linkedReads toggles (switches RPC type)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setLinkedReads('normal')
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('does NOT refetch when a non-tag sort is applied', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    // Non-tag sort types relayout in place from existing data.
    display.configuration.setSlot('sortedBy', {
      type: 'Start Location',
      pos: 5000,
      refName: 'ctgA',
      assemblyName: 'volvox',
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('refetches when a tag sort is applied (tag sort needs worker data)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.configuration.setSlot('sortedBy', {
      type: 'tag',
      pos: 5000,
      refName: 'ctgA',
      assemblyName: 'volvox',
      tag: 'HP',
    })
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('does NOT refetch when tag-sort position changes (same tag)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    display.configuration.setSlot('sortedBy', {
      type: 'tag',
      pos: 5000,
      refName: 'ctgA',
      assemblyName: 'volvox',
      tag: 'HP',
    })
    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    // Moving the sort position within the same tag sort re-runs main-
    // thread layout via laidOutPileupMap; the worker data (per-read tag
    // values) is unchanged.
    display.configuration.setSlot('sortedBy', {
      type: 'tag',
      pos: 6000,
      refName: 'ctgA',
      assemblyName: 'volvox',
      tag: 'HP',
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('adapter fetchSizeLimit is respected over display default', async () => {
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

    // Adapter returns fetchSizeLimit=5MB, bytes=3MB.
    // Display config default is 1MB.
    // With adapter limit respected, 3MB < 5MB → should NOT be regionTooLarge
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve({
          bytes: 3_000_000,
          fetchSizeLimit: 5_000_000,
        })
      }
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.isLoading).toBe(false)
    })
  })
})
