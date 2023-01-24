import React from 'react'
import { observer } from 'mobx-react'
import { IconButton, Grid, FormControlLabel, Checkbox } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import { SvInspectorViewModel } from '../models/SvInspectorView'

// icons
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

const headerHeight = 52

const useStyles = makeStyles()(theme => ({
  resizeHandle: {
    width: 4,
    background: theme.palette.action.selected,
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
  root: {
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  header: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    height: headerHeight,
  },
  viewControls: {
    margin: 0,
  },
  viewsContainer: {
    display: 'flex',
  },
  spreadsheetViewContainer: {
    borderRight: '1px solid #ccc',
    overflow: 'hidden',
  },
  circularViewOptions: {
    padding: theme.spacing(1),
  },
}))

const ViewControls = observer(({ model }: { model: SvInspectorViewModel }) => {
  const { classes } = useStyles()
  return (
    <Grid
      className={classes.viewControls}
      container
      spacing={1}
      direction="row"
      alignItems="center"
    >
      <Grid item>
        <IconButton
          onClick={() => model.setImportMode()}
          title="open a tabular file"
          data-testid="sv_inspector_view_open"
        >
          <FolderOpenIcon />
        </IconButton>
      </Grid>
    </Grid>
  )
})

const CircularViewOptions = observer(function ({
  svInspector,
}: {
  svInspector: SvInspectorViewModel
}) {
  const { classes } = useStyles()

  return (
    <Grid
      container
      className={classes.circularViewOptions}
      style={{ height: svInspector.circularViewOptionsBarHeight }}
    >
      <Grid item>
        <FormControlLabel
          control={
            <Checkbox
              checked={svInspector.onlyDisplayRelevantRegionsInCircularView}
              onChange={e =>
                svInspector.setOnlyDisplayRelevantRegionsInCircularView(
                  e.target.checked,
                )
              }
            />
          }
          label="show only regions with data"
        />
      </Grid>
    </Grid>
  )
})

function SvInspectorView({ model }: { model: SvInspectorViewModel }) {
  const { classes } = useStyles()

  const {
    resizeHeight,
    dragHandleHeight,
    SpreadsheetViewReactComponent,
    CircularViewReactComponent,
    showCircularView,
  } = model

  return (
    <div className={classes.root} data-testid={model.id}>
      <Grid container direction="row" className={classes.header}>
        <Grid item>
          <ViewControls model={model} />
        </Grid>
      </Grid>
      <div className={classes.viewsContainer}>
        <div className={classes.spreadsheetViewContainer}>
          <SpreadsheetViewReactComponent model={model.spreadsheetView} />
        </div>

        {showCircularView ? (
          <>
            <ResizeHandle
              onDrag={distance => {
                const ret1 = model.circularView.resizeWidth(-distance)
                const ret2 = model.spreadsheetView.resizeWidth(-ret1)
                return ret2
              }}
              vertical
              flexbox
              className={classes.resizeHandle}
            />
            <div style={{ width: model.circularView.width }}>
              <CircularViewOptions svInspector={model} />
              <CircularViewReactComponent model={model.circularView} />
            </div>
          </>
        ) : null}
      </div>
      <ResizeHandle
        onDrag={resizeHeight}
        style={{
          height: dragHandleHeight,
          background: '#ccc',
          boxSizing: 'border-box',
          borderTop: '1px solid #fafafa',
        }}
      />
    </div>
  )
}

export default observer(SvInspectorView)
