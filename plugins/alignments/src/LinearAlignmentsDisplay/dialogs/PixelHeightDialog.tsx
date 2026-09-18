import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// Collects one height in px, at least 1, for the read-height and the
// max-layout-height menu items.
const PixelHeightDialog = observer(function PixelHeightDialog({
  title,
  description,
  label,
  initialValue,
  onSubmit,
  handleClose,
}: {
  title: string
  description: string
  label: string
  initialValue: number
  onSubmit: (height: number) => void
  handleClose: () => void
}) {
  const [height, setHeight] = useState<number | undefined>(initialValue)
  return (
    <SubmitDialog
      open
      title={title}
      submitDisabled={height === undefined}
      onCancel={handleClose}
      onSubmit={() => {
        if (height !== undefined) {
          onSubmit(height)
          handleClose()
        }
      }}
    >
      <Typography>{description}</Typography>
      <NumberTextField
        defaultValue={initialValue}
        onValueChange={setHeight}
        label={label}
        autoFocus
        min={1}
        errorText="Must be at least 1px"
      />
    </SubmitDialog>
  )
})

export default PixelHeightDialog
