import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { cellMark } from './cellMark.ts'
import { GLSL_FRAGMENT } from './shaders/variant.glsl.generated.ts'
import {
  drawnCellHeightPx,
  snappedCellWidthPx,
} from './shaders/variant.js.generated.ts'
import { WGSL_SOURCE } from './shaders/variant.wgsl.generated.ts'
import { SHAPE_RECT, SHAPE_TRI_LEFT } from './variantShape.ts'

import type { CellChannels } from './cellMark.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

function stripCallsTo(expr: string, name: string) {
  let out = expr
  for (;;) {
    const at = out.indexOf(name)
    if (at < 0) {
      return out
    }
    let depth = 0
    let i = out.indexOf('(', at)
    for (; i < out.length; i++) {
      if (out[i] === '(') {
        depth++
      } else if (out[i] === ')' && --depth === 0) {
        i++
        break
      }
    }
    out = out.slice(0, at) + out.slice(i)
  }
}

function triangleAlphaStatement(src: string) {
  const stmts = src
    .split(';')
    .map(s => s.trim())
    .filter(s => s.includes('edgeCoverage') && s.includes('alpha'))
  expect(stmts).toHaveLength(1)
  return stmts[0]!
}

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 1_000_000,
  end: 4_000_000,
  screenStartPx: 0,
  screenEndPx: 1600,
  reversed: false,
}
const FRAME = { canvasWidth: 1600, canvasHeight: 300 }
const COLOR = 0xcc1133bb

const cells: CellChannels = {
  startEnd: new Uint32Array([2_000_000, 2_000_001, 2_500_000, 2_500_001]),
  row: new Uint32Array([0, 1]),
  shapeType: new Uint8Array([SHAPE_RECT, SHAPE_TRI_LEFT]),
  color: new Uint32Array([COLOR, COLOR]),
  count: 2,
}

// The two floors are the whole domain a size-keyed fade could see on this
// display: a ramp reaching past 2px dims every genome-wide inversion by a
// constant it can never climb out of.
test('the 2px floors leave a genome-wide cell 2px on both sides', () => {
  expect(snappedCellWidthPx(700.1, 700.2)).toBe(2)
  expect(snappedCellWidthPx(700.2, 700.1)).toBe(2)
  expect(drawnCellHeightPx(0.5)).toBe(2)
  expect(drawnCellHeightPx(7.5)).toBe(7.5)
})

test.each([
  ['wgsl', WGSL_SOURCE],
  ['glsl', GLSL_FRAGMENT],
])(
  '%s inks the inversion glyph with its edge coverage and nothing else',
  (_, src) => {
    const stmt = triangleAlphaStatement(src)
    expect(stripCallsTo(stmt, 'edgeCoverage').split('*')).toHaveLength(2)
    expect(src).not.toContain('smoothstep')
  },
)

test('the Canvas2D twin paints a floored inversion in the cell colour, at the cell size', () => {
  const { ctx, calls } = recordingContext()
  cellMark.paintBlock(ctx, cells, BLOCK, FRAME, {
    rowHeight: 0.5,
    scrollTop: 0,
  })
  expect(calls.map(c => c.fillStyle)).toEqual([
    abgrToCssRgba(COLOR),
    abgrToCssRgba(COLOR),
  ])
  expect(calls.map(c => [c.w, c.h])).toEqual([
    [2, 2],
    [2, 2],
  ])
})
