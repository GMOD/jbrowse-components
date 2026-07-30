import { getMembers } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// RenderFeatureData responder that mimics executeRenderFeatureData's byte gate:
// the index estimate scales with the queried span, and a region over
// `byteLimit` short-circuits before any features are "downloaded". Canvas
// makes no other RPC call, so this is the whole mock.
function makeByteGatedRender(bytesPerBp: number) {
  return (
    _sessionId: string,
    _method: string,
    args: { region: { start: number; end: number }; byteLimit?: number },
  ) => {
    const bytes = Math.round((args.region.end - args.region.start) * bytesPerBp)
    return Promise.resolve(
      args.byteLimit !== undefined && bytes > args.byteLimit
        ? { regionTooLarge: true as const, bytes }
        : { ...makeFeatureData(), bytes },
    )
  }
}

// A display zoomed so visibleBp = 62.5 * 800 = 50,000 > AUTO_FORCE_LOAD_BP
// (20,000), i.e. inside the force-load zone where the byte/density gate engages.
// Pass a custom env to exercise adapter-config-dependent behavior.
function createLargeDisplay(env = createTestEnvironment()) {
  const { display, view, mockRpcCall } = env.createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
  ])
  view.zoomTo(62.5)
  return { display, view, mockRpcCall }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// CanvasFeatureGateMixin contributes the opt-in additively, via
// `gateFoldedIntoFetch`, which RegionTooLargeMixin ORs into
// `derivedRegionTooLargeEnabled` alongside the pre-flight `byteGateEnabled` — so
// the gate stays on regardless of the order the two are composed in. This test
// is the pin on that (it used to pin the composition order itself, which was the
// only thing keeping the gate alive).
test('the gate opt-in survives regardless of mixin composition order', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.byteGateEnabled).toBe(false)
  expect(display.derivedRegionTooLargeEnabled).toBe(true)
})

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
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

    // Now simulate "Force Load": exempt the track, then reload.
    display.setForceLoadTrack(true)
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

    // waitFor, not a bare read: fetchRegions consults the byte gate (an async
    // action) before the RPC, so the call lands a microtask after the timer
    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
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

// AUTO_FORCE_LOAD_BP is 20,000 — use a 50,000 bp region to clear the gate floor
describe('byte estimate pre-check', () => {
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

    // Force load exempts the track, so the next fetch
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

// The byte gate must honor an adapter-declared fetchSizeLimit above the display
// config, the same precedence `gateByteLimit` gives the pre-flight path
// (alignments/LD/wiggle). Regression: canvas used to gate on the display config
// alone, so a VcfTabixAdapter.fetchSizeLimit was a silent no-op in feature mode.
describe('adapter fetchSizeLimit in the byte gate', () => {
  // 200 bytes/bp × 50kb ≈ 10MB: over the 5MB display config, under a 50MB adapter
  // limit → the adapter limit must let it through.
  it('lets a region through that fits the adapter limit but not the display config', async () => {
    const { display, mockRpcCall } = createLargeDisplay(
      createTestEnvironment({ adapterFetchSizeLimit: 50_000_000 }),
    )

    expect(display.adapterFetchSizeLimit).toBe(50_000_000)
    expect(display.resolvedByteLimit()).toBe(50_000_000)

    mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
    // the banner resolves the same budget the worker gated on — both read the
    // adapter slot on the main thread, so no echo through the estimate is
    // needed to keep them in step
    expect(display.gateByteLimit).toBe(50_000_000)
  })

  // Control: no adapter limit → the display config (5MB) gates, so the same
  // ~10MB region is too large.
  it('falls back to the display config when the adapter declares no limit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    expect(display.adapterFetchSizeLimit).toBeUndefined()
    expect(display.resolvedByteLimit()).toBe(display.configuredFetchSizeLimit)

    mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
  })
})

// Derived regionTooLarge: stays a pure function of the cached density stats
// and byte estimate at the current bpPerPx. These tests pin down the behavior
// the imperative path used to get wrong (banner flicker on small zoom, refetch
// loops, stale estimates across chromosome navigation).
//
// Geometry: width=800, region=50kbp. view.visibleBp ≈ 406 × bpPerPx empirically
// (sum of visible region span clipped to viewport). AUTO_FORCE_LOAD_BP=20_000
// → density gate engages above bpPerPx ≈ 50. maxFeatureScreenDensity default=1.
describe('derived regionTooLarge', () => {
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
    // byteEstimate must survive so the derived banner stays stable.
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
    expect(display.byteEstimate).toBeUndefined()
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

    // Force-load exempts the track outright, so
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
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  // Regression: the banner UI surfaces must read through the derived
  // regionTooLarge getter. (Historically a parallel imperative flag could return
  // false/'' even when the derived banner was true, silently dropping the banner
  // — that flag has since been removed, but this still guards the derived path
  // feeding DisplayChrome's TooLargeMessage.)
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

    expect(display.regionTooLargeReason).toBe('Too many features')
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

    // byteEstimate is preserved across clearAllRpcData (it's not in
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

// Force-load is one track-wide boolean, so the whole class of bug these tests
// used to guard — a per-axis ceiling that could be installed BELOW the standing
// budget, or left stale on the axis that didn't trip — is now unrepresentable.
// What's left to pin is that one click exempts BOTH axes and that it never
// perturbs the budget it bypasses, so revoking restores the original gate
// exactly.
describe('force-load exempts the whole track', () => {
  it('clears a density rejection without disturbing the byte budget', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    // Density-too-large AND a small index-byte estimate (100KB, well under the
    // config limit) — exactly what a dense VCF/BAM region returns. The old
    // failure mode was adopting that 100KB as a byte ceiling.
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 1500,
      bytes: 100_000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.byteEstimate?.bytes).toBe(100_000)
    const budgetBefore = display.gateByteLimit

    display.forceLoad()

    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    // both axes off, and the standing budget is untouched — so a revoke puts the
    // gate back exactly as it was
    expect(display.resolvedByteLimit()).toBeUndefined()
    expect(display.maxFeatureDensity).toBeUndefined()
    expect(display.gateByteLimit).toBe(budgetBefore)

    display.setForceLoadTrack(false)
    expect(display.resolvedByteLimit()).toBe(budgetBefore)
    expect(display.regionTooLarge).toBe(true)
  })

  // The production VcfTabix case: the adapter declares a 50MB fetchSizeLimit and
  // a dense-but-small region trips density. The adapter's ceiling must survive
  // the round trip through force-load.
  it('preserves an adapter ceiling across force-load and revoke', async () => {
    const { display, mockRpcCall } = createLargeDisplay(
      createTestEnvironment({ adapterFetchSizeLimit: 50_000_000 }),
    )
    expect(display.resolvedByteLimit()).toBe(50_000_000)

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 1500,
      bytes: 100_000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.forceLoad()
    expect(display.resolvedByteLimit()).toBeUndefined()

    display.setForceLoadTrack(false)
    expect(display.resolvedByteLimit()).toBe(50_000_000)
  })

  // The track-wide property: approval is not per-locus, so navigating to another
  // chromosome must not silently re-arm the gate and re-prompt.
  it('survives chromosome navigation', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 10_000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 40_000, refName: 'ctgA' },
    ])
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
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

// The SettingsInvalidate cache key is what rpcProps() *returns*, not what it
// reads. rpcProps builds its payload from a whole config snapshot
// (getConfigSnapshotWithPromotables), which touches every slot on the display
// config — so a read-tracked invalidation refetched the track whenever a purely
// main-thread setting changed, despite those slots being deliberately excluded
// from the payload.
describe('SettingsInvalidate keys on the payload, not the reads', () => {
  async function loadedDisplay() {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    return { display, mockRpcCall }
  }

  it.each([
    ['showLabels', 'off'],
    ['showDescriptions', false],
    ['heightMode', 'grow'],
    ['displayMode', 'compact'],
  ])('a main-thread-only %s change does not refetch', async (slot, value) => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot(slot, value)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    expect(display.loadedRegions.size).toBe(1)
  })

  it('a worker-visible change still refetches', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.setShowOnlyGenes(true)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(mockRpcCall.mock.calls.at(-1)![2]).toMatchObject({
      showOnlyGenes: true,
    })
  })

  it('collapsed displayMode refetches, because it forces subfeatureLabels off', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    // subfeatureLabels resolves to 'none' by default, where the collapsed
    // substitution is a no-op; make it visible so collapsing actually changes
    // the payload
    display.configuration.setSlot('subfeatureLabels', 'below')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot('displayMode', 'collapsed')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

// Regression: `commitGateMeasurements` must anchor the estimate to the span
// captured when the fetch was ISSUED. Reading `view.visibleBp` back when the
// reply lands re-anchors a wide-span measurement onto whatever a mid-flight
// zoom left on screen, inflating the estimate by the zoom ratio — and since
// `FetchVisibleRegions` skips while `regionTooLarge` holds, the resulting
// banner wedges with no refetch to correct it.
describe('byte estimate anchoring across an in-flight zoom', () => {
  it('keeps the span the fetch was issued at, not the span at reply time', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    // a wide region, so the mid-flight zoom has room to shrink the span a lot
    // while staying above AUTO_FORCE_LOAD_BP
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])
    view.zoomTo(2000)

    // hold the RPC open so the viewport can move while it is in flight
    let release: (v: unknown) => void = () => {}
    mockRpcCall.mockImplementation(
      () =>
        new Promise(resolve => {
          release = resolve
        }),
    )

    const issuedSpanBp = view.visibleBp
    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    // User zooms in while the fetch is outstanding, staying above
    // AUTO_FORCE_LOAD_BP: crossing that floor flips `maxFeatureDensity` to
    // undefined, and since it rides in `rpcProps`, SettingsInvalidate would
    // supersede this fetch instead of letting it commit.
    view.zoomTo(500)
    expect(view.visibleBp).toBeLessThan(issuedSpanBp / 2)
    expect(view.visibleBp).toBeGreaterThan(20_000)

    release({ ...makeFeatureData(), bytes: 4_000_000 })
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.byteEstimate?.bytes).toBe(4_000_000)
    })
    expect(display.byteEstimate?.measuredSpanBp).toBe(issuedSpanBp)
    // scaled down by the zoom, so it stays under the 5MB config cap; anchored
    // to the post-zoom span it would read as the full 4MB at every zoom level
    expect(display.estimatedBytesForVisibleSpan).toBeLessThan(4_000_000)
    expect(display.regionTooLarge).toBe(false)
  })
})
