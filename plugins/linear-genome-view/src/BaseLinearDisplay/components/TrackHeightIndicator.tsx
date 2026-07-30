import { CascadingMenuButton } from '@jbrowse/core/ui'
import { pluralize } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import HeightIcon from '@mui/icons-material/Height'

import { getHeightModeOptions } from '../models/heightMode.ts'

import type { HeightMode } from '../models/heightMode.ts'

// Subtle bordered look for the ambient bottom-right track-state buttons, so the
// height switcher reads as one quiet system rather than a bright control.
const useStyles = makeStyles()(theme => ({
  button: {
    padding: 2,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    '& svg': {
      fontSize: 14,
    },
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  // Dropping features outright is data loss, so the button has to read as
  // "something is wrong here" without a hover — a tooltip nobody opens is not a
  // disclosure. Still the same quiet button, just warning-toned.
  truncated: {
    borderColor: theme.palette.warning.main,
    color: theme.palette.warning.main,
  },
}))

// Persistent bottom-right track-sizing switcher (fixed / autogrow / fit),
// shared by every display that exposes the `heightMode` slot so the fixed/grow/
// fit choice is discoverable on-screen, not only buried in the track menu. Opens
// the same options as the track menu's "Track sizing" radio group (labels from
// the shared getHeightModeOptions, so the two can't drift); `noun` is the
// singular of what the track holds ('feature', 'read'). The tooltip surfaces the
// scroll hint while
// content overflows under scrollZoom — where a plain wheel zooms the view, so
// scrolling the overflow needs shift+wheel.
//
// `truncatedCount` is items the layout could not place at all (past its row
// limit) — not scrolled out of view, absent. It rides here because the track's
// height and density are what cause it and what can relieve it, and because a
// silently incomplete track is worse than an ugly one.
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
  const { classes, cx } = useStyles()
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
    <CascadingMenuButton
      size="small"
      className={cx(classes.button, truncatedCount > 0 && classes.truncated)}
      stopPropagation
      tooltip={tooltip}
      menuItems={getHeightModeOptions(noun).map(option => ({
        label: option.label,
        type: 'radio' as const,
        checked: heightMode === option.value,
        onClick: () => {
          onSetHeightMode(option.value)
        },
      }))}
    >
      <HeightIcon />
    </CascadingMenuButton>
  )
}
