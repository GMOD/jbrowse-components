import { formatRelativeTime } from '@jbrowse/core/util'

/**
 * Shared "last modified" formatting for the recent-sessions card and list
 * views. The label reads as relative time ("5 minutes ago", "3 days ago"); the
 * tooltip carries the precise absolute timestamp for when exact detail matters.
 *
 * `formatRelativeTime` is the same phrasing jbrowse-web's session manager uses
 * for "last used", which is the point of taking it from core rather than
 * formatting here.
 */
export function formatLastModified(
  updated: number | undefined,
  now = Date.now(),
) {
  if (updated === undefined) {
    return { label: 'Unknown', tooltip: undefined }
  }
  const date = new Date(updated)
  return {
    label: formatRelativeTime(date, now),
    tooltip: date.toLocaleString('en-US'),
  }
}
