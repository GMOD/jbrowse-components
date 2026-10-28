import { svMateLocus } from '@jbrowse/sv-core'

import {
  chordControlPoint,
  chordTurn,
  ribbonReturnTurn,
  turnControlPoint,
} from './shaders/chordStage.js.generated.ts'

import type { ChordEnds, RibbonAngles } from './chordStage.ts'
import type { PathSink } from './pathSink.ts'
import type { Feature } from '@jbrowse/core/util'

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
 * The locus a chord's far end lands on: the record's mate where it names one,
 * else the feature's own end, where a chord of anything but a breakend
 * degenerates to a point.
 */
export function getEndpoint(feature: Feature): {
  refName: string
  position: number
} {
  const mate = svMateLocus(feature)
  return mate
    ? { refName: mate.refName, position: mate.pos }
    : { refName: feature.get('refName'), position: feature.get('end') }
}

/** A chord's outline: from one end, bowing through the control point, to the other. */
export function traceChord(
  sink: PathSink,
  { startRadians, endRadians }: ChordEnds,
  radius: number,
  bezierRadius: number,
) {
  const [cx, cy] = chordControlPoint(
    startRadians,
    endRadians,
    radius,
    bezierRadius,
  )
  sink.moveTo(radius, startRadians)
  sink.quadTo(cx, cy, radius, endRadians)
}
