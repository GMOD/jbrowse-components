import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'

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
