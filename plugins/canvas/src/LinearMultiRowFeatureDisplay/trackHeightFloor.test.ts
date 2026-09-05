import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

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
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// The floor lands on the track rather than on the row, so a sub-pixel row stays
// reachable in fixed mode as it already is in auto-fit.
describe('the track cannot be dragged below a usable height', () => {
  it('floors a few-row painting at MIN_DISPLAY_HEIGHT in fixed row-height mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(3), ctgA)
    display.setRowHeight(14)

    display.setHeight(2)

    // toBeCloseTo because the height round-trips through a per-row division
    // and back.
    expect(display.height).toBeCloseTo(MIN_DISPLAY_HEIGHT)
  })

  it('floors auto-fit mode the same way', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(3), ctgA)
    display.setRowHeight(0)

    display.setHeight(2)

    expect(display.height).toBeCloseTo(MIN_DISPLAY_HEIGHT)
  })

  it('lets a fixed-height drag shrink a big cohort past a pixel a row', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(1987), ctgA)
    display.setRowHeight(14)

    // Sub-pixel rows are legitimate — rowBand widens them to MIN_DRAWN_ROW_PX
    // for drawing — so a 1px-per-row floor would stall this drag at 1987px.
    display.setHeight(400)

    expect(display.height).toBeCloseTo(400)
    expect(display.effectiveRowHeight).toBeLessThan(1)
    expect(display.effectiveRowHeight).toBeGreaterThan(0)
  })
})

// The derived `height` sizes the canvas, the too-large banner and the density
// band alike, and a pinned row height over no rows sizes every one of them to a
// sliver.
describe('the derived height carries the floor the drag does', () => {
  it('floors a pinned row height over no rows at all', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRowHeight(14)

    expect(display.sources).toHaveLength(0)
    expect(display.height).toBe(MIN_DISPLAY_HEIGHT)
  })

  it('floors a pinned row height when a subtree filter names no row', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(3), ctgA)
    display.setRowHeight(14)
    expect(display.height).toBeCloseTo(42)

    display.setSubtreeFilter(['nobody'])

    expect(display.sources).toHaveLength(0)
    expect(display.height).toBe(MIN_DISPLAY_HEIGHT)
  })

  it('leaves a taller stack alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(10), ctgA)
    display.setRowHeight(14)

    expect(display.height).toBeCloseTo(140)
  })
})
