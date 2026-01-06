import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

import Dialog from './Dialog.tsx'

export default function FactoryResetDialog({
  onClose,
  open,
  onFactoryReset,
}: {
  onClose: () => void
  open: boolean
  onFactoryReset: () => void
}) {
  function handleDialogClose(action?: string) {
    if (action === 'reset') {
      onFactoryReset()
    }
    onClose()
  }

  return (
    <Dialog
      title="Reset"
      onClose={() => {
        handleDialogClose()
      }}
      open={open}
    >
      <DialogContent>
        <DialogContentText>
          Are you sure you want to reset? This will restore the default
          configuration.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleDialogClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            handleDialogClose('reset')
          }}
          color="primary"
          variant="contained"
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}
