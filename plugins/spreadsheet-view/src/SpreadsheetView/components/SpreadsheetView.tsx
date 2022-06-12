import React from 'react'
import { FormGroup, Grid, IconButton, TablePagination } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import { ResizeHandle } from '@jbrowse/core/ui'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

import ImportWizard from './ImportWizard'
import Spreadsheet from './Spreadsheet'
import SpreadsheetStateModel from '../models/Spreadsheet'
import SpreadsheetStateViewModel from '../models/SpreadsheetView'

import GlobalFilterControls from './GlobalFilterControls'
import ColumnFilterControls from './ColumnFilterControls'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>
type SpreadsheetViewModel = Instance<typeof SpreadsheetStateViewModel>

const headerHeight = 52
const colFilterHeight = 46
const statusBarHeight = 40

const useStyles = makeStyles()(theme => ({
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
    paddingLeft: theme.spacing(1),
  },
  contentArea: { overflow: 'auto' },
  columnFilter: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    height: headerHeight,
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
    boxSizing: 'border-box',
    borderTop: '1px outset #b1b1b1',
    paddingLeft: theme.spacing(1),
  },
  verticallyCenter: {
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  spacer: {
    flexGrow: 1,
  },
  textFilterControlAdornment: { marginRight: '-18px' },
}))

const ViewControls = observer(({ model }: { model: SpreadsheetViewModel }) => {
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
          data-testid="spreadsheet_view_open"
          color="secondary"
        >
          <FolderOpenIcon />
        </IconButton>
      </Grid>
    </Grid>
  )
})

const RowCountMessage = observer(
  ({ spreadsheet }: { spreadsheet: SpreadsheetModel }) => {
    if (spreadsheet.rowSet.isLoaded) {
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
      return <>{rowMessage}</>
    }
    return null
  },
)

const SpreadsheetView = observer(
  ({ model }: { model: SpreadsheetViewModel }) => {
    const { classes } = useStyles()

    const { spreadsheet, filterControls } = model

    const colFilterCount = filterControls.columnFilters.length
    const [page, setPage] = React.useState(0)
    const [rowsPerPage, setRowsPerPage] = React.useState(100)

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
            {spreadsheet ? (
              <Spreadsheet
                page={page}
                rowsPerPage={rowsPerPage}
                model={spreadsheet}
                height={
                  model.height -
                  headerHeight -
                  colFilterCount * colFilterHeight -
                  statusBarHeight
                }
              />
            ) : null}
          </div>
        </div>

        <div
          className={classes.statusBar}
          style={{ display: model.mode === 'display' ? undefined : 'none' }}
        >
          {spreadsheet ? (
            <FormGroup row>
              <div className={classes.verticallyCenter}>
                <RowCountMessage spreadsheet={spreadsheet} />
              </div>
              <div className={classes.spacer} />
              <TablePagination
                rowsPerPageOptions={[10, 25, 100, 1000]}
                count={spreadsheet.rowSet.count}
                component="div"
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={event => {
                  setRowsPerPage(+event.target.value)
                  setPage(0)
                }}
              />
              <div className={classes.spacer} />
            </FormGroup>
          ) : null}
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
  },
)

export default SpreadsheetView
