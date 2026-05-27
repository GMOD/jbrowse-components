import { ConfirmDialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import BookmarkSelectionAlert from './BookmarkSelectionAlert.tsx'

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
        } else {
          model.clearSelectedBookmarks()
        }
        onClose()
      }}
    >
      <BookmarkSelectionAlert
        all={deleteAll}
        verb="deleted"
        severity="warning"
      />
    </ConfirmDialog>
  )
})

export default DeleteBookmarksDialog
