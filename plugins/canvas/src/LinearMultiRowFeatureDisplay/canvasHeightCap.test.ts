import { MAX_CANVAS_DIM_PX, getDpr } from '@jbrowse/render-core/canvas2dUtils'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// A region carrying nothing but its row set — the cap is about how many rows
// there are, not what is painted on them.
function rowsOnly(n: number): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: Array.from({ length: n }, (_, i) => `row${i}`),
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// The cohort size that motivated this: 1,987 dog genomes, one row each.
const BIG_COHORT = 1987

describe('the row stack cannot outgrow the canvas limit', () => {
  it('caps a pinned row height so the stack still fits a drawable canvas', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(BIG_COHORT))

    // the "Normal" preset from the Row height menu, which is two clicks away
    display.setRowHeight(14)

    // uncapped this is 27,818 CSS px, i.e. 55,636 device px at dpr 2 against an
    // 8,192 limit: the backing store clamps while the scissor rect does not
    expect(BIG_COHORT * 14).toBeGreaterThan(display.maxCanvasHeight)
    expect(display.height).toBeCloseTo(display.maxCanvasHeight)
    expect(display.height * getDpr()).toBeLessThanOrEqual(MAX_CANVAS_DIM_PX)
  })

  it('leaves a row height that already fits alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(10))

    display.setRowHeight(14)

    expect(display.effectiveRowHeight).toBe(14)
    expect(display.height).toBe(140)
  })

  it('caps auto-fit too, since the height slot it divides is drag-resizable', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(4))
    // auto-fit divides this slot across the rows, so a big enough one is the
    // same unbounded canvas by another route
    display.setRowHeight(0)
    display.setHeight(MAX_CANVAS_DIM_PX * 4)

    expect(display.height).toBeCloseTo(display.maxCanvasHeight)
  })

  it('stalls a drag at the cap rather than growing a canvas that cannot draw', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(BIG_COHORT))
    display.setRowHeight(14)

    expect(display.resizeHeight(500)).toBe(0)
    expect(display.height).toBeCloseTo(display.maxCanvasHeight)
  })

  it('a drag down from the cap still shrinks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(BIG_COHORT))
    display.setRowHeight(14)
    const capped = display.height

    display.resizeHeight(-500)

    expect(display.height).toBeCloseTo(capped - 500)
  })
})
