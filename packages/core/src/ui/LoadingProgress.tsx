import { observer } from 'mobx-react'

import { progressLabel } from '../util/progress.ts'
import LoadingEllipses from './LoadingEllipses.tsx'
import StatusProgressBar from './StatusProgressBar.tsx'

import type { TypographyProps } from '@mui/material'

/**
 * The body of every loading indicator: an indeterminate phase shows the label
 * with animated dots, a determinate one the label with its percentage over a
 * {@link StatusProgressBar}. Callers own the layout and size the bar with
 * `barClassName`.
 */
const LoadingProgress = observer(function LoadingProgress({
  message,
  fraction,
  variant,
  barClassName,
}: {
  message?: string
  fraction?: number
  variant?: TypographyProps['variant']
  barClassName?: string
}) {
  const label = message || 'Loading'
  return (
    <>
      <LoadingEllipses
        variant={variant}
        message={progressLabel(label, fraction)}
        dots={fraction === undefined}
      />
      {fraction === undefined ? null : (
        <StatusProgressBar
          className={barClassName}
          fraction={fraction}
          label={label}
        />
      )}
    </>
  )
})

export default LoadingProgress
