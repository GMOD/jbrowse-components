import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { exportMargin } from '@jbrowse/core/svg/constants'

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
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={levelHeight} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {rendering.map((r, j) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-order rendering list, never reordered
          <Fragment key={j}>{r}</Fragment>
        ))}
      </g>
    </g>
  )
}
