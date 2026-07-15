import { observer } from 'mobx-react'

import SubmitDialog from './SubmitDialog.tsx'

import type { SubmitDialogProps } from './SubmitDialog.tsx'

// ConfirmDialog is a SubmitDialog framed as a yes/no confirmation: the action
// button defaults to "OK" instead of "Submit". Enter submits, Escape/Cancel
// dismisses.
const ConfirmDialog = observer(function ConfirmDialog(
  props: SubmitDialogProps,
) {
  return <SubmitDialog submitText="OK" {...props} />
})

export default ConfirmDialog
