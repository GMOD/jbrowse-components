import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import Dialog from './Dialog.tsx'

import type { Props as DialogComponentProps } from './Dialog.tsx'
import type { ButtonProps } from '@mui/material'

export interface SubmitDialogProps extends DialogComponentProps {
  onCancel: () => void
  onSubmit: () => void
  cancelText?: string
  submitText?: string
  submitDisabled?: boolean
  submitColor?: ButtonProps['color']
  submitStartIcon?: React.ReactNode
  // When provided, the secondary button becomes a "Restore default" action
  // (calls onReset, does NOT dismiss) in place of Cancel — for dialogs whose
  // settings apply live, where Submit is really just "Close". onCancel still
  // handles backdrop/escape dismissal.
  onReset?: () => void
  resetText?: string
}

const SubmitDialog = observer(function SubmitDialog(props: SubmitDialogProps) {
  const {
    onSubmit,
    onCancel,
    cancelText = 'Cancel',
    submitText = 'Submit',
    submitDisabled = false,
    submitColor = 'primary',
    submitStartIcon,
    onReset,
    resetText = 'Restore default',
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
              if (onReset) {
                onReset()
              } else {
                onCancel()
              }
            }}
          >
            {onReset ? resetText : cancelText}
          </Button>
          <Button
            type="submit"
            color={submitColor}
            variant="contained"
            disabled={submitDisabled}
            startIcon={submitStartIcon}
          >
            {submitText}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default SubmitDialog
