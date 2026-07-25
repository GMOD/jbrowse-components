import { SvgChrome, SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'

import type { ReactNode } from 'react'

// The synteny ribbons for one level, drawn in [0,width] x [0,levelHeight]. The
// parent positions this group so its top edge meets the bottom of the upper
// view and its bottom edge meets the top of the lower view, so the ribbons span
// the gap between the two genome axes exactly.
export default function SVGSyntenyLevel({
  clipId,
  width,
  levelHeight,
  trackLabelOffset,
  rendering,
  error,
  legend,
}: {
  clipId: string
  width: number
  levelHeight: number
  trackLabelOffset: number
  rendering: { key: string; node: ReactNode }[]
  // Combined across the level's displays, since they all paint the same
  // full-height band — one error box, as LevelSyntenyCanvas shows one banner.
  error?: unknown
  // the color-by key, floated over the band as it is on screen. Outside the
  // clip so a legend taller than a short level isn't cropped.
  legend?: ReactNode
}) {
  return (
    <g transform={`translate(${exportMargin + trackLabelOffset} 0)`}>
      <SvgClipRect id={clipId} width={width} height={levelHeight}>
        <SvgChrome error={error} width={width} height={levelHeight}>
          {rendering.map(({ key, node }) => (
            <g key={key}>{node}</g>
          ))}
        </SvgChrome>
      </SvgClipRect>
      {legend}
    </g>
  )
}
