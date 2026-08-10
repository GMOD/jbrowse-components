import { ARC_APEX_FRACTION } from '../../shaders/slang/arc.iface.generated.ts'
import { strokeArc } from './drawCanvas.ts'

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
  // members strokeArc touches.
  return { calls, ctx: ctx as unknown as Ctx2D }
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
describe('strokeArc mirrors the half-ellipse arc.slang measures', () => {
  const anchorY = 100
  const arcH = 40
  const apexY = anchorY - arcH

  it('spans the two endpoints and rises ARC_APEX_FRACTION of the insert Y', () => {
    const { calls, ctx } = recordingCtx()
    strokeArc(ctx, 200, 600, anchorY, apexY, false, false)
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
    strokeArc(ctx, 200, 600, anchorY, apexY, false, false)
    const bezierPeak = 3 * 0.5 * 0.5 * arcH
    expect(apexRise(calls[0]!, anchorY)).toBeCloseTo(bezierPeak, 10)
  })

  it('is endpoint-order independent', () => {
    const fwd = recordingCtx()
    const rev = recordingCtx()
    strokeArc(fwd.ctx, 200, 600, anchorY, apexY, false, false)
    strokeArc(rev.ctx, 600, 200, anchorY, apexY, false, false)
    expect(rev.calls).toEqual(fwd.calls)
  })

  it('sweeps above the baseline pointing up and below pointing down', () => {
    const up = recordingCtx()
    const down = recordingCtx()
    strokeArc(up.ctx, 200, 600, anchorY, apexY, false, false)
    strokeArc(down.ctx, 200, 600, anchorY, anchorY + arcH, true, false)
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
    strokeArc(ctx, 200, 600, anchorY, apexY, false, true)
    expect(calls[0]!.rx).toBe(200)
    expect(calls[0]!.ry).toBe(200)
  })
})
