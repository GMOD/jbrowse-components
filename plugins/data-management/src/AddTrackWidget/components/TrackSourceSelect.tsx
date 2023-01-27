import React from 'react'
import { FileSelector } from '@jbrowse/core/ui'
import { AbstractRootModel } from '@jbrowse/core/util'
import { Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getRoot } from 'mobx-state-tree'
import { observer } from 'mobx-react'

// locals
import { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(2),
  },
  spacer: {
    height: theme.spacing(8),
  },
}))

function TrackSourceSelect({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  const rootModel = getRoot<AbstractRootModel>(model)

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
