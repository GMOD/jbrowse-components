import { makeStyles } from '@jbrowse/core/util/tss-react'

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

export default function TablePagination({
  pageIndex,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  totalRows: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const { classes } = useStyles()
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const canPrevious = pageIndex > 0
  const canNext = pageIndex < pageCount - 1

  return (
    <div className={classes.paginationContainer}>
      <button
        className={classes.paginationButton}
        onClick={() => {
          onPageChange(0)
        }}
        disabled={!canPrevious}
      >
        {'<<'}
      </button>
      <button
        className={classes.paginationButton}
        onClick={() => {
          onPageChange(pageIndex - 1)
        }}
        disabled={!canPrevious}
      >
        {'<'}
      </button>
      <span className={classes.pageInfo}>
        Page{' '}
        <strong>
          {pageIndex + 1} of {pageCount}
        </strong>
      </span>
      <button
        className={classes.paginationButton}
        onClick={() => {
          onPageChange(pageIndex + 1)
        }}
        disabled={!canNext}
      >
        {'>'}
      </button>
      <button
        className={classes.paginationButton}
        onClick={() => {
          onPageChange(pageCount - 1)
        }}
        disabled={!canNext}
      >
        {'>>'}
      </button>
      <div style={{ marginLeft: '1rem' }}>
        <label>Show:</label>
        <select
          value={pageSize}
          onChange={e => {
            onPageSizeChange(Number(e.target.value))
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
        Showing {Math.min(pageSize, totalRows - pageIndex * pageSize)} of{' '}
        {totalRows} rows
      </span>
    </div>
  )
}
