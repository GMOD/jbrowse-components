import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  button: {
    padding: 2,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  icon: {
    fontSize: 14,
  },
}))

// Self-gating: visible only when there's something to grow/restore, so callers
// can render it unconditionally inside BottomRightIndicators. The button is a
// toggle for the persistent `grow` (auto-fit) height mode: click it when content
// overflows to start growing, click it again to stop and restore the previous
// height. It mirrors the "Auto height" track-menu radio (both are `grow`).
const OverflowIndicator = observer(function OverflowIndicator({
  autoHeight,
  canExpand,
  hasOverflow,
  scrollZoom,
  onExpand,
  onRestore,
}: {
  autoHeight: boolean
  canExpand: boolean
  hasOverflow: boolean
  scrollZoom: boolean
  onExpand: () => void
  onRestore: () => void
}) {
  const { classes } = useStyles()
  // Clicking the button changes the track height, so the button (anchored to
  // the bottom of the growing/shrinking container) jumps out from under the
  // cursor without a pointer move — the browser won't fire mouseleave until the
  // next move, so MUI's default hover-driven Tooltip would stay stuck open.
  // Controlling open state lets us force it closed on click.
  const [open, setOpen] = useState(false)
  // While growing, always offer the toggle-off (restore). Otherwise offer to
  // grow only when content actually overflows (canExpand gates out a no-op).
  const growing = autoHeight
  const visible = growing || canExpand
  const label = growing ? 'Stop auto-fit height' : 'Expand to fit features'
  // Growing but content still overflows — the track is pinned at the grow
  // height cap. Surface that so the persistent scrollbar reads as intentional.
  const title = [
    label,
    growing && hasOverflow ? 'capped at max height' : undefined,
    hasOverflow && scrollZoom ? 'shift+wheel to scroll' : undefined,
  ]
    .filter(Boolean)
    .join(' — ')
  return visible ? (
    <Tooltip
      title={title}
      open={open}
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
      }}
    >
      <IconButton
        aria-label={label}
        size="small"
        className={classes.button}
        onClick={e => {
          e.stopPropagation()
          setOpen(false)
          if (growing) {
            onRestore()
          } else {
            onExpand()
          }
        }}
      >
        {growing ? (
          <UnfoldLessIcon className={classes.icon} />
        ) : (
          <UnfoldMoreIcon className={classes.icon} />
        )}
      </IconButton>
    </Tooltip>
  ) : null
})

export default OverflowIndicator
