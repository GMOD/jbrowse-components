import { FileSelector } from '@jbrowse/core/ui'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { AddTrackModel } from '../model'
import { getRoot } from 'mobx-state-tree'
import { observer } from 'mobx-react'

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
  const rootModel = getRoot(model)

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <FileSelector
          name="Main file"
          description=""
          location={model.trackData}
          setLocation={model.setTrackData}
          setName={model.setTrackName}
          internetAccounts={rootModel.internetAccounts}
        />
        <FileSelector
          name="Index file"
          description="The URL of the index file is automatically inferred from the URL of the main file if it is not supplied."
          location={model.indexTrackData}
          setLocation={model.setIndexTrackData}
          setName={model.setTrackName}
          internetAccounts={rootModel.internetAccounts}
        />
      </Paper>
    </div>
  )
}

export default observer(TrackSourceSelect)
