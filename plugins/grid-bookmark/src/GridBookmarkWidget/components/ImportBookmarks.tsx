import React, { useState, Suspense, lazy } from 'react'
import { observer } from 'mobx-react'
import { Button } from '@mui/material'

// icons
import ImportIcon from '@mui/icons-material/Publish'

// locals
import { GridBookmarkModel } from '../model'

const ImportBookmarksDialog = lazy(() => import('./ImportBookmarksDialog'))

const ImportBookmarks = observer(function ({
  model,
}: {
  model: GridBookmarkModel
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button startIcon={<ImportIcon />} onClick={() => setOpen(true)}>
        Import
      </Button>
      {open ? (
        <Suspense fallback={<React.Fragment />}>
          <ImportBookmarksDialog onClose={() => setOpen(false)} model={model} />
        </Suspense>
      ) : null}
    </>
  )
})

export default ImportBookmarks
