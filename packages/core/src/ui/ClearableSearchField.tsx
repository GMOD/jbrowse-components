import { useState, useTransition } from 'react'

import ClearIcon from '@mui/icons-material/Clear'
import {
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { TextFieldProps } from '@mui/material'
import type { Ref } from 'react'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
  fullWidth?: boolean
  variant?: TextFieldProps['variant']
  size?: TextFieldProps['size']
  /** a few words drawn before the clear button, such as a match count */
  status?: string
  inputRef?: Ref<HTMLInputElement>
}

/**
 * A search box with a clear button that shows exactly `value`, for a search
 * cheap enough to run on every keystroke
 */
export const SearchField = observer(function SearchField({
  value,
  onChange,
  label,
  className,
  fullWidth,
  variant,
  size,
  status,
  inputRef,
}: SearchFieldProps) {
  return (
    <TextField
      className={className}
      fullWidth={fullWidth}
      variant={variant}
      size={size}
      inputRef={inputRef}
      label={label}
      value={value}
      onChange={event => {
        onChange(event.target.value)
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
                size={size}
                aria-label={`Clear ${label.toLowerCase()}`}
                onClick={() => {
                  onChange('')
                }}
              >
                <ClearIcon fontSize={size} />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
})

/**
 * `SearchField` over a search too slow to run before the keystroke paints:
 * the box keeps its own text and hands each change on in a transition
 */
const ClearableSearchField = observer(function ClearableSearchField({
  value,
  onChange,
  ...rest
}: SearchFieldProps) {
  const [localValue, setLocalValue] = useState(value)
  const [, startTransition] = useTransition()

  // Sync back when the model clears the filter externally (during render,
  // not in an effect, to avoid the extra render cycle)
  if (value === '' && localValue !== '') {
    setLocalValue('')
  }

  return (
    <SearchField
      {...rest}
      value={localValue}
      onChange={next => {
        setLocalValue(next)
        if (next === '') {
          onChange(next)
        } else {
          startTransition(() => {
            onChange(next)
          })
        }
      }}
    />
  )
})

export default ClearableSearchField
