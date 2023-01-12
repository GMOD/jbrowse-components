import React from 'react'
import Dialog from '@jbrowse/core/ui/Dialog'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import WarningIcon from '@mui/icons-material/Warning'

export default function ConfigWarningModal({
  onConfirm,
  onCancel,
  reason,
}: {
  onConfirm: () => void
  onCancel: () => void
  reason: { url: string }[]
}) {
  return (
    <Dialog
      open
      maxWidth="xl"
      data-testid="session-warning-modal"
      title="Warning"
      aria-labelledby="alert-dialog-title"
    >
      <DialogContent>
        <WarningIcon fontSize="large" />
        <DialogContentText>
          This link contains a cross origin config that has the following
          unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>URL: {r.url}</li>
            ))}
          </ul>
          Please ensure you trust the source of this link.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="primary" variant="contained" onClick={() => onConfirm()}>
          Yes, I trust it
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => onCancel()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
