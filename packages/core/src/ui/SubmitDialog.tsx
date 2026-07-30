import { observer } from 'mobx-react'

import Dialog from './Dialog.tsx'
import SubmitForm from './SubmitForm.tsx'

import type { Props as DialogComponentProps } from './Dialog.tsx'
import type { SubmitFormProps } from './SubmitForm.tsx'

// MUI's DialogProps carries DOM `onSubmit`/`onReset` handlers on the root div;
// drop them so the form's own callbacks are what these names mean here.
export interface SubmitDialogProps
  extends
    Omit<DialogComponentProps, 'onSubmit' | 'onReset'>,
    Omit<SubmitFormProps, 'children'> {}

const SubmitDialog = observer(function SubmitDialog(props: SubmitDialogProps) {
  const {
    onSubmit,
    onCancel,
    cancelText,
    submitText,
    submitDisabled,
    submitColor,
    submitStartIcon,
    onReset,
    resetText,
    actions,
    contentClassName,
    children,
    ...dialogProps
  } = props
  return (
    <Dialog onClose={onCancel} {...dialogProps}>
      <SubmitForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        cancelText={cancelText}
        submitText={submitText}
        submitDisabled={submitDisabled}
        submitColor={submitColor}
        submitStartIcon={submitStartIcon}
        onReset={onReset}
        resetText={resetText}
        actions={actions}
        contentClassName={contentClassName}
      >
        {children}
      </SubmitForm>
    </Dialog>
  )
})

export default SubmitDialog
