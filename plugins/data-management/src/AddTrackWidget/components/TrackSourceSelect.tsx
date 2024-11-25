import React from 'react'
import { FileSelector } from '@jbrowse/core/ui'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import type { AddTrackModel } from '../model'
import type { AbstractRootModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(2),
  },
  spacer: {
    height: theme.spacing(8),
  },
}))

const TrackSourceSelect = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
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
})

export default TrackSourceSelect
