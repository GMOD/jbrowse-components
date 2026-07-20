import { progressLabel } from '../util/progress.ts'
import LoadingEllipses from './LoadingEllipses.tsx'
import StatusProgressBar from './StatusProgressBar.tsx'

import type { TypographyProps } from '@mui/material'

/**
 * The shared "labelled ellipses + optional determinate bar" body used by the
 * loading/refetch indicators. Renders a {@link LoadingEllipses} label — with the
 * rounded percent appended via {@link progressLabel} when `fraction` is
 * determinate — and a determinate {@link StatusProgressBar} only when a
 * `fraction` is present (an indeterminate phase shows just the animated label,
 * no bar). Callers own the surrounding layout and supply `barClassName` for the
 * bar width.
 */
export default function LoadingProgress({
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
  return (
    <>
      <LoadingEllipses
        variant={variant}
        message={progressLabel(message || 'Loading', fraction)}
      />
      {fraction === undefined ? null : (
        <StatusProgressBar className={barClassName} fraction={fraction} />
      )}
    </>
  )
}
