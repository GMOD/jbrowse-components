import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import {
  ARC_LINE_DASH_PX,
  ARC_LINE_GAP_PX,
} from '../../shaders/slang/arcLine.consts.generated.ts'
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
// stroke, so a test that only checked it was CALLED would pass on a call made
// after the tick it was meant to dash.
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

// A tick and a cross-region arc's FOOT land on the same x whenever a breakpoint
// reaches one acceptor the view shows and another it does not — the ordinary
// shape of a translocation seen through two windows. Both are
// ARC_COLOR_INTERCHROM and both run the band's height there, so drawn solid the
// pair reads as a single mark and the tick's claim ("there is more, off
// screen") is invisible. Support cannot separate them either: `arcLineWidth`
// caps at 4x around 44 reads, so a 206-read tick and a 37-read one are the same
// 8 device px.
//
// The pattern is arcLine.slang's, imported rather than repeated, so this fails
// if the CPU twin and the shader ever disagree about it (adr-051).
describe('interchromosomal ticks are dashed', () => {
  it('strokes the tick with the shader pattern', () => {
    expect(paint([], [tick(4000)])).toEqual([
      [ARC_LINE_DASH_PX, ARC_LINE_GAP_PX],
    ])
  })

  it('leaves the arcs solid, in the same draw', () => {
    // The tick pass runs first (`ARC_PASSES`, ticks under arcs), so a dash left
    // set would land on every curve behind it. Order matters here: the tick's
    // stroke is the first entry and the arc's the second.
    expect(paint([arc(1000, 9000)], [tick(4000)])).toEqual([
      [ARC_LINE_DASH_PX, ARC_LINE_GAP_PX],
      [],
    ])
  })

  it('does not leave the dash set when there are no arcs to reset it', () => {
    // The arc loop sets a dash per arc, so with arcs present the reset is
    // incidental. With none, nothing downstream would clear it — which is why
    // the tick loop resets for itself rather than relying on the next painter.
    const { ctx, strokes } = recordingCtx()
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
    expect(strokes).toHaveLength(1)
    // Stroke a probe line the way a later painter would, with no dash of its own.
    ctx.beginPath()
    ctx.stroke()
    expect(strokes[1]).toEqual([])
  })
})
