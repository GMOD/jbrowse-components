import { traceChord } from './chordGeometry.ts'
import { svgPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'

import type { Shape } from './shapes.ts'

/** A shape as an SVG path, for the export and the highlight layer. */
export function shapePath(shape: Shape, radius: number, bezierRadius: number) {
  const sink = svgPathSink()
  if (shape.kind === 'ribbon') {
    traceRibbon(sink, shape.angles, radius, bezierRadius)
  } else {
    traceChord(sink, shape.ends, radius, bezierRadius)
  }
  return sink.toString()
}
