import React from 'react'
import { FileSelector } from '@jbrowse/core/ui'
import { Paper, makeStyles } from '@material-ui/core'
import { AddTrackModel } from '../model'
import { getRoot } from 'mobx-state-tree'
import { observer } from 'mobx-react'

const useStyles = makeStyles(theme => ({
  paper: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
  },
  spacer: {
    height: theme.spacing(8),
  },
}))

function TrackSourceSelect({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  const rootModel = getRoot(model)

  return (
    <Paper className={classes.paper}>
      <FileSelector
        name="Main file"
        description=""
        location={model.trackData}
        setLocation={model.setTrackData}
        setName={model.setTrackName}
        rootModel={rootModel}
      />
      <div className={classes.spacer} />
      <FileSelector
        name="Index file"
        description="(Optional) The URL of the index file is automatically inferred from the URL of the main file if it is not supplied."
        location={model.indexTrackData}
        setLocation={model.setIndexTrackData}
        setName={model.setTrackName}
        rootModel={rootModel}
      />
    </Paper>
  )
}

export default observer(TrackSourceSelect)
