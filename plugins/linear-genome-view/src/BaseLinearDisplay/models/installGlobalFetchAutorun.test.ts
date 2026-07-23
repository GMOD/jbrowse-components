// Direct tests for the `installGlobalFetchAutorun` skeleton shared by arc, HiC
// and LD.
//
// The invariant under test: the trigger reads (viewport, isMinimized,
// rpcProps(), reloadCounter) happen unconditionally, ABOVE the display's
// `shouldFetch()` gate. MobX rebuilds an autorun's dependency set on every run,
// so a trigger read placed inside the gate silently falls out of that set on
// the first run that decides not to fetch — and can then never wake the autorun
// again. A display whose `shouldFetch` goes false once its data has loaded
// (arc: `!regionTooLarge && !dataLoaded`) hits that on every successful fetch,
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
    // stands in for arc's `dataLoaded`. MUST be observable: the bug only
    // appears once the gate closing itself re-runs the autorun, because that
    // re-run is what rebuilds the dependency set without the trigger reads. A
    // plain closure variable flips silently and reproduces nothing.
    loaded: false,
  }))
  .views(self => ({
    rpcProps() {
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
    setLoaded(flag: boolean) {
      self.loaded = flag
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

  it('re-evaluates on a reload() bump after the gate has closed', async () => {
    const { display, gateCalls, fetched } = setup(d => !d.loaded)
    expect(fetched.count).toBe(1)
    display.setLoaded(true)
    await settle()

    const before = gateCalls.count
    display.reload()
    await settle()
    expect(gateCalls.count).toBeGreaterThan(before)
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
