import { makeStyles } from '@jbrowse/core/util/tss-react'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { OVERFLOW_INDICATOR_Z_INDEX } from './sharedRendererConstants.ts'

const SCROLLBAR_WIDTH = 14

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'absolute',
    bottom: 2,
    zIndex: OVERFLOW_INDICATOR_Z_INDEX,
    pointerEvents: 'auto',
  },
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

const OverflowIndicator = observer(function OverflowIndicator({
  expanded,
  hasOverflow,
  scrollZoom,
  onExpand,
  onRestore,
}: {
  expanded: boolean
  hasOverflow: boolean
  scrollZoom: boolean
  onExpand: () => void
  onRestore: () => void
}) {
  const { classes } = useStyles()
  const label = expanded ? 'Restore previous height' : 'Expand to fit features'
  const title =
    hasOverflow && scrollZoom ? `${label} — shift+wheel to scroll` : label
  return (
    <div
      className={classes.root}
      style={{ right: hasOverflow ? SCROLLBAR_WIDTH + 2 : 2 }}
    >
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
    </div>
  )
})

export default OverflowIndicator
