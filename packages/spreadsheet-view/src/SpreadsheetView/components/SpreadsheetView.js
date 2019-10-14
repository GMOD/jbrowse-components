export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { Icon, IconButton } = jbrequire('@material-ui/core')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')

  const ImportWizard = jbrequire(require('./ImportWizard'))
  const Spreadsheet = jbrequire(require('./Spreadsheet'))

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        background: 'white',
      },
      controls: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        background: '#eee',
        boxSizing: 'border-box',
        borderRight: '1px solid #a2a2a2',
        borderBottom: '1px solid #a2a2a2',
        left: 0,
        top: 0,
      },
    }
  })

  const Controls = observer(({ model }) => {
    const classes = useStyles()
    const rootModel = getRoot(model)

    return (
      <div className={classes.controls}>
        <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title="close this view"
          data-testid="spreadsheet_view_close"
        >
          <Icon fontSize="small">close</Icon>
        </IconButton>

        <IconButton
          onClick={model.zoomOutButton}
          className={classes.iconButton}
          title="zoom out"
        >
          <Icon fontSize="small">zoom_out</Icon>
        </IconButton>

        <IconButton
          onClick={model.zoomInButton}
          className={classes.iconButton}
          title="zoom in"
        >
          <Icon fontSize="small">zoom_in</Icon>
        </IconButton>

        <IconButton
          onClick={model.rotateCounterClockwiseButton}
          className={classes.iconButton}
          title="rotate counter-clockwise"
        >
          <Icon fontSize="small">rotate_left</Icon>
        </IconButton>

        <IconButton
          onClick={model.rotateClockwiseButton}
          className={classes.iconButton}
          title="rotate clockwise"
        >
          <Icon fontSize="small">rotate_right</Icon>
        </IconButton>

        <ToggleButton
          onClick={model.activateTrackSelector}
          title="select tracks"
          selected={
            rootModel.visibleDrawerWidget &&
            rootModel.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
            rootModel.visibleDrawerWidget.view.id === model.id
          }
          value="track_select"
          data-testid="spreadsheet_track_select"
        >
          <Icon fontSize="small">line_style</Icon>
        </ToggleButton>
      </div>
    )
  })

  function SpreadsheetView({ model }) {
    const classes = useStyles()

    let mode
    if (model.mode === 'import')
      mode = <ImportWizard model={model.importWizard} />
    else if (model.mode === 'spreadsheet')
      mode = <Spreadsheet model={model.spreadsheet} />

    return (
      <div
        className={classes.root}
        style={{ height: model.height, width: model.width }}
        data-testid={model.configuration.configId}
      >
        <Controls model={model} />

        {mode}

        <ResizeHandle
          onDrag={model.resizeHeight}
          objectId={model.id}
          style={{
            height: model.dragHandleHeight,
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
  SpreadsheetView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(SpreadsheetView)
}
