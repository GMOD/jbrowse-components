import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import FactoryResetDialog from './FactoryResetDialog'

const ResetComponent = ({ onFactoryReset }: { onFactoryReset: Function }) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        color="primary"
        variant="contained"
        onClick={() => setDialogOpen(true)}
      >
        Factory reset
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
}

const FatalErrorDialog = ({
  componentStack,
  error,
  onFactoryReset,
}: {
  componentStack: string
  error: Error
  onFactoryReset: Function
}) => {
  return (
    <Dialog open={true}>
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
        <ResetComponent onFactoryReset={onFactoryReset} />
      </DialogActions>
    </Dialog>
  )
}

FatalErrorDialog.propTypes = {
  componentStack: PropTypes.string,
  error: PropTypes.shape({}),
  onFactoryReset: PropTypes.func.isRequired,
}

FatalErrorDialog.defaultProps = {
  error: { message: 'No error message provided' },
  componentStack: '',
}

export default FatalErrorDialog
