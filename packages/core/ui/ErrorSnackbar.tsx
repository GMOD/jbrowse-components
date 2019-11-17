import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import React, { useState } from 'react'

import FactoryResetDialog from './FactoryResetDialog'

const isElectron = !!window.electron

function StackTraceDialog({
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
  return (
    <Dialog onClose={() => onClose()} open={open}>
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
  const [factoryResetDialogOpen, setFactoryResetDialogOpen] = useState(false)

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
            {isElectron ? (
              <Button
                variant="contained"
                onClick={() => setFactoryResetDialogOpen(true)}
              >
                <Icon color="secondary" fontSize="small">
                  warning
                </Icon>
                Factory reset
              </Button>
            ) : null}
            <FactoryResetDialog
              onClose={() => setFactoryResetDialogOpen(false)}
              open={factoryResetDialogOpen}
            />
            <StackTraceDialog
              componentStack={componentStack}
              error={error}
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
            />
          </div>
          <IconButton
            key="close"
            aria-label="close"
            color="inherit"
            onClick={() => setOpen(false)}
          >
            <Icon>close</Icon>
          </IconButton>
        </span>
      }
    />
  )
}
