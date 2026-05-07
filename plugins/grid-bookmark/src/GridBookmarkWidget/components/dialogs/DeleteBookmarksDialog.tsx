import { ConfirmDialog } from '@jbrowse/core/ui'
import { Alert } from '@mui/material'
import { observer } from 'mobx-react'

import type { GridBookmarkModel } from '../../model.ts'

const DeleteBookmarksDialog = observer(function DeleteBookmarksDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { selectedBookmarks } = model
  const deleteAll = selectedBookmarks.length === 0

  return (
    <ConfirmDialog
      open
      title="Delete bookmarks"
      submitText="Delete"
      onCancel={onClose}
      onSubmit={() => {
        if (deleteAll) {
          model.clearAllBookmarks()
        }
        model.clearSelectedBookmarks()
        onClose()
      }}
    >
      <Alert severity="warning">
        {deleteAll ? (
          <>
            <span>All bookmarks will be deleted.</span>
            <br />
            <span>
              Use the checkboxes to select individual bookmarks to delete.
            </span>
          </>
        ) : (
          'Only selected bookmarks will be deleted.'
        )}
      </Alert>
    </ConfirmDialog>
  )
})

export default DeleteBookmarksDialog
