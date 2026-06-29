import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'

export default function SetRowHeight({
  model,
  handleClose,
}: {
  model: {
    effectiveRowHeight: number
    setRowHeight: (arg: number) => void
  }
  handleClose: () => void
}) {
  const [value, setValue] = useState<number | undefined>(
    model.effectiveRowHeight,
  )

  return (
    <SubmitDialog
      open
      title="Set row height"
      onCancel={handleClose}
      submitDisabled={value === undefined}
      onSubmit={() => {
        if (value !== undefined) {
          model.setRowHeight(value)
          handleClose()
        }
      }}
    >
      <NumberTextField
        defaultValue={model.effectiveRowHeight}
        onValueChange={setValue}
      />
    </SubmitDialog>
  )
}
