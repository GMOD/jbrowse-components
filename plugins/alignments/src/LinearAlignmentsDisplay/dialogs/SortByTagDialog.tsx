import { useState } from 'react'

import { SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAGS } from '../../shared/commonTags.ts'

// Decoupled from where the sort anchors: the track menu passes an onSubmit that
// sorts at the center line, the read right-click menu one that sorts at the
// clicked column. The dialog only collects the tag name.
const SortByTagDialog = observer(function SortByTagDialog(props: {
  onSubmit: (tag: string) => void
  handleClose: () => void
}) {
  const { onSubmit, handleClose } = props
  const [tag, setTag] = useState<string | undefined>()
  return (
    <SubmitDialog
      open
      title="Sort by tag"
      submitDisabled={tag === undefined}
      onCancel={handleClose}
      onSubmit={() => {
        if (tag !== undefined) {
          onSubmit(tag)
          handleClose()
        }
      }}
    >
      <Typography>Pick or enter a tag to sort by</Typography>
      <TagTextField
        autoFocus
        quickPicks={COMMON_READ_TAGS}
        onValueChange={setTag}
        data-testid="sort-tag-name"
        inputTestId="sort-tag-name-input"
      />
    </SubmitDialog>
  )
})

export default SortByTagDialog
