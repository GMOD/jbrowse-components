import { Fragment } from 'react'

import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
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
}: {
  clipId: string
  width: number
  levelHeight: number
  trackLabelOffset: number
  rendering: ReactNode[]
}) {
  return (
    <g transform={`translate(${exportMargin + trackLabelOffset} 0)`}>
      <SvgClipRect id={clipId} width={width} height={levelHeight}>
        {rendering.map((r, j) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-order rendering list, never reordered
          <Fragment key={j}>{r}</Fragment>
        ))}
      </SvgClipRect>
    </g>
  )
}
