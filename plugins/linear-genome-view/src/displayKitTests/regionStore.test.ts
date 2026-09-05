import { MAX_STORED_REGIONS } from '@jbrowse/display-kit/MultiRegionDisplayMixin'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

jest.setTimeout(30_000)

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function setup(opts?: Parameters<typeof createPerRegionTestEnvironment>[0]) {
  const env = createPerRegionTestEnvironment({
    adapter: {
      name: 'PerRegionTestAdapter',
      slots: { flavor: { type: 'string', defaultValue: 'a' } },
    },
    ...opts,
  })
  const created = env.createDisplay() as {
    display: PerRegionTestDisplay
    view: LinearGenomeViewModel
    track: {
      configuration: {
        adapter: { setSlot: (name: string, value: unknown) => void }
      }
    }
  }
  return { ...env, ...created }
}

async function quiet(display: PerRegionTestDisplay) {
  const deadline = Date.now() + 20_000
  let last = -1
  let stable = 0
  while (stable < 4) {
    await jest.advanceTimersByTimeAsync(200)
    const n = display.fetchLog.length
    stable = n === last && !display.isLoading ? stable + 1 : 0
    last = n
    if (Date.now() > deadline) {
      throw new Error(`display never settled; ${n} fetches and still going`)
    }
  }
  return last
}

const region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 100,
}

// The behaviour ADR-006 is about, now stated over the store rather than over a
// display-held map the foundation could not see. A settings change leaves the
// previous payload readable and marks it stale; the refetch replaces it.
//
// There is no second entry per region and no retention rule to bound: the
// previous payload IS the entry, until the commit overwrites it. That is what
// makes the drawable-vs-current distinction a compare (`isCacheValid`) rather
// than a queue.
describe('stale-while-revalidate over the store', () => {
  it('keeps the previous payload drawable until the new one lands', async () => {
    const { display, track, control } = setup()
    control.fetchDelayMs = 50
    await quiet(display)
    expect(display.loadedData.get(0)).toBe('data')

    control.payloadTag = 'refetched'
    track.configuration.adapter.setSlot('flavor', 'b')

    // the settings change has landed and the refetch has not: the payload the
    // display draws is still the one fetched under the old settings, and both
    // staleness answers say so
    expect(display.loadedData.get(0)).toBe('data')
    expect(display.isCacheValid(0)).toBe(false)
    expect(display.staleSettingsDrawn).toBe(true)
    expect(display.viewportWithinLoadedData).toBe(true)

    expect(await quiet(display)).toBe(2)
    expect(display.loadedData.get(0)).toBe('refetched')
    expect(display.isCacheValid(0)).toBe(true)
    expect(display.staleSettingsDrawn).toBe(false)
  })

  // `staleSettingsDrawn` compares the settings tier alone, so the zoom tier
  // moving marks the region stale without raising the scrim over it.
  it('draws the previous payload unscrimmed on a zoom-tier move', async () => {
    const { display } = setup()
    await quiet(display)

    display.setFetchKey('b')
    expect(display.loadedData.get(0)).toBe('data')
    expect(display.isCacheValid(0)).toBe(false)
    expect(display.staleSettingsDrawn).toBe(false)
  })
})

// The store is keyed by `displayedRegionIndex`, so its natural size is the
// assembly's contig count — no bound worth the name on a fragmented one. Canvas
// hand-rolled a prune to the buffered viewport; this is the one rule for
// everybody, and it keeps what is on screen.
describe('the store is bounded', () => {
  it('evicts down to the cap, keeping what the viewport needs', async () => {
    const { display } = setup()
    await quiet(display)

    for (let i = 1; i <= MAX_STORED_REGIONS + 20; i++) {
      display.setLoadedRegion(i, region, `off-screen-${i}`)
    }
    expect(display.loadedRegions.size).toBe(MAX_STORED_REGIONS + 21)

    display.evictRegionStore(new Set([0]))

    expect(display.loadedRegions.size).toBe(MAX_STORED_REGIONS)
    // the region the viewport is over survives whatever its age
    expect(display.loadedRegions.has(0)).toBe(true)
    // and eviction is oldest-first, so the entries that outlived it are the
    // most recent ones
    expect(display.loadedRegions.has(1)).toBe(false)
    expect(display.loadedRegions.has(MAX_STORED_REGIONS + 20)).toBe(true)
  })

  it('leaves a store under the cap alone', async () => {
    const { display } = setup()
    await quiet(display)

    display.setLoadedRegion(7, region, 'off-screen')
    display.evictRegionStore(new Set([0]))

    expect(display.loadedRegions.size).toBe(2)
  })

  it('runs the bound on every fetch', async () => {
    const { display, control } = setup()
    await quiet(display)
    for (let i = 1; i <= MAX_STORED_REGIONS + 20; i++) {
      display.setLoadedRegion(i, region, `off-screen-${i}`)
    }

    control.payloadTag = 'refetched'
    display.reload()
    expect(await quiet(display)).toBeGreaterThan(1)

    expect(display.loadedRegions.size).toBeLessThanOrEqual(MAX_STORED_REGIONS)
  })
})

// The state the fused record makes unreachable through the fetch path: a region
// marked loaded with nothing behind it. It used to be checkable only from the
// reader's side, and two displays each wrote that check out as
// `rpcDataMap.has(idx)`.
describe('a claim with no payload behind it', () => {
  it('reads as stale, so the plan refetches it', async () => {
    const { display, view } = setup()
    await quiet(display)

    display.setLoadedRegion(0, view.displayedRegions[0]!, undefined)

    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.regionHasData(0)).toBe(false)
    expect(display.isCacheValid(0)).toBe(false)
  })

  it('is not what the fetch path writes', async () => {
    const { display } = setup()
    await quiet(display)

    expect(display.regionHasData(0)).toBe(true)
  })
})
