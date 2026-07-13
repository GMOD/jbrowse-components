import { textWidthForNumber } from '@jbrowse/alignments-core'

import { drawMafInsertions } from './insertions.ts'

import type { InsertionMarker } from '../../LinearMafDisplay/components/computeVisibleInsertions.ts'

function makeCtx() {
  const fillRectCalls: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
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

const marker = (over: Partial<InsertionMarker> = {}): InsertionMarker => ({
  xCenter: 100,
  rowTop: 0,
  h: 12,
  length: 3,
  ...over,
})

const draw = (
  ctx: ReturnType<typeof makeCtx>['ctx'],
  markers: InsertionMarker[],
  pxPerBp = 10,
) => {
  drawMafInsertions(ctx as never, markers, '#800080', pxPerBp)
}

test('one marker draws one insertion glyph', () => {
  const { ctx, fillRectCalls } = makeCtx()
  draw(ctx, [marker({ length: 3 })])
  expect(fillRectCalls.length).toBeGreaterThan(0)
})

test('no markers draws nothing', () => {
  const { ctx, fillRectCalls } = makeCtx()
  draw(ctx, [])
  expect(fillRectCalls).toHaveLength(0)
})

test('a small insertion is a single 1px bar', () => {
  // length 5 stays 'small' (< LONG_INSERTION_MIN_LENGTH=10) → 1px bar
  const { ctx, fillRectCalls } = makeCtx()
  draw(ctx, [marker({ length: 5 })])
  expect(fillRectCalls).toHaveLength(1)
  expect(fillRectCalls[0]!.w).toBe(1)
})

test('a large insertion box is number-width when tall but shrinks when the row is too short', () => {
  // length 10 at pxPerBp 10 → 'large' (length>=10, length*pxPerBp>=15)
  const tall = makeCtx()
  draw(tall.ctx, [marker({ length: 10, h: 12 })])
  expect(tall.fillRectCalls).toHaveLength(1)
  expect(tall.fillRectCalls[0]!.w).toBe(textWidthForNumber(10))

  const short = makeCtx()
  draw(short.ctx, [marker({ length: 10, h: 3 })])
  expect(short.fillRectCalls).toHaveLength(1)
  // count won't fit → narrow 'long' bar instead of an empty number-width box
  expect(short.fillRectCalls[0]!.w).toBe(5)
  expect(short.fillRectCalls[0]!.w).toBeLessThan(tall.fillRectCalls[0]!.w)
})
