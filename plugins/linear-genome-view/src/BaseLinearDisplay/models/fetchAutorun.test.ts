import type { Region } from './MultiRegionDisplayMixin.ts'

interface StaticRegion extends Region {
  regionNumber: number
}

interface LoadedRegion extends Region {}

function shouldFetchRegion(
  vr: StaticRegion,
  loadedRegions: Map<number, LoadedRegion>,
  isCacheValid: (regionNumber: number) => boolean,
) {
  const loaded = loadedRegions.get(vr.regionNumber)
  const boundsValid =
    loaded?.refName === vr.refName &&
    vr.start >= loaded.start &&
    vr.end <= loaded.end
  if (boundsValid && isCacheValid(vr.regionNumber)) {
    return false
  }
  return true
}

function computeNeededRegions(
  staticRegions: StaticRegion[],
  loadedRegions: Map<number, LoadedRegion>,
  isCacheValid: (regionNumber: number) => boolean,
) {
  const needed: { region: Region; regionNumber: number }[] = []
  for (const vr of staticRegions) {
    if (shouldFetchRegion(vr, loadedRegions, isCacheValid)) {
      needed.push({ region: vr, regionNumber: vr.regionNumber })
    }
  }
  return needed
}

function makeRegion(
  regionNumber: number,
  start: number,
  end: number,
  refName = 'chr1',
): StaticRegion {
  return { regionNumber, refName, start, end, assemblyName: 'test' }
}

describe('fetch autorun region determination', () => {
  describe('bounds checking', () => {
    test('fetches when no loaded data exists', () => {
      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000)],
        new Map(),
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('skips when loaded data fully covers static region', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 0,
        end: 20000,
        assemblyName: 'test',
      })

      const needed = computeNeededRegions(
        [makeRegion(0, 1000, 15000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(0)
    })

    test('fetches when static region extends beyond loaded end', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 0,
        end: 10000,
        assemblyName: 'test',
      })

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 15000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('fetches when static region extends beyond loaded start', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 5000,
        end: 20000,
        assemblyName: 'test',
      })

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 15000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('fetches when refName differs', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 0,
        end: 20000,
        assemblyName: 'test',
      })

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000, 'chr2')],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('handles multiple regions independently', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 0,
        end: 20000,
        assemblyName: 'test',
      })
      // region 1 not loaded

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000), makeRegion(1, 0, 5000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
      expect(needed[0]!.regionNumber).toBe(1)
    })
  })

  describe('isCacheValid integration', () => {
    test('re-fetches when bounds valid but cache invalid (zoom-in)', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 0,
        end: 20000,
        assemblyName: 'test',
      })

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000)],
        loaded,
        () => false, // cache invalid — e.g., data too coarse for current zoom
      )
      expect(needed).toHaveLength(1)
    })

    test('skips when both bounds valid and cache valid', () => {
      const loaded = new Map<number, LoadedRegion>()
      loaded.set(0, {
        refName: 'chr1',
        start: 0,
        end: 20000,
        assemblyName: 'test',
      })

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(0)
    })

    test('isCacheValid is not consulted when bounds are invalid', () => {
      let cacheValidCalled = false
      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000)],
        new Map(), // no loaded data
        () => {
          cacheValidCalled = true
          return true
        },
      )
      expect(needed).toHaveLength(1)
      expect(cacheValidCalled).toBe(false)
    })
  })

  describe('wiggle resolution cache validity', () => {
    function wiggleIsCacheValid(
      regionNumber: number,
      loadedBpPerPx: Map<number, number>,
      currentBpPerPx: number,
    ) {
      const regionBpPerPx = loadedBpPerPx.get(regionNumber)
      return regionBpPerPx === undefined || currentBpPerPx >= regionBpPerPx / 2
    }

    test('cache valid when not yet loaded (first fetch)', () => {
      expect(wiggleIsCacheValid(0, new Map(), 10)).toBe(true)
    })

    test('cache valid at same zoom level', () => {
      const loaded = new Map([[0, 10]])
      expect(wiggleIsCacheValid(0, loaded, 10)).toBe(true)
    })

    test('cache valid when zoomed out (coarser data ok)', () => {
      const loaded = new Map([[0, 5]])
      expect(wiggleIsCacheValid(0, loaded, 20)).toBe(true)
    })

    test('cache valid when zoomed in slightly (less than 2x)', () => {
      const loaded = new Map([[0, 10]])
      expect(wiggleIsCacheValid(0, loaded, 6)).toBe(true)
    })

    test('cache invalid when zoomed in more than 2x', () => {
      const loaded = new Map([[0, 10]])
      expect(wiggleIsCacheValid(0, loaded, 4)).toBe(false)
    })

    test('cache invalid at exactly 2x zoom-in boundary', () => {
      const loaded = new Map([[0, 10]])
      // bpPerPx=5 is exactly loadedBpPerPx/2, >=5 passes
      expect(wiggleIsCacheValid(0, loaded, 5)).toBe(true)
      // bpPerPx=4.99 is just below loadedBpPerPx/2
      expect(wiggleIsCacheValid(0, loaded, 4.99)).toBe(false)
    })

    test('scenario: zoom from 10 to 2.5 bpPerPx triggers re-fetch', () => {
      const loaded = new Map([[0, 10]])
      const loadedRegions = new Map<number, LoadedRegion>()
      loadedRegions.set(0, {
        refName: 'chr1',
        start: 0,
        end: 100000,
        assemblyName: 'test',
      })

      // At 10 bpPerPx (original): cache valid
      const needed1 = computeNeededRegions(
        [makeRegion(0, 10000, 50000)],
        loadedRegions,
        rn => wiggleIsCacheValid(rn, loaded, 10),
      )
      expect(needed1).toHaveLength(0)

      // At 2.5 bpPerPx (4x zoom in): cache invalid, re-fetch
      const needed2 = computeNeededRegions(
        [makeRegion(0, 20000, 30000)],
        loadedRegions,
        rn => wiggleIsCacheValid(rn, loaded, 2.5),
      )
      expect(needed2).toHaveLength(1)
    })
  })

  describe('error and regionTooLarge blocking', () => {
    function shouldFetchAutorunRun(state: {
      initialized: boolean
      error: unknown
      regionTooLarge: boolean
    }) {
      if (!state.initialized || state.error || state.regionTooLarge) {
        return false
      }
      return true
    }

    test('blocks when not initialized', () => {
      expect(
        shouldFetchAutorunRun({
          initialized: false,
          error: undefined,
          regionTooLarge: false,
        }),
      ).toBe(false)
    })

    test('blocks when error is set', () => {
      expect(
        shouldFetchAutorunRun({
          initialized: true,
          error: new Error('failed'),
          regionTooLarge: false,
        }),
      ).toBe(false)
    })

    test('blocks when regionTooLarge', () => {
      expect(
        shouldFetchAutorunRun({
          initialized: true,
          error: undefined,
          regionTooLarge: true,
        }),
      ).toBe(false)
    })

    test('runs when initialized with no error and no regionTooLarge', () => {
      expect(
        shouldFetchAutorunRun({
          initialized: true,
          error: undefined,
          regionTooLarge: false,
        }),
      ).toBe(true)
    })
  })

  describe('zoom-triggered recovery', () => {
    function shouldClearOnZoom(
      prevBpPerPx: number | undefined,
      currentBpPerPx: number,
      regionTooLarge: boolean,
      error: unknown,
    ) {
      if (
        prevBpPerPx !== undefined &&
        currentBpPerPx !== prevBpPerPx &&
        (regionTooLarge || error)
      ) {
        return true
      }
      return false
    }

    test('clears regionTooLarge on zoom change', () => {
      expect(shouldClearOnZoom(10, 5, true, undefined)).toBe(true)
    })

    test('clears error on zoom change', () => {
      expect(shouldClearOnZoom(10, 5, false, new Error('oops'))).toBe(true)
    })

    test('does not clear when zoom unchanged', () => {
      expect(shouldClearOnZoom(10, 10, true, undefined)).toBe(false)
    })

    test('does not clear on first render (prevBpPerPx undefined)', () => {
      expect(shouldClearOnZoom(undefined, 10, true, undefined)).toBe(false)
    })

    test('does not clear when no error or regionTooLarge', () => {
      expect(shouldClearOnZoom(10, 5, false, undefined)).toBe(false)
    })

    test('scenario: error recovery via zoom', () => {
      // Fetch fails → error set
      // User zooms → shouldClearOnZoom returns true → clearAllRpcData
      // Fetch autorun retries at new zoom level
      expect(shouldClearOnZoom(10, 20, false, new Error('timeout'))).toBe(true)
    })
  })
})
