import React, { Suspense, lazy, useState } from 'react'

import { Button } from '@mui/material'

import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'

// locals
import { GridBookmarkModel } from '../model'
const ShareBookmarksDialog = lazy(() => import('./ShareBookmarksDialog'))

function ShareBookmarks({ model }: { model: GridBookmarkModel }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button startIcon={<ContentCopyIcon />} onClick={() => setOpen(true)}>
        Share
      </Button>
      {open ? (
        <Suspense fallback={<React.Fragment />}>
          <ShareBookmarksDialog onClose={() => setOpen(false)} model={model} />
        </Suspense>
      ) : null}
    </>
  )
}

export default ShareBookmarks
