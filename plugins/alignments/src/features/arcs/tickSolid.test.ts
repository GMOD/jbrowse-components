import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcsToRegionResult } from './arcRegions.ts'
import { drawArcs } from './drawCanvas.ts'
import { ARC_SHAPE_ARC } from './shapes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ComputedArc, ComputedLine } from './arcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Records the dash pattern in force at each stroke, which is the whole question
// here: `setLineDash` is state on the context rather than an argument to the
// stroke, so a tick painted after the arc loop's split-connector dash would
// inherit it unless this pass sets its own.
function recordingCtx() {
  const strokes: number[][] = []
  let dash: number[] = []
  const ctx = {
    set strokeStyle(_v: string) {},
    set fillStyle(_v: string) {},
    set lineWidth(_v: number) {},
    setLineDash(segments: number[]) {
      dash = segments
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    ellipse() {},
    stroke() {
      strokes.push([...dash])
    },
    fillRect() {},
  } as unknown as Ctx2D
  return { ctx, strokes }
}

const BLOCK: DrawBlock = { start: 0, end: 10_000, screenStartPx: 0 }

function tick(bp: number, support = 1): ComputedLine {
  return { x: { refName: 'chr1', bp }, support, partnerRefNames: ['chr9'] }
}

function arc(bp1: number, bp2: number): ComputedArc {
  return {
    p1: { refName: 'chr1', bp: bp1 },
    p2: { refName: 'chr1', bp: bp2 },
    colorType: 0,
    shapeType: ARC_SHAPE_ARC,
    yBp: 500,
    spanBp: 500,
    support: 1,
    key: `${bp1}-${bp2}`,
  }
}

function paint(arcs: ComputedArc[], lines: ComputedLine[]) {
  const { ctx, strokes } = recordingCtx()
  drawArcs(
    ctx,
    arcsToRegionResult(arcs, lines),
    BLOCK,
    10_000,
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
  return strokes
}

// The band paints ticks first and arcs after, and the arc loop sets a dash per
// arc for split connectors. Every mark in this band is solid except that one,
// so the tick pass has to state it rather than inherit whatever the context
// was last left with.
describe('interchromosomal ticks are solid', () => {
  it('strokes the tick with no dash', () => {
    expect(paint([], [tick(4000)])).toEqual([[]])
  })

  it('leaves the arcs solid, in the same draw', () => {
    expect(paint([arc(1000, 9000)], [tick(4000)])).toEqual([[], []])
  })

  it('strokes solid even when the context arrives with a dash set', () => {
    const { ctx, strokes } = recordingCtx()
    ctx.setLineDash([3, 3])
    drawArcs(
      ctx,
      arcsToRegionResult([], [tick(4000)]),
      BLOCK,
      10_000,
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
    expect(strokes).toEqual([[]])
  })
})
