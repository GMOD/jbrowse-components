import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'
import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// RenderFeatureData responder that mimics executeRenderFeatureData's byte gate:
// the index estimate scales with the queried span, and a region over
// `byteSizeLimit` short-circuits before any features are "downloaded". Canvas
// makes no other RPC call, so this is the whole mock.
function makeByteGatedRender(bytesPerBp: number) {
  return (
    _sessionId: string,
    _method: string,
    args: { region: { start: number; end: number }; byteSizeLimit?: number },
  ) => {
    const bytes = Math.round((args.region.end - args.region.start) * bytesPerBp)
    return Promise.resolve(
      args.byteSizeLimit !== undefined && bytes > args.byteSizeLimit
        ? { regionTooLarge: true as const, bytes }
        : { ...makeFeatureData(), bytes },
    )
  }
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

    mockRpcCall.mockResolvedValue(makeFeatureData())

    const { display, view } = createDisplay()

    expect(view.initialized).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    expect(display.error).toBeUndefined()

    // The autorun has delay: 600
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalledWith(
        expect.any(String),
        'RenderFeatureData',
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

  it('does not re-fetch when already loading (prevents re-entry loop)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    // RPC never resolves — simulates a slow fetch
    mockRpcCall.mockImplementation(() => new Promise(() => {}))

    const { display } = createDisplay()

    // Trigger the autorun
    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    // Advance more time — the autorun may re-fire, but the isLoading
    // guard should prevent additional fetchRegions calls
    jest.advanceTimersByTime(2000)

    // Should not have made additional RPC calls
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('does not loop after regionTooLarge is set', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()
    // Derived regionTooLarge gates densityTooLarge on visibleBp >=
    // AUTO_FORCE_LOAD_BP (20_000). Use a 50_000 bp region zoomed out so
    // visibleBp = 50_000.
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    view.zoomTo(62.5)

    // RPC returns regionTooLarge with a featureCount that, at this bpPerPx,
    // trips the density threshold (10_000 / 50_000 * 62.5 = 12.5 > 1).
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 10_000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    // Advance significantly — the autorun should NOT keep re-fetching
    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    // No additional calls
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('clears regionTooLarge and re-fetches after force load + reload', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    view.zoomTo(62.5)

    // First: RPC returns regionTooLarge (density trips at this bpPerPx)
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 10_000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Now simulate "Force Load": raise limit, clear state, reload.
    // setFeatureDensityStatsLimit triples the limit so the RPC succeeds.
    display.setFeatureDensityStatsLimit()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    display.reload()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
    })
  })

  it('completes fetch and settles even with many regions (collapsed introns)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { view, display } = createDisplay()

    // Set up collapsed intron scenario with many small displayed regions
    // that map to multiple staticRegions
    const regions = Array.from({ length: 5 }, (_, i) => ({
      assemblyName: 'volvox',
      start: i * 1000,
      end: i * 1000 + 300,
      refName: 'ctgA',
    }))
    view.setDisplayedRegions(regions)

    // Each region's RenderFeatureData call succeeds
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'RenderFeatureData') {
        return Promise.resolve(makeFeatureData())
      }
      return Promise.resolve({})
    })

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBeGreaterThan(0)
    })

    const finalCallCount = mockRpcCall.mock.calls.length

    // After settling, no more calls should happen
    jest.advanceTimersByTime(2000)
    expect(mockRpcCall.mock.calls.length).toBe(finalCallCount)
  })

  it('fetch error sets display error and stops retrying', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })

    const callCount = mockRpcCall.mock.calls.length

    // Error guard in autorun prevents re-fetching
    jest.advanceTimersByTime(2000)
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('preserves laidOutDataMap during layout refresh (soft reset)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const featureData = makeFeatureData()
    mockRpcCall.mockResolvedValue(featureData)

    const { display, view } = createDisplay()

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // Verify data is loaded
    expect(display.laidOutDataMap.size).toBe(1)

    // Simulate zoom that triggers needsLayoutRefresh:
    // The layout was done at bpPerPx ~12.5 (10000bp / 800px).
    // Zooming to 3x that (ratio > 2) triggers needsLayoutRefresh.
    const originalBpPerPx = view.bpPerPx
    view.zoomTo(originalBpPerPx * 3)

    // beforeFetchCheck should do a soft reset
    jest.advanceTimersByTime(800)

    // laidOutDataMap should still have the old data (soft reset preserves it)
    expect(display.laidOutDataMap.size).toBe(1)

    // But loadedRegions should be cleared (triggering refetch)
    // and eventually new data arrives
    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('reload after error clears error and re-fetches successfully', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    // First fetch fails
    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })

    // Now fix the issue and retry (simulating user clicking "Retry")
    mockRpcCall.mockResolvedValue(makeFeatureData())
    display.reload()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.error).toBeFalsy()
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('re-fetches a region pruned off-screen when it scrolls back into view', async () => {
    // Regression: pruneRpcDataMapToVisible used to leave loadedRegions set
    // while clearing rpcDataMap. The FetchVisibleRegions autorun would then
    // see boundsValid=true + isCacheValid=true → skip fetch → blank region.
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())

    const { display, view } = createDisplay()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
      expect(display.rpcDataMap.size).toBe(1)
    })

    const callsAfterLoad = mockRpcCall.mock.calls.length

    // Simulate the region scrolling far off-screen: fetchNeeded calls this
    // before fetching newly visible regions, pruning anything outside the
    // buffered viewport. Pass an empty set → prune everything.
    display.pruneRpcDataMapToVisible(new Set())

    expect(display.rpcDataMap.size).toBe(0)
    // With the fix, loadedRegions is also pruned so boundsValid=false on
    // the next autorun evaluation, guaranteeing a refetch.
    expect(display.loadedRegions.size).toBe(0)

    // Zoom to trigger a visibleRegions change, which fires FetchVisibleRegions.
    view.zoomTo(view.bpPerPx * 1.1)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
      expect(display.rpcDataMap.size).toBe(1)
    })

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsAfterLoad)
  })

  it('clearAllRpcData resets state and triggers a new fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockResolvedValue(makeFeatureData())

    const { display } = createDisplay()

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length

    // clearAllRpcData increments fetchGeneration (observed by autorun)
    display.clearAllRpcData()

    expect(display.loadedRegions.size).toBe(0)
    expect(display.isLoading).toBe(false)

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // Should have made new RPC calls
    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

describe('SettingsInvalidate autorun', () => {
  it('triggers refetch when settings change while data is loaded', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setShowOnlyGenes(true)
    // Autorun fires synchronously — invalidates state but keeps raw data
    // visible through the refetch window. FetchVisibleRegions re-fetches
    // after its 600ms delay.
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
      const lastArgs = mockRpcCall.mock.calls.at(-1)![2]
      expect(lastArgs).toMatchObject({ showOnlyGenes: true })
    })
  })

  it('keeps stale rpcDataMap visible through a settings-change refetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.rpcDataMap.size).toBe(1)

    // Trigger settings-driven invalidation. clearAllRpcData fires but
    // must NOT empty rpcDataMap — labels would flash off otherwise.
    display.setShowOnlyGenes(true)
    expect(display.rpcDataMap.size).toBe(1)
  })

  it('triggers refetch when settings change while fetch is in progress (regression)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    // Never resolves — holds the initial fetch in-flight indefinitely
    mockRpcCall.mockImplementation(() => new Promise(() => {}))
    const { display } = createDisplay()

    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setShowOnlyGenes(true)
    // clearAllRpcData() fires synchronously, cancels the in-flight fetch and
    // clears laidOutDataMap. FetchVisibleRegions re-fetches after 600ms.
    jest.advanceTimersByTime(800)

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    const lastArgs = mockRpcCall.mock.calls.at(-1)![2]
    expect(lastArgs).toMatchObject({ showOnlyGenes: true })
  })

  it('does not double-fetch when settings change before the initial FetchVisibleRegions fires', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()

    // Change setting before FetchVisibleRegions fires (delay: 600ms).
    // clearAllRpcData() runs synchronously, incrementing fetchGeneration.
    // FetchVisibleRegions fires once at t=600ms using the current showOnlyGenes.
    display.setShowOnlyGenes(true)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // Exactly one RPC call from FetchVisibleRegions with the correct setting
    expect(mockRpcCall).toHaveBeenCalledTimes(1)
    expect(mockRpcCall.mock.calls[0]![2]).toMatchObject({ showOnlyGenes: true })
  })
})

// AUTO_FORCE_LOAD_BP is 20,000 — use a 50,000 bp region to trigger getByteEstimateConfig
describe('byte estimate pre-check', () => {
  function createLargeDisplay() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    // Zoom to 62.5 bpPerPx so visibleBp = 62.5 * 800 = 50,000 > AUTO_FORCE_LOAD_BP (20,000)
    view.zoomTo(62.5)
    return { display, view, mockRpcCall: env.mockRpcCall }
  }

  // bytesPerBp=200 over the 50kb region → ~10MB estimate, past the 5MB limit.
  it('sets regionTooLarge from the byte short-circuit (no features loaded)', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // The short-circuit rendered no features (laidOutDataMap is gated empty
    // while the banner is up), so nothing reaches the GPU.
    expect(display.laidOutDataMap.size).toBe(0)
  })

  it('proceeds to fetch when bytes are within limit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    // bytesPerBp=1 over the 50kb region → ~50kB, under the 5MB limit.
    mockRpcCall.mockImplementation(makeByteGatedRender(1))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })

    const renderCalls = mockRpcCall.mock.calls.filter(
      (c: unknown[]) => c[1] === 'RenderFeatureData',
    )
    expect(renderCalls.length).toBeGreaterThan(0)
  })

  // Regression: the byte gate takes the per-region max, not the sum across
  // regions. Each region here is ~2MB (under the 5MB limit) so the worker admits
  // all three, but their sum (6MB) exceeds one region's budget. Summing would
  // flip regionTooLarge true and blank data that was already fetched and laid
  // out; the max keeps the whole multi-region view rendered.
  it('does not gate a multi-region view whose regions each fit but sum over the limit', async () => {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 1_500_000, refName: 'ctgA' },
      {
        assemblyName: 'volvox',
        start: 1_500_000,
        end: 3_000_000,
        refName: 'ctgA',
      },
      {
        assemblyName: 'volvox',
        start: 3_000_000,
        end: 4_500_000,
        refName: 'ctgA',
      },
    ])
    // Show all three regions at once
    view.showAllRegions()

    // 2 bytes/bp × 1.5Mbp = 3MB per region (< 5MB limit), 9MB summed (> limit)
    env.mockRpcCall.mockImplementation(makeByteGatedRender(2))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(3)
    })
    expect(display.regionTooLarge).toBe(false)
    expect(display.laidOutDataMap.size).toBeGreaterThan(0)
  })

  it('allows fetch after force load raises the byte size limit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Force load raises userByteSizeLimit past the estimate, so the next fetch
    // passes a higher budget and the region is no longer short-circuited.
    display.forceLoad()
    display.reload()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('does not loop after byte-estimate regionTooLarge is set', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })
})

// Derived regionTooLarge: stays a pure function of cached density stats ×
// current bpPerPx. These tests pin down the behavior the imperative path
// used to get wrong (banner flicker on small zoom, refetch loops, stale
// stats across chromosome navigation).
//
// Geometry: width=800, region=50kbp. view.visibleBp ≈ 406 × bpPerPx empirically
// (sum of visible region span clipped to viewport). AUTO_FORCE_LOAD_BP=20_000
// → density gate engages above bpPerPx ≈ 50. maxFeatureScreenDensity default=1.
describe('derived regionTooLarge', () => {
  function createLargeDisplay() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    view.zoomTo(62.5)
    return { display, view, mockRpcCall: env.mockRpcCall }
  }

  it('stays true on small zoom while density still trips threshold', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    // After view.zoomTo(62.5) the empirical bpPerPx is ≈31.7 (visibleBp
    // 25_375 / width 800). density × bpPerPx = 5000/50_000 * 31.7 ≈ 3.17 > 1
    // → trips. After zoomTo(55), bpPerPx ≈ 27.9, density × bpPerPx ≈ 2.79
    // → still trips. visibleBp stays > AUTO_FORCE_LOAD_BP so the gate stays
    // engaged.
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    view.zoomTo(55)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('flips false and refetches when visibleBp drops below the gate', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    let renderCalls = 0
    mockRpcCall.mockImplementation(() => {
      renderCalls += 1
      return renderCalls === 1
        ? Promise.resolve({ regionTooLarge: true, featureCount: 5000 })
        : Promise.resolve(makeFeatureData())
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // zoomTo(20): visibleBp ≈ 8000 < AUTO_FORCE_LOAD_BP → maxFeatureDensity
    // returns undefined → derived densityTooLarge=false → fetch fires; the
    // worker no longer gates either, so it returns features.
    view.zoomTo(20)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(renderCalls).toBeGreaterThanOrEqual(2)
  })

  it('preserves density stats across viewport-change clearAllRpcData', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.densityStatsPerRegion.size).toBe(1)
    })

    // ClearBlockingStateOnViewportChange autorun fires on the zoom change
    // and calls clearAllRpcData (loadedRegions wiped). Density stats and
    // featureDensityStats must survive so the derived banner stays stable.
    view.zoomTo(55)
    jest.advanceTimersByTime(100)

    expect(display.densityStatsPerRegion.size).toBe(1)
    expect(display.regionTooLarge).toBe(true)
  })

  it('clears stale density stats on chromosome (displayedRegions) change', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.densityStatsPerRegion.size).toBe(1)
    })

    // Index 0 gets reused for the new chromosome; without the clear autorun
    // the stale chrom-A stats would gate the derived banner against chrom-B
    // and could permanently block refetch.
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgB' },
    ])

    expect(display.densityStatsPerRegion.size).toBe(0)
    expect(display.featureDensityStats).toBeUndefined()
  })

  it('force load past the byte estimate flips banner false and renders', async () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view, mockRpcCall } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])

    // bytesPerBp=2 over the 5Mbp region → ~10MB estimate, past the 5MB limit.
    mockRpcCall.mockImplementation(makeByteGatedRender(2))

    view.zoomTo(view.maxBpPerPx)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Force-load raises userByteSizeLimit past the current scaled estimate, so
    // the derived banner recomputes false and the gated fetch proceeds.
    display.forceLoad()
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBeGreaterThan(0)
    })
    expect(display.regionTooLarge).toBe(false)
  })

  it('force load with density limit flips banner false via derived recomputation', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    let renderCalls = 0
    mockRpcCall.mockImplementation(() => {
      renderCalls += 1
      return renderCalls === 1
        ? Promise.resolve({ regionTooLarge: true, featureCount: 1500 })
        : Promise.resolve(makeFeatureData())
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // featureCount=1500 chosen so density × bpPerPx is in (1, 3) at the
    // initial bpPerPx — trips at limit=1 but not at the tripled limit=3
    // after force load. Derived banner recomputes immediately — no
    // imperative flag to clear.
    display.setFeatureDensityStatsLimit()
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  // Regression: the banner state must read through the derived regionTooLarge
  // getter, not the imperative regionTooLargeState. Reading the volatile
  // directly returned false/'' even when the canvas-derived banner was true, so
  // the banner UI (DisplayChrome renders TooLargeMessage off regionTooLarge) and
  // SVG export (regionCannotBeRenderedText) both silently went missing.
  it('banner UI surfaces reflect derived regionTooLarge', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    expect(display.regionCannotBeRenderedText()).toBe(
      'Force load to see features',
    )
  })

  it('laidOutDataMap is empty while regionTooLarge is true', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // Empty layout means the GPU upload autorun has nothing to push, so
    // there's no chance of a stale-feature flash through the banner.
    expect(display.laidOutDataMap.size).toBe(0)
  })

  it('byte-estimate banner stays stable across viewport change (no flicker)', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    // featureDensityStats is preserved across clearAllRpcData (it's not in
    // the clearing path), so the derived banner stays true on viewport
    // change. The FetchVisibleRegions autorun is gated on regionTooLarge,
    // so no new RPC calls happen.
    const callCountBefore = mockRpcCall.mock.calls.length
    view.zoomTo(55)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(mockRpcCall.mock.calls.length).toBe(callCountBefore)
  })

  // Regression: zoom out until the byte estimate trips, then zoom back into a
  // small region. The byte estimate is a snapshot measured at the zoomed-out
  // span, and it survives the viewport-change clearAllRpcData. Reading it raw
  // kept bytesEstimateTooLarge true forever — and FetchVisibleRegions won't
  // re-estimate while regionTooLarge holds, so the banner stuck permanently.
  // Scaling the estimate to the current span lets it drop below the limit on
  // zoom-in, reopening the gate so a real re-estimate clears the banner.
  it('byte-estimate banner self-releases on zoom back in', async () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view, mockRpcCall } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])

    // Byte estimate scales with the queried span (bytesPerBp=2): ~10MB zoomed
    // out, ~100kB zoomed in. Limit is 5MB.
    mockRpcCall.mockImplementation(makeByteGatedRender(2))

    // Zoom all the way out: the full 5Mbp span estimates ~10MB > 5MB.
    view.zoomTo(view.maxBpPerPx)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    const callsWhileTooLarge = mockRpcCall.mock.calls.length

    // Zoom back into ~50kB: the scaled estimate drops below the limit, the
    // gate reopens, a real re-estimate runs, and the banner clears.
    view.zoomTo(62.5)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBeGreaterThan(0)
    })
    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsWhileTooLarge)
  })
})

// Regression: setFeatureDensityStatsLimit used to set EITHER userByteSizeLimit
// OR userFeatureDensityLimit but never clear the other one. A stale value left
// behind silently disables the path that didn't get re-set:
//   - userByteSizeLimit !== undefined makes maxFeatureDensity return undefined,
//     which makes the density branch a no-op AND makes densityTooLarge always
//     return false even when feature counts are huge.
//   - A leftover userFeatureDensityLimit keeps relaxing density gating after
//     the user has switched to a byte-driven force-load.
describe('setFeatureDensityStatsLimit gate toggling', () => {
  function createLargeDisplay() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    view.zoomTo(62.5)
    return { display, view, mockRpcCall: env.mockRpcCall }
  }

  it('byte → density toggle clears stale userByteSizeLimit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    // Seed density stats so the density branch has an observedMax to base on.
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.densityStatsPerRegion.size).toBe(1)
    })

    // First: bytes force-load — sets userByteSizeLimit.
    display.setFeatureDensityStatsLimit({ bytes: 1_000_000 })
    expect(display.userByteSizeLimit).toBeDefined()

    // Then: density force-load. The pre-fix bug was that userByteSizeLimit
    // still being set made maxFeatureDensity return undefined, so the density
    // branch silently no-op'd. After the fix both gates are cleared first,
    // letting the density branch see the real maxFeatureDensity and set a
    // fresh userFeatureDensityLimit.
    display.setFeatureDensityStatsLimit()
    expect(display.userByteSizeLimit).toBeUndefined()
    expect(display.userFeatureDensityLimit).toBeDefined()
  })

  it('density → byte toggle clears stale userFeatureDensityLimit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.densityStatsPerRegion.size).toBe(1)
    })

    display.setFeatureDensityStatsLimit()
    expect(display.userFeatureDensityLimit).toBeDefined()

    display.setFeatureDensityStatsLimit({ bytes: 1_000_000 })
    expect(display.userFeatureDensityLimit).toBeUndefined()
    expect(display.userByteSizeLimit).toBeDefined()
  })
})

// 'auto' label visibility must be a pure function of cached per-region counts ×
// the current bpPerPx (same derivation as the regionTooLarge banner). The old
// imperative scalar was only recomputed on refetch, so zooming into a sparse
// region without triggering a new fetch left labels hidden from the prior
// zoomed-out density.
// Zoom, then settle the debounced coarseBpPerPx the density/collapse gates read
// (production updates it via a 500ms autorun; here we sync it deterministically
// rather than pumping fake timers, which also requires view.initialized).
function zoomAndSettle(view: LinearGenomeViewModel, bpPerPx: number) {
  view.zoomTo(bpPerPx)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
}

describe('showLabels auto density gate', () => {
  function setup() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    // Never-resolving RPC: a fetch may be scheduled by the autorun but its
    // applyFetchResults never runs, so the manually-seeded density stats are
    // the only ones in play — isolating the derived getter from refetch.
    env.mockRpcCall.mockReturnValue(new Promise(() => {}))
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    return { display, view, mockRpcCall: env.mockRpcCall }
  }

  // 500 features across 50kb → 0.01 features/bp, so screenDensity = 0.01 ×
  // bpPerPx and the 0.2 label threshold trips above bpPerPx ≈ 20.
  it('reacts to zoom from cached stats without a refetch', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })

    // zoomTo(62.5) → bpPerPx > 20 → density > 0.2 → labels hidden
    zoomAndSettle(view, 62.5)
    expect(view.bpPerPx).toBeGreaterThan(20)
    expect(display.showLabels).toBe(false)

    // zoomTo(10) → bpPerPx ≈ 10 → density ≈ 0.1 < 0.2 → labels shown, derived
    // purely from the unchanged cached count × the new bpPerPx.
    zoomAndSettle(view, 10)
    expect(view.bpPerPx).toBeLessThan(20)
    expect(display.showLabels).toBe(true)
    expect(display.densityStatsPerRegion.get(0)?.featureCount).toBe(500)
  })

  it('mode "on" shows labels even above the density threshold', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('on')
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(true)
  })

  it('mode "off" hides labels even at low density', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('off')
    zoomAndSettle(view, 20)
    expect(display.showLabels).toBe(false)
  })

  it('auto density gate hides descriptions together with labels', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  it('manual "off" hides labels but descriptions remain independently controllable', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('off')
    zoomAndSettle(view, 20)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(true)
  })
})

// 'auto' geneGlyphMode collapses genes to their longest coding transcript once
// zoomed out past 100 bp/px; below that every transcript stacks. The 200kb
// region (width 800 → up to 250 bp/px) is wide enough to straddle the
// threshold, unlike the default region.
describe('geneGlyphMode auto collapse', () => {
  function setup() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    env.mockRpcCall.mockReturnValue(new Promise(() => {}))
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 200_000, refName: 'ctgA' },
    ])
    return { display, view }
  }

  it('switches to longestCoding when zoomed out past 100 bp/px', () => {
    const { display, view } = setup()
    expect(display.geneGlyphMode).toBe('auto')

    zoomAndSettle(view, 200)
    expect(view.bpPerPx).toBeGreaterThan(100)
    expect(display.effectiveGeneGlyphMode).toBe('longestCoding')

    zoomAndSettle(view, 50)
    expect(view.bpPerPx).toBeLessThan(100)
    expect(display.effectiveGeneGlyphMode).toBe('all')
  })

  it('respects an explicit mode regardless of zoom', () => {
    const { display, view } = setup()
    display.setGeneGlyphMode('all')
    zoomAndSettle(view, 200)
    expect(display.effectiveGeneGlyphMode).toBe('all')
  })
})

describe('regionKeys/reversedRegions derive from rpcDataMap', () => {
  // Layout groups regions by `assembly:refName`. These keys must follow
  // rpcDataMap (the data actually on screen) rather than loadedRegions, which
  // is cleared on every settings change while canvas preserves rpcDataMap
  // through the refetch window. Deriving from loadedRegions would leave the
  // keys empty in that window, collapsing every region into one layout group.
  it('reports per-region keys while loadedRegions is empty', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const regionA = {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 100,
      reversed: false,
    }
    const regionB = {
      assemblyName: 'volvox',
      refName: 'ctgB',
      start: 0,
      end: 100,
      reversed: true,
    }
    display.setRpcData(0, makeFeatureData(), 1, regionA)
    display.setRpcData(1, makeFeatureData(), 1, regionB)

    // No setLoadedRegion was called — this is exactly the post-clear refetch
    // window where rpcDataMap holds data but loadedRegions is empty.
    expect(display.loadedRegions.size).toBe(0)
    expect([...display.regionKeys.entries()]).toEqual([
      [0, 'volvox:ctgA'],
      [1, 'volvox:ctgB'],
    ])
    expect([...display.reversedRegions]).toEqual([1])
  })
})
