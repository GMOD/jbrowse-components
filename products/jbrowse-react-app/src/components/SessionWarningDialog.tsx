import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'

export default function SessionWarningModal({
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
    >
      <DialogContent>
        <WarningIcon fontSize="large" />
        <DialogContentText>
          This link contains a session that has the following unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>URL: {r.url}</li>
            ))}
          </ul>
          Please ensure you trust the source of this session.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="primary" variant="contained" onClick={() => onConfirm()}>
          Yes, I trust it
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => onCancel()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
