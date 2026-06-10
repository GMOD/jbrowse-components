import { formatDistanceToNow } from 'date-fns'

const oneDayMs = 24 * 60 * 60 * 1000

/**
 * Shared "last modified" formatting for the recent-sessions card and list
 * views. Sessions touched within the last day read as relative time ("5
 * minutes ago"); older ones show an absolute locale string. The tooltip always
 * carries the absolute timestamp.
 */
export function formatLastModified(updated: number | undefined, now: number) {
  if (updated === undefined) {
    return { label: 'Unknown', tooltip: undefined }
  }
  const date = new Date(updated)
  const absolute = date.toLocaleString('en-US')
  return {
    label:
      now - updated < oneDayMs
        ? formatDistanceToNow(date, { addSuffix: true })
        : absolute,
    tooltip: absolute,
  }
}
