import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

export default function StatusMessage({
  trackAdapter,
  trackType,
}: {
  trackAdapter: { type: string; subadapter?: { type: string } }
  trackType: string
}) {
  const { classes } = useStyles()
  const { type, subadapter } = trackAdapter
  return type === 'SNPCoverageAdapter' ? (
    <Typography className={classes.spacing}>
      Selected <code>{trackType}</code>. Using adapter <code>{type}</code> with
      subadapter <code>{subadapter?.type}</code>. Please enter a track name and,
      if necessary, update the track type.
    </Typography>
  ) : (
    <Typography className={classes.spacing}>
      Using adapter <code>{type}</code> and guessing track type{' '}
      <code>{trackType}</code>. Please enter a track name and, if necessary,
      update the track type.
    </Typography>
  )
}
