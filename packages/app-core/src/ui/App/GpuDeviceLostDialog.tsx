import Dialog from '@jbrowse/core/ui/Dialog'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'

export default function GpuDeviceLostDialog({
  onRecover,
  onClose,
}: {
  onRecover: () => void
  onClose: () => void
}) {
  return (
    <Dialog open title="GPU device lost" onClose={onClose}>
      <DialogContent>
        <DialogContentText>
          The GPU device was lost, possibly due to a driver crash or resource
          exhaustion. Recovering will attempt to reinitialize GPU rendering.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Dismiss</Button>
        <Button
          variant="contained"
          onClick={() => {
            onRecover()
            onClose()
          }}
        >
          Recover
        </Button>
      </DialogActions>
    </Dialog>
  )
}
