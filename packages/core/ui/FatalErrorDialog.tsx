import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import FactoryResetDialog from './FactoryResetDialog'

const ResetComponent = ({
  onFactoryReset,
  buttonText,
}: {
  onFactoryReset: Function
  buttonText: string
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        color="primary"
        variant="contained"
        onClick={() => setDialogOpen(true)}
      >
        {buttonText}
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
  buttonText: PropTypes.string.isRequired,
}

const FatalErrorDialog = ({
  componentStack,
  error,
  onFactoryReset,
  buttonText,
}: {
  componentStack: string
  error: Error
  onFactoryReset: Function
  buttonText: string
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
          buttonText={buttonText}
        />
      </DialogActions>
    </Dialog>
  )
}

FatalErrorDialog.propTypes = {
  componentStack: PropTypes.string,
  error: PropTypes.shape({}),
  onFactoryReset: PropTypes.func.isRequired,
  buttonText: PropTypes.string,
}

FatalErrorDialog.defaultProps = {
  error: { message: 'No error message provided' },
  componentStack: '',
  buttonText: 'Factory Reset',
}

export default FatalErrorDialog
