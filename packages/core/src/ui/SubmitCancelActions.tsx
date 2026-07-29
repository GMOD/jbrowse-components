import { Button, DialogActions } from '@mui/material'

import type { ButtonProps } from '@mui/material'
import type { ReactNode } from 'react'

export interface SubmitCancelActionsProps {
  onCancel: () => void
  onSubmit: () => void
  cancelText?: string
  submitText?: string
  submitDisabled?: boolean
  submitColor?: ButtonProps['color']
  children?: ReactNode
}

// The Cancel/Submit footer SubmitDialog renders, split out for dialogs whose
// Dialog (and outer chrome) is shared across multiple tab panes — SubmitDialog
// can't be used there since it owns its own Dialog. `children` renders extra
// buttons between Cancel and Submit, for a pane with a secondary action.
function SubmitCancelActions({
  onSubmit,
  onCancel,
  cancelText = 'Cancel',
  submitText = 'Submit',
  submitDisabled = false,
  submitColor = 'primary',
  children,
}: SubmitCancelActionsProps) {
  return (
    <DialogActions>
      <Button
        variant="contained"
        color="secondary"
        onClick={() => {
          onCancel()
        }}
      >
        {cancelText}
      </Button>
      {children}
      <Button
        variant="contained"
        color={submitColor}
        disabled={submitDisabled}
        onClick={() => {
          onSubmit()
        }}
      >
        {submitText}
      </Button>
    </DialogActions>
  )
}

export default SubmitCancelActions
