import { useState } from 'react'

import { SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAG_PICKS } from '../../shared/commonTags.ts'

// Collects one read tag name for whatever the caller does with it: color by it,
// or sort by it at the center line or at a clicked column. `initialTag` is the
// tag in use, so reopening tweaks the setting rather than resetting it.
const TagDialog = observer(function TagDialog({
  title,
  prompt,
  initialTag,
  onSubmit,
  handleClose,
}: {
  title: string
  prompt: string
  initialTag: string | undefined
  onSubmit: (tag: string) => void
  handleClose: () => void
}) {
  const [tag, setTag] = useState(initialTag)
  return (
    <SubmitDialog
      open
      title={title}
      submitDisabled={tag === undefined}
      onCancel={handleClose}
      onSubmit={() => {
        if (tag !== undefined) {
          onSubmit(tag)
          handleClose()
        }
      }}
    >
      <Typography>{prompt}</Typography>
      <TagTextField
        autoFocus
        defaultValue={initialTag}
        quickPicks={COMMON_READ_TAG_PICKS}
        onValueChange={setTag}
      />
    </SubmitDialog>
  )
})

export default TagDialog
