import React from 'react'
import { observer } from 'mobx-react'
import { getParent, Instance } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import SpreadsheetStateModel from '../models/Spreadsheet'
import RowStateModel from '../models/Row'
import RowMenu from './RowMenu'
import DataRow from './DataRow'
import DataTableHeader from './DataTableHeader'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>
type RowModel = Instance<typeof RowStateModel>

const useStyles = makeStyles()(theme => ({
  dataTable: {
    borderCollapse: 'collapse',
    '& td': {
      border: `1px solid ${theme.palette.action.disabledBackground}`,
      padding: '0.2rem',
      maxWidth: '50em',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
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
