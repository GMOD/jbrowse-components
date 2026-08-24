import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// A region carrying nothing but its row set — the floor is about how many rows
// there are, not what is painted on them (same shape canvasHeightCap.test.ts
// uses for the opposite bound).
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
    resolvedPartitionField: 'name',
  }
}

// The other end of canvasHeightCap.test.ts: that one pins the ceiling the canvas
// imposes, this one the floor the resize handle needs to stay grabbable — and,
// between them, that the floor lands on the TRACK rather than on the row, so a
// sub-pixel row stays reachable in fixed mode as it already is in auto-fit.
describe('the track cannot be dragged below a usable height', () => {
  it('floors a few-row painting at MIN_DISPLAY_HEIGHT in fixed row-height mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(3))
    display.setRowHeight(14)

    // drag far past the bottom
    display.setHeight(2)

    // toBeCloseTo, like canvasHeightCap's assertions at the other bound: the
    // height round-trips through a per-row division and back
    expect(display.height).toBeCloseTo(MIN_DISPLAY_HEIGHT)
  })

  it('floors auto-fit mode the same way', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(3))
    display.setRowHeight(0)

    display.setHeight(2)

    expect(display.height).toBeCloseTo(MIN_DISPLAY_HEIGHT)
  })

  it('lets a fixed-height drag shrink a big cohort past a pixel a row', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, rowsOnly(1987))
    display.setRowHeight(14)

    // A pinned row height used to floor at 1px a row, which stalled this drag
    // at 1987px — a height auto-fit reaches freely. Sub-pixel rows are
    // legitimate (rowBand widens them to MIN_DRAWN_ROW_PX for drawing).
    display.setHeight(400)

    expect(display.height).toBeCloseTo(400)
    expect(display.effectiveRowHeight).toBeLessThan(1)
    expect(display.effectiveRowHeight).toBeGreaterThan(0)
  })
})
