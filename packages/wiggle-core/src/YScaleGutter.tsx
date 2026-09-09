import { YScaleBar } from '@jbrowse/display-ui'
import { AXIS_GUTTER_WIDTH_PX, leftAxisSpineX } from '@jbrowse/display-ui'

import type { YScaleTicks } from '@jbrowse/display-ui'

/**
 * A left-oriented Y-axis in the shared gutter, at a band's top-left corner on
 * screen. Every stacked band that carries one — the alignments coverage band,
 * MAF's coverage and conservation bands — draws it through this, and its export
 * emits `SvgYScaleGutter` with the same spine placement, so the on-screen and
 * exported axes cannot drift apart.
 *
 * `left` is the gutter's own left edge; the spine is placed inside the gutter
 * from there, so a caller positioning the box does not also offset the spine.
 */
export default function YScaleGutter({
  top,
  left = 0,
  height,
  ticks,
}: {
  top: number
  left?: number
  height: number
  ticks: YScaleTicks
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top,
        left,
        pointerEvents: 'none',
        height,
        width: AXIS_GUTTER_WIDTH_PX,
      }}
    >
      <SvgYScaleGutter y={0} ticks={ticks} />
    </svg>
  )
}

/**
 * The gutter's `<g>` on its own, for a caller that already owns an `<svg>` —
 * the SVG export, whose bands are positioned by the enclosing document. `left`
 * is the gutter's left edge in that document.
 */
export function SvgYScaleGutter({
  left = 0,
  y,
  ticks,
}: {
  left?: number
  y: number
  ticks: YScaleTicks
}) {
  return (
    <g transform={`translate(${leftAxisSpineX(left)}, ${y})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  )
}
