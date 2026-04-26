import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

interface Tag {
  type: string
  tag: string
}

const ColorByTagDialog = observer(function ColorByTagDialog({
  model,
  handleClose,
}: {
  model: {
    setColorScheme: (arg: Tag) => void
  }
  handleClose: () => void
}) {
  const [tag, setTag] = useState('')
  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)

  return (
    <SubmitDialog
      open
      title="Color by tag"
      submitDisabled={!validTag}
      onCancel={handleClose}
      onSubmit={() => {
        model.setColorScheme({ type: 'tag', tag })
        handleClose()
      }}
    >
      <Typography>Enter tag to color by:</Typography>
      <TextField
        value={tag}
        autoFocus
        onChange={event => {
          setTag(event.target.value)
        }}
        label="Tag name"
        helperText={
          tag.length === 2 && !validTag
            ? 'Not a valid tag'
            : '2 characters, e.g. XS, ts, HP, RG'
        }
        error={tag.length === 2 && !validTag}
        autoComplete="off"
        slotProps={{
          htmlInput: { maxLength: 2 },
        }}
      />
    </SubmitDialog>
  )
})

export default ColorByTagDialog
