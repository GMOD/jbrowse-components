import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import CircularViewOptions from './CircularViewOptions'

import type { SvInspectorViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  resizeHandleVert: {
    background: theme.palette.action.selected,
    width: 4,
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
  resizeHandleHoriz: {
    background: theme.palette.action.selected,
    height: 4,
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
  viewsContainer: {
    display: 'flex',
  },
  container: {
    overflow: 'hidden',
  },
}))

const SvInspectorView = observer(function SvInspectorView({
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
          style={{
            width: model.spreadsheetView.width,
          }}
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
