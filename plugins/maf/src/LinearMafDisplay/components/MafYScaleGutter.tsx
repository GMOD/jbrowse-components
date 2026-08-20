import {
  AXIS_GUTTER_WIDTH_PX,
  YScaleBar,
  leftAxisSpineX,
} from '@jbrowse/wiggle-core'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Layout for the coverage/conservation Y-axis gutter: the left-oriented
// YScaleBar's spine sits at the far edge of the gutter and its numbers grow back
// across it. Both numbers come from wiggle-core, beside the YScaleBar whose
// label geometry is what makes them the right ones — this pair and the
// alignments coverage axis's had drifted apart into two identical copies.
// Shared by the on-screen axes and SVG export so those can't drift either.
export const YSCALE_AXIS_WIDTH = AXIS_GUTTER_WIDTH_PX
const YSCALE_AXIS_X = leftAxisSpineX()

/**
 * A left-oriented Y-axis in the shared gutter, at a vertical band offset.
 * Every stacked MAF band (coverage at `top: 0`, conservation below it) draws
 * its axis through this, and `renderSvg` emits the same `<g>` transform, so the
 * on-screen and exported axes cannot drift apart.
 */
export default function MafYScaleGutter({
  top,
  height,
  ticks,
}: {
  top: number
  height: number
  ticks: YScaleTicks
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top,
        left: 0,
        pointerEvents: 'none',
        height,
        width: YSCALE_AXIS_WIDTH,
      }}
    >
      <SvgYScaleGutter y={0} ticks={ticks} />
    </svg>
  )
}

/**
 * The gutter's `<g>` on its own, for callers that already own an `<svg>` — the
 * SVG export, whose bands are positioned by the enclosing document.
 */
export function SvgYScaleGutter({
  y,
  ticks,
}: {
  y: number
  ticks: YScaleTicks
}) {
  return (
    <g transform={`translate(${YSCALE_AXIS_X}, ${y})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  )
}
