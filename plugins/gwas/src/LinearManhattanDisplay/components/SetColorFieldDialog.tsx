import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import TextField from '@mui/material/TextField'
import { observer } from 'mobx-react'

// Free text rather than a pick list: the fields a file carries are only known
// once its features are, and a BED extra column or GFF attribute is named by
// whoever wrote the file. Submitting switches the scheme to field coloring in
// the same action, so one refetch colors the points and derives the key.
const SetColorFieldDialog = observer(function SetColorFieldDialog({
  display,
  handleClose,
}: {
  display: {
    colorField: string
    colorByField: (field: string) => void
  }
  handleClose: () => void
}) {
  const [value, setValue] = useState(display.colorField)
  const field = value.trim()

  return (
    <SubmitDialog
      open
      title="Color by field"
      onCancel={handleClose}
      submitDisabled={field === ''}
      onSubmit={() => {
        display.colorByField(field)
        handleClose()
      }}
    >
      <TextField
        autoFocus
        fullWidth
        label="Feature field"
        helperText="Each distinct value of this field takes its own color, e.g. name, refName, or a column of the file"
        value={value}
        onChange={event => {
          setValue(event.target.value)
        }}
      />
    </SubmitDialog>
  )
})

export default SetColorFieldDialog
