import { DialogContentText } from '@mui/material'

import ConfirmDialog from './ConfirmDialog.tsx'

export default function FactoryResetDialog({
  onClose,
  open,
  onFactoryReset,
}: {
  onClose: () => void
  open: boolean
  onFactoryReset: () => void
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Reset"
      onCancel={onClose}
      onSubmit={() => {
        onFactoryReset()
        onClose()
      }}
    >
      <DialogContentText>
        Are you sure you want to reset? This will restore the default
        configuration.
      </DialogContentText>
    </ConfirmDialog>
  )
}
