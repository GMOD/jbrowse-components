// Direct tests for the `installGlobalFetchAutorun` skeleton shared by arc, HiC
// and LD.
//
// The invariant under test: the trigger reads (viewport, isMinimized,
// rpcProps(), reloadCounter) happen unconditionally, ABOVE the display's
// `shouldFetch()` gate. MobX rebuilds an autorun's dependency set on every run,
// so a trigger read placed inside the gate silently falls out of that set on
// the first run that decides not to fetch — and can then never wake the autorun
// again. A display whose `shouldFetch` goes false once its data has loaded
// (arc: `!regionTooLarge && !dataCurrent`) hits that on every successful fetch,
// which is how `reload()` came to be a no-op there.
//
// So these assert on how often the BODY re-evaluated (shouldFetch call count),
// not on how often it fetched: re-running the body is the thing the trigger
// reads buy, and a gate that stays false is allowed to keep declining.

import { types } from '@jbrowse/mobx-state-tree'

import { installGlobalFetchAutorun } from './GlobalDataDisplayMixin.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

const DELAY = 10

// `isViewModel` (core/util/types) duck-types on width + setWidth, which is all
// `getContainingView` needs to find this from the display below.
const TestView = types
  .model('TestView', {
    display: types.late(() => TestDisplay),
  })
  .volatile(() => ({
    width: 800,
    initialized: true,
    // read by the skeleton as the viewport trigger; a fresh array per set() is
    // what makes the read observable
    dynamicBlocks: { contentBlocks: [{ key: 'chr1:0-100' }] },
  }))
  .actions(self => ({
    setWidth(n: number) {
      self.width = n
    },
    setBlocks(keys: string[]) {
      self.dynamicBlocks = { contentBlocks: keys.map(key => ({ key })) }
    },
  }))

const TestDisplay = types
  .model('TestDisplay', { id: types.optional(types.identifier, 'd1') })
  .volatile(() => ({
    isMinimized: false,
    reloadCounter: 0,
    setting: 'a',
    // read by rpcProps() but absent from its return, the shape HiC's
    // `activeNormalization` has (it consults the fetched
    // `availableNormalizations`) and canvas's whole-config-snapshot build has
    consulted: 'x',
    // stands in for arc's `dataCurrent`. MUST be observable: the bug only
    // appears once the gate closing itself re-runs the autorun, because that
    // re-run is what rebuilds the dependency set without the trigger reads. A
    // plain closure variable flips silently and reproduces nothing.
    loaded: false,
    // RegionTooLargeMixin's two, which the skeleton reads directly rather than
    // leaving to each composer's `shouldFetch` — see the too-large test below.
    regionTooLarge: false,
    gateMeasurementStale: true,
    // FetchMixin's, and the retry check's "deliberately not fetching" exemption
    loadingSuppressed: false,
  }))
  .views(self => ({
    rpcProps() {
      void self.consulted
      return { setting: self.setting }
    },
  }))
  .actions(self => ({
    setMinimized(flag: boolean) {
      self.isMinimized = flag
    },
    setSetting(v: string) {
      self.setting = v
    },
    setConsulted(v: string) {
      self.consulted = v
    },
    setLoaded(flag: boolean) {
      self.loaded = flag
    },
    setTooLarge(tooLarge: boolean, stale = true) {
      self.regionTooLarge = tooLarge
      self.gateMeasurementStale = stale
    },
    setLoadingSuppressed(flag: boolean) {
      self.loadingSuppressed = flag
    },
    reload() {
      self.reloadCounter += 1
    },
  }))

// the arc shape: the gate goes false the moment data lands, and the display
// itself owns that observable
type TestDisplayModel = Instance<typeof TestDisplay>

function setup(shouldFetch: (d: TestDisplayModel) => boolean) {
  const view = TestView.create({ display: {} })
  const { display } = view
  const gateCalls = { count: 0 }
  const fetched = { count: 0 }
  installGlobalFetchAutorun(display, {
    shouldFetch: () => {
      gateCalls.count += 1
      return shouldFetch(display)
    },
    fetch: () => {
      fetched.count += 1
    },
    delay: DELAY,
    name: 'TestGlobalFetch',
  })
  return { view, display, gateCalls, fetched }
}

// the first run is leading-edge; every later one waits out `delay`
async function settle() {
  await new Promise(resolve => setTimeout(resolve, DELAY * 6))
}

// The dev-only contract checks report through `console.error`, and this file's
// fixture drives the violating shapes on purpose — so capture it for every suite
// here rather than only where it is asserted, or an expected report prints with
// a stack trace and reads as a failing suite.
//
// Direct assignment rather than `jest.spyOn`, matching
// assertDisplayContract.test.ts: the repo's jest setup installs its own
// `console.error` wrapper, and a spy leaves that wrapper in place to print
// anyway. Spanning the whole test rather than one call, because these reports
// land inside a debounced autorun rather than synchronously.
let errors: string[]
let originalError: typeof console.error
beforeEach(() => {
  errors = []
  originalError = console.error
  console.error = (...args: unknown[]) => {
    errors.push(args.map(a => `${a}`).join(' '))
  }
})
afterEach(() => {
  console.error = originalError
})

describe('installGlobalFetchAutorun', () => {
  it('fetches immediately on install, without waiting out the debounce', () => {
    const { fetched } = setup(() => true)
    expect(fetched.count).toBe(1)
  })

  // HiC (`effectiveResolution !== undefined`) and LD (`showLDTriangle &&
  // !regionTooLarge`) both keep their gate open after loading, which is why
  // reload always worked for them even with the trigger reads under the gate.
  it('refetches on reload() when the gate stays open', async () => {
    const { display, fetched } = setup(() => true)
    expect(fetched.count).toBe(1)
    await settle()

    display.reload()
    await settle()
    expect(fetched.count).toBeGreaterThan(1)
  })

  // Re-evaluating is all the trigger reads can buy, and for this one trigger it
  // is not enough: a gate that declines a *reload* is the dead Retry button. So
  // the re-evaluation is asserted here and the report that follows it is
  // asserted in "the retry contract" below — two halves of one story, kept apart
  // because every other trigger in this suite is legitimately allowed to decline.
  it('re-evaluates on a reload() bump after the gate has closed', async () => {
    const { display, gateCalls, fetched } = setup(d => !d.loaded)
    expect(fetched.count).toBe(1)
    display.setLoaded(true)
    await settle()

    const before = gateCalls.count
    display.reload()
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
    expect(errors.join('\n')).toMatch(/Retry is a dead button/)
  })

  it('re-evaluates on an rpcProps() change after the gate has closed', async () => {
    const { display, gateCalls } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    const before = gateCalls.count
    display.setSetting('b')
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
  })

  // the trigger is the *serialized* payload (MultiRegion's `rpcPropsCacheKey`
  // axis), so an observable rpcProps() merely consults doesn't refetch — this is
  // what keeps a global display off refetches the per-region family wouldn't do
  it('ignores an observable rpcProps() reads but does not return', async () => {
    const { display, gateCalls } = setup(() => true)
    await settle()

    const before = gateCalls.count
    display.setConsulted('y')
    await settle()
    expect(gateCalls.count).toBe(before)
  })

  it('re-evaluates when the viewport changes after the gate has closed', async () => {
    const { view, display, gateCalls } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    const before = gateCalls.count
    view.setBlocks(['chr1:100-200'])
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
  })

  it('re-evaluates on un-minimize after the gate has closed', async () => {
    const { display, gateCalls } = setup(d => !d.loaded)
    display.setLoaded(true)
    display.setMinimized(true)
    await settle()

    const before = gateCalls.count
    display.setMinimized(false)
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
  })

  it('refetches when a reload() bump also reopens the gate', async () => {
    // what a display gets by pairing the counter bump with dropping its own
    // freshness signal (ArcFetchModel.reload clears loadedRegionSignature)
    const { display, fetched } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()
    expect(fetched.count).toBe(1)

    display.setLoaded(false)
    display.reload()
    await settle()
    expect(fetched.count).toBe(2)
  })
})

// The retry contract, which the trigger reads above do NOT buy on their own:
// they guarantee `reload()` re-RUNS the autorun, not that the run reaches a
// fetch. A gate that goes false the moment data lands declines that re-run, the
// error clears, and nothing refetches — a button that is present, looks live and
// does nothing. Arc shipped exactly that. The suite above deliberately asserts
// only on re-evaluation ("a gate that stays false is allowed to keep
// declining"), which is true of every OTHER trigger and false of this one, so
// the difference is checked here rather than by tightening those.
describe('the retry contract', () => {
  it('reports a reload() that re-runs the autorun but reaches no fetch', async () => {
    // the arc shape, before its `reload()` override existed
    const { display } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()
    expect(errors).toEqual([])

    display.reload()
    await settle()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Retry is a dead button/)
    expect(errors[0]).toMatch(/reload\(\) has to invalidate/)
  })

  it('stays silent when reload() also reopens the gate', async () => {
    // the arc shape as shipped: the counter bump paired with dropping its own
    // freshness signal
    const { display, fetched } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    display.setLoaded(false)
    display.reload()
    await settle()
    expect(fetched.count).toBe(2)
    expect(errors).toEqual([])
  })

  it('stays silent for a display that is deliberately not fetching', async () => {
    // LD with the triangle off: `reload()` correctly does nothing, because there
    // is nothing to load. Same flag the loading scrim reads, so this exemption
    // is not a second thing to remember.
    const { display } = setup(d => !d.loadingSuppressed)
    display.setLoadingSuppressed(true)
    await settle()

    display.reload()
    await settle()
    expect(errors).toEqual([])
  })

  // the too-large banner offers Force load, not Retry, so a run the byte gate
  // skipped answers the bump legitimately — and consuming it there is what stops
  // the report landing on whichever unrelated run clears the gate later
  it('stays silent while the byte gate is holding, and after it clears', async () => {
    const { view, display } = setup(() => true)
    await settle()

    display.setTooLarge(true, /* stale */ false)
    display.reload()
    await settle()
    expect(errors).toEqual([])

    display.setTooLarge(false)
    view.setBlocks(['chr1:0-400'])
    await settle()
    expect(errors).toEqual([])
  })

  // a plain settings change or pan that declines to fetch is not a retry
  it('says nothing about a decline with no reload behind it', async () => {
    const { display } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    display.setSetting('b')
    await settle()
    expect(errors).toEqual([])
  })
})

// The too-large skip lives in the skeleton, not in each composer's
// `shouldFetch`, and it is "don't fetch a viewport you have already measured"
// rather than "don't fetch". A blocked display has to run its fetch once per
// settled viewport, because that fetch IS the re-measure — every gated display
// measures first and stops there when the answer is over budget — and it is the
// only thing that can release the banner.
describe('a blocked display still re-measures', () => {
  it('skips a viewport whose estimate is current, and fetches once when it moves', async () => {
    const { view, display, fetched } = setup(() => true)
    await settle()
    const afterFirst = fetched.count

    // banner up, and the estimate describes what is on screen: nothing to do
    display.setTooLarge(true, /* stale */ false)
    view.setBlocks(['chr1:0-200'])
    await settle()
    expect(fetched.count).toBe(afterFirst)

    // the user moves somewhere the estimate says nothing about
    display.setTooLarge(true, /* stale */ true)
    view.setBlocks(['chr1:0-300'])
    await settle()
    expect(fetched.count).toBe(afterFirst + 1)
  })
})
