import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import SpreadsheetDataGrid from './SpreadsheetDataGrid.tsx'

import type { SpreadsheetViewModel } from '../SpreadsheetViewModel.ts'

const useStyles = makeStyles()(theme => ({
  contentArea: {
    overflow: 'auto',
    position: 'relative',
    marginBottom: theme.spacing(1),
    background: theme.palette.background.paper,
  },
}))

const SpreadsheetViewActual = observer(function SpreadsheetViewActual({
  model,
}: {
  model: SpreadsheetViewModel
}) {
  const { classes } = useStyles()
  const { spreadsheet, hideVerticalResizeHandle, height } = model
  return spreadsheet ? (
    <>
      <div style={{ height }} className={classes.contentArea}>
        <SpreadsheetDataGrid model={spreadsheet} />
      </div>
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          bar
          onDrag={delta => model.setHeight(height - delta)}
        />
      )}
    </>
  ) : null
})

export default SpreadsheetViewActual
