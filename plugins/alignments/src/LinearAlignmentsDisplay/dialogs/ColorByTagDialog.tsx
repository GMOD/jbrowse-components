import { useState } from 'react'

import { SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAGS } from '../../shared/commonTags.ts'

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
  const [tag, setTag] = useState<string | undefined>(model.colorBy?.tag)

  return (
    <SubmitDialog
      open
      title="Color by tag"
      submitDisabled={tag === undefined}
      onCancel={handleClose}
      onSubmit={() => {
        if (tag !== undefined) {
          model.setColorScheme({ type: 'tag', tag })
          handleClose()
        }
      }}
    >
      <Typography>Pick or enter a tag to color by:</Typography>
      <TagTextField
        defaultValue={model.colorBy?.tag}
        autoFocus
        quickPicks={COMMON_READ_TAGS}
        onValueChange={setTag}
      />
    </SubmitDialog>
  )
})

export default ColorByTagDialog
