import { formatDistanceToNow } from 'date-fns'

/**
 * Shared "last modified" formatting for the recent-sessions card and list
 * views. The label reads as relative time ("5 minutes ago", "3 days ago"); the
 * tooltip carries the precise absolute timestamp for when exact detail matters.
 */
export function formatLastModified(updated: number | undefined, now: number) {
  if (updated === undefined) {
    return { label: 'Unknown', tooltip: undefined }
  }
  const date = new Date(updated)
  return {
    label: formatDistanceToNow(date, { addSuffix: true }),
    tooltip: date.toLocaleString('en-US'),
  }
}
