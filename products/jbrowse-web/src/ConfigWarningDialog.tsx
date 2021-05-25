import React from 'react'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import WarningIcon from '@material-ui/icons/Warning'

const useStyles = makeStyles(theme => ({
  main: {
    textAlign: 'center',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
  },
  buttons: {
    margin: theme.spacing(2),
    color: theme.palette.text.primary,
  },
}))

export default function ConfigWarningModal({
  onConfirm,
  onCancel,
  reason,
}: {
  onConfirm: () => void
  onCancel: () => void
  reason: { url: string }[]
}) {
  const classes = useStyles()
  return (
    <Dialog
      open
      maxWidth="xl"
      data-testid="session-warning-modal"
      aria-labelledby="alert-dialog-title"
      className={classes.main}
    >
      <DialogTitle id="alert-dialog-title">Warning</DialogTitle>
      <Divider />
      <div>
        <WarningIcon fontSize="large" />
        <DialogContent>
          <DialogContentText>
            This link contains a cross origin config that has the following
            unknown plugins:
            <ul>
              {reason.map(r => (
                <li>URL: {r.url}</li>
              ))}
            </ul>
            Please ensure you trust the source of this link.
          </DialogContentText>
        </DialogContent>
        <div className={classes.buttons}>
          <Button
            color="primary"
            variant="contained"
            style={{ marginRight: 5 }}
            onClick={async () => {
              onConfirm()
            }}
          >
            Yes, I trust it
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              onCancel()
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
