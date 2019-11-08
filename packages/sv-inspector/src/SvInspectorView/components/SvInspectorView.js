export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const Grid = jbrequire('@material-ui/core/Grid')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')
  const { grey } = jbrequire('@material-ui/core/colors')

  const headerHeight = 52

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
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
      spreadsheetViewContainer: {
        borderRight: [['1px', 'solid', grey[300]]],
        display: 'inline-block',
      },
      circularViewContainer: {
        display: 'inline-block',
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
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>

          <IconButton
            onClick={() => model.setImportMode()}
            className={classes.iconButton}
            title="open a tabular file"
            data-testid="sv_inspector_view_open"
          >
            <Icon fontSize="small">folder_open</Icon>
          </IconButton>
        </Grid>
      </Grid>
    )
  })

  function SvInspectorView({ model }) {
    const classes = useStyles()

    const {
      height,
      width,
      configuration,
      resizeHeight,
      dragHandleHeight,
      SpreadsheetViewReactComponent,
      CircularViewReactComponent,
      showCircularView,
    } = model

    return (
      <div
        className={classes.root}
        style={{ height, width }}
        data-testid={configuration.configId}
      >
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
            <div className={classes.circularViewContainer}>
              <CircularViewReactComponent model={model.circularView} />
            </div>
          ) : null}
        </div>
        <ResizeHandle
          onDrag={resizeHeight}
          objectId={model.id}
          style={{
            height: dragHandleHeight,
            position: 'absolute',
            bottom: 0,
            left: 0,
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
