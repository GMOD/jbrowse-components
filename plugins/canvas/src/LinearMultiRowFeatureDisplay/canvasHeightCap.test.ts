import { MAX_CANVAS_DIM_PX, getDpr } from '@jbrowse/render-core/canvas2dUtils'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function rowsOnly(n: number): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    rowValues: Array.from({ length: n }, (_, i) => `row${i}`),
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    fieldNames: [],
    rowsFieldCandidateValues: [],
    legendCandidates: [],
    resolvedRowsField: 'name',
  }
}

const BIG_COHORT = 1987

describe('the row stack cannot outgrow the canvas limit', () => {
  it('caps the height slot the rows divide, since it is drag-resizable', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(4), ctgA)
    display.setHeight(MAX_CANVAS_DIM_PX * 4)

    expect(display.height).toBeCloseTo(display.maxCanvasHeight)
    expect(display.height * getDpr()).toBeLessThanOrEqual(MAX_CANVAS_DIM_PX)
  })

  it('stalls a drag at the cap rather than growing a canvas that cannot draw', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(BIG_COHORT), ctgA)
    display.setHeight(MAX_CANVAS_DIM_PX * 4)

    expect(display.resizeHeight(500)).toBe(0)
    expect(display.height).toBeCloseTo(display.maxCanvasHeight)
  })

  it('a drag down from the cap still shrinks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(BIG_COHORT), ctgA)
    display.setHeight(MAX_CANVAS_DIM_PX * 4)
    const capped = display.height

    display.resizeHeight(-500)

    expect(display.height).toBeCloseTo(capped - 500)
  })
})
