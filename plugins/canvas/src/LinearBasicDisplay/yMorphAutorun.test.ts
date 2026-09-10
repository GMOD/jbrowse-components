import { packStackedGenes } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { TestDisplay } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 }

// Short spans close together, so how many share a row is a function of bpPerPx
// and a zoom repacks them. The seeded packer holds a feature's row across a
// change that leaves room for it, so an insertion would move nothing.
const shortFeatures = packStackedGenes(
  Array.from({ length: 40 }, (_, i) => ({
    featureId: `f${i}`,
    name: `f${i}`,
    startBp: 100 + i * 90,
    endBp: 100 + i * 90 + 60,
    isoforms: 1,
    strand: 1,
  })),
)

const tops = (display: TestDisplay) =>
  new Map(
    display.laidOutDataMap
      .get(0)!
      .flatbushItems.map(item => [item.featureId, item.topPx]),
  )

const movedIds = (before: Map<string, number>, after: Map<string, number>) =>
  [...after].filter(([id, top]) => before.get(id) !== top).map(([id]) => id)

function setUp() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  // grow keeps the fit ladder on its `full` rung, so the row-geometry
  // signature holds still and the repack is the only variable
  display.setHeightMode('grow')
  display.setRpcData(0, shortFeatures, ctgA)
  view.settleCoarseBlocks()
  return { display, view }
}

function zoomTo(env: ReturnType<typeof setUp>, bpPerPx: number) {
  const before = tops(env.display)
  env.view.zoomTo(bpPerPx)
  env.view.settleCoarseBlocks()
  return { before, moved: movedIds(before, tops(env.display)) }
}

describe('the Y morph autorun decides for itself', () => {
  it('morphs a zoom that only reassigns rows', () => {
    const env = setUp()
    const { before, moved } = zoomTo(env, 4)

    expect(moved.length).toBeGreaterThan(0)
    const { morphFromTops, morphProgress } = env.display
    expect(morphFromTops).toBeDefined()
    expect(morphProgress).toBe(0)
    for (const id of moved) {
      expect(morphFromTops!.get(id)).toBe(before.get(id))
    }
  })

  it('holds the taller of the two heights while the morph is in flight', () => {
    const env = setUp()
    zoomTo(env, 20)
    const tall = env.display.settledMaxY

    zoomTo(env, 4)

    expect(env.display.morphFromTops).toBeDefined()
    expect(env.display.settledMaxY).toBeLessThan(tall)
    expect(env.display.maxY).toBe(tall)
  })

  it('snaps instead when the change rescales the rows, morph in flight or not', () => {
    const env = setUp()
    zoomTo(env, 4)
    expect(env.display.morphFromTops).toBeDefined()
    const before = tops(env.display)

    env.display.setDisplayMode('compact')

    expect(movedIds(before, tops(env.display)).length).toBeGreaterThan(0)
    expect(env.display.morphFromTops).toBeUndefined()
  })

  it('starts nothing when a relayout moves no row', () => {
    const env = setUp()

    env.display.setRpcData(0, shortFeatures, ctgA)

    expect(env.display.morphFromTops).toBeUndefined()
  })
})
