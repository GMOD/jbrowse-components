import React from 'react'
import Button from '@mui/material/Button'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Dialog from './Dialog'

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
    <Dialog title="Reset" onClose={() => handleDialogClose()} open={open}>
      <DialogContent>
        <DialogContentText>
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
