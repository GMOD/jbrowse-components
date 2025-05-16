import { Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})
export default function DateSinceLastUsed({
  row,
}: {
  row: { updated?: number; showDateTooltip: boolean; lastModified: string }
}) {
  const { updated = 0, lastModified } = row
  const date = new Date(updated)
  const { classes } = useStyles()
  return row.showDateTooltip ? (
    <Tooltip title={date.toLocaleString('en-US')}>
      <div className={classes.cell}>{lastModified}</div>
    </Tooltip>
  ) : (
    <div className={classes.cell}>{lastModified}</div>
  )
}
