import { FileSelector } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import type { AddTrackModel } from '../model.ts'
import type { AbstractRootModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(2),
  },
  spacer: {
    height: theme.spacing(8),
  },
}))

const TrackSourceSelect = observer(function TrackSourceSelect({
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
        rootModel={rootModel}
      />
    </Paper>
  )
})

export default TrackSourceSelect
