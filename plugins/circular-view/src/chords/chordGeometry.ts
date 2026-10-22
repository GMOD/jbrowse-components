import { polarToCartesian } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import {
  chordTurn,
  ribbonReturnTurn,
} from './shaders/chordStage.js.generated.ts'

import type { ChordEnds, RibbonAngles } from './chordStage.ts'
import type { PathSink } from './pathSink.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * A curve's Bezier control point for a signed `turn` from `startRadians`, on
 * the bisector of the arc it turns through. Its depth scales with
 * `sin(turn/2)`, the ends' distance over the diameter: an antipodal pair bows
 * the full `bezierRadius`, and a local event stays at the rim rather than
 * drawing a spoke to the centre.
 */
function turnControlPoint(
  startRadians: number,
  turn: number,
  radius: number,
  bezierRadius: number,
) {
  return polarToCartesian(
    radius - (radius - bezierRadius) * Math.sin(Math.abs(turn) / 2),
    startRadians + turn / 2,
  )
}

/**
 * A chord's Bezier control point. The turn is the short way round, so two
 * ends either side of the circle's first angle are as close as they look.
 */
export function chordControlPoint({
  startRadians,
  endRadians,
  radius,
  bezierRadius,
}: {
  startRadians: number
  endRadians: number
  radius: number
  bezierRadius: number
}) {
  return turnControlPoint(
    startRadians,
    chordTurn(startRadians, endRadians),
    radius,
    bezierRadius,
  )
}

/**
 * The control points of a ribbon's two curves: out from `a2` to `m1` the
 * short way, and home from `m2` to `a1` the way nearest the reverse of that,
 * so the two bow to one side of the centre.
 */
export function ribbonControlPoints(
  { a1, a2, m1, m2 }: RibbonAngles,
  radius: number,
  bezierRadius: number,
) {
  const outTurn = chordTurn(a2, m1)
  return {
    out: turnControlPoint(a2, outTurn, radius, bezierRadius),
    back: turnControlPoint(
      m2,
      ribbonReturnTurn(outTurn, m2, a1),
      radius,
      bezierRadius,
    ),
  }
}

/**
 * The slice+position a chord's far end lands on: the record's mate where it
 * names one, else the feature's own end — which for anything but a breakend is
 * where the chord degenerates to a point.
 */
export function getEndpoint<S>(
  feature: Feature,
  sliceForRef: (refName: string) => S | undefined,
  startBlock: S,
) {
  const mate = svMateLocus(feature)
  return mate
    ? {
        endBlock: sliceForRef(mate.refName),
        endRefName: mate.refName,
        endPosition: mate.pos,
      }
    : {
        endBlock: startBlock,
        endRefName: feature.get('refName'),
        endPosition: feature.get('end'),
      }
}

/** A chord's outline: from one end, bowing through the control point, to the other. */
export function traceChord(
  sink: PathSink,
  { startRadians, endRadians }: ChordEnds,
  radius: number,
  bezierRadius: number,
) {
  const [cx, cy] = chordControlPoint({
    startRadians,
    endRadians,
    radius,
    bezierRadius,
  })
  sink.moveTo(radius, startRadians)
  sink.quadTo(cx, cy, radius, endRadians)
}
