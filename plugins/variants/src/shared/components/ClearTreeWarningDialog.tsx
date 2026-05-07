import { ConfirmDialog } from '@jbrowse/core/ui'
import { DialogContentText } from '@mui/material'

export default function ClearTreeWarningDialog({
  handleClose,
  onConfirm,
}: {
  handleClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmDialog
      open
      title="Clear cluster tree?"
      submitText="Continue"
      onCancel={handleClose}
      onSubmit={() => {
        onConfirm()
        handleClose()
      }}
    >
      <DialogContentText>
        You have changed the row order. This will clear the cluster tree
        visualization. Do you want to continue?
      </DialogContentText>
    </ConfirmDialog>
  )
}
