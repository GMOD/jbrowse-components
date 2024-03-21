import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import { SvInspectorViewModel } from '../models/SvInspectorView'
import CircularViewOptions from './CircularViewOptions'

const useStyles = makeStyles()(theme => ({
  container: {
    overflow: 'hidden',
  },
  resizeHandleHoriz: {
    background: theme.palette.action.selected,
    borderTop: '1px solid #fafafa',
    boxSizing: 'border-box',
    height: 4,
  },
  resizeHandleVert: {
    background: theme.palette.action.selected,
    borderTop: '1px solid #fafafa',
    boxSizing: 'border-box',
    width: 4,
  },
  viewControls: {
    margin: 0,
  },
  viewsContainer: {
    display: 'flex',
  },
}))

const SvInspectorView = observer(function ({
  model,
}: {
  model: SvInspectorViewModel
}) {
  const { classes } = useStyles()

  const {
    SpreadsheetViewReactComponent,
    CircularViewReactComponent,
    showCircularView,
  } = model

  return (
    <div className={classes.container}>
      <div className={classes.viewsContainer}>
        <div
          style={{ width: model.spreadsheetView.width }}
          className={classes.container}
        >
          <SpreadsheetViewReactComponent model={model.spreadsheetView} />
        </div>

        {showCircularView ? (
          <>
            <ResizeHandle
              onDrag={distance => {
                const ret1 = model.circularView.resizeWidth(-distance)
                return model.spreadsheetView.resizeWidth(-ret1)
              }}
              vertical
              flexbox
              className={classes.resizeHandleVert}
            />
            <div style={{ width: model.circularView.width }}>
              <CircularViewOptions svInspector={model} />
              <CircularViewReactComponent model={model.circularView} />
            </div>
          </>
        ) : null}
      </div>
      <ResizeHandle
        onDrag={model.resizeHeight}
        className={classes.resizeHandleHoriz}
      />
    </div>
  )
})

export default SvInspectorView
