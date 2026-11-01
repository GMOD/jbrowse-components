import { drawDensity } from './wiggleDrawFunctions.ts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// Seven heatmap rows in 100 px meet on fractional px. Canvas2D has no samples
// to blend two rows meeting there, so each seam drew lighter than either row.
function rowEdges(numRows: number, canvasHeight: number, dpr: number) {
  const rowHeight = canvasHeight / numRows
  return Array.from({ length: numRows }, (_, rowIndex) => {
    const rects: { y: number; h: number }[] = []
    const ctx = {
      fillStyle: '',
      fillRect: (_x: number, y: number, _w: number, h: number) => {
        rects.push({ y, h })
      },
    }
    drawDensity({
      ctx: ctx as unknown as MarkContext2D,
      source: {
        featurePositions: new Uint32Array([0, 100]),
        featureScores: new Float32Array([1]),
        numFeatures: 1,
        rowIndex,
      } as unknown as SourceRenderData,
      block: {
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: 100,
        reversed: false,
        displayedRegionIndex: 0,
      },
      rowHeight,
      rowTop: rowIndex * rowHeight,
      dpr,
      domainY: [0, 1],
      scaleType: 'linear' as never,
      symlogConstant: 1,
      origin: 0,
      cuts: [],
      innerColors: [],
      rampLut: null,
      rampMid: undefined,
      rgb: '#00008b',
    })
    return rects[0]!
  })
}

test.each([1, 2, 1.5])(
  'heatmap rows tile the device grid edge to edge at dpr %s',
  dpr => {
    const rows = rowEdges(7, 100, dpr)
    for (const { y, h } of rows) {
      expect(Number.isInteger(Math.round(y * dpr * 1e9) / 1e9)).toBe(true)
      expect(Number.isInteger(Math.round((y + h) * dpr * 1e9) / 1e9)).toBe(true)
    }
    for (let k = 0; k + 1 < rows.length; k++) {
      expect(rows[k]!.y + rows[k]!.h).toBeCloseTo(rows[k + 1]!.y, 9)
    }
    expect(rows[0]!.y).toBe(0)
    expect(rows.at(-1)!.y + rows.at(-1)!.h).toBeCloseTo(100, 9)
  },
)
