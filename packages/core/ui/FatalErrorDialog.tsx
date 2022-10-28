import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import FactoryResetDialog from './FactoryResetDialog'

const ResetComponent = ({
  onFactoryReset,
  resetButtonText,
}: {
  onFactoryReset: Function
  resetButtonText: string
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        data-testid="fatal-error"
        color="primary"
        variant="contained"
        onClick={() => setDialogOpen(true)}
      >
        {resetButtonText}
      </Button>
      <FactoryResetDialog
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        onFactoryReset={onFactoryReset}
      />
    </>
  )
}

const FatalErrorDialog = ({
  componentStack,
  error = 'No error message provided',
  onFactoryReset,
  resetButtonText = 'Factory Reset',
}: {
  componentStack?: string
  error?: unknown
  onFactoryReset: Function
  resetButtonText?: string
}) => {
  console.error(error)
  return (
    <Dialog open>
      <DialogTitle style={{ background: '#e88' }}>Fatal error</DialogTitle>
      <DialogContent>
        <pre>
          {`${error}`}
          {componentStack}
        </pre>
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => window.location.reload()}
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

export default FatalErrorDialog
