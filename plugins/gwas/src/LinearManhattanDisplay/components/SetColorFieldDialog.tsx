import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import TextField from '@mui/material/TextField'
import { observer } from 'mobx-react'

import { LD_FIELD } from '../../GWASAdapter/ldFields.ts'

// free text: a file's fields are known only once its features are
const SetColorFieldDialog = observer(function SetColorFieldDialog({
  display,
  handleClose,
}: {
  display: {
    color: { field: string }
    colorByField: (field: string) => void
  }
  handleClose: () => void
}) {
  const [value, setValue] = useState(
    display.color.field === LD_FIELD ? '' : display.color.field,
  )
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
