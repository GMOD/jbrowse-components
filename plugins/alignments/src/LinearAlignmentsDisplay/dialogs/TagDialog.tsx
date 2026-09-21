import { useState } from 'react'

import { SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAG_PICKS } from '../../shared/commonTags.ts'

import type { TagColorScale } from '../../shared/types.ts'

// Collects one read tag name for whatever the caller does with it: color by it,
// or sort by it at the center line or at a clicked column. `initialTag` is the
// tag in use, so reopening tweaks the setting rather than resetting it. A
// caller passing `colorScale` also asks how the tag colours.
const TagDialog = observer(function TagDialog({
  title,
  prompt,
  initialTag,
  colorScale,
  onSubmit,
  handleClose,
}: {
  title: string
  prompt: string
  initialTag: string | undefined
  colorScale?: TagColorScale | undefined
  onSubmit: (tag: string, colorScale: TagColorScale | undefined) => void
  handleClose: () => void
}) {
  const [tag, setTag] = useState(initialTag)
  const [scale, setScale] = useState(colorScale)
  return (
    <SubmitDialog
      open
      title={title}
      submitDisabled={tag === undefined}
      onCancel={handleClose}
      onSubmit={() => {
        if (tag !== undefined) {
          onSubmit(tag, scale)
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
      {scale === undefined ? null : (
        <RadioGroup
          row
          aria-label="Color as"
          value={scale}
          onChange={event => {
            setScale(event.target.value === 'linear' ? 'linear' : 'categorical')
          }}
        >
          <FormControlLabel
            value="categorical"
            control={<Radio />}
            label="A color per value"
          />
          <FormControlLabel
            value="linear"
            control={<Radio />}
            label="A gradient over numbers"
          />
        </RadioGroup>
      )}
    </SubmitDialog>
  )
})

export default TagDialog
