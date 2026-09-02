import { setConf } from '@jbrowse/core/configuration'
import { getMembers } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// RenderFeatureData responder that mimics executeRenderFeatureData's byte gate:
// the index estimate scales with the queried span, and a region over
// `byteLimit` short-circuits before any features are "downloaded". Canvas makes
// no other RPC call, so this is the whole mock — including while the banner
// holds, when `FetchVisibleRegions` re-runs this same fetch to re-measure and it
// short-circuits here for an index read's worth of work (RegionTooLargeMixin
// §"Measurement follows the viewport").
//
// A span-proportional estimate is the friendly case for the gate, and
// deliberately so: these tests are about the wiring. Real index estimates are
// quoted in whole blocks and go flat, which is why nothing downstream of the
// worker scales one by span any more — see AUTO_FORCE_LOAD_BP.
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

// CanvasFeatureGateMixin contributes `gateEnabled`, and `types.compose`
// resolves a member collision to the LATER argument, so the gate is on only
// while the mixin is composed after `MultiRegionDisplayMixin`.
// `no-restricted-syntax` fails the other order; this is the runtime pin under
// it.
test('the gate opt-in survives the display composition order', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.gateEnabled).toBe(true)
})

// This display overrides `reload()` to fetch straight away instead of waiting out
// the autorun's 600ms debounce, and for a year that override also skipped the
// `reloadCounter` bump — which is the only thing arming the dead-Retry check, so
// the check was off here and on `LinearVariantDisplay` with it. Nothing was
// visibly wrong, which is the whole problem: the button worked, the autoruns
// fired, and the check simply never spoke.
//
// The source-level companion is
// `plugin-linear-genome-view`'s `reloadReachesCounter.test.ts`; this is the
// runtime half, on the display the miss was found on.
test('reload() bumps reloadCounter, which is what arms the retry check', () => {
  const { display } = createTestEnvironment().createDisplay()
  const before = display.reloadCounter
  display.reload()
  expect(display.reloadCounter).toBe(before + 1)
})

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('regionHasData')
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
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('network failure')
    reported.mockRestore()

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
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    // First fetch fails
    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('network failure')
    reported.mockRestore()

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

  // The one bpPerPx-dependent worker decision is the amino-acid overlay, so
  // `zoomFetchKey` is that threshold rather than the zoom — a zoom staying on
  // one side of it reuses the features, and one crossing it refetches. Both
  // zoom IN from a coarser first fetch, so the viewport stays inside the loaded
  // region and `viewportWithinLoadedData` cannot be what explains either result.
  describe('the peptide threshold is the only zoom that refetches', () => {
    // 2 bp/px is above PEPTIDE_BACKGROUND_MAX_BP_PER_PX, so the first fetch
    // carries no amino-acid overlay
    async function loadedAboveTheThreshold() {
      const { createDisplay, mockRpcCall } = createTestEnvironment()
      mockRpcCall.mockResolvedValue(makeFeatureData())
      const { display, view } = createDisplay()
      view.zoomTo(2)

      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
      await waitFor(() => {
        expect(display.loadedRegions.size).toBe(1)
      })
      return { display, view, mockRpcCall }
    }

    it('does not refetch on a zoom that stays above it', async () => {
      const { display, view, mockRpcCall } = await loadedAboveTheThreshold()
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(1.5)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    })

    it('refetches on a zoom that crosses it', async () => {
      const { display, view, mockRpcCall } = await loadedAboveTheThreshold()
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(0.5)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      await waitFor(() => {
        expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
      })
    })

    // The worker fetches peptides only under `showAminoAcids` as well, so with
    // the overlay off the crossing produces identical output and a variant or
    // BED track used to refetch every region at base zoom for nothing.
    it('does not refetch on a crossing zoom with amino acids off', async () => {
      const { display, view, mockRpcCall } = await loadedAboveTheThreshold()
      // a settings change of its own, so let its refetch settle first
      view.setShowAminoAcids(false)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(0.5)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      expect(display.zoomFetchKey).toBe('false')
      expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
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

  // The multi-region twin of the test above. A refusal here ends the batch
  // early, and `cancelFetch` bumps `fetchGeneration`, so the autorun re-runs at
  // once — against a gate that has to be holding the verdict and the viewport
  // stamp already, or the plan re-issues every region forever.
  //
  // What this pins is that outcome, not the commit-before-cancel order that
  // produces it: the mocked RPC resolves rather than aborting, so a batch that
  // cancelled first would still reach its commit here. `fetchEachRegion.test.ts`
  // is where the order itself is pinned.
  it('does not loop after a refusal ends a multi-region batch early', async () => {
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
    view.showAllRegions()

    // 200 bytes/bp × 1.5Mbp = 300MB per region, so the first to land refuses
    env.mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    // the banner is up and nothing was stored behind it
    expect(display.loadedRegions.size).toBe(0)

    const callCount = env.mockRpcCall.mock.calls.length
    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(env.mockRpcCall.mock.calls.length).toBe(callCount)
  })

  // Force-load is the other way out, and the one a cancelled batch could
  // plausibly have broken: the regions it never issued hold no data and are not
  // marked loaded, so the exempt refetch has to ask for all of them again.
  it('force load refetches every region a cancelled batch skipped', async () => {
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
    view.showAllRegions()

    env.mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.loadedRegions.size).toBe(0)

    // forceLoad() reloads on its own
    display.forceLoad()
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(3)
    })
  })

  // Zooming in is the way out of the banner, and the short circuit must not
  // block it: the cancelled batch stamped the viewport it measured, so a new
  // viewport reads as unmeasured and re-fetches.
  it('releases the banner when a later viewport fits', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    mockRpcCall.mockImplementation(makeByteGatedRender(1))
    view.zoomTo(1)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
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

// Neither gate budget may be an RPC cache key. They are resolved values that go
// undefined the moment their axis stops gating — `densityGateActive` still folds
// in AUTO_FORCE_LOAD_BP, so `maxFeatureDensity` swings at 20 kb — and as cache
// keys that made `SettingsInvalidate` fire `clearAllRpcData()` at that one zoom,
// blanking and refetching the display for data identical on both sides of the
// floor. They ride as call-site arguments now; the config slots they resolve
// from stay in the payload, so a real settings change still invalidates.
describe('gate budgets are not RPC cache keys', () => {
  it('keeps the cache key stable across the force-load floor', () => {
    const { display, view } = createLargeDisplay()

    view.zoomTo(62.5)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.resolvedByteLimit()).toBeDefined()
    expect(display.maxFeatureDensity).toBeDefined()
    const above = display.rpcPropsCacheKey

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    // the density budget goes undefined — that is the floor's whole remaining
    // job — while the byte budget stays put, since the byte axis has no floor
    expect(display.maxFeatureDensity).toBeUndefined()
    expect(display.resolvedByteLimit()).toBeDefined()
    expect(display.rpcPropsCacheKey).toBe(above)
  })

  it('keeps the cache key stable when a budget slot is edited', () => {
    // The raw slots used to ride in the payload (`gateSlots`) purely to make a
    // budget edit a refetch. That invalidation was redundant — an edit reaches
    // the verdict through tracked reads (see the test below) — and worse: it
    // threw away regions that were loaded and in budget.
    const { display, view } = createLargeDisplay()
    view.zoomTo(62.5)
    const before = display.rpcPropsCacheKey

    setConf(display, 'maxFeatureScreenDensity', 42)
    setConf(display, 'fetchSizeLimit', 12_345)
    expect(display.rpcPropsCacheKey).toBe(before)
  })

  it('a raised fetchSizeLimit releases the gate through the verdict', async () => {
    // The property that makes the budgets safe to keep out of the cache key
    // entirely: a refused region was never marked loaded, the fetch autorun
    // tracks `regionTooLarge`, so the edit alone re-fires the fetch with the
    // new budget at the call site.
    const { display, mockRpcCall } = createLargeDisplay()
    // bytesPerBp=200 over the 50kb region → ~10MB, past the 5MB limit
    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.loadedRegions.size).toBe(0)

    setConf(display, 'fetchSizeLimit', 100_000_000)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
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

    // The new viewport has never been measured, so the autorun runs the fetch
    // once to ask — the worker short-circuits on the density gate and returns
    // without downloading features. That one call is the whole re-measure, and
    // there is exactly one: `gateMeasurementStale` goes false as soon as it
    // commits, so the `fetchGeneration` bump can't start another.
    view.zoomTo(55)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(mockRpcCall.mock.calls.length).toBe(callCount + 1)

    // and settling at that viewport costs nothing more
    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()
    expect(mockRpcCall.mock.calls.length).toBe(callCount + 1)
  })

  // Settings are a term of the measurement, not just of the data. The worker's
  // density probe counts ADMITTED features (`densityGate`'s `admit` — the
  // parameter exists so a filtered view cannot be refused on a population it
  // filters away), so a filter is a different question about the same viewport.
  // While staleness was viewport-only the main thread never went back to ask:
  // `SettingsInvalidate` cleared the data, `clearAllRpcData` deliberately keeps
  // `densityStatsPerRegion`, and the banner held at zero RPCs.
  it('re-measures when a filter changes under the banner', async () => {
    const { display, mockRpcCall } = createLargeDisplay()
    mockRpcCall.mockResolvedValue({ regionTooLarge: true, featureCount: 5000 })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.gateMeasurementStale).toBe(false)
    const callCount = mockRpcCall.mock.calls.length

    // a filter admitting nothing — the count the worker answers with is the
    // count under it
    mockRpcCall.mockResolvedValue(makeFeatureData())
    setConf(display, 'jexlFilters', ["jexl:get(feature,'type')=='nothing'"])
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callCount + 1)
    expect(display.regionTooLarge).toBe(false)
  })

  // The two axes disagree about whether zooming helps, and the banner has to
  // ask the one that actually tripped. A dense VCF is the shape that separates
  // them — small on disk and flat across zooms, so the byte estimate stops
  // moving while the feature count is still far past what there are pixels to
  // draw. The worker reports `bytes` alongside a density rejection, so the
  // estimate keeps updating while blocked and `zoomIneffective` accumulates
  // evidence about an axis that isn't gating. Reading that flag on its own —
  // which `zoomCanReleaseGate` used to do — dropped "Zoom in to see features"
  // off a banner that zooming does release.
  it('keeps offering zoom on a density block once the bytes go flat', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 500_000, refName: 'ctgA' },
    ])
    // a density rejection carrying a byte figure that never moves, and one well
    // under the 5MB display cap so the byte axis has no opinion at any zoom
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 50_000,
      bytes: 200_000,
    })

    view.zoomTo(1000)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    const wideSpan = view.visibleBp

    // halve the span — the index quotes the same bytes back
    view.zoomTo(250)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.byteEstimate?.zoomIneffective).toBe(true)
    })
    // the preconditions the evidence rule needs, asserted rather than assumed
    expect(view.visibleBp).toBeLessThanOrEqual(wideSpan / 2)
    expect(view.visibleBp).toBeGreaterThan(20_000)

    // density is what is blocking, not bytes...
    expect(display.regionTooLargeReason).toBe('Too many features')
    // ...and screen density falls with bpPerPx by construction, so zoom is
    // still an honest way out however flat this file's index is
    expect(display.zoomCanReleaseGate).toBe(true)
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

    // byteEstimate is preserved across clearAllRpcData (it's not in the
    // clearing path), so the banner does not blink off while the new viewport
    // is measured — and it is measured, once, because the gate only ever
    // releases on a measurement. No flicker, one index read.
    const callCountBefore = mockRpcCall.mock.calls.length
    view.zoomTo(55)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(mockRpcCall.mock.calls.length).toBe(callCountBefore + 1)
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

  it('a pinned rung shows names even above the density threshold', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('nameAndDescription')
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(true)
  })

  it('"none" hides names even at low density', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('none')
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

  // The rung between the two thresholds: descriptions drop at 0.1 features/px
  // (bpPerPx ≈ 10 here), names not until 0.2 (bpPerPx ≈ 20), so zooming out
  // degrades name + description → name → nothing rather than all-or-nothing.
  it('auto drops descriptions a zoom tier before names', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })

    // density ≈ 0.05 — under both thresholds
    zoomAndSettle(view, 5)
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(true)

    // density ≈ 0.15 — over the description threshold, under the label one
    zoomAndSettle(view, 15)
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  // A config that inverts the thresholds must not paint descriptions after the
  // names they hang off are gone — the tighter of the pair wins.
  it('never leaves descriptions on past the label threshold', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    setConf(display, 'maxDescriptionFeatureDensity', 10)
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  // The rung the old showLabels:'off' + showDescriptions:true pair rendered by
  // accident, now a choice with a name: description text, no name, at any zoom.
  it('"description" paints descriptions with no name, past the density gate', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('description')
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(true)
  })

  // `n` one-bp features spread evenly across the region, so the count the gate
  // divides by the viewport width is exactly `n`.
  function featuresOver(n: number, start: number, end: number) {
    const step = (end - start) / n
    return makeFeatureData({
      flatbushItems: Array.from({ length: n }, (_, i) => {
        const at = Math.round(start + i * step)
        return makeFlatbushItem({
          featureId: `f${i}`,
          startBp: at,
          endBp: at + 1,
        })
      }),
    })
  }

  // Both arms hold the region average and the on-screen count in DISAGREEMENT,
  // so each one fails if the gate reads the other number (ADR-093).
  it('keeps names where the on-screen count is sparse and the average is not', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setRpcData(0, featuresOver(4, 0, 50_000), {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 50_000,
    })
    zoomAndSettle(view, 62.5)

    // 0.625/px averaged over the fetched span, 4/800 = 0.005/px on screen
    expect(display.visibleFeatureDensityPerPx).toBeGreaterThan(0.2)
    expect(display.labelDensityPerPx).toBeLessThan(0.2)
    expect(display.showLabels).toBe(true)
  })

  it('drops names where the on-screen count is crowded and the average is not', () => {
    const { display, view } = setup()
    display.setRpcData(0, featuresOver(200, 0, 50_000), {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 50_000,
    })
    zoomAndSettle(view, 62.5)

    expect(display.visibleFeatureDensityPerPx).toBe(0)
    expect(display.labelDensityPerPx).toBeCloseTo(200 / 800)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  // Nothing fetched yet, or a view restored without coarse blocks: there is no
  // window to divide by, so the region average stands in.
  it('falls back to the region average with no on-screen set', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    zoomAndSettle(view, 62.5)

    expect(display.onScreenFeatureIds).toBeUndefined()
    expect(display.labelDensityPerPx).toBe(display.visibleFeatureDensityPerPx)
    expect(display.showLabels).toBe(false)
  })
})

// 'auto' geneGlyphMode collapses genes to one representative transcript once
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

describe('region identity is stored with the data it describes', () => {
  // Layout groups regions by `assembly:refName`, and reads that key off the
  // stored region (see `LayoutRegionData`). It must follow rpcDataMap — the data
  // actually on screen — rather than loadedRegions, which is cleared on every
  // settings change while canvas preserves rpcDataMap through the refetch
  // window. Deriving it from loadedRegions would leave it empty in that window,
  // collapsing every region into one layout group.
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
    display.setRpcData(0, makeFeatureData(), regionA)
    display.setRpcData(1, makeFeatureData(), regionB)

    // No setLoadedRegion was called — this is exactly the post-clear refetch
    // window where rpcDataMap holds data but loadedRegions is empty.
    expect(display.loadedRegions.size).toBe(0)
    expect(
      [...display.rpcDataMap.entries()].map(([idx, d]) => [idx, d.regionKey]),
    ).toEqual([
      [0, 'volvox:ctgA'],
      [1, 'volvox:ctgB'],
    ])
    expect([...display.reversedRegions]).toEqual([1])
  })
})

// The payload is a PICK of what the worker reads (`pickDisplayConfig`), so this
// list is the whole of what a config edit can send it. Asserted as an exact set,
// which is what makes it the guard the per-slot table below used to be: under the
// subtractive spelling this replaced, a slot named in neither `DisplayConfig` nor
// a hand-kept exclusion list joined the payload silently, and the rows below
// could only catch the ones someone had thought to write down.
//
// Adding a worker slot means editing `DisplayConfig` and this list together —
// which is the whole of the additive contract, and cheap. Adding a MAIN-THREAD
// slot, to this display or to any schema it inherits, means editing neither.
test('the worker payload is exactly the slots DisplayConfig declares', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  expect(Object.keys(display.rpcProps().displayConfig).sort()).toEqual([
    'canonicalTranscriptField',
    'canonicalTranscriptTags',
    'color',
    'connectorColor',
    'containerTypes',
    'displayDirectionalChevrons',
    'featureHeight',
    'geneGlyphMode',
    'hideSourceFeatures',
    'impliedUTRs',
    'jexlFilters',
    'labels',
    'mouseover',
    'outlineColor',
    'subParts',
    'subfeatureLabels',
    'transcriptTypes',
    'utrColor',
  ])
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
    const { display, view } = createDisplay()
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    return { display, view, mockRpcCall }
  }

  it.each([
    ['showLabels', 'none'],
    // Height and its bounds, all three. The isoform trim is the fit ladder's
    // now, so nothing about the track's size reaches the worker at all
    // (ADR-092) — which is the property the resize handle needs, since it
    // writes `height` every drag frame.
    ['height', 600],
    ['heightMode', 'grow'],
    ['growMaxHeight', 900],
    // the main-thread `showLabels` auto gate — layout reserves label rows from
    // it, the worker never sees it
    ['maxLabelFeatureDensity', 0.05],
    ['maxDescriptionFeatureDensity', 0.01],
    // The declared color key, drawn by the `colorLegend` chrome hook. The last
    // member of `rpcProps`'s exclusion list to get a row here, and the one whose
    // absence mattered most: editing a legend entry used to clear and refetch
    // every region to redraw a floating box, and nothing but that list stood
    // between the fix and a regression.
    ['legend', [{ label: 'SINE', color: '#e41a1c' }]],
  ])('a main-thread-only %s change does not refetch', async (slot, value) => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot(slot, value)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    expect(display.loadedRegions.size).toBe(1)
  })

  // Every display mode but `collapsed` is a main-thread height scale, and
  // `collapsed` refetches for a reason of its own (it forces subfeatureLabels
  // off — see below). A compact row used to buy the lane isoform rows and so
  // reach the payload through the cap; nothing does now.
  it('a compact displayMode does not refetch', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot('displayMode', 'compact')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // `subfeatureLabels` still reaches the worker — it bakes the label — so this
  // one refetches. Here because its neighbour above no longer does, and the
  // pair is the whole of what a row-height setting can and cannot do.
  it('a below subfeature label still refetches', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot('subfeatureLabels', 'below')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  // The resolved `maxFeatureDensity` rides at the call site, not in the payload
  // (it swings on the viewport — see "gate budgets are not RPC cache keys"),
  // and the raw slot is not a cache key either. Lowering the budget on a
  // loaded track re-banners from the density stats every successful fetch
  // already committed — no refetch, since the main thread holds everything the
  // verdict needs, and the data stays loaded under the banner.
  it('a lowered density budget re-banners from stored stats without a refetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    // 100 features / 500kb at bpPerPx 1000 → ~0.2 features/px: under the
    // default budget of 1, over the lowered one below
    mockRpcCall.mockResolvedValue(makeFeatureData({ featureCount: 100 }))
    const { display, view } = createDisplay()
    // zoomed out past AUTO_FORCE_LOAD_BP, so the density axis has an opinion at
    // all (below the floor `maxFeatureDensity` is undefined by design)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 500_000, refName: 'ctgA' },
    ])
    view.zoomTo(1000)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.maxFeatureDensity).not.toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
    const callsBefore = mockRpcCall.mock.calls.length

    setConf(display, 'maxFeatureScreenDensity', 1e-6)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(display.loadedRegions.size).toBe(1)
    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
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

// Regression: the byte commit must anchor the estimate to the span captured
// when the fetch was ISSUED — `fetchEachRegion` reads `gateFetchState()` before
// it issues anything, for exactly this. Reading `view.visibleBp` back when the
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

    const issuedSpanBp = display.gateViewport!.spanBp
    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    // User zooms in while the fetch is outstanding. Kept above
    // AUTO_FORCE_LOAD_BP so the zoom is unambiguously about the anchoring this
    // test is here for: the gate budgets no longer ride in `rpcProps`, so
    // crossing the floor mid-flight wouldn't supersede the fetch either way.
    view.zoomTo(500)
    expect(view.visibleBp).toBeLessThan(issuedSpanBp / 2)
    expect(view.visibleBp).toBeGreaterThan(20_000)

    release({ ...makeFeatureData(), bytes: 4_000_000 })
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.byteEstimate?.bytes).toBe(4_000_000)
    })
    expect(display.byteEstimate?.measuredSpanBp).toBe(issuedSpanBp)
    // the number itself is untouched — nothing scales it — and it is under the
    // 5MB config cap, so the banner stays down
    expect(display.estimatedFetchBytes).toBe(4_000_000)
    expect(display.regionTooLarge).toBe(false)
    // the mid-flight zoom is not evidence about zoom, because the bytes describe
    // the wider span the fetch was issued at
    expect(display.zoomCanReleaseGate).toBe(true)
  })
})
