import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 4px',
    fontSize: 11,
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: 0.9,
  },
  closeButton: {
    padding: 1,
  },
  closeIcon: {
    fontSize: 14,
  },
}))

// Self-gating: visible only when collapse is active and not dismissed, so
// callers can render it unconditionally inside BottomRightIndicators.
const IsoformCollapseNotice = observer(function IsoformCollapseNotice({
  visible,
  onDismiss,
}: {
  visible: boolean
  onDismiss: () => void
}) {
  const { classes } = useStyles()
  return visible ? (
    <div className={classes.root}>
      <span>Isoforms collapsed to longest coding transcript</span>
      <IconButton
        aria-label="Dismiss"
        size="small"
        className={classes.closeButton}
        onClick={() => {
          onDismiss()
        }}
      >
        <CloseIcon className={classes.closeIcon} />
      </IconButton>
    </div>
  ) : null
})

export default IsoformCollapseNotice
