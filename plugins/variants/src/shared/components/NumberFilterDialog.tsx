import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

export interface NumberFilterDialogProps {
  title: string
  description: string
  label: string
  placeholder: string
  errorText: string
  min: number
  max: number
  value: number
  onSubmit: (arg: number) => void
  handleClose: () => void
}

// Shared single-number filter dialog. Backs the MAF and missingness filters
// (see numberFilterMenuItems.ts) — same SubmitDialog + NumberTextField shape,
// differing only in copy and valid range.
export default function NumberFilterDialog({
  title,
  description,
  label,
  placeholder,
  errorText,
  min,
  max,
  value,
  onSubmit,
  handleClose,
}: NumberFilterDialogProps) {
  const [current, setCurrent] = useState<number | undefined>(value)
  return (
    <SubmitDialog
      open
      title={title}
      onCancel={handleClose}
      submitDisabled={current === undefined}
      onSubmit={() => {
        if (current !== undefined) {
          onSubmit(current)
          handleClose()
        }
      }}
    >
      <Typography>{description}</Typography>
      <NumberTextField
        defaultValue={value}
        autoFocus
        fullWidth
        margin="normal"
        label={label}
        placeholder={placeholder}
        min={min}
        max={max}
        errorText={errorText}
        onValueChange={setCurrent}
      />
    </SubmitDialog>
  )
}
