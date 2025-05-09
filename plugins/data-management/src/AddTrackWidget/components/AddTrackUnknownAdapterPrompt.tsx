import { Link, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import TrackAdapterSelector from './TrackAdapterSelector'

import type { AddTrackModel } from '../model'
const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

export default function UnknownAdapterPrompt({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  return (
    <>
      <Typography className={classes.spacing}>
        JBrowse was not able to guess the adapter type for this data, but it may
        be in the list below. If not, you can{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          check for new releases
        </Link>{' '}
        of JBrowse to see if they support this data type or{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          file an issue
        </Link>{' '}
        and add a feature request for this data type.
      </Typography>
      <TrackAdapterSelector model={model} />
    </>
  )
}
