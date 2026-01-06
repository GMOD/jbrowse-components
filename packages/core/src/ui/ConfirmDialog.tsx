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
}

const ConfirmDialog = observer(function ConfirmDialog(props: Props) {
  const {
    onSubmit,
    onCancel,
    cancelText = 'Cancel',
    submitText = 'OK',
    children,
  } = props
  return (
    <Dialog onClose={onCancel} {...props}>
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
