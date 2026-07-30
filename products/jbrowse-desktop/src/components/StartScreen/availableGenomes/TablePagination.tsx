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

// Spells out what the counts are scoped to, since a search that comes up empty
// in one group can still have hits in the other eighteen.
function summarize(
  pageIndex: number,
  pageSize: number,
  totalRows: number,
  scopeTotal: number,
  scopeLabel: string,
) {
  const fmt = (n: number) => n.toLocaleString()
  const range = totalRows
    ? `${fmt(pageIndex * pageSize + 1)}–${fmt(Math.min(totalRows, (pageIndex + 1) * pageSize))} of ${fmt(totalRows)}`
    : '0'
  return totalRows === scopeTotal
    ? `Showing ${range} ${scopeLabel}`
    : `Showing ${range} matching (${fmt(scopeTotal)} ${scopeLabel})`
}

export default function TablePagination({
  pageIndex,
  pageSize,
  totalRows,
  scopeTotal,
  scopeLabel,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  totalRows: number
  scopeTotal: number
  scopeLabel: string
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const { classes } = useStyles()
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const canPrevious = pageIndex > 0
  const canNext = pageIndex < pageCount - 1

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
        {summarize(pageIndex, pageSize, totalRows, scopeTotal, scopeLabel)}
      </Typography>
    </div>
  )
}
