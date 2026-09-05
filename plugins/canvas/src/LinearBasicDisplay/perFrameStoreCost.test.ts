import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

// `compareStructural` returns on `a === b` before walking, so the deep walks
// are the calls where the two arguments were not the same object; the mock is
// `fetchInputs.ts`'s import of it.
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
  // Nothing here observes anything, so the memoization under test is only
  // what the display's own reactions install.
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

  it('hands back the same settings tier across a pan and a zoom', () => {
    const { display, view } = loaded()
    const before = display.settingsFetchInputs

    view.scrollTo(view.offsetPx + 1)
    view.zoomTo(view.bpPerPx * 1.1)

    expect(display.settingsFetchInputs).toBe(before)
    expect(
      (display.loadedRegions.get(0)!.fetchInputs as { settings: unknown })
        .settings,
    ).toBe(before)
  })

  it('never walks into the settings payload', () => {
    const { display, view } = loaded()

    view.scrollTo(view.offsetPx + 1)
    expect(display.isCacheValid(0)).toBe(true)
    expect(display.dataCurrent).toBe(true)

    expect(comparisons.length).toBeGreaterThan(0)
    expect(comparisons.filter(c => !c.sameSettings)).toEqual([])
  })

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
