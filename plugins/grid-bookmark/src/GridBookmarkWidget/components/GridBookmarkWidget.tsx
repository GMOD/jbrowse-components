import React, { useEffect } from 'react'
import { observer } from 'mobx-react'
import { Alert, Card } from '@mui/material'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

// locals
import BookmarkGrid from './BookmarkGrid'
import DeleteBookmarks from './DeleteBookmarks'
import ExportBookmarks from './ExportBookmarks'
import ImportBookmarks from './ImportBookmarks'
import AssemblySelector from './AssemblySelector'

import { GridBookmarkModel } from '../model'

const useStyles = makeStyles()({
  card: {
    display: 'flex',
    flexFlow: 'column',
    margin: '5px',
    padding: '5px',
    gap: '5px',
  },
})

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const { classes } = useStyles()

  if (!model) {
    return null
  }

  return (
    <div className={classes.card}>
      <div>
        <ExportBookmarks model={model} />
        <ImportBookmarks model={model} />
        <DeleteBookmarks model={model} />
      </div>
      <Alert severity="info">
        Click or double click the <strong>label</strong> field to notate your
        bookmark.
      </Alert>
      <AssemblySelector model={model} />
      <BookmarkGrid model={model} />
    </div>
  )
}

export default observer(GridBookmarkWidget)
