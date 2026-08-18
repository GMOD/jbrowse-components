import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcsToRegionResult } from './arcRegions.ts'
import { drawArcs } from './drawCanvas.ts'
import { ARC_SHAPE_ARC, ARC_SHAPE_FLAT } from './shapes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ComputedArc } from './arcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Records WHICH KIND of mark was painted, in order. The read cloud's two marks
// are a stroked connector line and a filled endpoint square, so 'stroke' vs
// 'fill' is the whole alphabet this needs.
function recordingCtx() {
  const ops: string[] = []
  const ctx = {
    set strokeStyle(_v: string) {},
    set fillStyle(_v: string) {},
    set lineWidth(_v: number) {},
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    ellipse() {},
    stroke() {
      ops.push('stroke')
    },
    fillRect() {
      ops.push('fill')
    },
  } as unknown as Ctx2D
  return { ctx, ops }
}

function arc(bp1: number, bp2: number, shapeType: number): ComputedArc {
  return {
    p1: { refName: 'chr1', bp: bp1 },
    p2: { refName: 'chr1', bp: bp2 },
    colorType: 0,
    shapeType,
    yBp: 500,
    spanBp: 500,
    support: 1,
    key: `${bp1}-${bp2}`,
  }
}

const BLOCK: DrawBlock = { start: 0, end: 10000, screenStartPx: 0 }

function paint(arcs: ComputedArc[]) {
  const { ctx, ops } = recordingCtx()
  drawArcs(
    ctx,
    arcsToRegionResult(arcs, []),
    BLOCK,
    10000,
    800,
    {
      arcsYDomainBp: 1000,
      colors: makeTestPalette(),
      readConnectionsLineWidth: 1,
    } as RenderState,
    0,
    100,
    true,
    800,
  )
  return ops
}

// The GPU draws EVERY flat connector (`ARC_FLAT_PASS`) and only then every
// endpoint square (`ARC_MARKER_PASS`) — their order in `ARC_PASSES`, which is
// the paint order and says the squares land on top of the lines. Canvas2D — which is also what the SVG
// export paints through — drew each arc's line followed by that arc's own two
// squares.
//
// A connector is translucent (ARC_FLAT_ALPHA 0.7) and a square is not, so
// interleaved, every arc later in the feed veiled the squares of every earlier
// arc whose bar it crossed. On the GPU no square is ever veiled. Read cloud is
// the mode that emits thousands of these, and the squares are the only mark in
// it carrying a category colour — so the two backends disagreed about the one
// thing in the picture that means something, and an exported figure disagreed
// with the screen it was exported from.
describe('read-cloud connectors and their endpoint squares paint in two passes', () => {
  it('strokes every connector before filling any square', () => {
    const ops = paint([
      arc(1000, 2000, ARC_SHAPE_FLAT),
      arc(3000, 4000, ARC_SHAPE_FLAT),
      arc(5000, 6000, ARC_SHAPE_FLAT),
    ])
    expect(ops.filter(o => o === 'stroke')).toHaveLength(3)
    // Two squares per connector, and not one of them before the last stroke.
    expect(ops.filter(o => o === 'fill')).toHaveLength(6)
    expect(ops.lastIndexOf('stroke')).toBeLessThan(ops.indexOf('fill'))
  })

  it('draws no squares at all in arc mode', () => {
    // `numFlatArcs` is 0 there, so the marker pass is skipped outright rather
    // than scanning the feed to discover there is nothing in it — the same gate
    // `uploadArcs` applies before packing the GPU's marker buffer.
    const ops = paint([arc(1000, 2000, ARC_SHAPE_ARC)])
    expect(ops).toEqual(['stroke'])
  })
})
