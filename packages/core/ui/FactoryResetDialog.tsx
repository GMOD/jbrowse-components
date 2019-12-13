import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogActions from '@material-ui/core/DialogActions'
import React from 'react'

export default ({
  onClose,
  open,
  onFactoryReset,
}: {
  onClose: Function
  open: boolean
  onFactoryReset: Function
}) => {
  function handleDialogClose(action?: string) {
    if (action === 'reset') {
      onFactoryReset()
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={() => handleDialogClose()}>
      <DialogTitle id="alert-dialog-title">Reset</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          Are you sure you want to reset? This will restore the default
          configuration and remove all sessions.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleDialogClose()} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => handleDialogClose('reset')}
          color="primary"
          variant="contained"
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}
