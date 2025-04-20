import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'

export default function FactoryResetDialog({
  open,
  onClose,
  onFactoryReset,
}: {
  open: boolean
  onClose: () => void
  onFactoryReset: () => void
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={() => {
        onClose()
      }}
      title="Reset"
      onCancel={() => {
        onClose()
      }}
      onSubmit={() => {
        onFactoryReset()
      }}
    >
      <DialogContentText>
        Are you sure you want to reset? This will remove all your sessions.
      </DialogContentText>
    </ConfirmDialog>
  )
}
