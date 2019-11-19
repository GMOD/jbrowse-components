import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import PropTypes from 'prop-types'
import React, { useState } from 'react'

const FatalErrorDialog = ({ componentStack, error, ResetComponent }) => {
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
        {ResetComponent ? <ResetComponent /> : null}
      </DialogActions>
    </Dialog>
  )
}

FatalErrorDialog.propTypes = {
  componentStack: PropTypes.string.isRequired,
  error: PropTypes.shape({}).isRequired,
  ResetDialog: PropTypes.node,
}

FatalErrorDialog.defaultProps = {
  ResetDialog: null,
}

export default FatalErrorDialog
