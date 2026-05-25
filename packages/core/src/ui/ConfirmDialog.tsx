import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import Dialog from './Dialog.tsx'

import type { DialogProps } from '@mui/material'

interface Props extends DialogProps {
  header?: React.ReactNode
  onCancel: () => void
  onSubmit: () => void
  cancelText?: string
  submitText?: string
  submitDisabled?: boolean
}

const ConfirmDialog = observer(function ConfirmDialog(props: Props) {
  const {
    onSubmit,
    onCancel,
    cancelText = 'Cancel',
    submitText = 'OK',
    submitDisabled = false,
    children,
    ...dialogProps
  } = props
  return (
    <Dialog onClose={onCancel} {...dialogProps}>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onCancel()
          }}
        >
          {cancelText}
        </Button>
        <Button
          color="primary"
          variant="contained"
          disabled={submitDisabled}
          onClick={() => {
            onSubmit()
          }}
        >
          {submitText}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ConfirmDialog
