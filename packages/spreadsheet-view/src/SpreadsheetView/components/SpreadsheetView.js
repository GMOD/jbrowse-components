export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useEffect, useState } = React
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const InputAdornment = jbrequire('@material-ui/core/InputAdornment')
  const { useDebounce } = jbrequire('@gmod/jbrowse-core/util')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const TextField = jbrequire('@material-ui/core/TextField')
  const Grid = jbrequire('@material-ui/core/Grid')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')

  const ImportWizard = jbrequire(require('./ImportWizard'))
  const Spreadsheet = jbrequire(require('./Spreadsheet'))

  const headerHeight = 52
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

  const FilterControls = observer(({ model }) => {
    const classes = useStyles()
    const textFilter = model.filterControls.filters[0] || {}

    // this paragraph is silliness to debounce the text filter input
    const [textFilterValue, setTextFilterValue] = useState(
      textFilter.stringToFind,
    )
    const debouncedTextFilter = useDebounce(textFilterValue, 500)
    useEffect(() => {
      textFilter.setString(debouncedTextFilter)
    }, [debouncedTextFilter, textFilter])

    return (
      <div className={classes.filterControls}>
        <TextField
          label="text filter"
          value={textFilterValue}
          onChange={evt => setTextFilterValue(evt.target.value)}
          className={classes.textFilterControl}
          margin="dense"
          variant="outlined"
          InputProps={{
            endAdornment: (
              <InputAdornment
                className={classes.textFilterControlAdornment}
                position="end"
              >
                <IconButton
                  aria-label="clear filter"
                  onClick={() => setTextFilterValue('')}
                >
                  <Icon>clear</Icon>
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </div>
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

    const { spreadsheet } = model

    return (
      <div
        className={classes.root}
        style={{ height: model.height, width: model.width }}
        data-testid={model.configuration.configId}
      >
        <Grid container direction="row" className={classes.header}>
          {model.hideViewControls ? null : (
            <Grid item>
              <ViewControls model={model} />
            </Grid>
          )}
          {model.mode !== 'display' || model.hideFilterControls ? null : (
            <Grid item>
              <FilterControls model={model} />
            </Grid>
          )}
        </Grid>

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
            model={spreadsheet}
            height={model.height - headerHeight - statusBarHeight}
          />
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
        )}
      </div>
    )
  }
  SpreadsheetView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(SpreadsheetView)
}
