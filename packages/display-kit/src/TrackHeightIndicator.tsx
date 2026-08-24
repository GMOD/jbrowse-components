import { pluralize } from '@jbrowse/core/util'

import { getHeightModeOptions } from './heightMode.ts'
import TrackControl from './trackControl/TrackControl.tsx'

import type { HeightMode } from './heightMode.ts'

// Persistent bottom-right track-sizing switcher (fixed / autogrow / fit),
// shared by every display that exposes the `heightMode` slot so the fixed/grow/
// fit choice is discoverable on-screen, not only buried in the track menu. Opens
// the same options as the track menu's "Track sizing" radio group (labels from
// the shared getHeightModeOptions, so the two can't drift); `noun` is the
// singular of what the track holds ('feature', 'read'). The tooltip surfaces the
// scroll hint while content overflows under scrollZoom — where a plain wheel
// zooms the view, so scrolling the overflow needs shift+wheel.
//
// `truncatedCount` is items the layout could not place at all (past its row
// limit) — not scrolled out of view, absent. It rides here because the track's
// height and density are what cause it and what can relieve it, and because a
// silently incomplete track is worse than an ugly one. Dropping features is data
// loss, so it takes the `warning` tone rather than hiding in the tooltip.
//
// What it *looks* like is `TrackControl`'s business, not this file's — that is
// the seam an embedder swaps to get a corner with no Material UI in it.
export default function TrackHeightIndicator({
  heightMode,
  hasOverflow,
  scrollZoom,
  noun,
  truncatedCount = 0,
  onSetHeightMode,
}: {
  heightMode: HeightMode
  hasOverflow: boolean
  scrollZoom: boolean
  noun: string
  truncatedCount?: number
  onSetHeightMode: (mode: HeightMode) => void
}) {
  const tooltip = [
    'Track sizing',
    // ' — ' is already this tooltip's segment separator, so keep the segment
    // itself free of one.
    truncatedCount > 0
      ? `${truncatedCount.toLocaleString()} ${pluralize(truncatedCount, noun)} not shown (past the layout row limit; filter or zoom in)`
      : undefined,
    hasOverflow && scrollZoom ? 'shift+wheel to scroll' : undefined,
  ]
    .filter(Boolean)
    .join(' — ')
  return (
    <TrackControl
      icon="height"
      tooltip={tooltip}
      warning={truncatedCount > 0}
      options={getHeightModeOptions(noun).map(option => ({
        label: option.label,
        selected: heightMode === option.value,
        onSelect: () => {
          onSetHeightMode(option.value)
        },
      }))}
    />
  )
}
