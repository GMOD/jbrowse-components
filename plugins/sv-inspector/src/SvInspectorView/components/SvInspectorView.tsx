import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ChordLegend from './ChordLegend.tsx'
import CircularViewOptions from './CircularViewOptions.tsx'

import type { SvInspectorViewModel } from '../model.ts'

const useStyles = makeStyles()({
  viewsContainer: {
    display: 'flex',
  },
  container: {
    overflow: 'hidden',
  },
})

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
              bar
              vertical
              onDrag={distance => {
                model.resizeSpreadsheetWidth(distance)
              }}
            />
            <div style={{ width: model.circularView.width }}>
              <CircularViewOptions svInspector={model} />
              <ChordLegend model={model}>
                <CircularViewReactComponent model={model.circularView} />
              </ChordLegend>
            </div>
          </>
        ) : null}
      </div>
      <ResizeHandle
        bar
        onDrag={distance => {
          model.resizeHeight(distance)
        }}
      />
    </div>
  )
})

export default SvInspectorView
