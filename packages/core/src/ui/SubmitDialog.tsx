import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import Dialog from './Dialog.tsx'

import type { DialogProps } from '@mui/material'

interface Props extends DialogProps {
  onCancel: () => void
  onSubmit: () => void
  cancelText?: string
  submitText?: string
  submitDisabled?: boolean
}

const SubmitDialog = observer(function SubmitDialog(props: Props) {
  const {
    onSubmit,
    onCancel,
    cancelText = 'Cancel',
    submitText = 'Submit',
    submitDisabled = false,
    children,
    ...dialogProps
  } = props
  return (
    <Dialog onClose={onCancel} {...dialogProps}>
      <form
        onSubmit={event => {
          event.preventDefault()
          if (!submitDisabled) {
            onSubmit()
          }
        }}
      >
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
            type="submit"
            color="primary"
            variant="contained"
            disabled={submitDisabled}
          >
            {submitText}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default SubmitDialog
