import YScaleBar from './YScaleBar.tsx'
import { ONSCREEN_AXIS_LEFT_PX } from './constants.ts'

import type { YScaleTicks } from './yScaleTicks.ts'

// Y-axis tick labels positioned absolutely, indented from the track's left edge
// so a right-oriented axis reads inside the plot. The SVG export instead anchors
// a left-oriented axis at the content edge, putting the labels in the export
// margin — see WiggleFamilySvgFrame.
//
// `width` is the track's, not a fixed strip: an <svg> clips to its own box, and
// the hardcoded 70px this used to carry silently truncated any label past ~11
// characters. Not hypothetical on a log axis — a domain under 1 nices to
// negative powers of two, so `0.0009765625` is an ordinary tick on a
// mappability track and the labels grow exactly where the numbers get small.
// The track's own right edge is the real boundary.
export default function YScaleBarOverlay({
  ticks,
  height,
  width,
}: {
  ticks: YScaleTicks
  height: number
  width: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: ONSCREEN_AXIS_LEFT_PX,
        pointerEvents: 'none',
        height,
        width: Math.max(0, width - ONSCREEN_AXIS_LEFT_PX),
      }}
    >
      <YScaleBar ticks={ticks} orientation="right" />
    </svg>
  )
}
