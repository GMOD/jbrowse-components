import { useState } from 'react'

import { SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAG_PICKS } from '../../shared/commonTags.ts'

// Decoupled from where the sort anchors: the track menu passes an onSubmit that
// sorts at the center line, the read right-click menu one that sorts at the
// clicked column. The dialog only collects the tag name.
//
// `initialTag` is the tag currently sorted on, so reopening tweaks the sort
// rather than resetting it — the same pre-fill ColorByTagDialog and
// GroupByDialog do from their own slots. This one can't read it off a model
// (it deliberately takes no model), so both call sites pass it in; without it
// the menu row reads "Tag (HP)..." and opens an empty field.
const SortByTagDialog = observer(function SortByTagDialog(props: {
  onSubmit: (tag: string) => void
  handleClose: () => void
  initialTag?: string
}) {
  const { onSubmit, handleClose, initialTag } = props
  const [tag, setTag] = useState<string | undefined>(initialTag)
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
        defaultValue={initialTag}
        quickPicks={COMMON_READ_TAG_PICKS}
        onValueChange={setTag}
        data-testid="sort-tag-name"
        inputTestId="sort-tag-name-input"
      />
    </SubmitDialog>
  )
})

export default SortByTagDialog
