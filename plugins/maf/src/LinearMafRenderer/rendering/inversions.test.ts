import { drawInversions } from './inversions.ts'

import type { InversionMarker } from '../../LinearMafDisplay/components/computeVisibleInversions.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function makeCtx() {
  const hatch: number[] = []
  const inked: { y: number; y2: number }[] = []
  const outlines: { x: number; x2: number }[] = []
  const fills: { x: number; x2: number }[] = []
  const saved: [number, number][] = []
  let clipped: [number, number] = [-Infinity, Infinity]
  let pending: [number, number] = [-Infinity, Infinity]
  const ctx = {
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    save() {
      saved.push(clipped)
    },
    restore() {
      clipped = saved.pop()!
    },
    beginPath() {},
    rect(x: number, _y: number, w: number) {
      pending = [x, x + w]
    },
    clip() {
      clipped = [
        Math.max(clipped[0], pending[0]),
        Math.min(clipped[1], pending[1]),
      ]
    },
    stroke() {},
    moveTo(x: number) {
      hatch.push(x)
    },
    lineTo() {},
    strokeRect(x: number, y: number, w: number, h: number) {
      outlines.push({
        x: Math.max(x - this.lineWidth / 2, clipped[0]),
        x2: Math.min(x + w + this.lineWidth / 2, clipped[1]),
      })
      const half = this.lineWidth / 2
      inked.push({ y: y - half, y2: y + h + half })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({
        x: Math.max(x, clipped[0]),
        x2: Math.min(x + w, clipped[1]),
      })
      inked.push({ y, y2: y + h })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, hatch, inked, outlines, fills }
}

const marker = (m: Partial<InversionMarker>): InversionMarker => ({
  xLeft: 0,
  width: 100,
  visibleLeft: 0,
  visibleWidth: 100,
  regionLeft: 0,
  regionRight: 100,
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
  regionLeft: 0,
  regionRight: 800,
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

describe('the ink a block leaves in its region', () => {
  const inside = { xLeft: 40, width: 20, visibleLeft: 40, visibleWidth: 20 }
  const tiny = { xLeft: 40, width: 0.2, visibleLeft: 40, visibleWidth: 0.2 }
  const flushRight = {
    xLeft: 98,
    width: 2,
    visibleLeft: 98,
    visibleWidth: 2,
  }
  const flushLeft = { xLeft: 0, width: 2, visibleLeft: 0, visibleWidth: 2 }

  const outlineOf = (m: Partial<InversionMarker>) => {
    const { ctx, outlines } = makeCtx()
    drawInversions(ctx, [marker(m)], 'red')
    return outlines
  }
  const fillOf = (m: Partial<InversionMarker>) => {
    const { ctx, fills } = makeCtx()
    drawInversions(ctx, [marker({ h: 3, ...m })], 'red')
    return fills
  }

  test('a block in mid-region keeps its whole 2px outline', () => {
    expect(outlineOf(inside)).toEqual([{ x: 39, x2: 61 }])
    expect(fillOf(inside)).toEqual([{ x: 39, x2: 61 }])
  })

  test('a sub-pixel block still inks the minimum outline width', () => {
    expect(outlineOf(tiny)).toEqual([{ x: 39, x2: 43 }])
    expect(fillOf(tiny)).toEqual([{ x: 39, x2: 43 }])
  })

  test('a block flush with the region edge does not ink past it', () => {
    expect(outlineOf(flushRight)).toEqual([{ x: 97, x2: 100 }])
    expect(fillOf(flushRight)).toEqual([{ x: 97, x2: 100 }])
    expect(outlineOf(flushLeft)).toEqual([{ x: 0, x2: 3 }])
    expect(fillOf(flushLeft)).toEqual([{ x: 0, x2: 3 }])
  })

  test('a block in the gap beside its region inks nothing', () => {
    const beside = { xLeft: 101, width: 20, visibleLeft: 100, visibleWidth: 0 }
    expect(outlineOf(beside).every(o => o.x2 <= o.x)).toBe(true)
    expect(fillOf(beside)).toEqual([])
  })
})
