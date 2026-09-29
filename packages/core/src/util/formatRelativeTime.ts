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
//
// The unit is chosen from the ROUNDED count, since that is the number printed:
// testing the raw duration let 59.6 seconds pass as under a minute and then
// print as "60 seconds ago", and likewise "60 minutes ago", "24 hours ago" and
// "12 months ago" at each step up, where the next unit says "1 minute ago",
// "1 hour ago", "yesterday" and "last year".
export function formatRelativeTime(date: Date | number, now = Date.now()) {
  let duration = (Number(date) - now) / 1000
  let result = rtf.format(Math.round(duration), 'years')
  for (const { amount, unit } of DIVISIONS) {
    const rounded = Math.round(duration)
    if (Math.abs(rounded) < amount) {
      result = rtf.format(rounded, unit)
      break
    }
    duration /= amount
  }
  return result
}
