import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@material-ui/core'

const DeleteSessionDialog = ({
  onClose,
  setPluginManager,
}: {
  setPluginManager: Function
  onClose: () => void
}) => {
  return (
    <Dialog open onClose={() => onClose()}>
      <DialogTitle>Open data directory</DialogTitle>
      <DialogContent></DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} color="secondary">
          Cancel
        </Button>
        <Button
          onClick={async () => {}}
          color="primary"
          variant="contained"
          autoFocus
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteSessionDialog
