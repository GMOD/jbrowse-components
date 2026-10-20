import { useState } from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { TextFieldProps } from '@mui/material'

function valueOf(text: string) {
  const trimmed = text.trim()
  const n = Number(trimmed)
  return trimmed === '' ? undefined : Number.isFinite(n) ? n : trimmed
}

/**
 * A number the plot holds, typed as text: the field keeps what is typed, so
 * `-`, `0.` and the first letters of a `word` stay on screen, and hands the
 * plot only an empty value, a finite number or one of `words`.
 */
const DraftNumberField = observer(function DraftNumberField({
  value,
  words = [],
  onCommit,
  ...rest
}: Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'error'> & {
  value: string
  words?: readonly string[]
  onCommit: (text: string) => void
}) {
  const [text, setText] = useState(value)
  const [held, setHeld] = useState(value)
  if (value !== held) {
    setHeld(value)
    if (valueOf(text) !== valueOf(value)) {
      setText(value)
    }
  }
  const accepted = (next: string) =>
    words.includes(next) || typeof valueOf(next) !== 'string'
  return (
    <TextField
      {...rest}
      value={text}
      error={!accepted(text)}
      autoComplete="off"
      onChange={event => {
        const next = event.target.value
        setText(next)
        if (accepted(next)) {
          onCommit(next.trim())
        }
      }}
    />
  )
})

export default DraftNumberField
