import { useState, useTransition } from 'react'

import ClearIcon from '@mui/icons-material/Clear'
import { IconButton, InputAdornment, TextField } from '@mui/material'

export default function ClearableSearchField({
  value,
  onChange,
  label,
  className,
  fullWidth,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
  fullWidth?: boolean
}) {
  const [localValue, setLocalValue] = useState(value)
  const [, startTransition] = useTransition()

  // Sync back when the model clears the filter externally (during render,
  // not in an effect, to avoid the extra render cycle)
  if (value === '' && localValue !== '') {
    setLocalValue('')
  }

  return (
    <TextField
      className={className}
      fullWidth={fullWidth}
      label={label}
      value={localValue}
      onChange={event => {
        const v = event.target.value
        setLocalValue(v)
        startTransition(() => {
          onChange(v)
        })
      }}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => {
                  setLocalValue('')
                  onChange('')
                }}
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
