// Tests the bounds-checking and cache-validity logic inside the
// FetchVisibleRegions autorun (MultiRegionDisplayMixin.afterAttach).
// Uses a { region, displayedRegionIndex } wrapper shape for test regions;
// production visibleRegion blocks are flat ({ refName, start, end, ... }).

import { isBlockCovered } from './MultiRegionDisplayMixin.ts'

import type { Region } from '@jbrowse/core/util'

interface DisplayedRegionWithIndex {
  region: Region
  displayedRegionIndex: number
}

function shouldFetchRegion(
  vr: DisplayedRegionWithIndex,
  loadedRegions: Map<number, Region>,
  isCacheValid: (displayedRegionIndex: number) => boolean,
) {
  const loaded = loadedRegions.get(vr.displayedRegionIndex)
  // Same predicate the production autorun and `viewportWithinLoadedData` getter use.
  if (
    isBlockCovered(loaded, vr.region) &&
    isCacheValid(vr.displayedRegionIndex)
  ) {
    return false
  }
  return true
}

function computeNeededRegions(
  staticRegions: DisplayedRegionWithIndex[],
  loadedRegions: Map<number, Region>,
  isCacheValid: (displayedRegionIndex: number) => boolean,
) {
  const needed: DisplayedRegionWithIndex[] = []
  for (const vr of staticRegions) {
    if (shouldFetchRegion(vr, loadedRegions, isCacheValid)) {
      needed.push(vr)
    }
  }
  return needed
}

function makeRegion(
  displayedRegionIndex: number,
  start: number,
  end: number,
  refName = 'chr1',
): DisplayedRegionWithIndex {
  return {
    region: { refName, start, end, assemblyName: 'test' },
    displayedRegionIndex,
  }
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
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 20000,
            assemblyName: 'test',
          },
        ],
      ])

      const needed = computeNeededRegions(
        [makeRegion(0, 1000, 15000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(0)
    })

    test('fetches when static region extends beyond loaded end', () => {
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 10000,
            assemblyName: 'test',
          },
        ],
      ])

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 15000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('fetches when static region extends beyond loaded start', () => {
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 5000,
            end: 20000,
            assemblyName: 'test',
          },
        ],
      ])

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 15000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('fetches when refName differs', () => {
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 20000,
            assemblyName: 'test',
          },
        ],
      ])

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000, 'chr2')],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
    })

    test('handles multiple regions independently', () => {
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 20000,
            assemblyName: 'test',
          },
        ],
      ])
      // region 1 not loaded

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000), makeRegion(1, 0, 5000)],
        loaded,
        () => true,
      )
      expect(needed).toHaveLength(1)
      expect(needed[0]!.displayedRegionIndex).toBe(1)
    })
  })

  describe('isCacheValid integration', () => {
    test('re-fetches when bounds valid but cache invalid (zoom-in)', () => {
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 20000,
            assemblyName: 'test',
          },
        ],
      ])

      const needed = computeNeededRegions(
        [makeRegion(0, 0, 10000)],
        loaded,
        () => false, // cache invalid — e.g., data too coarse for current zoom
      )
      expect(needed).toHaveLength(1)
    })

    test('skips when both bounds valid and cache valid', () => {
      const loaded = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 20000,
            assemblyName: 'test',
          },
        ],
      ])

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
    // Strict equality: any bpPerPx change invalidates the cache so every
    // visible region refetches together at a consistent bigwig zoom.
    function wiggleIsCacheValid(
      loadedBpPerPx: number | undefined,
      currentBpPerPx: number,
    ) {
      return loadedBpPerPx === undefined || currentBpPerPx === loadedBpPerPx
    }

    test('cache valid when not yet loaded (first fetch)', () => {
      expect(wiggleIsCacheValid(undefined, 10)).toBe(true)
    })

    test('cache valid at same zoom level', () => {
      expect(wiggleIsCacheValid(10, 10)).toBe(true)
    })

    test('cache invalid on any zoom-out', () => {
      expect(wiggleIsCacheValid(5, 20)).toBe(false)
    })

    test('cache invalid on any zoom-in', () => {
      expect(wiggleIsCacheValid(10, 6)).toBe(false)
    })

    test('scenario: every bpPerPx change triggers re-fetch', () => {
      const loadedRegions = new Map<number, Region>([
        [
          0,
          {
            refName: 'chr1',
            start: 0,
            end: 100000,
            assemblyName: 'test',
          },
        ],
      ])

      // At 10 bpPerPx (same as load): cache valid
      const needed1 = computeNeededRegions(
        [makeRegion(0, 10000, 50000)],
        loadedRegions,
        () => wiggleIsCacheValid(10, 10),
      )
      expect(needed1).toHaveLength(0)

      // At any different bpPerPx (even small change): re-fetch
      const needed2 = computeNeededRegions(
        [makeRegion(0, 20000, 30000)],
        loadedRegions,
        () => wiggleIsCacheValid(10, 9),
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

// Mirrors the `viewportWithinLoadedData` getter (initialized guard + every
// visible block covered) using the real isBlockCovered helper. This is the
// signal that drives the loading overlay during the pre-refetch debounce.
describe('viewportWithinLoadedData (loading overlay staleness signal)', () => {
  interface VisibleBlock {
    refName: string
    start: number
    end: number
    displayedRegionIndex: number
  }

  function viewportWithinLoadedData(
    initialized: boolean,
    visibleRegions: VisibleBlock[],
    loadedRegions: Map<number, Region>,
  ) {
    if (!initialized) {
      return false
    }
    return visibleRegions.every(block =>
      isBlockCovered(loadedRegions.get(block.displayedRegionIndex), block),
    )
  }

  function loadedMap(...entries: [number, number, number][]) {
    return new Map<number, Region>(
      entries.map(([idx, start, end]) => [
        idx,
        { refName: 'chr1', start, end, assemblyName: 'test' },
      ]),
    )
  }

  function vis(displayedRegionIndex: number, start: number, end: number) {
    return { refName: 'chr1', start, end, displayedRegionIndex }
  }

  test('false before the view initializes', () => {
    expect(viewportWithinLoadedData(false, [vis(0, 0, 100)], loadedMap())).toBe(
      false,
    )
  })

  test('false with no loaded data (initial load shows the overlay)', () => {
    expect(viewportWithinLoadedData(true, [vis(0, 0, 100)], loadedMap())).toBe(
      false,
    )
  })

  test('true when the viewport sits inside loaded data', () => {
    expect(
      viewportWithinLoadedData(
        true,
        [vis(0, 1000, 2000)],
        loadedMap([0, 0, 5000]),
      ),
    ).toBe(true)
  })

  test('false on zoom-out past the loaded region (stale coverage on screen)', () => {
    // loaded a narrow region, then zoomed out so the viewport is wider than it
    expect(
      viewportWithinLoadedData(
        true,
        [vis(0, 0, 10000)],
        loadedMap([0, 2000, 8000]),
      ),
    ).toBe(false)
  })

  test('false when any one of several visible regions is uncovered', () => {
    // region 1 not loaded — the whole display reads as stale
    expect(
      viewportWithinLoadedData(
        true,
        [vis(0, 0, 4000), vis(1, 0, 4000)],
        loadedMap([0, 0, 5000]),
      ),
    ).toBe(false)
  })

  test('true only when every visible region is covered', () => {
    expect(
      viewportWithinLoadedData(
        true,
        [vis(0, 0, 4000), vis(1, 0, 4000)],
        loadedMap([0, 0, 5000], [1, 0, 5000]),
      ),
    ).toBe(true)
  })
})
