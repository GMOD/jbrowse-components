import {
  computeVisibleSummaryBars,
  findSummaryBarAt,
} from './computeVisibleSummaryBars.ts'

import type { MafSummaryRecord } from '../../types.ts'
import type { SummaryBar } from './computeVisibleSummaryBars.ts'

const rowIndexBySrc = new Map([
  ['panTro6', 0],
  ['mm10', 1],
  ['rn6', 2],
])

const view = {
  bpPerPx: 1,
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 100,
      end: 200,
      screenStartPx: 0,
      reversed: false,
    },
  ],
}

function rec(over: Partial<MafSummaryRecord>): MafSummaryRecord {
  return {
    refName: 'chr1',
    start: 100,
    end: 110,
    src: 'mm10',
    score: 0.9,
    ...over,
  }
}

test('positions a summary bar on its species row across the block extent', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: { get: () => [rec({ src: 'rn6', leftStatus: 'C' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // row 2: h=12, offset=1.5, rowTop = 1.5 + 15*2 = 31.5; x spans bp100..110
  expect(bars).toEqual([
    {
      x: 0,
      width: 10,
      rowTop: 31.5,
      h: 12,
      score: 0.9,
      rowIndex: 2,
      start: 100,
      end: 110,
      leftStatus: 'C',
      rightStatus: undefined,
    },
  ])
})

test('drops rows whose src is not in the current source set', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: { get: () => [rec({ src: 'unlisted_species' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(bars).toHaveLength(0)
})

test('clamps sub-pixel blocks to a minimum 1px width', () => {
  const bars = computeVisibleSummaryBars({
    view: { ...view, bpPerPx: 1000 },
    summaryDataMap: { get: () => [rec({ start: 100, end: 101 })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(bars[0]!.width).toBe(1)
})

test('mirrors x for reversed regions', () => {
  const bars = computeVisibleSummaryBars({
    view: {
      bpPerPx: 1,
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 100,
          end: 200,
          screenStartPx: 0,
          reversed: true,
        },
      ],
    },
    summaryDataMap: { get: () => [rec({ src: 'panTro6' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // reversed: bp100..110 → px100..90, left=90 width=10
  expect(bars[0]).toMatchObject({ x: 90, width: 10 })
})

// Reversed AND sub-pixel, which is the only combination that can tell the two
// anchors apart: `bpSpanPx` grows the widening away from the record's START
// edge, which is its RIGHT edge here, so the bar ends at px10. Widening off the
// leftmost edge instead puts it at 9.9 and slides the mark a pixel — the two
// tests above miss it, one being 10px wide and the other forward.
test('widens a sub-pixel bar away from its start edge on a reversed region', () => {
  const bars = computeVisibleSummaryBars({
    view: {
      bpPerPx: 10,
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 100,
          end: 200,
          screenStartPx: 0,
          reversed: true,
        },
      ],
    },
    summaryDataMap: { get: () => [rec({ start: 100, end: 101 })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(bars[0]).toMatchObject({ x: 9, width: 1 })
})

test('emits nothing when a region has no fetched summary', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: { get: () => undefined },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(bars).toHaveLength(0)
})

// The records are the *buffered* region's — one per block per species — while
// `visibleRegions` covers only what is on screen, so at the zoom this path
// exists for roughly half of them position a bar nothing can show. Same
// `[bpLo, bpHi)` cull the block overlays apply.
test('skips records outside the visible span', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: {
      get: () => [
        rec({ src: 'mm10', start: 0, end: 50 }), // left of the visible span
        rec({ src: 'mm10', start: 120, end: 130 }), // inside
        rec({ src: 'mm10', start: 400, end: 500 }), // right of it
      ],
    },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(bars).toHaveLength(1)
  expect(bars[0]!.x).toBe(20)
})

// The hover on this tier. It hit-tests the positioned bars in px rather than
// the records in bp, because the bars are widened to a 1px minimum and at these
// zooms most of them are — a bp test finds nothing under a bar the user is
// plainly pointing at.
describe('findSummaryBarAt', () => {
  const bar = (over: Partial<SummaryBar>): SummaryBar => ({
    x: 10,
    width: 20,
    rowTop: 0,
    h: 12,
    score: 0.5,
    rowIndex: 0,
    start: 100,
    end: 200,
    ...over,
  })

  it('finds the bar under x on the pointed-at row', () => {
    const bars = [bar({ x: 10, rowIndex: 0 }), bar({ x: 10, rowIndex: 1 })]
    expect(findSummaryBarAt(bars, 1, 15)).toBe(bars[1])
  })

  it('is half-open at the right edge, so adjacent bars do not both match', () => {
    const bars = [bar({ x: 0, width: 10 }), bar({ x: 10, width: 10 })]
    expect(findSummaryBarAt(bars, 0, 10)).toBe(bars[1])
    expect(findSummaryBarAt(bars, 0, 9.5)).toBe(bars[0])
  })

  it('resolves a sub-pixel block through its widened 1px bar', () => {
    const bars = [bar({ x: 42, width: 1 })]
    expect(findSummaryBarAt(bars, 0, 42.5)).toBe(bars[0])
  })

  it('returns undefined off any bar, and on a row with none', () => {
    const bars = [bar({})]
    expect(findSummaryBarAt(bars, 0, 100)).toBeUndefined()
    expect(findSummaryBarAt(bars, 3, 15)).toBeUndefined()
  })
})
