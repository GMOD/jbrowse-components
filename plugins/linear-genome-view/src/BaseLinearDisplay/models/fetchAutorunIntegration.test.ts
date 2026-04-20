import { autorun, observable, runInAction, untracked } from 'mobx'

import type { Region } from '@jbrowse/core/util'

interface DisplayedRegionWithIndex {
  region: Region
  displayedRegionIndex: number
}

function createMockDisplayModel() {
  const state = observable({
    fetchGeneration: 0,
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      model.fetchGeneration
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      model.fetchGeneration
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      model.fetchGeneration
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      model.fetchGeneration
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      model.fetchGeneration
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
