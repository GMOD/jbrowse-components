import { Checkbox, FormControlLabel } from '@mui/material'

import type { ReactNode } from 'react'

export default function LabeledCheckbox({
  checked,
  onChange,
  label,
  className,
  disabled,
  size,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  className?: string
  disabled?: boolean
  size?: 'small' | 'medium'
}) {
  return (
    <FormControlLabel
      className={className}
      disabled={disabled}
      control={
        <Checkbox
          size={size}
          checked={checked}
          onChange={event => {
            onChange(event.target.checked)
          }}
        />
      }
      label={label}
    />
  )
}
