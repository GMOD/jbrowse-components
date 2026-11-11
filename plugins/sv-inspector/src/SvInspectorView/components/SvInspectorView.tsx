import { ResizeHandle } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import ChordLegend from './ChordLegend.tsx'

import type { SvInspectorViewModel } from '../model.ts'

const useStyles = makeStyles()({
  viewsContainer: {
    display: 'flex',
  },
  container: {
    overflow: 'hidden',
  },
  circularPane: {
    position: 'relative',
  },
  circularPaneMenu: {
    position: 'absolute',
    top: 0,
    right: 0,
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
            <div
              className={classes.circularPane}
              style={{ width: model.circularView.width }}
            >
              <ChordLegend model={model}>
                <CircularViewReactComponent model={model.circularView} />
              </ChordLegend>
              <div className={classes.circularPaneMenu}>
                <CascadingMenuButton
                  tooltip="Circular view options"
                  data-testid="sv_inspector_circular_menu"
                  menuItems={() => model.circularViewMenuItems()}
                >
                  <MoreVertIcon />
                </CascadingMenuButton>
              </div>
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
