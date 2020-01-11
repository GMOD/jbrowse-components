export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const Grid = jbrequire('@material-ui/core/Grid')
  const { ResizeHandle } = jbrequire('@gmod/jbrowse-core/ui')

  const ImportWizard = jbrequire(require('./ImportWizard'))
  const Spreadsheet = jbrequire(require('./Spreadsheet'))
  const GlobalFilterControls = jbrequire(require('./GlobalFilterControls'))
  const ColumnFilterControls = jbrequire(require('./ColumnFilterControls'))

  const headerHeight = 52
  const colFilterHeight = 46
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
        // background: '#eee',
        // borderBottom: '1px solid #a2a2a2',
        paddingLeft: theme.spacing(1),
      },
      contentArea: { overflow: 'auto' },
      columnFilter: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        height: headerHeight,
        // background: '#eee',
        // borderBottom: '1px solid #a2a2a2',
        paddingLeft: theme.spacing(1),
      },
      viewControls: {
        margin: 0,
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
      textFilterControlAdornment: { marginRight: '-18px' },
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
            data-testid="spreadsheet_view_close"
            color="secondary"
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>

          <IconButton
            onClick={() => model.setImportMode()}
            className={classes.iconButton}
            title="open a tabular file"
            data-testid="spreadsheet_view_open"
            color="secondary"
          >
            <Icon fontSize="small">folder_open</Icon>
          </IconButton>
        </Grid>
      </Grid>
    )
  })

  const RowCountMessage = observer(({ spreadsheet }) => {
    if (spreadsheet && spreadsheet.rowSet.isLoaded) {
      const {
        passingFiltersCount,
        count,
        selectedCount,
        selectedAndPassingFiltersCount,
      } = spreadsheet.rowSet

      let rowMessage
      if (passingFiltersCount !== count) {
        rowMessage = `${spreadsheet.rowSet.passingFiltersCount} rows of ${spreadsheet.rowSet.count} total`
        if (selectedCount) {
          rowMessage += `, ${selectedAndPassingFiltersCount} selected`
          const selectedAndNotPassingFiltersCount =
            selectedCount - selectedAndPassingFiltersCount
          if (selectedAndNotPassingFiltersCount) {
            rowMessage += ` (${selectedAndNotPassingFiltersCount} selected rows do not pass filters)`
          }
        }
      } else {
        rowMessage = `${spreadsheet.rowSet.count} rows`
        if (selectedCount) {
          rowMessage += `, ${selectedCount} selected`
        }
      }
      return rowMessage
    }
    return null
  })

  function SpreadsheetView({ model }) {
    const classes = useStyles()

    const { spreadsheet, filterControls } = model

    const colFilterCount = filterControls.columnFilters.length

    return (
      <div
        className={classes.root}
        style={{ height: model.height, width: model.width }}
        data-testid={model.id}
      >
        <Grid container direction="row" className={classes.header}>
          {model.hideViewControls ? null : (
            <Grid item>
              <ViewControls model={model} />
            </Grid>
          )}
          {model.mode !== 'display' || model.hideFilterControls ? null : (
            <Grid item>
              <GlobalFilterControls model={model} />
            </Grid>
          )}
        </Grid>

        {model.mode !== 'display' || model.hideFilterControls
          ? null
          : model.filterControls.columnFilters.map((filter, filterNumber) => {
              return (
                <ColumnFilterControls
                  key={`${filter.columnNumber}-${filterNumber}`}
                  viewModel={model}
                  filterModel={filter}
                  columnNumber={filter.columnNumber}
                  height={colFilterHeight}
                />
              )
            })}

        <div
          className={classes.contentArea}
          style={{ height: model.height - headerHeight }}
        >
          {model.mode !== 'import' ? null : (
            <ImportWizard model={model.importWizard} />
          )}
          <div
            style={{
              position: 'relative',
              display: model.mode === 'display' ? undefined : 'none',
            }}
          >
            <Spreadsheet
              model={spreadsheet}
              height={
                model.height -
                headerHeight -
                colFilterCount * colFilterHeight -
                statusBarHeight
              }
            />
          </div>
        </div>

        <div
          className={classes.statusBar}
          style={{ display: model.mode === 'display' ? undefined : 'none' }}
        >
          <RowCountMessage spreadsheet={spreadsheet} />
        </div>
        {model.hideVerticalResizeHandle ? null : (
          <ResizeHandle
            onDrag={model.resizeHeight}
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
        )}
      </div>
    )
  }
  SpreadsheetView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(SpreadsheetView)
}
