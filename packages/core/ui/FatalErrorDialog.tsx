import React, { useState } from 'react'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'

// locals
import FactoryResetDialog from './FactoryResetDialog'
import Dialog from './Dialog'

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
  return (
    <Dialog open title={'Fatal error'}>
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
