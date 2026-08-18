import { waitFor } from '@testing-library/react'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

// `fetchRegions` is twelve lines carrying one rule: run the work, then mark the
// regions loaded — and only if the fetch is still current. Both halves are
// silent when wrong. Marking first publishes a `loadedRegions` entry the GPU
// upload autorun observes before the data behind it exists; skipping the
// staleness guard writes a superseded fetch's regions over a fresher one's.
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

  it('clears when the byte gate stops the fetch', async () => {
    const { display, control } = setup({ measuresBytes: true })
    await afterFirstFetch(display)
    control.estimateBytes = 1_000_000_000

    let ranWork = false
    await display.fetchRegions([region], async () => {
      ranWork = true
    })
    expect(ranWork).toBe(false)
    expect(display.isLoading).toBe(false)
    expect(display.regionTooLarge).toBe(true)
  })
})

// The invariant the action exists for: an entry in `loadedRegions` is a promise
// that the data behind it is committed.
describe('a region is marked loaded only after its data lands', () => {
  it('marks it after the work returns, never before', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    let loadedDuringWork = 0
    await display.fetchRegions([region], async () => {
      loadedDuringWork = display.loadedRegions.size
      display.setLoaded(0, 'data')
    })
    expect(loadedDuringWork).toBe(0)
    expect(display.loadedRegions.size).toBe(1)
    expect(display.loadedData.get(0)).toBe('data')
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

  it('does not mark it when the fetch was superseded mid-work', async () => {
    const { display } = setup()
    await afterFirstFetch(display)

    await display.fetchRegions([region], async ctx => {
      // whatever supersedes it — a newer fetch, a clear — `isStale` is what the
      // commit consults, and the guard is around the mark as well as the data
      display.cancelFetch()
      expect(ctx.isStale()).toBe(true)
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
