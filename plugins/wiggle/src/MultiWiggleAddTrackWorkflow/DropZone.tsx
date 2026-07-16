import { FileDropZone } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import { fileToTrackItem } from './util.ts'

import type { TrackItem } from './util.ts'

const DropZone = observer(function DropZone({
  addTracks,
}: {
  addTracks: (items: TrackItem[]) => void
}) {
  return (
    <FileDropZone
      onDrop={accepted => {
        addTracks(accepted.map(fileToTrackItem))
      }}
    />
  )
})

export default DropZone
