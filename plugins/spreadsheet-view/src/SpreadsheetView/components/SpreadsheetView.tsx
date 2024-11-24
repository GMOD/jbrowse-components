import React, { Suspense, lazy, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// types
import SpreadsheetDataGrid from './SpreadsheetDataGrid'

import type { SpreadsheetViewModel } from '../SpreadsheetViewModel'
// locals

const ImportWizard = lazy(() => import('./ImportWizard'))

const useStyles = makeStyles()(theme => ({
  contentArea: {
    overflow: 'auto',
    position: 'relative',
    marginBottom: theme.spacing(1),
    background: theme.palette.background.paper,
  },
  resizeHandle: {
    height: 5,
    boxSizing: 'border-box',
    background: theme.palette.action.disabled,
    borderTop: '1px solid #fafafa',
  },
}))

const SpreadsheetView = observer(function ({
  model,
}: {
  model: SpreadsheetViewModel
}) {
  const [initialHeight, setInitialHeight] = useState<number>(0)
  const { classes } = useStyles()
  const { spreadsheet, hideVerticalResizeHandle, height } = model
  return spreadsheet ? (
    <>
      <div style={{ height }} className={classes.contentArea}>
        <SpreadsheetDataGrid model={spreadsheet} />
      </div>
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          onMouseDown={() => {
            setInitialHeight(height)
          }}
          onDrag={(_, dist) => model.setHeight(initialHeight - dist)}
          className={classes.resizeHandle}
        />
      )}
    </>
  ) : (
    <div>Unknown</div>
  )
})

const SpreadsheetContainer = observer(function ({
  model,
}: {
  model: SpreadsheetViewModel
}) {
  return !model.spreadsheet?.initialized ? (
    <Suspense fallback={null}>
      <ImportWizard model={model.importWizard} />
    </Suspense>
  ) : (
    <SpreadsheetView model={model} />
  )
})

export default SpreadsheetContainer
