import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'
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

function createTestEnvironment(opts?: {
  // when set, the track gets a TestAdapter whose fetchSizeLimit slot carries
  // this value, exercising the adapter-limit tier of the byte gate
  adapterFetchSizeLimit?: number
}) {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  // Config-only adapter with a fetchSizeLimit slot; the RPC is mocked so the
  // adapter class is never instantiated — the display only reads its config.
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestAdapter',
        configSchema: ConfigurationSchema('TestAdapter', {
          fetchSizeLimit: { type: 'number', defaultValue: 5_000_000 },
        }),
        getAdapterClass: () => {
          throw new Error('TestAdapter is config-only in tests')
        },
      }),
  )

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
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      ...(opts?.adapterFetchSizeLimit === undefined
        ? {}
        : {
            adapter: {
              type: 'TestAdapter',
              fetchSizeLimit: opts.adapterFetchSizeLimit,
            },
          }),
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
      // every promotable slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
        return undefined
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

  // The byte axis has no span floor — `gateActive` carries the opt-in and
  // force-load and nothing else — because read cost scales with depth, so a
  // gene-sized window over an amplicon or mitochondrial pileup is tens of MB and
  // a floor would decline to look at it. The estimate is still what decides, so
  // ordinary data at this zoom measures small and loads.
  it('still measures below the AUTO_FORCE_LOAD_BP floor, and loads when it fits', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation((_sid: string, method: string) =>
      Promise.resolve(
        method === 'CoreGetRegionByteEstimate'
          ? 50_000
          : makeEmptyGroupedData(),
      ),
    )

    const { view, display } = createDisplay()
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(mockRpcCall.mock.calls.map(c => c[1])).toContain(
      'CoreGetRegionByteEstimate',
    )
    expect(display.regionTooLarge).toBe(false)
  })

  // The bypass the floor used to be: zooming past it downloaded exactly the
  // bytes the gate had refused one zoom level earlier.
  it('gates an over-budget region below the floor instead of downloading it', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation((_sid: string, method: string) =>
      Promise.resolve(
        method === 'CoreGetRegionByteEstimate'
          ? 50_000_000
          : makeEmptyGroupedData(),
      ),
    )

    const { view, display } = createDisplay()
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    // the reads themselves were never requested
    expect(mockRpcCall.mock.calls.map(c => c[1])).not.toContain(
      'RenderAlignmentData',
    )
    expect(display.loadedRegions.size).toBe(0)
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
        return Promise.resolve(50_000_000)
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
        return Promise.resolve(50_000_000)
      }
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Navigate to a small region whose measurement fits. The release is the
    // estimate, not the zoom: dropping under 20kb does not wave the fetch
    // through on its own, and nothing scales the stored number by span.
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve(50_000)
      }
      return Promise.resolve(makeEmptyGroupedData())
    })
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
        return Promise.resolve(50_000_000)
      }
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.setForceLoadTrack(true)
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
        return Promise.resolve(50_000_000)
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

    // The estimate never changes: force-load exempts the track outright
    // (`gateExempt`), it doesn't raise a ceiling the adapter reports.
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve(50_000_000)
      }
      return Promise.resolve(makeEmptyGroupedData())
    })

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
      expect(display.isLoading).toBe(false)
    })

    display.setForceLoadTrack(true)
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
        return Promise.resolve(50_000_000)
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

  // Connections are a DRAW setting and the fetch must not depend on them. This
  // briefly asserted the opposite, to let the worker skip the per-read SA tag
  // walk while they were off — but `derivativePathCandidates` reads the same SA
  // chains and is ungated by design, so the skip took every off-screen split
  // segment away from the "Reconstruct derivative allele" dialog on the default
  // fetch. The walk is unconditional again, so this is a repaint.
  it('does NOT refetch when readConnections toggles', async () => {
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

  // Only the schemes the worker extracts different data for are in rpcProps
  // (see workerColorBy) — per-base overlays, modifications, bisulfite, and the
  // CPU-baked tag/mateRefName strings.
  it('refetches when colorBy changes to a scheme the worker extracts for', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setColorScheme({ type: 'perBaseQuality' })
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  // The shader decides these from arrays every fetch already produces, so
  // switching between them is a repaint. Sending the raw colorBy made each of
  // these hops drop rpcDataMap and re-read the region for identical data.
  it('does NOT refetch when switching between shader-only color schemes', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    for (const type of [
      'strand',
      'mappingQuality',
      'insertSize',
      'pairOrientation',
      'normal',
    ] as const) {
      display.setColorScheme({ type })
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
    }

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    // ...and the reads still repaint, because the scheme index is render state
    expect(display.colorBy.type).toBe('normal')
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
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      adapterFetchSizeLimit: 5_000_000,
    })

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

    // The adapter config declares fetchSizeLimit=5MB and the estimate is 3MB.
    // Display config default is 1MB. With the adapter limit respected (read on
    // the main thread from its config, not echoed through the estimate),
    // 3MB < 5MB → should NOT be regionTooLarge.
    expect(display.adapterFetchSizeLimit).toBe(5_000_000)
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'CoreGetRegionByteEstimate') {
        return Promise.resolve(3_000_000)
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
