import { Suspense, lazy, useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { observer } from 'mobx-react'

import ErrorBanner from './ErrorBanner.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import FactoryResetDialog from './FactoryResetDialog.tsx'

const ErrorReport = lazy(() => import('./ErrorReport.tsx'))

const ResetComponent = observer(function ResetComponent({
  onFactoryReset,
  resetButtonText,
}: {
  onFactoryReset: () => void
  resetButtonText: string
}) {
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
})

const FatalErrorDialog = observer(function FatalErrorDialog({
  componentStack,
  error = 'No error message provided',
  onFactoryReset,
  resetButtonText = 'Factory Reset',
  extraActions,
  gitCommit,
}: {
  componentStack?: string
  error?: unknown
  onFactoryReset: () => void
  resetButtonText?: string
  gitCommit?: string
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
        {/* a fatal error is often a chunk that failed to load, and this one
            can fail the same way; the banner above already offers the refresh */}
        <ErrorBoundary FallbackComponent={() => null}>
          <Suspense fallback={null}>
            <ErrorReport
              error={error}
              componentStack={componentStack}
              gitCommit={gitCommit}
            />
          </Suspense>
        </ErrorBoundary>
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
})

export default FatalErrorDialog
