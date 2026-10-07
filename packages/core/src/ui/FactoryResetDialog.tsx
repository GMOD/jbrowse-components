import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import ConfirmDialog from './ConfirmDialog.tsx'

const FactoryResetDialog = observer(function FactoryResetDialog({
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
      submitText="Reset"
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
})

export default FactoryResetDialog
