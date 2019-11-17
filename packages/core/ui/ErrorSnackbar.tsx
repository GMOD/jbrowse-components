import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import Snackbar from '@material-ui/core/Snackbar'
import React, { useState } from 'react'

function SimpleDialog({
  onClose,
  open,
  error,
  componentStack,
}: {
  onClose: Function
  open: boolean
  error?: Error
  componentStack?: string
}) {
  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog onClose={handleClose} open={open}>
      <pre>{error ? error.toString() : null}</pre>
      <pre>{componentStack}</pre>
    </Dialog>
  )
}

export default function ErrorSnackbar({
  componentStack,
  error,
}: {
  componentStack?: string
  error?: Error
}) {
  const [open, setOpen] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Snackbar
      open={open}
      onClose={() => {
        setOpen(false)
      }}
      message={
        <span style={{ display: 'flex' }}>
          <div>{error ? error.toString() : null} </div>
          <div>
            <Button
              color="secondary"
              variant="contained"
              onClick={() => setDialogOpen(true)}
            >
              Stacktrace
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <SimpleDialog
              componentStack={componentStack}
              error={error}
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
            />
          </div>
        </span>
      }
    />
  )
}
