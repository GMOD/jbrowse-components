import React, { Suspense, lazy, useState } from 'react'
import { Button } from '@mui/material'

// icons
import EditIcon from '@mui/icons-material/Edit'

// locals
import { GridBookmarkModel } from '../model'
const EditBookmarksDialog = lazy(() => import('./EditBookmarksDialog'))

function EditBookmarks({ model }: { model: GridBookmarkModel }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        startIcon={<EditIcon />}
        aria-label="edit bookmarks"
        onClick={() => setOpen(true)}
      >
        Highlight
      </Button>
      {open ? (
        <Suspense fallback={<React.Fragment />}>
          <EditBookmarksDialog model={model} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}

export default EditBookmarks
