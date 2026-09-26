import { chordControlPoint } from './chordGeometry.ts'

import type { RibbonAngles } from './chordStage.ts'
import type { PathSink } from './pathSink.ts'

function curveTo(
  sink: PathSink,
  from: number,
  to: number,
  radius: number,
  bezierRadius: number,
) {
  const [cx, cy] = chordControlPoint({
    startRadians: from,
    endRadians: to,
    radius,
    bezierRadius,
  })
  sink.quadTo(cx, cy, radius, to)
}

/**
 * One alignment as a closed ribbon: its span on the anchor's arc, a curve to
 * the mate, the mate's span, and a curve home. The curves bow toward the center
 * by the same rule the variant chords use, so a figure carrying both draws them
 * as one family.
 */
export function traceRibbon(
  sink: PathSink,
  { a1, a2, m1, m2 }: RibbonAngles,
  radius: number,
  bezierRadius: number,
) {
  sink.moveTo(radius, a1)
  sink.arcTo(a1, a2, radius)
  curveTo(sink, a2, m1, radius, bezierRadius)
  sink.arcTo(m1, m2, radius)
  curveTo(sink, m2, a1, radius, bezierRadius)
  sink.close()
}
