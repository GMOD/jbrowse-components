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
  hasOverflow,
  scrollZoom,
  onExpand,
  onRestore,
}: {
  autoHeight: boolean
  expanded: boolean
  hasOverflow: boolean
  scrollZoom: boolean
  onExpand: () => void
  onRestore: () => void
}) {
  const { classes } = useStyles()
  const visible = !autoHeight && (hasOverflow || expanded)
  const label = expanded ? 'Restore previous height' : 'Expand to fit features'
  const title =
    hasOverflow && scrollZoom ? `${label} — shift+wheel to scroll` : label
  return visible ? (
    <Tooltip title={title}>
      <IconButton
        aria-label={label}
        size="small"
        className={classes.button}
        onClick={e => {
          e.stopPropagation()
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
