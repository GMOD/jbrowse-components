import { useState, useTransition } from 'react'

import ClearIcon from '@mui/icons-material/Clear'
import {
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const ClearableSearchField = observer(function ClearableSearchField({
  value,
  onChange,
  label,
  className,
  fullWidth,
  status,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
  fullWidth?: boolean
  /** a few words drawn before the clear button, such as a match count */
  status?: string
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
        htmlInput: { spellCheck: false },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              {status ? (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  noWrap
                  role="status"
                >
                  {status}
                </Typography>
              ) : null}
              <IconButton
                aria-label={`Clear ${label.toLowerCase()}`}
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
})

export default ClearableSearchField
