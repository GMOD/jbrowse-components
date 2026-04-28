import { useEffect, useTransition, useState } from 'react'

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

  useEffect(() => {
    if (value === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue('')
    }
  }, [value])

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
