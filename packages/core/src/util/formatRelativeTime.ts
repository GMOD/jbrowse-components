const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
]

// Relative time like "5 minutes ago" / "yesterday" / "in 3 days". Replaces
// date-fns formatDistanceToNow({ addSuffix: true }) with the built-in Intl API
// so date-fns stays out of the bundle.
export function formatRelativeTime(date: Date | number, now = Date.now()) {
  let duration = (Number(date) - now) / 1000
  let result = rtf.format(Math.round(duration), 'years')
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) {
      result = rtf.format(Math.round(duration), unit)
      break
    }
    duration /= amount
  }
  return result
}
