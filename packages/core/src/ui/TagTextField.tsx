import { useState } from 'react'

import { Chip, Stack, TextField } from '@mui/material'

import { isValidTag } from '../util/tags.ts'

import type { TextFieldProps } from '@mui/material'

/** A quick-pick shortcut: the two-character tag plus a human label. */
export interface TagQuickPick {
  tag: string
  label?: string
}

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
  /**
   * One-click shortcuts for common tags (e.g. HP, RG) shown as chips above the
   * field, so users don't have to know and type the two-letter code. Clicking a
   * chip fills the field and emits the value exactly as typing it would.
   */
  quickPicks?: TagQuickPick[]
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
 * error once two invalid characters are entered. Optional `quickPicks` render a
 * chip row of common tags that fill the field on click.
 */
export default function TagTextField(props: Props) {
  const {
    defaultValue = '',
    onValueChange,
    helperText = '2 characters, e.g. XS, HP, RG',
    inputTestId,
    quickPicks,
    ...rest
  } = props
  const [text, setText] = useState(defaultValue)
  const showError = text.length === 2 && !isValidTag(text)

  // Both a chip click and typing flow through here so the two paths can't
  // disagree about validation or what gets emitted.
  const setValue = (next: string) => {
    setText(next)
    onValueChange(isValidTag(next) ? next : undefined)
  }

  return (
    <Stack spacing={1}>
      {quickPicks?.length ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {quickPicks.map(({ tag, label }) => (
            <Chip
              key={tag}
              size="small"
              label={label ? `${tag} — ${label}` : tag}
              color={text === tag ? 'primary' : 'default'}
              variant={text === tag ? 'filled' : 'outlined'}
              onClick={() => {
                setValue(tag)
              }}
            />
          ))}
        </Stack>
      ) : null}
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
          setValue(event.target.value)
        }}
      />
    </Stack>
  )
}
