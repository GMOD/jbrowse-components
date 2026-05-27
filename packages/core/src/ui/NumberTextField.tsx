import { useState } from 'react'

import { TextField } from '@mui/material'

import type { TextFieldProps } from '@mui/material'

interface OwnProps {
  /** Initial numeric value; undefined renders as empty input. */
  defaultValue?: number
  /**
   * Fires on every keystroke with the parsed number, or undefined when
   * the input is empty or invalid (NaN / out of bounds). The parent
   * decides whether to gate submission on undefined.
   */
  onValueChange: (value: number | undefined) => void
  /** Optional inclusive lower bound. */
  min?: number
  /** Optional inclusive upper bound. */
  max?: number
  /** Shown under the input when the value is non-empty and invalid. */
  errorText?: string
}

// `value`, `onChange`, `type`, `error`, and `helperText` are managed here.
type Props = Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'error'> &
  OwnProps & { helperText?: TextFieldProps['helperText'] }

/**
 * Uncontrolled-style numeric TextField. Owns the input *text* internally;
 * emits the parsed *number* (or undefined) to the parent on every change.
 *
 * Use over `<TextField type="number" />` — the browser number input has
 * known UX problems (scroll-to-change, locale issues, browser-specific
 * spinners). This component keeps a plain text input and validates with
 * `Number.isFinite` + optional min/max.
 */
export default function NumberTextField(props: Props) {
  const {
    defaultValue,
    onValueChange,
    min,
    max,
    errorText = 'Must be a valid number',
    helperText,
    ...rest
  } = props
  const [text, setText] = useState(
    defaultValue === undefined ? '' : `${defaultValue}`,
  )
  const num = Number(text)
  const inBounds =
    (min === undefined || num >= min) && (max === undefined || num <= max)
  const valid = Number.isFinite(num) && inBounds
  const showError = text !== '' && !valid

  return (
    <TextField
      {...rest}
      value={text}
      error={showError}
      helperText={showError ? errorText : helperText}
      autoComplete="off"
      onChange={event => {
        const next = event.target.value
        setText(next)
        if (next === '') {
          onValueChange(undefined)
        } else {
          const n = Number(next)
          const ok =
            Number.isFinite(n) &&
            (min === undefined || n >= min) &&
            (max === undefined || n <= max)
          onValueChange(ok ? n : undefined)
        }
      }}
    />
  )
}
