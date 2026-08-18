import {
  isBlockCovered,
  planRegionFetch,
  regionAssemblyMismatchMessage,
} from './planRegionFetch.ts'

import type {
  IndexedRegion,
  RegionFetchInputs,
  RegionFetchSources,
  VisibleBlock,
} from './planRegionFetch.ts'
import type { Region } from '@jbrowse/core/util'

function region(start: number, end: number, refName = 'chr1'): Region {
  return { refName, start, end, assemblyName: 'test' }
}

function visible(
  displayedRegionIndex: number,
  start: number,
  end: number,
  refName = 'chr1',
): VisibleBlock {
  return {
    refName,
    start,
    end,
    assemblyName: 'test',
    displayedRegionIndex,
  }
}

/** The buffered twin of a visible block: widened, same index. */
function buffered(block: VisibleBlock, bufferBp = 1000): IndexedRegion {
  return {
    region: {
      refName: block.refName,
      start: Math.max(0, block.start - bufferBp),
      end: block.end + bufferBp,
      assemblyName: block.assemblyName,
    },
    displayedRegionIndex: block.displayedRegionIndex,
  }
}

function loadedMap(...entries: [number, number, number][]) {
  return new Map<number, Region>(
    entries.map(([idx, start, end]) => [idx, region(start, end)]),
  )
}

function sources(over: Partial<RegionFetchSources> = {}): RegionFetchSources {
  const visibleRegions = over.visibleRegions ?? [visible(0, 0, 10000)]
  return {
    trackAssemblyNames: ['test'],
    hasAssemblyName: () => false,
    visibleRegions,
    bufferedVisibleRegions: visibleRegions.map(b => buffered(b)),
    loadedRegion: () => undefined,
    isCacheValid: () => true,
    ...over,
  }
}

function inputs(over: Partial<RegionFetchInputs> = {}): RegionFetchInputs {
  return {
    error: undefined,
    fetchCanceled: false,
    gateSkipsMeasuredViewport: false,
    isLoading: () => false,
    minimized: () => false,
    sources: () => sources(),
    ...over,
  }
}

/** The plan, with a `fetch` reduced to the indices it would fetch. */
function plan(over: Partial<RegionFetchInputs> = {}) {
  const result = planRegionFetch(inputs(over))
  return result.kind === 'fetch'
    ? {
        kind: result.kind,
        indices: result.needed.map(n => n.displayedRegionIndex),
        needed: result.needed,
      }
    : result
}

describe('idle reasons and their precedence', () => {
  test.each([
    ['a fetch error', { error: new Error('failed') }],
    ['a user cancel', { fetchCanceled: true }],
  ])('%s blocks', (_label, over) => {
    expect(plan(over)).toEqual({ kind: 'idle', reason: 'blocked' })
  })

  test('a too-large verdict measured at this viewport stops the fetch', () => {
    expect(plan({ gateSkipsMeasuredViewport: true })).toEqual({
      kind: 'idle',
      reason: 'measured',
    })
  })

  // The rule the whole gate releases through: blocked, but the measurement
  // describes a viewport the user has left, so run the fetch again — it stops
  // at the gate and re-measures. See RegionTooLargeMixin §"Measurement follows
  // the viewport".
  test('a too-large verdict measured elsewhere lets the fetch through', () => {
    expect(plan({ gateSkipsMeasuredViewport: false })).toEqual({
      kind: 'fetch',
      indices: [0],
      needed: [buffered(visible(0, 0, 10000))],
    })
  })

  test('an in-flight fetch stops a second one', () => {
    expect(plan({ isLoading: () => true })).toEqual({
      kind: 'idle',
      reason: 'inFlight',
    })
  })

  test('a minimized track fetches nothing', () => {
    expect(plan({ minimized: () => true })).toEqual({
      kind: 'idle',
      reason: 'minimized',
    })
  })

  test('fully covered and cache-valid is idle, not an empty fetch', () => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 1000, 5000)],
            loadedRegion: () => region(0, 20000),
          }),
      }),
    ).toEqual({ kind: 'idle', reason: 'covered' })
  })

  // The order matters because each earlier reason is the one that has a way
  // out: an error clears on a viewport change, the gate re-measures, the
  // in-flight fetch ends. Reporting a later reason over an earlier one would
  // name a state nothing is waiting on.
  test('an error outranks every other reason', () => {
    expect(
      plan({
        error: new Error('failed'),
        gateSkipsMeasuredViewport: true,
        isLoading: () => true,
        minimized: () => true,
      }),
    ).toEqual({ kind: 'idle', reason: 'blocked' })
  })

  test('the settled gate outranks in-flight and minimized', () => {
    expect(
      plan({
        gateSkipsMeasuredViewport: true,
        isLoading: () => true,
        minimized: () => true,
      }),
    ).toEqual({ kind: 'idle', reason: 'measured' })
  })

  test('in-flight outranks minimized', () => {
    expect(plan({ isLoading: () => true, minimized: () => true })).toEqual({
      kind: 'idle',
      reason: 'inFlight',
    })
  })
})

// Which reads MobX tracks is the autorun body's business, and the only part of
// it this function expresses is which inputs are thunks. These pin that: a run
// that bails early must not reach the viewport, or a minimized track wakes on
// every pan and an in-flight fetch re-fires the autorun that started it.
describe('laziness', () => {
  test('an early bail-out never reaches the sources', () => {
    const reached = jest.fn(() => sources())
    for (const over of [
      { error: new Error('x') },
      { fetchCanceled: true },
      { gateSkipsMeasuredViewport: true },
      { isLoading: () => true },
      { minimized: () => true },
    ]) {
      planRegionFetch(inputs({ ...over, sources: reached }))
    }
    expect(reached).not.toHaveBeenCalled()
  })

  test('a blocked run never reads isLoading or minimized', () => {
    const isLoading = jest.fn(() => false)
    const minimized = jest.fn(() => false)
    planRegionFetch(
      inputs({ error: new Error('failed'), isLoading, minimized }),
    )
    expect(isLoading).not.toHaveBeenCalled()
    expect(minimized).not.toHaveBeenCalled()
  })

  test('an in-flight run never reads minimized', () => {
    const minimized = jest.fn(() => false)
    planRegionFetch(inputs({ isLoading: () => true, minimized }))
    expect(minimized).not.toHaveBeenCalled()
  })
})

describe('coverage decides what to fetch', () => {
  test('fetches when nothing is loaded', () => {
    expect(plan()).toMatchObject({ kind: 'fetch', indices: [0] })
  })

  test('skips a block the loaded region fully contains', () => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 1000, 15000)],
            loadedRegion: () => region(0, 20000),
          }),
      }),
    ).toEqual({ kind: 'idle', reason: 'covered' })
  })

  test.each([
    ['past the loaded end', visible(0, 0, 15000), region(0, 10000)],
    ['past the loaded start', visible(0, 0, 15000), region(5000, 20000)],
    ['on another refName', visible(0, 0, 10000, 'chr2'), region(0, 20000)],
  ])('fetches a block %s', (_label, block, loaded) => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [block],
            loadedRegion: () => loaded,
          }),
      }),
    ).toMatchObject({ kind: 'fetch', indices: [0] })
  })

  test('judges each region independently', () => {
    const loaded = loadedMap([0, 0, 20000])
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 0, 10000), visible(1, 0, 5000)],
            loadedRegion: idx => loaded.get(idx),
          }),
      }),
    ).toMatchObject({ kind: 'fetch', indices: [1] })
  })

  // Fractional bpPerPx puts block edges on non-integer positions; the loaded
  // extent has to contain the rounded-out block, not the raw one.
  test('rounds a fractional block outward before comparing', () => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 999.6, 5000.4)],
            loadedRegion: () => region(1000, 5000),
          }),
      }),
    ).toMatchObject({ kind: 'fetch', indices: [0] })
  })
})

describe('isCacheValid', () => {
  test('re-fetches a covered block whose cache went stale', () => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 0, 10000)],
            loadedRegion: () => region(0, 20000),
            isCacheValid: () => false,
          }),
      }),
    ).toMatchObject({ kind: 'fetch', indices: [0] })
  })

  // `&&` short-circuits, so an uncovered block leaves `isCacheValid`'s
  // observables untracked. Safe only because an uncovered block always reaches
  // `fetchNeeded` — see the note in planRegionFetch.
  test('is not consulted for an uncovered block', () => {
    const isCacheValid = jest.fn(() => true)
    planRegionFetch(
      inputs({
        sources: () => sources({ loadedRegion: () => undefined, isCacheValid }),
      }),
    )
    expect(isCacheValid).not.toHaveBeenCalled()
  })

  test('is asked per region, by index', () => {
    const loaded = loadedMap([0, 0, 20000], [1, 0, 20000])
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 0, 10000), visible(1, 0, 10000)],
            loadedRegion: idx => loaded.get(idx),
            isCacheValid: idx => idx !== 1,
          }),
      }),
    ).toMatchObject({ kind: 'fetch', indices: [1] })
  })
})

// The half-screen prefetch buffer is why both region lists are inputs: the plan
// judges the visible block and fetches the buffered one. Returning the visible
// block instead compiles and draws correctly — it just blanks the fringe on
// every pan, which is exactly the failure this suite exists to catch.
describe('the fetched region is the buffered one, not the visible one', () => {
  test('fetches the widened region for a visible block', () => {
    const block = visible(0, 5000, 15000)
    const result = plan({
      sources: () =>
        sources({
          visibleRegions: [block],
          bufferedVisibleRegions: [buffered(block, 2500)],
        }),
    })
    expect(result).toMatchObject({
      kind: 'fetch',
      needed: [
        {
          displayedRegionIndex: 0,
          region: expect.objectContaining({ start: 2500, end: 17500 }),
        },
      ],
    })
  })

  test('pairs each region with its own buffered twin, by index', () => {
    const blocks = [visible(0, 0, 1000), visible(1, 0, 1000)]
    const result = plan({
      sources: () =>
        sources({
          visibleRegions: blocks,
          bufferedVisibleRegions: [
            buffered(blocks[1]!, 200),
            buffered(blocks[0]!, 100),
          ],
        }),
    })
    expect(result).toMatchObject({
      kind: 'fetch',
      needed: [
        {
          displayedRegionIndex: 0,
          region: expect.objectContaining({ end: 1100 }),
        },
        {
          displayedRegionIndex: 1,
          region: expect.objectContaining({ end: 1200 }),
        },
      ],
    })
  })

  // A visible block with no buffered twin is dropped rather than fetched raw:
  // the two lists come off the same view getter, so a missing twin means the
  // view moved mid-run, and the next run has both.
  test('drops a visible block with no buffered twin', () => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [visible(0, 0, 1000), visible(1, 0, 1000)],
            bufferedVisibleRegions: [buffered(visible(1, 0, 1000))],
          }),
      }),
    ).toMatchObject({ kind: 'fetch', indices: [1] })
  })
})

describe('assembly mismatch', () => {
  test('accepts a region whose assembly the track declares', () => {
    expect(
      plan({
        sources: () => sources({ trackAssemblyNames: ['test', 'other'] }),
      }),
    ).toMatchObject({ kind: 'fetch' })
  })

  test('accepts a region the track assembly knows by alias', () => {
    expect(
      plan({
        sources: () =>
          sources({
            trackAssemblyNames: ['hg38'],
            hasAssemblyName: (track, region) =>
              track === 'hg38' && region === 'test',
          }),
      }),
    ).toMatchObject({ kind: 'fetch' })
  })

  test('reports the region and track assemblies when neither matches', () => {
    expect(
      plan({
        sources: () => sources({ trackAssemblyNames: ['hg38', 'hg19'] }),
      }),
    ).toEqual({
      kind: 'assemblyMismatch',
      regionAssemblyName: 'test',
      trackAssemblyNames: ['hg38', 'hg19'],
    })
  })

  test('reports the first mismatching region, ahead of any fetch', () => {
    expect(
      plan({
        sources: () =>
          sources({
            visibleRegions: [
              { ...visible(0, 0, 100), assemblyName: 'test' },
              { ...visible(1, 0, 100), assemblyName: 'mm10' },
            ],
            trackAssemblyNames: ['test'],
          }),
      }),
    ).toMatchObject({ kind: 'assemblyMismatch', regionAssemblyName: 'mm10' })
  })

  test('the message names both sides', () => {
    expect(
      regionAssemblyMismatchMessage({
        regionAssemblyName: 'mm10',
        trackAssemblyNames: ['hg38', 'hg19'],
      }),
    ).toBe('region assembly (mm10) does not match track assemblies (hg38,hg19)')
  })
})

// The coverage predicate on its own — also what `viewportWithinLoadedData`
// answers per block for the loading overlay.
describe('isBlockCovered', () => {
  test('false with nothing loaded', () => {
    expect(isBlockCovered(undefined, visible(0, 0, 100))).toBe(false)
  })

  test('true when the viewport sits inside loaded data', () => {
    expect(isBlockCovered(region(0, 5000), visible(0, 1000, 2000))).toBe(true)
  })

  test('true on an exact match', () => {
    expect(isBlockCovered(region(0, 5000), visible(0, 0, 5000))).toBe(true)
  })

  test('false after a zoom-out past the loaded region', () => {
    expect(isBlockCovered(region(2000, 8000), visible(0, 0, 10000))).toBe(false)
  })

  test('false on a different refName at the same coordinates', () => {
    expect(isBlockCovered(region(0, 5000), visible(0, 0, 5000, 'chr2'))).toBe(
      false,
    )
  })
})
