import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogActions from '@material-ui/core/DialogActions'
import React from 'react'

const { electronBetterIpc = {} } = window
const { ipcRenderer } = electronBetterIpc

export default ({ onClose, open }: { onClose: Function; open: boolean }) => {
  function handleDialogClose(action?: string) {
    if (action === 'reset') {
      ;(async () => {
        // @ts-ignore
        await ipcRenderer.invoke('reset')
        window.location.reload()
      })()
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
