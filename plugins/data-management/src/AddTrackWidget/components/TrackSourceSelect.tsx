import { FileSelector } from '@jbrowse/core/ui'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { AddTrackModel } from '../model'
import { getRoot } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { getConf, readConfObject } from '@jbrowse/core/configuration'

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
  const internetAccountConfigs = readConfObject(
    rootModel.jbrowse,
    'internetAccounts',
  )
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
          internetAccountConfigs={internetAccountConfigs}
        />
        <FileSelector
          name="Index file"
          description="Automatically inferred from the URL if not supplied"
          location={model.indexTrackData}
          setLocation={model.setIndexTrackData}
          setName={model.setTrackName}
          internetAccounts={rootModel.internetAccounts}
          internetAccountConfigs={internetAccountConfigs}
        />
      </Paper>
    </div>
  )
}

export default observer(TrackSourceSelect)
