import { FileSelector } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { AddTrackModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  files: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}))

const TrackSourceSelect = observer(function TrackSourceSelect({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const { rootModel } = getEnv(model).pluginManager

  return (
    <div className={classes.files}>
      <div>
        <FileSelector
          name="Main file"
          location={model.trackData}
          setLocation={loc => {
            model.setTrackData(loc)
          }}
          rootModel={rootModel}
        />
      </div>
      <div>
        <FileSelector
          name="Index file"
          description={
            model.detectedIndexName
              ? `Found "${model.detectedIndexName}" next to the main file and filled it in. Replace it to use a different index.`
              : 'Optional. Left empty, the index is looked for next to the main file.'
          }
          location={model.indexTrackData}
          setLocation={loc => {
            model.setIndexTrackData(loc)
          }}
          rootModel={rootModel}
        />
      </div>
    </div>
  )
})

export default TrackSourceSelect
