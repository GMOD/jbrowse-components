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

// Self-gating: visible only when there's something to expand/restore, so
// callers can render it unconditionally inside BottomRightIndicators.
const OverflowIndicator = observer(function OverflowIndicator({
  autoHeight,
  expanded,
  canExpand,
  hasOverflow,
  scrollZoom,
  onExpand,
  onRestore,
}: {
  autoHeight: boolean
  expanded: boolean
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
  // Once expanded, keep offering "restore" (resize back down) rather than
  // flipping to expand again — the collapse affordance is the priority. The
  // expand action is gated on canExpand so it never offers a no-op or a shrink.
  const visible = !autoHeight && (canExpand || expanded)
  const label = expanded ? 'Restore previous height' : 'Expand to fit features'
  // Content still overflows but the track can't grow — pinned at the maxHeight
  // cap. Surface that so a persistent scrollbar after "expand to fit" reads as
  // intentional rather than a half-working button.
  const atMaxHeight = hasOverflow && !canExpand
  const title = [
    label,
    atMaxHeight ? 'maximum height reached' : undefined,
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
          if (expanded) {
            onRestore()
          } else {
            onExpand()
          }
        }}
      >
        {expanded ? (
          <UnfoldLessIcon className={classes.icon} />
        ) : (
          <UnfoldMoreIcon className={classes.icon} />
        )}
      </IconButton>
    </Tooltip>
  ) : null
})

export default OverflowIndicator
