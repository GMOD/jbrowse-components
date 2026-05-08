import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'

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
  const { updated, lastModified, showDateTooltip } = row
  const { classes } = useStyles()
  const content = <div className={classes.cell}>{lastModified}</div>
  return showDateTooltip && updated !== undefined ? (
    <Tooltip title={new Date(updated).toLocaleString('en-US')}>{content}</Tooltip>
  ) : (
    content
  )
}
