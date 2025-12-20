import { ExternalLink } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

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
        <ExternalLink href="https://github.com/GMOD/jbrowse-components/releases">
          check for new releases
        </ExternalLink>{' '}
        of JBrowse to see if they support this data type or{' '}
        <ExternalLink href="https://github.com/GMOD/jbrowse-components/issues/new">
          file an issue
        </ExternalLink>{' '}
        and add a feature request for this data type.
      </Typography>
      <TrackAdapterSelector model={model} />
    </>
  )
}
