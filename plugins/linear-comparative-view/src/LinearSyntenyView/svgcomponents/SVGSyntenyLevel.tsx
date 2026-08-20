import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'

import type { ReactNode } from 'react'

// The synteny ribbons for one level, drawn in [0,width] x [0,levelHeight]. The
// parent positions this group so its top edge meets the bottom of the upper
// view and its bottom edge meets the top of the lower view, so the ribbons span
// the gap between the two genome axes exactly.
//
// No terminal-state chrome, unlike a display that owns its own band: the
// displays here all paint this one band, so a box over a failed track's ribbons
// is a box over its siblings' too. A failed track fails the whole export
// instead, before anything is drawn, so nothing reaches this component but
// ribbons that rendered.
export default function SVGSyntenyLevel({
  clipId,
  width,
  levelHeight,
  trackLabelOffset,
  rendering,
  offscreenMates,
  legend,
}: {
  clipId: string
  width: number
  levelHeight: number
  trackLabelOffset: number
  rendering: { key: string; node: ReactNode }[]
  // over every display's ribbons, as the screen overlay is, and inside the clip
  // because a mark is laid out in the same overdrawn view coordinates they are
  offscreenMates?: ReactNode
  // the color-by key, floated over the band as it is on screen. Outside the
  // clip so a legend taller than a short level isn't cropped.
  legend?: ReactNode
}) {
  return (
    <g transform={`translate(${exportMargin + trackLabelOffset} 0)`}>
      <SvgClipRect id={clipId} width={width} height={levelHeight}>
        {rendering.map(({ key, node }) => (
          <g key={key}>{node}</g>
        ))}
        {offscreenMates}
      </SvgClipRect>
      {legend}
    </g>
  )
}
