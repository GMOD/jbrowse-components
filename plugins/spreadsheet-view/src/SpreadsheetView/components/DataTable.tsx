import React, { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { getParent, Instance } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// icons
import CropFreeIcon from '@mui/icons-material/CropFree'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'

// locals
import SpreadsheetStateModel from '../models/Spreadsheet'
import RowStateModel from '../models/Row'
import ColumnMenu from './ColumnMenu'
import RowMenu from './RowMenu'
import DataRow from './DataRow'
import SortIndicator from './SortIndicator'
import { numToColName } from './util'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>
type RowModel = Instance<typeof RowStateModel>

interface ColMenu {
  colNumber: number
  anchorEl: HTMLElement
}

const useStyles = makeStyles()(theme => ({
  dataTable: {
    borderCollapse: 'collapse',
    borderSpacing: 0,
    boxSizing: 'border-box',
    '& td': {
      border: `1px solid ${theme.palette.action.disabledBackground}`,
      padding: '0.2rem',
      maxWidth: '50em',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },

  columnHead: {
    fontWeight: 'normal',
    background: theme.palette.mode === 'dark' ? '#333' : '#eee',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    whiteSpace: 'nowrap',
  },

  columnButtonContainer: {
    display: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    background: theme.palette.background.paper,
    zIndex: 100,
    height: '100%',
    boxSizing: 'border-box',
  },

  topLeftCorner: {
    background: theme.palette.mode === 'dark' ? '#333' : '#eee',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    minWidth: theme.spacing(2),
    textAlign: 'left',
  },

  emptyMessage: {
    captionSide: 'bottom',
  },
}))

const DataTableBody = observer(function ({
  rows,
  spreadsheetModel,
  page,
  rowsPerPage,
}: {
  rows: RowModel[]
  spreadsheetModel: SpreadsheetModel
  page: number
  rowsPerPage: number
}) {
  return (
    <tbody>
      {rows.slice(rowsPerPage * page, rowsPerPage * (page + 1)).map(row => (
        <DataRow
          key={row.id}
          rowNumber={row.id}
          spreadsheetModel={spreadsheetModel}
          rowModel={row}
        />
      ))}
    </tbody>
  )
})

const DataTableHeader = observer(function ({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { classes } = useStyles()
  const { columnDisplayOrder, columns, hasColumnNames, rowSet } = model
  const [currentColumnMenu, setColumnMenu] = useState<ColMenu>()
  const [currentHoveredColumn, setHoveredColumn] = useState<number>()

  return (
    <>
      <thead>
        <tr>
          <th className={classes.topLeftCorner}>
            <Tooltip title="Unselect all" placement="right">
              <span>
                <IconButton
                  onClick={() => model.unselectAll()}
                  disabled={!rowSet.selectedCount}
                >
                  <CropFreeIcon />
                </IconButton>
              </span>
            </Tooltip>
          </th>
          {columnDisplayOrder.map(colNumber => (
            <th
              className={classes.columnHead}
              key={colNumber}
              onMouseOver={() => setHoveredColumn(colNumber)}
              onMouseOut={() => setHoveredColumn(undefined)}
            >
              <SortIndicator model={model} columnNumber={colNumber} />
              {(hasColumnNames && columns[colNumber]?.name) ||
                numToColName(colNumber)}
              <div
                className={classes.columnButtonContainer}
                style={{
                  display:
                    currentHoveredColumn === colNumber ||
                    currentColumnMenu?.colNumber === colNumber
                      ? 'block'
                      : 'none',
                }}
              >
                <IconButton
                  onClick={(evt: React.MouseEvent<HTMLElement>) => {
                    setColumnMenu({
                      colNumber,
                      anchorEl: evt.currentTarget,
                    })
                  }}
                >
                  <ArrowDropDown />
                </IconButton>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <ColumnMenu
        viewModel={getParent(model)}
        spreadsheetModel={model}
        currentColumnMenu={currentColumnMenu}
        setColumnMenu={setColumnMenu}
      />
    </>
  )
})

const DataTable = observer(function ({
  model,
  page,
  rowsPerPage,
}: {
  model: SpreadsheetModel
  page: number
  rowsPerPage: number
}) {
  const { rowSet } = model
  const { classes } = useStyles()
  const rows = rowSet.sortedFilteredRows
  return (
    <>
      <RowMenu viewModel={getParent(model)} spreadsheetModel={model} />
      <table className={classes.dataTable}>
        <DataTableHeader model={model} />
        <DataTableBody
          rows={rows}
          spreadsheetModel={model}
          page={page}
          rowsPerPage={rowsPerPage}
        />
        {!rows.length ? (
          <caption className={classes.emptyMessage}>
            {rowSet.count ? 'no rows match criteria' : 'no rows present'}
          </caption>
        ) : null}
      </table>
    </>
  )
})

export default DataTable
