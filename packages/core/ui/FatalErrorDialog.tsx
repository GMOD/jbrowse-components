import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import ErrorMessage from './ErrorMessage'
import FactoryResetDialog from './FactoryResetDialog'

const ResetComponent = ({
  onFactoryReset,
  resetButtonText,
}: {
  onFactoryReset: () => void
  resetButtonText: string
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        data-testid="fatal-error"
        color="primary"
        variant="contained"
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        {resetButtonText}
      </Button>
      <FactoryResetDialog
        onClose={() => {
          setDialogOpen(false)
        }}
        open={dialogOpen}
        onFactoryReset={onFactoryReset}
      />
    </>
  )
}

export default function FatalErrorDialog({
  componentStack,
  error = 'No error message provided',
  onFactoryReset,
  resetButtonText = 'Factory Reset',
}: {
  componentStack?: string
  error?: unknown
  onFactoryReset: () => void
  resetButtonText?: string
}) {
  return (
    <Dialog maxWidth="xl" open>
      <DialogTitle>Fatal error</DialogTitle>
      <DialogContent>
        <ErrorMessage error={error} />
        <pre>{componentStack}</pre>
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            window.location.reload()
          }}
        >
          Refresh
        </Button>
        <ResetComponent
          onFactoryReset={onFactoryReset}
          resetButtonText={resetButtonText}
        />
      </DialogActions>
    </Dialog>
  )
}
