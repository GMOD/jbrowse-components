import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { waitFor } from '@testing-library/react'

import {
  bootAlignmentsDisplay,
  makeEmptyAlignmentsResult as makeEmptyGroupedData,
} from './testUtils.ts'

// The gate rides inside the fetch: `RenderAlignmentData` takes the display's
// `byteLimit`, reads the index before it downloads anything, and answers a
// `RegionTooLargeResult` in place of the pileup when the region is over. There
// is no separate estimate RPC to stub any more — this stands in for the
// worker's own `measureRegionBytes`.
function respondWithBytes(mockRpcCall: jest.Mock, bytes: number) {
  mockRpcCall.mockImplementation(
    (_sid: string, method: string, args: { byteLimit?: number }) =>
      Promise.resolve(
        method === 'RenderAlignmentData' &&
          args.byteLimit !== undefined &&
          bytes > args.byteLimit
          ? { regionTooLarge: true, bytes }
          : makeEmptyGroupedData(bytes),
      ),
  )
}

function createTestEnvironment(opts?: {
  // when set, the track gets a TestAdapter whose fetchSizeLimit slot carries
  // this value, exercising the adapter-limit tier of the byte gate
  adapterFetchSizeLimit?: number
}) {
  console.warn = jest.fn()
  const mockRpcCall = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig:
      opts?.adapterFetchSizeLimit === undefined
        ? {}
        : {
            adapter: {
              type: 'TestAdapter',
              fetchSizeLimit: opts.adapterFetchSizeLimit,
            },
          },
    // Config-only adapter with a fetchSizeLimit slot; the RPC is mocked so the
    // adapter class is never instantiated — the display only reads its config.
    register: pluginManager => {
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
    },
  })
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 500_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  const Session = baseSession
    .volatile(() => ({
      rpcManager: { call: mockRpcCall },
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        waitForAssembly: () => Promise.resolve(asm),
        isValidRefName: () => true,
      },
    }))
    .actions(() => ({
      notifyError() {},
      queueDialog() {},
    }))

  function createDisplay() {
    const { session, view, display } = mount(Session)
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])
    return { session, view, track: view.tracks[0]!, display, mockRpcCall }
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
    respondWithBytes(mockRpcCall, 50_000)

    const { view, display } = createDisplay()
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    // the budget went out with the fetch, so the worker measured
    expect(
      mockRpcCall.mock.calls
        .filter(c => c[1] === 'RenderAlignmentData')
        .every(c => c[2].byteLimit !== undefined),
    ).toBe(true)
    expect(display.estimatedFetchBytes).toBe(50_000)
    expect(display.regionTooLarge).toBe(false)
  })

  // The bypass the floor used to be: zooming past it downloaded exactly the
  // bytes the gate had refused one zoom level earlier.
  it('gates an over-budget region below the floor instead of downloading it', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    respondWithBytes(mockRpcCall, 50_000_000)

    const { view, display } = createDisplay()
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    // the fetch went out — that is what takes the measurement — and came back
    // refused, so no reads were downloaded and nothing is marked loaded
    expect(display.loadedRegions.size).toBe(0)
    expect(display.rpcDataMap.size).toBe(0)
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

    respondWithBytes(mockRpcCall, 50_000_000)

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

    respondWithBytes(mockRpcCall, 50_000_000)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Navigate to a small region whose measurement fits. The release is the
    // estimate, not the zoom: dropping under 20kb does not wave the fetch
    // through on its own, and nothing scales the stored number by span.
    respondWithBytes(mockRpcCall, 50_000)
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

    respondWithBytes(mockRpcCall, 50_000_000)

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

    respondWithBytes(mockRpcCall, 50_000_000)

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
    // (`gateExempt`), so the next fetch carries no budget at all and the worker
    // measures nothing rather than measuring against a raised ceiling.
    respondWithBytes(mockRpcCall, 50_000_000)

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

  it('measures once per settled viewport, not once per autorun run', async () => {
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

    let measured = 0
    mockRpcCall.mockImplementation(
      (_sid: string, method: string, args: { byteLimit?: number }) => {
        if (method === 'RenderAlignmentData' && args.byteLimit !== undefined) {
          measured++
          return Promise.resolve({ regionTooLarge: true, bytes: 50_000_000 })
        }
        return Promise.resolve(makeEmptyGroupedData())
      },
    )

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // one measuring fetch, not one per autorun run: the isLoading guard stops
    // them overlapping and `gateSkipsMeasuredViewport` stops the next one until
    // the viewport moves
    expect(measured).toBe(1)
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

    // Resolve whichever RPC is pending; the cleared one was invalidated
    resolveRpc!(makeEmptyGroupedData())
    await jest.runAllTimersAsync()
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    // The new viewport was fetched — whether that fetch was issued before or
    // after the first one resolved is the debounce's business, not this test's
    expect(mockRpcCall).toHaveBeenCalledWith(
      expect.any(String),
      'RenderAlignmentData',
      expect.objectContaining({
        regions: expect.arrayContaining([
          expect.objectContaining({ refName: 'ctgA', start: 5000 }),
        ]),
      }),
    )
    expect(display.isLoading).toBe(false)
    expect(display.loadedRegions.size).toBe(1)
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

  // The read categories ride `filterBy`, which is already an rpcProps field, so
  // what this pins is that they reach the worker at all — they are applied
  // there (`filterChainFeatures`), so a category the fetch does not re-run for
  // is a filter that silently does nothing until the next unrelated refetch.
  it('refetches when a read category changes (filterBy rides rpcProps)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setFilterBy({ ...display.filterBy, singletons: 'exclude' })
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    const callsBefore2 = mockRpcCall.mock.calls.length
    display.setFilterBy({ ...display.filterBy, properPairs: 'exclude' })
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

  // The per-base sampling bin is deliberately NOT an rpcProps field: it swings
  // with zoom, and in the payload every swing is a SettingsInvalidate that drops
  // all fetched data. It rides the per-region `zoomFetchKey` instead, so a bin
  // flip refetches the regions on screen and nothing else. The zoom here is
  // INWARD, which leaves the viewport inside the loaded region — so a refetch
  // can only be the key.
  it('refetches on a per-base bin flip, and sends the bin with the call', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display, view } = createDisplay()

    display.setColorScheme({ type: 'perBaseLetter' })
    view.zoomTo(8)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.perBaseBinBp).toBe(4)

    const callsBefore = mockRpcCall.mock.calls.length
    view.zoomTo(1)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
    expect(display.perBaseBinBp).toBe(1)
    const lastArgs = mockRpcCall.mock.calls
      .filter(c => c[1] === 'RenderAlignmentData')
      .at(-1)![2] as { perBaseBinBp: number }
    expect(lastArgs.perBaseBinBp).toBe(1)
  })

  // ...and the same zoom in every other scheme holds one constant key, so the
  // bin costs no refetch to a mode that never reads it.
  it('does NOT refetch on zoom when the scheme is not per-base', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyGroupedData())
    const { display, view } = createDisplay()

    view.zoomTo(8)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.perBaseBinBp).toBe(1)

    const callsBefore = mockRpcCall.mock.calls.length
    view.zoomTo(1)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(display.perBaseBinBp).toBe(1)
    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
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
    respondWithBytes(mockRpcCall, 3_000_000)

    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.isLoading).toBe(false)
    })
  })
})
