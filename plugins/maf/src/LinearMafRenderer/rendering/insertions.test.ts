import { renderInsertions } from './insertions.ts'

import type { RenderingContext } from './types.ts'

const enc = new TextEncoder()
const bytes = (s: string) => enc.encode(s)

function makeCtx() {
  const fillRectCalls: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({ x, y, w, h })
    },
    fillText: () => {},
  }
  return { ctx, fillRectCalls }
}

function makeContext(ctx: object): RenderingContext {
  return {
    ctx: ctx as RenderingContext['ctx'],
    scale: 10,
    rowHeight: 15,
    h: 12,
    palette: {
      colorForBase: { a: '#f00', c: '#0f0', g: '#00f', t: '#ff0', n: '#888' },
      matchColor: '#d3d3d3',
      gapColor: '#1e1e1e',
      mismatchOffColor: '#ffa500',
      unknownBaseColor: '#000',
      insertionColor: '#800080',
    },
    showAllLetters: false,
    mismatchRendering: true,
    reversed: false,
    bpToCellLeftPx: bp => bp * 10,
  }
}

test('one insertion in the middle draws one marker', () => {
  const { ctx, fillRectCalls } = makeCtx()
  // seq AC---T → alignment ACCCCT: one 3-base insertion between C and T
  renderInsertions(
    makeContext(ctx),
    bytes('ACCCCT'),
    bytes('AC---T'),
    100,
    0,
    0.5,
  )
  expect(fillRectCalls.length).toBeGreaterThan(0)
})

test('no insertions draws nothing', () => {
  const { ctx, fillRectCalls } = makeCtx()
  renderInsertions(makeContext(ctx), bytes('ACGT'), bytes('ACGT'), 100, 0, 0.5)
  expect(fillRectCalls).toHaveLength(0)
})

test('alignment shorter than seq with trailing insertion does not inflate insLen past LARGE threshold', () => {
  // Worker output has a 5-bp insertion (5 'C's). The seq column has 20 dashes
  // — i.e. the longest insertion across rows is 20bp, padded with `-` per
  // sample. The renderer must not count those padding dashes as bases.
  // With the bug, insLen grows to 20 (crosses LARGE_INSERTION_THRESHOLD=10)
  // and the renderer switches to the large-glyph path → wrong glyph + text.
  const { ctx, fillRectCalls } = makeCtx()
  const seq = bytes(`A${'-'.repeat(20)}`)
  const alignment = bytes(`A${'C'.repeat(5)}`)
  renderInsertions(makeContext(ctx), alignment, seq, 100, 0, 50)
  // The small-insertion glyph draws 1 rect (the line). The bug pushes us into
  // the LARGE branch, which depending on bpPerPx draws 1 wide rect or a
  // text-backed rect — but the visible-character count is wrong either way.
  // The most reliable assertion: with insLen=5 (truth), bpPerPx=50 (HIGH),
  // we should draw a single small marker rect, NOT the LARGE branch's
  // HIGH_BP_PER_PX wide rect.
  expect(fillRectCalls).toHaveLength(1)
  // The small-insertion line is INSERTION_LINE_WIDTH (=1) wide.
  expect(fillRectCalls[0]!.w).toBe(1)
})

test('alignment longer than seq does not draw spurious insertions', () => {
  const { ctx, fillRectCalls } = makeCtx()
  // alignment overruns seq; the trailing alignment chars have no
  // corresponding seq positions, so nothing should be drawn for them.
  renderInsertions(
    makeContext(ctx),
    bytes('ACGTNNNN'),
    bytes('ACGT'),
    100,
    0,
    0.5,
  )
  expect(fillRectCalls).toHaveLength(0)
})
