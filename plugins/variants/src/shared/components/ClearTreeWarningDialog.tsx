import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

export default function ClearTreeWarningDialog({
  handleClose,
  onConfirm,
}: {
  handleClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open title="Clear cluster tree?" onClose={handleClose}>
      <DialogContent>
        <DialogContentText>
          You have changed the row order. This will clear the cluster tree
          visualization. Do you want to continue?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            onConfirm()
            handleClose()
          }}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  )
}
