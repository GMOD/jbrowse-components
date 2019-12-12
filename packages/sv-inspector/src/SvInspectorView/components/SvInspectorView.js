export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const Grid = jbrequire('@material-ui/core/Grid')
  const FormControlLabel = jbrequire('@material-ui/core/FormControlLabel')
  const Checkbox = jbrequire('@material-ui/core/Checkbox')
  const { ResizeHandle } = jbrequire('@gmod/jbrowse-core/ui')
  const { grey } = jbrequire('@material-ui/core/colors')

  const headerHeight = 52

  const style = {
    width: 4,
    background: '#ccc',
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  }
  const useStyles = makeStyles(theme => {
    return {
      root: {
        marginBottom: theme.spacing(1),
        background: 'white',
        overflow: 'hidden',
      },
      header: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        height: headerHeight,
        background: grey[200],
        // borderBottom: '1px solid #a2a2a2',
      },
      viewControls: {
        margin: 0,
      },
      viewsContainer: {
        display: 'flex',
      },
      spreadsheetViewContainer: {
        borderRight: [['1px', 'solid', grey[400]]],
        overflow: 'hidden',
      },
      circularViewOptions: {
        padding: theme.spacing(1),
        background: grey[200],
      },
    }
  })

  const ViewControls = observer(({ model }) => {
    const classes = useStyles()
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
            onClick={model.closeView}
            className={classes.iconButton}
            title="close this view"
            data-testid="sv_inspector_view_close"
            color="secondary"
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>

          <IconButton
            onClick={() => model.setImportMode()}
            className={classes.iconButton}
            title="open a tabular file"
            data-testid="sv_inspector_view_open"
            color="secondary"
          >
            <Icon fontSize="small">folder_open</Icon>
          </IconButton>
        </Grid>
      </Grid>
    )
  })

  const CircularViewOptions = observer(({ svInspector }) => {
    const classes = useStyles()

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
                className={classes.rowSelector}
                checked={svInspector.onlyDisplayRelevantRegionsInCircularView}
                onClick={evt =>
                  svInspector.setOnlyDisplayRelevantRegionsInCircularView(
                    evt.target.checked,
                  )
                }
                size="small"
              />
            }
            label="show only regions with data"
          />
        </Grid>
      </Grid>
    )
  })

  function SvInspectorView({ model }) {
    const classes = useStyles()

    const {
      configuration,
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
                style={style}
              />
              <div
                className={classes.circularViewContainer}
                style={{ width: model.circularView.width }}
              >
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
  SvInspectorView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(SvInspectorView)
}
