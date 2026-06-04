import { drawMafEmptyLines } from './emptyLines.ts'

import type { EmptyLineSegment } from '../../LinearMafDisplay/components/computeVisibleEmptyLines.ts'
import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function makeCtx() {
  const calls: { style: string; x: number; y: number; w: number; h: number }[] =
    []
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ style: this.fillStyle, x, y, w, h })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, calls }
}

const palette = {
  bridgeLineColor: '#bridge',
  missingDataColor: '#pale',
} as MafColorPalette

const seg = (status: EmptyLineSegment['status']): EmptyLineSegment => ({
  x: 5,
  width: 20,
  rowTop: 10,
  h: 12,
  status,
})

test('C status draws a single center line', () => {
  const { ctx, calls } = makeCtx()
  drawMafEmptyLines(ctx, [seg('C')], palette)
  expect(calls).toEqual([{ style: '#bridge', x: 5, y: 16, w: 20, h: 1 }])
})

test('I/n status draws a double line', () => {
  const { ctx, calls } = makeCtx()
  drawMafEmptyLines(ctx, [seg('I')], palette)
  expect(calls).toHaveLength(2)
  expect(calls.every(c => c.style === '#bridge' && c.h === 1)).toBe(true)
  expect(calls[0]!.y).toBeLessThan(calls[1]!.y)
})

test('M status fills a pale bar over the whole band', () => {
  const { ctx, calls } = makeCtx()
  drawMafEmptyLines(ctx, [seg('M')], palette)
  expect(calls).toEqual([{ style: '#pale', x: 5, y: 10, w: 20, h: 12 }])
})
