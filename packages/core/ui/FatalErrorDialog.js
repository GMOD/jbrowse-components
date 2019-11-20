import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import FactoryResetDialog from './FactoryResetDialog'

const ResetComponent = () => {
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
      />
    </>
  )
}
const FatalErrorDialog = ({ componentStack, error }) => {
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
        {window.electron ? <ResetComponent /> : null}
      </DialogActions>
    </Dialog>
  )
}

FatalErrorDialog.propTypes = {
  componentStack: PropTypes.string,
  error: PropTypes.shape({}),
}

FatalErrorDialog.defaultProps = {
  error: { message: 'No error message provided' },
  componentStack: '',
}

export default FatalErrorDialog
