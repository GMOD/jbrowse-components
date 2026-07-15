import LinearProgress from '@mui/material/LinearProgress'

/**
 * A MUI LinearProgress driven by a completion fraction in [0,1]: determinate
 * (filling to the fraction) when one is given, indeterminate when `undefined`.
 * The single place that maps a fraction to determinate-vs-indeterminate, shared
 * by every loading/clustering/diagonalize/refetch indicator. Callers with an
 * {@link RpcStatus} pass `statusFraction(status)`.
 */
export default function StatusProgressBar({
  fraction,
  className,
  style,
}: {
  fraction?: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <LinearProgress
      className={className}
      style={style}
      variant={fraction === undefined ? 'indeterminate' : 'determinate'}
      value={fraction === undefined ? undefined : Math.min(100, fraction * 100)}
    />
  )
}
