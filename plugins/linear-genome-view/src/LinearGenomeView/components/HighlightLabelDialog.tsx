import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

// Names a highlight. The label is written on the band and in every view that
// draws the session's highlights, such as an alignment's column or a
// structure's residue; an empty label leaves the highlight unnamed.
const HighlightLabelDialog = observer(function HighlightLabelDialog({
  label,
  onSubmit,
  handleClose,
}: {
  label?: string
  onSubmit: (label: string | undefined) => void
  handleClose: () => void
}) {
  const [val, setVal] = useState(label ?? '')
  return (
    <SubmitDialog
      open
      maxWidth="xs"
      fullWidth
      title="Edit highlight label"
      onCancel={handleClose}
      onSubmit={() => {
        onSubmit(val.trim() || undefined)
        handleClose()
      }}
    >
      <TextField
        label="Label"
        autoFocus
        fullWidth
        variant="outlined"
        value={val}
        onChange={event => {
          setVal(event.target.value)
        }}
      />
    </SubmitDialog>
  )
})

export default HighlightLabelDialog
