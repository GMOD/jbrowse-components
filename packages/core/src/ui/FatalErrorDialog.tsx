import { useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'

import ErrorBanner from './ErrorBanner.tsx'
import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import FactoryResetDialog from './FactoryResetDialog.tsx'

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
  extraActions,
}: {
  componentStack?: string
  error?: unknown
  onFactoryReset: () => void
  resetButtonText?: string
  // recovery offers narrower than a factory reset, which only some products
  // have: Desktop puts "Disable global plugins and reload" here, so a plugin
  // that crashes on load can be undone without discarding the user's sessions
  extraActions?: React.ReactNode
}) {
  return (
    <Dialog maxWidth="xl" open>
      <DialogTitle>Fatal error</DialogTitle>
      <DialogContent>
        <ErrorBanner error={error} />
        {componentStack ? (
          <ErrorMessageStackTraceContents text={componentStack} />
        ) : null}
      </DialogContent>
      <DialogActions>
        {extraActions}
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
