import React, { Suspense, lazy, useState } from 'react'
import { Button } from '@mui/material'

// icons
import DeleteIcon from '@mui/icons-material/Delete'

// locals
import { GridBookmarkModel } from '../model'
const DeleteBookmarksDialog = lazy(() => import('./DeleteBookmarksDialog'))

function DeleteBookmarks({ model }: { model: GridBookmarkModel }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        startIcon={<DeleteIcon />}
        aria-label="clear bookmarks"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      {open ? (
        <Suspense fallback={<React.Fragment />}>
          <DeleteBookmarksDialog model={model} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}

export default DeleteBookmarks
