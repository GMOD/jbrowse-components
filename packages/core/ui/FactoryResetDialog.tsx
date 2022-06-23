import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
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
          configuration.
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
