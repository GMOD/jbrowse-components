import { useState } from 'react'

import { TextField } from '@mui/material'

import { isValidTag } from '../util/tags.ts'

import type { TextFieldProps } from '@mui/material'

interface OwnProps {
  /** Initial tag; undefined or '' renders as empty input. */
  defaultValue?: string
  /**
   * Fires on every keystroke with the tag when it is a valid 2-character SAM
   * tag, or undefined otherwise. The parent gates submission on undefined.
   */
  onValueChange: (value: string | undefined) => void
  /** Hint shown under the input until two characters fail validation. */
  helperText?: TextFieldProps['helperText']
  /** data-testid forwarded to the inner <input> (used by screenshot specs). */
  inputTestId?: string
}

// `value`, `onChange`, `error`, `helperText`, and the inner maxLength are
// managed here.
type Props = Omit<
  TextFieldProps,
  'value' | 'onChange' | 'error' | 'helperText'
> &
  OwnProps

/**
 * Uncontrolled-style TextField for a two-character SAM tag (e.g. HP, RG, XS).
 * Owns the input text internally; emits the tag string when valid (or
 * undefined) to the parent. Caps input at two characters and shows an inline
 * error once two invalid characters are entered.
 */
export default function TagTextField(props: Props) {
  const {
    defaultValue = '',
    onValueChange,
    helperText = '2 characters, e.g. XS, HP, RG',
    inputTestId,
    ...rest
  } = props
  const [text, setText] = useState(defaultValue)
  const showError = text.length === 2 && !isValidTag(text)

  return (
    <TextField
      label="Tag name"
      {...rest}
      value={text}
      error={showError}
      helperText={showError ? 'Not a valid tag' : helperText}
      autoComplete="off"
      slotProps={{
        htmlInput: {
          maxLength: 2,
          'data-testid': inputTestId,
        },
      }}
      onChange={event => {
        const next = event.target.value
        setText(next)
        onValueChange(isValidTag(next) ? next : undefined)
      }}
    />
  )
}
