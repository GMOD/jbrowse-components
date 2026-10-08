import { drawInversions } from './inversions.ts'

import type { InversionMarker } from '../../LinearMafDisplay/components/computeVisibleInversions.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function makeCtx() {
  const hatch: number[] = []
  const inked: { y: number; y2: number }[] = []
  const ctx = {
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    stroke() {},
    moveTo(x: number) {
      hatch.push(x)
    },
    lineTo() {},
    strokeRect(_x: number, y: number, _w: number, h: number) {
      const half = this.lineWidth / 2
      inked.push({ y: y - half, y2: y + h + half })
    },
    fillRect(_x: number, y: number, _w: number, h: number) {
      inked.push({ y, y2: y + h })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, hatch, inked }
}

const marker = (m: Partial<InversionMarker>): InversionMarker => ({
  xLeft: 0,
  width: 100,
  visibleLeft: 0,
  visibleWidth: 100,
  rowTop: 20,
  h: 12,
  ...m,
})

// A block's pixel span is unbounded when zoomed in: 50kb at 10px/bp is 500k px.
const WIDE = {
  xLeft: -250000,
  width: 500000,
  visibleLeft: 0,
  visibleWidth: 800,
}

test('hatches only the part of a block on screen', () => {
  const { ctx, hatch } = makeCtx()
  drawInversions(ctx, [marker(WIDE)], 'red')
  expect(hatch.length).toBeLessThanOrEqual(800 / 4 + 12 / 4 + 1)
  expect(Math.min(...hatch)).toBeGreaterThanOrEqual(-12 - 4)
  expect(Math.max(...hatch)).toBeLessThan(800)
})

test('the hatch covers the whole visible part', () => {
  const { ctx, hatch } = makeCtx()
  drawInversions(ctx, [marker(WIDE)], 'red')
  expect(Math.min(...hatch)).toBeLessThanOrEqual(-12)
  expect(Math.max(...hatch)).toBeGreaterThanOrEqual(800 - 4)
})

test('the hatch phase follows the block, not the screen edge', () => {
  const linesAt = (xLeft: number) => {
    const { ctx, hatch } = makeCtx()
    drawInversions(ctx, [marker({ ...WIDE, xLeft })], 'red')
    return hatch.map(x => x - xLeft)
  }
  const phase = (xs: number[]) => new Set(xs.map(x => ((x % 4) + 4) % 4))
  expect(phase(linesAt(-250000))).toEqual(phase(linesAt(-250001)))
  expect(phase(linesAt(-250001)).size).toBe(1)
})

test('a block off the visible part draws no hatch', () => {
  const { ctx, hatch } = makeCtx()
  drawInversions(ctx, [marker({ xLeft: 810, visibleWidth: 0 })], 'red')
  expect(hatch).toEqual([])
})

test.each([1, 2, 3, 4])('a %ipx row inks only itself, unhatched', h => {
  const { ctx, hatch, inked } = makeCtx()
  drawInversions(ctx, [marker({ h })], 'red')
  expect(hatch).toEqual([])
  expect(inked).toHaveLength(1)
  expect(inked[0]!.y).toBeGreaterThanOrEqual(20)
  expect(inked[0]!.y2).toBeLessThanOrEqual(20 + h)
})
