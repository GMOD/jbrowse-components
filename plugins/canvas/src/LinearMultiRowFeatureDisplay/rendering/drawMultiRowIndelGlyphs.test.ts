import { insertionBarWidth } from '@jbrowse/alignments-core'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { drawMultiRowIndelGlyphs } from './drawMultiRowIndelGlyphs.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './multiRowRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface FillRectCall {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
}

function mockCtx() {
  const calls: FillRectCall[] = []
  // fillStyle rides along with the text: these labels are drawn ON the painting,
  // so the color they are drawn in is part of whether they were drawn at all.
  const texts: {
    text: string
    x: number
    y: number
    fillStyle: string
  }[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    rect() {},
    clip() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, calls, texts }
}

const RED = 0xff0000ff
const BLUE = 0xffff0000

// 100bp over 1000px => 10px/bp throughout.
const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const state: MultiRowRenderState = {
  canvasWidth: 1000,
  canvasHeight: 40,
  rowHeight: 20,
  rowProportion: 1,
  rowIndexByValue: new Map([
    ['mom', 0],
    ['dad', 1],
  ]),
  rowColorsByIndex: [],
  hiddenColors: new Set<number>(),
}

// Two 1bp features on two rows: x 100-110 (center 105) and x 500-510 (center
// 505). 1bp is the pure-insertion shape — a bubble with no reference span,
// widened to one base — so the bar is wider than the block and draws.
const narrow: MultiRowRegionData = {
  featureStarts: Uint32Array.from([10, 50]),
  featureEnds: Uint32Array.from([11, 51]),
  featureColors: Uint32Array.from([RED, BLUE]),
  partitionValues: ['mom', 'dad'],
  featurePartitionIndex: Uint32Array.from([0, 1]),
  featureNames: ['a', 'b'],
  featureIds: ['f1', 'f2'],
  featureDeltas: new Int32Array(0),
  usedItemRgb: false,
  partitionCandidates: [],
  resolvedPartitionField: 'name',
}

// The same two features spanning 10bp (100px) each, comfortably wider than any
// bar this delta earns.
const wide: MultiRowRegionData = {
  ...narrow,
  featureEnds: Uint32Array.from([20, 60]),
}

const DELTA = 5000
const BAR = insertionBarWidth(DELTA, 10, 20)
// The theme's insertion color, which is also what plugin-alignments' pileup
// paints -- the point of passing it in rather than hardcoding one here.
const INSERTION_COLOR = resolvePalette().insertion

function draw(
  region: MultiRowRegionData,
  overrides?: Partial<MultiRowRenderState>,
) {
  const { ctx, calls, texts } = mockCtx()
  drawMultiRowIndelGlyphs(
    ctx,
    new Map([[0, region]]),
    [block],
    {
      ...state,
      ...overrides,
    },
    INSERTION_COLOR,
  )
  return { calls, texts }
}

// The length-0 array is the "slot unset" signal, and it has to be read as such
// rather than as an empty region — every existing multi-row painting ships it,
// so a presence check on the wrong axis would draw glyphs on ancestry tracks.
test('draws nothing when no deltas were packed', () => {
  expect(draw(narrow).calls).toEqual([])
})

test('a zero delta draws nothing, so reference-length alleles stay bare', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([0, 0]) }
  expect(draw(region).calls).toEqual([])
})

// The whole reason the slot exists: a block's width is the reference span, so
// the mark's width has to come from the delta instead. Same delta, different
// reference spans => same bar.
test('insertion bar width follows the delta, not the reference span', () => {
  const region: MultiRowRegionData = {
    ...narrow,
    // 1bp (10px) vs 2bp (20px) of reference, both under the bar width
    featureEnds: Uint32Array.from([11, 52]),
    featureDeltas: Int32Array.from([DELTA, DELTA]),
  }
  const widths = draw(region).calls.map(c => c.w)
  expect(widths[0]).toBe(widths[1])
  // pinned against the shared primitive rather than a copy of its formula, so
  // this test enforces the sharing instead of duplicating it
  expect(widths[0]).toBe(BAR)
})

test('insertion bar centers on the block it annotates', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([DELTA, 0]) }
  expect(draw(region).calls).toEqual([
    { x: 105 - BAR / 2, y: 0, w: BAR, h: 20, fillStyle: INSERTION_COLOR },
  ])
})

// Where the block is already wider than the bar it *is* the bar — same color,
// same center — so a second fill is pure overdraw. The magnitude still has to
// reach the reader, and that is the label's job.
test('a block wider than the bar gets the label but no redundant bar', () => {
  const region = { ...wide, featureDeltas: Int32Array.from([113174, 0]) }
  const { calls, texts } = draw(region)
  expect(calls).toEqual([])
  expect(texts).toEqual([{ text: '113174', x: 150, y: 10, fillStyle: '#fff' }])
})

test('a large insertion labels itself with the bp count', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([113174, 0]) }
  expect(draw(region).texts).toEqual([
    { text: '113174', x: 105, y: 10, fillStyle: '#fff' },
  ])
})

// The label is the magnitude: a signed one reads as a length that went negative,
// which is what docs review took "-9048" for on the pangenome path figures. The
// grey line and the legend already carry the direction.
test('a deletion draws a line across the reference span it removes', () => {
  const region = { ...wide, featureDeltas: Int32Array.from([0, -3217]) }
  const { calls, texts } = draw(region)
  // feature 1 spans x 500-600 on row 1 (y 20-40), so the line sits at its
  // vertical middle
  expect(calls).toEqual([{ x: 500, y: 29, w: 100, h: 2, fillStyle: '#333' }])
  expect(texts).toEqual([{ text: '3217', x: 550, y: 25, fillStyle: '#fff' }])
})

// The regression: with no `color` slot every row takes a `tagColorPalette`
// entry, and every one of those is a pastel. A hardcoded white bp count was
// therefore invisible on the default configuration of the very track the glyphs
// were built for -- a pangenome path BED, whose config example sets
// `lengthField` and nothing else -- in exactly the case above, where the block
// is wide enough that no purple bar is drawn under the text.
test('labels read against a pale block rather than staying white on it', () => {
  const region = { ...wide, featureDeltas: Int32Array.from([113174, -3217]) }
  const { texts } = draw(region, {
    // '#BBCCEE' is tagColorPalette[0]; '#800080' is the theme insertion purple,
    // so the two rows are the two sides of the contrast decision.
    rowColorsByIndex: [cssColorToABGR('#BBCCEE'), cssColorToABGR('#800080')],
  })

  expect(texts).toEqual([
    { text: '113174', x: 150, y: 10, fillStyle: 'rgba(0, 0, 0, 0.87)' },
    { text: '3217', x: 550, y: 25, fillStyle: '#fff' },
  ])
})

// …and where a bar IS drawn, the label sits on the bar, not on the block, so the
// block's color is the wrong thing to measure against. Same pale row as above,
// now on the narrow (pure-insertion) shape that earns a bar.
test('a label on the insertion bar reads against the bar', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([113174, 0]) }
  const { texts } = draw(region, {
    rowColorsByIndex: [cssColorToABGR('#BBCCEE')],
  })

  expect(texts).toEqual([{ text: '113174', x: 105, y: 10, fillStyle: '#fff' }])
})

test('a deletion narrower than the label threshold draws the line only', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([0, -5]) }
  const { calls, texts } = draw(region)
  expect(calls).toHaveLength(1)
  expect(texts).toEqual([])
})

test('skips glyphs whose row is filtered out of rowIndexByValue', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([DELTA, DELTA]) }
  expect(
    draw(region, { rowIndexByValue: new Map([['mom', 0]]) }).calls,
  ).toEqual(
    draw({ ...region, featureDeltas: Int32Array.from([DELTA, 0]) }).calls,
  )
})

test('skips glyphs whose color is a hidden category', () => {
  const region = { ...narrow, featureDeltas: Int32Array.from([DELTA, DELTA]) }
  const { calls } = draw(region, { hiddenColors: new Set([BLUE]) })
  expect(calls).toHaveLength(1)
  expect(calls[0]!.x).toBe(105 - BAR / 2)
})
