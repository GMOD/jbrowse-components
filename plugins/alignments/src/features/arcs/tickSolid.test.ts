import { paintArcBand } from '../../LinearAlignmentsDisplay/renderers/arcMarks.ts'
import { makeTestRenderState } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcsToRegionResult } from './arcRegions.ts'
import { ARC_SHAPE_ARC } from './shapes.ts'

import type { ComputedArc, ComputedLine } from './arcTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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
  } as unknown as MarkContext2D
  return { ctx, strokes }
}

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 10_000,
  screenStartPx: 0,
  screenEndPx: 800,
  reversed: false,
}

const STATE = makeTestRenderState({
  canvasWidth: 800,
  arcsYDomainBp: 1000,
  readConnectionsLineWidth: 1,
})

const BAND = {
  ...STATE,
  arcBand: { top: 0, height: 100, down: true },
  screenWidthPx: 800,
}

function tick(bp: number, support = 1): ComputedLine {
  return {
    x: { refName: 'chr1', bp },
    support,
    partnerRefNames: ['chr9'],
    partnerLoci: [],
  }
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
  paintArcBand(ctx, arcsToRegionResult(arcs, lines), BLOCK, BAND)
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
    paintArcBand(ctx, arcsToRegionResult([], [tick(4000)]), BLOCK, BAND)
    expect(strokes).toEqual([[]])
  })
})
