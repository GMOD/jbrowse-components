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
              value={model.subviewWidths.spreadsheet}
              onChange={width => {
                model.resizeSpreadsheetWidth(
                  width - model.subviewWidths.spreadsheet,
                )
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
        grip
        value={model.height}
        onChange={height => model.setHeight(height)}
      />
    </div>
  )
})

export default SvInspectorView
