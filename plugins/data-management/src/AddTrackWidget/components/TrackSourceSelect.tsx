import { FileSelector } from '@jbrowse/core/ui'
import {
  getEnv,
  isBlobLocation,
  isFileHandleLocation,
  isUriLocation,
} from '@jbrowse/core/util'
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

function indexDescription(model: AddTrackModel) {
  const { detectedIndexName, localIndexNeed, trackData } = model
  return detectedIndexName
    ? `Found "${detectedIndexName}" next to the main file and filled it in. Replace it to use a different index.`
    : localIndexNeed?.kind === 'required'
      ? `Required: choose the ${localIndexNeed.suffix} index for this file. JBrowse cannot look next to a file picked from this computer.`
      : localIndexNeed?.kind === 'wholeFile'
        ? 'Optional. Without one, the whole file is read at once, which suits a small file.'
        : isBlobLocation(trackData) || isFileHandleLocation(trackData)
          ? 'Optional.'
          : 'Optional. Left empty, the index is looked for next to the main file.'
}

const TrackSourceSelect = observer(function TrackSourceSelect({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const { rootModel } = getEnv(model).pluginManager
  const { trackData } = model
  const mainIsLocal = !!trackData && !isUriLocation(trackData)

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
          key={mainIsLocal ? 'local' : 'remote'}
          name="Index file"
          defaultSourceType={mainIsLocal ? 'file' : undefined}
          description={indexDescription(model)}
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
