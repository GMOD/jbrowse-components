import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, MenuItem, Select, Typography } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  pageInfo: {
    margin: `0 ${theme.spacing(1)}`,
  },
  rowSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginLeft: theme.spacing(2),
  },
  summary: {
    marginLeft: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}))

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
  const rowsOnPage = Math.min(pageSize, totalRows - pageIndex * pageSize)

  return (
    <div className={classes.container}>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          onPageChange(0)
        }}
        disabled={!canPrevious}
      >
        {'<<'}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          onPageChange(pageIndex - 1)
        }}
        disabled={!canPrevious}
      >
        {'<'}
      </Button>
      <Typography className={classes.pageInfo}>
        Page <strong>{pageIndex + 1}</strong> of <strong>{pageCount}</strong>
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          onPageChange(pageIndex + 1)
        }}
        disabled={!canNext}
      >
        {'>'}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          onPageChange(pageCount - 1)
        }}
        disabled={!canNext}
      >
        {'>>'}
      </Button>
      <div className={classes.rowSelector}>
        <Typography variant="body2">Show</Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={e => {
            onPageSizeChange(Number(e.target.value))
          }}
        >
          {[50, 100, 200, 500, 1000].map(n => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="body2">rows</Typography>
      </div>
      <Typography variant="body2" className={classes.summary}>
        Showing {rowsOnPage} of {totalRows} rows
      </Typography>
    </div>
  )
}
