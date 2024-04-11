import React from 'react'
import { Button, DialogContent, DialogActions } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

export default function AdvancedSequenceDialog({
  handleClose,
}: {
  handleClose: () => void
}) {
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => handleClose()}
      title="Advanced sequence display"
    >
      <DialogContent>
        <div></div>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => handleClose()} autoFocus variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
