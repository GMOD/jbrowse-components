import { autorun, observable, runInAction, untracked } from 'mobx'

import type { Region } from '@jbrowse/core/util'

interface DisplayedRegionWithIndex {
  region: Region
  displayedRegionIndex: number
}

function createMockDisplayModel() {
  const state = observable({
    fetchGeneration: 0,

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    error: undefined as unknown,
    regionTooLargeState: false,
    loadedRegions: new Map<number, Region>(),
    loadedBpPerPx: undefined as number | undefined,
    fetchLog: [] as DisplayedRegionWithIndex[][],
  })

  return state
}

function createMockView() {
  const view = observable({
    initialized: true,
    bpPerPx: 10,
    offsetPx: 0,
    width: 800,
    displayedRegions: [
      { refName: 'chr1', start: 0, end: 1000000, assemblyName: 'test' },
    ] as Region[],
  })

  return view
}

function computeStaticRegions(view: ReturnType<typeof createMockView>) {
  const blockSizeBp = 800 * view.bpPerPx
  const windowLeftBp = view.offsetPx * view.bpPerPx
  const windowRightBp = (view.offsetPx + view.width) * view.bpPerPx

  const regions: DisplayedRegionWithIndex[] = []
  for (const [idx, dr] of view.displayedRegions.entries()) {
    const blockStart = Math.floor((windowLeftBp - 0) / blockSizeBp)
    const blockEnd = Math.floor((windowRightBp - 0) / blockSizeBp)
    const start = Math.max(dr.start, blockStart * blockSizeBp)
    const end = Math.min(dr.end, (blockEnd + 1) * blockSizeBp)
    if (end > start) {
      regions.push({
        region: {
          refName: dr.refName,
          start,
          end,
          assemblyName: dr.assemblyName,
        },
        displayedRegionIndex: idx,
      })
    }
  }
  return regions
}

// Strict equality — any bpPerPx change invalidates so every visible
// region refetches together at a consistent bigwig zoom level.
function wiggleIsCacheValid(
  loadedBpPerPx: number | undefined,
  currentBpPerPx: number,
) {
  return loadedBpPerPx === undefined || currentBpPerPx === loadedBpPerPx
}

describe('fetch autorun integration with MobX observables', () => {
  test('initial load triggers fetch for all regions', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: DisplayedRegionWithIndex[][] = []

    const dispose = autorun(() => {
      void model.fetchGeneration
      if (!view.initialized || model.error || model.regionTooLargeState) {
        return
      }

      const staticRegions = computeStaticRegions(view)
      const needed: DisplayedRegionWithIndex[] = []
      for (const vr of staticRegions) {
        const loaded = untracked(() =>
          model.loadedRegions.get(vr.displayedRegionIndex),
        )
        const boundsValid =
          loaded?.refName === vr.region.refName &&
          vr.region.start >= loaded.start &&
          vr.region.end <= loaded.end
        if (boundsValid) {
          continue
        }
        needed.push(vr)
      }
      if (needed.length > 0) {
        fetches.push(needed)
      }
    })

    expect(fetches).toHaveLength(1)
    expect(fetches[0]!.length).toBeGreaterThan(0)

    dispose()
  })

  test('no re-fetch after data is loaded', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: number[] = []

    const dispose = autorun(() => {
      void model.fetchGeneration
      if (!view.initialized || model.error || model.regionTooLargeState) {
        return
      }

      const staticRegions = computeStaticRegions(view)
      const needed: DisplayedRegionWithIndex[] = []
      for (const vr of staticRegions) {
        const loaded = untracked(() =>
          model.loadedRegions.get(vr.displayedRegionIndex),
        )
        const boundsValid =
          loaded?.refName === vr.region.refName &&
          vr.region.start >= loaded.start &&
          vr.region.end <= loaded.end
        if (boundsValid) {
          continue
        }
        needed.push(vr)
      }
      if (needed.length > 0) {
        fetches.push(needed.length)
      }
    })

    expect(fetches).toHaveLength(1)

    // Simulate successful fetch - update loadedRegions
    runInAction(() => {
      const staticRegions = computeStaticRegions(view)
      for (const vr of staticRegions) {
        model.loadedRegions.set(vr.displayedRegionIndex, {
          refName: vr.region.refName,
          start: vr.region.start,
          end: vr.region.end,
          assemblyName: vr.region.assemblyName,
        })
      }
      model.fetchGeneration++
    })

    // autorun re-runs but should not add to fetches
    expect(fetches).toHaveLength(1)

    dispose()
  })

  test('any bpPerPx change (zoom in or out) triggers re-fetch', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: number[] = []

    const dispose = autorun(() => {
      void model.fetchGeneration
      if (!view.initialized || model.error || model.regionTooLargeState) {
        return
      }

      const staticRegions = computeStaticRegions(view)
      const needed: DisplayedRegionWithIndex[] = []
      for (const vr of staticRegions) {
        const loaded = untracked(() =>
          model.loadedRegions.get(vr.displayedRegionIndex),
        )
        const boundsValid =
          loaded?.refName === vr.region.refName &&
          vr.region.start >= loaded.start &&
          vr.region.end <= loaded.end
        if (
          boundsValid &&
          wiggleIsCacheValid(model.loadedBpPerPx, view.bpPerPx)
        ) {
          continue
        }
        needed.push(vr)
      }
      if (needed.length > 0) {
        fetches.push(needed.length)
      }
    })

    expect(fetches).toHaveLength(1)

    // Simulate loading data at bpPerPx=10
    runInAction(() => {
      const staticRegions = computeStaticRegions(view)
      for (const vr of staticRegions) {
        model.loadedRegions.set(vr.displayedRegionIndex, {
          refName: vr.region.refName,
          start: 0,
          end: 1000000,
          assemblyName: vr.region.assemblyName,
        })
      }
      model.loadedBpPerPx = 10
      model.fetchGeneration++
    })

    expect(fetches).toHaveLength(1)

    // Zoom in — any change invalidates
    runInAction(() => {
      view.bpPerPx = 2.5
    })

    expect(fetches).toHaveLength(2)

    // Simulate fetch completing at 2.5
    runInAction(() => {
      model.loadedBpPerPx = 2.5
      model.fetchGeneration++
    })

    // Zoom out — also invalidates (strict equality)
    runInAction(() => {
      view.bpPerPx = 20
    })

    expect(fetches).toHaveLength(3)

    dispose()
  })

  test('error blocks fetch, zoom clears error and retries', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    let fetchCount = 0
    let prevBpPerPx: number | undefined

    const disposeFetch = autorun(() => {
      void model.fetchGeneration
      if (!view.initialized || model.error || model.regionTooLargeState) {
        return
      }
      fetchCount++
    })

    const disposeClear = autorun(() => {
      const { bpPerPx } = view
      if (
        prevBpPerPx !== undefined &&
        bpPerPx !== prevBpPerPx &&
        (model.regionTooLargeState || model.error)
      ) {
        runInAction(() => {
          model.error = undefined
          model.regionTooLargeState = false
          model.fetchGeneration++
        })
      }
      prevBpPerPx = bpPerPx
    })

    expect(fetchCount).toBe(1)

    // Simulate error
    runInAction(() => {
      model.error = new Error('network failed')
    })

    // fetchCount stays at 1 — error blocks re-fetch
    expect(fetchCount).toBe(1)

    // Scroll — doesn't help because error blocks
    runInAction(() => {
      view.offsetPx = 100
    })
    expect(fetchCount).toBe(1)

    // Zoom — clears error and retries
    runInAction(() => {
      view.bpPerPx = 5
    })
    expect(fetchCount).toBe(2)
    expect(model.error).toBeUndefined()

    disposeFetch()
    disposeClear()
  })

  test('regionTooLarge blocks fetch, zoom clears and retries', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    let fetchCount = 0
    let prevBpPerPx: number | undefined

    const disposeFetch = autorun(() => {
      void model.fetchGeneration
      if (!view.initialized || model.error || model.regionTooLargeState) {
        return
      }
      fetchCount++
    })

    const disposeClear = autorun(() => {
      const { bpPerPx } = view
      if (
        prevBpPerPx !== undefined &&
        bpPerPx !== prevBpPerPx &&
        (model.regionTooLargeState || model.error)
      ) {
        runInAction(() => {
          model.error = undefined
          model.regionTooLargeState = false
          model.fetchGeneration++
        })
      }
      prevBpPerPx = bpPerPx
    })

    expect(fetchCount).toBe(1)

    // Simulate regionTooLarge
    runInAction(() => {
      model.regionTooLargeState = true
    })

    expect(fetchCount).toBe(1)

    // Zoom in (might make region small enough)
    runInAction(() => {
      view.bpPerPx = 1
    })

    expect(fetchCount).toBe(2)
    expect(model.regionTooLargeState).toBe(false)

    disposeFetch()
    disposeClear()
  })
})

describe('untracked() semantics', () => {
  interface VisibleBlock {
    refName: string
    start: number
    end: number
    assemblyName: string
    displayedRegionIndex: number
  }

  function makeBlock(
    displayedRegionIndex: number,
    start: number,
    end: number,
    refName = 'chr1',
  ): VisibleBlock {
    return { refName, start, end, assemblyName: 'test', displayedRegionIndex }
  }

  // Mirrors the FetchVisibleRegions autorun in MultiRegionDisplayMixin.afterAttach.
  // Simplifications vs production:
  //   - fetchGeneration matches production name (same bump-at-fetch-end semantics)
  //   - no assembly mismatch check
  //   - uses visible blocks directly (production fetches bufferedVisibleRegions)
  //   - trackLoadedRegions=true removes the untracked() call to test that path
  function setupFetchAutorun(
    state: {
      fetchGeneration: number
      isLoading: boolean
      error: unknown
      regionTooLarge: boolean
      loadedRegions: Map<number, Region>
    },
    view: { initialized: boolean; visibleBlocks: VisibleBlock[] },
    fetchNeeded: (needed: VisibleBlock[]) => void,
    opts: { trackLoadedRegions?: boolean } = {},
  ) {
    return autorun(() => {
      void state.fetchGeneration
      const { visibleBlocks } = view
      if (!view.initialized || state.error || state.regionTooLarge) {
        return
      }
      if (untracked(() => state.isLoading)) {
        return
      }
      const needed: VisibleBlock[] = []
      for (const vr of visibleBlocks) {
        const loaded = opts.trackLoadedRegions
          ? state.loadedRegions.get(vr.displayedRegionIndex)
          : untracked(() => state.loadedRegions.get(vr.displayedRegionIndex))
        const covered =
          loaded?.refName === vr.refName &&
          Math.floor(vr.start) >= loaded.start &&
          Math.ceil(vr.end) <= loaded.end
        if (!covered) {
          needed.push(vr)
        }
      }
      if (needed.length > 0) {
        fetchNeeded(needed)
      }
    })
  }

  describe('untracked(isLoading)', () => {
    test('isLoading flip does not re-trigger fetch autorun', () => {
      const state = observable({
        fetchGeneration: 0,
        isLoading: false,
        regionTooLarge: false,
        loadedRegions: new Map<number, Region>(),
      })
      const view = observable({
        initialized: true,
        visibleBlocks: [makeBlock(0, 0, 100000)],
      })
      let fireCount = 0

      const dispose = autorun(() => {
        void state.fetchGeneration
        void view.visibleBlocks
        if (!view.initialized || state.regionTooLarge) {
          return
        }
        if (untracked(() => state.isLoading)) {
          return
        }
        fireCount++
      })

      expect(fireCount).toBe(1)

      runInAction(() => {
        state.isLoading = true
      })
      expect(fireCount).toBe(1) // isLoading untracked — no re-fire on start

      runInAction(() => {
        state.isLoading = false
      })
      expect(fireCount).toBe(1) // still untracked — no re-fire on end

      dispose()
    })

    // Demonstrates the mechanism that makes untracked(isLoading) safe: even
    // though viewport changes mid-fetch are blocked by the guard, the
    // fetchGeneration bump at fetch completion re-triggers a fresh evaluation
    // for the current (panned) viewport.
    test('viewport pan mid-fetch triggers fetch for new position after completion', () => {
      const state = observable({
        fetchGeneration: 0,
        isLoading: false,
        error: undefined,
        regionTooLarge: false,
        loadedRegions: new Map<number, Region>(),
      })
      const view = observable({
        initialized: true,
        visibleBlocks: [makeBlock(0, 0, 100000)],
      })
      const fetchCalls: VisibleBlock[][] = []

      const dispose = setupFetchAutorun(state, view, needed => {
        fetchCalls.push(needed)
      })

      expect(fetchCalls).toHaveLength(1) // initial fetch

      runInAction(() => {
        state.isLoading = true
      })

      // Pan mid-fetch: autorun fires (visibleBlocks tracked) but isLoading guard blocks
      runInAction(() => {
        view.visibleBlocks = [makeBlock(0, 50000, 150000)]
      })
      expect(fetchCalls).toHaveLength(1) // blocked by guard

      // Fetch completes — isLoading=false and fetchGeneration++ in same batch,
      // mirroring FetchMixin's finally block
      runInAction(() => {
        state.isLoading = false
        state.fetchGeneration++
      })

      // Re-evaluates for current (panned) viewport, nothing loaded there yet
      expect(fetchCalls).toHaveLength(2)
      expect(fetchCalls[1]![0]!.start).toBe(50000)

      dispose()
    })
  })

  describe('untracked(loadedRegions.get(...))', () => {
    test('populating loadedRegions does not trigger fetch autorun', () => {
      const state = observable({
        fetchGeneration: 0,
        isLoading: false,
        regionTooLarge: false,
        loadedRegions: new Map<number, Region>(),
      })
      const view = observable({
        initialized: true,
        visibleBlocks: [makeBlock(0, 0, 100000)],
      })
      let autorunFires = 0

      const dispose = autorun(() => {
        void state.fetchGeneration
        const { visibleBlocks } = view
        if (!view.initialized || state.regionTooLarge) {
          return
        }
        if (untracked(() => state.isLoading)) {
          return
        }
        for (const vr of visibleBlocks) {
          untracked(() => state.loadedRegions.get(vr.displayedRegionIndex))
        }
        autorunFires++
      })

      expect(autorunFires).toBe(1)

      runInAction(() => {
        state.loadedRegions.set(0, {
          refName: 'chr1',
          start: 0,
          end: 100000,
          assemblyName: 'test',
        })
      })
      expect(autorunFires).toBe(1) // loadedRegions read is untracked

      runInAction(() => {
        state.fetchGeneration++
      })
      expect(autorunFires).toBe(2) // fetchGeneration is tracked

      dispose()
    })

    // Removing untracked() from loadedRegions.get() would be safe: the isLoading
    // guard still prevents a double-fetch when regions are populated mid-flight.
    test('tracking loadedRegions fires autorun on populate but isLoading guard prevents double-fetch', () => {
      const state = observable({
        fetchGeneration: 0,
        isLoading: false,
        error: undefined,
        regionTooLarge: false,
        loadedRegions: new Map<number, Region>(),
      })
      const view = observable({
        initialized: true,
        visibleBlocks: [makeBlock(0, 0, 100000)],
      })
      const fetchCalls: VisibleBlock[][] = []

      const dispose = setupFetchAutorun(
        state,
        view,
        needed => {
          fetchCalls.push(needed)
        },
        { trackLoadedRegions: true },
      )

      expect(fetchCalls).toHaveLength(1)

      runInAction(() => {
        state.isLoading = true
      })

      // Populate while loading: autorun fires (tracked) but isLoading guard stops it
      runInAction(() => {
        state.loadedRegions.set(0, {
          refName: 'chr1',
          start: 0,
          end: 100000,
          assemblyName: 'test',
        })
      })
      expect(fetchCalls).toHaveLength(1) // guarded by isLoading

      // Fetch completes: regions are all covered, no re-fetch needed
      runInAction(() => {
        state.isLoading = false
        state.fetchGeneration++
      })
      expect(fetchCalls).toHaveLength(1) // needed=[], no extra fetch

      dispose()
    })
  })

  describe('untracked(regionTooLarge || error)', () => {
    test('regionTooLarge is preserved until viewport changes, not cleared immediately', () => {
      const state = observable({
        fetchGeneration: 0,
        regionTooLarge: false,
        error: undefined,
      })
      // visibleBlocks proxies view.visibleRegions (production only tracks that,
      // not bpPerPx separately — see ClearBlockingStateOnViewportChange autorun)
      const view = observable({
        visibleBlocks: [makeBlock(0, 0, 100000)] as VisibleBlock[],
      })
      let clearCount = 0

      // Mirrors ClearBlockingStateOnViewportChange in MultiRegionDisplayMixin.afterAttach
      const dispose = autorun(() => {
        void view.visibleBlocks
        if (untracked(() => !!state.error)) {
          clearCount++
          runInAction(() => {
            state.regionTooLarge = false
            state.error = undefined
            state.fetchGeneration++
          })
        } else if (untracked(() => state.regionTooLarge)) {
          clearCount++
          runInAction(() => {
            state.regionTooLarge = false
            state.fetchGeneration++
          })
        }
      })

      expect(clearCount).toBe(0)

      // regionTooLarge is untracked — setting it does not fire the autorun
      runInAction(() => {
        state.regionTooLarge = true
      })
      expect(clearCount).toBe(0)
      expect(state.regionTooLarge).toBe(true) // preserved

      // visibleRegions changes on zoom or pan — fires the autorun
      runInAction(() => {
        view.visibleBlocks = [makeBlock(0, 0, 50000)]
      })
      expect(clearCount).toBe(1)
      expect(state.regionTooLarge).toBe(false)

      dispose()
    })

    // Contrast test: without untracked, setting regionTooLarge immediately fires
    // ClearBlockingStateOnViewportChange, which wipes it before any viewport change.
    // This is the cycle the untracked() call is preventing.
    test('tracking regionTooLarge immediately clears it — confirms untracked is a correctness requirement', () => {
      const state = observable({ regionTooLarge: false })
      const view = observable({ bpPerPx: 10 })
      let clearCount = 0

      const dispose = autorun(() => {
        void view.bpPerPx
        if (state.regionTooLarge) {
          // tracked — no untracked()
          clearCount++
          runInAction(() => {
            state.regionTooLarge = false
          })
        }
      })

      expect(clearCount).toBe(0)

      runInAction(() => {
        state.regionTooLarge = true
      })
      // tracked regionTooLarge fires the autorun immediately, wiping the flag
      expect(clearCount).toBe(1)
      expect(state.regionTooLarge).toBe(false) // lost — viewport never changed

      dispose()
    })

    // When a subclass overrides clearRpcDataOnViewportChange to a no-op
    // (variants pattern: independent fetch autorun manages regionTooLarge
    // itself), regionTooLarge stays true through viewport changes — keeping
    // the banner visible until the next fetch result arrives, instead of
    // flashing stale rendered content.
    test('clearRpcDataOnViewportChange override keeps regionTooLarge through viewport changes', () => {
      const state = observable({
        fetchGeneration: 0,
        regionTooLarge: false,
        error: undefined,
      })
      const view = observable({
        visibleBlocks: [makeBlock(0, 0, 100000)] as VisibleBlock[],
      })
      let onViewportChangeCount = 0

      // Variant-style override: no-op (banner stays, own autorun handles refetch)
      const clearRpcDataOnViewportChange = () => {
        onViewportChangeCount++
        // intentionally empty
      }

      const dispose = autorun(() => {
        void view.visibleBlocks
        if (untracked(() => !!state.error)) {
          // would call clearAllRpcData
        } else if (untracked(() => state.regionTooLarge)) {
          clearRpcDataOnViewportChange()
        }
      })

      runInAction(() => {
        state.regionTooLarge = true
      })
      expect(state.regionTooLarge).toBe(true)
      expect(onViewportChangeCount).toBe(0)

      // viewport change fires the autorun — but the override is a no-op,
      // so regionTooLarge is preserved
      runInAction(() => {
        view.visibleBlocks = [makeBlock(0, 0, 50000)]
      })
      expect(onViewportChangeCount).toBe(1)
      expect(state.regionTooLarge).toBe(true) // banner stays

      // another viewport change — still preserved
      runInAction(() => {
        view.visibleBlocks = [makeBlock(0, 0, 25000)]
      })
      expect(onViewportChangeCount).toBe(2)
      expect(state.regionTooLarge).toBe(true)

      dispose()
    })
  })
})
