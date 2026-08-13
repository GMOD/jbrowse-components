import {
  ARC_APEX_FRACTION,
  ARC_HEIGHT_MARGIN,
} from '../../shaders/slang/arc.consts.generated.ts'
import { ARC_SHAPE_ARC } from './compute.ts'
import { strokeArcMark } from './drawCanvas.ts'
import { arcMark } from './mark.ts'
import { emptyArcsUploadData } from './types.ts'

import type { ArcDome } from './mark.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface EllipseCall {
  cx: number
  cy: number
  rx: number
  ry: number
  rotation: number
  start: number
  end: number
}

function recordingCtx() {
  const calls: EllipseCall[] = []
  const ctx = {
    beginPath: () => {},
    stroke: () => {},
    ellipse: (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      rotation: number,
      start: number,
      end: number,
    ) => {
      calls.push({ cx, cy, rx, ry, rotation, start, end })
    },
  }
  // The Canvas2D path duck-types against Ctx2D; this stub implements the three
  // members strokeArcMark touches.
  return { calls, ctx: ctx as unknown as Ctx2D }
}

// The dome `arcMark` resolves for one pair — through the real thing, so what is
// pinned below is the mark the renderers stroke rather than a hand-built one
// that could describe a curve no consumer places.
//
// bp maps 1:1 to px, and the Y scale is picked so `destY` comes out at `arcH`:
// a linear domain equal to the plottable height maps 1bp of yBp to 1px of rise.
function domeMark(
  sx1: number,
  sx2: number,
  anchorY: number,
  arcH: number,
  down: boolean,
  screenWidthPx: number,
): ArcDome {
  // The anchor is the band's far edge (`arcAnchorY`), so an up band puts its top
  // at 0 and a down band puts its top AT the anchor. A linear domain equal to
  // the plottable height then maps 1bp of yBp to 1px of rise, which is what makes
  // `destY` come out at `arcH`.
  const arcsH = anchorY
  const mark = arcMark(
    {
      ...emptyArcsUploadData(),
      arcX1: new Uint32Array([sx1]),
      arcX2: new Uint32Array([sx2]),
      arcYBp: new Uint32Array([arcH]),
      arcShapeTypes: new Uint8Array([ARC_SHAPE_ARC]),
      numArcs: 1,
    },
    0,
    {
      bpToScreenX: (bp: number) => bp,
      arcsYDomainBp: arcsH - ARC_HEIGHT_MARGIN,
      arcsYLog: false,
      arcsTop: down ? anchorY : 0,
      arcsH,
      pairedArcsDown: down,
      screenWidthPx,
    },
  )
  if (mark.kind !== 'dome') {
    throw new Error('expected a dome')
  }
  return mark
}

// Highest point of the drawn half-ellipse, relative to the baseline. Positive
// is "away from the baseline", whichever side the band is on.
function apexRise(call: EllipseCall, anchorY: number) {
  return Math.abs(call.cy - anchorY) + call.ry
}

// The GPU pass (arc.slang) and this Canvas2D/SVG mirror draw the same curve
// from the same numbers. arc.slang measures its distance analytically against
// an axis-aligned half-ellipse, so if the mirror ever goes back to stroking a
// bezier — or multiplies ARC_APEX_FRACTION into the wrong quantity — the two
// renderers disagree on arc height with nothing else failing.
// Every case here spans 400px, so the block width decides the near/far branch:
// wider than the span keeps the insert-size dome, narrower degenerates it to a
// circle. Neither `strokeArcMark` nor anything downstream asks which: `arcMark`
// resolved it into the radii (see arcRadiiParity.test.ts), and this pins that
// the stroke honours them.
const NEAR_SCREEN_W = 1000
const FAR_SCREEN_W = 100

describe('strokeArcMark mirrors the half-ellipse arc.slang measures', () => {
  const anchorY = 100
  // The drawn-side-positive height `arcMark` resolves. It is NOT where the ink
  // peaks: that is ARC_APEX_FRACTION of it, which is the first assertion below.
  const arcH = 40

  it('spans the two endpoints and rises ARC_APEX_FRACTION of the insert Y', () => {
    const { calls, ctx } = recordingCtx()
    strokeArcMark(ctx, domeMark(200, 600, anchorY, arcH, false, NEAR_SCREEN_W))
    expect(calls).toHaveLength(1)
    expect(calls[0]!.cx).toBe(400)
    expect(calls[0]!.cy).toBe(anchorY)
    expect(calls[0]!.rx).toBe(200)
    expect(calls[0]!.ry).toBe(ARC_APEX_FRACTION * arcH)
    expect(calls[0]!.rotation).toBe(0)
  })

  // The shape swap it replaced was a cubic bezier with both control points at
  // the apex, whose peak is 3·(1/2)·(1/2) = 0.75 of the way up. Carrying that
  // number keeps every arc at the height it had before, so the change is a
  // change of shoulder shape only — pinned here because a drifting apex would
  // also drift the arcs' correspondence with the insert-size scalebar.
  it('peaks exactly where the cubic bezier it replaced peaked', () => {
    const { calls, ctx } = recordingCtx()
    strokeArcMark(ctx, domeMark(200, 600, anchorY, arcH, false, NEAR_SCREEN_W))
    const bezierPeak = 3 * 0.5 * 0.5 * arcH
    expect(apexRise(calls[0]!, anchorY)).toBeCloseTo(bezierPeak, 10)
  })

  it('is endpoint-order independent', () => {
    const fwd = recordingCtx()
    const rev = recordingCtx()
    strokeArcMark(
      fwd.ctx,
      domeMark(200, 600, anchorY, arcH, false, NEAR_SCREEN_W),
    )
    strokeArcMark(
      rev.ctx,
      domeMark(600, 200, anchorY, arcH, false, NEAR_SCREEN_W),
    )
    expect(rev.calls).toEqual(fwd.calls)
  })

  it('sweeps above the baseline pointing up and below pointing down', () => {
    const up = recordingCtx()
    const down = recordingCtx()
    strokeArcMark(
      up.ctx,
      domeMark(200, 600, anchorY, arcH, false, NEAR_SCREEN_W),
    )
    strokeArcMark(
      down.ctx,
      domeMark(200, 600, anchorY, arcH, true, NEAR_SCREEN_W),
    )
    // Canvas angles run clockwise on a y-down axis: [PI, 2PI] passes through
    // 3PI/2, which is above the centre; [0, PI] passes through PI/2, below.
    expect([up.calls[0]!.start, up.calls[0]!.end]).toEqual([
      Math.PI,
      2 * Math.PI,
    ])
    expect([down.calls[0]!.start, down.calls[0]!.end]).toEqual([0, Math.PI])
  })

  // A far pair's ellipse is a true circle on the pair's own half-width, so the
  // band clips the apex away and only the near-vertical legs remain. Both radii
  // must move together — an ry left on the insert-size Y would draw a flat dome
  // instead of legs.
  it('degenerates to a circle on the real half-width when far', () => {
    const { calls, ctx } = recordingCtx()
    strokeArcMark(ctx, domeMark(200, 600, anchorY, arcH, false, FAR_SCREEN_W))
    expect(calls[0]!.rx).toBe(200)
    expect(calls[0]!.ry).toBe(200)
  })
})
