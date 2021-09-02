import React from 'react'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@material-ui/core'

export default ({
  open,
  onClose,
  onFactoryReset,
}: {
  open: boolean
  onClose: Function
  onFactoryReset: Function
}) => {
  return (
    <Dialog open={open} onClose={() => onClose()}>
      <DialogTitle id="alert-dialog-title">Reset</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          Are you sure you want to reset? This will remove all your sessions.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} color="primary">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            await onFactoryReset()
            onClose()
          }}
          color="primary"
          variant="contained"
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}
