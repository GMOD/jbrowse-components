import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SortByTagDialog = observer(function SortByTagDialog(props: {
  model: {
    setSortedBy: (arg: string, arg2: string) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)
  return (
    <SubmitDialog
      open
      title="Sort by tag"
      onCancel={handleClose}
      onSubmit={() => {
        model.setSortedBy('tag', tag)
        handleClose()
      }}
    >
      <Typography>Set the tag to sort by</Typography>
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
            : '2 characters, e.g. HP or RG'
        }
        error={tag.length === 2 && !validTag}
        autoComplete="off"
        data-testid="sort-tag-name"
        slotProps={{
          htmlInput: {
            maxLength: 2,
            'data-testid': 'sort-tag-name-input',
          },
        }}
      />
    </SubmitDialog>
  )
})

export default SortByTagDialog
