import { alpha } from '@mui/material'

import { drawMafSummaryBars, summaryBarAlpha } from './summaryBars.ts'

import type { SummaryBar } from '../../LinearMafDisplay/components/computeVisibleSummaryBars.ts'
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

const palette = { matchColor: '#808080' } as MafColorPalette

const bar = (score: number): SummaryBar => ({
  x: 5,
  width: 20,
  rowTop: 10,
  h: 12,
  score,
})

test('summaryBarAlpha maps score 0..1 onto floor..1', () => {
  expect(summaryBarAlpha(1)).toBeCloseTo(1)
  expect(summaryBarAlpha(0)).toBeCloseTo(0.25)
  expect(summaryBarAlpha(0.6)).toBeCloseTo(0.7)
})

test('summaryBarAlpha clamps out-of-range scores', () => {
  expect(summaryBarAlpha(2)).toBeCloseTo(1)
  expect(summaryBarAlpha(-1)).toBeCloseTo(0.25)
})

test('draws a score-shaded rect per bar with alpha baked into the color', () => {
  const { ctx, calls } = makeCtx()
  drawMafSummaryBars(ctx, [bar(1), bar(0)], palette)
  expect(calls).toEqual([
    { style: alpha('#808080', 1), x: 5, y: 10, w: 20, h: 12 },
    { style: alpha('#808080', 0.25), x: 5, y: 10, w: 20, h: 12 },
  ])
  // higher score → less transparent
  expect(calls[0]!.style).not.toEqual(calls[1]!.style)
})
