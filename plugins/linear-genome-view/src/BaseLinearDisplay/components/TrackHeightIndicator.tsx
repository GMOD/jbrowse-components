import { CascadingMenuButton } from '@jbrowse/core/ui'
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
export default function TrackHeightIndicator({
  heightMode,
  hasOverflow,
  scrollZoom,
  noun,
  onSetHeightMode,
}: {
  heightMode: HeightMode
  hasOverflow: boolean
  scrollZoom: boolean
  noun: string
  onSetHeightMode: (mode: HeightMode) => void
}) {
  const { classes } = useStyles()
  const tooltip = [
    'Track sizing',
    hasOverflow && scrollZoom ? 'shift+wheel to scroll' : undefined,
  ]
    .filter(Boolean)
    .join(' — ')
  return (
    <CascadingMenuButton
      size="small"
      className={classes.button}
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
