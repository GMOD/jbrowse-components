import { reactionDependencies } from '@jbrowse/render-core/namedReactions'
import { waitFor } from '@testing-library/react'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

// The half `planRegionFetch` cannot express: which reads MobX tracks.
//
// `planRegionFetch.test.ts` pins the decision — given these inputs, fetch this
// region set. These pin the wiring: that the autorun re-runs when it should,
// stays asleep when it should, and that the four autoruns clear what they say
// they clear. The distinction matters because a wrong dependency set is
// invisible to any test of the decision: the body stays correct and simply
// never runs again.
//
// A real display in a real view, not a mock, for the reason the shared harness
// exists — `afterAttach` runs, so these test the installer that shipped rather
// than a transcription of it. The display is the smallest one that composes the
// foundation (`perRegionTestEnv`), so nothing here is a plugin's behavior.

jest.setTimeout(30_000)

const POLL_MS = 200
// 4 quiet polls span 800ms, comfortably past the 600ms FetchVisibleRegions
// debounce, so "no further fetch" is a settled answer rather than a race the
// debounce happened to win.
const QUIET_POLLS = 4

// FetchMixin logs a failed fetch through console.error, which the jest console
// shim otherwise prints. The two tests that fail a fetch on purpose expect it.
function expectFetchErrorLogged() {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  return () => {
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  }
}

function setup(opts?: { measuresBytes?: boolean; estimateBytes?: number }) {
  const env = createPerRegionTestEnvironment(opts)
  const created = env.createDisplay() as {
    display: PerRegionTestDisplay
    view: LinearGenomeViewModel
    track: { setMinimized: (flag: boolean) => void }
  }
  return { ...env, ...created }
}

/**
 * Wait until the display stops fetching and stays stopped, then answer how many
 * fetches it has issued in total. Polling for quiet rather than sleeping a fixed
 * span: a sleep long enough to pass is also long enough to hide a late fetch
 * cycle satisfying the assertion by accident.
 */
async function quiet(display: PerRegionTestDisplay) {
  const deadline = Date.now() + 20_000
  let last = -1
  let stable = 0
  while (stable < QUIET_POLLS) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const n = display.fetchLog.length
    stable = n === last && !display.isLoading ? stable + 1 : 0
    last = n
    if (Date.now() > deadline) {
      throw new Error(`display never settled; ${n} fetches and still going`)
    }
  }
  return last
}

describe('FetchVisibleRegions fires on the viewport', () => {
  it('fetches once the view is initialized', async () => {
    const { display } = setup()
    expect(await quiet(display)).toBe(1)
    expect(display.fetchLog[0]).toHaveLength(1)
  })

  it('fetches the buffered region, wider than what is on screen', async () => {
    const { display, view } = setup()
    await quiet(display)
    const fetched = display.fetchLog[0]![0]!
    const visible = view.visibleRegions[0]!
    // half a screen each side, clamped to the displayed region
    expect(fetched.region.end - fetched.region.start).toBeGreaterThan(
      visible.end - visible.start,
    )
  })

  it('refetches after a pan leaves the loaded window', async () => {
    const { display, view } = setup()
    await quiet(display)
    view.scrollTo(view.offsetPx + view.width * 4)
    expect(await quiet(display)).toBe(2)
  })

  it('does not refetch a pan that stays inside the buffer', async () => {
    const { display, view } = setup()
    await quiet(display)
    view.scrollTo(view.offsetPx + 5)
    expect(await quiet(display)).toBe(1)
  })
})

describe('the trigger list', () => {
  // `fetchGeneration` is this family's pure signal — bumped at every fetch end,
  // consulted by no gate. Read below the plan instead of above it and a display
  // whose fetch declines never wakes again. The global family's `reloadCounter`
  // and the comparative family's carry the same law.
  it('re-runs after a fetch ends, off fetchGeneration', async () => {
    const { display } = setup()
    await quiet(display)
    // clear the loaded regions without touching the viewport: the autorun reads
    // `loadedRegions` untracked, so only a fetchGeneration bump can drive the
    // second fetch
    display.clearAllRpcData()
    expect(await quiet(display)).toBe(2)
  })

  it('wakes on un-minimize, having tracked `minimized` while asleep', async () => {
    const { display, track } = setup()
    await quiet(display)
    track.setMinimized(true)
    display.clearAllRpcData()
    expect(await quiet(display)).toBe(1)

    track.setMinimized(false)
    expect(await quiet(display)).toBe(2)
  })

  // The `&&` short-circuit in the plan: an uncovered block never reaches
  // `isCacheValid`, so its observables register no dependency on that run. Safe
  // only because an uncovered block always reaches `fetchNeeded`.
  it('does not consult isCacheValid until a block is covered', async () => {
    const { display, control } = setup()
    const before = control.cacheValidCalls
    await quiet(display)
    expect(before).toBe(0)
    // and it does consult it once the fetch has landed and the block is covered
    expect(control.cacheValidCalls).toBeGreaterThan(0)
  })

  it('refetches a covered block whose cache went stale', async () => {
    const { display, view, control } = setup()
    await quiet(display)
    // one false answer, not a permanent one: a cache that is invalid forever
    // refetches forever, which is correct and unfalsifiable
    control.staleAnswers = 1
    // isCacheValid is only reconsidered when the autorun re-runs, and a pan
    // inside the buffer is the cheapest trigger that changes nothing else —
    // notably not `reload()`, which clears the data the block is covered by
    view.scrollTo(view.offsetPx + 5)
    expect(await quiet(display)).toBe(2)
  })
})

// The third invalidation axis, and the one this mixin owns: the display says
// what a fetch issued now would produce, `fetchRegions` stamps that beside the
// region it loads, and a region whose stamp no longer matches refetches.
// `regionHasData` stays true throughout, so nothing but the key explains either
// result.
describe('the region fetch key', () => {
  it('refetches a covered block whose key moved', async () => {
    const { display } = setup()
    await quiet(display)

    // no viewport move: `regionFetchKey` is a view, so what it reads is in this
    // autorun's dependency set and moving the key is the whole trigger. As an
    // action MobX would run it untracked and this would never re-run.
    display.setFetchKey('zoomed')
    expect(await quiet(display)).toBe(2)
  })

  // The key is read before the RPC, not after it. `ctx.isStale()` trips on a
  // newer fetch or a cancel, never on a viewport that moved under a fetch that
  // is still current — so a key read at commit would stamp this data with the
  // zoom the user has since reached, and the region would read as fresh at a
  // resolution it was never fetched at. Read at issue, the same move leaves a
  // stale stamp and one redundant fetch, which is the failure worth having.
  it('captures the key at issue, so one that moves mid-fetch refetches', async () => {
    const { display, control } = setup()
    control.fetchDelayMs = 300
    await waitFor(
      () => {
        expect(display.isLoading).toBe(true)
      },
      { timeout: 5000, interval: 20 },
    )

    display.setFetchKey('moved')
    expect(await quiet(display)).toBe(2)
  })
})

// A failed fetch leaves the block uncovered, so nothing but the error itself
// stops the autorun retrying it — which is the state these are about. Note
// `clearAllRpcData` clears the error as part of the reset, so it cannot be used
// to set one up.
describe('blocking states', () => {
  it('does not retry after a fetch fails', async () => {
    const { display, control } = setup()
    const assertLogged = expectFetchErrorLogged()
    control.failNextFetch = true
    expect(await quiet(display)).toBe(1)
    expect(display.error).toBeInstanceOf(Error)
    // uncovered, so only the error is holding the retry off
    expect(display.loadedRegions.size).toBe(0)
    assertLogged()
  })

  // ClearBlockingStateOnViewportChange: the error is imperative, so only a
  // viewport move clears it.
  it('a viewport move clears the error and the fetch resumes', async () => {
    const { display, view, control } = setup()
    const assertLogged = expectFetchErrorLogged()
    control.failNextFetch = true
    await quiet(display)
    expect(display.error).toBeInstanceOf(Error)
    assertLogged()

    view.scrollTo(view.offsetPx + view.width * 4)
    expect(await quiet(display)).toBe(2)
    expect(display.error).toBeUndefined()
  })

  // That autorun reads `error` untracked, or setting the error would fire it
  // and wipe the flag before any viewport change.
  it('setting an error does not itself clear it', async () => {
    const { display } = setup()
    await quiet(display)
    display.setError(new Error('boom'))
    await quiet(display)
    expect(display.error).toBeInstanceOf(Error)
  })

  it('a user cancel blocks the retry the way an error does', async () => {
    const { display, control } = setup()
    await quiet(display)
    // hold the next fetch open so the cancel lands mid-flight, leaving the
    // block uncovered with `fetchCanceled` set
    control.fetchDelayMs = 2000
    display.reload()
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })
    display.cancelFetchByUser()
    control.fetchDelayMs = 0
    expect(display.fetchCanceled).toBe(true)
    expect(await quiet(display)).toBe(2)
    expect(display.loadedRegions.size).toBe(0)
  })
})

describe('DisplayedRegionsChange', () => {
  it('clears loaded data and the byte estimate on chromosome navigation', async () => {
    const { display, view } = setup()
    await quiet(display)
    display.setByteEstimate({ bytes: 1000, viewport: display.gateViewport! })
    expect(display.estimatedFetchBytes).toBe(1000)

    view.setDisplayedRegions([
      { refName: 'ctgB', start: 0, end: 50_000, assemblyName: 'volvox' },
    ])
    // the estimate describes the previous chromosome's fetch, so it goes with
    // the data — displayedRegionIndex is reused across chromosomes
    expect(display.estimatedFetchBytes).toBeUndefined()
    expect(display.loadedRegions.size).toBe(0)
  })

  // clearAllRpcData deliberately leaves the estimate alone, so an ordinary
  // viewport-change clear does not flicker the banner.
  it('an ordinary clear keeps the byte estimate', async () => {
    const { display } = setup()
    await quiet(display)
    display.setByteEstimate({ bytes: 1000, viewport: display.gateViewport! })
    display.clearAllRpcData()
    expect(display.estimatedFetchBytes).toBe(1000)
  })
})

// The rule that makes the banner release without an imperative clear: a blocked
// display keeps running its fetch, once per settled viewport, and the fetch
// stops at the measurement. Skipping unconditionally froze the estimate at the
// viewport it was captured over; running unconditionally spins, because a
// too-large region stores nothing and the fetchGeneration bump re-fires the
// autorun. Only canvas's own suite covered this before.
describe('the too-large gate re-measures once per settled viewport', () => {
  // comfortably past the default fetchSizeLimit
  const OVER_BUDGET = 1_000_000_000

  it('raises the banner and stops before any features are fetched', async () => {
    const { display } = setup({
      measuresBytes: true,
      estimateBytes: OVER_BUDGET,
    })
    await quiet(display)
    expect(display.regionTooLarge).toBe(true)
    expect(display.loadedRegions.size).toBe(0)
  })

  it('does not re-measure while the viewport holds still', async () => {
    const { display, control } = setup({
      measuresBytes: true,
      estimateBytes: OVER_BUDGET,
    })
    await quiet(display)
    const measured = control.estimateCalls
    expect(await quiet(display)).toBe(display.fetchLog.length)
    expect(control.estimateCalls).toBe(measured)
  })

  it('re-measures once the viewport moves under it', async () => {
    const { display, view, control } = setup({
      measuresBytes: true,
      estimateBytes: OVER_BUDGET,
    })
    await quiet(display)
    const measured = control.estimateCalls

    view.scrollTo(view.offsetPx + view.width * 4)
    await quiet(display)
    expect(control.estimateCalls).toBeGreaterThan(measured)
  })

  it('releases the banner when the new measurement fits', async () => {
    const { display, view, control } = setup({
      measuresBytes: true,
      estimateBytes: OVER_BUDGET,
    })
    await quiet(display)
    expect(display.regionTooLarge).toBe(true)

    control.estimateBytes = 100
    view.scrollTo(view.offsetPx + view.width * 4)
    await quiet(display)
    expect(display.regionTooLarge).toBe(false)
    expect(display.loadedRegions.size).toBeGreaterThan(0)
  })

  it('force-load exempts the track and the data lands', async () => {
    const { display } = setup({
      measuresBytes: true,
      estimateBytes: OVER_BUDGET,
    })
    await quiet(display)
    expect(display.regionTooLarge).toBe(true)

    display.forceLoad()
    await quiet(display)
    expect(display.regionTooLarge).toBe(false)
    expect(display.loadedRegions.size).toBeGreaterThan(0)
  })
})

describe('the dependency set is the contract', () => {
  // The list itself, stated once per state, rather than one probe per
  // observable someone thought to write. Every rule above is visible in it: the
  // two pure signals present in every state, the viewport present only while
  // the display can act on it, and the untracked guards (`isLoading`,
  // `loadedRegions`) absent from all of them.
  const signals = [
    'PerRegionTestDisplay.fetchGeneration',
    'PerRegionTestDisplay.reloadCounter',
  ]
  const viewport = [
    'LinearGenomeView.displayedRegions',
    'LinearGenomeView.minimumBlockWidth',
    'LinearGenomeView.windowStartBp',
    'LinearGenomeView.windowWidthBp',
  ]

  it('after a fetch: the signals, the blocking flags, the gate, the track and the viewport', async () => {
    const { display } = setup()
    await quiet(display)
    expect(reactionDependencies(display, 'FetchVisibleRegions')).toEqual(
      [
        'DisplayTestSession.assemblyManager',
        'FeatureTrack.configuration',
        'FeatureTrack.minimized',
        'FeatureTrackConfigurationSchema.assemblyNames',
        ...viewport,
        'LinearGenomeView.init',
        'LinearGenomeView.volatileWidth',
        'PerRegionTestDisplay.byteEstimate',
        'PerRegionTestDisplay.error',
        'PerRegionTestDisplay.fetchCanceled',
        'PerRegionTestDisplay.fetchKey',
        ...signals,
        'PerRegionTestDisplay.gateEnabled',
        'alive',
        'string[]',
      ].sort(),
    )
  })

  it('while minimized: the signals and the flag stay, the viewport drops', async () => {
    const { display, track } = setup()
    await quiet(display)
    track.setMinimized(true)
    await quiet(display)
    const deps = reactionDependencies(display, 'FetchVisibleRegions')
    expect(deps).toEqual(
      expect.arrayContaining([...signals, 'FeatureTrack.minimized']),
    )
    expect(deps).not.toEqual(expect.arrayContaining(viewport))
  })

  it('under an error: the signals, the flags and the gate stay, the viewport drops', async () => {
    // The gate reads sit beside `error` in the plan's argument list, so they
    // are evaluated on every run; only what is behind a thunk drops out.
    const { display } = setup()
    await quiet(display)
    display.setError(new Error('down'))
    await quiet(display)
    expect(reactionDependencies(display, 'FetchVisibleRegions')).toEqual(
      [
        'DisplayTestSession.assemblyManager',
        'LinearGenomeView.displayedRegions',
        'LinearGenomeView.init',
        'LinearGenomeView.volatileWidth',
        'PerRegionTestDisplay.byteEstimate',
        'PerRegionTestDisplay.error',
        'PerRegionTestDisplay.fetchCanceled',
        'PerRegionTestDisplay.gateEnabled',
        ...signals,
        'alive',
      ].sort(),
    )
  })
})
