import React, { Suspense, lazy, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import Spreadsheet from './Spreadsheet'
import { SpreadsheetViewModel } from '../models/SpreadsheetView'

const ImportWizard = lazy(() => import('./ImportWizard'))

const useStyles = makeStyles()(theme => ({
  contentArea: {
    overflow: 'auto',
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
  return (
    <>
      <div style={{ height }} className={classes.contentArea}>
        <Spreadsheet model={spreadsheet} />
      </div>
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          onMouseDown={() => setInitialHeight(height)}
          onDrag={(_, dist) => model.setHeight(initialHeight - dist)}
          className={classes.resizeHandle}
        />
      )}
    </>
  )
})

const SpreadsheetContainer = observer(function ({
  model,
}: {
  model: SpreadsheetViewModel
}) {
  return !model.initialized ? (
    <Suspense fallback={null}>
      <ImportWizard model={model.importWizard} />
    </Suspense>
  ) : (
    <SpreadsheetView model={model} />
  )
})

export default SpreadsheetContainer
