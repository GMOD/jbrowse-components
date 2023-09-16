import React, { Suspense, lazy, useState } from 'react'
import { observer } from 'mobx-react'

import { Button } from '@mui/material'
import GetAppIcon from '@mui/icons-material/GetApp'

// locals
import { GridBookmarkModel } from '../model'

const ExportBookmarksDialog = lazy(() => import('./ExportBookmarksDialog'))

const ExportBookmarks = observer(function ExportBookmarks({
  model,
}: {
  model: GridBookmarkModel
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        startIcon={<GetAppIcon />}
        onClick={() => setOpen(true)}
        data-testid="export_button"
      >
        Export
      </Button>
      {open ? (
        <Suspense fallback={<React.Fragment />}>
          <ExportBookmarksDialog onClose={() => setOpen(false)} model={model} />
        </Suspense>
      ) : null}
    </>
  )
})

export default ExportBookmarks
