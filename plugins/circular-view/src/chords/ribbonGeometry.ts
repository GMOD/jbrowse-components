import { ribbonControlPoints } from './chordGeometry.ts'

import type { RibbonAngles } from './chordStage.ts'
import type { PathSink } from './pathSink.ts'

/**
 * One alignment as a closed ribbon: its span on the anchor's arc, a curve to
 * the mate, the mate's span, and a curve home. The curves bow toward the center
 * by the same rule the variant chords use, so a figure carrying both draws them
 * as one family.
 */
export function traceRibbon(
  sink: PathSink,
  angles: RibbonAngles,
  radius: number,
  bezierRadius: number,
) {
  const { a1, a2, m1, m2 } = angles
  const { out, back } = ribbonControlPoints(angles, radius, bezierRadius)
  sink.moveTo(radius, a1)
  sink.arcTo(a1, a2, radius)
  sink.quadTo(out[0], out[1], radius, m1)
  sink.arcTo(m1, m2, radius)
  sink.quadTo(back[0], back[1], radius, a1)
  sink.close()
}
