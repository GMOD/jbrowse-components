import React from 'react'
import Button from '@mui/material/Button'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'

export default function FactoryResetDialog({
  open,
  onClose,
  onFactoryReset,
}: {
  open: boolean
  onClose: () => void
  onFactoryReset: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose()
      }}
      title="Reset"
    >
      <DialogContent>
        <DialogContentText>
          Are you sure you want to reset? This will remove all your sessions.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            onFactoryReset()
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
