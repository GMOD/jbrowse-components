import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { Alert, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { DEFAULT_HIGHLIGHT } from '../../model.ts'

import type { GridBookmarkModel } from '../../model.ts'

const EditHighlightColorDialog = observer(function EditHighlightColorDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { selectedBookmarks } = model
  const editNone = selectedBookmarks.length === 0
  const [color, setColor] = useState(
    selectedBookmarks[0]?.highlight ?? DEFAULT_HIGHLIGHT,
  )

  return (
    <SubmitDialog
      open
      title="Highlight bookmarks"
      onCancel={onClose}
      submitText="Confirm"
      submitDisabled={editNone}
      onSubmit={() => {
        model.updateBulkBookmarkHighlights(color)
        onClose()
      }}
    >
      <Typography variant="h6">Bulk highlight selector</Typography>
      <Alert severity="info">
        {editNone ? (
          <span>
            Use the checkboxes to select individual bookmarks to edit.
          </span>
        ) : (
          'Only selected bookmarks will be edited.'
        )}
      </Alert>
      {!editNone ? (
        <ColorPicker
          color={color}
          onChange={event => {
            setColor(event)
          }}
        />
      ) : null}
    </SubmitDialog>
  )
})

export default EditHighlightColorDialog
