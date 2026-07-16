import { ConfirmDialog } from '@jbrowse/core/ui'
import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

// Shown before Submit when the user reordered rows while a cluster tree is
// loaded — the tree was built on the old ordering and will be invalidated.
export default observer(function ClearTreeWarningDialog({
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
})
