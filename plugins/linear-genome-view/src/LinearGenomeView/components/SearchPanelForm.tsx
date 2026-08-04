import { SubmitForm } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { ReactNode } from 'react'

const useStyles = makeStyles()({
  dialogContent: {
    width: '34em',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
})

// The chrome shared by the sequence-search mode panels: the fixed-width column
// their fields lay out in, plus SubmitForm's Cancel/Submit footer. Each panel
// still owns its own fields and its own submit, so this is only the frame.
export default function SearchPanelForm({
  onSubmit,
  handleClose,
  submitDisabled,
  submitText,
  actions,
  children,
}: {
  onSubmit: () => void
  handleClose: () => void
  submitDisabled: boolean
  submitText?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <SubmitForm
      contentClassName={classes.dialogContent}
      onSubmit={onSubmit}
      onCancel={handleClose}
      submitDisabled={submitDisabled}
      submitText={submitText}
      actions={actions}
    >
      {children}
    </SubmitForm>
  )
}
