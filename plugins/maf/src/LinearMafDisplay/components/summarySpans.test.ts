import { abgrAlpha } from '@jbrowse/core/util/colorBits'
import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'

import { EMPTY_MAF_CELLS } from '../../LinearMafRenderer/mafChannels.ts'
import {
  MAF_MARKS,
  MAF_SUMMARY_MARK,
} from '../../LinearMafRenderer/mafMarks.ts'
import { EMPTY_MAF_COVERAGE } from '../encodeMafRows.ts'
import {
  encodeSummarySpans,
  summaryAt,
  summaryBarAlpha,
} from './summarySpans.ts'

import type {
  MafGPURenderState,
  MafRowsPayload,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSummaryRecord } from '../../types.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const rowIndexBySrc = new Map([
  ['panTro6', 0],
  ['mm10', 1],
  ['rn6', 2],
])

const MATCH = 'rgba(0, 0, 0, 0.12)'
const ROWS_TOP = 20

const STATE = {
  canvasWidth: 100,
  canvasHeight: ROWS_TOP + 1000,
  rowsTop: ROWS_TOP,
  rowsHeight: 1000,
  rowHeight: 15,
  rowProportion: 0.8,
  scrollTop: 0,
} as MafGPURenderState

// `bpPerPx` bp to the pixel across a 100px block starting at bp 100.
function block(bpPerPx: number, reversed = false): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 100,
    end: 100 + 100 * bpPerPx,
    screenStartPx: 0,
    screenEndPx: 100,
    reversed,
  }
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

function payload(records: MafSummaryRecord[]): MafRowsPayload {
  return {
    cells: EMPTY_MAF_CELLS,
    summary: encodeSummarySpans(records, rowIndexBySrc, MATCH),
  }
}

function paint(records: MafSummaryRecord[], b: RenderBlock) {
  const rects: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h })
    },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arc() {},
    ellipse() {},
    setLineDash() {},
    closePath() {},
    fill() {},
    strokeStyle: '',
    lineWidth: 1,
    strokeRect() {},
    stroke() {},
    scale() {},
    rotate() {},
  } satisfies MarkContext2D
  MAF_SUMMARY_MARK.paintBlock(ctx, payload(records), b, STATE)
  return rects
}

test('summaryBarAlpha maps score 0..1 onto floor..1, clamped', () => {
  expect(summaryBarAlpha(1)).toBeCloseTo(1)
  expect(summaryBarAlpha(0)).toBeCloseTo(0.25)
  expect(summaryBarAlpha(0.6)).toBeCloseTo(0.7)
  expect(summaryBarAlpha(2)).toBeCloseTo(1)
  expect(summaryBarAlpha(-1)).toBeCloseTo(0.25)
})

test('a bar takes the match color at its score-proportional alpha', () => {
  const { color } = encodeSummarySpans(
    [rec({ score: 1 }), rec({ score: 0 }), rec({ score: 0.6 })],
    rowIndexBySrc,
    MATCH,
  )
  expect([...color].map(c => c & 0xffffff)).toEqual([0, 0, 0])
  expect([...color].map(abgrAlpha)).toEqual([255, 64, 179])
})

test('positions a bar on its species row across the block extent', () => {
  // row 2: h=12, offset=1.5, top = 1.5 + 15*2 = 31.5 in the rows band
  expect(paint([rec({ src: 'rn6' })], block(1))).toEqual([
    { x: 0, y: ROWS_TOP + 31.5, w: 10, h: 12 },
  ])
})

test('drops records whose src is not in the current source set', () => {
  const spans = encodeSummarySpans(
    [rec({ src: 'unlisted_species' }), rec({ src: 'rn6', start: 150 })],
    rowIndexBySrc,
    MATCH,
  )
  expect(spans.count).toBe(1)
  expect(spans.records.map(r => r.start)).toEqual([150])
})

test('clamps sub-pixel blocks to a minimum 1px width', () => {
  expect(paint([rec({ start: 100, end: 101 })], block(1000))).toMatchObject([
    { w: 1 },
  ])
})

test('mirrors x for reversed regions', () => {
  // reversed: bp100..110 → px100..90, left=90 width=10
  expect(paint([rec({})], block(1, true))).toMatchObject([{ x: 90, w: 10 }])
})

// Reversed AND sub-pixel, which is the only combination that can tell the two
// anchors apart: the widening grows away from the record's START edge, which
// is its RIGHT edge here, so the bar ends at px100. Widening off the leftmost
// edge instead puts it at 99.9 and slides the mark a pixel.
test('widens a sub-pixel bar away from its start edge on a reversed region', () => {
  expect(paint([rec({ start: 100, end: 101 })], block(10, true))).toMatchObject(
    [{ x: 99, w: 1 }],
  )
})

test('the GPU draws the bars off their own buffer, in the rows band', () => {
  const hal = new MockHal(MAF_MARKS.map(m => m.pass))
  const backend = new GpuMarkBackend(hal, MAF_MARKS)
  const region = { ...payload([rec({})]), coverage: EMPTY_MAF_COVERAGE }
  backend.upload(0, region)
  backend.renderBlocks([block(1)], new Map([[0, region]]), {
    ...STATE,
    coverage: { height: 0 },
  } as MafGPURenderState)
  expect(hal.draws().map(d => d.passId)).toEqual(['span', 'mafSummary'])
})

// The hover on this tier. It hit-tests the drawn bars in px rather than the
// records in bp, because the bars are widened to a 1px minimum and at these
// zooms most of them are — a bp test finds nothing under a bar the user is
// plainly pointing at.
describe('summaryAt', () => {
  const at = (
    records: MafSummaryRecord[],
    b: RenderBlock,
    rowIndex: number,
    x: number,
  ) => summaryAt(new Map([[0, payload(records)]]), [b], STATE, rowIndex, x)

  it('finds the bar under x on the pointed-at row', () => {
    const records = [rec({ src: 'panTro6' }), rec({ src: 'mm10' })]
    expect(at(records, block(1), 1, 5)).toBe(records[1])
  })

  it('is half-open at the right edge, so adjacent bars do not both match', () => {
    const records = [
      rec({ start: 100, end: 110 }),
      rec({ start: 110, end: 120 }),
    ]
    expect(at(records, block(1), 1, 10)).toBe(records[1])
    expect(at(records, block(1), 1, 9.5)).toBe(records[0])
  })

  it('resolves a sub-pixel block through its widened 1px bar', () => {
    const records = [rec({ start: 1100, end: 1101 })]
    expect(at(records, block(1000), 1, 1.5)).toBe(records[0])
  })

  it('returns undefined off any bar, and on a row with none', () => {
    const records = [rec({})]
    expect(at(records, block(1), 1, 50)).toBeUndefined()
    expect(at(records, block(1), 2, 5)).toBeUndefined()
  })
})
