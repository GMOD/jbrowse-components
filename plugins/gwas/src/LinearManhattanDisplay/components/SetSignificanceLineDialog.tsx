import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import TextField from '@mui/material/TextField'
import { observer } from 'mobx-react'

// Free numeric entry rather than a slider: the threshold is on the plot's own
// score scale, which is a -log10(p) on a GWAS and an Fst (0-1) on a
// differentiation scan, so there is no range a control could span. Clearing the
// field removes the line, which is the same state the slot's `undefined` is.
const SetSignificanceLineDialog = observer(function SetSignificanceLineDialog({
  display,
  handleClose,
}: {
  display: {
    significanceLine: number | undefined
    setSignificanceLine: (n?: number) => void
  }
  handleClose: () => void
}) {
  const [value, setValue] = useState(
    display.significanceLine === undefined
      ? ''
      : String(display.significanceLine),
  )
  const trimmed = value.trim()
  // An empty field is valid and means "no line"; anything else has to parse,
  // or submitting would silently store NaN and draw nothing with no reason
  // given.
  const parsed = trimmed === '' ? undefined : Number(trimmed)
  const invalid = parsed !== undefined && !Number.isFinite(parsed)

  return (
    <SubmitDialog
      open
      title="Set significance line"
      onCancel={handleClose}
      submitDisabled={invalid}
      onSubmit={() => {
        display.setSignificanceLine(parsed)
        handleClose()
      }}
      onReset={() => {
        setValue('')
      }}
      resetText="Clear"
    >
      <TextField
        autoFocus
        fullWidth
        label="Score"
        helperText={
          invalid
            ? 'Enter a number, or clear the field to remove the line'
            : 'On the same scale as the plotted points. Leave empty for no line'
        }
        error={invalid}
        value={value}
        onChange={event => {
          setValue(event.target.value)
        }}
      />
    </SubmitDialog>
  )
})

export default SetSignificanceLineDialog
