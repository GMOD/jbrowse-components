import { useState } from 'react'

import { SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SortByTagDialog = observer(function SortByTagDialog(props: {
  model: {
    setSortedBy: (arg: string, arg2: string) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setTag] = useState<string | undefined>()
  return (
    <SubmitDialog
      open
      title="Sort by tag"
      submitDisabled={tag === undefined}
      onCancel={handleClose}
      onSubmit={() => {
        if (tag !== undefined) {
          model.setSortedBy('tag', tag)
          handleClose()
        }
      }}
    >
      <Typography>Set the tag to sort by</Typography>
      <TagTextField
        autoFocus
        onValueChange={setTag}
        data-testid="sort-tag-name"
        inputTestId="sort-tag-name-input"
      />
    </SubmitDialog>
  )
})

export default SortByTagDialog
