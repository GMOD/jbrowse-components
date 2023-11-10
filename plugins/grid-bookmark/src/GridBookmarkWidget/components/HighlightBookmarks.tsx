import React, { Suspense, lazy, useState } from 'react'
import { Button } from '@mui/material'

// icons
import EditIcon from '@mui/icons-material/Edit'

// locals
import { GridBookmarkModel } from '../model'
const HighlightBookmarksDialog = lazy(
  () => import('./HighlightBookmarksDialog'),
)

function HighlightBookmarks({ model }: { model: GridBookmarkModel }) {
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
          <HighlightBookmarksDialog
            model={model}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  )
}

export default HighlightBookmarks
