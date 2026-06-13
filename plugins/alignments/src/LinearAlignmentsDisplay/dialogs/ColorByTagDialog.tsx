import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { TAG_REGEX } from '../../shared/util.ts'

interface Tag {
  type: 'tag'
  tag: string
}

const ColorByTagDialog = observer(function ColorByTagDialog({
  model,
  handleClose,
}: {
  model: {
    colorBy?: { tag?: string }
    setColorScheme: (arg: Tag) => void
  }
  handleClose: () => void
}) {
  const [tag, setTag] = useState(model.colorBy?.tag ?? '')
  const validTag = TAG_REGEX.test(tag)

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
          htmlInput: {
            maxLength: 2,
          },
        }}
      />
    </SubmitDialog>
  )
})

export default ColorByTagDialog
