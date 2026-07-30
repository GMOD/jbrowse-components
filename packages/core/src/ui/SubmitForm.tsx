import { Button, DialogActions, DialogContent } from '@mui/material'

import type { ButtonProps } from '@mui/material'
import type { ReactNode } from 'react'

export interface SubmitFormProps {
  onCancel: () => void
  onSubmit: () => void
  cancelText?: string
  submitText?: string
  submitDisabled?: boolean
  submitColor?: ButtonProps['color']
  submitStartIcon?: ReactNode
  // When provided, the secondary button becomes a "Restore default" action
  // (calls onReset, does NOT dismiss) in place of Cancel — for dialogs whose
  // settings apply live, where Submit is really just "Close". onCancel still
  // handles backdrop/escape dismissal.
  onReset?: () => void
  resetText?: string
  // Extra buttons rendered between the secondary button and Submit, for a pane
  // with a secondary action.
  actions?: ReactNode
  contentClassName?: string
  children?: ReactNode
}

/**
 * Content plus a Cancel/Submit footer, wrapped in a form so Enter submits.
 * SubmitDialog is this with a Dialog around it; a dialog whose Dialog (and
 * outer chrome) is shared across several tab panes uses this directly, so the
 * panes get the same keyboard behavior without each owning a Dialog.
 */
export default function SubmitForm({
  onSubmit,
  onCancel,
  cancelText = 'Cancel',
  submitText = 'Submit',
  submitDisabled = false,
  submitColor = 'primary',
  submitStartIcon,
  onReset,
  resetText = 'Restore default',
  actions,
  contentClassName,
  children,
}: SubmitFormProps) {
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        if (!submitDisabled) {
          onSubmit()
        }
      }}
    >
      <DialogContent className={contentClassName}>{children}</DialogContent>
      <DialogActions>
        <Button
          type="button"
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
        {actions}
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
  )
}
