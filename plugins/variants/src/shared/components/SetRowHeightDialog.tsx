import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'

export default function SetRowHeight({
  model,
  handleClose,
}: {
  model: {
    rowHeight: number
    setRowHeight: (arg: number) => void
  }
  handleClose: () => void
}) {
  const [value, setValue] = useState<number | undefined>(model.rowHeight)

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
        defaultValue={model.rowHeight}
        onValueChange={setValue}
      />
    </SubmitDialog>
  )
}
