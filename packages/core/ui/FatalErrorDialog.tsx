import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
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
ResetComponent.propTypes = {
  onFactoryReset: PropTypes.func.isRequired,
  resetButtonText: PropTypes.string.isRequired,
}

const FatalErrorDialog = ({
  componentStack,
  error,
  onFactoryReset,
  resetButtonText,
}: {
  componentStack: string
  error: Error
  onFactoryReset: Function
  resetButtonText: string
}) => {
  return (
    <Dialog open>
      <DialogTitle style={{ backgroundColor: '#e88' }}>Fatal error</DialogTitle>
      <DialogContent>
        <pre>
          {error.toString()}
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

FatalErrorDialog.propTypes = {
  componentStack: PropTypes.string,
  error: PropTypes.shape({}),
  onFactoryReset: PropTypes.func.isRequired,
  resetButtonText: PropTypes.string,
}

FatalErrorDialog.defaultProps = {
  error: { message: 'No error message provided' },
  componentStack: '',
  resetButtonText: 'Factory Reset',
}

export default FatalErrorDialog
