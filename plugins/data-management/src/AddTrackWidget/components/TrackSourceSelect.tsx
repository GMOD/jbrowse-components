import { FileSelector } from '@jbrowse/core/ui'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { AddTrackModel } from '../model'

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    padding: theme.spacing(1),
  },
}))

function TrackSourceSelect({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <FileSelector
          name="Main file"
          description=""
          location={model.trackData}
          setLocation={model.setTrackData}
        />
        <FileSelector
          name="Index file"
          description="Automatically inferred from the URL if not supplied"
          location={model.indexTrackData}
          setLocation={model.setIndexTrackData}
        />
      </Paper>
    </div>
  )
}

export default TrackSourceSelect
