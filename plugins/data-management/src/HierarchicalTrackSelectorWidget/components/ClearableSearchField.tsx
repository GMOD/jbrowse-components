import { useEffect, useState, useTransition } from 'react'

import ClearIcon from '@mui/icons-material/Clear'
import { IconButton, InputAdornment, TextField } from '@mui/material'

export default function ClearableSearchField({
  value,
  onChange,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}) {
  const [localValue, setLocalValue] = useState(value)
  const [, startTransition] = useTransition()

  // Sync local state when model value is cleared externally
  useEffect(() => {
    if (value === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue('')
    }
  }, [value])

  return (
    <TextField
      className={className}
      label={label}
      value={localValue}
      onChange={event => {
        const newValue = event.target.value
        setLocalValue(newValue)
        startTransition(() => {
          onChange(newValue)
        })
      }}
      fullWidth
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
