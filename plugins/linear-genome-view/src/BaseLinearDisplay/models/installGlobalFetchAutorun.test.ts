// Direct tests for the `installGlobalFetchAutorun` skeleton shared by arc, HiC
// and LD.
//
// The invariant under test: the trigger reads (viewport, isMinimized,
// rpcProps(), reloadCounter) happen unconditionally, ABOVE the display's
// `prepare()`. MobX rebuilds an autorun's dependency set on every run, so a
// trigger read placed inside a bail-out silently falls out of that set on the
// first run that decides not to fetch — and can then never wake the autorun
// again. A display whose `prepare` declines once its data has loaded (arc:
// `dataCurrent`) hits that on every successful fetch, which is how `reload()`
// came to be a no-op there.
//
// So these assert on how often the BODY re-evaluated (prepare call count), not
// on how often it fetched: re-running the body is the thing the trigger reads
// buy, and a gate that stays shut is allowed to keep declining.

import { flow, types } from '@jbrowse/mobx-state-tree'

import { installGlobalFetchAutorun } from './GlobalDataDisplayMixin.ts'
import { serializeRpcProps } from './rpcPropsCacheKey.ts'

import type { FetchContext } from './FetchMixin.ts'
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
    // leaving to each composer's `prepare` — see the too-large test below.
    regionTooLarge: false,
    gateMeasurementStale: true,
    // FetchMixin's, and the retry check's "deliberately not fetching" exemption
    loadingSuppressed: false,
    // stands in for HiC's `effectiveResolution === undefined`, and read by
    // NOTHING else — which is what makes it a probe for whether the retry
    // check's reads leak into the autorun's dependency set. See the two
    // dependency-set tests at the bottom.
    prereqPending: false,
    // what `FetchMixin.runFetch`'s own `isStale` answers once a newer fetch or a
    // cancel has superseded this one
    stale: false,
  }))
  .views(self => ({
    rpcProps() {
      void self.consulted
      return { setting: self.setting }
    },
    // `FetchMixin`'s hook, which this fixture composes by hand — the check reads
    // it off the node in both families rather than taking a predicate.
    get awaitingPrerequisite() {
      return self.prereqPending
    },
    // `RegionTooLargeMixin`'s combined skip, spelled here the same way the real
    // mixin spells it. The two volatiles above stand in for its inputs.
    get gateSkipsMeasuredViewport() {
      return self.regionTooLarge && !self.gateMeasurementStale
    },
    // `FetchMixin`'s, over this fixture's own `rpcProps` above
    get rpcPropsCacheKey() {
      return serializeRpcProps(this as never)
    },
  }))
  .actions(self => ({
    // `FetchMixin.runFetch`, cut down to what the skeleton uses of it: it runs
    // the work and hands it a context. Cancellation and error capture are that
    // mixin's own tests' business, not this file's.
    runFetch: flow(function* (work: (ctx: FetchContext) => Promise<void>) {
      yield work({
        stopToken: '',
        isStale: () => self.stale,
        statusCallback: () => {},
      })
    }),
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
    setPrereqPending(flag: boolean) {
      self.prereqPending = flag
    },
    setStale(flag: boolean) {
      self.stale = flag
    },
    reload() {
      self.reloadCounter += 1
    },
  }))

// the arc shape: the gate goes false the moment data lands, and the display
// itself owns that observable
type TestDisplayModel = Instance<typeof TestDisplay>

// `shouldFetch` reads as `prepare` returning undefined, which is the whole of
// the phase collapse from this file's point of view: `gateCalls` counts the
// runs that reached `prepare`, `fetched` the ones that reached `run`.
function setup(shouldFetch: (d: TestDisplayModel) => boolean) {
  const view = TestView.create({ display: {} })
  const { display } = view
  const gateCalls = { count: 0 }
  const fetched = { count: 0 }
  installGlobalFetchAutorun(display, {
    prepare: () => {
      gateCalls.count += 1
      return shouldFetch(display) ? {} : undefined
    },
    run: async () => {
      fetched.count += 1
      return undefined
    },
    commit: () => {},
    delay: DELAY,
    name: 'TestGlobalFetch',
  })
  return { view, display, gateCalls, fetched }
}

// The phases, with their own fixture: `setup` above collapses `prepare` to a
// boolean, and these are about what the skeleton does with what the phases
// return. Each is a rule the three displays used to write out themselves.
function setupPhases({ run }: { run: () => unknown }) {
  const view = TestView.create({ display: {} })
  const { display } = view
  const committed: { result: unknown; args: unknown }[] = []
  installGlobalFetchAutorun(display, {
    prepare: () => ({ issuedAt: display.setting }),
    run: async () => run(),
    commit: (result, args) => {
      committed.push({ result, args })
    },
    delay: DELAY,
    name: 'TestPhases',
  })
  return { view, display, committed }
}

describe('the phases', () => {
  it('hands the commit what prepare captured, not a live re-read', async () => {
    const { display, committed } = setupPhases({ run: () => 'data' })
    // the setting the fetch was issued at moves while the RPC is out
    display.setSetting('b')
    await settle()

    expect(committed[0]).toEqual({
      result: 'data',
      args: { issuedAt: 'a' },
    })
  })

  // the byte-gate shape: the pre-flight stopped this fetch, so there is nothing
  // to commit and the model must not be written
  it('skips the commit when run yields nothing', async () => {
    const { committed } = setupPhases({ run: () => undefined })
    await settle()
    expect(committed).toEqual([])
  })

  // a superseded fetch resolving late, which is the write every display used to
  // guard with its own `if (ctx.isStale()) return`
  it('skips the commit when the fetch went stale', async () => {
    const { display, committed } = setupPhases({ run: () => 'data' })
    display.setStale(true)
    await settle()
    expect(committed).toEqual([])
  })
})

// the first run is leading-edge; every later one waits out `delay`
async function settle() {
  await new Promise(resolve => setTimeout(resolve, DELAY * 6))
}

// The dev-only contract checks report through `console.error`, and this file's
// fixture drives the violating shapes on purpose. `config/jest/console.js`
// buffers those reports and the gate fails any test that leaves one unclaimed,
// so every test here takes them — which is both the opt-in and how they are
// read. Replacing `console.error` locally, which this did before, hid the
// reports from the gate rather than excusing them.
//
// Taken after `settle()`, never before: these land inside a debounced autorun
// rather than synchronously.
const reports = () => takeDisplayContractReports()

describe('installGlobalFetchAutorun', () => {
  it('fetches immediately on install, without waiting out the debounce', () => {
    const { fetched } = setup(() => true)
    expect(fetched.count).toBe(1)
  })

  // HiC (`effectiveResolution !== undefined`) and LD (`showLDTriangle`) both
  // keep their gate open after loading, which is why reload always worked for
  // them even with the trigger reads under the gate.
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
    expect(reports().join('\n')).toMatch(/Retry is a dead button/)
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

  // the trigger is the *serialized* payload (`FetchMixin.rpcPropsCacheKey`
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
    expect(reports()).toEqual([])

    display.reload()
    await settle()
    // one take, three assertions: taking drains the buffer
    const reported = reports()
    expect(reported).toHaveLength(1)
    expect(reported[0]).toMatch(/Retry is a dead button/)
    expect(reported[0]).toMatch(/reload\(\) has to invalidate/)
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
    expect(reports()).toEqual([])
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
    expect(reports()).toEqual([])
  })

  // HiC's shape: `reload()` wakes a prerequisite fetch in another autorun, this
  // one declines only until that lands, and the landing wakes it again through
  // the same tracked read. `loadingSuppressed` is the wrong claim for it — HiC
  // wants the scrim meanwhile — so the display says this instead.
  it('holds the verdict over a decline that is waiting on a prerequisite', async () => {
    const { display, fetched } = setup(d => d.loaded)
    display.setPrereqPending(true)
    await settle()

    display.reload()
    await settle()
    expect(reports()).toEqual([])

    // the prerequisite landing wakes the same autorun, and THAT run is the one
    // answering the retry — silent because it reaches the fetch
    display.setPrereqPending(false)
    display.setLoaded(true)
    await settle()
    expect(fetched.count).toBe(1)
    expect(reports()).toEqual([])
  })

  // deferral rather than exemption, which is the whole difference: the bump is
  // left outstanding, so a display cannot spend its retry on a decline it
  // called preliminary. Here the prerequisite lands and the gate declines
  // anyway — a genuinely dead button that an exemption would have waved past.
  it('reports when the run after the prerequisite declines too', async () => {
    const { display } = setup(() => false)
    display.setPrereqPending(true)
    await settle()

    display.reload()
    await settle()
    expect(reports()).toEqual([])

    // prerequisite in hand; the retry has to reach a fetch now and does not.
    // `setSetting` is what re-runs the body — nothing this gate reads moved
    display.setPrereqPending(false)
    display.setSetting('b')
    await settle()
    expect(reports().join('\n')).toMatch(/Retry is a dead button/)
  })

  // the negative control: the arc shape, behind a display that never claims a
  // decline, still reports
  it('still reports a decline the display does not claim', async () => {
    const { display } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    display.reload()
    await settle()
    expect(reports().join('\n')).toMatch(/Retry is a dead button/)
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
    expect(reports()).toEqual([])

    display.setTooLarge(false)
    view.setBlocks(['chr1:0-400'])
    await settle()
    expect(reports()).toEqual([])
  })

  // a plain settings change or pan that declines to fetch is not a retry
  it('says nothing about a decline with no reload behind it', async () => {
    const { display } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    display.setSetting('b')
    await settle()
    expect(reports()).toEqual([])
  })
})

// The too-large skip lives in the skeleton, not in each composer's `prepare`,
// and it is "don't fetch a viewport you have already measured"
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

// The retry check runs INSIDE the fetch autorun, so every observable it touches
// is one MobX would add to that autorun's dependency set — and the check is
// stripped in production. A tracked read there gives a display whose fetch
// re-fires on an observable in development and not in the shipped bundle, which
// is a worse bug than the dead button being checked for and one no user-facing
// test can see. `untracked` is what prevents it; these are what prove it, one
// per observable the check reads.
//
// Both probes mutate an observable that NOTHING in the trigger list, `prepare`
// or `rpcProps()` reads, so a re-run can only mean the check leaked it. Asserted
// on `gateCalls` rather than on fetches, because the leak re-runs the body
// whether or not `prepare` then returns args.
describe('the retry check leaks nothing into the dependency set', () => {
  it('does not track awaitingPrerequisite', async () => {
    const { display, gateCalls } = setup(() => false)
    display.setPrereqPending(true)
    display.reload()
    await settle()
    expect(reports()).toEqual([])

    const before = gateCalls.count
    display.setPrereqPending(false)
    await settle()
    expect(gateCalls.count).toBe(before)

    // and the deferral is still outstanding rather than lost: the next run to
    // reach the check is the one that answers the retry, and it declines
    display.setSetting('b')
    await settle()
    expect(reports().join('\n')).toMatch(/Retry is a dead button/)
  })

  it('does not track loadingSuppressed', async () => {
    // read only once `retried && declined` both hold — JS short-circuits before
    // it otherwise — so the reload is what gets the check as far as reading it
    const { display, gateCalls } = setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()
    display.reload()
    await settle()
    expect(reports().join('\n')).toMatch(/Retry is a dead button/)

    const before = gateCalls.count
    display.setLoadingSuppressed(true)
    await settle()
    expect(gateCalls.count).toBe(before)
  })
})
