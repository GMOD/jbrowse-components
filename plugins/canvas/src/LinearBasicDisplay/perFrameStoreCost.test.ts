import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

// `compareStructural` returns on `a === b` before it walks anything, so the
// question a frame poses is not "was the comparator called" — `isCacheValid`
// runs per visible block on every viewport change — but "did any call have to
// walk". A wrapper records the answer per call; the deep walks are the calls
// where the two arguments were not the same object.
//
// The mock is `fetchInputs.ts`'s import of it. Everything else about mobx is
// the real module, spread through.
const comparisons: { identical: boolean; sameSettings: boolean }[] = []
jest.mock('mobx', () => {
  const actual = jest.requireActual('mobx')
  const tier = (v: unknown) =>
    v && typeof v === 'object' && 'settings' in v ? v.settings : v
  return {
    ...actual,
    compareStructural: (a: unknown, b: unknown) => {
      comparisons.push({
        identical: a === b,
        sameSettings: a === b || tier(a) === tier(b),
      })
      return actual.compareStructural(a, b)
    },
  }
})

const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

function loaded() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setRpcData(0, makeFeatureData(), ctgA)
  // Nothing here observes anything. The reactions that make these getters
  // memoized are the ones the display installs for itself — `CanvasHitIndexes`
  // and, in a browser, the render lifecycle's upload autorun — and that is the
  // point: a display whose payload map has no reader inside a reaction rebuilds
  // it on every frame, and no type says so.
  comparisons.length = 0
  return { display, view }
}

describe('a frame that changes no data allocates nothing in the store', () => {
  it('hands back the same payload map across a pan and a zoom', () => {
    const { display, view } = loaded()
    const before = display.regionPayloads

    view.scrollTo(view.offsetPx + 1)
    view.scrollTo(view.offsetPx + 1)
    view.zoomTo(view.bpPerPx * 1.1)

    expect(display.regionPayloads).toBe(before)
    expect(display.rpcDataMap).toBe(before)
  })

  // The expensive half of the stamp: `snapshotInputs` deep-clones the RPC
  // payload, and the settings tier is what holds the clone. Its identity
  // surviving a frame is what says the clone ran once and not per read.
  it('hands back the same settings tier across a pan and a zoom', () => {
    const { display, view } = loaded()
    const before = display.settingsFetchInputs

    view.scrollTo(view.offsetPx + 1)
    view.zoomTo(view.bpPerPx * 1.1)

    expect(display.settingsFetchInputs).toBe(before)
    // and it is the object stamped on the region, so `isCacheValid`'s walk
    // stops at a reference test rather than descending into the payload
    expect(
      (display.loadedRegions.get(0)!.fetchInputs as { settings: unknown })
        .settings,
    ).toBe(before)
  })

  // The zoom tier is deliberately NOT held: it is the one fetch input that
  // moves with `bpPerPx`, so holding it would recompute on every frame of a
  // gesture instead of once when the plan next asks. What must never happen is
  // a comparison descending into the settings payload — that is the deep walk.
  it('never walks into the settings payload', () => {
    const { display, view } = loaded()

    view.scrollTo(view.offsetPx + 1)
    expect(display.isCacheValid(0)).toBe(true)
    expect(display.dataCurrent).toBe(true)

    expect(comparisons.length).toBeGreaterThan(0)
    expect(comparisons.filter(c => !c.sameSettings)).toEqual([])
  })

  // The eviction is a commit-time action, not something a getter runs — so a
  // frame cannot pay for it however many entries the store holds.
  it('does not evict from a getter', () => {
    const { display, view } = loaded()
    for (let i = 1; i <= 200; i++) {
      display.setRpcData(i, makeFeatureData(), ctgA)
    }
    const size = display.loadedRegions.size

    view.scrollTo(view.offsetPx + 1)
    view.zoomTo(view.bpPerPx * 1.1)
    void display.regionPayloads
    void display.dataCurrent

    expect(display.loadedRegions.size).toBe(size)
  })
})
