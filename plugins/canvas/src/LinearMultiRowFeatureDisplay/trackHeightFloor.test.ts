import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function rowsOnly(n: number): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    rowValues: Array.from({ length: n }, (_, i) => `row${i}`),
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    rowsFieldCandidates: [],
    rowsFieldCandidateValues: [],
    legendCandidates: [],
    resolvedRowsField: 'name',
  }
}

// The floor lands on the track rather than on the row, so a sub-pixel row stays
// reachable.
describe('the track cannot be dragged below a usable height', () => {
  it('floors a few-row painting at MIN_DISPLAY_HEIGHT', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(3), ctgA)

    display.setHeight(2)

    expect(display.height).toBeCloseTo(MIN_DISPLAY_HEIGHT)
  })

  it('lets a drag shrink a big cohort past a pixel a row', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(1987), ctgA)

    // Sub-pixel rows are legitimate — rowBand widens them to MIN_DRAWN_ROW_PX
    // for drawing — so a 1px-per-row floor would stall this drag at 1987px.
    display.setHeight(400)

    expect(display.height).toBeCloseTo(400)
    expect(display.effectiveRowHeight).toBeLessThan(1)
    expect(display.effectiveRowHeight).toBeGreaterThan(0)
  })
})

// The rows divide the height slot, so how many rows arrive never moves it.
describe('the track height holds however many rows arrive', () => {
  it('takes the height slot with no rows', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeight(150)

    expect(display.sources).toHaveLength(0)
    expect(display.height).toBe(150)
  })

  it('keeps it as rows land, and divides it among them', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeight(200)

    display.setRpcData(0, rowsOnly(12), ctgA)
    expect(display.height).toBe(200)
    expect(display.effectiveRowHeight).toBeCloseTo(200 / 12)

    display.setRpcData(0, rowsOnly(40), ctgA)
    expect(display.height).toBe(200)
    expect(display.effectiveRowHeight).toBeCloseTo(200 / 40)
  })
})
