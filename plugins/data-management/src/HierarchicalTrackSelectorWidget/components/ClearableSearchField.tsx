import { useEffect, useEffectEvent, useState } from 'react'

import { useDebounce } from '@jbrowse/core/util'
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
  // Data flow: keystrokes update localValue immediately (keeping the input
  // responsive), useDebounce delays propagation by 300ms so rapid typing
  // triggers only one expensive model.setFilterText call, and useEffectEvent
  // captures the latest onChange without it being a dependency of the effect
  const [localValue, setLocalValue] = useState(value)
  const debouncedValue = useDebounce(localValue, 300)
  const onChangeEvent = useEffectEvent(onChange)

  useEffect(() => {
    if (value === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue('')
    }
  }, [value])

  useEffect(() => {
    onChangeEvent(debouncedValue)
  }, [debouncedValue])

  return (
    <TextField
      className={className}
      label={label}
      value={localValue}
      onChange={event => {
        setLocalValue(event.target.value)
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
