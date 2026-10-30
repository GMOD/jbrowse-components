import {
  snappedRowBottomPx,
  snappedRowTopPx,
} from '../../../packages/render-core/src/shaders/rowSnap.js.generated.ts'
import * as variant from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/shaders/variant.generated.ts'
import {
  drawnCellHeightPx,
  snappedCellLeftPx,
  snappedCellWidthPx,
} from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/shaders/variant.js.generated.ts'
import { abgr, defineFixture, paintOver, rgba } from '../fixture.ts'

import type { Budget, Shape } from '../fixture.ts'

const W = 160
const H = 40
const START = 5000
const BP_PER_PX = 2.3
const bp = (px: number) => Math.round(START + px * BP_PER_PX)
const px = (b: number) => (b - START) / BP_PER_PX

const COLORS = [
  [64, 96, 200],
  [220, 120, 40],
  [180, 180, 180],
] as const

function cells(rowHeight: number, inversions: boolean) {
  const rows = Math.floor(H / rowHeight)
  const startEnd: number[] = []
  const row: number[] = []
  const shapeType: number[] = []
  const color: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let v = 0; v < 9; v++) {
      const left = 4.4 + v * 17.3 + ((r * 3.7) % 5)
      const width = v % 3 === 0 ? 0.6 : 3.2 + (v % 4) * 2.9
      startEnd.push(bp(left), bp(left + width))
      row.push(r)
      shapeType.push(
        inversions && v % 2 === 1 ? variant.SHAPE_TRI_LEFT : variant.SHAPE_RECT,
      )
      color.push(abgr(COLORS[(r + v) % 3]!))
    }
  }
  return { startEnd, row, shapeType, color, count: row.length }
}

function referenceOf(c: ReturnType<typeof cells>, rowHeight: number) {
  const byDpr = new Map<number, ReturnType<typeof paintOver>>()
  return (x: number, y: number, dpr: number) => {
    let paint = byDpr.get(dpr)
    if (!paint) {
      const shapes: Shape[] = []
      for (let i = 0; i < c.count; i++) {
        const rx1 = px(c.startEnd[i * 2]!)
        const rx2 = px(c.startEnd[i * 2 + 1]!)
        const w = snappedCellWidthPx(rx1, rx2, dpr)
        const left = snappedCellLeftPx(rx1, rx2, w, dpr)
        const top = snappedRowTopPx(c.row[i]!, rowHeight, 0, dpr)
        const bottom = snappedRowBottomPx(
          c.row[i]!,
          rowHeight,
          drawnCellHeightPx(rowHeight),
          0,
          dpr,
        )
        const h = bottom - top
        const inversion = c.shapeType[i] !== variant.SHAPE_RECT
        shapes.push({
          color: rgba(COLORS[(c.row[i]! + Math.floor(i % 9)) % 3]!),
          inside: (sx, sy) => {
            const lx = sx - left
            const ly = sy - top
            if (lx < 0 || lx >= w || ly < 0 || ly >= h) {
              return false
            }
            return !inversion || Math.abs(ly - h / 2) <= (h / 2) * (lx / w)
          },
        })
      }
      paint = paintOver(shapes)
      byDpr.set(dpr, paint)
    }
    return paint(x, y)
  }
}

function fixture(
  name: string,
  about: string,
  rowHeight: number,
  inversions: boolean,
  budget: Budget,
) {
  const c = cells(rowHeight, inversions)
  return defineFixture({
    name,
    slang:
      'plugins/variants/src/LinearMultiSampleVariantDisplay/components/shaders/variant.slang',
    about,
    mod: variant,
    width: W,
    height: H,
    count: c.count,
    instances: c,
    uniforms: dpr => ({
      bpRangeX: [START, 0, W * BP_PER_PX] as [number, number, number],
      canvasHeight: H,
      viewportLeft: 0,
      viewportWidth: W,
      viewportDeviceLeft: 0,
      viewportDeviceWidth: W * dpr,
      scaleX: dpr,
      rowHeight,
      scrollTop: 0,
      zero: 0,
      devicePixelRatio: dpr,
    }),
    reference: referenceOf(c, rowHeight),
    budget,
  })
}

export default [
  fixture(
    'variant-cells',
    'a dense genotype matrix, rows 2.6 px tall, both axes snapped to the device grid',
    2.6,
    false,
    { max: 0.01, meanErr: 0.001 },
  ),
  fixture(
    'variant-inversions',
    'cells with the inversion glyph, whose two slants ramp, rows 7.3 px tall',
    7.3,
    true,
    { max: 0.1, meanErr: 0.01 },
  ),
]
