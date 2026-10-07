import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

const DateSinceLastUsed = observer(function DateSinceLastUsed({
  row,
}: {
  row: { lastModified: string; lastModifiedTooltip?: string }
}) {
  const { lastModified, lastModifiedTooltip } = row
  const { classes } = useStyles()
  const content = <div className={classes.cell}>{lastModified}</div>
  return lastModifiedTooltip ? (
    <Tooltip title={lastModifiedTooltip}>{content}</Tooltip>
  ) : (
    content
  )
})

export default DateSinceLastUsed
