import { makeStyles } from 'tss-react/mui'

import type { Table } from '@tanstack/react-table'

const useStyles = makeStyles()({
  paginationContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  paginationButton: {
    padding: '0.3rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '0.1rem',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  pageInfo: {
    margin: '0 0.5rem',
  },
})

interface TablePaginationProps {
  table: Table<any>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  totalRows: number
  displayedRows: number
}

export default function TablePagination({
  table,
  pagination,
  setPagination,
  totalRows,
  displayedRows,
}: TablePaginationProps) {
  const { classes } = useStyles()

  return (
    <div className={classes.paginationContainer}>
      <button
        className={classes.paginationButton}
        onClick={() => {
          table.setPageIndex(0)
        }}
        disabled={!table.getCanPreviousPage()}
      >
        {'<<'}
      </button>
      <button
        className={classes.paginationButton}
        onClick={() => {
          table.previousPage()
        }}
        disabled={!table.getCanPreviousPage()}
      >
        {'<'}
      </button>
      <span className={classes.pageInfo}>
        Page{' '}
        <strong>
          {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </strong>
      </span>
      <button
        className={classes.paginationButton}
        onClick={() => {
          table.nextPage()
        }}
        disabled={!table.getCanNextPage()}
      >
        {'>'}
      </button>
      <button
        className={classes.paginationButton}
        onClick={() => {
          table.setPageIndex(table.getPageCount() - 1)
        }}
        disabled={!table.getCanNextPage()}
      >
        {'>>'}
      </button>
      <div style={{ marginLeft: '1rem' }}>
        <label>Show:</label>
        <select
          value={pagination.pageSize}
          onChange={e => {
            const newSize = Number(e.target.value)
            setPagination({
              pageIndex: 0,
              pageSize: newSize,
            })
          }}
          style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
        </select>
        <span style={{ marginLeft: '0.5rem' }}>rows</span>
      </div>
      <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#666' }}>
        Showing {displayedRows} of {totalRows} rows
      </span>
    </div>
  )
}
