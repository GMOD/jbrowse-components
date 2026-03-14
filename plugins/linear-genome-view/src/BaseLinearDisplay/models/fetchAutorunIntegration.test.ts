import { observable, autorun, untracked, runInAction } from 'mobx'

interface Region {
  refName: string
  start: number
  end: number
  assemblyName: string
}

interface StaticRegion extends Region {
  regionNumber: number
}

function createMockDisplayModel() {
  const state = observable({
    fetchGeneration: 0,
    error: undefined as unknown,
    regionTooLargeState: false,
    loadedRegions: new Map<number, Region>(),
    loadedBpPerPx: new Map<number, number>(),
    fetchLog: [] as { regionNumber: number; region: Region }[][],
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

  const regions: StaticRegion[] = []
  for (const [idx, dr] of view.displayedRegions.entries()) {
    const blockStart = Math.floor(
      (windowLeftBp - 0) / blockSizeBp,
    )
    const blockEnd = Math.floor(
      (windowRightBp - 0) / blockSizeBp,
    )
    const start = Math.max(dr.start, blockStart * blockSizeBp)
    const end = Math.min(dr.end, (blockEnd + 1) * blockSizeBp)
    if (end > start) {
      regions.push({
        regionNumber: idx,
        refName: dr.refName,
        start,
        end,
        assemblyName: dr.assemblyName,
      })
    }
  }
  return regions
}

function wiggleIsCacheValid(
  regionNumber: number,
  loadedBpPerPx: Map<number, number>,
  currentBpPerPx: number,
) {
  const regionBpPerPx = loadedBpPerPx.get(regionNumber)
  return regionBpPerPx === undefined || currentBpPerPx >= regionBpPerPx / 2
}

describe('fetch autorun integration with MobX observables', () => {
  test('initial load triggers fetch for all regions', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: { regionNumber: number; region: Region }[][] = []

    const dispose = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        model.fetchGeneration
        if (!view.initialized || model.error || model.regionTooLargeState) {
          return
        }

        const staticRegions = computeStaticRegions(view)
        const needed: { region: Region; regionNumber: number }[] = []
        for (const vr of staticRegions) {
          const loaded = untracked(() => model.loadedRegions.get(vr.regionNumber))
          const boundsValid =
            loaded?.refName === vr.refName &&
            vr.start >= loaded.start &&
            vr.end <= loaded.end
          if (boundsValid) {
            continue
          }
          needed.push({ region: vr, regionNumber: vr.regionNumber })
        }
        if (needed.length > 0) {
          fetches.push(needed)
        }
      },
    )

    expect(fetches).toHaveLength(1)
    expect(fetches[0]!.length).toBeGreaterThan(0)

    dispose()
  })

  test('no re-fetch after data is loaded', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: number[] = []

    const dispose = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        model.fetchGeneration
        if (!view.initialized || model.error || model.regionTooLargeState) {
          return
        }

        const staticRegions = computeStaticRegions(view)
        const needed: { region: Region; regionNumber: number }[] = []
        for (const vr of staticRegions) {
          const loaded = untracked(() => model.loadedRegions.get(vr.regionNumber))
          const boundsValid =
            loaded?.refName === vr.refName &&
            vr.start >= loaded.start &&
            vr.end <= loaded.end
          if (boundsValid) {
            continue
          }
          needed.push({ region: vr, regionNumber: vr.regionNumber })
        }
        if (needed.length > 0) {
          fetches.push(needed.length)
        }
      },
    )

    expect(fetches).toHaveLength(1)

    // Simulate successful fetch - update loadedRegions
    runInAction(() => {
      const staticRegions = computeStaticRegions(view)
      for (const vr of staticRegions) {
        model.loadedRegions.set(vr.regionNumber, {
          refName: vr.refName,
          start: vr.start,
          end: vr.end,
          assemblyName: vr.assemblyName,
        })
      }
      model.fetchGeneration++
    })

    // autorun re-runs but should not add to fetches
    expect(fetches).toHaveLength(1)

    dispose()
  })

  test('zoom-in triggers re-fetch when isCacheValid returns false', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: number[] = []

    const dispose = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        model.fetchGeneration
        if (!view.initialized || model.error || model.regionTooLargeState) {
          return
        }

        const staticRegions = computeStaticRegions(view)
        const needed: { region: Region; regionNumber: number }[] = []
        for (const vr of staticRegions) {
          const loaded = untracked(() => model.loadedRegions.get(vr.regionNumber))
          const boundsValid =
            loaded?.refName === vr.refName &&
            vr.start >= loaded.start &&
            vr.end <= loaded.end
          if (
            boundsValid &&
            wiggleIsCacheValid(
              vr.regionNumber,
              model.loadedBpPerPx,
              view.bpPerPx,
            )
          ) {
            continue
          }
          needed.push({ region: vr, regionNumber: vr.regionNumber })
        }
        if (needed.length > 0) {
          fetches.push(needed.length)
        }
      },
    )

    expect(fetches).toHaveLength(1)

    // Simulate loading data at bpPerPx=10
    runInAction(() => {
      const staticRegions = computeStaticRegions(view)
      for (const vr of staticRegions) {
        model.loadedRegions.set(vr.regionNumber, {
          refName: vr.refName,
          start: 0,
          end: 1000000,
          assemblyName: vr.assemblyName,
        })
        model.loadedBpPerPx.set(vr.regionNumber, 10)
      }
      model.fetchGeneration++
    })

    expect(fetches).toHaveLength(1)

    // Zoom in 4x (bpPerPx 10 → 2.5)
    // isCacheValid: 2.5 >= 10/2=5? → false → re-fetch
    runInAction(() => {
      view.bpPerPx = 2.5
    })

    expect(fetches).toHaveLength(2)

    dispose()
  })

  test('zoom-out does not re-fetch when data covers larger region', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    const fetches: number[] = []

    const dispose = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        model.fetchGeneration
        if (!view.initialized || model.error || model.regionTooLargeState) {
          return
        }

        const staticRegions = computeStaticRegions(view)
        const needed: { region: Region; regionNumber: number }[] = []
        for (const vr of staticRegions) {
          const loaded = untracked(() => model.loadedRegions.get(vr.regionNumber))
          const boundsValid =
            loaded?.refName === vr.refName &&
            vr.start >= loaded.start &&
            vr.end <= loaded.end
          if (
            boundsValid &&
            wiggleIsCacheValid(
              vr.regionNumber,
              model.loadedBpPerPx,
              view.bpPerPx,
            )
          ) {
            continue
          }
          needed.push({ region: vr, regionNumber: vr.regionNumber })
        }
        if (needed.length > 0) {
          fetches.push(needed.length)
        }
      },
    )

    expect(fetches).toHaveLength(1)

    // Load data covering entire chromosome at bpPerPx=10
    runInAction(() => {
      model.loadedRegions.set(0, {
        refName: 'chr1',
        start: 0,
        end: 1000000,
        assemblyName: 'test',
      })
      model.loadedBpPerPx.set(0, 10)
      model.fetchGeneration++
    })

    expect(fetches).toHaveLength(1)

    // Zoom out 2x (bpPerPx 10 → 20)
    // isCacheValid: 20 >= 10/2=5? → true → no re-fetch
    // boundsValid: loaded covers 0-1M, static region is within → true
    runInAction(() => {
      view.bpPerPx = 20
    })

    // Should still be 1 — no re-fetch needed
    expect(fetches).toHaveLength(1)

    dispose()
  })

  test('error blocks fetch, zoom clears error and retries', () => {
    const model = createMockDisplayModel()
    const view = createMockView()
    let fetchCount = 0
    let prevBpPerPx: number | undefined

    const disposeFetch = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        model.fetchGeneration
        if (!view.initialized || model.error || model.regionTooLargeState) {
          return
        }
        fetchCount++
      },
    )

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

    const disposeFetch = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        model.fetchGeneration
        if (!view.initialized || model.error || model.regionTooLargeState) {
          return
        }
        fetchCount++
      },
    )

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
