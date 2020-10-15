import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import React from 'react'

const AssemblyManager = ({
  rootModel,
  open,
  onClose,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rootModel: any
  open: boolean
  onClose: Function
}) => {
  return (
    <Dialog open={open}>
      <DialogTitle style={{ backgroundColor: '#0D233F' }}>
        Assembly Manager
      </DialogTitle>
      <DialogContent>Hello world! :)</DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onClose(false)
          }}
        >
          OK
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onClose(false)
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AssemblyManager
