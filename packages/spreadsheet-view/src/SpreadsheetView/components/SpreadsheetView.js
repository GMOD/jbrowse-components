export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { Icon, IconButton } = jbrequire('@material-ui/core')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const Typography = jbrequire('@material-ui/core/Typography')
  const Grid = jbrequire('@material-ui/core/Grid')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')

  const ImportWizard = jbrequire(require('./ImportWizard'))
  const Spreadsheet = jbrequire(require('./Spreadsheet'))

  const headerHeight = 48
  const statusBarHeight = 20

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
        margin: 0,
        // background: '#eee',
        // borderBottom: '1px solid #a2a2a2',
      },
      rowCount: {
        marginLeft: theme.spacing(1),
      },
      statusBar: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: statusBarHeight,
        width: '100%',
        background: '#fafafa',
        boxSizing: 'border-box',
        borderTop: '1px outset #b1b1b1',
        paddingLeft: theme.spacing(1),
      },
    }
  })

  const Controls = observer(({ model }) => {
    const classes = useStyles()
    return (
      <Grid
        className={classes.header}
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
            data-testid="spreadsheet_view_close"
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>

          <IconButton
            onClick={() => model.setImportMode()}
            className={classes.iconButton}
            title="open a tabular file"
            data-testid="spreadsheet_view_open"
          >
            <Icon fontSize="small">folder_open</Icon>
          </IconButton>
        </Grid>
      </Grid>
    )
  })

  function SpreadsheetView({ model }) {
    const classes = useStyles()

    return (
      <div
        className={classes.root}
        style={{ height: model.height, width: model.width }}
        data-testid={model.configuration.configId}
      >
        <Controls model={model} />

        <span style={{ display: model.mode === 'import' ? undefined : 'none' }}>
          <ImportWizard model={model.importWizard} />
        </span>
        <div
          style={{
            position: 'relative',
            top: model.mode === 'display' ? undefined : model.height,
          }}
        >
          <Spreadsheet
            model={model.spreadsheet}
            height={model.height - headerHeight - statusBarHeight}
          />
        </div>

        <div
          className={classes.statusBar}
          style={{ display: model.mode === 'display' ? undefined : 'none' }}
        >
          {model.spreadsheet && model.spreadsheet.rowSet.isLoaded
            ? `${model.spreadsheet.rowSet.rows.length} rows`
            : null}
        </div>
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
