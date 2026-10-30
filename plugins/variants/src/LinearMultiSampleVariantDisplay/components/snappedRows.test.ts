import { backingScale } from '@jbrowse/render-core/canvas2dUtils'

import { matrixCellMark } from '../matrix/matrixCellMark.ts'
import { matrixCellAt } from '../matrix/matrixHitTest.ts'
import { cellMark } from './cellMark.ts'
import {
  drawnCellHeightPx,
  snappedRowBottomPx,
  snappedRowTopPx,
} from './shaders/variant.js.generated.ts'
import { computeVariantHitQuery } from './variantHitTest.ts'
import { SHAPE_RECT } from './variantShape.ts'

import type { InkRect } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const ROW_HEIGHTS = [7.3, 2.6, 0.32, 230 / 2504]
const SCROLLS = [0, 0.37, 123.45]
const DPRS = [1, 1.25, 1.5, 2, 1202 / 801]

function onGrid(px: number, dpr: number) {
  return Math.abs(px * dpr - Math.round(px * dpr)) < 1e-6
}

describe.each(DPRS)('at a backing scale of %s', dpr => {
  test.each(ROW_HEIGHTS.flatMap(rh => SCROLLS.map(st => [rh, st])))(
    'rows %s px tall scrolled %s tile on whole device pixels',
    (rowHeight, scrollTop) => {
      for (let row = 0; row < 400; row++) {
        const top = snappedRowTopPx(row, rowHeight, scrollTop, dpr)
        expect(onGrid(top, dpr)).toBe(true)
        const bottom = snappedRowBottomPx(
          row,
          rowHeight,
          rowHeight,
          scrollTop,
          dpr,
        )
        if (rowHeight * dpr >= 1) {
          expect(bottom).toBe(
            snappedRowTopPx(row + 1, rowHeight, scrollTop, dpr),
          )
        }
        const floored = snappedRowBottomPx(
          row,
          rowHeight,
          drawnCellHeightPx(rowHeight),
          scrollTop,
          dpr,
        )
        expect(onGrid(floored, dpr)).toBe(true)
        expect((floored - top) * dpr).toBeGreaterThanOrEqual(1 - 1e-9)
      }
    },
  )
})

const CANVAS_HEIGHT = 301

function withDpr<T>(dpr: number, run: () => T) {
  const before = window.devicePixelRatio
  window.devicePixelRatio = dpr
  try {
    return run()
  } finally {
    window.devicePixelRatio = before
  }
}

// What the painter drew under each device pixel: the first and last row whose
// ink covers the pixel's centre.
function coveringRows(bands: (InkRect | undefined)[], y: number) {
  let lowest = -1
  let nearest = -1
  bands.forEach((b, row) => {
    if (b && b.top <= y && y < b.top + b.height) {
      lowest = lowest < 0 ? row : lowest
      nearest = row
    }
  })
  return { lowest, nearest }
}

function rowsOf(rowHeight: number, scrollTop: number) {
  return Math.ceil((CANVAS_HEIGHT + scrollTop + 3) / rowHeight)
}

describe.each([1, 1.5, 2])('the hit test at dpr %s', dpr => {
  const cases = ROW_HEIGHTS.flatMap(rh => SCROLLS.map(st => [rh, st]))

  test.each(cases)(
    'names the rows the cell painter drew, %s px rows scrolled %s',
    (rowHeight, scrollTop) => {
      const n = rowsOf(rowHeight, scrollTop)
      const block: RenderBlock = {
        displayedRegionIndex: 0,
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: 100,
        reversed: false,
      }
      const channels = {
        startEnd: new Uint32Array(n * 2).map((_, i) => (i % 2 ? 60 : 40)),
        row: Uint32Array.from({ length: n }, (_, i) => i),
        shapeType: new Uint8Array(n).fill(SHAPE_RECT),
        color: new Uint32Array(n),
        count: n,
      }
      const frame = { canvasWidth: 100, canvasHeight: CANVAS_HEIGHT }
      withDpr(dpr, () => {
        const scale = backingScale(CANVAS_HEIGHT)
        const bands = Array.from({ length: n }, (_, i) =>
          cellMark.ink!(channels, block, frame, { rowHeight, scrollTop }, i),
        )
        for (let px = 0; px < CANVAS_HEIGHT * scale; px++) {
          const drawn = coveringRows(bands, (px + 0.5) / scale)
          const q = computeVariantHitQuery(
            block,
            50,
            (px + 0.25) / scale,
            scrollTop,
            rowHeight,
            scale,
          )
          expect([px, q.rowLowest, q.rowNearest]).toEqual([
            px,
            drawn.lowest,
            drawn.nearest,
          ])
        }
      })
    },
  )

  test.each(cases)(
    'names the rows the matrix painter drew, %s px rows scrolled %s',
    (rowHeight, scrollTop) => {
      const n = rowsOf(rowHeight, scrollTop)
      const channels = {
        featureIndex: new Uint32Array(n),
        row: Uint32Array.from({ length: n }, (_, i) => i),
        color: new Uint32Array(n),
        count: n,
      }
      const frame = { canvasWidth: 100, canvasHeight: CANVAS_HEIGHT }
      const params = { numFeatures: 1, rowHeight, scrollTop }
      const block = {} as RenderBlock
      withDpr(dpr, () => {
        const scale = backingScale(CANVAS_HEIGHT)
        const bands = Array.from({ length: n }, (_, i) =>
          matrixCellMark.ink!(channels, block, frame, params, i),
        )
        for (let px = 0; px < CANVAS_HEIGHT * scale; px++) {
          const drawn = coveringRows(bands, (px + 0.5) / scale)
          const q = matrixCellAt(
            {
              columnWidth: 100,
              effectiveRowHeight: rowHeight,
              scrollTop,
              dpr: scale,
            },
            50,
            (px + 0.25) / scale,
          )
          expect([px, q.lowest, q.nearest]).toEqual([
            px,
            drawn.lowest,
            drawn.nearest,
          ])
        }
      })
    },
  )
})
