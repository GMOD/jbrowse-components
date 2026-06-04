import { computeVisibleSummaryBars } from './computeVisibleSummaryBars.ts'

import type { MafSummaryRecord } from '../../types.ts'

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
  return { refName: 'chr1', start: 100, end: 110, src: 'mm10', score: 0.9, ...over }
}

test('positions a summary bar on its species row across the block extent', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: { get: () => [rec({ src: 'rn6', leftStatus: 'C' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // row 2: h=12, offset=1.5, rowTop = 1.5 + 15*2 = 31.5; x spans bp100..110
  expect(bars).toEqual([
    { x: 0, width: 10, rowTop: 31.5, h: 12, score: 0.9, leftStatus: 'C', rightStatus: undefined },
  ])
})

test('drops rows whose src is not in the current source set', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: { get: () => [rec({ src: 'unlisted_species' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
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
  })
  // reversed: bp100..110 → px100..90, left=90 width=10
  expect(bars[0]).toMatchObject({ x: 90, width: 10 })
})

test('emits nothing when a region has no fetched summary', () => {
  const bars = computeVisibleSummaryBars({
    view,
    summaryDataMap: { get: () => undefined },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
  })
  expect(bars).toHaveLength(0)
})
