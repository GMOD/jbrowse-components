import { textWidthForNumber } from '@jbrowse/alignments-core'

import { renderInsertions } from './insertions.ts'

import type { RenderingContext } from './types.ts'

const enc = new TextEncoder()
const bytes = (s: string) => enc.encode(s)

function makeCtx() {
  const fillRectCalls: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({ x, y, w, h })
    },
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
  }
  return { ctx, fillRectCalls }
}

function makeContext(ctx: object, h = 12): RenderingContext {
  return {
    ctx: ctx as RenderingContext['ctx'],
    scale: 10,
    rowHeight: 15,
    h,
    palette: {
      colorForBase: { a: '#f00', c: '#0f0', g: '#00f', t: '#ff0', n: '#888' },
      matchColor: '#d3d3d3',
      gapColor: '#1e1e1e',
      mismatchOffColor: '#ffa500',
      unknownBaseColor: '#000',
      insertionColor: '#800080',
      bridgeLineColor: '#888888',
      missingDataColor: '#ffffcc',
    },
    cellColorConfig: {
      colorForBase: { a: '#f00', c: '#0f0', g: '#00f', t: '#ff0', n: '#888' },
      matchColor: '#d3d3d3',
      gapColor: '#1e1e1e',
      mismatchOffColor: '#ffa500',
      unknownBaseColor: '#000',
      showAllLetters: false,
      mismatchRendering: true,
    },
    reversed: false,
    bpToCellLeftPx: bp => bp * 10,
  }
}

test('one insertion in the middle draws one marker', () => {
  const { ctx, fillRectCalls } = makeCtx()
  // seq AC---T → alignment ACCCCT: one 3-base insertion between C and T
  renderInsertions(makeContext(ctx), bytes('ACCCCT'), bytes('AC---T'), 100, 0)
  expect(fillRectCalls.length).toBeGreaterThan(0)
})

test('no insertions draws nothing', () => {
  const { ctx, fillRectCalls } = makeCtx()
  renderInsertions(makeContext(ctx), bytes('ACGT'), bytes('ACGT'), 100, 0)
  expect(fillRectCalls).toHaveLength(0)
})

test('alignment shorter than seq with trailing insertion does not inflate insLen past LARGE threshold', () => {
  // Worker output has a 5-bp insertion (5 'C's). The seq column has 20 dashes
  // — i.e. the longest insertion across rows is 20bp, padded with `-` per
  // sample. The walk must count only this sample's 5 inserted bases, not the
  // 20 padding dashes — else length crosses LONG_INSERTION_MIN_LENGTH(=10) and
  // switches to the wide large-insertion glyph.
  const { ctx, fillRectCalls } = makeCtx()
  const seq = bytes(`A${'-'.repeat(20)}`)
  const alignment = bytes(`A${'C'.repeat(5)}`)
  renderInsertions(makeContext(ctx), alignment, seq, 100, 0)
  // length=5 stays 'small' → a single 1px bar (insertionBarWidth small = 1).
  expect(fillRectCalls).toHaveLength(1)
  expect(fillRectCalls[0]!.w).toBe(1)
})

test('large insertion box is number-width when tall but shrinks to a bar when the row is too short for the count', () => {
  // 10-base insertion at scale 10 → 'large' (length>=10, length*scale>=15).
  const seq = bytes(`A${'-'.repeat(10)}T`)
  const alignment = bytes(`A${'C'.repeat(10)}T`)

  const tall = makeCtx()
  renderInsertions(makeContext(tall.ctx, 12), alignment, seq, 100, 0)
  expect(tall.fillRectCalls).toHaveLength(1)
  expect(tall.fillRectCalls[0]!.w).toBe(textWidthForNumber(10))

  const short = makeCtx()
  renderInsertions(makeContext(short.ctx, 3), alignment, seq, 100, 0)
  expect(short.fillRectCalls).toHaveLength(1)
  // count won't fit → narrow 'long' bar (min(5, len*scale/3)) instead of an
  // empty number-width box
  expect(short.fillRectCalls[0]!.w).toBe(5)
  expect(short.fillRectCalls[0]!.w).toBeLessThan(tall.fillRectCalls[0]!.w)
})

test('alignment longer than seq does not draw spurious insertions', () => {
  const { ctx, fillRectCalls } = makeCtx()
  // alignment overruns seq; the trailing alignment chars have no
  // corresponding seq positions, so nothing should be drawn for them.
  renderInsertions(makeContext(ctx), bytes('ACGTNNNN'), bytes('ACGT'), 100, 0)
  expect(fillRectCalls).toHaveLength(0)
})
