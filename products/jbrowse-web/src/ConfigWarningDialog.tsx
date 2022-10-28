import React from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
} from '@mui/material'
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
      aria-labelledby="alert-dialog-title"
    >
      <DialogTitle id="alert-dialog-title">Warning</DialogTitle>
      <Divider />
      <div>
        <WarningIcon fontSize="large" />
        <DialogContent>
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
        <Button
          color="primary"
          variant="contained"
          style={{ marginRight: 5 }}
          onClick={async () => {
            onConfirm()
          }}
        >
          Yes, I trust it
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            onCancel()
          }}
        >
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}
