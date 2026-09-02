// Direct tests for the `installGlobalFetchAutorun` declaration over the shared
// `installFetch` skeleton, shared by arc, HiC, LD and multi-way synteny.
//
// The invariant under test: every state the body can decline in keeps a read
// that wakes it. MobX rebuilds an autorun's dependency set on every run, so a
// trigger read that stops happening on a declining run silently falls out of
// that set — and can then never wake the autorun again. A display whose
// `prepare` declines once its data has loaded (arc: `dataCurrent`) hits that on
// every successful fetch, which is how `reload()` came to be a no-op there. The
// skeleton reads `reloadCounter` and `fetchCanceled` unconditionally; the
// viewport and the `rpcProps()` axis are tracked through `currentFetchKey`,
// which `prepare` and the freshness gate read on every run the gates let
// through; and each gate term is an observable that flips on the transition to
// wake on.
//
// So these assert on how often the BODY re-evaluated (prepare call count), not
// on how often it fetched: re-running the body is the thing the tracked reads
// buy, and a gate that stays shut is allowed to keep declining.

import { createStopTokenRotation } from '@jbrowse/core/util/createStopTokenRotation'
import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import { installGlobalFetchAutorun } from './installGlobalFetchAutorun.ts'
import { serializeRpcProps } from './rpcPropsCacheKey.ts'

import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

const DELAY = 10

// What the display reads off its view, stated structurally: naming
// `Instance<typeof TestView>` from inside TestDisplay would be a circular type
// (the view already reaches the display through `types.late`).
interface TestViewShape extends IStateTreeNode {
  initialized: boolean
  dynamicBlocks: { contentBlocks: { key: string }[] }
}

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
    // what the cancel lapses on, and a separate observable from the trigger
    // above deliberately: the durability rule is "a viewport change", not "any
    // trigger"
    visibleRegions: [{ key: 'chr1:0-100' }],
  }))
  .actions(self => ({
    setWidth(n: number) {
      self.width = n
    },
    setInitialized(flag: boolean) {
      self.initialized = flag
    },
    setBlocks(keys: string[]) {
      self.dynamicBlocks = { contentBlocks: keys.map(key => ({ key })) }
      self.visibleRegions = keys.map(key => ({ key }))
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
    fetchInert: false,
    // FetchMixin's durable user-cancel flag: the skeleton gates on it and
    // lapses it on a viewport change
    fetchCanceled: false,
    // the LGV foundations', and the check's second exemption: a view holding no
    // content block declines every display in it, and none of those Retry
    // buttons is dead for a reason a `reload()` could fix
    viewportEmpty: false,
    // stands in for HiC's `effectiveResolution === undefined`, and read by
    // NOTHING else — which is what makes it a probe for whether the retry
    // check's reads leak into the autorun's dependency set. See the two
    // dependency-set tests at the bottom.
    prereqPending: false,
    // every `commitFetchBytes` the runner made, as the per-region list it was
    // handed — the byte gate's whole main-thread surface now that the fetch
    // itself measures
    committedBytes: [] as (number | undefined)[][],
    // `GlobalFetchMixin`'s: what `commitFetchResult` stamps and `dataCurrent`
    // compares against
    loadedFetchKey: undefined as string | undefined,
  }))
  .volatile(self => ({
    // `FetchMixin`'s rotation, lent to the skeleton — which is also what a test
    // superseding an in-flight fetch reaches (`fetchRotation.cancel()`)
    fetchRotation: createStopTokenRotation(self, {
      setStatusMessage: () => {},
    }),
  }))
  .views(self => ({
    rpcProps() {
      void self.consulted
      return { setting: self.setting }
    },
    // the hosting view, the way `GlobalFetchMixin.host` answers it
    get host(): TestViewShape {
      return getParent<TestViewShape>(self)
    },
  }))
  .views(self => ({
    // `GlobalFetchMixin`'s freshness pair, spelled the way that mixin spells
    // it: the block set plus the serialized settings axis, so the viewport and
    // `rpcProps()` are tracked wherever the signature is read — which is now
    // the whole viewport trigger, the way it is for the real mixin.
    get currentFetchKey(): string | undefined {
      return `${self.host.dynamicBlocks.contentBlocks
        .map(b => b.key)
        .join(',')}|${this.rpcPropsCacheKey}`
    },
    get dataCurrent() {
      return isDataCurrent(self.loadedFetchKey, this.currentFetchKey)
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
      return serializeRpcProps(self as never)
    },
  }))
  .actions(self => ({
    // `BaseDisplay`'s no-op default, which the installer's hover clear calls
    clearHoveredFeature() {},
    // `FetchMixin`'s begin/end/error bookkeeping, cut down to what the skeleton
    // calls of it. Cancellation and loading-flag mechanics are that mixin's own
    // tests' business, not this file's.
    beginFetch(_stopToken: StopToken) {
      // a load starting clears the durable user-cancel, as the real one does
      self.fetchCanceled = false
    },
    endFetch(_current: boolean) {},
    setError(_error?: unknown) {},
    // `GlobalFetchMixin.commitFetchResult`
    commitFetchResult(commit: () => void, signature: string) {
      commit()
      self.loadedFetchKey = signature
    },
    // `RegionTooLargeMixin`'s byte-gate commit pair. The gate state is what a
    // measurement is judged against; this fixture records the bytes the runner
    // hands back so a test can assert the refusal path reached the gate.
    gateFetchState() {
      return {
        viewport: { spanBp: 100, key: 'ctgA:0-100' },
        gated: self.regionTooLarge,
        tierKey: undefined,
      }
    },
    commitFetchBytes(
      perRegionBytes: (number | undefined)[],
      issued: { gated: boolean },
    ) {
      self.committedBytes.push(perRegionBytes)
      // `nextGateState`'s stamp, cut down to what these tests read of it: a
      // fetch the gate was active for measured the viewport it was issued at,
      // so nothing further is owed there.
      if (issued.gated) {
        self.gateMeasurementStale = false
      }
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
      self.fetchInert = flag
    },
    setPrereqPending(flag: boolean) {
      self.prereqPending = flag
    },
    setViewportEmpty(flag: boolean) {
      self.viewportEmpty = flag
    },
    reload() {
      self.reloadCounter += 1
      self.loadedFetchKey = undefined
    },
    // `FetchMixin`'s pair, cut down to the flag plus the rotation: the internal
    // reset the viewport-change autorun runs, and the user gesture the
    // overlay's Cancel button runs — both supersede an in-flight fetch, which
    // is what the stale-commit test below leans on
    cancelFetch() {
      self.fetchRotation.cancel()
      self.fetchCanceled = false
    },
    cancelFetchByUser() {
      self.fetchRotation.cancel()
      self.fetchCanceled = true
    },
  }))

// the arc shape: the gate goes false the moment data lands, and the display
// itself owns that observable
type TestDisplayModel = Instance<typeof TestDisplay>

// `shouldFetch` reads as `prepare` returning undefined, which is the whole of
// the phase collapse from this file's point of view: `gateCalls` counts the
// runs that reached `prepare`, `fetched` the ones that reached `run`.
// Async because the leading edge is a microtask: every test here starts from
// "the first run has happened", rather than each one remembering to flush.
async function setup(
  shouldFetch: (d: TestDisplayModel) => boolean,
  // what `run` answers. Undefined by default, so a fetch commits nothing and
  // the freshness gate stays open; a test that needs the display to be HOLDING
  // data passes a payload.
  result?: string,
) {
  const view = TestView.create({ display: {} })
  const { display } = view
  const gateCalls = { count: 0 }
  const fetched = { count: 0 }
  installGlobalFetchAutorun(display, {
    prepare: () => {
      gateCalls.count += 1
      return shouldFetch(display) ? { regions: [] } : undefined
    },
    run: async () => {
      fetched.count += 1
      return result
    },
    commit: () => {},
    delay: DELAY,
    name: 'TestGlobalFetch',
  })
  await Promise.resolve()
  return { view, display, gateCalls, fetched }
}

// The phases, with their own fixture: `setup` above collapses `prepare` to a
// boolean, and these are about what the skeleton does with what the phases
// return. Each is a rule the three displays used to write out themselves.
async function setupPhases({ run }: { run: () => unknown }) {
  const view = TestView.create({ display: {} })
  const { display } = view
  const committed: { result: unknown; args: unknown }[] = []
  installGlobalFetchAutorun(display, {
    prepare: () => ({ issuedAt: display.setting, regions: [] }),
    run: async () => run(),
    commit: (result, args) => {
      committed.push({ result, args })
    },
    delay: DELAY,
    name: 'TestPhases',
  })
  await Promise.resolve()
  return { view, display, committed }
}

describe('the phases', () => {
  it('hands the commit what prepare captured, not a live re-read', async () => {
    const { display, committed } = await setupPhases({ run: () => 'data' })
    // the setting the fetch was issued at moves while the RPC is out
    display.setSetting('b')
    await settle()

    expect(committed[0]).toEqual({
      result: 'data',
      args: { issuedAt: 'a', regions: [] },
    })
  })

  // the byte-gate shape: the pre-flight stopped this fetch, so there is nothing
  // to commit and the model must not be written
  it('skips the commit when run yields nothing', async () => {
    const { committed } = await setupPhases({ run: () => undefined })
    await settle()
    expect(committed).toEqual([])
  })

  // a superseded fetch resolving late, which is the write every display used to
  // guard with its own `if (ctx.isStale()) return`
  it('skips the commit when the fetch went stale', async () => {
    // held open, so the staleness lands while the fetch is genuinely in flight
    // rather than after it has already committed
    let release!: (value: string) => void
    const inFlight = new Promise<string>(resolve => {
      release = resolve
    })
    const { display, committed } = await setupPhases({ run: () => inFlight })
    // what a newer fetch or a user cancel does: drop the rotation's token, so
    // the in-flight run stops being the answer
    display.fetchRotation.cancel()
    release('data')
    await settle()
    expect(committed).toEqual([])
  })
})

// the first run is leading-edge; every later one waits out `delay`
async function settle() {
  await new Promise(resolve => setTimeout(resolve, DELAY * 6))
}

// The contract checks report through `console.error`, and this file's
// fixture drives the violating shapes on purpose. `config/jest/console.js`
// buffers those reports and the gate fails any test that leaves one unclaimed,
// so every test here takes them — which is both the opt-in and how they are
// read. Replacing `console.error` locally, which this did before, hid the
// reports from the gate rather than excusing them.
//
// Taken after `settle()`, never before: these land inside a debounced autorun
// rather than synchronously.
const reports = () => takeContractReports()

describe('installGlobalFetchAutorun', () => {
  it('fetches immediately on install, without waiting out the debounce', async () => {
    // no timer advanced: `setup` awaits only the microtask the leading edge
    // yields for — see leadingEdgeAutorun
    const { fetched } = await setup(() => true)
    expect(fetched.count).toBe(1)
  })

  // HiC (`effectiveResolution !== undefined`) and LD (`showLDTriangle`) both
  // keep their gate open after loading, which is why reload always worked for
  // them even with the trigger reads under the gate.
  it('refetches on reload() when the gate stays open', async () => {
    const { display, fetched } = await setup(() => true)
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
    const { display, gateCalls, fetched } = await setup(d => !d.loaded)
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
    const { display, gateCalls } = await setup(d => !d.loaded)
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
    const { display, gateCalls } = await setup(() => true)
    await settle()

    const before = gateCalls.count
    display.setConsulted('y')
    await settle()
    expect(gateCalls.count).toBe(before)
  })

  it('re-evaluates when the viewport changes after the gate has closed', async () => {
    const { view, display, gateCalls } = await setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    const before = gateCalls.count
    view.setBlocks(['chr1:100-200'])
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
  })

  it('re-evaluates on un-minimize after the gate has closed', async () => {
    const { display, gateCalls } = await setup(d => !d.loaded)
    display.setLoaded(true)
    display.setMinimized(true)
    await settle()

    const before = gateCalls.count
    display.setMinimized(false)
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
  })

  it('refetches when a reload() bump also reopens the gate', async () => {
    // what a display gets by pairing the counter bump with dropping its
    // freshness signal (GlobalFetchMixin.reload clears loadedFetchKey)
    const { display, fetched } = await setup(d => !d.loaded)
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
// The durability rule this family had no half of: `fetchCanceled` was never
// read here, so any trigger — a pan, a settings change — walked straight into
// `runFetch`, which resets the flag, and the load the user stopped came back on
// its own. It is now the per-region family's rule for both of them: **durable
// until the viewport changes or Retry**.
describe('the user cancel', () => {
  it('is durable: a settings change does not restart the load', async () => {
    const { display, fetched } = await setup(() => true)
    await settle()
    expect(fetched.count).toBe(1)

    display.cancelFetchByUser()
    display.setSetting('b')
    await settle()

    expect(fetched.count).toBe(1)
    expect(display.fetchCanceled).toBe(true)
  })

  it('lapses when the viewport moves', async () => {
    const { view, display, fetched } = await setup(() => true)
    await settle()
    display.cancelFetchByUser()
    await settle()
    expect(fetched.count).toBe(1)

    view.setBlocks(['chr1:100-200'])
    await settle()

    expect(display.fetchCanceled).toBe(false)
    expect(fetched.count).toBe(2)
  })

  // the trap the read order exists for: the gate closes, so a body that
  // returned before reading `reloadCounter` would drop the one observable that
  // can reopen it and Cancel would be a one-way door with a Retry button on it
  it('reload() reopens it', async () => {
    const { display, fetched } = await setup(() => true)
    await settle()
    display.cancelFetchByUser()
    await settle()
    expect(fetched.count).toBe(1)

    // what `GlobalFetchMixin.reload()` does, in the two halves this fixture has
    display.cancelFetch()
    display.reload()
    await settle()

    expect(fetched.count).toBe(2)
  })

  // the skip is a foundation gate, not the display's own decline, so it
  // consumes an outstanding bump without reporting the dead Retry the check
  // hunts for
  it('a run the cancel skipped is not reported as a dead Retry', async () => {
    const { display } = await setup(() => true)
    await settle()
    expect(takeContractReports()).toEqual([])

    display.reload()
    display.cancelFetchByUser()
    await settle()

    expect(takeContractReports()).toEqual([])
  })
})

describe('the retry contract', () => {
  it('reports a reload() that re-runs the autorun but reaches no fetch', async () => {
    // the arc shape, before its `reload()` override existed
    const { display } = await setup(d => !d.loaded)
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
    const { display, fetched } = await setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()

    display.setLoaded(false)
    display.reload()
    await settle()
    expect(fetched.count).toBe(2)
    expect(reports()).toEqual([])
  })

  // The viewport, not the display: with no content block on screen there is no
  // region to ask for, so every display in the view declines and reporting would
  // name a fix that does not exist — on all of them at once, which is how a
  // check stops being read.
  it('stays silent while the viewport holds no content block', async () => {
    // the gate declines because the viewport does, the way every real global
    // `prepare` declines on an empty block list
    const { display } = await setup(d => !d.viewportEmpty)
    display.setViewportEmpty(true)
    await settle()

    display.reload()
    await settle()
    expect(reports()).toEqual([])
  })

  it('stays silent for a display that is deliberately not fetching', async () => {
    // LD with the triangle off: `reload()` correctly does nothing, because there
    // is nothing to load. Same flag the loading scrim reads, so this exemption
    // is not a second thing to remember.
    const { display } = await setup(d => !d.fetchInert)
    display.setLoadingSuppressed(true)
    await settle()

    display.reload()
    await settle()
    expect(reports()).toEqual([])
  })

  // HiC's shape: `reload()` wakes a prerequisite fetch in another autorun, this
  // one declines only until that lands, and the landing wakes it again through
  // the same tracked read. `fetchInert` is the wrong claim for it — HiC
  // wants the scrim meanwhile — so the display says this instead.
  it('holds the verdict over a decline that is waiting on a prerequisite', async () => {
    const { display, fetched } = await setup(d => d.loaded)
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
    const { display } = await setup(() => false)
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
    const { display } = await setup(d => !d.loaded)
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
    const { view, display } = await setup(() => true)
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
    const { display } = await setup(d => !d.loaded)
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
    const { view, display, fetched } = await setup(() => true)
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

  // The same invariant against a display that is HOLDING data for the viewport
  // it returns to, which is the half the freshness compare used to break: the
  // freshness gate answers "nothing owed" for a span whose data was committed
  // earlier, while the banner is hiding that very data and this fetch is the
  // only re-measure. What makes `regionTooLarge` outrank it is `loadedKey`
  // reading as absent while the banner holds — the same precedence the
  // per-region family applies through `heldDataAnswers`, spelled here as a key
  // so the skeleton's reload epoch can override it. `gateSkipsMeasuredViewport`
  // is what keeps it to one.
  it('fetches a viewport whose data it still holds, and only once', async () => {
    const { view, display, fetched } = await setup(() => true, 'data')
    await settle()
    expect(display.dataCurrent).toBe(true)
    const afterFirst = fetched.count

    display.setTooLarge(true, /* stale */ true)
    view.setBlocks(['chr1:0-400'])
    await settle()
    expect(fetched.count).toBe(afterFirst + 1)

    // that fetch stamped the viewport it measured, so the runs behind it stop
    expect(display.gateMeasurementStale).toBe(false)
    await settle()
    expect(fetched.count).toBe(afterFirst + 1)
  })
})

// The gate's own two terms, asserted on FETCHES rather than on body runs: the
// suppression half is what nothing at this level pinned until 2026-08-31, and
// `packages/display-kit/CLAUDE.md` points at this file for the family's gate
// behaviour. The skeleton's own suite covers the same shape over its `gate`
// option; these cover the terms THIS declaration puts in it.
describe('the gate suppresses a fetch while it is shut', () => {
  it('does not fetch while minimized, and fetches once on expand', async () => {
    const { view, display, fetched } = await setup(() => true)
    await settle()
    const afterFirst = fetched.count

    display.setMinimized(true)
    view.setBlocks(['chr1:0-200'])
    await settle()
    expect(fetched.count).toBe(afterFirst)

    // the viewport moved under the shut gate, so expanding owes exactly one
    display.setMinimized(false)
    await settle()
    expect(fetched.count).toBe(afterFirst + 1)
  })

  // `currentFetchKey` is computed from view-derived getters that throw before
  // init by design, so this term is what keeps `prepare` from being reached at
  // all — and it is observable, which is what makes the decline safe.
  it('does not fetch before the view is initialized, and fetches once after', async () => {
    const { view, fetched } = await setup(() => true)
    await settle()
    const afterFirst = fetched.count

    view.setInitialized(false)
    view.setBlocks(['chr1:0-300'])
    await settle()
    expect(fetched.count).toBe(afterFirst)

    view.setInitialized(true)
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
    const { display, gateCalls } = await setup(() => false)
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

  it('does not track fetchInert', async () => {
    // read only once `retried && declined` both hold — JS short-circuits before
    // it otherwise — so the reload is what gets the check as far as reading it
    const { display, gateCalls } = await setup(d => !d.loaded)
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

  it('does not track viewportEmpty', async () => {
    // same short-circuit as `fetchInert` above, one term further along
    const { display, gateCalls } = await setup(d => !d.loaded)
    display.setLoaded(true)
    await settle()
    display.reload()
    await settle()
    expect(reports().join('\n')).toMatch(/Retry is a dead button/)

    const before = gateCalls.count
    display.setViewportEmpty(true)
    await settle()
    expect(gateCalls.count).toBe(before)
  })
})
