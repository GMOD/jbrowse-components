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
    border: `1px solid ${theme.palette.action.disabledBackground}`,
    position: 'sticky',
    top: '-1px',
    zIndex: 2,
    whiteSpace: 'nowrap',
  },

  columnButtonContainer: {
    display: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    background: theme.palette.action.disabled,
    height: '100%',
    boxSizing: 'border-box',
    borderLeft: `1px solid ${theme.palette.action.disabledBackground}`,
  },
  columnButton: {
    padding: 0,
  },
  topLeftCorner: {
    background: theme.palette.action.disabledBackground,
    position: 'sticky',
    top: '-1px',
    zIndex: 2,
    minWidth: theme.spacing(2),
    textAlign: 'left',
  },

  emptyMessage: { captionSide: 'bottom' },
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

const DataTable = observer(function ({
  model,
  page,
  rowsPerPage,
}: {
  model: SpreadsheetModel
  page: number
  rowsPerPage: number
}) {
  const { columnDisplayOrder, columns, hasColumnNames, rowSet } = model
  const { classes } = useStyles()

  // column menu active state
  const [currentColumnMenu, setColumnMenu] = useState<ColMenu>()
  function columnButtonClick(
    colNumber: number,
    evt: React.MouseEvent<HTMLElement>,
  ) {
    setColumnMenu({
      colNumber,
      anchorEl: evt.currentTarget,
    })
  }

  // column header hover state
  const [currentHoveredColumn, setHoveredColumn] = useState<number>()
  function columnHeaderMouseOver(colNumber: number) {
    setHoveredColumn(colNumber)
  }
  function columnHeaderMouseOut() {
    setHoveredColumn(undefined)
  }

  const totalRows = rowSet.count
  const rows = rowSet.sortedFilteredRows

  return (
    <>
      <ColumnMenu
        viewModel={getParent(model)}
        spreadsheetModel={model}
        currentColumnMenu={currentColumnMenu}
        setColumnMenu={setColumnMenu}
      />
      <RowMenu viewModel={getParent(model)} spreadsheetModel={model} />
      <table className={classes.dataTable}>
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
                onMouseOver={columnHeaderMouseOver.bind(null, colNumber)}
                onMouseOut={columnHeaderMouseOut.bind(null, colNumber)}
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
                    className={classes.columnButton}
                    onClick={columnButtonClick.bind(null, colNumber)}
                  >
                    <ArrowDropDown />
                  </IconButton>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <DataTableBody
          rows={rows}
          spreadsheetModel={model}
          page={page}
          rowsPerPage={rowsPerPage}
        />
        {!rows.length ? (
          <caption className={classes.emptyMessage}>
            {totalRows ? 'no rows match criteria' : 'no rows present'}
          </caption>
        ) : null}
      </table>
    </>
  )
})

export default DataTable
