import { waitFor } from '@testing-library/react'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

// `fetchRegions` carries one rule: a region is marked loaded by whoever stores
// its payload, through `ctx.commitRegion`, and only while the fetch is still
// current. Every half is silent when wrong. Marking before the store publishes a
// `loadedRegions` entry the GPU upload autorun observes before the data behind
// it exists; skipping the staleness guard writes a superseded fetch's regions
// over a fresher one's; and marking a region the work stored NOTHING for — which
// is what this function used to do for the whole `needed` list, from the request
// rather than the response — leaves the viewport reading as covered against data
// that does not exist. See `RegionFetchContext`.
//
// Against the real model, not a transcription of it: the rule is about
// `runFetch`'s stop-token rotation and `loadedRegions`, so a stand-in with its
// own generation counter tests its own arithmetic.

jest.setTimeout(30_000)

function setup(opts?: { measuresBytes?: boolean }) {
  const env = createPerRegionTestEnvironment(opts)
  const created = env.createDisplay() as { display: PerRegionTestDisplay }
  return { ...env, ...created }
}

const region = {
  region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  displayedRegionIndex: 0,
}

/** Wait out the initial mount fetch so a test starts from a known state. */
async function afterFirstFetch(display: PerRegionTestDisplay) {
  await waitFor(() => {
    expect(display.loadedRegions.size).toBeGreaterThan(0)
  })
  display.clearAllRpcData()
  await waitFor(() => {
    expect(display.isLoading).toBe(false)
  })
}

describe('the loading flag', () => {
  it('is true across the work and false after it', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    let sawLoading = false
    const done = display.fetchRegions([region], async () => {
      sawLoading = display.isLoading
    })
    await done
    expect(sawLoading).toBe(true)
    expect(display.isLoading).toBe(false)
  })

  it('clears when the work throws, and captures the error', async () => {
    const { display } = setup()
    await afterFirstFetch(display)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await display.fetchRegions([region], () =>
      Promise.reject(new Error('rpc failed')),
    )
    expect(display.isLoading).toBe(false)
    expect(display.error).toBeInstanceOf(Error)
    spy.mockRestore()
  })

  // The gate no longer stops the fetch before it starts: the fetch runs, the
  // worker measures first and answers a refusal instead of a payload, and what
  // the display is left with is the banner and nothing stored. Which is the
  // whole point — running the fetch IS the re-measure that lets the banner
  // release.
  it('clears when the fetch stops at the byte measurement', async () => {
    const { display, control } = setup({ measuresBytes: true })
    await afterFirstFetch(display)
    control.estimateBytes = 1_000_000_000

    display.fetchNeeded([region])
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.loadedData.size).toBe(0)
    expect(display.loadedRegions.size).toBe(0)
    expect(display.isLoading).toBe(false)
  })
})

// The invariant the action exists for: an entry in `loadedRegions` is a promise
// that the data behind it is committed.
describe('a region is marked loaded only when its data lands', () => {
  it('marks it at the commit, never before', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    let loadedBeforeStore = 0
    await display.fetchRegions([region], async ctx => {
      loadedBeforeStore = display.loadedRegions.size
      display.setLoaded(0, 'data')
      ctx.commitRegion(0)
    })
    expect(loadedBeforeStore).toBe(0)
    expect(display.loadedRegions.size).toBe(1)
    expect(display.loadedData.get(0)).toBe('data')
  })

  // The case the old shape could not express. A fetch that comes back refused
  // for size stores nothing, and the region must not then claim the span the
  // fetch asked for: `isBlockCovered` would read the viewport as covered, the
  // plan would answer `covered` on every later run, and — since the ordinary
  // fetch IS the gate's re-measure — nothing would refetch OR re-measure.
  it('does not mark a region the work stored nothing for', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    await display.fetchRegions([region], async () => {})
    expect(display.loadedRegions.size).toBe(0)
  })

  it('does not mark it when the work throws', async () => {
    const { display } = setup()
    await afterFirstFetch(display)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await display.fetchRegions([region], () => Promise.reject(new Error('x')))
    expect(display.loadedRegions.size).toBe(0)
    spy.mockRestore()
  })

  it('does not mark it when the byte gate stopped the fetch', async () => {
    const { display, control } = setup({ measuresBytes: true })
    await afterFirstFetch(display)
    control.estimateBytes = 1_000_000_000

    await display.fetchRegions([region], async () => {})
    expect(display.loadedRegions.size).toBe(0)
  })

  // `commitRegion` names an index and nothing else, and the span comes from the
  // `needed` list the fetch issued. So a display can say "this region landed"
  // and cannot say what it landed over — the direction that froze a track is not
  // expressible, rather than merely discouraged.
  it('marks the span the fetch asked for, whatever the caller knows', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    await display.fetchRegions([region], async ctx => {
      display.setLoaded(0, 'data')
      ctx.commitRegion(0)
    })
    expect(display.loadedRegions.get(0)).toMatchObject(region.region)
  })

  // ...and an index the fetch never asked for has no span to be marked over, so
  // it is dropped and reported rather than guessed at.
  it('drops and reports a commit for a region it never fetched', async () => {
    const { display } = setup()
    await afterFirstFetch(display)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await display.fetchRegions([region], async ctx => {
      ctx.commitRegion(7)
    })
    expect(display.loadedRegions.size).toBe(0)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('commitRegion(7)'))
    spy.mockRestore()
  })

  // The one way left to get the rule wrong is forgetting the call, and it spins
  // rather than freezing: nothing reads as covered, so the plan asks again. Dev
  // only, and on the third consecutive run so a single ungated empty fetch —
  // which the worker/main-thread bpPerPx skew can produce for one settled cycle
  // — stays quiet.
  it('reports a work callback that keeps storing without committing', async () => {
    const { display } = setup()
    await afterFirstFetch(display)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    for (let i = 0; i < 2; i++) {
      await display.fetchRegions([region], async () => {})
    }
    expect(spy).not.toHaveBeenCalled()

    await display.fetchRegions([region], async () => {})
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('stored data for no region'),
    )
    spy.mockRestore()
  })

  it('forgets the run of empty fetches as soon as one commits', async () => {
    const { display } = setup()
    await afterFirstFetch(display)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await display.fetchRegions([region], async () => {})
    await display.fetchRegions([region], async () => {})
    await display.fetchRegions([region], async ctx => {
      ctx.commitRegion(0)
    })
    await display.fetchRegions([region], async () => {})

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('does not mark it when the fetch was superseded mid-work', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    await display.fetchRegions([region], async ctx => {
      // whatever supersedes it — a newer fetch, a clear — `isStale` is what the
      // commit consults, so a commit issued after it is dropped rather than
      // trusted to a caller's own guard
      display.cancelFetch()
      expect(ctx.isStale()).toBe(true)
      ctx.commitRegion(0)
    })
    expect(display.loadedRegions.size).toBe(0)
  })
})

describe('one fetch at a time', () => {
  it('cancels the fetch in flight when a new one starts', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    let firstCtx: FetchContext | undefined
    const first = display.fetchRegions([region], async ctx => {
      firstCtx = ctx
      await new Promise(r => setTimeout(r, 500))
    })
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    const second = display.fetchRegions([region], async () => {})
    await Promise.all([first, second])

    expect(firstCtx!.isStale()).toBe(true)
    expect(display.isLoading).toBe(false)
  })

  it('bumps fetchGeneration once per fetch end, whatever the outcome', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    const before = display.fetchGeneration
    await display.fetchRegions([region], async () => {})
    expect(display.fetchGeneration).toBe(before + 1)
  })
})
