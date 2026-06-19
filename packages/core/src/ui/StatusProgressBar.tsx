import LinearProgress from '@mui/material/LinearProgress'

import { statusFraction } from '../util/progress.ts'

import type { RpcStatus } from '../util/progress.ts'

/**
 * A MUI LinearProgress driven by an {@link RpcStatus}: determinate (filling to
 * the status fraction) when the status carries one, indeterminate otherwise.
 * The single place that maps a status to determinate-vs-indeterminate, shared
 * by the loading/clustering/diagonalize dialogs.
 */
export default function StatusProgressBar({
  status,
  className,
  style,
}: {
  status?: RpcStatus
  className?: string
  style?: React.CSSProperties
}) {
  const fraction = statusFraction(status)
  return (
    <LinearProgress
      className={className}
      style={style}
      variant={fraction === undefined ? 'indeterminate' : 'determinate'}
      value={fraction === undefined ? undefined : Math.min(100, fraction * 100)}
    />
  )
}
